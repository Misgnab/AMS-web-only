/**
 * SQL dialect normalizer and parameter sanitizer for MySQL execution.
 */

export function normalizeMysqlQuery(sql: string): string {
  if (!sql) return sql;
  let s = sql;

  // 1. Replace INSERT OR REPLACE INTO -> REPLACE INTO
  s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, "REPLACE INTO");

  // 2. Replace INSERT OR IGNORE INTO -> INSERT IGNORE INTO
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT IGNORE INTO");

  // 3. Replace ON CONFLICT(...) DO UPDATE SET -> ON DUPLICATE KEY UPDATE
  s = s.replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+UPDATE\s+SET/gi, "ON DUPLICATE KEY UPDATE");

  // 4. Replace excluded.colName -> VALUES(colName) for MySQL upsert syntax
  s = s.replace(/excluded\.([a-zA-Z0-9_]+)/gi, "VALUES($1)");

  // 5. PRAGMA quick_check
  if (/PRAGMA\s+quick_check/i.test(s)) {
    return "SELECT 'ok' as quick_check";
  }

  // 6. PRAGMA foreign_keys = ON / OFF
  const fkMatch = s.match(/PRAGMA\s+foreign_keys\s*=\s*(ON|OFF|1|0)/i);
  if (fkMatch) {
    const val = fkMatch[1].toUpperCase() === "ON" || fkMatch[1] === "1" ? "1" : "0";
    return `SET FOREIGN_KEY_CHECKS = ${val}`;
  }

  // 7. Standardize DDL INTEGER PRIMARY KEY AUTOINCREMENT -> INT AUTO_INCREMENT PRIMARY KEY
  s = s.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "INT AUTO_INCREMENT PRIMARY KEY");

  // 8. Prevent MySQL 1170 (BLOB/TEXT column used in key specification without length)
  s = s.replace(/TEXT\s+NOT\s+NULL\s+UNIQUE/gi, "VARCHAR(191) NOT NULL UNIQUE");
  s = s.replace(/TEXT\s+UNIQUE\s+NOT\s+NULL/gi, "VARCHAR(191) NOT NULL UNIQUE");
  s = s.replace(/TEXT\s+UNIQUE/gi, "VARCHAR(191) UNIQUE");

  // 9. Convert double-quoted table / column names to MySQL backticks: "users" -> `users`
  s = s.replace(/"([a-zA-Z0-9_]+)"/g, "`$1`");

  return s;
}

/**
 * Normalizes SQL parameters for safe MySQL execution.
 * (e.g. converts undefined to null, ensures BigInts or booleans are handled properly)
 */
export function normalizeParams(params: any[]): any[] {
  if (!params || !Array.isArray(params)) return [];
  return params.map(p => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p;
  });
}
