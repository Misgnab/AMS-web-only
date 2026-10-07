import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import type { 
  IDatabaseDriver, 
  PreparedStatement, 
  DatabaseStatusDetails,
  DatabaseEngine
} from "./databaseTypes.ts";
import { DATABASE_TABLE_ORDER, MYSQL_CREATE_TABLE_QUERIES } from "./mysqlSchema.ts";

function mysqlDdlToSqlite(sql: string): string {
  let s = sql;
  // Remove ENGINE clause
  s = s.replace(/\)\s*ENGINE=InnoDB[^;]*;/gi, ");");
  // Replace INT AUTO_INCREMENT PRIMARY KEY
  s = s.replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT");
  // Replace DOUBLE
  s = s.replace(/\bDOUBLE\b/gi, "REAL");
  // Replace VARCHAR(...) / LONGTEXT
  s = s.replace(/\bVARCHAR\(\d+\)/gi, "TEXT");
  s = s.replace(/\bLONGTEXT\b/gi, "TEXT");
  // Replace ON UPDATE CURRENT_TIMESTAMP
  s = s.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, "");
  // Remove INDEX lines: INDEX name (cols),
  s = s.replace(/^\s*INDEX\s+[a-zA-Z0-9_]+\s*\([^)]+\),?\s*$/gmi, "");
  // Remove UNIQUE KEY name (cols) -> UNIQUE(cols)
  s = s.replace(/^\s*UNIQUE\s+KEY\s+[a-zA-Z0-9_]+\s*\(([^)]+)\),?\s*$/gmi, "UNIQUE($1),");
  // Fix trailing commas before closing paren
  s = s.replace(/,(\s*\))/g, "$1");
  return s;
}

export class SqliteDriver implements IDatabaseDriver {
  public readonly name: DatabaseEngine = "sqlite";
  private db: DatabaseSync;
  private dbPath: string;
  private isConnected = false;

  constructor(dbFilePath?: string) {
    this.dbPath = dbFilePath || path.join(process.cwd(), "buildtrack_ams.db");
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (_) {}
    }

    this.db = new DatabaseSync(this.dbPath);
    this.isConnected = true;

    try {
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");
    } catch (_) {}

    this.initSchema();
  }

  private normalizeSql(sql: string): string {
    if (!sql) return sql;
    let s = sql;

    // Translate SHOW COLUMNS FROM `table` LIKE ? -> SELECT name as Field FROM pragma_table_info('table') WHERE name = ?
    const showColsMatch = s.match(/SHOW\s+COLUMNS\s+FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+LIKE\s+\?/i);
    if (showColsMatch) {
      const tableName = showColsMatch[1];
      return `SELECT name as Field FROM pragma_table_info('${tableName}') WHERE name = ?`;
    }

    const showColsMatchDirect = s.match(/SHOW\s+COLUMNS\s+FROM\s+[`"]?([a-zA-Z0-9_]+)[`"]?\s+LIKE\s+['"]([^'"]+)['"]/i);
    if (showColsMatchDirect) {
      const tableName = showColsMatchDirect[1];
      const colName = showColsMatchDirect[2];
      return `SELECT name as Field FROM pragma_table_info('${tableName}') WHERE name = '${colName}'`;
    }

    return s;
  }

  private sanitizeParams(params: any[]): any[] {
    if (!params || !Array.isArray(params)) return [];
    return params.map(p => (p === undefined ? null : p));
  }

  public prepare(sql: string): PreparedStatement {
    const normalized = this.normalizeSql(sql);
    const stmt = this.db.prepare(normalized);

    return {
      run: (...params: any[]) => {
        const cleanParams = this.sanitizeParams(params);
        const res = stmt.run(...cleanParams);
        return {
          lastInsertRowid: res.lastInsertRowid,
          changes: Number(res.changes)
        };
      },
      get: (...params: any[]) => {
        const cleanParams = this.sanitizeParams(params);
        return stmt.get(...cleanParams);
      },
      all: (...params: any[]) => {
        const cleanParams = this.sanitizeParams(params);
        return stmt.all(...cleanParams);
      }
    };
  }

  public exec(sql: string): void {
    const normalized = this.normalizeSql(sql);
    this.db.exec(normalized);
  }

  public pragma(pragmaStr: string): any {
    try {
      return this.db.prepare(`PRAGMA ${pragmaStr}`).all();
    } catch (_) {
      try {
        this.db.exec(`PRAGMA ${pragmaStr}`);
        return null;
      } catch (err: any) {
        console.warn("[SqliteDriver] pragma error:", err.message);
        return null;
      }
    }
  }

  public transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]) => {
      this.db.exec("BEGIN");
      try {
        const result = fn(...args);
        this.db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          this.db.exec("ROLLBACK");
        } catch (_) {}
        throw err;
      }
    };
  }

  public isReady(): boolean {
    return this.isConnected;
  }

  public initSchema(): void {
    for (const tableName of DATABASE_TABLE_ORDER) {
      const mysqlDdl = MYSQL_CREATE_TABLE_QUERIES[tableName];
      if (mysqlDdl) {
        const sqliteDdl = mysqlDdlToSqlite(mysqlDdl);
        try {
          this.db.exec(sqliteDdl);
        } catch (err: any) {
          console.warn(`[SqliteDriver] initSchema warning on table ${tableName}:`, err.message);
        }
      }
    }
  }

  public getStatus(): DatabaseStatusDetails {
    const tableCounts: Record<string, number> = {};
    for (const t of DATABASE_TABLE_ORDER) {
      try {
        const row = this.db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as any;
        tableCounts[t] = row?.c || 0;
      } catch (_) {
        tableCounts[t] = 0;
      }
    }

    return {
      engine: "sqlite",
      connected: this.isConnected,
      status: this.isConnected ? "CONNECTED" : "DISCONNECTED",
      latencyMs: 0,
      details: {
        database: "buildtrack_ams.db",
        filePath: this.dbPath,
        version: "SQLite 3"
      },
      tableCounts
    };
  }

  public close(): void {
    try {
      this.db.close();
      this.isConnected = false;
    } catch (_) {}
  }
}
