export type DatabaseEngine = "mysql" | "sqlite";

export interface PreparedStatement {
  get(...params: any[]): any;
  all(...params: any[]): any[];
  run(...params: any[]): { lastInsertRowid: number | bigint; changes: number };
}

export interface IDatabaseDriver {
  name: DatabaseEngine;
  prepare(sql: string): PreparedStatement;
  exec(sql: string): void;
  pragma(pragmaStr: string): any;
  transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T;
  close?(): void;
  isReady(): boolean;
  initSchema?(): void;
  getStatus(): Promise<DatabaseStatusDetails | DualDatabaseStatus> | DatabaseStatusDetails | DualDatabaseStatus;
}

export interface MysqlConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
  connectionLimit?: number;
}

export interface DatabaseConfiguration {
  activeEngine: DatabaseEngine;
  mysql: MysqlConfig;
  sqlitePath?: string;
}

export interface TableCount {
  table: string;
  count: number;
}

export interface DatabaseStatusDetails {
  engine: DatabaseEngine;
  connected: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  error?: string | null;
  latencyMs?: number;
  details?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    version?: string;
    filePath?: string;
  };
  tableCounts?: Record<string, number>;
}

export interface DualDatabaseStatus {
  activeEngine: DatabaseEngine;
  effectiveEngine: DatabaseEngine;
  isFallback: boolean;
  mysql: DatabaseStatusDetails;
  sqlite?: DatabaseStatusDetails;
  tables: string[];
}

export interface SyncResult {
  success: boolean;
  direction: string;
  timestamp: string;
  durationMs: number;
  syncedTables: Record<string, { read: number; written: number }>;
  errors?: string[];
}
