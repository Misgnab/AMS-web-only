import { Request, Response, NextFunction } from "express";
import { logAuditEvent } from "./auditService.ts";

export type Permission =
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

export interface AuthenticatedUser {
  id: number;
  phone_number: string;
  role: string;
  full_name: string;
  workspace_id?: number | null;
  status?: string;
  hourly_rate?: number;
  monthly_base_salary?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Role-Based Permission Matrix
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
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
    "payroll.view",
    "penalties.view",
    "penalties.manage",
    "schedules.view",
    "settings.view",
    "reports.view",
    "reports.export",
    "audit.view"
  ],
  Admin: [
    "employees.view",
    "employees.manage",
    "attendance.view",
    "attendance.manage",
    "attendance.correct",
    "requests.view",
    "requests.approve",
    "payroll.view",
    "payroll.manage",
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
  HR: [
    "employees.view",
    "attendance.view",
    "attendance.correct",
    "requests.view",
    "requests.approve",
    "penalties.view",
    "schedules.view",
    "reports.view",
    "audit.view"
  ],
  Accountant: [
    "payroll.view",
    "payroll.manage",
    "payroll.approve",
    "penalties.view",
    "reports.view",
    "reports.export"
  ],
  Bootstrap: [
    "workspaces.manage",
    "admins.manage"
  ],
  Employee: [],
  Purchaser: [],
  Engineer: []
};

/**
 * Checks whether a role possesses a specific permission.
 * SuperAdmin possesses all permissions.
 */
export function hasPermission(role?: string, permission?: Permission): boolean {
  if (!role || !permission) return false;
  if (role === "SuperAdmin") return true;
  const list = ROLE_PERMISSIONS[role];
  return Array.isArray(list) && list.includes(permission);
}

export function isSuperAdmin(user?: AuthenticatedUser | null): boolean {
  return user?.role === "SuperAdmin";
}

export function isWorkspaceAdmin(user?: AuthenticatedUser | null): boolean {
  return ["AdminCreator", "AdminManager", "Admin", "SuperAdmin"].includes(user?.role || "");
}

export function isStaffManager(user?: AuthenticatedUser | null): boolean {
  return ["AdminCreator", "AdminManager", "Admin", "SuperAdmin", "HR", "Accountant"].includes(user?.role || "");
}

/**
 * Derives the trusted authorized workspace ID for a request.
 * - SuperAdmin can view any workspace; if a workspace query/body parameter is passed, use it.
 * - Non-SuperAdmin is STRICTLY constrained to their database-assigned workspace.
 *   Client-supplied workspace IDs are NEVER trusted as proof of authorization.
 */
export function getAuthorizedWorkspaceId(req: AuthenticatedRequest, requestedWsId?: any): number {
  if (isSuperAdmin(req.user)) {
    if (requestedWsId !== undefined && requestedWsId !== null && requestedWsId !== "" && requestedWsId !== "all") {
      const parsed = parseInt(String(requestedWsId), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return req.user?.workspace_id || 1;
  }
  return req.user?.workspace_id || 1;
}

/**
 * Validates that an operation targets the authenticated user's authorized workspace.
 * Returns true if authorized, false otherwise.
 */
export function validateWorkspaceAccess(req: AuthenticatedRequest, resourceWorkspaceId?: number | null): boolean {
  if (isSuperAdmin(req.user)) return true;
  if (!req.user?.workspace_id) return false;
  if (resourceWorkspaceId === undefined || resourceWorkspaceId === null) return true;
  return Number(resourceWorkspaceId) === Number(req.user.workspace_id);
}

/**
 * Middleware: Requires a specific permission on the backend.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ error: "Authentication required.", code: "AUTH_REQUIRED" });
    }
    if (!hasPermission(role, permission)) {
      logAuditEvent({
        workspaceId: req.user?.workspace_id,
        userId: req.user?.id,
        actorRole: role,
        action: "UNAUTHORIZED_PERMISSION_ATTEMPT",
        details: `Access denied: role '${role}' attempted action requiring '${permission}' on path ${req.originalUrl}`,
        outcome: "DENIED",
        ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1"
      });
      return res.status(403).json({
        error: `Access denied. Permission '${permission}' is required.`,
        code: "PERMISSION_DENIED",
        requiredPermission: permission
      });
    }
    next();
  };
}

/**
 * Middleware: Requires SuperAdmin role.
 */
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!isSuperAdmin(req.user)) {
    logAuditEvent({
      workspaceId: req.user?.workspace_id,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "SUPERADMIN_ACCESS_DENIED",
      details: `Non-SuperAdmin (${req.user?.full_name}, role: ${req.user?.role}) attempted accessing SuperAdmin endpoint ${req.originalUrl}`,
      outcome: "DENIED",
      ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1"
    });
    return res.status(403).json({
      error: "Access denied. Only Super Administrators can perform this action.",
      code: "SUPERADMIN_REQUIRED"
    });
  }
  next();
}

/**
 * Helper: Enforces that a resource belongs to the user's workspace.
 * If cross-workspace IDOR is detected, responds with 403 and writes an audit event.
 * Returns true if authorized, false if response was sent.
 */
export function enforceWorkspaceScope(
  req: AuthenticatedRequest,
  res: Response,
  resourceWorkspaceId: number | null | undefined,
  entityName: string = "record"
): boolean {
  if (isSuperAdmin(req.user)) return true;
  
  const userWsId = req.user?.workspace_id || 1;
  const targetWsId = resourceWorkspaceId !== undefined && resourceWorkspaceId !== null ? Number(resourceWorkspaceId) : userWsId;

  if (targetWsId !== userWsId) {
    logAuditEvent({
      workspaceId: userWsId,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "CROSS_WORKSPACE_IDOR_BLOCKED",
      details: `Cross-workspace IDOR attempt blocked: User ${req.user?.full_name} (#${req.user?.id}, Workspace ${userWsId}) attempted to access ${entityName} belonging to Workspace ${targetWsId} at ${req.originalUrl}`,
      targetId: targetWsId,
      targetType: entityName,
      outcome: "DENIED",
      ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "127.0.0.1"
    });

    res.status(403).json({
      error: `Access denied. Cross-workspace access to ${entityName} is strictly forbidden.`,
      code: "WORKSPACE_ISOLATION_VIOLATION"
    });
    return false;
  }
  return true;
}
