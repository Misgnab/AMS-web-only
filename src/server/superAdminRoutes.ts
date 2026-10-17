import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./database.js";
import { recordAuditLog, getClientIp } from "./rbac.js";
import { getEthiopianDateString } from "../utils/ethiopianTime.js";

export const superAdminRouter = Router();

// Middleware: Strictly require SuperAdmin role for every endpoint in this router
function requireSuperAdmin(req: Request & { user?: any }, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  if (req.user.role !== "SuperAdmin") {
    recordAuditLog({
      workspaceId: req.user.workspace_id || null,
      userId: req.user.id,
      actorRole: req.user.role,
      action: "UNAUTHORIZED_SUPER_ADMIN_ACCESS",
      details: `Forbidden attempt by ${req.user.full_name} (${req.user.role}) on Super Admin route ${req.method} ${req.originalUrl}`,
      ipAddress: getClientIp(req),
      outcome: "DENIED"
    });
    return res.status(403).json({
      error: "Access denied. Only Super Administrator has global system access.",
      code: "SUPER_ADMIN_REQUIRED"
    });
  }

  next();
}

superAdminRouter.use(requireSuperAdmin);

// =========================================================================
// 1. OVERVIEW & KPIS ACROSS ALL WORKSPACES
// =========================================================================
superAdminRouter.get("/overview", (req: Request & { user?: any }, res: Response) => {
  try {
    const totalWorkspaces = (db.prepare("SELECT COUNT(*) as count FROM workspaces").get() as any)?.count || 0;
    const activeWorkspaces = (db.prepare("SELECT COUNT(*) as count FROM workspaces WHERE status = 'ACTIVE' OR status IS NULL").get() as any)?.count || 0;
    const inactiveWorkspaces = Math.max(0, totalWorkspaces - activeWorkspaces);

    const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "HR", "Accountant", "Bootstrap"];
    const placeholders = adminRoles.map(() => "?").join(",");
    const totalAdmins = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE role IN (${placeholders})`).get(...adminRoles) as any)?.count || 0;
    const activeAdmins = (db.prepare(`SELECT COUNT(*) as count FROM users WHERE role IN (${placeholders}) AND (status = 'ACTIVE' OR status IS NULL) AND (is_active = 1 OR is_active IS NULL)`).get(...adminRoles) as any)?.count || 0;
    const suspendedAdmins = Math.max(0, totalAdmins - activeAdmins);

    const totalEmployees = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role NOT IN ('SuperAdmin', 'Bootstrap')").get() as any)?.count || 0;

    // Today attendance records count
    let todayAttendanceAcrossWorkspaces = 0;
    try {
      const todayStr = getEthiopianDateString(new Date());
      todayAttendanceAcrossWorkspaces = (db.prepare("SELECT COUNT(*) as count FROM attendance WHERE date = ?").get(todayStr) as any)?.count || 0;
    } catch (_) {
      todayAttendanceAcrossWorkspaces = (db.prepare("SELECT COUNT(*) as count FROM attendance").get() as any)?.count || 0;
    }

    // Security events in recent history
    const securityEventsCount = (db.prepare(`
      SELECT COUNT(*) as count FROM audit_logs 
      WHERE action IN (
        'LOGIN_FAILED', 'SUSPENDED_LOGIN_ATTEMPT', 'LOGIN_RATE_LIMITED',
        'UNAUTHORIZED_PERMISSION_ATTEMPT', 'UNAUTHORIZED_SUPER_ADMIN_ACCESS',
        'ADMIN_CREATED', 'ADMIN_STATUS_CHANGED', 'ADMIN_UPDATED',
        'DEVICE_BINDING_RESET'
      ) OR outcome IN ('DENIED', 'FAILURE', 'SUSPICIOUS')
    `).get() as any)?.count || 0;

    res.json({
      totalWorkspaces,
      activeWorkspaces,
      inactiveWorkspaces,
      totalAdmins,
      activeAdmins,
      suspendedAdmins,
      totalEmployees,
      todayAttendanceAcrossWorkspaces,
      securityEventsCount
    });
  } catch (error: any) {
    console.error("Super Admin overview error:", error);
    res.status(500).json({ error: "Failed to generate system overview", details: error.message });
  }
});

// =========================================================================
// 2. WORKSPACES MANAGEMENT
// =========================================================================
superAdminRouter.get("/workspaces", (req: Request & { user?: any }, res: Response) => {
  try {
    const todayStr = getEthiopianDateString(new Date());
    const workspaces = db.prepare(`
      SELECT 
        w.id,
        w.name,
        w.code,
        COALESCE(w.status, 'ACTIVE') as status,
        w.description,
        w.created_by,
        w.created_at,
        creator.full_name as created_by_name,
        (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id AND u.role IN ('SuperAdmin', 'AdminCreator', 'AdminManager', 'HR', 'Accountant')) as admin_count,
        (SELECT COUNT(*) FROM users u WHERE u.workspace_id = w.id AND u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer')) as employee_count,
        (SELECT COUNT(*) FROM attendance a WHERE a.workspace_id = w.id AND a.date = ?) as today_attendance_count
      FROM workspaces w
      LEFT JOIN users creator ON w.created_by = creator.id
      ORDER BY w.id ASC
    `).all(todayStr);

    res.json(workspaces);
  } catch (error: any) {
    console.error("Super Admin workspaces error:", error);
    res.status(500).json({ error: "Failed to list workspaces", details: error.message });
  }
});

superAdminRouter.post("/workspaces", (req: Request & { user?: any }, res: Response) => {
  const { name, code, description, status } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Workspace name is required" });
  }

  const cleanName = name.trim();
  const cleanCode = code ? String(code).trim().toUpperCase() : cleanName.slice(0, 4).toUpperCase();
  const cleanDesc = description ? String(description).trim() : null;
  const initialStatus = status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  try {
    const existing = db.prepare("SELECT id FROM workspaces WHERE name = ?").get(cleanName);
    if (existing) {
      return res.status(400).json({ error: `A workspace named '${cleanName}' already exists` });
    }

    const insertResult = db.prepare(`
      INSERT INTO workspaces (name, code, description, status, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(cleanName, cleanCode, cleanDesc, initialStatus, req.user?.id || null);

    const newWorkspaceId = Number(insertResult.lastInsertRowid);

    // Initialize default site settings for this new workspace
    try {
      db.prepare(`
        INSERT INTO site_settings (
          office_name, latitude, longitude,
          wifi_ssid, wifi_ip, use_wifi_verification,
          workspace_id, allowed_radius
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanName,
        9.0227,
        38.7460,
        `${cleanName.replace(/\s+/g, '_')}_WiFi`,
        '192.168.1.100',
        1,
        newWorkspaceId,
        35.0
      );
    } catch (setErr) {
      console.warn("Could not seed default site_settings for workspace:", setErr);
    }

    recordAuditLog({
      workspaceId: newWorkspaceId,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "WORKSPACE_CREATED",
      details: `Super Admin ${req.user?.full_name} created workspace '${cleanName}' (ID: ${newWorkspaceId})`,
      targetType: "WORKSPACE",
      targetId: newWorkspaceId,
      ipAddress: getClientIp(req),
      afterValue: { id: newWorkspaceId, name: cleanName, code: cleanCode, status: initialStatus }
    });

    const created = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(newWorkspaceId);
    res.status(201).json({ success: true, workspace: created });
  } catch (error: any) {
    console.error("Create workspace error:", error);
    res.status(500).json({ error: "Failed to create workspace", details: error.message });
  }
});

superAdminRouter.put("/workspaces/:id", (req: Request & { user?: any }, res: Response) => {
  const wsId = parseInt(req.params.id, 10);
  if (isNaN(wsId)) return res.status(400).json({ error: "Invalid workspace ID" });

  const { name, code, description, status } = req.body;

  try {
    const existing: any = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(wsId);
    if (!existing) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    const updatedName = name && typeof name === "string" && name.trim() ? name.trim() : existing.name;
    const updatedCode = code !== undefined ? (code ? String(code).trim().toUpperCase() : null) : existing.code;
    const updatedDesc = description !== undefined ? (description ? String(description).trim() : null) : existing.description;
    const updatedStatus = status ? (status === "INACTIVE" ? "INACTIVE" : "ACTIVE") : (existing.status || "ACTIVE");

    // Check unique name if changed
    if (updatedName !== existing.name) {
      const nameConflict = db.prepare("SELECT id FROM workspaces WHERE name = ? AND id != ?").get(updatedName, wsId);
      if (nameConflict) {
        return res.status(400).json({ error: `A workspace named '${updatedName}' already exists` });
      }
    }

    db.prepare(`
      UPDATE workspaces 
      SET name = ?, code = ?, description = ?, status = ?
      WHERE id = ?
    `).run(updatedName, updatedCode, updatedDesc, updatedStatus, wsId);

    // Also update office_name in site_settings if workspace name changed
    if (updatedName !== existing.name) {
      try {
        db.prepare("UPDATE site_settings SET office_name = ? WHERE workspace_id = ?").run(updatedName, wsId);
      } catch (_) {}
    }

    recordAuditLog({
      workspaceId: wsId,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "WORKSPACE_UPDATED",
      details: `Super Admin ${req.user?.full_name} updated workspace #${wsId} ('${existing.name}' -> '${updatedName}', Status: ${updatedStatus})`,
      targetType: "WORKSPACE",
      targetId: wsId,
      ipAddress: getClientIp(req),
      beforeValue: { name: existing.name, code: existing.code, status: existing.status },
      afterValue: { name: updatedName, code: updatedCode, status: updatedStatus }
    });

    const updated = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(wsId);
    res.json({ success: true, workspace: updated });
  } catch (error: any) {
    console.error("Update workspace error:", error);
    res.status(500).json({ error: "Failed to update workspace", details: error.message });
  }
});

superAdminRouter.delete("/workspaces/:id", (req: Request & { user?: any }, res: Response) => {
  const wsId = parseInt(req.params.id, 10);
  if (isNaN(wsId)) return res.status(400).json({ error: "Invalid workspace ID" });

  if (wsId === 1) {
    return res.status(400).json({ error: "Primary Master Workspace (ID 1) cannot be deleted. You may deactivate it instead." });
  }

  try {
    const existing: any = db.prepare("SELECT * FROM workspaces WHERE id = ?").get(wsId);
    if (!existing) {
      return res.status(404).json({ error: "Workspace not found" });
    }

    // Check if users exist in this workspace
    const usersCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE workspace_id = ?").get(wsId) as any)?.count || 0;
    if (usersCount > 0) {
      // Mark as INACTIVE rather than destroying relational records
      db.prepare("UPDATE workspaces SET status = 'INACTIVE' WHERE id = ?").run(wsId);
      recordAuditLog({
        workspaceId: wsId,
        userId: req.user?.id,
        actorRole: req.user?.role,
        action: "WORKSPACE_DEACTIVATED",
        details: `Super Admin ${req.user?.full_name} deactivated workspace #${wsId} ('${existing.name}'). Preserved ${usersCount} associated employee records.`,
        targetType: "WORKSPACE",
        targetId: wsId,
        ipAddress: getClientIp(req)
      });
      return res.json({ 
        success: true, 
        message: `Workspace contains ${usersCount} users. It has been deactivated (status set to INACTIVE) to safeguard attendance and payroll records.` 
      });
    }

    // Safe to delete if empty
    db.prepare("DELETE FROM site_settings WHERE workspace_id = ?").run(wsId);
    db.prepare("DELETE FROM workspaces WHERE id = ?").run(wsId);

    recordAuditLog({
      workspaceId: wsId,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "WORKSPACE_DELETED",
      details: `Super Admin ${req.user?.full_name} deleted unused workspace #${wsId} ('${existing.name}')`,
      targetType: "WORKSPACE",
      targetId: wsId,
      ipAddress: getClientIp(req),
      beforeValue: existing
    });

    res.json({ success: true, message: `Workspace '${existing.name}' was permanently deleted.` });
  } catch (error: any) {
    console.error("Delete workspace error:", error);
    res.status(500).json({ error: "Failed to delete workspace", details: error.message });
  }
});

// =========================================================================
// 3. ADMINISTRATORS MANAGEMENT & WORKSPACE ASSIGNMENTS
// =========================================================================
superAdminRouter.get("/admins", (req: Request & { user?: any }, res: Response) => {
  try {
    const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "HR", "Accountant", "Bootstrap"];
    const placeholders = adminRoles.map(() => "?").join(",");

    const admins = db.prepare(`
      SELECT 
        u.id,
        u.full_name,
        u.phone_number,
        u.role,
        COALESCE(u.status, 'ACTIVE') as status,
        COALESCE(u.is_active, 1) as is_active,
        u.workspace_id,
        w.name as workspace_name,
        u.registration_date,
        u.created_by,
        creator.full_name as created_by_name,
        u.department,
        u.photo
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      LEFT JOIN users creator ON u.created_by = creator.id
      WHERE u.role IN (${placeholders})
      ORDER BY 
        CASE u.role 
          WHEN 'SuperAdmin' THEN 1 
          WHEN 'AdminCreator' THEN 2 
          WHEN 'AdminManager' THEN 3 
          ELSE 4 
        END ASC,
        u.full_name ASC
    `).all(...adminRoles);

    res.json(admins);
  } catch (error: any) {
    console.error("Super Admin list admins error:", error);
    res.status(500).json({ error: "Failed to list administrators", details: error.message });
  }
});

superAdminRouter.post("/admins", (req: Request & { user?: any }, res: Response) => {
  const { full_name, phone_number, role, password, workspace_id, department } = req.body;

  if (!full_name || !phone_number || !role || !password) {
    return res.status(400).json({ error: "Full name, phone number, role, and password are required" });
  }

  const allowedRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "HR", "Accountant"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Allowed admin roles: ${allowedRoles.join(", ")}` });
  }

  const cleanPhone = String(phone_number).trim();
  const cleanName = String(full_name).trim();

  try {
    const existing = db.prepare("SELECT id FROM users WHERE phone_number = ?").get(cleanPhone);
    if (existing) {
      return res.status(400).json({ error: `A user with phone number '${cleanPhone}' already exists` });
    }

    let targetWsId = workspace_id ? parseInt(workspace_id, 10) : 1;
    if (role === "SuperAdmin") {
      targetWsId = targetWsId || 1; // Global role has primary home workspace
    } else {
      const wsCheck = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(targetWsId);
      if (!wsCheck) {
        return res.status(400).json({ error: `Selected workspace (ID ${targetWsId}) does not exist` });
      }
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const insertResult = db.prepare(`
      INSERT INTO users (
        full_name, phone_number, role, password,
        workspace_id, created_by, department,
        status, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1)
    `).run(
      cleanName,
      cleanPhone,
      role,
      passwordHash,
      targetWsId,
      req.user?.id || null,
      department || "Management"
    );

    const newAdminId = Number(insertResult.lastInsertRowid);

    recordAuditLog({
      workspaceId: targetWsId,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "ADMIN_CREATED",
      details: `Super Admin ${req.user?.full_name} created new ${role} account for ${cleanName} (${cleanPhone}) assigned to Workspace #${targetWsId}`,
      targetType: "USER",
      targetId: newAdminId,
      ipAddress: getClientIp(req),
      afterValue: { id: newAdminId, full_name: cleanName, phone: cleanPhone, role, workspace_id: targetWsId }
    });

    const newAdmin = db.prepare(`
      SELECT u.id, u.full_name, u.phone_number, u.role, u.status, u.is_active, u.workspace_id, w.name as workspace_name, u.department
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.id = ?
    `).get(newAdminId);

    res.status(201).json({ success: true, admin: newAdmin });
  } catch (error: any) {
    console.error("Create admin error:", error);
    res.status(500).json({ error: "Failed to create administrator account", details: error.message });
  }
});

superAdminRouter.put("/admins/:id", (req: Request & { user?: any }, res: Response) => {
  const adminId = parseInt(req.params.id, 10);
  if (isNaN(adminId)) return res.status(400).json({ error: "Invalid admin ID" });

  const { full_name, phone_number, role, workspace_id, password, department, status } = req.body;

  try {
    const existing: any = db.prepare("SELECT * FROM users WHERE id = ?").get(adminId);
    if (!existing) {
      return res.status(404).json({ error: "Admin account not found" });
    }

    const cleanName = full_name ? String(full_name).trim() : existing.full_name;
    const cleanPhone = phone_number ? String(phone_number).trim() : existing.phone_number;
    const updatedRole = role || existing.role;
    const updatedWsId = workspace_id ? parseInt(workspace_id, 10) : existing.workspace_id;
    const updatedDept = department !== undefined ? String(department).trim() : existing.department;
    const updatedStatus = status ? (status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE") : (existing.status || "ACTIVE");
    const updatedIsActive = updatedStatus === "ACTIVE" ? 1 : 0;

    // Verify phone uniqueness if changed
    if (cleanPhone !== existing.phone_number) {
      const phoneConflict = db.prepare("SELECT id FROM users WHERE phone_number = ? AND id != ?").get(cleanPhone, adminId);
      if (phoneConflict) {
        return res.status(400).json({ error: `Phone number '${cleanPhone}' is already registered to another user` });
      }
    }

    let query = `
      UPDATE users SET 
        full_name = ?,
        phone_number = ?,
        role = ?,
        workspace_id = ?,
        department = ?,
        status = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
    `;
    const params: any[] = [cleanName, cleanPhone, updatedRole, updatedWsId, updatedDept, updatedStatus, updatedIsActive];

    if (password && typeof password === "string" && password.trim()) {
      query += ", password = ?";
      params.push(bcrypt.hashSync(password.trim(), 10));
    }

    query += " WHERE id = ?";
    params.push(adminId);

    db.prepare(query).run(...params);

    recordAuditLog({
      workspaceId: updatedWsId,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "ADMIN_UPDATED",
      details: `Super Admin ${req.user?.full_name} updated admin #${adminId} (${cleanName}, Role: ${updatedRole}, Workspace: #${updatedWsId}, Status: ${updatedStatus})`,
      targetType: "USER",
      targetId: adminId,
      ipAddress: getClientIp(req),
      beforeValue: { full_name: existing.full_name, role: existing.role, workspace_id: existing.workspace_id, status: existing.status },
      afterValue: { full_name: cleanName, role: updatedRole, workspace_id: updatedWsId, status: updatedStatus }
    });

    const updated = db.prepare(`
      SELECT u.id, u.full_name, u.phone_number, u.role, u.status, u.is_active, u.workspace_id, w.name as workspace_name, u.department
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.id = ?
    `).get(adminId);

    res.json({ success: true, admin: updated });
  } catch (error: any) {
    console.error("Update admin error:", error);
    res.status(500).json({ error: "Failed to update administrator", details: error.message });
  }
});

superAdminRouter.put("/admins/:id/status", (req: Request & { user?: any }, res: Response) => {
  const adminId = parseInt(req.params.id, 10);
  if (isNaN(adminId)) return res.status(400).json({ error: "Invalid admin ID" });

  if (adminId === req.user?.id) {
    return res.status(400).json({ error: "You cannot suspend your own Super Administrator account." });
  }

  const { status } = req.body;
  const targetStatus = status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
  const isActiveNum = targetStatus === "ACTIVE" ? 1 : 0;

  try {
    const existing: any = db.prepare("SELECT * FROM users WHERE id = ?").get(adminId);
    if (!existing) {
      return res.status(404).json({ error: "Admin account not found" });
    }

    db.prepare("UPDATE users SET status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(targetStatus, isActiveNum, adminId);

    recordAuditLog({
      workspaceId: existing.workspace_id,
      userId: req.user?.id,
      actorRole: req.user?.role,
      action: "ADMIN_STATUS_CHANGED",
      details: `Super Admin ${req.user?.full_name} changed access status of admin #${adminId} (${existing.full_name}, ${existing.role}) to '${targetStatus}'`,
      targetType: "USER",
      targetId: adminId,
      outcome: "SUCCESS",
      ipAddress: getClientIp(req),
      beforeValue: { status: existing.status, is_active: existing.is_active },
      afterValue: { status: targetStatus, is_active: isActiveNum }
    });

    res.json({
      success: true,
      message: `Administrator '${existing.full_name}' is now ${targetStatus}.`,
      status: targetStatus,
      is_active: isActiveNum
    });
  } catch (error: any) {
    console.error("Change admin status error:", error);
    res.status(500).json({ error: "Failed to modify administrator status", details: error.message });
  }
});

// =========================================================================
// 4. GLOBAL SECURITY EVENTS & AUDIT LOGS
// =========================================================================
superAdminRouter.get("/audit-logs", (req: Request & { user?: any }, res: Response) => {
  const { workspace_id, action, outcome, search, limit } = req.query;
  const maxLimit = Math.min(500, parseInt(limit as string, 10) || 100);

  try {
    let query = `
      SELECT 
        al.id,
        al.workspace_id,
        w.name as workspace_name,
        al.user_id,
        al.actor_id,
        COALESCE(u.full_name, al.actor_role, 'System') as actor_name,
        COALESCE(al.actor_role, u.role, 'System') as actor_role,
        al.action,
        al.details,
        al.ip_address,
        COALESCE(al.outcome, 'SUCCESS') as outcome,
        al.target_type,
        al.target_id,
        al.before_value,
        al.after_value,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN workspaces w ON al.workspace_id = w.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (workspace_id && workspace_id !== "all" && parseInt(workspace_id as string, 10) > 0) {
      query += " AND al.workspace_id = ?";
      params.push(parseInt(workspace_id as string, 10));
    }

    if (action && typeof action === "string" && action.trim()) {
      query += " AND al.action = ?";
      params.push(action.trim());
    }

    if (outcome && typeof outcome === "string" && outcome.trim()) {
      query += " AND al.outcome = ?";
      params.push(outcome.trim());
    }

    if (search && typeof search === "string" && search.trim()) {
      query += " AND (al.details LIKE ? OR al.action LIKE ? OR u.full_name LIKE ? OR al.ip_address LIKE ?)";
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    query += " ORDER BY al.created_at DESC, al.id DESC LIMIT ?";
    params.push(maxLimit);

    const logs = db.prepare(query).all(...params);
    res.json(logs);
  } catch (error: any) {
    console.error("Super Admin audit logs error:", error);
    res.status(500).json({ error: "Failed to retrieve audit logs", details: error.message });
  }
});

superAdminRouter.get("/security-events", (req: Request & { user?: any }, res: Response) => {
  try {
    const events = db.prepare(`
      SELECT 
        al.id,
        al.workspace_id,
        w.name as workspace_name,
        al.user_id,
        al.actor_id,
        COALESCE(u.full_name, al.actor_role, 'Anonymous') as actor_name,
        COALESCE(al.actor_role, u.role, 'Security') as actor_role,
        al.action,
        al.details,
        al.ip_address,
        COALESCE(al.outcome, 'ALERT') as outcome,
        al.created_at
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN workspaces w ON al.workspace_id = w.id
      WHERE 
        al.action IN (
          'LOGIN_FAILED', 'SUSPENDED_LOGIN_ATTEMPT', 'LOGIN_RATE_LIMITED',
          'UNAUTHORIZED_PERMISSION_ATTEMPT', 'UNAUTHORIZED_SUPER_ADMIN_ACCESS',
          'ADMIN_STATUS_CHANGED', 'ADMIN_CREATED', 'DEVICE_BINDING_RESET'
        ) 
        OR al.outcome IN ('DENIED', 'FAILURE', 'SUSPICIOUS')
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT 150
    `).all();

    res.json(events);
  } catch (error: any) {
    console.error("Super Admin security events error:", error);
    res.status(500).json({ error: "Failed to retrieve security events", details: error.message });
  }
});
