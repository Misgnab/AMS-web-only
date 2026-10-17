import { Request, Response, NextFunction } from "express";
import { db } from "./database.js";

export type AppPermission =
  | "employees.view"
  | "employees.manage"
  | "attendance.view"
  | "attendance.manage"
  | "attendance.correct"
  | "requests.view"
  | "requests.approve"
  | "payroll.view"
  | "payroll.manage"
  | "payroll.approve"
  | "penalties.view"
  | "penalties.manage"
  | "schedules.view"
  | "schedules.manage"
  | "settings.view"
  | "settings.manage"
  | "reports.view"
  | "reports.export"
  | "audit.view"
  | "workspaces.manage"
  | "admins.manage"
  | "system.settings.manage"
  | "system.audit.view";

export const ALL_PERMISSIONS: AppPermission[] = [
  "employees.view",
  "employees.manage",
  "attendance.view",
  "attendance.manage",
  "attendance.correct",
  "requests.view",
  "requests.approve",
  "payroll.view",
  "payroll.manage",
  "payroll.approve",
  "penalties.view",
  "penalties.manage",
  "schedules.view",
  "schedules.manage",
  "settings.view",
  "settings.manage",
  "reports.view",
  "reports.export",
  "audit.view",
  "workspaces.manage",
  "admins.manage",
  "system.settings.manage",
  "system.audit.view"
];

export const ROLE_DEFAULT_PERMISSIONS: Record<string, AppPermission[]> = {
  SuperAdmin: [
    "employees.view",
    "employees.manage",
    "attendance.view",
    "attendance.manage",
    "attendance.correct",
    "requests.view",
    "requests.approve",
    "payroll.view",
    "payroll.manage",
    "payroll.approve",
    "penalties.view",
    "penalties.manage",
    "schedules.view",
    "schedules.manage",
    "settings.view",
    "settings.manage",
    "reports.view",
    "reports.export",
    "audit.view",
    "workspaces.manage",
    "admins.manage",
    "system.settings.manage",
    "system.audit.view"
  ],
  AdminCreator: [
    "employees.view",
    "employees.manage",
    "attendance.view",
    "attendance.manage",
    "attendance.correct",
    "requests.view",
    "requests.approve",
    "payroll.view",
    "payroll.manage",
    "payroll.approve",
    "penalties.view",
    "penalties.manage",
    "schedules.view",
    "schedules.manage",
    "settings.view",
    "settings.manage",
    "reports.view",
    "reports.export",
    "audit.view"
  ],
  AdminManager: [
    "employees.view",
    "employees.manage",
    "attendance.view",
    "attendance.manage",
    "attendance.correct",
    "requests.view",
    "requests.approve",
    "penalties.view",
    "penalties.manage",
    "schedules.view",
    "reports.view",
    "reports.export",
    "audit.view"
  ],
  HR: [
    "employees.view",
    "attendance.view",
    "attendance.manage",
    "requests.view",
    "requests.approve",
    "penalties.view",
    "reports.view"
  ],
  Accountant: [
    "employees.view",
    "payroll.view",
    "payroll.manage",
    "reports.view",
    "reports.export"
  ],
  Bootstrap: [
    "admins.manage",
    "system.settings.manage"
  ],
  Employee: [
    "attendance.view",
    "requests.view",
    "payroll.view"
  ],
  Purchaser: [
    "attendance.view",
    "requests.view",
    "payroll.view"
  ],
  Engineer: [
    "attendance.view",
    "requests.view",
    "payroll.view"
  ]
};

export interface UserAuthContext {
  id: number;
  role: string;
  phone_number?: string;
  full_name?: string;
  workspace_id?: number | null;
  status?: string;
  is_active?: number;
  custom_permissions?: string | null;
}

/**
 * Checks whether a user possesses a specific permission.
 */
export function hasPermission(user: UserAuthContext | undefined, permission: AppPermission): boolean {
  if (!user) return false;
  
  // Suspended or inactive users have zero permissions
  if (user.status === "SUSPENDED" || user.is_active === 0) return false;

  // SuperAdmin has all permissions globally
  if (user.role === "SuperAdmin") return true;

  // Check custom permission overrides if set
  if (user.custom_permissions) {
    try {
      const customList: string[] = JSON.parse(user.custom_permissions);
      if (Array.isArray(customList) && customList.includes(permission)) {
        return true;
      }
    } catch (_) {
      // Ignore JSON parse errors and fallback to role defaults
    }
  }

  const rolePerms = ROLE_DEFAULT_PERMISSIONS[user.role] || [];
  return rolePerms.includes(permission);
}

/**
 * Extracts client IP address safely
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

export interface AuditLogEntry {
  workspaceId?: number | null;
  userId?: number | null;
  actorRole?: string | null;
  action: string;
  details?: string | null;
  targetType?: string | null;
  targetId?: number | null;
  outcome?: "SUCCESS" | "FAILURE" | "DENIED" | "SUSPICIOUS";
  ipAddress?: string | null;
  beforeValue?: any;
  afterValue?: any;
}

/**
 * Centralized audit logging utility. Never fails, safely records system and user operations.
 */
export function recordAuditLog(entry: AuditLogEntry): void {
  try {
    const sanitize = (val: any): string | null => {
      if (val === undefined || val === null) return null;
      if (typeof val === "string") return val;
      try {
        const copy = JSON.parse(JSON.stringify(val));
        // Redact any password or token fields
        if (typeof copy === "object" && copy !== null) {
          if (copy.password) copy.password = "[REDACTED]";
          if (copy.token) copy.token = "[REDACTED]";
          if (copy.current_password) copy.current_password = "[REDACTED]";
          if (copy.new_password) copy.new_password = "[REDACTED]";
        }
        return JSON.stringify(copy);
      } catch (_) {
        return String(val);
      }
    };

    const beforeStr = sanitize(entry.beforeValue);
    const afterStr = sanitize(entry.afterValue);
    const outcome = entry.outcome || "SUCCESS";

    db.prepare(`
      INSERT INTO audit_logs (
        workspace_id, user_id, actor_id, actor_role,
        action, details, ip_address,
        target_type, target_id, outcome,
        before_value, after_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.workspaceId ?? null,
      entry.userId ?? null,
      entry.userId ?? null,
      entry.actorRole ?? null,
      entry.action,
      entry.details ?? null,
      entry.ipAddress ?? null,
      entry.targetType ?? null,
      entry.targetId ?? null,
      outcome,
      beforeStr,
      afterStr
    );
  } catch (err: any) {
    console.error("[AuditLog] Failed to record audit log:", err?.message || err);
  }
}
