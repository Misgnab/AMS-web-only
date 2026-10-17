import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import type { IDatabaseDriver, PreparedStatement, DatabaseStatusDetails } from "./databaseTypes.ts";
import { DATABASE_TABLE_ORDER, MYSQL_CREATE_TABLE_QUERIES } from "./mysqlSchema.ts";

export class SqliteDriver implements IDatabaseDriver {
  public name: "sqlite" = "sqlite";
  private db: DatabaseSync | null = null;
  private dbFilePath: string;
  private ready = false;
  private lastError: string | null = null;

  constructor(filePath?: string) {
    this.dbFilePath = filePath || path.join(process.cwd(), "attendance.db");
  }

  public init(): boolean {
    try {
      this.db = new DatabaseSync(this.dbFilePath);
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");
      this.ready = true;
      this.lastError = null;
      return true;
    } catch (err: any) {
      this.ready = false;
      this.lastError = err.message || "Failed to initialize SQLite database";
      console.error("[SqliteDriver] Initialization error:", err);
      return false;
    }
  }

  public isReady(): boolean {
    return this.ready && this.db !== null;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public exec(sql: string): void {
    if (!this.db) throw new Error("SQLite is not initialized");
    const normalized = this.normalizeQuery(sql);
    this.db.exec(normalized);
  }

  public pragma(pragmaStr: string): any {
    if (!this.db) throw new Error("SQLite is not initialized");
    try {
      return this.db.prepare(`PRAGMA ${pragmaStr}`).all();
    } catch (_) {
      return null;
    }
  }

  public prepare(sql: string): PreparedStatement {
    if (!this.db) throw new Error("SQLite is not initialized");
    const normalized = this.normalizeQuery(sql);

    // Special handler for MySQL SHOW COLUMNS FROM `tableName` LIKE 'col'
    const showColsMatch = normalized.match(/SHOW\s+COLUMNS\s+FROM\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s+LIKE\s+\?/i);
    if (showColsMatch) {
      const tableName = showColsMatch[1];
      const self = this;
      return {
        get(...params: any[]) {
          const colName = params[0];
          try {
            const cols = self.db!.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
            return cols.find(c => c.name === colName) || null;
          } catch (_) {
            return null;
          }
        },
        all(...params: any[]) {
          const colName = params[0];
          try {
            const cols = self.db!.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
            const found = cols.find(c => c.name === colName);
            return found ? [{ Field: found.name, Type: found.type }] : [];
          } catch (_) {
            return [];
          }
        },
        run() {
          return { lastInsertRowid: 0, changes: 0 };
        }
      };
    }

    try {
      const stmt = this.db.prepare(normalized);
      return {
        get(...params: any[]) {
          const p = SqliteDriver.cleanParams(params);
          const row = stmt.get(...p);
          if (!row) return undefined;
          return { ...row };
        },
        all(...params: any[]) {
          const p = SqliteDriver.cleanParams(params);
          const rows = stmt.all(...p);
          return rows.map(r => ({ ...r }));
        },
        run(...params: any[]) {
          const p = SqliteDriver.cleanParams(params);
          const res = stmt.run(...p);
          return {
            lastInsertRowid: Number(res.lastInsertRowid),
            changes: Number(res.changes)
          };
        }
      };
    } catch (err: any) {
      console.error(`[SqliteDriver] prepare error on SQL [${normalized}]:`, err.message);
      throw err;
    }
  }

  public transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      if (!this.db) throw new Error("SQLite is not initialized");
      this.db.exec("BEGIN IMMEDIATE;");
      try {
        const result = fn(...args);
        this.db.exec("COMMIT;");
        return result;
      } catch (err) {
        try { this.db.exec("ROLLBACK;"); } catch (_) {}
        throw err;
      }
    };
  }

  public close(): void {
    if (this.db) {
      try { this.db.close(); } catch (_) {}
      this.db = null;
      this.ready = false;
    }
  }

  public initSchema(): void {
    if (!this.db) return;
    for (const table of DATABASE_TABLE_ORDER) {
      const mysqlQuery = MYSQL_CREATE_TABLE_QUERIES[table];
      if (mysqlQuery) {
        const sqliteQuery = this.convertMysqlSchemaToSqlite(mysqlQuery);
        try {
          this.db.exec(sqliteQuery);
        } catch (err: any) {
          console.warn(`[SqliteDriver] Schema init for table ${table}:`, err.message);
        }
      }
    }
  }

  public getStatus(): DatabaseStatusDetails {
    const connected = this.isReady();
    return {
      engine: "sqlite",
      connected,
      status: connected ? "CONNECTED" : "DISCONNECTED",
      error: this.lastError,
      details: {
        filePath: this.dbFilePath
      }
    };
  }

  private normalizeQuery(sql: string): string {
    if (!sql) return sql;
    let s = sql;
    // Replace MySQL ON DUPLICATE KEY UPDATE with SQLite syntax if simple
    // Remove MySQL-specific table constraints or collation if passed directly
    s = s.replace(/COLLATE\s+[a-zA-Z0-9_]+/gi, "");
    s = s.replace(/SET\s+FOREIGN_KEY_CHECKS\s*=\s*[01]/gi, "PRAGMA foreign_keys = ON");
    return s;
  }

  private convertMysqlSchemaToSqlite(mysqlSql: string): string {
    let s = mysqlSql;
    s = s.replace(/ENGINE\s*=\s*InnoDB/gi, "");
    s = s.replace(/DEFAULT\s+CHARSET\s*=\s*[a-zA-Z0-9_]+/gi, "");
    s = s.replace(/COLLATE\s*=\s*[a-zA-Z0-9_]+/gi, "");
    s = s.replace(/COLLATE\s+[a-zA-Z0-9_]+/gi, "");
    s = s.replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
    s = s.replace(/AUTO_INCREMENT/gi, "");
    s = s.replace(/LONGTEXT/gi, "TEXT");
    s = s.replace(/VARCHAR\([0-9]+\)/gi, "TEXT");
    s = s.replace(/DOUBLE/gi, "REAL");
    s = s.replace(/TIMESTAMP\s+DEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, "DATETIME DEFAULT CURRENT_TIMESTAMP");
    s = s.replace(/TIMESTAMP/gi, "DATETIME");

    // Convert MySQL UNIQUE KEY uniq_name (cols) -> UNIQUE (cols)
    s = s.replace(/UNIQUE\s+KEY\s+[a-zA-Z0-9_]+\s*(\([^)]+\))/gi, "UNIQUE $1");

    // Remove MySQL inline INDEX and KEY lines:
    s = s.replace(/^\s*(?:INDEX|KEY)\s+[a-zA-Z0-9_]+\s*\([^)]+\),?\s*$/gmi, "");
    
    // Clean up any trailing comma right before closing parenthesis:
    s = s.replace(/,(\s*\))/g, "$1");

    return s;
  }

  private static cleanParams(params: any[]): any[] {
    if (!params || !Array.isArray(params)) return [];
    return params.map(p => {
      if (p === undefined) return null;
      if (typeof p === "boolean") return p ? 1 : 0;
      return p;
    });
  }
}
