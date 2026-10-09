import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import type { 
  DatabaseConfiguration, 
  DualDatabaseStatus, 
  IDatabaseDriver, 
  MysqlConfig, 
  PreparedStatement, 
  DatabaseStatusDetails,
  DatabaseEngine
} from "./databaseTypes.ts";
import { MysqlDriver } from "./mysqlDriver.ts";
import { SqliteDriver } from "./sqliteDriver.ts";
import { DATABASE_TABLE_ORDER, generateMysqlSchemaSql } from "./mysqlSchema.ts";
import { ensureMysqlRunning } from "./mysqlDaemon.ts";

// Ensure .env is read regardless of deployment working directory (e.g. cPanel / LiteSpeed / CloudLinux)
dotenv.config();
const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
try {
  const envCandidates = [
    path.join(process.cwd(), ".env"),
    path.join(currentDir, ".env"),
    path.join(currentDir, "..", ".env"),
    path.join(currentDir, "..", "..", ".env")
  ];
  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }
} catch (_) {}

function getResolvedConfigPath(): string {
  if (fs.existsSync(path.join(process.cwd(), "database-config.json"))) {
    return path.join(process.cwd(), "database-config.json");
  }
  if (fs.existsSync(path.join(currentDir, "database-config.json"))) {
    return path.join(currentDir, "database-config.json");
  }
  return path.join(process.cwd(), "database-config.json");
}

export class DatabaseManager implements IDatabaseDriver {
  public name: DatabaseEngine = "sqlite";
  private mysqlDriver: MysqlDriver;
  private sqliteDriver: SqliteDriver;
  private activeDriver: IDatabaseDriver;
  private effectiveEngine: DatabaseEngine = "sqlite";
  private isFallback = false;
  private config: DatabaseConfiguration;
  private onConnectedCallbacks: Array<() => void> = [];
  private reconnectTimer: any = null;
  private isReconnecting = false;

  constructor() {
    // 1. Load configuration
    this.config = this.loadInitialConfig();

    // 2. Ensure local MySQL / MariaDB daemon is running if local binaries are available
    try {
      ensureMysqlRunning();
    } catch (_) {}

    // 3. Initialize both driver instances
    this.sqliteDriver = new SqliteDriver();
    this.mysqlDriver = new MysqlDriver();

    // 4. Default active driver to SQLite for immediate reliability
    this.activeDriver = this.sqliteDriver;

    // 5. Connect and determine active vs fallback engine
    this.connect();
  }

  public onConnected(cb: () => void): void {
    this.onConnectedCallbacks.push(cb);
    if (this.isReady()) {
      try { cb(); } catch (_) {}
    }
  }

  private notifyConnected(): void {
    for (const cb of this.onConnectedCallbacks) {
      try { cb(); } catch (err) { console.error("[DatabaseManager] onConnected handler error:", err); }
    }
  }

  private startReconnectLoop(): void {
    if (this.reconnectTimer) return;
    // Do not continuously poll local 127.0.0.1/localhost if no local MySQL daemon is running
    if (["127.0.0.1", "localhost"].includes(this.config.mysql.host)) {
      return;
    }
    this.reconnectTimer = setInterval(() => {
      if (this.mysqlDriver.isReady() && this.effectiveEngine === "mysql") {
        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        return;
      }
      this.tryReconnect();
    }, 10000);
  }

  public tryReconnect(): boolean {
    if (this.isReconnecting) return false;
    this.isReconnecting = true;
    try {
      if (["127.0.0.1", "localhost"].includes(this.config.mysql.host)) {
        try { ensureMysqlRunning(); } catch (_) {}
      }

      const ok = this.mysqlDriver.init(this.config.mysql);
      if (ok) {
        try {
          this.mysqlDriver.initSchema();
        } catch (_) {}

        if (this.config.activeEngine === "mysql") {
          this.activeDriver = this.mysqlDriver;
          this.effectiveEngine = "mysql";
          this.isFallback = false;
          this.name = "mysql";
          console.log(`[DatabaseManager] Connected to MySQL database (${this.config.mysql.host}:${this.config.mysql.port}/${this.config.mysql.database}).`);
          this.notifyConnected();
        }

        if (this.reconnectTimer) {
          clearInterval(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    } finally {
      this.isReconnecting = false;
    }
  }

  private loadInitialConfig(): DatabaseConfiguration {
    const configPath = getResolvedConfigPath();
    let savedConfig: any = {};
    if (fs.existsSync(configPath)) {
      try {
        savedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (_) {}
    }

    const host = process.env.MYSQL_HOST || savedConfig?.mysql?.host || "127.0.0.1";
    const port = Number(process.env.MYSQL_PORT || savedConfig?.mysql?.port || 3306);
    const user = process.env.MYSQL_USER || savedConfig?.mysql?.user || "root";
    const password = process.env.MYSQL_PASSWORD !== undefined ? process.env.MYSQL_PASSWORD : (savedConfig?.mysql?.password ?? "");
    const database = process.env.MYSQL_DATABASE || savedConfig?.mysql?.database || "buildtrack_ams";
    const ssl = process.env.MYSQL_SSL === "true" || !!savedConfig?.mysql?.ssl;

    const requestedEngine = (savedConfig?.activeEngine || process.env.DB_TYPE || "sqlite").toLowerCase();
    const activeEngine: DatabaseEngine = requestedEngine === "mysql" ? "mysql" : "sqlite";

    return {
      activeEngine,
      mysql: {
        host,
        port,
        user,
        password,
        database,
        ssl,
        connectionLimit: 15
      }
    };
  }

  public connect(): boolean {
    if (this.config.activeEngine === "sqlite") {
      this.activeDriver = this.sqliteDriver;
      this.effectiveEngine = "sqlite";
      this.isFallback = false;
      this.name = "sqlite";
      console.log("[DatabaseManager] Using SQLite database as configured.");
      this.notifyConnected();
      return true;
    }

    // Try connecting to MySQL
    const connected = this.mysqlDriver.init(this.config.mysql);
    if (connected) {
      try {
        this.mysqlDriver.initSchema();
      } catch (err) {
        console.warn("[DatabaseManager] MySQL initSchema warning:", err);
      }
      this.activeDriver = this.mysqlDriver;
      this.effectiveEngine = "mysql";
      this.isFallback = false;
      this.name = "mysql";
      console.log(`[DatabaseManager] Connected to MySQL database (${this.config.mysql.host}:${this.config.mysql.port}/${this.config.mysql.database}).`);
      this.notifyConnected();
      return true;
    } else {
      // Graceful fallback to SQLite
      this.activeDriver = this.sqliteDriver;
      this.effectiveEngine = "sqlite";
      this.isFallback = true;
      this.name = "sqlite";
      console.warn(`[DatabaseManager] MySQL connection unavailable (${this.mysqlDriver.getLastError()}). Operating safely on SQLite database.`);
      this.notifyConnected();
      this.startReconnectLoop();
      return true;
    }
  }

  public initSchema(): void {
    try {
      this.sqliteDriver.initSchema();
    } catch (e: any) {
      console.warn("[DatabaseManager] SQLite schema warning:", e.message);
    }
    if (this.mysqlDriver.isReady()) {
      try {
        this.mysqlDriver.initSchema();
      } catch (e: any) {
        console.warn("[DatabaseManager] MySQL schema warning:", e.message);
      }
    }
  }

  public applyConfiguration(newConfig: { activeEngine?: DatabaseEngine; mysql: MysqlConfig }): boolean {
    this.config = {
      activeEngine: newConfig.activeEngine || "mysql",
      mysql: {
        host: newConfig.mysql.host || "127.0.0.1",
        port: Number(newConfig.mysql.port) || 3306,
        user: newConfig.mysql.user || "root",
        password: newConfig.mysql.password !== undefined ? newConfig.mysql.password : "",
        database: newConfig.mysql.database || "buildtrack_ams",
        ssl: !!newConfig.mysql.ssl,
        connectionLimit: 15
      }
    };

    // Save configuration file
    try {
      fs.writeFileSync(getResolvedConfigPath(), JSON.stringify(this.config, null, 2));
    } catch (_) {}

    // Persist to .env if writable
    try {
      const envPath = path.join(process.cwd(), ".env");
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
      const setEnvVar = (key: string, val: string) => {
        const regex = new RegExp(`^${key}=.*$`, "m");
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += (envContent.endsWith("\n") || !envContent ? "" : "\n") + `${key}=${val}\n`;
        }
      };
      setEnvVar("DB_TYPE", this.config.activeEngine);
      setEnvVar("MYSQL_HOST", this.config.mysql.host);
      setEnvVar("MYSQL_PORT", String(this.config.mysql.port));
      setEnvVar("MYSQL_USER", this.config.mysql.user);
      setEnvVar("MYSQL_PASSWORD", this.config.mysql.password || "");
      setEnvVar("MYSQL_DATABASE", this.config.mysql.database);
      fs.writeFileSync(envPath, envContent);
    } catch (_) {}

    if (this.config.activeEngine === "sqlite") {
      this.activeDriver = this.sqliteDriver;
      this.effectiveEngine = "sqlite";
      this.isFallback = false;
      this.name = "sqlite";
      this.notifyConnected();
      return true;
    }

    const ok = this.mysqlDriver.init(this.config.mysql);
    if (ok) {
      try {
        this.mysqlDriver.initSchema();
      } catch (err) {
        console.warn("[DatabaseManager] Error on MySQL schema init after config:", err);
      }
      this.activeDriver = this.mysqlDriver;
      this.effectiveEngine = "mysql";
      this.isFallback = false;
      this.name = "mysql";
      console.log(`[DatabaseManager] Successfully configured MySQL (${this.config.mysql.host}:${this.config.mysql.port}/${this.config.mysql.database}).`);
      this.notifyConnected();
      return true;
    } else {
      console.warn(`[DatabaseManager] MySQL connection failed. Error: ${this.mysqlDriver.getLastError()}`);
      this.activeDriver = this.sqliteDriver;
      this.effectiveEngine = "sqlite";
      this.isFallback = true;
      this.name = "sqlite";
      return false;
    }
  }

  public getActiveEngine(): DatabaseEngine {
    return this.config.activeEngine;
  }

  public getEffectiveEngine(): DatabaseEngine {
    return this.effectiveEngine;
  }

  public isFallbackMode(): boolean {
    return this.isFallback;
  }

  public isReady(): boolean {
    return this.activeDriver ? this.activeDriver.isReady() : false;
  }

  public getActiveDriver(): IDatabaseDriver {
    return this.activeDriver;
  }

  public prepare(sql: string): PreparedStatement {
    return this.activeDriver.prepare(sql);
  }

  public exec(sql: string): void {
    this.activeDriver.exec(sql);
  }

  public pragma(pragmaStr: string): any {
    return this.activeDriver.pragma(pragmaStr);
  }

  public transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return this.activeDriver.transaction(fn);
  }

  public getMysqlDriver(): MysqlDriver {
    return this.mysqlDriver;
  }

  public getSqliteDriver(): SqliteDriver {
    return this.sqliteDriver;
  }

  public getStatus(): DualDatabaseStatus {
    const mysqlStatus = this.mysqlDriver.getStatus();
    const sqliteStatus = this.sqliteDriver.getStatus();

    return {
      activeEngine: this.config.activeEngine,
      effectiveEngine: this.effectiveEngine,
      isFallback: this.isFallback,
      mysql: mysqlStatus,
      sqlite: sqliteStatus,
      tables: [...DATABASE_TABLE_ORDER]
    };
  }

  public testMysqlConnection(testConfig: MysqlConfig): { success: boolean; latencyMs?: number; version?: string; error?: string } {
    return this.mysqlDriver.testConnection(testConfig);
  }

  /**
   * Export complete SQL dump with schema and active data from active driver
   */
  public generateMysqlDumpSql(): string {
    const lines: string[] = [];
    lines.push(generateMysqlSchemaSql(this.config.mysql.database || "buildtrack_ams"));
    lines.push(``);
    lines.push(`-- =========================================================================`);
    lines.push(`-- Current Data Dump from BuildTrack AMS (${this.effectiveEngine.toUpperCase()} Engine)`);
    lines.push(`-- Exported on: ${new Date().toISOString()}`);
    lines.push(`-- Engine: ${this.effectiveEngine.toUpperCase()}`);
    lines.push(`-- =========================================================================`);
    lines.push(`SET FOREIGN_KEY_CHECKS = 0;`);
    lines.push(``);

    for (const table of DATABASE_TABLE_ORDER) {
      try {
        const rows = this.activeDriver.prepare(`SELECT * FROM \`${table}\``).all() as any[];
        if (rows.length > 0) {
          lines.push(`-- Data for table \`${table}\` (${rows.length} rows)`);
          for (const row of rows) {
            const keys = Object.keys(row);
            const cols = keys.map(k => `\`${k}\``).join(", ");
            const escapedVals = keys.map(k => {
              const v = row[k];
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "number") return v.toString();
              if (typeof v === "boolean") return v ? "1" : "0";
              const strVal = String(v).replace(/'/g, "\\'");
              return `'${strVal}'`;
            }).join(", ");

            lines.push(`REPLACE INTO \`${table}\` (${cols}) VALUES (${escapedVals});`);
          }
          lines.push(``);
        }
      } catch (_) {}
    }

    lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
    lines.push(`-- End of SQL Dump`);
    return lines.join("\n");
  }

  public close(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.mysqlDriver.close();
    this.sqliteDriver.close();
  }
}

// Global Singleton Instance
export const databaseManager = new DatabaseManager();
export const db = databaseManager;
