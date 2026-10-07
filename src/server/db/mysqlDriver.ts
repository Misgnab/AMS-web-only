import { Worker, MessageChannel, receiveMessageOnPort } from "worker_threads";
import type { IDatabaseDriver, MysqlConfig, PreparedStatement, DatabaseStatusDetails } from "./databaseTypes.ts";
import { normalizeMysqlQuery, normalizeParams } from "./sqlTranslator.ts";
import { DATABASE_TABLE_ORDER, MYSQL_CREATE_TABLE_QUERIES } from "./mysqlSchema.ts";

const WORKER_CODE = `
  const { parentPort, workerData } = require("worker_threads");
  const mysql = require("mysql2/promise");
  const int32 = new Int32Array(workerData.sab);
  let pool = null;
  let currentConfig = null;

  async function handleMessage(msg) {
    switch (msg.type) {
      case "init": {
        try {
          currentConfig = msg.config;
          const targetDb = msg.config.database || "buildtrack_ams";
          const connConfig = {
            host: msg.config.host || "127.0.0.1",
            port: msg.config.port || 3306,
            user: msg.config.user || "root",
            password: msg.config.password !== undefined ? msg.config.password : "",
            ssl: msg.config.ssl ? { rejectUnauthorized: false } : undefined,
            connectTimeout: ["127.0.0.1", "localhost"].includes(msg.config.host || "") ? 1000 : 7000
          };

          if (pool) {
            try { await pool.end(); } catch (_) {}
            pool = null;
          }

          // 1. First attempt: Connect directly to the target database in the connection pool.
          // On cPanel, AWS RDS, Cloud SQL, and production servers, the database is pre-created
          // and the user has permissions strictly on that database.
          let directError = null;
          try {
            pool = mysql.createPool({
              ...connConfig,
              database: targetDb,
              waitForConnections: true,
              connectionLimit: msg.config.connectionLimit || 10,
              queueLimit: 0,
              multipleStatements: true,
              dateStrings: true,
              enableKeepAlive: true,
              keepAliveInitialDelay: 10000
            });

            const start = Date.now();
            const [res] = await pool.query("SELECT 1 as alive, VERSION() as version");
            const latency = Date.now() - start;

            return { ok: true, version: res[0]?.version || "MySQL", latency };
          } catch (err) {
            directError = err;
            if (pool) {
              try { await pool.end(); } catch (_) {}
              pool = null;
            }
          }

          // 2. Second attempt: If direct connection failed specifically because database does not exist (ER_BAD_DB_ERROR / 1049),
          // attempt to create it (applicable in local dev or container root environments).
          if (directError && (directError.code === "ER_BAD_DB_ERROR" || directError.errno === 1049)) {
            try {
              const tempConn = await mysql.createConnection(connConfig);
              await tempConn.query(\`CREATE DATABASE IF NOT EXISTS \\\`\${targetDb}\\\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci\`);
              await tempConn.end();

              pool = mysql.createPool({
                ...connConfig,
                database: targetDb,
                waitForConnections: true,
                connectionLimit: msg.config.connectionLimit || 10,
                queueLimit: 0,
                multipleStatements: true,
                dateStrings: true,
                enableKeepAlive: true,
                keepAliveInitialDelay: 10000
              });

              const start = Date.now();
              const [res] = await pool.query("SELECT 1 as alive, VERSION() as version");
              const latency = Date.now() - start;

              return { ok: true, version: res[0]?.version || "MySQL", latency };
            } catch (createErr) {
              pool = null;
              return { 
                ok: false, 
                error: \`Database '\${targetDb}' does not exist and could not be auto-created: \${createErr.message}\`, 
                code: createErr.code 
              };
            }
          }

          // 3. Return the specific connection error (e.g. Access denied for user, ECONNREFUSED)
          pool = null;
          return { ok: false, error: directError?.message || "Failed to connect to MySQL", code: directError?.code };
        } catch (err) {
          pool = null;
          return { ok: false, error: err.message, code: err.code };
        }
      }

      case "query": {
        if (!pool) {
          return { error: "MySQL pool not connected" };
        }
        try {
          const sql = msg.sql;
          const params = msg.params || [];
          const [result] = await pool.query(sql, params);

          if (Array.isArray(result)) {
            // SELECT or SHOW query
            return { ok: true, rows: result };
          } else {
            // INSERT / UPDATE / DELETE
            return {
              ok: true,
              lastInsertRowid: result.insertId || 0,
              changes: result.affectedRows || 0
            };
          }
        } catch (err) {
          return { error: err.message, sql: msg.sql, code: err.code };
        }
      }

      case "exec": {
        if (!pool) {
          return { error: "MySQL pool not connected" };
        }
        try {
          await pool.query(msg.sql);
          return { ok: true };
        } catch (err) {
          return { error: err.message, sql: msg.sql, code: err.code };
        }
      }

      case "test": {
        try {
          const cfg = msg.config;
          const start = Date.now();
          const conn = await mysql.createConnection({
            host: cfg.host || "127.0.0.1",
            port: cfg.port || 3306,
            user: cfg.user || "root",
            password: cfg.password !== undefined ? cfg.password : "",
            database: cfg.database || undefined,
            ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
            connectTimeout: 5000
          });
          const [res] = await conn.query("SELECT VERSION() as version");
          const latency = Date.now() - start;
          await conn.end();
          return { ok: true, latency, version: res[0]?.version || "Unknown" };
        } catch (err) {
          return { ok: false, error: err.message, code: err.code };
        }
      }

      case "status": {
        if (!pool) {
          return { ok: false, connected: false };
        }
        try {
          const start = Date.now();
          const [res] = await pool.query("SELECT 1 as alive");
          const latency = Date.now() - start;
          return { ok: true, connected: true, latency };
        } catch (err) {
          return { ok: false, connected: false, error: err.message };
        }
      }

      case "close": {
        if (pool) {
          try { await pool.end(); } catch (_) {}
          pool = null;
        }
        return { ok: true };
      }

      default:
        return { error: "Unknown worker message type: " + msg.type };
    }
  }

  workerData.port.on("message", async (msg) => {
    try {
      const response = await handleMessage(msg);
      workerData.port.postMessage(response);
    } catch (e) {
      workerData.port.postMessage({ error: e.message });
    } finally {
      Atomics.store(int32, 0, 1);
      Atomics.notify(int32, 0, 1);
    }
  });
`;

export class MysqlDriver implements IDatabaseDriver {
  public readonly name = "mysql";
  private worker: Worker | null = null;
  private channel: MessageChannel | null = null;
  private sab: SharedArrayBuffer | null = null;
  private int32: Int32Array | null = null;
  private config: MysqlConfig | null = null;
  private connected = false;
  private lastError: string | null = null;
  private version = "";
  private latencyMs = 0;

  constructor(config?: MysqlConfig) {
    if (config) {
      this.init(config);
    }
  }

  public init(config: MysqlConfig): boolean {
    this.config = config;
    try {
      if (this.worker) {
        this.close();
      }

      this.sab = new SharedArrayBuffer(4);
      this.int32 = new Int32Array(this.sab);
      this.channel = new MessageChannel();

      this.worker = new Worker(WORKER_CODE, {
        eval: true,
        workerData: { sab: this.sab, port: this.channel.port2 },
        transferList: [this.channel.port2]
      });
      this.worker.unref();

      // Synchronously initialize pool and test connection
      const initTimeout = ["127.0.0.1", "localhost"].includes(config.host || "") ? 1500 : 8000;
      const res = this.dispatchSync({ type: "init", config }, initTimeout);
      if (res && res.ok) {
        this.connected = true;
        this.lastError = null;
        this.version = res.version || "MySQL";
        this.latencyMs = res.latency || 0;
        console.log(`[MySQL] Connected successfully to ${config.host}:${config.port}/${config.database} (${this.version}) in ${this.latencyMs}ms`);
        this.initSchema();
        return true;
      } else {
        this.connected = false;
        this.lastError = res?.error || "Failed to initialize MySQL connection";
        console.log(`[MySQL] Connection status: ${this.lastError}`);
        return false;
      }
    } catch (err: any) {
      this.connected = false;
      this.lastError = err.message || "MySQL worker error";
      console.log(`[MySQL] Initialization notice: ${this.lastError}`);
      return false;
    }
  }

  private dispatchSync(payload: any, timeoutMs = 15000): any {
    if (!this.channel || !this.int32) {
      throw new Error("MySQL driver not initialized");
    }

    // Reset synchronization flag
    Atomics.store(this.int32, 0, 0);

    // Send payload to worker
    this.channel.port1.postMessage(payload);

    // Wait synchronously for worker to notify
    const waitResult = Atomics.wait(this.int32, 0, 0, timeoutMs);
    if (waitResult === "timed-out") {
      throw new Error(`MySQL query timed out after ${timeoutMs}ms`);
    }

    // Reset flag for next query
    Atomics.store(this.int32, 0, 0);

    // Read response message
    const msg = receiveMessageOnPort(this.channel.port1);
    if (!msg || !msg.message) {
      throw new Error("No response received from MySQL worker");
    }

    return msg.message;
  }

  public isReady(): boolean {
    return this.connected;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getConfig(): MysqlConfig | null {
    return this.config;
  }

  public prepare(sql: string): PreparedStatement {
    const rawSql = sql;
    const translatedSql = normalizeMysqlQuery(rawSql);

    return {
      get: (...params: any[]) => {
        if (!this.connected && this.config) {
          try { this.init(this.config); } catch (_) {}
        }
        if (!this.connected) {
          throw new Error(`MySQL is not connected: ${this.lastError || "Check connection"}`);
        }
        const cleanParams = normalizeParams(params);
        const res = this.dispatchSync({ type: "query", sql: translatedSql, params: cleanParams });
        if (res.error) {
          throw new Error(`MySQL Query Error: ${res.error} (SQL: ${translatedSql})`);
        }
        if (Array.isArray(res.rows)) {
          return res.rows.length > 0 ? res.rows[0] : undefined;
        }
        return res;
      },

      all: (...params: any[]) => {
        if (!this.connected && this.config) {
          try { this.init(this.config); } catch (_) {}
        }
        if (!this.connected) {
          throw new Error(`MySQL is not connected: ${this.lastError || "Check connection"}`);
        }
        const cleanParams = normalizeParams(params);
        const res = this.dispatchSync({ type: "query", sql: translatedSql, params: cleanParams });
        if (res.error) {
          throw new Error(`MySQL Query Error: ${res.error} (SQL: ${translatedSql})`);
        }
        return Array.isArray(res.rows) ? res.rows : [];
      },

      run: (...params: any[]) => {
        if (!this.connected && this.config) {
          try { this.init(this.config); } catch (_) {}
        }
        if (!this.connected) {
          throw new Error(`MySQL is not connected: ${this.lastError || "Check connection"}`);
        }
        const cleanParams = normalizeParams(params);
        const res = this.dispatchSync({ type: "query", sql: translatedSql, params: cleanParams });
        if (res.error) {
          throw new Error(`MySQL Query Error: ${res.error} (SQL: ${translatedSql})`);
        }
        return {
          lastInsertRowid: res.lastInsertRowid || 0,
          changes: res.changes || 0
        };
      }
    };
  }

  public exec(sql: string): void {
    if (!this.connected && this.config) {
      try { this.init(this.config); } catch (_) {}
    }
    if (!this.connected) {
      throw new Error(`MySQL is not connected: ${this.lastError || "Check connection"}`);
    }
    const translatedSql = normalizeMysqlQuery(sql);
    const res = this.dispatchSync({ type: "exec", sql: translatedSql });
    if (res.error) {
      throw new Error(`MySQL Exec Error: ${res.error} (SQL: ${translatedSql})`);
    }
  }

  public pragma(pragmaStr: string): any {
    // Handle table_info
    const tableInfoMatch = pragmaStr.match(/table_info\s*\(\s*['"]?([a-zA-Z0-9_]+)['"]?\s*\)/i);
    if (tableInfoMatch) {
      const tableName = tableInfoMatch[1];
      try {
        const rows = this.prepare(`SHOW COLUMNS FROM \`${tableName}\``).all();
        return rows.map((r: any) => ({
          name: r.Field,
          type: r.Type,
          notnull: r.Null === "NO" ? 1 : 0,
          dflt_value: r.Default,
          pk: r.Key === "PRI" ? 1 : 0
        }));
      } catch (_) {
        return [];
      }
    }

    if (/quick_check/i.test(pragmaStr)) {
      return [{ quick_check: "ok" }];
    }

    if (/foreign_keys\s*=\s*(ON|1)/i.test(pragmaStr)) {
      try { this.exec("SET FOREIGN_KEY_CHECKS = 1;"); } catch (_) {}
      return;
    }

    if (/foreign_keys\s*=\s*(OFF|0)/i.test(pragmaStr)) {
      try { this.exec("SET FOREIGN_KEY_CHECKS = 0;"); } catch (_) {}
      return;
    }

    // Ignore WAL / synchronous pragmas on MySQL
    return [];
  }

  public transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]): T => {
      this.exec("START TRANSACTION;");
      try {
        const result = fn(...args);
        this.exec("COMMIT;");
        return result;
      } catch (err) {
        try {
          this.exec("ROLLBACK;");
        } catch (_) {}
        throw err;
      }
    };
  }

  public initSchema(): void {
    if (!this.connected) return;
    try {
      this.exec("SET FOREIGN_KEY_CHECKS = 0;");
      for (const tableName of DATABASE_TABLE_ORDER) {
        const query = MYSQL_CREATE_TABLE_QUERIES[tableName];
        if (query) {
          this.exec(query);
        }
      }
      this.exec("SET FOREIGN_KEY_CHECKS = 1;");
      console.log("[MySQL] Schema initialized with all tables.");
    } catch (err: any) {
      console.error("[MySQL] Schema initialization error:", err.message);
    }
  }

  public testConnection(testCfg: MysqlConfig): { success: boolean; latencyMs?: number; version?: string; error?: string } {
    try {
      if (!this.worker) {
        this.sab = new SharedArrayBuffer(4);
        this.int32 = new Int32Array(this.sab);
        this.channel = new MessageChannel();
        this.worker = new Worker(WORKER_CODE, {
          eval: true,
          workerData: { sab: this.sab, port: this.channel.port2 },
          transferList: [this.channel.port2]
        });
        this.worker.unref();
      }
      const res = this.dispatchSync({ type: "test", config: testCfg }, 12000);
      if (res && res.ok) {
        return { success: true, latencyMs: res.latency, version: res.version };
      } else {
        return { success: false, error: res?.error || "Connection test failed" };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  public getStatus(): DatabaseStatusDetails {
    const tableCounts: Record<string, number> = {};
    if (this.connected) {
      for (const t of DATABASE_TABLE_ORDER) {
        try {
          const row = this.prepare(`SELECT COUNT(*) as c FROM \`${t}\``).get();
          tableCounts[t] = Number(row?.c || 0);
        } catch (_) {
          tableCounts[t] = 0;
        }
      }
    }

    return {
      engine: "mysql",
      connected: this.connected,
      status: this.connected ? "CONNECTED" : (this.lastError ? "ERROR" : "DISCONNECTED"),
      error: this.lastError,
      latencyMs: this.latencyMs,
      tableCounts,
      details: {
        host: this.config?.host || "127.0.0.1",
        port: this.config?.port || 3306,
        database: this.config?.database || "buildtrack_ams",
        user: this.config?.user || "root",
        version: this.version
      }
    };
  }

  public close(): void {
    if (this.worker) {
      try {
        this.dispatchSync({ type: "close" }, 2000);
      } catch (_) {}
      try {
        this.worker.terminate();
      } catch (_) {}
      this.worker = null;
      this.channel = null;
      this.connected = false;
    }
  }
}
