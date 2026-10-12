import type { IDatabaseDriver, PreparedStatement, DatabaseStatusDetails, DatabaseEngine } from "./databaseTypes.ts";
import { DATABASE_TABLE_ORDER } from "./mysqlSchema.ts";

/**
 * Pure in-memory SQLite/MySQL-compatible database driver for AI Studio.
 * Provides instant zero-dependency data storage and query execution when MySQL is offline.
 */
export class MemoryDriver implements IDatabaseDriver {
  public readonly name: DatabaseEngine = "mysql";
  private tables = new Map<string, Array<Record<string, any>>>();
  private autoIncrements = new Map<string, number>();
  private connected = true;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.tables.clear();
    this.autoIncrements.clear();
    for (const t of DATABASE_TABLE_ORDER) {
      this.tables.set(t, []);
      this.autoIncrements.set(t, 0);
    }
  }

  public isReady(): boolean {
    return this.connected;
  }

  public initSchema(): void {
    for (const t of DATABASE_TABLE_ORDER) {
      if (!this.tables.has(t)) {
        this.tables.set(t, []);
        this.autoIncrements.set(t, 0);
      }
    }
  }

  public close(): void {
    // In-memory driver no-op
  }

  public pragma(pragmaStr: string): any {
    if (/quick_check/i.test(pragmaStr)) {
      return [{ quick_check: "ok" }];
    }
    const tableInfoMatch = pragmaStr.match(/table_info\s*\(\s*['"]?([a-zA-Z0-9_]+)['"]?\s*\)/i);
    if (tableInfoMatch) {
      const tableName = tableInfoMatch[1].toLowerCase();
      const rows = this.tables.get(tableName) || [];
      const sample = rows[0] || {};
      return Object.keys(sample).map(key => ({
        name: key,
        type: typeof sample[key] === "number" ? "INTEGER" : "TEXT",
        notnull: 0,
        dflt_value: null,
        pk: key === "id" ? 1 : 0
      }));
    }
    return [];
  }

  public transaction<T>(fn: (...args: any[]) => T): (...args: any[]) => T {
    return (...args: any[]): T => fn(...args);
  }

  public exec(sql: string): void {
    const stmts = sql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    for (const stmt of stmts) {
      try {
        this.executeStatement(stmt, []);
      } catch (err: any) {
        // Tolerant execution for DDL / SET FOREIGN_KEY_CHECKS
      }
    }
  }

  public prepare(sql: string): PreparedStatement {
    const trimmed = sql.trim();

    return {
      get: (...params: any[]) => {
        const rows = this.executeQuery(trimmed, params);
        return rows.length > 0 ? rows[0] : undefined;
      },
      all: (...params: any[]) => {
        return this.executeQuery(trimmed, params);
      },
      run: (...params: any[]) => {
        return this.executeStatement(trimmed, params);
      }
    };
  }

  public getStatus(): DatabaseStatusDetails {
    const tableCounts: Record<string, number> = {};
    for (const t of DATABASE_TABLE_ORDER) {
      tableCounts[t] = (this.tables.get(t) || []).length;
    }

    return {
      engine: "mysql",
      connected: true,
      status: "CONNECTED",
      error: null,
      latencyMs: 1,
      tableCounts,
      details: {
        host: "in-memory",
        port: 0,
        database: "buildtrack_ams_memory",
        user: "memory_stub",
        version: "In-Memory Engine (AI Studio Fallback)"
      }
    };
  }

  // --- QUERY ENGINE ---

  private cleanIdentifier(ident: string): string {
    return ident.replace(/[`"'[\]]/g, "").trim();
  }

  private executeStatement(sql: string, params: any[]): { lastInsertRowid: number; changes: number } {
    const s = sql.trim();

    // 1. ALTER TABLE / CREATE TABLE / SET statements
    if (/^(CREATE|ALTER|SET|START|COMMIT|ROLLBACK|FLUSH)/i.test(s)) {
      const createMatch = s.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"'\w]+)/i);
      if (createMatch) {
        const table = this.cleanIdentifier(createMatch[1]).toLowerCase();
        if (!this.tables.has(table)) {
          this.tables.set(table, []);
          this.autoIncrements.set(table, 0);
        }
      }
      return { lastInsertRowid: 0, changes: 0 };
    }

    // 2. INSERT / REPLACE
    const insertMatch = s.match(/^(?:INSERT(?:\s+OR\s+(?:REPLACE|IGNORE))?|REPLACE)\s+INTO\s+([`"'\w]+)(?:\s*\(([^)]+)\))?\s*VALUES\s*\((.+)\)/is);
    if (insertMatch) {
      const table = this.cleanIdentifier(insertMatch[1]).toLowerCase();
      if (!this.tables.has(table)) {
        this.tables.set(table, []);
        this.autoIncrements.set(table, 0);
      }

      const colStr = insertMatch[2];
      const valStr = insertMatch[3];

      const cols = colStr 
        ? colStr.split(",").map(c => this.cleanIdentifier(c).toLowerCase()) 
        : [];

      const rawVals = this.parseValuesList(valStr);
      let pIdx = 0;
      const values: any[] = [];

      for (const rv of rawVals) {
        if (rv === "?") {
          values.push(params[pIdx++] ?? null);
        } else if (rv.startsWith("'") && rv.endsWith("'")) {
          values.push(rv.slice(1, -1));
        } else if (!isNaN(Number(rv))) {
          values.push(Number(rv));
        } else if (rv.toUpperCase() === "NULL") {
          values.push(null);
        } else if (rv.toUpperCase() === "CURRENT_TIMESTAMP" || rv.toUpperCase() === "NOW()") {
          values.push(new Date().toISOString());
        } else {
          values.push(rv);
        }
      }

      const tableRows = this.tables.get(table)!;
      let nextId = (this.autoIncrements.get(table) || 0) + 1;

      const newRow: Record<string, any> = {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (cols.length > 0) {
        for (let i = 0; i < cols.length; i++) {
          newRow[cols[i]] = values[i] !== undefined ? values[i] : null;
        }
      } else {
        // Positional values without column names
        for (let i = 0; i < values.length; i++) {
          newRow[`col_${i}`] = values[i];
        }
      }

      if (newRow.id !== undefined && newRow.id !== null) {
        const numId = Number(newRow.id);
        if (!isNaN(numId) && numId >= nextId) {
          nextId = numId;
        }
      } else {
        newRow.id = nextId;
      }
      this.autoIncrements.set(table, nextId);

      // Handle REPLACE / unique key collisions (e.g. users.phone_number or workspaces.name or id)
      const existingIdx = tableRows.findIndex(r => {
        if (newRow.id && r.id === newRow.id) return true;
        if (table === "users" && newRow.phone_number && r.phone_number === newRow.phone_number) return true;
        if (table === "workspaces" && newRow.name && r.name === newRow.name) return true;
        if (table === "site_settings" && newRow.workspace_id && r.workspace_id === newRow.workspace_id) return true;
        return false;
      });

      if (existingIdx >= 0) {
        if (/INSERT\s+IGNORE/i.test(s) || /INSERT\s+OR\s+IGNORE/i.test(s)) {
          return { lastInsertRowid: tableRows[existingIdx].id || 0, changes: 0 };
        }
        tableRows[existingIdx] = { ...tableRows[existingIdx], ...newRow, updated_at: new Date().toISOString() };
        return { lastInsertRowid: tableRows[existingIdx].id || newRow.id, changes: 1 };
      }

      tableRows.push(newRow);
      return { lastInsertRowid: newRow.id, changes: 1 };
    }

    // 3. UPDATE
    const updateMatch = s.match(/^UPDATE\s+([`"'\w]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/is);
    if (updateMatch) {
      const table = this.cleanIdentifier(updateMatch[1]).toLowerCase();
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3];

      const tableRows = this.tables.get(table) || [];
      const setAssignments = this.parseSetClause(setClause);

      let pIdx = 0;
      const resolvedSet: Record<string, any> = {};
      for (const sa of setAssignments) {
        if (sa.valueExpr === "?") {
          resolvedSet[sa.column] = params[pIdx++];
        } else if (sa.valueExpr.toUpperCase() === "CURRENT_TIMESTAMP" || sa.valueExpr.toUpperCase() === "NOW()") {
          resolvedSet[sa.column] = new Date().toISOString();
        } else if (sa.valueExpr.toUpperCase() === "NULL") {
          resolvedSet[sa.column] = null;
        } else if (!isNaN(Number(sa.valueExpr))) {
          resolvedSet[sa.column] = Number(sa.valueExpr);
        } else if (sa.valueExpr.startsWith("'") && sa.valueExpr.endsWith("'")) {
          resolvedSet[sa.column] = sa.valueExpr.slice(1, -1);
        } else {
          resolvedSet[sa.column] = sa.valueExpr;
        }
      }

      const whereParams = params.slice(pIdx);
      let changed = 0;

      for (let i = 0; i < tableRows.length; i++) {
        const row = tableRows[i];
        if (!whereClause || this.evaluateWhere(row, whereClause, whereParams)) {
          tableRows[i] = { ...row, ...resolvedSet, updated_at: new Date().toISOString() };
          changed++;
        }
      }

      return { lastInsertRowid: 0, changes: changed };
    }

    // 4. DELETE
    const deleteMatch = s.match(/^DELETE\s+FROM\s+([`"'\w]+)(?:\s+WHERE\s+(.+))?$/is);
    if (deleteMatch) {
      const table = this.cleanIdentifier(deleteMatch[1]).toLowerCase();
      const whereClause = deleteMatch[2];
      const tableRows = this.tables.get(table) || [];

      if (!whereClause) {
        const len = tableRows.length;
        this.tables.set(table, []);
        return { lastInsertRowid: 0, changes: len };
      }

      let removed = 0;
      const retained: Record<string, any>[] = [];
      for (const row of tableRows) {
        if (this.evaluateWhere(row, whereClause, params)) {
          removed++;
        } else {
          retained.push(row);
        }
      }
      this.tables.set(table, retained);
      return { lastInsertRowid: 0, changes: removed };
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  private executeQuery(sql: string, params: any[]): any[] {
    const s = sql.trim();

    // SHOW COLUMNS FROM table [LIKE ?]
    const showColsMatch = s.match(/^SHOW\s+COLUMNS\s+FROM\s+([`"'\w]+)(?:\s+LIKE\s+(.+))?/i);
    if (showColsMatch) {
      const table = this.cleanIdentifier(showColsMatch[1]).toLowerCase();
      const likeExpr = showColsMatch[2] ? (params[0] || showColsMatch[2].replace(/'/g, "")) : null;
      const rows = this.tables.get(table) || [];
      const sample = rows[0] || {};
      const allCols = Object.keys(sample);

      // Return default table schema column names if table has known fields
      const standardCols: Record<string, string[]> = {
        workspaces: ["id", "name", "created_by", "created_at", "status", "description"],
        users: ["id", "full_name", "phone_number", "role", "password", "photo", "hourly_rate", "monthly_base_salary", "workspace_id", "registered_device_id", "device_name", "device_registered_at", "device_status", "salary_calculation_mode", "department", "created_by", "registration_date", "status"],
        site_settings: ["id", "office_name", "latitude", "longitude", "office_wifi_ssid", "office_wifi_bssid", "wifi_ssid", "wifi_ip", "use_wifi_verification", "workspace_id", "late_grace_minutes", "allowed_minor_lates", "late_penalty_fixed_amount", "late_penalty_hourly_multiplier", "punctuality_bonus_amount", "max_shift_duration_hours", "normal_overtime_multiplier", "rest_day_overtime_multiplier", "holiday_overtime_multiplier", "night_overtime_multiplier", "allowed_radius", "work_start_time", "work_end_time", "required_daily_hours", "morning_start_time", "morning_end_time", "afternoon_start_time", "afternoon_end_time"],
        attendance: ["id", "user_id", "workspace_id", "date", "session", "check_in_time", "check_out_time", "status", "hours_worked", "overtime_hours", "late_minutes", "penalty_amount", "penalty_status", "penalty_waived_reason", "penalty_waived_by", "penalty_waived_at", "verification_method", "distance", "latitude", "longitude"],
        work_schedules: ["id", "workspace_id", "day_of_week", "day_name", "morning_status", "afternoon_status", "morning_start", "morning_end", "afternoon_start", "afternoon_end"],
        holidays: ["id", "workspace_id", "date", "name", "type", "duration", "description", "is_active"],
        attendance_scores: ["id", "user_id", "attendance_score", "punctuality_percentage", "late_count", "updated_at"],
        attendance_qr_codes: ["id", "workspace_id", "qr_id", "status", "created_at"],
        late_penalties: ["id", "attendance_id", "user_id", "workspace_id", "date", "session", "check_in_time", "check_out_time", "scheduled_start_time", "late_minutes", "is_within_grace", "penalty_amount", "penalty_status"],
        overtime_records: ["id", "attendance_id", "employee_id", "workspace_id", "date", "check_in_time", "check_out_time", "overtime_type", "work_status", "work_status_reason", "hours", "rate_multiplier", "status", "qr_verified", "gps_verified"],
        salary_payments: ["id", "user_id", "workspace_id", "month", "gross_amount", "net_amount", "final_payable_amount", "penalty_amount", "payment_status", "payment_date"],
        attendance_corrections: ["id", "attendance_id", "user_id", "employee_id", "workspace_id", "date", "session", "status", "reason"],
        attendance_requests: ["id", "user_id", "workspace_id", "date", "session", "status", "reason"],
        permissions: ["id", "user_id", "workspace_id", "permission_type", "start_date", "end_date", "reason", "status"],
        audit_logs: ["id", "workspace_id", "user_id", "actor_role", "action", "details", "target_id", "target_type", "outcome", "ip_address", "created_at"]
      };

      const baseList = Array.from(new Set([...allCols, ...(standardCols[table] || [])]));
      const filtered = likeExpr 
        ? baseList.filter(c => c.toLowerCase() === likeExpr.toLowerCase() || c.toLowerCase().includes(likeExpr.replace(/%/g, "").toLowerCase()))
        : baseList;

      return filtered.map(f => ({
        Field: f,
        Type: "varchar(255)",
        Null: "YES",
        Key: f === "id" ? "PRI" : "",
        Default: null,
        Extra: f === "id" ? "auto_increment" : ""
      }));
    }

    // SELECT query parsing
    const selectMatch = s.match(/^SELECT\s+(.+?)\s+FROM\s+([`"'\w]+)(?:\s+(?:AS\s+)?([`"'\w]+))?(.*)$/is);
    if (!selectMatch) {
      if (/SELECT\s+1/i.test(s)) {
        return [{ alive: 1, version: "MySQL 8.0 (In-Memory Mock)" }];
      }
      return [];
    }

    const selectFieldsStr = selectMatch[1].trim();
    const primaryTable = this.cleanIdentifier(selectMatch[2]).toLowerCase();
    const primaryAlias = selectMatch[3] ? this.cleanIdentifier(selectMatch[3]) : primaryTable;
    const rest = selectMatch[4] || "";

    const rows = this.tables.get(primaryTable) || [];
    let workingRows = rows.map(r => ({ ...r, __alias: primaryAlias }));

    // Parse JOINs
    const joinRegex = /(?:LEFT\s+)?JOIN\s+([`"'\w]+)(?:\s+(?:AS\s+)?([`"'\w]+))?\s+ON\s+([^WHERE|ORDER|LIMIT|GROUP]+)/gi;
    let joinMatch: RegExpExecArray | null;

    while ((joinMatch = joinRegex.exec(rest)) !== null) {
      const joinTable = this.cleanIdentifier(joinMatch[1]).toLowerCase();
      const joinAlias = joinMatch[2] ? this.cleanIdentifier(joinMatch[2]) : joinTable;
      const onCondition = joinMatch[3].trim();

      const joinRows = this.tables.get(joinTable) || [];
      const joinedResult: any[] = [];

      for (const baseRow of workingRows) {
        // e.g. u.workspace_id = w.id
        const onParts = onCondition.split("=").map(p => this.cleanIdentifier(p.trim()));
        let matched = false;

        if (onParts.length === 2) {
          const leftField = onParts[0].includes(".") ? onParts[0].split(".")[1] : onParts[0];
          const rightField = onParts[1].includes(".") ? onParts[1].split(".")[1] : onParts[1];

          for (const jRow of joinRows) {
            const leftVal = baseRow[leftField];
            const rightVal = jRow[rightField];
            if (leftVal !== undefined && rightVal !== undefined && String(leftVal) === String(rightVal)) {
              matched = true;
              const combined: Record<string, any> = { ...baseRow };
              for (const [k, v] of Object.entries(jRow)) {
                combined[`${joinAlias}_${k}`] = v;
                if (k === "name" && joinTable === "workspaces") {
                  combined["workspace_name"] = v;
                }
                if (combined[k] === undefined) {
                  combined[k] = v;
                }
              }
              joinedResult.push(combined);
            }
          }
        }

        if (!matched) {
          joinedResult.push({ ...baseRow, workspace_name: "Main Office" });
        }
      }

      workingRows = joinedResult;
    }

    // Parse WHERE clause
    const whereMatch = rest.match(/\bWHERE\b\s+(.+?)(?:\s+\b(?:ORDER|GROUP|LIMIT)\b|$)/is);
    let filteredRows = workingRows;

    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      filteredRows = workingRows.filter(row => this.evaluateWhere(row, whereClause, params));
    }

    // COUNT(*) or aggregations
    if (/COUNT\s*\(\s*\*\s*\)/i.test(selectFieldsStr)) {
      const countMatch = selectFieldsStr.match(/COUNT\s*\(\s*\*\s*\)(?:\s+(?:AS\s+)?([`"'\w]+))?/i);
      const alias = countMatch && countMatch[1] ? this.cleanIdentifier(countMatch[1]) : "count";
      return [{ [alias]: filteredRows.length, count: filteredRows.length, c: filteredRows.length }];
    }

    if (/SUM\s*\(/i.test(selectFieldsStr)) {
      const sumMatch = selectFieldsStr.match(/SUM\s*\(\s*([`"'\w.]+)\s*\)(?:\s+(?:AS\s+)?([`"'\w]+))?/i);
      if (sumMatch) {
        const col = this.cleanIdentifier(sumMatch[1]).split(".").pop()!;
        const alias = sumMatch[2] ? this.cleanIdentifier(sumMatch[2]) : "sum";
        const sumVal = filteredRows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);
        return [{ [alias]: sumVal }];
      }
    }

    // ORDER BY
    const orderMatch = rest.match(/\bORDER\s+BY\s+([`"'\w.,\s]+?)(?:\s+\b(?:LIMIT|DESC|ASC)\b|$)/i);
    if (orderMatch) {
      const orderCol = this.cleanIdentifier(orderMatch[1].split(",")[0].trim()).split(".").pop()!;
      const isDesc = /\bDESC\b/i.test(rest);
      filteredRows.sort((a, b) => {
        const va = a[orderCol];
        const vb = b[orderCol];
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        return isDesc ? (va > vb ? -1 : 1) : (va < vb ? -1 : 1);
      });
    }

    // LIMIT
    const limitMatch = rest.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1], 10);
      filteredRows = filteredRows.slice(0, limitVal);
    }

    // Return filtered projection
    return filteredRows.map(r => {
      const copy = { ...r };
      delete copy.__alias;
      return copy;
    });
  }

  private evaluateWhere(row: Record<string, any>, whereClause: string, params: any[]): boolean {
    if (!whereClause || whereClause.trim() === "1=1" || whereClause.trim() === "1") {
      return true;
    }

    let pIdx = 0;
    // Normalize condition and replace ? with parameter values
    let cond = whereClause;

    // Handle complex workspace filters: If condition is workspace isolation fallback, allow view for matching workspace
    if (cond.includes("workspaces ws WHERE ws.id = ?")) {
      const targetWsId = params[0] || 1;
      return Number(row.workspace_id) === Number(targetWsId) || !row.workspace_id || row.role === "SuperAdmin";
    }

    // Check common equality patterns: col = ? or col = 'val'
    const tokens = cond.split(/\bAND\b|\bOR\b/i);
    const isOr = /\bOR\b/i.test(cond) && !/\bAND\b/i.test(cond);

    for (const token of tokens) {
      const t = token.trim();

      // col IS NULL or col IS NOT NULL
      if (/IS\s+NULL/i.test(t)) {
        const col = this.cleanIdentifier(t.replace(/IS\s+NULL/i, "").trim()).split(".").pop()!;
        const pass = row[col] === null || row[col] === undefined;
        if (isOr && pass) return true;
        if (!isOr && !pass) return false;
        continue;
      }

      if (/IS\s+NOT\s+NULL/i.test(t)) {
        const col = this.cleanIdentifier(t.replace(/IS\s+NOT\s+NULL/i, "").trim()).split(".").pop()!;
        const pass = row[col] !== null && row[col] !== undefined;
        if (isOr && pass) return true;
        if (!isOr && !pass) return false;
        continue;
      }

      // col IN ('a', 'b')
      const inMatch = t.match(/([`"'\w.]+)\s+IN\s*\(([^)]+)\)/i);
      if (inMatch) {
        const col = this.cleanIdentifier(inMatch[1]).split(".").pop()!;
        const allowed = inMatch[2].split(",").map(v => v.trim().replace(/^['"]|['"]$/g, ""));
        const rowVal = String(row[col] ?? "");
        const pass = allowed.includes(rowVal);
        if (isOr && pass) return true;
        if (!isOr && !pass) return false;
        continue;
      }

      // col = ? or col != ? or col > ? or col >= ?
      const cmpMatch = t.match(/([`"'\w.]+)\s*(=|!=|<>|>|<|>=|<=)\s*(.+)/);
      if (cmpMatch) {
        const col = this.cleanIdentifier(cmpMatch[1]).split(".").pop()!;
        const op = cmpMatch[2];
        let targetExpr = cmpMatch[3].trim();
        let targetVal: any = targetExpr;

        if (targetExpr === "?") {
          targetVal = params[pIdx++];
        } else if (targetExpr.startsWith("'") && targetExpr.endsWith("'")) {
          targetVal = targetExpr.slice(1, -1);
        } else if (!isNaN(Number(targetExpr))) {
          targetVal = Number(targetExpr);
        } else if (targetExpr.toUpperCase() === "NULL") {
          targetVal = null;
        }

        const rowVal = row[col];
        let pass = false;

        if (op === "=") {
          pass = String(rowVal ?? "") === String(targetVal ?? "");
        } else if (op === "!=" || op === "<>") {
          pass = String(rowVal ?? "") !== String(targetVal ?? "");
        } else if (op === ">") {
          pass = Number(rowVal) > Number(targetVal);
        } else if (op === ">=") {
          pass = Number(rowVal) >= Number(targetVal);
        } else if (op === "<") {
          pass = Number(rowVal) < Number(targetVal);
        } else if (op === "<=") {
          pass = Number(rowVal) <= Number(targetVal);
        }

        if (isOr && pass) return true;
        if (!isOr && !pass) return false;
      }
    }

    return !isOr;
  }

  private parseValuesList(valStr: string): string[] {
    const results: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < valStr.length; i++) {
      const c = valStr[i];
      if ((c === "'" || c === '"') && valStr[i - 1] !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = c;
        } else if (c === quoteChar) {
          inQuotes = false;
        }
        current += c;
      } else if (c === "," && !inQuotes) {
        results.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    if (current.trim()) {
      results.push(current.trim());
    }
    return results;
  }

  private parseSetClause(setClause: string): Array<{ column: string; valueExpr: string }> {
    const assignments: Array<{ column: string; valueExpr: string }> = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < setClause.length; i++) {
      const c = setClause[i];
      if ((c === "'" || c === '"') && setClause[i - 1] !== "\\") {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = c;
        } else if (c === quoteChar) {
          inQuotes = false;
        }
        current += c;
      } else if (c === "," && !inQuotes) {
        const parts = current.split("=");
        if (parts.length >= 2) {
          assignments.push({
            column: this.cleanIdentifier(parts[0]).toLowerCase(),
            valueExpr: parts.slice(1).join("=").trim()
          });
        }
        current = "";
      } else {
        current += c;
      }
    }

    if (current.trim()) {
      const parts = current.split("=");
      if (parts.length >= 2) {
        assignments.push({
          column: this.cleanIdentifier(parts[0]).toLowerCase(),
          valueExpr: parts.slice(1).join("=").trim()
        });
      }
    }

    return assignments;
  }
}
