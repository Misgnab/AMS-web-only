import { db } from "./database.ts";

export interface AuditLogEntry {
  workspaceId?: number | null;
  userId?: number | null;
  actorRole?: string | null;
  action: string;
  details: string;
  targetId?: number | null;
  targetType?: string | null;
  outcome?: "SUCCESS" | "FAILED" | "DENIED";
  ipAddress?: string | null;
}

/**
 * Persists security-critical and operational audit events into audit_logs table
 */
export function logAuditEvent(entry: AuditLogEntry): void {
  try {
    const wsId = entry.workspaceId !== undefined && entry.workspaceId !== null ? Number(entry.workspaceId) : 1;
    const actorId = entry.userId !== undefined && entry.userId !== null ? Number(entry.userId) : null;
    const role = entry.actorRole || null;
    const targetId = entry.targetId !== undefined && entry.targetId !== null ? Number(entry.targetId) : null;
    const targetType = entry.targetType || null;
    const outcome = entry.outcome || "SUCCESS";
    const ip = entry.ipAddress || null;

    db.prepare(`
      INSERT INTO audit_logs (
        workspace_id, user_id, actor_role, action, details,
        target_id, target_type, outcome, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      wsId,
      actorId,
      role,
      entry.action,
      entry.details,
      targetId,
      targetType,
      outcome,
      ip
    );
  } catch (err: any) {
    // Audit logging failure should not crash the server but should be logged to console
    console.error("[AuditService] Failed to write audit log:", err?.message || err);
  }
}
