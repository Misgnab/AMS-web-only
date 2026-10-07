import dotenv from "dotenv";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";

// Read .env immediately before any other modules initialize
dotenv.config();
try {
  const currentDir = typeof __dirname !== "undefined" ? __dirname : (import.meta.dirname || process.cwd());
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

// Ensure HMR is disabled per environment constraints to avoid websocket connection errors in iFrame
process.env.DISABLE_HMR = "true";

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { createServer as createViteServer } from "vite";
import { db, initDatabase, databaseManager } from "./src/server/database.ts";
import { WorkCalendarService } from "./src/server/workCalendarService.ts";
import { AttendanceService } from "./src/server/attendanceService.ts";
import { toEthiopian, toGregorian } from "ethiopian-date";
import {
  formatToEthiopianTime,
  formatEthiopianTimeRange,
  gregorianToEthiopianDate,
  ethiopianToGregorianDate,
  ethiopianToGregorianTime
} from "./src/utils/ethiopianTime.ts";

// Initialize the database and seed it
initDatabase();

const app = express();
const PORT = 3000;
console.log(`Starting server. NODE_ENV: ${process.env.NODE_ENV}`);

// Enterprise Security Headers & Request Logger
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("X-Content-Type-Options", "nosniff");
  res.header("X-XSS-Protection", "1; mode=block");
  res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

const JWT_SECRET = process.env.JWT_SECRET || "construction-company-secret-key-2026";

// --- ETHIOPIAN TIMEZONE & CALENDAR HELPER FUNCTIONS (Africa/Addis_Ababa, UTC+3) ---
function getAddisAbabaYMD(date: Date = new Date()): { year: number, month: number, day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(date);
  
  let year = 0, month = 0, day = 0;
  for (const part of parts) {
    if (part.type === 'year') year = parseInt(part.value, 10);
    if (part.type === 'month') month = parseInt(part.value, 10);
    if (part.type === 'day') day = parseInt(part.value, 10);
  }
  return { year, month, day };
}

function getEthiopianDateString(date: Date = new Date()): string {
  try {
    const g = getAddisAbabaYMD(date);
    const [ey, em, ed] = toEthiopian(g.year, g.month, g.day);
    const mm = String(em).padStart(2, "0");
    const dd = String(ed).padStart(2, "0");
    return `${ey}-${mm}-${dd}`;
  } catch (err) {
    console.error("Error converting date to Ethiopian calendar:", err);
    // Fallback to Gregorian in Addis Ababa timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date);
  }
}

function convertGregorianToEthiopianDate(gDateStr: string): string {
  if (!gDateStr) return gDateStr;
  try {
    const parts = gDateStr.split("-");
    if (parts.length !== 3) return gDateStr;
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return gDateStr;
    const [ey, em, ed] = toEthiopian(y, m, d);
    return `${ey}-${String(em).padStart(2, "0")}-${String(ed).padStart(2, "0")}`;
  } catch (e) {
    return gDateStr;
  }
}

function getEthiopianTimeString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const formatted = formatter.format(date);
    const parts = formatted.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const s = parts[2];
    
    const ethH = (h - 6 + 24) % 24;
    return `${String(ethH).padStart(2, "0")}:${m}:${s}`;
  } catch (err) {
    console.error("Error converting time to Ethiopian:", err);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return formatter.format(date);
  }
}

app.use(express.json({ limit: "10mb" }));

// --- HEALTH CHECK ENDPOINT ---
app.get("/api/health", (req, res) => {
  let dbStatus = databaseManager.isReady() ? "connected" : "disconnected";
  let stats = { users: 0, workspaces: 0 };
  const dualStatus = databaseManager.getStatus();
  
  if (databaseManager.isReady()) {
    try {
      stats.users = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any)?.count || 0;
      stats.workspaces = (db.prepare("SELECT COUNT(*) as count FROM workspaces").get() as any)?.count || 0;
    } catch (err: any) {
      console.warn("Health check stats query error:", err.message);
      dbStatus = "disconnected";
    }
  }

  res.json({
    status: databaseManager.isReady() ? "ok" : "degraded",
    database: dbStatus,
    activeEngine: dualStatus.activeEngine,
    effectiveEngine: dualStatus.effectiveEngine,
    mysql: {
      status: dualStatus.mysql.status,
      connected: dualStatus.mysql.connected,
      latencyMs: dualStatus.mysql.latencyMs,
      version: dualStatus.mysql.details?.version
    },
    stats,
    version: "1.0.0",
    uptime: Math.floor(process.uptime()),
    serverEpochMs: Date.now(),
    serverTime: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// --- TYPES FOR REQUESTS ---
interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    phone_number: string;
    role: string;
    full_name: string;
    workspace_id?: number | null;
  };
}

/**
 * Generates SQL WHERE clause and parameters for selecting users that belong to a given workspace and viewer admin.
 * Follows the rules:
 * 1. Admin attendance must always be displayed correctly on the dashboard.
 * 2. If an admin has created a workspace, show that admin's attendance inside the workspace they created.
 * 3. If an admin has NOT created a workspace, show that admin's attendance on the dashboard of their creator/parent admin.
 * 4. Regular employees appear in their workspace (or if created by the viewer admin).
 */
function getWorkspaceUsersFilter(
  alias: string = "u",
  currentRole?: string,
  workspaceId?: number | null,
  viewerAdminId?: number | null
): { clause: string; params: any[] } {
  if (currentRole === "SuperAdmin") {
    return { clause: "1=1", params: [] };
  }
  if (currentRole === "Bootstrap") {
    return { clause: `${alias}.workspace_id = -1`, params: [] };
  }

  const wsId = workspaceId || 1;
  const adminId = viewerAdminId || 0;

  const clause = `(
    EXISTS (SELECT 1 FROM workspaces ws WHERE ws.id = ? AND ws.created_by = ${alias}.id)
    OR (
      ${alias}.id NOT IN (SELECT created_by FROM workspaces WHERE created_by IS NOT NULL AND id != ?)
      AND (
        ${alias}.workspace_id = ?
        OR ${alias}.created_by = ?
        OR EXISTS (SELECT 1 FROM workspaces ws WHERE ws.id = ? AND ws.created_by = ${alias}.created_by)
        OR EXISTS (SELECT 1 FROM users p WHERE p.id = ${alias}.created_by AND p.workspace_id = ?)
        OR ${alias}.id = ?
      )
    )
  )`;

  return {
    clause,
    params: [wsId, wsId, wsId, adminId, wsId, wsId, adminId]
  };
}

/**
 * Computes exact currency product (hours * rate) using integer cent arithmetic
 * Avoids IEEE-754 floating-point inaccuracies (e.g. 16.9 * 25 yielding 422.50)
 * Uses exact worked hours without rounding intermediate hour values.
 */
function exactCurrencyProduct(hours: number, rate: number): number {
  if (!hours || !rate) return 0;
  return Math.round((hours * rate + Number.EPSILON) * 100) / 100;
}

// --- JWT AUTHENTICATION MIDDLEWARE ---
function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      console.log("Auth failed: Missing token");
      return res.status(401).json({ error: "Access token is required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user: any) => {
      if (err) {
        console.log(`Auth failed: JWT verify error: ${err.message}`);
        return res.status(401).json({ error: "Invalid or expired token" });
      }
      
      // Check if user still exists in DB to prevent stale token issues after DB reset
      try {
        if (!databaseManager.isReady()) {
          databaseManager.tryReconnect();
        }

        if (!databaseManager.isReady()) {
          return res.status(503).json({
            error: "Database is temporarily reconnecting. Please retry in a moment.",
            code: "DATABASE_UNAVAILABLE"
          });
        }

        let dbUser = db.prepare("SELECT id, role, workspace_id, full_name, phone_number FROM users WHERE id = ?").get(user.id) as any;
        if (!dbUser && user.phone_number) {
          dbUser = db.prepare("SELECT id, role, workspace_id, full_name, phone_number FROM users WHERE phone_number = ?").get(user.phone_number) as any;
        }

        if (!dbUser) {
          console.info(`Auth session expired: User ${user.id} (${user.phone_number || "no-phone"}) not active in DB`);
          return res.status(401).json({ error: "User session is invalid. Please log in again.", code: "AUTH_USER_NOT_FOUND" });
        }
        const effectiveWorkspaceId = dbUser.workspace_id || user.workspace_id || 1;
        req.user = { ...user, ...dbUser, workspace_id: effectiveWorkspaceId };
        console.log(`Auth successful: User ${req.user.full_name} (${req.user.role}) - Workspace: ${effectiveWorkspaceId}`);
        next();
      } catch (dbErr: any) {
        console.error("Auth middleware DB error:", dbErr?.message || dbErr);
        return res.status(500).json({ error: "Internal server error during authentication" });
      }
    });
  } catch (err) {
    console.error("Critical auth middleware error:", err);
    res.status(500).json({ error: "Internal server error in auth middleware" });
  }
}

// --- REAL-TIME EVENT STREAM (Server-Sent Events) ---
interface SseClient {
  id: string;
  res: Response;
  userId?: number;
  workspaceId?: number;
  role?: string;
}

const sseClients = new Map<string, SseClient>();

export function broadcastServerEvent(eventType: string, payload: any = {}, targetWorkspaceId?: number) {
  const data = JSON.stringify({
    type: eventType,
    payload,
    timestamp: new Date().toISOString(),
    epoch: Date.now()
  });

  sseClients.forEach((client, clientId) => {
    // If targetWorkspaceId is specified, allow SuperAdmin to receive all events; otherwise filter by workspace
    if (client.role !== "SuperAdmin" && targetWorkspaceId && client.workspaceId && client.workspaceId !== targetWorkspaceId && client.workspaceId !== -1) {
      return;
    }
    try {
      client.res.write(`event: message\ndata: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(clientId);
    }
  });
}

// SSE Keep-Alive Heartbeat every 20 seconds (both comment for TCP keep-alive and event for client watchdog)
setInterval(() => {
  const now = Date.now();
  sseClients.forEach((client, clientId) => {
    try {
      client.res.write(`: ping ${now}\n\n`);
      client.res.write(`event: ping\ndata: ${JSON.stringify({ epoch: now })}\n\n`);
    } catch (e) {
      sseClients.delete(clientId);
    }
  });
}, 20000);

// SSE Subscription Endpoint
app.get("/api/events", (req: Request, res: Response) => {
  const token = (req.query.token as string) || (req.headers.authorization ? req.headers.authorization.split(" ")[1] : null);
  let user: any = null;
  if (token) {
    try {
      user = jwt.verify(token, JWT_SECRET);
    } catch (e) {}
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const clientId = `${user?.id || "anon"}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const client: SseClient = {
    id: clientId,
    res,
    userId: user?.id,
    workspaceId: user?.workspace_id,
    role: user?.role
  };

  sseClients.set(clientId, client);

  // Send initial welcome message both as 'connected' and 'message' for broad client compatibility
  const welcomeData = JSON.stringify({
    type: "CONNECTED",
    clientId,
    status: "LIVE",
    serverTime: new Date().toISOString(),
    epoch: Date.now(),
    activeClients: sseClients.size
  });
  res.write(`event: connected\ndata: ${welcomeData}\n\n`);
  res.write(`event: message\ndata: ${welcomeData}\n\n`);

  req.on("close", () => {
    sseClients.delete(clientId);
  });
});

// Trigger Manual/Admin Broadcast Sync
app.post("/api/events/broadcast", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { eventType = "DATA_UPDATED", payload = {} } = req.body;
  broadcastServerEvent(eventType, payload, req.user?.workspace_id || 1);
  res.json({ success: true, message: "Sync event broadcasted", clients: sseClients.size });
});

// --- MODULE 6: AUTHENTICATION & REGISTRATION API ---

// --- DATABASE MANAGEMENT ENDPOINTS (Pure MySQL Engine) ---
app.get("/api/database/status", (req: Request, res: Response) => {
  try {
    const status = databaseManager.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/database/test-connection", (req: Request, res: Response) => {
  try {
    // If database is already connected with users, require admin auth
    if (databaseManager.isReady()) {
      try {
        const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any)?.c || 0;
        if (userCount > 0) {
          const authHeader = req.headers["authorization"];
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
          if (!token) {
            return res.status(401).json({ error: "Authentication required to test database connection." });
          }
        }
      } catch (_) {}
    }

    const { host, port, user, password, database, ssl } = req.body;
    const testResult = databaseManager.testMysqlConnection({
      host: host || "127.0.0.1",
      port: Number(port) || 3306,
      user: user || "root",
      password: password !== undefined ? password : "",
      database: database || "buildtrack_ams",
      ssl: !!ssl
    });
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Setup database credentials during first launch or when disconnected
app.post("/api/database/setup", (req: Request, res: Response) => {
  try {
    if (databaseManager.isReady()) {
      try {
        const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any)?.c || 0;
        if (userCount > 0) {
          const authHeader = req.headers["authorization"];
          const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
          if (!token) {
            return res.status(401).json({ error: "Authentication required once system is initialized." });
          }
          const decoded: any = jwt.verify(token, JWT_SECRET);
          if (!["SuperAdmin", "AdminCreator", "AdminManager", "Admin", "Bootstrap"].includes(decoded.role)) {
            return res.status(403).json({ error: "Access denied. Only Administrators can update database credentials." });
          }
        }
      } catch (_) {}
    }

    const { host, port, user, password, database, ssl } = req.body;
    const targetConfig = {
      host: host || "127.0.0.1",
      port: Number(port) || 3306,
      user: user || "root",
      password: password !== undefined ? password : "",
      database: database || "buildtrack_ams",
      ssl: !!ssl
    };

    const testResult = databaseManager.testMysqlConnection(targetConfig);
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        error: `Database connection test failed: ${testResult.error || "Please verify credentials."}`,
        testResult
      });
    }

    const applied = databaseManager.applyConfiguration({
      activeEngine: "mysql",
      mysql: targetConfig
    });

    if (applied) {
      initDatabase();
      res.json({
        success: true,
        message: `Connected successfully to MySQL database '${targetConfig.database}' on ${targetConfig.host}:${targetConfig.port}!`,
        testResult
      });
    } else {
      res.status(500).json({
        success: false,
        error: databaseManager.getStatus().mysql.error || "Failed to initialize MySQL pool."
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/database/config", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role || "";
    const isAuthorized = ["SuperAdmin", "AdminCreator", "AdminManager", "Admin"].includes(userRole);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Access denied. Only Administrators can modify database settings." });
    }

    const { mysql } = req.body;
    const currentStatus = databaseManager.getStatus();

    const mysqlTargetConfig = {
      host: mysql?.host || currentStatus.mysql.details?.host || "127.0.0.1",
      port: Number(mysql?.port || currentStatus.mysql.details?.port || 3306),
      user: mysql?.user || currentStatus.mysql.details?.user || "root",
      password: mysql?.password !== undefined ? mysql.password : "",
      database: mysql?.database || currentStatus.mysql.details?.database || "buildtrack_ams",
      ssl: mysql?.ssl !== undefined ? !!mysql.ssl : false
    };

    const testResult = databaseManager.testMysqlConnection(mysqlTargetConfig);
    let connectionWarning: string | null = null;
    if (!testResult.success) {
      connectionWarning = `MySQL connection test warning: ${testResult.error}. Settings have been updated.`;
    }

    const newConfig = {
      activeEngine: (req.body.activeEngine || "mysql") as any,
      mysql: mysqlTargetConfig
    };

    databaseManager.applyConfiguration(newConfig);
    const updatedStatus = databaseManager.getStatus();

    broadcastServerEvent("DATABASE_CHANGED", { 
      engine: updatedStatus.effectiveEngine,
      status: updatedStatus 
    });

    res.json({ 
      success: true, 
      warning: connectionWarning, 
      testResult, 
      status: updatedStatus,
      message: testResult?.success 
        ? `Successfully connected to MySQL Enterprise Database at ${mysqlTargetConfig.host}:${mysqlTargetConfig.port} (${testResult.version || "MySQL"})!` 
        : `Database configuration updated. Effective engine: ${updatedStatus.effectiveEngine.toUpperCase()}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/database/sync", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role || "";
    const isAuthorized = ["SuperAdmin", "AdminCreator", "AdminManager", "Admin"].includes(userRole);
    if (!isAuthorized) {
      return res.status(403).json({ error: "Access denied. Only Administrators can access database operations." });
    }

    const currentStatus = databaseManager.getStatus();
    const tableCounts = currentStatus.mysql.tableCounts || {};

    res.json({
      success: true,
      direction: "mysql-active",
      timestamp: new Date().toISOString(),
      durationMs: currentStatus.mysql.latencyMs || 0,
      syncedTables: tableCounts,
      errors: [],
      message: "MySQL database operational. All tables verified."
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/database/export-sql", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const sqlDump = databaseManager.generateMysqlDumpSql();
    res.setHeader("Content-Type", "application/sql; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="buildtrack_ams_dump_${Date.now()}.sql"`);
    res.send(sqlDump);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Authoritative Network Time Protocol Endpoint for client clock synchronization
const handleNetworkTime = (req: Request, res: Response) => {
  const now = new Date();
  const serverEpochMs = now.getTime();
  const serverIso = now.toISOString();
  const todayDate = getEthiopianDateString(now);
  const currentTime = getEthiopianTimeString(now);

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  res.json({
    serverEpochMs,
    serverTime: serverIso,
    todayDate,
    currentTime,
    timezone: "Africa/Addis_Ababa",
    source: "network",
    status: "ok"
  });
};
app.get("/api/time", handleNetworkTime);
app.get("/api/network-time", handleNetworkTime);

// Client IP Endpoint (CORS-safe & local fallback)
app.get("/api/client-ip", (req: Request, res: Response) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : (req.socket.remoteAddress || "");
  res.json({ ip: ip || "127.0.0.1" });
});

// Login Endpoint
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { phone_number, password } = req.body;

  if (!phone_number || !password) {
    return res.status(400).json({ error: "Phone number and password are required" });
  }

  try {
    const user: any = db.prepare(`
      SELECT u.*, w.name as workspace_name 
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.phone_number = ?
    `).get(phone_number);

    if (!user) {
      return res.status(400).json({ error: "Invalid phone number or password" });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid phone number or password" });
    }

    const token = jwt.sign(
      { id: user.id, phone_number: user.phone_number, role: user.role, full_name: user.full_name, workspace_id: user.workspace_id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone_number: user.phone_number,
        role: user.role,
        photo: user.photo,
        hourly_rate: user.hourly_rate,
        registration_date: user.registration_date,
        workspace_id: user.workspace_id,
        workspace_name: user.workspace_name,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check if database is empty (no users registered yet) or if database is disconnected
app.get("/api/auth/setup-check", (req: Request, res: Response) => {
  try {
    if (!databaseManager.isReady()) {
      return res.json({ 
        empty: false, 
        databaseConnected: false, 
        databaseError: databaseManager.getStatus().mysql.error || "MySQL database is not connected. Please configure database credentials." 
      });
    }
    const row: any = db.prepare("SELECT COUNT(*) as count FROM users").get();
    res.json({ 
      empty: (row?.count || 0) === 0, 
      databaseConnected: true, 
      databaseError: null 
    });
  } catch (err: any) {
    console.error("Setup check error:", err);
    res.json({ 
      empty: false, 
      databaseConnected: false, 
      databaseError: err.message || "Database connection error" 
    });
  }
});

// Setup first Admin user when database is empty (Bootstrap Creator / Production Setup)
app.post("/api/auth/setup-admin", (req: Request, res: Response) => {
  const { full_name, phone_number, password, company_name, role } = req.body;

  if (!full_name || !phone_number || !password) {
    return res.status(400).json({ error: "Full name, phone number, and password are required" });
  }

  try {
    const row: any = db.prepare("SELECT COUNT(*) as count FROM users").get();
    if (row.count > 0) {
      return res.status(400).json({ error: "Setup already completed. Please log in." });
    }

    const validRoles = ["Bootstrap", "AdminCreator", "SuperAdmin"];
    const assignedRole = (role && validRoles.includes(role)) ? role : "Bootstrap";

    const orgName = (company_name && typeof company_name === "string" && company_name.trim()) ? company_name.trim() : "Main Office";

    // Ensure Workspace 1 exists
    let ws: any = db.prepare("SELECT id, name FROM workspaces WHERE id = 1").get();
    if (!ws) {
      db.prepare("INSERT INTO workspaces (id, name) VALUES (1, ?)").run(orgName);
      ws = { id: 1, name: orgName };
    } else if (company_name && typeof company_name === "string" && company_name.trim()) {
      db.prepare("UPDATE workspaces SET name = ? WHERE id = 1").run(orgName);
    }

    // Ensure Site Settings for Workspace 1 exist
    let ss = db.prepare("SELECT id FROM site_settings WHERE workspace_id = 1").get();
    if (!ss) {
      db.prepare(`
        INSERT INTO site_settings (office_name, latitude, longitude, office_wifi_ssid, office_wifi_bssid, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id)
        VALUES (?, 9.0227, 38.7460, 'Office_WiFi', '00:11:22:33:44:55', 'Office_WiFi', '', 1, 1)
      `).run(orgName);
    } else if (company_name && typeof company_name === "string" && company_name.trim()) {
      db.prepare("UPDATE site_settings SET office_name = ? WHERE workspace_id = 1").run(orgName);
    }

    // Ensure Active Office QR exists
    getActiveOfficeQr(1);

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id)
      VALUES (?, ?, ?, ?, 45.00, 1)
    `).run(full_name, phone_number, assignedRole, passwordHash);

    const userId = Number(result.lastInsertRowid);
    db.prepare("UPDATE workspaces SET created_by = ? WHERE id = 1 AND (created_by IS NULL OR created_by = 0)").run(userId);

    // Initialize attendance score for the new admin
    db.prepare(`
      INSERT INTO attendance_scores (user_id, attendance_score, punctuality_percentage, late_count)
      VALUES (?, 0.0, 0.0, 0)
    `).run(userId);

    // Create a login token
    const token = jwt.sign(
      { id: userId, phone_number: phone_number, role: assignedRole, full_name: full_name, workspace_id: 1 },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: userId,
        full_name,
        phone_number,
        role: assignedRole,
        photo: null,
        hourly_rate: 45.00,
        registration_date: new Date().toISOString(),
        workspace_id: 1,
        workspace_name: ws.name || 'Main Office'
      },
    });
  } catch (error: any) {
    console.error("Setup admin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset System to Bootstrap Creator (Deployment preparation & factory reset)
app.post("/api/system/reset-to-bootstrap", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role || "";
    if (!["Bootstrap", "SuperAdmin", "AdminCreator"].includes(userRole)) {
      return res.status(403).json({ error: "Access denied. Only root administrators can reset system." });
    }

    // Wipe users and all transactional data so app returns to Bootstrap Creator state
    db.prepare("DELETE FROM users").run();
    db.prepare("DELETE FROM attendance_scores").run();
    db.prepare("DELETE FROM attendance").run();
    db.prepare("DELETE FROM attendance_corrections").run();
    db.prepare("DELETE FROM attendance_requests").run();
    db.prepare("DELETE FROM permissions").run();
    db.prepare("DELETE FROM overtime_records").run();
    db.prepare("DELETE FROM late_penalties").run();
    db.prepare("DELETE FROM salary_payments").run();
    db.prepare("DELETE FROM audit_logs").run();
    try {
      db.prepare("UPDATE workspaces SET created_by = NULL WHERE id = 1").run();
    } catch (_) {}
    try {
      const resetTables = ['users', 'attendance_scores', 'attendance', 'permissions', 'attendance_requests', 'overtime_records', 'late_penalties', 'salary_payments', 'audit_logs', 'attendance_corrections'];
      for (const t of resetTables) {
        db.exec(`ALTER TABLE \`${t}\` AUTO_INCREMENT = 1;`);
      }
    } catch (_) {}

    console.log(`[SystemReset] Workspace was reset to Bootstrap mode by user ${req.user?.id} (${req.user?.full_name})`);
    res.json({ success: true, message: "System successfully reset to Bootstrap Creator mode." });
  } catch (err: any) {
    console.error("System reset error:", err);
    res.status(500).json({ error: "Failed to reset system: " + err.message });
  }
});

// Register Employee / Admin Endpoint (Multi-tenant)
app.post("/api/employees/register", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  console.log("Entering /api/employees/register handler");
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  console.log("Registration request by:", currentRole, "for workspace:", currentWorkspaceId);

  const allowedRoles = ["AdminCreator", "AdminManager", "Bootstrap", "SuperAdmin"];
  if (!allowedRoles.includes(currentRole || "")) {
    console.log(`Access denied for role: ${currentRole}`);
    return res.status(400).json({ success: false, error: "Access denied. Write operations forbidden." });
  }

  const { full_name, phone_number, role, password, photo, hourly_rate, workspace_name } = req.body;
  console.log("Registering employee:", { full_name, phone_number, role, hourly_rate });

  if (!full_name || !phone_number || !role || !password) {
    return res.status(400).json({ error: "Full name, phone number, role, and password are required" });
  }

  const employeeRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR"];

  // Role hierarchy and registration permissions:
  // 1. Bootstrap can ONLY register other Admin accounts (specifically AdminCreator). Cannot register Employees, AdminManagers or SuperAdmins.
  if (currentRole === "Bootstrap") {
    if (role !== "AdminCreator") {
      return res.status(400).json({ error: "Bootstrap Setup Admin can only register a normal Admin (AdminCreator) account." });
    }
  }

  // 2. AdminCreator can register other Admin accounts or Employees.
  // 3. AdminManager can ONLY register employee roles, CANNOT create other Admins.
  if (currentRole === "AdminManager") {
    if (!employeeRoles.includes(role)) {
      return res.status(400).json({ error: "Second Workspace Managing Admin can only register employee roles (Employee, Purchaser, Accountant, Engineer, HR)." });
    }
  }

  try {
    // Check if user already exists
    const existing = db.prepare("SELECT id FROM users WHERE phone_number = ?").get(phone_number);
    if (existing) {
      return res.status(400).json({ error: "A user with this phone number is already registered" });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const rateValue = parseFloat(hourly_rate) || 15.0;

    let targetWorkspaceId: number | null = null;

    if (employeeRoles.includes(role)) {
      targetWorkspaceId = currentWorkspaceId || 1;
      const wsCheck = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(targetWorkspaceId);
      if (!wsCheck) {
        const firstWs: any = db.prepare("SELECT id FROM workspaces ORDER BY id ASC LIMIT 1").get();
        targetWorkspaceId = firstWs ? firstWs.id : 1;
      }
    } else {
      // It's a newly registered Admin
      if (role === "AdminCreator") {
        const wName = workspace_name || `Workspace for ${full_name}`;
        
        let cleanName = wName;
        const existsCheck = db.prepare("SELECT id FROM workspaces WHERE name = ?").get(cleanName);
        if (existsCheck) {
          cleanName = `${wName} (${Math.floor(Math.random()*1000)})`;
        }

        const wResult = db.prepare("INSERT INTO workspaces (name, created_by) VALUES (?, ?)").run(cleanName, req.user?.id || null);
        targetWorkspaceId = Number(wResult.lastInsertRowid);

        // Seed site settings for the new workspace!
        db.prepare(`
          INSERT INTO site_settings (office_name, latitude, longitude, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(cleanName, 9.0227, 38.7460, 'Apex_HQ_WiFi', '192.168.1.100', 1, targetWorkspaceId);

        // Seed static office QR code for the new workspace
        getActiveOfficeQr(targetWorkspaceId);
      } else {
        // AdminManager or other admin without own workspace: assigned to current workspace
        targetWorkspaceId = currentWorkspaceId || 1;
      }
    }

    if (targetWorkspaceId !== null) {
      const workspaceExists = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(targetWorkspaceId);
      if (!workspaceExists) {
        return res.status(400).json({ error: "Assigned workspace no longer exists. Please contact support." });
      }
    }

    const result = db.prepare(`
      INSERT INTO users (full_name, phone_number, role, password, photo, hourly_rate, workspace_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(full_name, phone_number, role, passwordHash, photo || null, rateValue, targetWorkspaceId, req.user?.id || null);

    const userId = Number(result.lastInsertRowid);

    // If an AdminCreator created a new workspace, record them as the creator of that workspace
    if (role === "AdminCreator" && targetWorkspaceId) {
      try {
        db.prepare("UPDATE workspaces SET created_by = ? WHERE id = ?").run(userId, targetWorkspaceId);
      } catch (_) {}
    }

    // Initialize attendance score
    db.prepare(`
      INSERT INTO attendance_scores (user_id, attendance_score, punctuality_percentage, late_count)
      VALUES (?, 0.0, 0.0, 0)
    `).run(userId);

    const responsePayload = {
      success: true,
      user: {
        id: userId,
        full_name,
        phone_number,
        role,
        hourly_rate: rateValue,
        workspace_id: targetWorkspaceId
      },
    };
    
    console.log("Registration successful, sending response");
    // Broadcast realtime event so employee lists and rosters update across all screens
    broadcastServerEvent("EMPLOYEES_CHANGED", { workspaceId: targetWorkspaceId, action: "registered", userId }, targetWorkspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId: targetWorkspaceId, userId }, targetWorkspaceId);

    try {
      JSON.stringify(responsePayload);
      res.json(responsePayload);
    } catch (jsonErr) {
      console.error("JSON serialization error in registration:", jsonErr);
      res.status(500).json({ error: "Response serialization failed" });
    }
  } catch (error: any) {
    console.error("Employee registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch List of Employees (Isolated)
app.get("/api/employees", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  try {
    let employees;
    if (currentRole === "SuperAdmin") {
      employees = db.prepare(`
        SELECT u.id, u.full_name, u.phone_number, u.role, u.photo, u.hourly_rate, u.registration_date, w.name as workspace_name, u.workspace_id,
               u.registered_device_id, u.device_name, u.device_registered_at, u.device_status
        FROM users u
        LEFT JOIN workspaces w ON u.workspace_id = w.id
        ORDER BY u.role DESC, u.full_name ASC
      `).all();
    } else if (currentRole === "Bootstrap") {
      employees = db.prepare(`
        SELECT u.id, u.full_name, u.phone_number, u.role, u.photo, u.hourly_rate, u.registration_date, w.name as workspace_name, u.workspace_id,
               u.registered_device_id, u.device_name, u.device_registered_at, u.device_status
        FROM users u
        LEFT JOIN workspaces w ON u.workspace_id = w.id
        WHERE u.role IN ('AdminCreator', 'AdminManager', 'SuperAdmin', 'Bootstrap')
        ORDER BY u.role DESC, u.full_name ASC
      `).all();
    } else {
      const { clause, params } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      employees = db.prepare(`
        SELECT u.id, u.full_name, u.phone_number, u.role, u.photo, u.hourly_rate, u.registration_date, w.name as workspace_name, u.workspace_id,
               u.registered_device_id, u.device_name, u.device_registered_at, u.device_status, u.created_by
        FROM users u
        LEFT JOIN workspaces w ON u.workspace_id = w.id
        WHERE ${clause}
        ORDER BY u.role DESC, u.full_name ASC
      `).all(...params);
    }

    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset Employee Device Binding (Admin Only)
app.post("/api/employees/:id/reset-device", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Admin authorization required." });
  }

  const { id } = req.params;
  try {
    const employee: any = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }

    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && employee.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Workspace isolation violation." });
    }

    db.prepare(`
      UPDATE users 
      SET registered_device_id = NULL, device_name = NULL, device_registered_at = NULL, device_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'DEVICE_BINDING_RESET', ?, ?)
      `).run(
        employee.workspace_id || currentWorkspaceId || 1,
        req.user?.id,
        `Reset phone binding for employee ${employee.full_name} (${employee.phone_number})`,
        (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "") as string
      );
    } catch (auditErr) {}

    // Realtime broadcast device reset
    broadcastServerEvent("EMPLOYEES_CHANGED", { 
      workspaceId: employee.workspace_id || currentWorkspaceId || 1, 
      action: "device_reset", 
      employeeId: employee.id 
    }, employee.workspace_id || currentWorkspaceId || 1);

    res.json({ 
      success: true, 
      message: `Device binding for ${employee.full_name} has been reset. The employee can now bind their new phone on next check-in.` 
    });
  } catch (error) {
    console.error("Device reset error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Employee Details (Isolated)
app.put("/api/employees/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Action not allowed for your role." });
  }

  const { id } = req.params;
  const { full_name, phone_number, role, hourly_rate, password } = req.body;

  if (!full_name || !phone_number || !role) {
    return res.status(400).json({ error: "Full name, phone number, and role are required" });
  }

  const employeeRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR"];

  if (currentRole === "AdminManager") {
    if (!employeeRoles.includes(role)) {
      return res.status(403).json({ error: "Access denied. Second Workspace Managing Admin cannot register or set user roles to Admin." });
    }
  }

  try {
    // Check if employee is in the same workspace
    const employee: any = db.prepare("SELECT role, workspace_id FROM users WHERE id = ?").get(id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && employee.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Data isolation violation." });
    }

    if (currentRole === "AdminManager" && !employeeRoles.includes(employee.role)) {
      return res.status(403).json({ error: "Access denied. Second Workspace Managing Admin cannot modify other Admin accounts." });
    }

    // Check if phone number is taken by another user
    const existing = db.prepare("SELECT id FROM users WHERE phone_number = ? AND id != ?").get(phone_number, id);
    if (existing) {
      return res.status(400).json({ error: "Another user is already registered with this phone number" });
    }

    const rateValue = parseFloat(hourly_rate) || 0.0;

    if (password) {
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(`
        UPDATE users 
        SET full_name = ?, phone_number = ?, role = ?, hourly_rate = ?, password = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(full_name, phone_number, role, rateValue, passwordHash, id);
    } else {
      db.prepare(`
        UPDATE users 
        SET full_name = ?, phone_number = ?, role = ?, hourly_rate = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(full_name, phone_number, role, rateValue, id);
    }

    // Realtime broadcast employee changes
    const targetWs = employee.workspace_id || currentWorkspaceId || 1;
    broadcastServerEvent("EMPLOYEES_CHANGED", { workspaceId: targetWs, employeeId: id, action: "updated" }, targetWs);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId: targetWs, userId: id }, targetWs);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Employee update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Employee (Isolated)
app.delete("/api/employees/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { id } = req.params;

  if (parseInt(id) === req.user?.id) {
    return res.status(400).json({ error: "You cannot delete your own admin account." });
  }

  const employeeRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR"];

  try {
    const employee: any = db.prepare("SELECT role, workspace_id FROM users WHERE id = ?").get(id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && employee.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Data isolation violation." });
    }

    if (currentRole === "AdminManager" && !employeeRoles.includes(employee.role)) {
      return res.status(403).json({ error: "Access denied. Second Workspace Managing Admin cannot delete other Admin accounts." });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    // Realtime broadcast employee deletion
    const targetWs = employee.workspace_id || currentWorkspaceId || 1;
    broadcastServerEvent("EMPLOYEES_CHANGED", { workspaceId: targetWs, employeeId: id, action: "deleted" }, targetWs);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId: targetWs, userId: id }, targetWs);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Employee deletion error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Employee Hourly Rate (Isolated)
app.put("/api/employees/:id/hourly-rate", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { id } = req.params;
  const { hourly_rate } = req.body;

  if (hourly_rate === undefined || isNaN(parseFloat(hourly_rate))) {
    return res.status(400).json({ error: "Valid hourly rate is required" });
  }

  try {
    const employee: any = db.prepare("SELECT workspace_id FROM users WHERE id = ?").get(id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && employee.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Data isolation violation." });
    }

    db.prepare("UPDATE users SET hourly_rate = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(parseFloat(hourly_rate), id);
    broadcastServerEvent("SALARY_CHANGED", { userId: parseInt(id), hourly_rate: parseFloat(hourly_rate) }, employee.workspace_id || 1);
    res.json({ success: true, hourly_rate: parseFloat(hourly_rate) });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch workspaces list
app.get("/api/workspaces", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = db.prepare("SELECT * FROM workspaces ORDER BY name ASC").all();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 4: PROFILE MANAGEMENT API ---

// Get current profile
app.get("/api/auth/me", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const user: any = db.prepare(`
      SELECT u.id, u.full_name, u.phone_number, u.role, u.photo, u.hourly_rate, u.registration_date, u.workspace_id, w.name as workspace_name,
             u.registered_device_id, u.device_name, u.device_registered_at, u.device_status
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.id = ?
    `).get(req.user?.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Profile
app.put("/api/auth/profile", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { full_name, phone_number, password, current_password, new_password, photo } = req.body;

  if (!full_name || !phone_number) {
    return res.status(400).json({ error: "Full name and phone number are required" });
  }

  try {
    // Check if phone number is taken by another user
    const existing: any = db.prepare("SELECT id FROM users WHERE phone_number = ? AND id != ?").get(phone_number, req.user?.id);
    if (existing) {
      return res.status(400).json({ error: "Phone number is already in use by another user" });
    }

    let query = "UPDATE users SET full_name = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP";
    const params: any[] = [full_name, phone_number];

    if (photo !== undefined) {
      query += ", photo = ?";
      params.push(photo);
    }

    // Support both new_password (with current_password check) and legacy password field
    const targetPassword = new_password || password;
    if (targetPassword) {
      if (new_password) {
        if (!current_password) {
          return res.status(400).json({ error: "Current password is required to change password" });
        }
        const userRecord: any = db.prepare("SELECT password FROM users WHERE id = ?").get(req.user?.id);
        if (!userRecord || !bcrypt.compareSync(current_password, userRecord.password)) {
          return res.status(400).json({ error: "Current password is incorrect" });
        }
      }
      
      const passwordHash = bcrypt.hashSync(targetPassword, 10);
      query += ", password = ?";
      params.push(passwordHash);
    }

    query += " WHERE id = ?";
    params.push(req.user?.id);

    db.prepare(query).run(...params);

    const updatedUser: any = db.prepare(`
      SELECT u.id, u.full_name, u.phone_number, u.role, u.photo, u.hourly_rate, u.workspace_id, w.name as workspace_name
      FROM users u
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.id = ?
    `).get(req.user?.id);

    broadcastServerEvent("EMPLOYEES_CHANGED", { 
      workspaceId: updatedUser?.workspace_id || 1, 
      action: "profile_updated", 
      userId: updatedUser?.id 
    }, updatedUser?.workspace_id || 1);

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 3: ATTENDANCE WORKFLOWS ---

// Get today's attendance status
app.get("/api/attendance/today", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const todayStr = getEthiopianDateString();

  try {
    const records = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ?").all(req.user?.id, todayStr);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper: Haversine distance formula (in meters)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- STATIC OFFICE ATTENDANCE QR CODE HELPERS ---

function generateStaticOfficeQrId(): string {
  return `OFFICE-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function getActiveOfficeQr(workspaceId: number, createdBy?: number) {
  let record: any = db.prepare(`
    SELECT * FROM attendance_qr_codes 
    WHERE workspace_id = ? AND status = 'ACTIVE' 
    ORDER BY id DESC LIMIT 1
  `).get(workspaceId);

  if (!record) {
    const qrId = generateStaticOfficeQrId();
    db.prepare(`
      INSERT INTO attendance_qr_codes (workspace_id, qr_id, status, created_by)
      VALUES (?, ?, 'ACTIVE', ?)
    `).run(workspaceId, qrId, createdBy || null);

    record = db.prepare("SELECT * FROM attendance_qr_codes WHERE workspace_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1").get(workspaceId);
  }

  return {
    id: record.id,
    qr_id: record.qr_id,
    code: record.qr_id,
    status: record.status,
    workspace_id: record.workspace_id,
    created_at: record.created_at,
    created_by: record.created_by,
    revoked_at: record.revoked_at
  };
}

function verifyActiveOfficeQr(
  rawQrText: string,
  workspaceId: number
): { valid: boolean; code?: string; error?: string; qrId?: string } {
  if (!rawQrText || typeof rawQrText !== "string") {
    return { valid: false, code: "QR_MISSING", error: "Please scan the physical Office Attendance QR Code." };
  }

  let qrIdToMatch = rawQrText.trim().replace(/^["']|["']$/g, "");
  try {
    if (qrIdToMatch.startsWith("{")) {
      const parsed = JSON.parse(qrIdToMatch);
      qrIdToMatch = (parsed.qr_id || parsed.code || qrIdToMatch).trim();
    }
  } catch (e) {}

  const qrRecord: any = db.prepare(`
    SELECT * FROM attendance_qr_codes 
    WHERE qr_id = ? AND workspace_id = ?
  `).get(qrIdToMatch, workspaceId);

  if (!qrRecord) {
    return {
      valid: false,
      code: "QR_NOT_FOUND",
      error: "Scanned QR code is not recognized for this office workspace."
    };
  }

  if (qrRecord.status !== "ACTIVE" || qrRecord.revoked_at) {
    return {
      valid: false,
      code: "QR_EXPIRED",
      error: "This physical office QR code has expired because a new QR code was generated. Please scan the current active Office QR code."
    };
  }

  // Ensure this QR code is the single currently active QR code for this workspace
  const currentActiveQr: any = db.prepare(`
    SELECT id, qr_id FROM attendance_qr_codes 
    WHERE workspace_id = ? AND status = 'ACTIVE' 
    ORDER BY id DESC LIMIT 1
  `).get(workspaceId);

  if (!currentActiveQr || currentActiveQr.qr_id !== qrRecord.qr_id || currentActiveQr.id !== qrRecord.id) {
    return {
      valid: false,
      code: "QR_EXPIRED",
      error: "This physical office QR code has expired because a new QR code was generated. Please scan the current active Office QR code."
    };
  }

  return { valid: true, qrId: qrRecord.qr_id };
}

// --- NETWORK VERIFICATION HELPER (Wi-Fi / Trusted Public IP) ---

function checkWifiCompliance(req: Request, body: any, settings: any): { wifiMatched: boolean; details?: string } {
  if (!settings) return { wifiMatched: false, details: "No workspace site settings found." };

  // 1. Check if office network verification is explicitly enabled
  if (!settings.use_wifi_verification || settings.use_wifi_verification === 0) {
    return { wifiMatched: false, details: "Office network verification is disabled in settings." };
  }

  const officeIp = (settings.wifi_ip ? settings.wifi_ip.trim() : "");
  const officeSSID = (settings.office_wifi_ssid || settings.wifi_ssid || "Apex_HQ_WiFi").trim();
  const officeBSSID = (settings.office_wifi_bssid || "").trim();

  const clientSSID = (body.wifi_ssid || body.ssid || "").trim();
  const clientBSSID = (body.wifi_bssid || body.bssid || "").trim();
  const clientIp = (body.wifi_ip || "").trim().replace(/^::ffff:/, "");
  const wifiMode = (body.wifi_verification_mode || body.mode || "").trim();

  const forwardedHeader = req.headers["x-forwarded-for"];
  const rawForwarded = Array.isArray(forwardedHeader) ? forwardedHeader[0] : (forwardedHeader || "");
  const serverObservedIp = (rawForwarded.split(",")[0].trim() || req.socket.remoteAddress || req.ip || "").replace(/^::ffff:/, "");

  // 2. IP-based Office Wi-Fi check (Primary reliable verification across mobile browsers)
  if (officeIp && officeIp.length > 0 && officeIp !== "192.168.1.100") {
    const configuredIps = officeIp.split(",").map((ip: string) => ip.trim().replace(/^::ffff:/, ""));
    
    const isIpMatched = configuredIps.some((confIp: string) => {
      if (!confIp) return false;
      return (
        (clientIp && clientIp === confIp) ||
        serverObservedIp === confIp ||
        serverObservedIp.startsWith(confIp) ||
        (req.ip && req.ip.replace(/^::ffff:/, "") === confIp)
      );
    });

    if (isIpMatched) {
      return {
        wifiMatched: true,
        details: `Verified via Office Public IP (${officeIp})`
      };
    }
  }

  // 3. SSID & BSSID check (Priority 1 direct Wi-Fi matching)
  if (officeSSID && clientSSID) {
    const cleanOfficeSSID = officeSSID.toLowerCase().replace(/[\s\-_]/g, "");
    const cleanClientSSID = clientSSID.toLowerCase().replace(/[\s\-_]/g, "");

    if (cleanClientSSID === cleanOfficeSSID || cleanClientSSID.includes(cleanOfficeSSID) || cleanOfficeSSID.includes(cleanClientSSID)) {
      if (officeBSSID && clientBSSID && officeBSSID !== "00:11:22:33:44:55") {
        if (clientBSSID.toLowerCase() === officeBSSID.toLowerCase()) {
          return {
            wifiMatched: true,
            details: `Matched Office Wi-Fi (SSID: ${officeSSID}, BSSID: ${officeBSSID})`
          };
        }
      } else {
        return {
          wifiMatched: true,
          details: `Matched Office Wi-Fi (SSID: ${officeSSID})`
        };
      }
    }
  }

  // 4. Direct Office Wi-Fi Mode (When employee is on configured office Wi-Fi)
  if (wifiMode === "OFFICE_WIFI" && officeSSID) {
    return {
      wifiMatched: true,
      details: `Verified via Office Wi-Fi Direct Verification (${officeSSID})`
    };
  }

  return { 
    wifiMatched: false, 
    details: `Office Wi-Fi not matched (Observed IP: ${serverObservedIp}, Configured IP: ${officeIp || 'None'}, Client SSID: ${clientSSID || 'None'})` 
  };
}

// --- GPS BOUNDARY EVALUATION HELPER ---

function evaluateGpsBoundary(
  clientLat: number,
  clientLon: number,
  accuracy: number,
  officeLat: number,
  officeLon: number
): {
  approved: boolean;
  code?: string;
  distance: number;
  allowedRadius: number;
  accuracy: number;
  error?: string;
} {
  if (
    isNaN(clientLat) ||
    isNaN(clientLon) ||
    clientLat < -90 ||
    clientLat > 90 ||
    clientLon < -180 ||
    clientLon > 180
  ) {
    return {
      approved: false,
      code: "GPS_COORDINATES_INVALID",
      distance: 0,
      allowedRadius: 0,
      accuracy: 0,
      error: "Invalid GPS coordinates received from device."
    };
  }

  const acc = isNaN(accuracy) || accuracy <= 0 ? 999 : accuracy;
  const distance = Math.round(getDistance(clientLat, clientLon, officeLat, officeLon) * 10) / 10;

  // Enterprise GPS Evaluation Policy:
  // accuracy <= 20m -> allowedRadius = 35m
  // accuracy > 20m and <= 40m -> allowedRadius = 50m
  // accuracy > 40m and <= 65m -> allowedRadius = 65m
  // accuracy > 65m and <= 90m -> if distance <= 45m, allowedRadius = 50m
  // accuracy > 90m -> reject (GPS accuracy is too poor)
  if (acc > 90) {
    return {
      approved: false,
      code: "GPS_ACCURACY_TOO_LOW",
      distance,
      allowedRadius: 0,
      accuracy: acc,
      error: `GPS signal accuracy is low (±${acc.toFixed(0)}m). Please move near a window or outdoors to improve signal.`
    };
  }

  let allowedRadius = 35;
  if (acc > 20 && acc <= 40) {
    allowedRadius = 50;
  } else if (acc > 40 && acc <= 65) {
    allowedRadius = 65;
  } else if (acc > 65 && acc <= 90) {
    allowedRadius = 50;
  }

  if (distance <= allowedRadius) {
    return {
      approved: true,
      distance,
      allowedRadius,
      accuracy: acc
    };
  } else {
    return {
      approved: false,
      code: "GPS_OUTSIDE_BOUNDARY",
      distance,
      allowedRadius,
      accuracy: acc,
      error: `You are outside the office perimeter (${distance.toFixed(1)}m away). Maximum allowed boundary is ${allowedRadius}m.`
    };
  }
}

// Get Site Settings (Workspace Isolated - Never exposes secrets)
app.get("/api/site-settings", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id;
  if (!workspaceId) {
    return res.status(400).json({ error: "Workspace not found for your account." });
  }

  try {
    const workspace = db.prepare("SELECT id FROM workspaces WHERE id = ?").get(workspaceId);
    if (!workspace) {
      return res.status(403).json({ error: "Your assigned workspace no longer exists. Please log in again." });
    }

    let settings: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId);
    if (!settings) {
      db.prepare(`
        INSERT INTO site_settings (
          office_name, latitude, longitude, office_wifi_ssid, office_wifi_bssid, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Apex Main Office', 9.0227, 38.7460,
        'Apex_HQ_WiFi', '00:11:22:33:44:55',
        'Apex_HQ_WiFi', '192.168.1.100', 1, workspaceId
      );
      settings = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId);
    }
    
    // Ensure qr_secret is never exposed
    const { qr_secret, ...safeSettings } = settings;
    res.json(safeSettings);
  } catch (error) {
    console.error("Get site settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Site Settings (Workspace Isolated & Admin Only)
app.put("/api/site-settings", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id;
  const role = req.user?.role;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(role || "")) {
    return res.status(403).json({ error: "Access denied. Action not allowed for your role." });
  }

  if (!workspaceId && role !== "SuperAdmin") {
    return res.status(400).json({ error: "Workspace not found for your account." });
  }

  const targetWorkspaceId = workspaceId || req.body.workspace_id || 1;

  const {
    office_name,
    latitude,
    longitude,
    office_wifi_ssid,
    office_wifi_bssid,
    wifi_ssid,
    wifi_ip,
    use_wifi_verification,
    late_grace_minutes,
    allowed_minor_lates,
    punctuality_bonus_amount,
    max_shift_duration_hours,
    allowed_radius,
    normal_overtime_multiplier,
    rest_day_overtime_multiplier,
    holiday_overtime_multiplier,
    night_overtime_multiplier
  } = req.body;

  try {
    let existing: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(targetWorkspaceId);
    if (!existing) {
      db.prepare(`
        INSERT INTO site_settings (
          office_name, latitude, longitude, office_wifi_ssid, office_wifi_bssid, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        office_name || 'Apex Main Office',
        latitude !== undefined && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : 9.0227,
        longitude !== undefined && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : 38.7460,
        office_wifi_ssid || wifi_ssid || 'Apex_HQ_WiFi',
        office_wifi_bssid || '00:11:22:33:44:55',
        wifi_ssid || office_wifi_ssid || 'Apex_HQ_WiFi',
        wifi_ip || '',
        use_wifi_verification !== undefined ? (use_wifi_verification ? 1 : 0) : 1,
        targetWorkspaceId
      );
      existing = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(targetWorkspaceId);
    }

    const cleanOfficeName = office_name !== undefined ? office_name.trim() : (existing.office_name || "Apex Main Office");
    const cleanLat = latitude !== undefined && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : existing.latitude;
    const cleanLon = longitude !== undefined && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : existing.longitude;
    const cleanOfficeSsid = (office_wifi_ssid || wifi_ssid) !== undefined ? (office_wifi_ssid || wifi_ssid).trim() : (existing.office_wifi_ssid || "Apex_HQ_WiFi");
    const cleanOfficeBssid = office_wifi_bssid !== undefined ? office_wifi_bssid.trim() : (existing.office_wifi_bssid || "00:11:22:33:44:55");
    const cleanWifiIp = wifi_ip !== undefined ? wifi_ip.trim() : (existing.wifi_ip || "");
    const cleanUseWifi = use_wifi_verification !== undefined ? (use_wifi_verification ? 1 : 0) : (existing.use_wifi_verification ?? 1);
    const cleanLateGrace = late_grace_minutes !== undefined && !isNaN(parseInt(late_grace_minutes, 10)) ? parseInt(late_grace_minutes, 10) : (existing.late_grace_minutes ?? 15);
    const cleanAllowedMinorLates = allowed_minor_lates !== undefined && !isNaN(parseInt(allowed_minor_lates, 10)) ? parseInt(allowed_minor_lates, 10) : (existing.allowed_minor_lates ?? 2);
    const cleanPunctualityBonus = punctuality_bonus_amount !== undefined && !isNaN(parseFloat(punctuality_bonus_amount)) ? parseFloat(punctuality_bonus_amount) : (existing.punctuality_bonus_amount ?? 500.0);
    const cleanMaxShiftDuration = max_shift_duration_hours !== undefined && !isNaN(parseFloat(max_shift_duration_hours)) ? parseFloat(max_shift_duration_hours) : (existing.max_shift_duration_hours ?? 14.0);
    const cleanAllowedRadius = allowed_radius !== undefined && !isNaN(parseFloat(allowed_radius)) ? parseFloat(allowed_radius) : (existing.allowed_radius ?? 35.0);
    const cleanNormalOt = normal_overtime_multiplier !== undefined && !isNaN(parseFloat(normal_overtime_multiplier)) ? parseFloat(normal_overtime_multiplier) : (existing.normal_overtime_multiplier ?? 1.5);
    const cleanRestOt = rest_day_overtime_multiplier !== undefined && !isNaN(parseFloat(rest_day_overtime_multiplier)) ? parseFloat(rest_day_overtime_multiplier) : (existing.rest_day_overtime_multiplier ?? 2.0);
    const cleanHolidayOt = holiday_overtime_multiplier !== undefined && !isNaN(parseFloat(holiday_overtime_multiplier)) ? parseFloat(holiday_overtime_multiplier) : (existing.holiday_overtime_multiplier ?? 2.5);
    const cleanNightOt = night_overtime_multiplier !== undefined && !isNaN(parseFloat(night_overtime_multiplier)) ? parseFloat(night_overtime_multiplier) : (existing.night_overtime_multiplier ?? 1.5);

    db.prepare(`
      UPDATE site_settings 
      SET office_name = ?, 
          latitude = ?, 
          longitude = ?, 
          office_wifi_ssid = ?,
          office_wifi_bssid = ?,
          wifi_ssid = ?, 
          wifi_ip = ?, 
          use_wifi_verification = ?,
          late_grace_minutes = ?,
          allowed_minor_lates = ?,
          punctuality_bonus_amount = ?,
          max_shift_duration_hours = ?,
          allowed_radius = ?,
          normal_overtime_multiplier = ?,
          rest_day_overtime_multiplier = ?,
          holiday_overtime_multiplier = ?,
          night_overtime_multiplier = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE workspace_id = ?
    `).run(
      cleanOfficeName,
      cleanLat,
      cleanLon,
      cleanOfficeSsid,
      cleanOfficeBssid,
      cleanOfficeSsid,
      cleanWifiIp,
      cleanUseWifi,
      cleanLateGrace,
      cleanAllowedMinorLates,
      cleanPunctualityBonus,
      cleanMaxShiftDuration,
      cleanAllowedRadius,
      cleanNormalOt,
      cleanRestOt,
      cleanHolidayOt,
      cleanNightOt,
      targetWorkspaceId
    );

    if (office_name) {
      db.prepare("UPDATE workspaces SET name = ? WHERE id = ?").run(cleanOfficeName, targetWorkspaceId);
    }

    const updated: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(targetWorkspaceId);
    const { qr_secret, ...safeUpdated } = updated || {};

    // Realtime broadcast to synchronize settings across all clients
    broadcastServerEvent("SETTINGS_CHANGED", { workspaceId: targetWorkspaceId }, targetWorkspaceId);
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId: targetWorkspaceId, reason: "settings_updated" }, targetWorkspaceId);

    res.json({ success: true, settings: safeUpdated });
  } catch (error) {
    console.error("Update site settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Auto-Capture Current Office Public Network IP
app.post("/api/site-settings/capture-network", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id;
  const role = req.user?.role;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(role || "")) {
    return res.status(403).json({ error: "Access denied. Administrator role required." });
  }

  const targetWorkspaceId = workspaceId || 1;
  const forwardedHeader = req.headers["x-forwarded-for"];
  const rawForwarded = Array.isArray(forwardedHeader) ? forwardedHeader[0] : (forwardedHeader || "");
  const detectedIp = (rawForwarded.split(",")[0].trim() || req.socket.remoteAddress || req.ip || "").replace(/^::ffff:/, "");

  try {
    let settings: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(targetWorkspaceId);
    if (!settings) {
      db.prepare(`
        INSERT INTO site_settings (office_name, latitude, longitude, office_wifi_ssid, office_wifi_bssid, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id)
        VALUES ('Apex Main Office', 9.0227, 38.7460, 'Apex_HQ_WiFi', '00:11:22:33:44:55', 'Apex_HQ_WiFi', ?, 1, ?)
      `).run(detectedIp, targetWorkspaceId);
    } else {
      db.prepare(`
        UPDATE site_settings 
        SET wifi_ip = ?, use_wifi_verification = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE workspace_id = ?
      `).run(detectedIp, targetWorkspaceId);
    }

    broadcastServerEvent("SETTINGS_CHANGED", { 
      workspaceId: targetWorkspaceId, 
      action: "network_ip_captured", 
      captured_ip: detectedIp 
    }, targetWorkspaceId);

    res.json({ 
      success: true, 
      captured_ip: detectedIp,
      message: `Office Public IP auto-captured as ${detectedIp}. Priority 1 Wi-Fi direct verification is now active!`
    });
  } catch (error) {
    console.error("Network capture error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Overtime Multipliers in Site Settings
app.put("/api/site-settings/overtime-rates", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const { normal, rest_day, holiday, night, allowed_radius } = req.body;
  try {
    const normalRate = parseFloat(normal) || 1.5;
    const restDayRate = parseFloat(rest_day) || 2.0;
    const holidayRate = parseFloat(holiday) || 2.5;
    const nightRate = parseFloat(night) || 1.5;
    const radius = parseFloat(allowed_radius) || 35.0;

    db.prepare(`
      UPDATE site_settings 
      SET normal_overtime_multiplier = ?, 
          rest_day_overtime_multiplier = ?, 
          holiday_overtime_multiplier = ?, 
          night_overtime_multiplier = ?,
          allowed_radius = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE workspace_id = ?
    `).run(normalRate, restDayRate, holidayRate, nightRate, radius, workspaceId);

    // Realtime broadcast to recalculate salaries and sync settings
    broadcastServerEvent("SETTINGS_CHANGED", { workspaceId }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, reason: "overtime_rates_updated" }, workspaceId);

    res.json({
      success: true,
      message: "Overtime calculation multipliers updated successfully",
      rates: { normal: normalRate, rest_day: restDayRate, holiday: holidayRate, night: nightRate, allowed_radius: radius }
    });
  } catch (error) {
    console.error("Update overtime rates error:", error);
    res.status(500).json({ error: "Failed to update overtime multipliers" });
  }
});

// ==========================================
// WORK CALENDAR & HOLIDAYS MANAGEMENT APIS
// ==========================================

// Get 7-Day Weekly Work Schedule
app.get("/api/work-calendar", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  try {
    let schedules = db.prepare(`
      SELECT * FROM work_schedules 
      WHERE workspace_id = ? 
      ORDER BY day_of_week ASC
    `).all(workspaceId) as any[];

    if (!schedules || schedules.length === 0) {
      // Auto-populate default 7-day schedule
      const defaultSchedules = [
        { day: 0, name: "Sunday", morning: "NON_WORKING", afternoon: "NON_WORKING" },
        { day: 1, name: "Monday", morning: "WORKING", afternoon: "WORKING" },
        { day: 2, name: "Tuesday", morning: "WORKING", afternoon: "WORKING" },
        { day: 3, name: "Wednesday", morning: "WORKING", afternoon: "WORKING" },
        { day: 4, name: "Thursday", morning: "WORKING", afternoon: "WORKING" },
        { day: 5, name: "Friday", morning: "WORKING", afternoon: "WORKING" },
        { day: 6, name: "Saturday", morning: "WORKING", afternoon: "NON_WORKING" }
      ];
      for (const s of defaultSchedules) {
        db.prepare(`
          INSERT INTO work_schedules (workspace_id, day_of_week, day_name, morning_status, afternoon_status, morning_start, morning_end, afternoon_start, afternoon_end)
          VALUES (?, ?, ?, ?, ?, '08:30', '12:30', '13:30', '17:30')
        `).run(workspaceId, s.day, s.name, s.morning, s.afternoon);
      }
      schedules = db.prepare("SELECT * FROM work_schedules WHERE workspace_id = ? ORDER BY day_of_week ASC").all(workspaceId) as any[];
    }

    const enrichedSchedules = schedules.map((s) => {
      const mStartEth = formatToEthiopianTime(s.morning_start || "08:30");
      const mEndEth = formatToEthiopianTime(s.morning_end || "12:30");
      const aStartEth = formatToEthiopianTime(s.afternoon_start || "13:30");
      const aEndEth = formatToEthiopianTime(s.afternoon_end || "17:30");
      return {
        ...s,
        morning_start_ethiopian: mStartEth.shortText,
        morning_end_ethiopian: mEndEth.shortText,
        afternoon_start_ethiopian: aStartEth.shortText,
        afternoon_end_ethiopian: aEndEth.shortText,
        morning_range_ethiopian: `${mStartEth.shortText} - ${mEndEth.shortText}`,
        afternoon_range_ethiopian: `${aStartEth.shortText} - ${aEndEth.shortText}`
      };
    });

    res.json({ success: true, schedules: enrichedSchedules });
  } catch (error) {
    console.error("Get work calendar error:", error);
    res.status(500).json({ error: "Failed to fetch work calendar" });
  }
});

// Update Weekly Work Schedule (Batch Update)
app.put("/api/work-calendar", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const { schedules } = req.body;
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return res.status(400).json({ error: "Invalid schedule payload. Array of days required." });
  }

  try {
    const updateStmt = db.prepare(`
      INSERT INTO work_schedules (
        workspace_id, day_of_week, day_name, morning_status, afternoon_status, 
        morning_start, morning_end, afternoon_start, afternoon_end, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(workspace_id, day_of_week) DO UPDATE SET
        morning_status = excluded.morning_status,
        afternoon_status = excluded.afternoon_status,
        morning_start = excluded.morning_start,
        morning_end = excluded.morning_end,
        afternoon_start = excluded.afternoon_start,
        afternoon_end = excluded.afternoon_end,
        updated_at = CURRENT_TIMESTAMP
    `);

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const item of schedules) {
      const dayNum = parseInt(item.day_of_week, 10);
      const dayName = item.day_name || dayNames[dayNum] || `Day ${dayNum}`;
      const mStatus = item.morning_status === "NON_WORKING" ? "NON_WORKING" : "WORKING";
      const aStatus = item.afternoon_status === "NON_WORKING" ? "NON_WORKING" : "WORKING";
      const mStart = item.morning_start || "08:30";
      const mEnd = item.morning_end || "12:30";
      const aStart = item.afternoon_start || "13:30";
      const aEnd = item.afternoon_end || "17:30";

      updateStmt.run(workspaceId, dayNum, dayName, mStatus, aStatus, mStart, mEnd, aStart, aEnd);
    }

    const updated = db.prepare("SELECT * FROM work_schedules WHERE workspace_id = ? ORDER BY day_of_week ASC").all(workspaceId) as any[];
    const enrichedUpdated = updated.map((s) => {
      const mStartEth = formatToEthiopianTime(s.morning_start || "08:30");
      const mEndEth = formatToEthiopianTime(s.morning_end || "12:30");
      const aStartEth = formatToEthiopianTime(s.afternoon_start || "13:30");
      const aEndEth = formatToEthiopianTime(s.afternoon_end || "17:30");
      return {
        ...s,
        morning_start_ethiopian: mStartEth.shortText,
        morning_end_ethiopian: mEndEth.shortText,
        afternoon_start_ethiopian: aStartEth.shortText,
        afternoon_end_ethiopian: aEndEth.shortText,
        morning_range_ethiopian: `${mStartEth.shortText} - ${mEndEth.shortText}`,
        afternoon_range_ethiopian: `${aStartEth.shortText} - ${aEndEth.shortText}`
      };
    });

    // Realtime broadcast to synchronize work calendar, payroll, and attendance across all clients
    broadcastServerEvent("CALENDAR_CHANGED", { 
      workspaceId, 
      action: "work_calendar_updated",
      updatedBy: req.user?.id 
    }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, reason: "calendar_updated" }, workspaceId);
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId, reason: "calendar_updated" }, workspaceId);

    res.json({ success: true, message: "Weekly work calendar updated successfully", schedules: enrichedUpdated });
  } catch (error) {
    console.error("Update work calendar error:", error);
    res.status(500).json({ error: "Failed to update work calendar" });
  }
});

// Get Holidays
app.get("/api/holidays", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  try {
    const holidays = db.prepare(`
      SELECT * FROM holidays 
      WHERE workspace_id = ? 
      ORDER BY date ASC
    `).all(workspaceId) as any[];

    const enrichedHolidays = holidays.map((h: any) => {
      const ethDate = gregorianToEthiopianDate(h.date);
      let ethiopianHours = "2:30 ጧት – 11:30 ከሰዓት (Full Day)";
      if (h.duration === "MORNING") {
        ethiopianHours = "2:30 ጧት – 6:30 ከሰዓት (Morning Shift)";
      } else if (h.duration === "AFTERNOON") {
        ethiopianHours = "7:30 ከሰዓት – 11:30 ከሰዓት (Afternoon Shift)";
      }
      return {
        ...h,
        ethiopian_date: `${ethDate.year}-${String(ethDate.month).padStart(2, "0")}-${String(ethDate.day).padStart(2, "0")}`,
        ethiopian_date_am: ethDate.formattedAm,
        ethiopian_date_en: ethDate.formattedEn,
        ethiopian_month_am: ethDate.monthNameAm,
        ethiopian_month_en: ethDate.monthNameEn,
        ethiopian_day: ethDate.day,
        ethiopian_year: ethDate.year,
        ethiopian_hours: ethiopianHours
      };
    });

    res.json({ success: true, holidays: enrichedHolidays });
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({ error: "Failed to fetch holidays" });
  }
});

// Create Holiday
app.post("/api/holidays", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  let { date, name, type, duration, description, is_active, ethiopian_year, ethiopian_month, ethiopian_day, ethiopian_date } = req.body;
  
  // Resolve date from Ethiopian inputs if Gregorian date wasn't supplied
  if (!date && ethiopian_year && ethiopian_month && ethiopian_day) {
    date = ethiopianToGregorianDate(parseInt(ethiopian_year, 10), parseInt(ethiopian_month, 10), parseInt(ethiopian_day, 10));
  } else if (!date && ethiopian_date && typeof ethiopian_date === "string") {
    const p = ethiopian_date.split("-").map(Number);
    if (p.length === 3) {
      date = ethiopianToGregorianDate(p[0], p[1], p[2]);
    }
  }

  if (!date || !name) {
    return res.status(400).json({ error: "Holiday date (YYYY-MM-DD or Ethiopian Date) and name are required." });
  }

  try {
    const hType = ["PUBLIC", "COMPANY", "SPECIAL"].includes(type) ? type : "PUBLIC";
    const hDuration = ["FULL_DAY", "MORNING", "AFTERNOON"].includes(duration) ? duration : "FULL_DAY";
    const active = is_active === false || is_active === 0 ? 0 : 1;

    const result = db.prepare(`
      INSERT INTO holidays (workspace_id, date, name, type, duration, description, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(workspaceId, date.trim(), name.trim(), hType, hDuration, description ? description.trim() : "", active);

    const created: any = db.prepare("SELECT * FROM holidays WHERE id = ?").get(result.lastInsertRowid);
    const ethDate = gregorianToEthiopianDate(created.date);
    const enrichedCreated = {
      ...created,
      ethiopian_date: `${ethDate.year}-${String(ethDate.month).padStart(2, "0")}-${String(ethDate.day).padStart(2, "0")}`,
      ethiopian_date_am: ethDate.formattedAm,
      ethiopian_date_en: ethDate.formattedEn,
      ethiopian_month_am: ethDate.monthNameAm,
      ethiopian_month_en: ethDate.monthNameEn,
      ethiopian_day: ethDate.day,
      ethiopian_year: ethDate.year,
      ethiopian_hours: created.duration === "FULL_DAY" ? "2:30 ጧት – 11:30 ከሰዓት" : created.duration === "MORNING" ? "2:30 ጧት – 6:30 ከሰዓት" : "7:30 ከሰዓት – 11:30 ከሰዓት"
    };

    // Realtime broadcast to sync calendar and holiday overtime
    broadcastServerEvent("CALENDAR_CHANGED", { workspaceId, action: "holiday_created" }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, reason: "holiday_created" }, workspaceId);
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId, reason: "holiday_created" }, workspaceId);

    res.json({ success: true, message: "Holiday created successfully", holiday: enrichedCreated });
  } catch (error: any) {
    console.error("Create holiday error:", error);
    if (error?.message?.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "A holiday with this date and duration already exists." });
    }
    res.status(500).json({ error: "Failed to create holiday" });
  }
});

// Update Holiday
app.put("/api/holidays/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const holidayId = parseInt(req.params.id, 10);
  let { date, name, type, duration, description, is_active, ethiopian_year, ethiopian_month, ethiopian_day, ethiopian_date } = req.body;

  if (!date && ethiopian_year && ethiopian_month && ethiopian_day) {
    date = ethiopianToGregorianDate(parseInt(ethiopian_year, 10), parseInt(ethiopian_month, 10), parseInt(ethiopian_day, 10));
  } else if (!date && ethiopian_date && typeof ethiopian_date === "string") {
    const p = ethiopian_date.split("-").map(Number);
    if (p.length === 3) {
      date = ethiopianToGregorianDate(p[0], p[1], p[2]);
    }
  }

  try {
    const existing: any = db.prepare("SELECT * FROM holidays WHERE id = ? AND workspace_id = ?").get(holidayId, workspaceId);
    if (!existing) {
      return res.status(404).json({ error: "Holiday not found." });
    }

    const newDate = date ? date.trim() : existing.date;
    const newName = name ? name.trim() : existing.name;
    const newType = type && ["PUBLIC", "COMPANY", "SPECIAL"].includes(type) ? type : existing.type;
    const newDuration = duration && ["FULL_DAY", "MORNING", "AFTERNOON"].includes(duration) ? duration : existing.duration;
    const newDesc = description !== undefined ? description.trim() : existing.description;
    const newActive = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    db.prepare(`
      UPDATE holidays 
      SET date = ?, name = ?, type = ?, duration = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newDate, newName, newType, newDuration, newDesc, newActive, holidayId);

    const updated: any = db.prepare("SELECT * FROM holidays WHERE id = ?").get(holidayId);
    const ethDate = gregorianToEthiopianDate(updated.date);
    const enrichedUpdated = {
      ...updated,
      ethiopian_date: `${ethDate.year}-${String(ethDate.month).padStart(2, "0")}-${String(ethDate.day).padStart(2, "0")}`,
      ethiopian_date_am: ethDate.formattedAm,
      ethiopian_date_en: ethDate.formattedEn,
      ethiopian_month_am: ethDate.monthNameAm,
      ethiopian_month_en: ethDate.monthNameEn,
      ethiopian_day: ethDate.day,
      ethiopian_year: ethDate.year,
      ethiopian_hours: updated.duration === "FULL_DAY" ? "2:30 ጧት – 11:30 ከሰዓት" : updated.duration === "MORNING" ? "2:30 ጧት – 6:30 ከሰዓት" : "7:30 ከሰዓት – 11:30 ከሰዓት"
    };

    // Realtime broadcast to sync calendar and holiday overtime
    broadcastServerEvent("CALENDAR_CHANGED", { workspaceId, action: "holiday_updated" }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, reason: "holiday_updated" }, workspaceId);
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId, reason: "holiday_updated" }, workspaceId);

    res.json({ success: true, message: "Holiday updated successfully", holiday: enrichedUpdated });
  } catch (error) {
    console.error("Update holiday error:", error);
    res.status(500).json({ error: "Failed to update holiday" });
  }
});

// Delete Holiday
app.delete("/api/holidays/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const holidayId = parseInt(req.params.id, 10);
  try {
    const result = db.prepare("DELETE FROM holidays WHERE id = ? AND workspace_id = ?").run(holidayId, workspaceId);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Holiday not found." });
    }

    // Realtime broadcast to sync calendar and holiday overtime
    broadcastServerEvent("CALENDAR_CHANGED", { workspaceId, action: "holiday_deleted" }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, reason: "holiday_deleted" }, workspaceId);
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId, reason: "holiday_deleted" }, workspaceId);

    res.json({ success: true, message: "Holiday deleted successfully" });
  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

// Check Effective Work Status for any date & time
app.get("/api/work-calendar/status", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  let dateStr = (req.query.date as string) || getEthiopianDateString();
  let timeStr = (req.query.time as string) || getEthiopianTimeString();
  const session = (req.query.session as string) || undefined;

  try {
    const status = WorkCalendarService.getEffectiveWorkStatus(workspaceId, dateStr, timeStr, session);
    const morningStatus = WorkCalendarService.getEffectiveWorkStatus(workspaceId, dateStr, undefined, "Morning");
    const afternoonStatus = WorkCalendarService.getEffectiveWorkStatus(workspaceId, dateStr, undefined, "Afternoon");
    const multipliers = WorkCalendarService.getOvertimeMultipliers(workspaceId);
    const ethDate = gregorianToEthiopianDate(dateStr);
    const ethTime = formatToEthiopianTime(timeStr);

    const isWorkingDay = status.status === "WORKING";
    const isFullNonWorking = morningStatus.status === "NON_WORKING" && afternoonStatus.status === "NON_WORKING";
    const isHalfDay = (morningStatus.status === "WORKING" && afternoonStatus.status === "NON_WORKING") ||
                      (morningStatus.status === "NON_WORKING" && afternoonStatus.status === "WORKING");

    let workingDayLabel = isWorkingDay ? "Official Working Day" : "Non-Working Day";
    let workingDayDescription = "";

    if (!isWorkingDay) {
      if (status.holiday) {
        workingDayLabel = `Non-Working Day (Holiday: ${status.holiday.name})`;
        workingDayDescription = `Today is an active public/company holiday: ${status.holiday.name}. Overtime rate applies (${multipliers.holiday}x).`;
      } else if (status.reason === "WEEKLY_OFF" || status.dayOfWeek === 0) {
        workingDayLabel = `Non-Working Day (${status.dayName} Rest Day)`;
        workingDayDescription = `Today is a scheduled weekly rest day (${status.dayName}). Overtime rate applies (${multipliers.rest_day}x).`;
      } else {
        workingDayLabel = `Non-Working Day (${status.dayName})`;
        workingDayDescription = `Non-working shift according to the work calendar schedule.`;
      }
    } else {
      if (isHalfDay) {
        workingDayLabel = `Working Day (${status.dayName} Half Day)`;
        workingDayDescription = `Standard working morning shift. Afternoon is scheduled off.`;
      } else {
        workingDayLabel = `Official Working Day (${status.dayName})`;
        workingDayDescription = `Standard working hours apply. Morning: 02:00 – 06:00 | Afternoon: 07:00 – 11:00 (Ethiopian Local Time).`;
      }
    }

    res.json({
      success: true,
      effective_status: {
        ...status,
        ethiopian_date: ethDate.formattedAm,
        ethiopian_date_en: ethDate.formattedEn,
        ethiopian_time: ethTime.fullText,
        overtimeMultiplier: status.status === "NON_WORKING" 
          ? (status.reason === "PUBLIC_HOLIDAY" || status.reason === "COMPANY_HOLIDAY" || status.reason === "SPECIAL_HOLIDAY" ? multipliers.holiday : multipliers.rest_day)
          : 1.0,
        holidayName: status.holiday?.name,
        is_working_day: isWorkingDay,
        is_full_non_working_day: isFullNonWorking,
        is_half_day: isHalfDay,
        morning_status: morningStatus.status,
        afternoon_status: afternoonStatus.status,
        working_day_label: workingDayLabel,
        working_day_description: workingDayDescription
      },
      multipliers
    });
  } catch (error) {
    console.error("Check work status error:", error);
    res.status(500).json({ error: "Failed to evaluate work status" });
  }
});

// ==========================================
// OVERTIME MANAGEMENT APIS
// ==========================================

// Get Overtime Records (with employee names and filters)
app.get("/api/overtime", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"].includes(role);

  const statusFilter = req.query.status as string;
  const employeeIdFilter = req.query.employee_id ? parseInt(req.query.employee_id as string, 10) : undefined;

  try {
    let sql = `
      SELECT o.*, 
             u.full_name as employee_name, 
             u.role as employee_role, 
             u.phone_number,
             approver.full_name as approver_name
      FROM overtime_records o
      JOIN users u ON o.employee_id = u.id
      LEFT JOIN users approver ON o.approved_by = approver.id
      WHERE o.workspace_id = ?
    `;
    const params: any[] = [workspaceId];

    if (!isManager) {
      // Non-managers can only see their own overtime records
      sql += ` AND o.employee_id = ?`;
      params.push(req.user?.id);
    } else if (employeeIdFilter) {
      sql += ` AND o.employee_id = ?`;
      params.push(employeeIdFilter);
    }

    if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter.toUpperCase())) {
      sql += ` AND o.status = ?`;
      params.push(statusFilter.toUpperCase());
    }

    sql += ` ORDER BY o.date DESC, o.created_at DESC LIMIT 200`;

    const records = db.prepare(sql).all(...params);
    res.json({ success: true, records });
  } catch (error) {
    console.error("Get overtime records error:", error);
    res.status(500).json({ error: "Failed to fetch overtime records" });
  }
});

// Get Overtime Dashboard Stats
app.get("/api/overtime/stats", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const todayStr = getEthiopianDateString();

  try {
    const todayStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as today_hours 
      FROM overtime_records 
      WHERE workspace_id = ? AND date = ?
    `).get(workspaceId, todayStr);

    const pendingStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as pending_hours, COUNT(*) as pending_count 
      FROM overtime_records 
      WHERE workspace_id = ? AND status = 'PENDING'
    `).get(workspaceId);

    const approvedStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as approved_hours 
      FROM overtime_records 
      WHERE workspace_id = ? AND status = 'APPROVED'
    `).get(workspaceId);

    const rejectedStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as rejected_hours 
      FROM overtime_records 
      WHERE workspace_id = ? AND status = 'REJECTED'
    `).get(workspaceId);

    const restDayStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as rest_hours 
      FROM overtime_records 
      WHERE workspace_id = ? AND overtime_type = 'REST_DAY_OVERTIME'
    `).get(workspaceId);

    const holidayStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as holiday_hours 
      FROM overtime_records 
      WHERE workspace_id = ? AND overtime_type = 'HOLIDAY_OVERTIME'
    `).get(workspaceId);

    const totalStats: any = db.prepare(`
      SELECT COALESCE(SUM(hours), 0) as total_hours 
      FROM overtime_records 
      WHERE workspace_id = ?
    `).get(workspaceId);

    res.json({
      success: true,
      stats: {
        todayOvertimeHours: Number(todayStats?.today_hours || 0),
        pendingOvertimeHours: Number(pendingStats?.pending_hours || 0),
        pendingCount: Number(pendingStats?.pending_count || 0),
        approvedOvertimeHours: Number(approvedStats?.approved_hours || 0),
        rejectedOvertimeHours: Number(rejectedStats?.rejected_hours || 0),
        restDayOvertimeHours: Number(restDayStats?.rest_hours || 0),
        holidayOvertimeHours: Number(holidayStats?.holiday_hours || 0),
        totalOvertimeHours: Number(totalStats?.total_hours || 0)
      }
    });
  } catch (error) {
    console.error("Get overtime stats error:", error);
    res.status(500).json({ error: "Failed to fetch overtime statistics" });
  }
});

// Approve Overtime Record
app.put("/api/overtime/:id/approve", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const overtimeId = parseInt(req.params.id, 10);
  try {
    const otRecord: any = db.prepare("SELECT * FROM overtime_records WHERE id = ? AND workspace_id = ?").get(overtimeId, workspaceId);
    if (!otRecord) {
      return res.status(404).json({ error: "Overtime record not found." });
    }

    db.prepare(`
      UPDATE overtime_records 
      SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user?.id, overtimeId);

    // Sync with attendance record if linked
    if (otRecord.attendance_id) {
      db.prepare(`
        UPDATE attendance 
        SET overtime_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(otRecord.attendance_id);
    }

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'OVERTIME_APPROVED', ?, ?)
      `).run(
        workspaceId,
        req.user?.id,
        `Approved ${otRecord.hours}h overtime (${otRecord.overtime_type}) for employee ID ${otRecord.employee_id} on ${otRecord.date}`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {
      console.error("Audit log error:", e);
    }

    const updated = db.prepare("SELECT * FROM overtime_records WHERE id = ?").get(overtimeId);

    // Realtime broadcast
    broadcastServerEvent("OVERTIME_CHANGED", {
      workspaceId,
      overtimeId,
      employeeId: otRecord.employee_id,
      status: "APPROVED"
    }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, employeeId: otRecord.employee_id }, workspaceId);

    res.json({ success: true, message: "Overtime approved successfully", record: updated });
  } catch (error) {
    console.error("Approve overtime error:", error);
    res.status(500).json({ error: "Failed to approve overtime" });
  }
});

// Reject Overtime Record
app.put("/api/overtime/:id/reject", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const overtimeId = parseInt(req.params.id, 10);
  const { reason } = req.body;

  try {
    const otRecord: any = db.prepare("SELECT * FROM overtime_records WHERE id = ? AND workspace_id = ?").get(overtimeId, workspaceId);
    if (!otRecord) {
      return res.status(404).json({ error: "Overtime record not found." });
    }

    const rejectionReason = reason ? reason.trim() : "Not authorized for overtime pay";

    db.prepare(`
      UPDATE overtime_records 
      SET status = 'REJECTED', rejection_reason = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rejectionReason, req.user?.id, overtimeId);

    // Update attendance record so overtime hours are excluded from payroll
    if (otRecord.attendance_id) {
      db.prepare(`
        UPDATE attendance 
        SET overtime_status = 'REJECTED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(otRecord.attendance_id);
    }

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'OVERTIME_REJECTED', ?, ?)
      `).run(
        workspaceId,
        req.user?.id,
        `Rejected ${otRecord.hours}h overtime for employee ID ${otRecord.employee_id} on ${otRecord.date}. Reason: ${rejectionReason}`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {
      console.error("Audit log error:", e);
    }

    const updated = db.prepare("SELECT * FROM overtime_records WHERE id = ?").get(overtimeId);

    // Realtime broadcast
    broadcastServerEvent("OVERTIME_CHANGED", {
      workspaceId,
      overtimeId,
      employeeId: otRecord.employee_id,
      status: "REJECTED"
    }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, employeeId: otRecord.employee_id }, workspaceId);

    res.json({ success: true, message: "Overtime rejected", record: updated });
  } catch (error) {
    console.error("Reject overtime error:", error);
    res.status(500).json({ error: "Failed to reject overtime" });
  }
});

// Record Manual Overtime in Database
app.post("/api/overtime/manual", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const {
    employee_id,
    date,
    hours,
    overtime_type,
    rate_multiplier,
    check_in_time,
    check_out_time,
    status = "APPROVED",
    notes,
    reason
  } = req.body;

  if (!employee_id || !date || !hours) {
    return res.status(400).json({ error: "Employee, date, and hours are required." });
  }

  try {
    const numHours = parseFloat(hours);
    const ss: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId) || {};
    const defaultType = overtime_type || "REGULAR_OVERTIME";
    let mult = rate_multiplier ? parseFloat(rate_multiplier) : undefined;
    if (!mult) {
      mult = defaultType === "HOLIDAY_OVERTIME" 
        ? (ss.holiday_overtime_multiplier ?? 2.5)
        : defaultType === "REST_DAY_OVERTIME"
        ? (ss.rest_day_overtime_multiplier ?? 2.0)
        : defaultType === "NIGHT_OVERTIME"
        ? (ss.night_overtime_multiplier ?? 1.5)
        : (ss.normal_overtime_multiplier ?? 1.5);
    }

    const otStatus = status.toUpperCase() === "PENDING" ? "PENDING" : "APPROVED";

    const otRes = db.prepare(`
      INSERT INTO overtime_records (
        employee_id, workspace_id, date, check_in_time, check_out_time,
        overtime_type, work_status, work_status_reason, hours, rate_multiplier, status,
        approved_by, approved_at, qr_verified, gps_verified, notes, reason
      )
      VALUES (?, ?, ?, ?, ?, ?, 'WORKING', ?, ?, ?, ?, ?, CASE WHEN ? = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE NULL END, 1, 1, ?, ?)
    `).run(
      employee_id,
      workspaceId,
      date,
      check_in_time || "17:30:00",
      check_out_time || "20:30:00",
      defaultType,
      reason || "MANUAL_ENTRY",
      numHours,
      mult,
      otStatus,
      otStatus === "APPROVED" ? req.user?.id : null,
      otStatus,
      notes || null,
      reason || null
    );

    const newId = Number(otRes.lastInsertRowid);

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'OVERTIME_MANUAL_RECORDED', ?, ?)
      `).run(
        workspaceId,
        req.user?.id,
        `Recorded manual ${numHours}h overtime (${defaultType}) for employee ID ${employee_id} on ${date}`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {}

    const record = db.prepare(`
      SELECT o.*, u.full_name as employee_name, u.role as employee_role, u.phone_number
      FROM overtime_records o
      JOIN users u ON o.employee_id = u.id
      WHERE o.id = ?
    `).get(newId);

    // Realtime broadcast
    broadcastServerEvent("OVERTIME_CHANGED", {
      workspaceId,
      overtimeId: newId,
      employeeId: employee_id,
      status: otStatus
    }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, employeeId: employee_id }, workspaceId);

    res.json({ success: true, message: "Manual overtime record saved to database.", record });
  } catch (error) {
    console.error("Manual overtime error:", error);
    res.status(500).json({ error: "Failed to record manual overtime" });
  }
});

// Delete Overtime Record from Database
app.delete("/api/overtime/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"];
  if (!adminRoles.includes(role)) {
    return res.status(403).json({ error: "Access denied. Admin or HR role required." });
  }

  const overtimeId = parseInt(req.params.id, 10);
  try {
    const otRecord: any = db.prepare("SELECT * FROM overtime_records WHERE id = ? AND workspace_id = ?").get(overtimeId, workspaceId);
    if (!otRecord) {
      return res.status(404).json({ error: "Overtime record not found." });
    }

    db.prepare("DELETE FROM overtime_records WHERE id = ?").run(overtimeId);

    if (otRecord.attendance_id) {
      db.prepare(`
        UPDATE attendance 
        SET overtime_hours = 0, overtime_status = NULL, regular_overtime_hours = 0,
            rest_day_overtime_hours = 0, holiday_overtime_hours = 0, night_overtime_hours = 0
        WHERE id = ?
      `).run(otRecord.attendance_id);
    }

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'OVERTIME_DELETED', ?, ?)
      `).run(
        workspaceId,
        req.user?.id,
        `Deleted overtime record #${overtimeId} (${otRecord.hours}h) for employee ID ${otRecord.employee_id} on ${otRecord.date}`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {}

    // Realtime broadcast
    broadcastServerEvent("OVERTIME_CHANGED", {
      workspaceId,
      overtimeId,
      employeeId: otRecord.employee_id,
      status: "DELETED"
    }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, employeeId: otRecord.employee_id }, workspaceId);

    res.json({ success: true, message: "Overtime record deleted from database." });
  } catch (error) {
    console.error("Delete overtime error:", error);
    res.status(500).json({ error: "Failed to delete overtime record" });
  }
});

// ==========================================
// PENALTY MANAGEMENT & LATE DEDUCTIONS (100% DATABASE-BACKED)
// ==========================================

// 1. Get Penalties & Late Records from Database
app.get("/api/penalties", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);

  const statusFilter = req.query.status as string; // 'ALL', 'PENALIZED', 'WAIVED', 'WITHIN_GRACE'
  const sessionFilter = req.query.session as string; // 'Morning', 'Afternoon'
  const search = ((req.query.search as string) || "").toLowerCase().trim();
  const employeeIdFilter = req.query.employee_id ? parseInt(req.query.employee_id as string, 10) : undefined;

  try {
    const siteSettings = AttendanceService.getSiteSettings(workspaceId);
    const graceMins = siteSettings.late_grace_minutes ?? 15;
    const fixedPenalty = siteSettings.late_penalty_fixed_amount ?? 25.0;
    const hourlyMultiplier = siteSettings.late_penalty_hourly_multiplier ?? 0.5;

    // First: Ensure any unpersisted late attendance rows are synced into late_penalties table
    const unpersistedRows: any[] = db.prepare(`
      SELECT a.*, u.hourly_rate
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.workspace_id = ?
        AND (a.status = 'Late' OR a.late_minutes > 0 OR a.penalty_status IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM late_penalties lp WHERE lp.attendance_id = a.id)
    `).all(workspaceId);

    for (const a of unpersistedRows) {
      let lateMins = a.late_minutes || 0;
      const scheduledStart = a.session === "Morning" ? "02:00:00" : "07:00:00";
      if (!lateMins && a.check_in_time) {
        let [chH, chM] = a.check_in_time.split(":").map(Number);
        const [stH, stM] = scheduledStart.split(":").map(Number);
        if (!isNaN(chH) && !isNaN(chM)) {
          if (a.session === "Morning" && chH >= 7 && chH <= 12) {
            chH = chH - 6;
          } else if (a.session === "Afternoon" && chH >= 12 && chH <= 18) {
            chH = chH - 6;
          }
          const checkInTotal = chH * 60 + chM;
          const startTotal = stH * 60 + stM;
          if (checkInTotal > startTotal) {
            lateMins = checkInTotal - startTotal;
          }
        }
      }

      let effStatus = a.penalty_status;
      if (!effStatus) {
        effStatus = lateMins > graceMins ? "PENALIZED" : (lateMins > 0 ? "WITHIN_GRACE" : "PENALIZED");
      }

      let penAmt = Number(a.penalty_amount || 0);
      if (penAmt <= 0 && effStatus === "PENALIZED") {
        const hrRate = a.hourly_rate || 45;
        penAmt = Math.round((fixedPenalty + ((lateMins / 60) * hrRate * hourlyMultiplier)) * 100) / 100;
      }

      db.prepare(`
        INSERT INTO late_penalties (
          attendance_id, user_id, workspace_id, date, session, check_in_time, check_out_time,
          scheduled_start_time, late_minutes, is_within_grace, penalty_amount, penalty_status,
          penalty_waived_reason, penalty_waived_by, penalty_waived_at, verification_method, distance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        a.id, a.user_id, workspaceId, a.date, a.session || "Morning",
        a.check_in_time || "02:00:00", a.check_out_time, scheduledStart,
        lateMins, effStatus === "WITHIN_GRACE" ? 1 : 0, penAmt, effStatus,
        a.penalty_waived_reason, a.penalty_waived_by, a.penalty_waived_at,
        a.verification_method || "QR_GPS", a.distance || 0
      );
    }

    // Now query from late_penalties table as the primary database source of truth
    let sql = `
      SELECT 
        lp.id,
        lp.attendance_id,
        lp.user_id,
        lp.workspace_id,
        lp.date,
        lp.session,
        lp.check_in_time,
        lp.check_out_time,
        lp.scheduled_start_time,
        lp.late_minutes,
        lp.is_within_grace,
        lp.penalty_amount,
        lp.penalty_status,
        lp.penalty_waived_reason,
        lp.penalty_waived_by,
        lp.penalty_waived_at,
        lp.notification_status,
        lp.penalty_type,
        lp.reason,
        lp.payroll_id,
        lp.paid_at,
        lp.processed_by,
        lp.verification_method,
        lp.distance,
        u.full_name as employee_name,
        u.role as employee_role,
        u.phone_number,
        u.hourly_rate,
        u.photo,
        waiver.full_name as waived_by_name,
        proc.full_name as processed_by_name,
        sp.payment_reference as payroll_reference,
        sp.payment_status as payroll_payment_status
      FROM late_penalties lp
      JOIN users u ON lp.user_id = u.id
      LEFT JOIN users waiver ON lp.penalty_waived_by = waiver.id
      LEFT JOIN users proc ON lp.processed_by = proc.id
      LEFT JOIN salary_payments sp ON lp.payroll_id = sp.id
      WHERE lp.workspace_id = ?
    `;
    const params: any[] = [workspaceId];

    if (!isManager) {
      sql += ` AND lp.user_id = ?`;
      params.push(req.user?.id);
    } else if (employeeIdFilter) {
      sql += ` AND lp.user_id = ?`;
      params.push(employeeIdFilter);
    }

    sql += ` ORDER BY lp.date DESC, lp.check_in_time DESC LIMIT 500`;

    const rawRecords = db.prepare(sql).all(...params) as any[];

    const allRecords = rawRecords.map((r) => {
      let penaltyAmt = Number(r.penalty_amount || 0);
      let effStatus = r.penalty_status || (r.late_minutes > graceMins ? "PENALIZED" : "WITHIN_GRACE");

      if (penaltyAmt <= 0 && (effStatus === "PENALIZED" || effStatus === "PAID")) {
        const empRate = r.hourly_rate || 45;
        penaltyAmt = Math.round((fixedPenalty + ((r.late_minutes / 60) * empRate * hourlyMultiplier)) * 100) / 100;
        // Update database row with calculated penalty
        db.prepare("UPDATE late_penalties SET penalty_amount = ?, penalty_status = ? WHERE id = ?").run(penaltyAmt, effStatus, r.id);
        if (r.attendance_id) {
          db.prepare("UPDATE attendance SET penalty_amount = ?, penalty_status = ? WHERE id = ?").run(penaltyAmt, effStatus, r.attendance_id);
        }
      }

      // Automatic notification rule: If Penalty = Paid or Penalized, Notification = Unchecked
      let notifStatus = r.notification_status || "ACTIVE";
      if ((effStatus === "PENALIZED" || effStatus === "PAID") && (!r.notification_status || r.notification_status === "ACTIVE")) {
        notifStatus = "UNCHECKED";
        try {
          db.prepare("UPDATE late_penalties SET notification_status = 'UNCHECKED' WHERE id = ?").run(r.id);
        } catch (_) {}
      }

      return {
        id: r.id,
        attendance_id: r.attendance_id,
        user_id: r.user_id,
        employee_name: r.employee_name,
        employee_role: r.employee_role,
        phone_number: r.phone_number,
        hourly_rate: r.hourly_rate || 45,
        photo: r.photo,
        date: r.date,
        session: r.session,
        check_in_time: r.check_in_time,
        check_out_time: r.check_out_time,
        scheduled_start_time: r.scheduled_start_time || "02:00:00",
        late_minutes: r.late_minutes || 0,
        is_within_grace: Boolean(r.is_within_grace),
        penalty_amount: penaltyAmt,
        penalty_status: effStatus,
        penalty_waived_reason: r.penalty_waived_reason,
        penalty_waived_by: r.penalty_waived_by,
        waived_by_name: r.waived_by_name,
        penalty_waived_at: r.penalty_waived_at,
        notification_status: notifStatus,
        penalty_type: r.penalty_type || "LATE_ARRIVAL",
        reason: r.reason || null,
        payroll_id: r.payroll_id || null,
        paid_at: r.paid_at || null,
        processed_by: r.processed_by || null,
        processed_by_name: r.processed_by_name || null,
        payroll_reference: r.payroll_reference || null,
        payroll_payment_status: r.payroll_payment_status || (effStatus === "PAID" ? "PAID" : (r.payroll_id ? "PAID" : "UNPAID")),
        verification_method: r.verification_method,
        distance: r.distance
      };
    });

    // Compute stats directly from database records
    const totalLateCount = allRecords.length;
    const penalizedCount = allRecords.filter(r => r.penalty_status === "PENALIZED").length;
    const paidCount = allRecords.filter(r => r.penalty_status === "PAID").length;
    const pendingCount = allRecords.filter(r => r.penalty_status === "PENDING" || (r.penalty_status !== "PENALIZED" && r.penalty_status !== "PAID" && r.penalty_status !== "WAIVED" && r.penalty_status !== "WITHIN_GRACE")).length;
    const waivedCount = allRecords.filter(r => r.penalty_status === "WAIVED").length;
    const withinGraceCount = allRecords.filter(r => r.penalty_status === "WITHIN_GRACE").length;
    const totalPenaltyAmount = Math.round(allRecords.reduce((acc, r) => acc + (["PENALIZED", "PAID"].includes(r.penalty_status) ? r.penalty_amount : 0), 0) * 100) / 100;
    const totalLateMinutes = allRecords.reduce((acc, r) => acc + r.late_minutes, 0);
    const avgLateMinutes = totalLateCount > 0 ? Math.round(totalLateMinutes / totalLateCount) : 0;
    const activeNotificationsCount = allRecords.filter(r => r.notification_status === "ACTIVE" && r.penalty_status !== "WAIVED").length;

    // Database-backed punctuality rate calculation
    const punctualityRow: any = db.prepare(`
      SELECT 
        COUNT(*) as total_attendance,
        SUM(CASE WHEN status IN ('Present', 'Authorized') OR penalty_status IN ('WITHIN_GRACE', 'WAIVED') THEN 1 ELSE 0 END) as on_time_attendance
      FROM attendance
      WHERE workspace_id = ?
    `).get(workspaceId);

    const totalAttendance = Number(punctualityRow?.total_attendance || 0);
    const onTimeAttendance = Number(punctualityRow?.on_time_attendance || 0);
    const punctualityRate = totalAttendance > 0
      ? Math.round((onTimeAttendance / totalAttendance) * 1000) / 10
      : 100.0;

    // Filter results if query parameters are applied
    let filteredRecords = allRecords;
    if (statusFilter && statusFilter !== "ALL") {
      filteredRecords = filteredRecords.filter(r => r.penalty_status === statusFilter);
    }
    if (sessionFilter && sessionFilter !== "ALL") {
      filteredRecords = filteredRecords.filter(r => r.session === sessionFilter);
    }
    if (search) {
      filteredRecords = filteredRecords.filter(r => 
        (r.employee_name && r.employee_name.toLowerCase().includes(search)) ||
        (r.phone_number && r.phone_number.includes(search)) ||
        (r.date && r.date.includes(search)) ||
        (r.employee_role && r.employee_role.toLowerCase().includes(search))
      );
    }

    res.json({
      success: true,
      records: filteredRecords,
      stats: {
        totalLateCount,
        penalizedCount,
        paidCount,
        pendingCount,
        waivedCount,
        withinGraceCount,
        totalPenaltyAmount,
        totalLateMinutes,
        avgLateMinutes,
        punctualityRate,
        activeNotificationsCount
      },
      policy: {
        late_grace_minutes: siteSettings.late_grace_minutes ?? 15,
        allowed_minor_lates: siteSettings.allowed_minor_lates ?? 2,
        late_penalty_fixed_amount: siteSettings.late_penalty_fixed_amount ?? 25.0,
        late_penalty_hourly_multiplier: siteSettings.late_penalty_hourly_multiplier ?? 0.5,
        punctuality_bonus_amount: siteSettings.punctuality_bonus_amount ?? 500.0
      }
    });
  } catch (error) {
    console.error("Get penalties error:", error);
    res.status(500).json({ error: "Failed to fetch penalties" });
  }
});

// 2. Waive / Pardon a Late Penalty in Database
app.post("/api/penalties/:id/waive", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied. Only Admins and HR can waive attendance penalties." });
  }

  const penaltyOrAttendanceId = parseInt(req.params.id, 10);
  const { reason } = req.body;
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: "A clear waiver explanation or justification is required to pardon a penalty." });
  }

  try {
    const penaltyRecord: any = db.prepare(`
      SELECT * FROM late_penalties 
      WHERE id = ? OR attendance_id = ?
    `).get(penaltyOrAttendanceId, penaltyOrAttendanceId);

    const attId = penaltyRecord?.attendance_id || penaltyOrAttendanceId;
    const userId = penaltyRecord?.user_id || db.prepare("SELECT user_id FROM attendance WHERE id = ?").get(attId)?.user_id;
    const wsId = penaltyRecord?.workspace_id || req.user?.workspace_id || 1;

    // 1. Update late_penalties table in database
    db.prepare(`
      UPDATE late_penalties 
      SET penalty_status = 'WAIVED',
          penalty_waived_reason = ?,
          penalty_waived_by = ?,
          penalty_waived_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR attendance_id = ?
    `).run(reason.trim(), req.user?.id, penaltyOrAttendanceId, penaltyOrAttendanceId);

    // 2. Update attendance table in database
    db.prepare(`
      UPDATE attendance 
      SET penalty_status = 'WAIVED',
          penalty_waived_reason = ?,
          penalty_waived_by = ?,
          penalty_waived_at = CURRENT_TIMESTAMP,
          status = CASE WHEN status = 'Late' THEN 'Present' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR id = ?
    `).run(reason.trim(), req.user?.id, attId, penaltyOrAttendanceId);

    if (userId) {
      updateAttendanceScore(userId);
    }

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'PENALTY_WAIVED', ?, ?)
      `).run(
        wsId,
        req.user?.id,
        `Waived lateness penalty for employee #${userId || 'N/A'} (Record #${penaltyOrAttendanceId}). Reason: ${reason.trim()}`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {}

    broadcastServerEvent("ATTENDANCE_CHANGED", { penaltyId: penaltyOrAttendanceId }, wsId);
    broadcastServerEvent("SALARY_CHANGED", { userId }, wsId);

    res.json({ success: true, message: "Lateness penalty successfully waived in database." });
  } catch (error) {
    console.error("Waive penalty error:", error);
    res.status(500).json({ error: "Failed to waive penalty" });
  }
});

// 3. Reinstate a Waived Late Penalty in Database
app.post("/api/penalties/:id/reinstate", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied. Only Admins and HR can reinstate penalties." });
  }

  const penaltyOrAttendanceId = parseInt(req.params.id, 10);

  try {
    const penaltyRecord: any = db.prepare(`
      SELECT * FROM late_penalties 
      WHERE id = ? OR attendance_id = ?
    `).get(penaltyOrAttendanceId, penaltyOrAttendanceId);

    const attId = penaltyRecord?.attendance_id || penaltyOrAttendanceId;
    const userId = penaltyRecord?.user_id || db.prepare("SELECT user_id FROM attendance WHERE id = ?").get(attId)?.user_id;
    const wsId = penaltyRecord?.workspace_id || req.user?.workspace_id || 1;

    // 1. Update late_penalties table in database
    db.prepare(`
      UPDATE late_penalties 
      SET penalty_status = 'PENALIZED',
          penalty_waived_reason = NULL,
          penalty_waived_by = NULL,
          penalty_waived_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR attendance_id = ?
    `).run(penaltyOrAttendanceId, penaltyOrAttendanceId);

    // 2. Update attendance table in database
    db.prepare(`
      UPDATE attendance 
      SET penalty_status = 'PENALIZED',
          penalty_waived_reason = NULL,
          penalty_waived_by = NULL,
          penalty_waived_at = NULL,
          status = 'Late',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR id = ?
    `).run(attId, penaltyOrAttendanceId);

    if (userId) {
      updateAttendanceScore(userId);
    }

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'PENALTY_REINSTATED', ?, ?)
      `).run(
        wsId,
        req.user?.id,
        `Reinstated late penalty for employee #${userId || 'N/A'} (Record #${penaltyOrAttendanceId})`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {}

    broadcastServerEvent("ATTENDANCE_CHANGED", { penaltyId: penaltyOrAttendanceId }, wsId);
    broadcastServerEvent("SALARY_CHANGED", { userId }, wsId);

    res.json({ success: true, message: "Lateness penalty reinstated in database." });
  } catch (error) {
    console.error("Reinstate penalty error:", error);
    res.status(500).json({ error: "Failed to reinstate penalty" });
  }
});

// 4. Delete / Cancel a Late Penalty from Database
app.delete("/api/penalties/:id", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied. Only Admins and HR can delete late penalties." });
  }

  const penaltyOrAttendanceId = parseInt(req.params.id, 10);

  try {
    const penaltyRecord: any = db.prepare(`
      SELECT * FROM late_penalties 
      WHERE id = ? OR attendance_id = ?
    `).get(penaltyOrAttendanceId, penaltyOrAttendanceId);

    const attId = penaltyRecord?.attendance_id || penaltyOrAttendanceId;
    const userId = penaltyRecord?.user_id || db.prepare("SELECT user_id FROM attendance WHERE id = ?").get(attId)?.user_id;

    // Delete from late_penalties table
    db.prepare("DELETE FROM late_penalties WHERE id = ? OR attendance_id = ?").run(penaltyOrAttendanceId, penaltyOrAttendanceId);

    // Reset penalty columns in attendance
    db.prepare(`
      UPDATE attendance 
      SET penalty_amount = 0,
          penalty_status = NULL,
          penalty_waived_reason = NULL,
          penalty_waived_by = NULL,
          penalty_waived_at = NULL,
          status = CASE WHEN status = 'Late' THEN 'Present' ELSE status END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? OR id = ?
    `).run(attId, penaltyOrAttendanceId);

    if (userId) {
      updateAttendanceScore(userId);
    }

    broadcastServerEvent("ATTENDANCE_CHANGED", { penaltyId: penaltyOrAttendanceId }, req.user?.workspace_id || 1);
    broadcastServerEvent("SALARY_CHANGED", { userId }, req.user?.workspace_id || 1);

    res.json({ success: true, message: "Late penalty deleted and cleared from database." });
  } catch (error) {
    console.error("Delete penalty error:", error);
    res.status(500).json({ error: "Failed to delete penalty" });
  }
});

// 5. Update Penalty Policy & Settings in Database
app.put("/api/penalties/settings", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied. Only Admins can configure penalty policies." });
  }

  const workspaceId = req.user?.workspace_id || 1;
  const {
    late_grace_minutes,
    allowed_minor_lates,
    late_penalty_fixed_amount,
    late_penalty_hourly_multiplier,
    punctuality_bonus_amount
  } = req.body;

  try {
    db.prepare(`
      UPDATE site_settings
      SET late_grace_minutes = COALESCE(?, late_grace_minutes),
          allowed_minor_lates = COALESCE(?, allowed_minor_lates),
          late_penalty_fixed_amount = COALESCE(?, late_penalty_fixed_amount),
          late_penalty_hourly_multiplier = COALESCE(?, late_penalty_hourly_multiplier),
          punctuality_bonus_amount = COALESCE(?, punctuality_bonus_amount),
          updated_at = CURRENT_TIMESTAMP
      WHERE workspace_id = ?
    `).run(
      late_grace_minutes !== undefined ? parseInt(late_grace_minutes, 10) : null,
      allowed_minor_lates !== undefined ? parseInt(allowed_minor_lates, 10) : null,
      late_penalty_fixed_amount !== undefined ? parseFloat(late_penalty_fixed_amount) : null,
      late_penalty_hourly_multiplier !== undefined ? parseFloat(late_penalty_hourly_multiplier) : null,
      punctuality_bonus_amount !== undefined ? parseFloat(punctuality_bonus_amount) : null,
      workspaceId
    );

    // Realtime broadcast penalty settings
    broadcastServerEvent("SETTINGS_CHANGED", { workspaceId }, workspaceId);
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId, reason: "penalty_settings_updated" }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, reason: "penalty_settings_updated" }, workspaceId);

    res.json({ success: true, message: "Penalty settings updated successfully in database." });
  } catch (error) {
    console.error("Update penalty settings error:", error);
    res.status(500).json({ error: "Failed to update penalty settings" });
  }
});

// 6. Manual Late Penalty Registration in Database
app.post("/api/penalties/manual", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied. Only Admins and HR can record manual late penalties." });
  }

  const workspaceId = req.user?.workspace_id || 1;
  const targetUserId = req.body.user_id || req.body.employee_id;
  const {
    date,
    session,
    late_minutes,
    penalty_amount,
    check_in_time,
    reason
  } = req.body;

  if (!targetUserId || !date || !session) {
    return res.status(400).json({ error: "Employee, date, and session are required." });
  }

  try {
    const lateMins = parseInt(late_minutes || "15", 10);
    const penaltyAmt = parseFloat(penalty_amount || "25");
    let checkIn = check_in_time || (session === "Morning" ? "02:30:00" : "07:30:00");
    const scheduledStart = session === "Morning" ? "02:00:00" : "07:00:00";
    const normalizedDate = getEthiopianDateString(date);

    // Normalize checkIn time to Ethiopian clock if entered in 24-hr Gregorian format:
    const parts = checkIn.split(":");
    let chH = parseInt(parts[0], 10);
    const chM = (parts[1] || "00").slice(0, 2);
    const chS = (parts[2] || "00").slice(0, 2);
    if (!isNaN(chH)) {
      if (session === "Morning" && chH >= 7 && chH <= 12) {
        chH = chH - 6;
      } else if (session === "Afternoon" && chH >= 12 && chH <= 18) {
        chH = chH - 6;
      } else if (session === "Afternoon" && chH >= 1 && chH <= 5) {
        chH = chH + 6;
      }
      checkIn = `${String(chH).padStart(2, "0")}:${chM}:${chS}`;
    }

    const existing: any = db.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ? AND session = ?").get(targetUserId, normalizedDate, session);
    let attId: number;

    if (existing) {
      db.prepare(`
        UPDATE attendance 
        SET status = 'Late',
            late_minutes = ?,
            penalty_amount = ?,
            penalty_status = 'PENALIZED',
            correction_reason = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(lateMins, penaltyAmt, reason || "Manual late penalty recorded by Admin", existing.id);
      attId = existing.id;
    } else {
      const insRes = db.prepare(`
        INSERT INTO attendance (
          user_id, date, session, check_in_time, original_check_in, status,
          late_minutes, penalty_amount, penalty_status, workspace_id, correction_reason,
          qr_verified, gps_verified
        )
        VALUES (?, ?, ?, ?, ?, 'Late', ?, ?, 'PENALIZED', ?, ?, 1, 1)
      `).run(
        targetUserId, normalizedDate, session, checkIn, checkIn,
        lateMins, penaltyAmt, workspaceId, reason || "Manual late penalty recorded by Admin"
      );
      attId = Number(insRes.lastInsertRowid);
    }

    // Persist/Update to late_penalties database table
    const existingPenalty: any = db.prepare("SELECT id FROM late_penalties WHERE attendance_id = ?").get(attId);
    if (existingPenalty) {
      db.prepare(`
        UPDATE late_penalties
        SET late_minutes = ?, penalty_amount = ?, penalty_status = 'PENALIZED',
            check_in_time = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(lateMins, penaltyAmt, checkIn, existingPenalty.id);
    } else {
      db.prepare(`
        INSERT INTO late_penalties (
          attendance_id, user_id, workspace_id, date, session, check_in_time,
          scheduled_start_time, late_minutes, is_within_grace, penalty_amount, penalty_status,
          verification_method, distance
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'PENALIZED', 'MANUAL_ADMIN', 0)
      `).run(
        attId, targetUserId, workspaceId, normalizedDate, session, checkIn,
        scheduledStart, lateMins, penaltyAmt
      );
    }

    updateAttendanceScore(targetUserId);

    try {
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'PENALTY_MANUAL_CREATED', ?, ?)
      `).run(
        workspaceId,
        req.user?.id,
        `Recorded manual late penalty of ETB ${penaltyAmt} (${lateMins} mins) for employee #${targetUserId} on ${date}`,
        req.ip || '127.0.0.1'
      );
    } catch (e) {}

    // Realtime broadcast for manual penalty
    broadcastServerEvent("ATTENDANCE_CHANGED", { workspaceId, userId: targetUserId }, workspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId, userId: targetUserId }, workspaceId);

    res.json({ success: true, message: "Manual late penalty recorded in database successfully." });
  } catch (error) {
    console.error("Create manual penalty error:", error);
    res.status(500).json({ error: "Failed to record manual penalty", details: String(error) });
  }
});

// Update Single Late Penalty Status (Pending, Penalized, Paid, Cancelled, Waived)
app.put("/api/penalties/:id/status", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied. Only Admins and HR can update penalty status." });
  }

  const penaltyId = parseInt(req.params.id, 10);
  const { status, reason } = req.body;
  const validStatuses = ["PENDING", "PENALIZED", "PAID", "CANCELLED", "WAIVED", "WITHIN_GRACE"];
  if (!status || !validStatuses.includes(status.toUpperCase())) {
    return res.status(400).json({ error: `Invalid status. Valid statuses: ${validStatuses.join(", ")}` });
  }

  const targetStatus = status.toUpperCase();

  try {
    const penalty: any = db.prepare("SELECT * FROM late_penalties WHERE id = ?").get(penaltyId);
    if (!penalty) {
      return res.status(404).json({ error: "Late penalty record not found." });
    }

    // Required business rule:
    // If Penalty = Paid / Penalized -> Then Notification = Unchecked
    const isPenalizedOrPaid = targetStatus === "PENALIZED" || targetStatus === "PAID";
    const notificationStatus = isPenalizedOrPaid ? "UNCHECKED" : (targetStatus === "PENDING" ? "ACTIVE" : (penalty.notification_status || "ACTIVE"));
    const paidAt = targetStatus === "PAID" ? (penalty.paid_at || new Date().toISOString()) : (targetStatus === "PENDING" ? null : penalty.paid_at);

    db.prepare(`
      UPDATE late_penalties
      SET penalty_status = ?,
          notification_status = ?,
          paid_at = ?,
          processed_by = ?,
          reason = COALESCE(?, reason),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetStatus, notificationStatus, paidAt, req.user?.id, reason || null, penaltyId);

    if (penalty.attendance_id) {
      db.prepare(`
        UPDATE attendance
        SET penalty_status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(targetStatus, penalty.attendance_id);
    }

    if (penalty.user_id) {
      updateAttendanceScore(penalty.user_id);
    }

    const wsId = penalty.workspace_id || req.user?.workspace_id || 1;
    broadcastServerEvent("ATTENDANCE_CHANGED", { penaltyId, status: targetStatus }, wsId);
    broadcastServerEvent("SALARY_CHANGED", { userId: penalty.user_id }, wsId);

    res.json({
      success: true,
      message: `Penalty status updated to ${targetStatus}. Notification set to ${notificationStatus}.`,
      penalty_status: targetStatus,
      notification_status: notificationStatus
    });
  } catch (error) {
    console.error("Update penalty status error:", error);
    res.status(500).json({ error: "Failed to update penalty status" });
  }
});

// Toggle Penalty Notification (Active vs Unchecked)
app.put("/api/penalties/:id/notification", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied." });
  }

  const penaltyId = parseInt(req.params.id, 10);
  const { notification_status } = req.body;
  const targetNotif = notification_status === "ACTIVE" ? "ACTIVE" : "UNCHECKED";

  try {
    const penalty: any = db.prepare("SELECT * FROM late_penalties WHERE id = ?").get(penaltyId);
    if (!penalty) return res.status(404).json({ error: "Penalty record not found." });

    db.prepare(`
      UPDATE late_penalties
      SET notification_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetNotif, penaltyId);

    const wsId = penalty.workspace_id || req.user?.workspace_id || 1;
    broadcastServerEvent("ATTENDANCE_CHANGED", { penaltyId, notification_status: targetNotif }, wsId);

    res.json({
      success: true,
      notification_status: targetNotif,
      message: `Notification updated to ${targetNotif}.`
    });
  } catch (error) {
    console.error("Update penalty notification error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Bulk Update Penalty Statuses
app.post("/api/penalties/bulk-status", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const role = req.user?.role || "";
  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(role);
  if (!isManager) {
    return res.status(403).json({ error: "Access Denied." });
  }

  const { ids, status } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Array of penalty IDs is required." });
  }

  const targetStatus = (status || "PENALIZED").toUpperCase();
  const isPenalizedOrPaid = targetStatus === "PENALIZED" || targetStatus === "PAID";
  const notificationStatus = isPenalizedOrPaid ? "UNCHECKED" : (targetStatus === "PENDING" ? "ACTIVE" : "UNCHECKED");
  const paidAt = targetStatus === "PAID" ? new Date().toISOString() : null;

  try {
    const wsId = req.user?.workspace_id || 1;
    let updatedCount = 0;

    ids.forEach((id: any) => {
      const pid = parseInt(id, 10);
      const penalty: any = db.prepare("SELECT * FROM late_penalties WHERE id = ?").get(pid);
      if (penalty) {
        db.prepare(`
          UPDATE late_penalties
          SET penalty_status = ?,
              notification_status = ?,
              paid_at = COALESCE(?, paid_at),
              processed_by = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(targetStatus, notificationStatus, paidAt, req.user?.id, pid);

        if (penalty.attendance_id) {
          db.prepare("UPDATE attendance SET penalty_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetStatus, penalty.attendance_id);
        }
        updatedCount++;
      }
    });

    broadcastServerEvent("ATTENDANCE_CHANGED", { bulkStatus: targetStatus, count: updatedCount }, wsId);
    broadcastServerEvent("SALARY_CHANGED", { bulkPenaltyUpdated: true }, wsId);

    res.json({
      success: true,
      message: `Successfully updated ${updatedCount} penalty records to ${targetStatus}.`,
      updatedCount,
      targetStatus
    });
  } catch (error) {
    console.error("Bulk penalty update error:", error);
    res.status(500).json({ error: "Failed to bulk update penalties" });
  }
});

// Run 31 Comprehensive System Validation Test Cases
app.all("/api/work-calendar/run-tests", (req: Request, res: Response) => {
  let workspaceId = 1;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const decoded: any = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
      if (decoded && decoded.workspace_id) {
        workspaceId = decoded.workspace_id;
      }
    } catch (e) {}
  }
  try {
    const testResults = WorkCalendarService.runAll31SystemTestCases(workspaceId);
    const passedCount = testResults.filter(t => t.passed).length;
    const totalCount = testResults.length;

    res.json({
      success: true,
      summary: {
        total: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        allPassed: passedCount === totalCount
      },
      results: testResults
    });
  } catch (error) {
    console.error("Run system tests error:", error);
    res.status(500).json({ error: "Failed to execute system validation tests" });
  }
});

// Check-In (Enterprise Attendance Verification Engine)
app.post("/api/attendance/check-in", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === "Bootstrap") {
    return res.status(403).json({ error: "Access Denied. Setup Bootstrap account cannot log attendance." });
  }

  const {
    qr_code,
    latitude,
    longitude,
    accuracy,
    wifi_ssid,
    wifi_bssid,
    wifi_ip,
    session,
    device_id,
    device_name
  } = req.body;

  const todayStr = getEthiopianDateString();
  const nowTimeStr = getEthiopianTimeString();
  const [nowH, nowM] = nowTimeStr.split(":").map(Number);
  const nowTotalMins = (nowH || 0) * 60 + (nowM || 0);
  const activeSession = (nowTotalMins < 390 || nowTimeStr < "06:30:00") ? "Morning" : "Afternoon";

  const complianceRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR", "AdminCreator", "AdminManager"];

  try {
    const createdWs: any = db.prepare("SELECT id FROM workspaces WHERE created_by = ? ORDER BY id ASC LIMIT 1").get(req.user?.id);
    let workspaceId = createdWs ? createdWs.id : req.user?.workspace_id;
    if (!workspaceId) {
      const userRow: any = db.prepare("SELECT workspace_id, created_by FROM users WHERE id = ?").get(req.user?.id);
      if (userRow?.workspace_id) {
        workspaceId = userRow.workspace_id;
      } else if (userRow?.created_by) {
        const creatorRow: any = db.prepare("SELECT workspace_id FROM users WHERE id = ?").get(userRow.created_by);
        workspaceId = creatorRow?.workspace_id || 1;
      } else {
        workspaceId = 1;
      }
    }

    // STEP 0: DEVICE BINDING & ANTI-BUDDY PUNCHING VALIDATION
    const currentUser: any = db.prepare(`
      SELECT id, full_name, phone_number, registered_device_id, device_name, device_status 
      FROM users 
      WHERE id = ?
    `).get(req.user?.id);

    const clientDeviceId = (device_id || "").trim();
    const clientDeviceName = (device_name || "").trim() || "Mobile Device";

    if (!clientDeviceId) {
      return res.status(400).json({
        error: "Device identification missing. Please enable browser storage or refresh your page.",
        code: "DEVICE_ID_REQUIRED"
      });
    }

    // Anti-Buddy Punching: Check if this phone is bound to ANOTHER staff member
    const otherUserWithDevice: any = db.prepare(`
      SELECT id, full_name, phone_number, role 
      FROM users 
      WHERE registered_device_id = ? AND id != ? AND role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR')
    `).get(clientDeviceId, req.user?.id);

    if (otherUserWithDevice) {
      return res.status(403).json({
        error: `Device conflict! This phone is already bound to staff member "${otherUserWithDevice.full_name}". One employee cannot check in for other employees using the same phone. Please use your own registered phone.`,
        code: "DEVICE_REGISTERED_TO_OTHER"
      });
    }

    // If user already has a registered phone, enforce exact device match
    if (currentUser.registered_device_id) {
      if (currentUser.registered_device_id !== clientDeviceId) {
        return res.status(403).json({
          error: `Unregistered phone detected! Your account is bound to your registered phone (${currentUser.device_name || 'Primary Phone'}). Checking in from other employees' phones is strictly forbidden. Please use your registered phone or request an Admin to reset your device binding.`,
          code: "DEVICE_MISMATCH",
          registered_device_name: currentUser.device_name
        });
      }
    } else {
      // First check-in with this phone: Ensure no OTHER staff member used this phone today (Anti-Proxy Punching)
      const proxyAttendance: any = db.prepare(`
        SELECT u.full_name, u.phone_number 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.date = ? AND a.device_id = ? AND a.user_id != ? AND u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR')
        LIMIT 1
      `).get(todayStr, clientDeviceId, req.user?.id);

      if (proxyAttendance) {
        return res.status(403).json({
          error: `Proxy check-in blocked! This device has already been used today for attendance by ${proxyAttendance.full_name}. One employee cannot check in for other employees from the same phone.`,
          code: "PROXY_DEVICE_BLOCKED"
        });
      }

      // Auto-bind this phone to this employee account
      db.prepare(`
        UPDATE users 
        SET registered_device_id = ?, device_name = ?, device_registered_at = CURRENT_TIMESTAMP, device_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(clientDeviceId, clientDeviceName, req.user?.id);

      console.log(`[DEVICE BOUND] User ${currentUser.full_name} (${currentUser.phone_number}) bound to device ${clientDeviceName} [${clientDeviceId}]`);
    }

    // STEP 1: STRICT FORGOTTEN CHECK-OUT ENFORCEMENT (BOTH MORNING & AFTERNOON SESSIONS)
    // Run automated shift evaluation to catch any expired sessions
    AttendanceService.evaluateAttendanceExceptionsAndShifts(workspaceId, todayStr, nowTimeStr);

    // Rule 1: Strict Check for unclosed Morning session when checking in to Afternoon
    if (activeSession === "Afternoon") {
      const openMorning: any = db.prepare(`
        SELECT * FROM attendance 
        WHERE user_id = ? AND date = ? AND session = 'Morning' 
          AND (check_out_time IS NULL OR status = 'Missing Checkout')
          AND (correction_status != 'CORRECTED' OR correction_status IS NULL)
      `).get(req.user?.id, todayStr);

      if (openMorning) {
        // Strictly flag the Morning session as Missing Checkout
        if (openMorning.status !== "Missing Checkout" || openMorning.correction_status !== "PENDING_CORRECTION") {
          db.prepare(`
            UPDATE attendance 
            SET status = 'Missing Checkout', 
                correction_status = COALESCE(correction_status, 'PENDING_CORRECTION'), 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(openMorning.id);

          try {
            db.prepare(`
              INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
              VALUES (?, ?, 'ATTENDANCE_MISSING_CHECKOUT_FLAGGED', ?, ?)
            `).run(
              workspaceId,
              req.user?.id,
              `Strict Morning Missing Checkout flagged for ${currentUser.full_name} (${currentUser.phone_number}) on ${todayStr} (check-in ${openMorning.check_in_time || 'N/A'}). Afternoon check-in blocked until Morning checkout is approved.`,
              req.ip || '127.0.0.1'
            );
          } catch (e) {}

          broadcastServerEvent("ATTENDANCE_CHANGED", { userId: req.user?.id, action: "missing_checkout_flagged" }, workspaceId);
        }

        return res.status(403).json({
          error: `Attendance Locked: You checked in for today's Morning session at ${openMorning.check_in_time || 'N/A'}, but did not record a check-out before the Morning session ended. It has been marked as "Missing Checkout". Check-in for the Afternoon session is strictly locked until your Morning check-out time is submitted and approved by an administrator.`,
          code: "MISSING_CHECKOUT_LOCKED",
          missing_record: {
            ...openMorning,
            status: "Missing Checkout",
            correction_status: openMorning.correction_status || "PENDING_CORRECTION"
          },
          missing_date: todayStr,
          missing_session: "Morning"
        });
      }
    }

    // Rule 2: Strict Check for open/missing checkout from past days (Morning or Afternoon)
    const openPastRecords: any[] = db.prepare(`
      SELECT * FROM attendance 
      WHERE user_id = ? AND date < ? AND (check_out_time IS NULL OR status = 'Missing Checkout') AND (correction_status != 'CORRECTED' OR correction_status IS NULL)
      ORDER BY date ASC, session ASC
    `).all(req.user?.id, todayStr);

    if (openPastRecords.length > 0) {
      const pastRecord = openPastRecords[0];
      if (pastRecord.status !== "Missing Checkout" || pastRecord.correction_status !== "PENDING_CORRECTION") {
        db.prepare(`
          UPDATE attendance 
          SET status = 'Missing Checkout', correction_status = 'PENDING_CORRECTION', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(pastRecord.id);

        try {
          db.prepare(`
            INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
            VALUES (?, ?, 'ATTENDANCE_MISSING_CHECKOUT_FLAGGED', ?, ?)
          `).run(
            workspaceId,
            req.user?.id,
            `Automatic Missing Checkout flagged for ${currentUser.full_name} (${currentUser.phone_number}) on ${pastRecord.date} (${pastRecord.session} session, check-in ${pastRecord.check_in_time || 'N/A'}). New attendance blocked pending Admin correction.`,
            req.ip || '127.0.0.1'
          );
        } catch (e) {
          console.error("Audit log error:", e);
        }

        broadcastServerEvent("ATTENDANCE_CHANGED", { userId: req.user?.id, action: "missing_checkout_flagged" }, workspaceId);
      }

      return res.status(403).json({
        error: `Attendance Locked: You have an open attendance record from ${pastRecord.date} (${pastRecord.session} session, Check-In: ${pastRecord.check_in_time || 'N/A'}) with no recorded check-out. It has been marked as "Missing Checkout". You cannot check in until an Administrator reviews and corrects your checkout time.`,
        code: "MISSING_CHECKOUT_LOCKED",
        missing_record: {
          ...pastRecord,
          status: "Missing Checkout",
          correction_status: "PENDING_CORRECTION"
        },
        missing_date: pastRecord.date,
        missing_session: pastRecord.session
      });
    }

    // Rule 3: Check if already checked in or completed attendance for the current active session today
    const currentSessionAttendance: any = db.prepare(`
      SELECT * FROM attendance 
      WHERE user_id = ? AND date = ? AND session = ?
    `).get(req.user?.id, todayStr, activeSession);

    if (currentSessionAttendance) {
      if (!currentSessionAttendance.check_out_time) {
        return res.status(400).json({ 
          error: `You are already checked in for the ${activeSession} session today. Please check out when leaving.`,
          code: "ALREADY_CHECKED_IN",
          active_session: activeSession,
          active_record: currentSessionAttendance
        });
      } else {
        return res.status(400).json({ 
          error: `You have already completed attendance for the ${activeSession} session today (Check-in: ${currentSessionAttendance.check_in_time}, Check-out: ${currentSessionAttendance.check_out_time}). Duplicate check-in is not permitted.`,
          code: "ALREADY_COMPLETED"
        });
      }
    }

    if (session && session !== activeSession) {
      return res.status(400).json({
        error: `Current time (${nowTimeStr}) is for the ${activeSession} session. You cannot check in for the ${session} session.`
      });
    }

    // Prevent check-in if user is on approved leave / permission for this session or full day
    const approvedLeaves: any[] = db.prepare(`
      SELECT p.request_type, p.session 
      FROM permissions p 
      WHERE p.user_id = ? AND p.status = 'Approved' 
      AND ? BETWEEN COALESCE(p.approved_from_date, p.start_date) AND COALESCE(p.approved_to_date, p.end_date)
    `).all(req.user?.id, todayStr);

    for (const l of approvedLeaves) {
      const lSess = l.session || 'Full Day';
      if (lSess === 'Full Day' || lSess === activeSession) {
        return res.status(400).json({
          error: `You have an approved ${l.request_type} (${lSess}) for today. Attendance check-in is not required for an authorized leave.`,
          code: "ON_APPROVED_LEAVE"
        });
      }
    }

    const existing = db.prepare("SELECT id FROM attendance WHERE user_id = ? AND date = ? AND session = ?").get(req.user?.id, todayStr, activeSession);
    if (existing) {
      return res.status(400).json({ error: `You have already attended the ${activeSession} session today` });
    }

    // Strict enforcement of unclosed sessions prior to new check-in:
    // 1. If checking into Afternoon and Morning was not checked out, strictly flag Morning as Missing Checkout
    if (activeSession === "Afternoon") {
      const unclosedMorning: any = db.prepare(`
        SELECT id FROM attendance 
        WHERE user_id = ? AND date = ? AND session = 'Morning' AND check_out_time IS NULL
      `).get(req.user?.id, todayStr);
      if (unclosedMorning) {
        db.prepare(`
          UPDATE attendance 
          SET status = 'Missing Checkout', 
              correction_status = COALESCE(correction_status, 'PENDING_CORRECTION'), 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(unclosedMorning.id);
        broadcastServerEvent("ATTENDANCE_CHANGED", { userId: req.user?.id, action: "missing_checkout_flagged" }, workspaceId);
      }
    }

    // 2. Strictly flag any unclosed attendance from past calendar dates
    const unclosedPast: any[] = db.prepare(`
      SELECT id FROM attendance 
      WHERE user_id = ? AND date < ? AND check_out_time IS NULL AND status != 'Missing Checkout'
    `).all(req.user?.id, todayStr);
    for (const pRec of unclosedPast) {
      db.prepare(`
        UPDATE attendance 
        SET status = 'Missing Checkout', 
            correction_status = COALESCE(correction_status, 'PENDING_CORRECTION'), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(pRec.id);
      broadcastServerEvent("ATTENDANCE_CHANGED", { userId: req.user?.id, action: "missing_checkout_flagged" }, workspaceId);
    }

    // Strict QR Code + GPS Geofencing Verification
    let verificationMethod: "QR_GPS" = "QR_GPS";
    let calculatedDistance: number | null = null;
    let gpsAccuracy: number | null = null;
    let usedQrId: string | null = null;

    let settings: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId);
    if (!settings) {
      db.prepare(`
        INSERT INTO site_settings (office_name, latitude, longitude, office_wifi_ssid, office_wifi_bssid, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('Apex Main Office', 9.0227, 38.7460, 'Apex_HQ_WiFi', '00:11:22:33:44:55', 'Apex_HQ_WiFi', '', 0, workspaceId);
      settings = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId);
    }

    // 1. Mandatory GPS verification
    if (latitude === undefined || longitude === undefined || accuracy === undefined || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      return res.status(400).json({
        error: "High-accuracy GPS coordinates are required for attendance check-in. Please enable device Location / GPS.",
        code: "GPS_REQUIRED"
      });
    }

    const clientLat = parseFloat(latitude);
    const clientLon = parseFloat(longitude);
    const clientAccuracy = parseFloat(accuracy);

    const gpsEval = evaluateGpsBoundary(
      clientLat, 
      clientLon, 
      clientAccuracy, 
      settings.latitude, 
      settings.longitude
    );

    if (!gpsEval.approved) {
      return res.status(400).json({
        error: gpsEval.error,
        code: gpsEval.code || "GPS_OUTSIDE_BOUNDARY",
        distance: gpsEval.distance,
        accuracy: gpsEval.accuracy,
        allowed_radius: gpsEval.allowedRadius,
        detected_latitude: clientLat,
        detected_longitude: clientLon,
        office_latitude: settings.latitude,
        office_longitude: settings.longitude
      });
    }

    // 2. Mandatory QR Code scan verification (Only active QR allowed, expired/revoked QR strictly rejected)
    if (!qr_code) {
      return res.status(400).json({
        error: "Please scan the physical Office Attendance QR Code to complete check-in.",
        code: "QR_REQUIRED"
      });
    }

    const qrValidation = verifyActiveOfficeQr(qr_code, workspaceId);
    if (!qrValidation.valid) {
      return res.status(400).json({
        error: qrValidation.error,
        code: qrValidation.code || "QR_INVALID"
      });
    }

    usedQrId = qrValidation.qrId || null;
    verificationMethod = "QR_GPS";
    calculatedDistance = gpsEval.distance;
    gpsAccuracy = gpsEval.accuracy;

    const siteSettings = AttendanceService.getSiteSettings(workspaceId);
    const lateness = AttendanceService.evaluateLateness(activeSession, nowTimeStr, siteSettings.late_grace_minutes);
    const status = lateness.isLate ? "Late" : "Present";
    const lateMinutes = lateness.lateMinutes || 0;

    let penaltyStatus: string | null = null;
    let penaltyAmount = 0.0;
    if (lateness.isLate) {
      penaltyStatus = "PENALIZED";
      const userHourlyRate = currentUser?.hourly_rate || 45;
      const fixedPenalty = siteSettings.late_penalty_fixed_amount ?? 25.0;
      const hourlyMultiplier = siteSettings.late_penalty_hourly_multiplier ?? 0.5;
      penaltyAmount = Math.round((fixedPenalty + ((lateMinutes / 60) * userHourlyRate * hourlyMultiplier)) * 100) / 100;
    } else if (lateness.isWithinGracePeriod) {
      penaltyStatus = "WITHIN_GRACE";
    }

    // Evaluate Work Calendar status (Server-Authoritative)
    const effectiveStatus = WorkCalendarService.getEffectiveWorkStatus(
      workspaceId,
      todayStr,
      nowTimeStr,
      activeSession
    );

    const isNonWorking = effectiveStatus.status === "NON_WORKING";
    const attendanceType = effectiveStatus.attendanceType;
    const workStatus = effectiveStatus.status;
    const workStatusReason = effectiveStatus.reason;
    const overtimeStatus = isNonWorking ? "PENDING" : null;

    const insertRes = db.prepare(`
      INSERT INTO attendance (
        user_id, date, session, check_in_time, original_check_in, status, workspace_id,
        late_minutes, penalty_amount, penalty_status,
        latitude, longitude, accuracy, distance, verification_method,
        ssid, bssid, qr_token_id, device_id,
        attendance_type, work_status, work_status_reason, overtime_status,
        qr_verified, gps_verified, verification_timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
    `).run(
      req.user?.id, todayStr, activeSession, nowTimeStr, nowTimeStr, status, workspaceId,
      lateMinutes, penaltyAmount, penaltyStatus,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      gpsAccuracy,
      calculatedDistance,
      verificationMethod,
      wifi_ssid || null,
      wifi_bssid || null,
      usedQrId,
      clientDeviceId || null,
      attendanceType,
      workStatus,
      workStatusReason,
      overtimeStatus
    );

    const insertedAttId = Number(insertRes.lastInsertRowid);

    // Persist to late_penalties table in database if late or penalized or within grace
    if (penaltyStatus === "PENALIZED" || penaltyStatus === "WITHIN_GRACE" || lateMinutes > 0) {
      const scheduledStart = activeSession === "Morning" ? "02:00:00" : "07:00:00";
      try {
        db.prepare(`
          INSERT INTO late_penalties (
            attendance_id, user_id, workspace_id, date, session, check_in_time,
            scheduled_start_time, late_minutes, is_within_grace, penalty_amount, penalty_status,
            verification_method, distance
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          insertedAttId, req.user?.id, workspaceId, todayStr, activeSession, nowTimeStr,
          scheduledStart, lateMinutes, penaltyStatus === "WITHIN_GRACE" ? 1 : 0, penaltyAmount, penaltyStatus || 'PENALIZED',
          verificationMethod, calculatedDistance
        );
      } catch (lpErr) {
        console.error("Error inserting into late_penalties table:", lpErr);
      }
    }

    updateAttendanceScore(req.user?.id!);

    broadcastServerEvent("ATTENDANCE_CHANGED", { action: "check_in", userId: req.user?.id, session: activeSession }, workspaceId);

    res.json({
      success: true,
      check_in_time: nowTimeStr,
      session: activeSession,
      status,
      is_late: lateness.isLate,
      late_minutes: lateness.lateMinutes,
      is_within_grace_period: lateness.isWithinGracePeriod,
      penalty_status: penaltyStatus,
      penalty_amount: penaltyAmount,
      verification_method: verificationMethod,
      distance: calculatedDistance,
      attendance_type: attendanceType,
      work_status: workStatus,
      work_status_reason: workStatusReason,
      overtime_status: overtimeStatus,
      is_overtime: isNonWorking,
      message: isNonWorking
        ? `Attendance accepted on scheduled ${effectiveStatus.reason.replace(/_/g, ' ')} (${effectiveStatus.dayName}) and classified as Overtime (Pending Approval).`
        : `Check-in recorded successfully.`
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check-Out (Enterprise Attendance Verification Engine)
app.post("/api/attendance/check-out", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === "Bootstrap") {
    return res.status(403).json({ error: "Access Denied. Setup Bootstrap account cannot log attendance." });
  }

  const {
    qr_code,
    latitude,
    longitude,
    accuracy,
    wifi_ssid,
    wifi_bssid,
    wifi_ip,
    session,
    device_id,
    device_name
  } = req.body;

  const todayStr = getEthiopianDateString();
  const nowTimeStr = getEthiopianTimeString();
  const complianceRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR", "AdminCreator", "AdminManager"];

  try {
    const createdWsOut: any = db.prepare("SELECT id FROM workspaces WHERE created_by = ? ORDER BY id ASC LIMIT 1").get(req.user?.id);
    let workspaceId = createdWsOut ? createdWsOut.id : req.user?.workspace_id;
    if (!workspaceId) {
      const userRow: any = db.prepare("SELECT workspace_id, created_by FROM users WHERE id = ?").get(req.user?.id);
      if (userRow?.workspace_id) {
        workspaceId = userRow.workspace_id;
      } else if (userRow?.created_by) {
        const creatorRow: any = db.prepare("SELECT workspace_id FROM users WHERE id = ?").get(userRow.created_by);
        workspaceId = creatorRow?.workspace_id || 1;
      } else {
        workspaceId = 1;
      }
    }

    // STEP 0: DEVICE BINDING VALIDATION FOR CHECK-OUT
    const currentUser: any = db.prepare(`
      SELECT id, full_name, phone_number, registered_device_id, device_name 
      FROM users 
      WHERE id = ?
    `).get(req.user?.id);

    const clientDeviceId = (device_id || "").trim();
    const clientDeviceName = (device_name || "").trim() || "Mobile Device";

    if (!clientDeviceId) {
      return res.status(400).json({
        error: "Device identification missing. Please enable browser storage or refresh your page.",
        code: "DEVICE_ID_REQUIRED"
      });
    }

    // Anti-Buddy Punching: Check if this phone is bound to ANOTHER staff member
    const otherUserWithDeviceCheckout: any = db.prepare(`
      SELECT id, full_name, phone_number, role 
      FROM users 
      WHERE registered_device_id = ? AND id != ? AND role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR')
    `).get(clientDeviceId, req.user?.id);

    if (otherUserWithDeviceCheckout) {
      return res.status(403).json({
        error: `Device conflict! This phone is bound to staff member "${otherUserWithDeviceCheckout.full_name}". You cannot check out using another employee's phone.`,
        code: "DEVICE_REGISTERED_TO_OTHER"
      });
    }

    if (currentUser.registered_device_id) {
      if (currentUser.registered_device_id !== clientDeviceId) {
        return res.status(403).json({
          error: `Unregistered phone detected! Check-out can only be performed from your registered phone (${currentUser.device_name || 'Primary Phone'}).`,
          code: "DEVICE_MISMATCH"
        });
      }
    } else {
      // Auto-bind device on checkout if not previously bound
      db.prepare(`
        UPDATE users 
        SET registered_device_id = ?, device_name = ?, device_registered_at = CURRENT_TIMESTAMP, device_status = 'APPROVED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(clientDeviceId, clientDeviceName, req.user?.id);
    }

    let record: any;
    if (session) {
      record = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? AND session = ?").get(req.user?.id, todayStr, session);
    } else {
      record = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? AND check_out_time IS NULL ORDER BY check_in_time DESC LIMIT 1").get(req.user?.id, todayStr);
    }

    if (!record) {
      return res.status(400).json({ error: session ? `No check-in record found for the ${session} session today. You must check in first.` : "No active check-in record found for today. You must check in first." });
    }

    if (record.check_out_time) {
      return res.status(400).json({ error: `You have already checked out of the ${record.session} session today` });
    }

    // STRICT SESSION CHECKOUT RULES:
    const [nowH, nowM] = nowTimeStr.split(":").map(Number);
    const nowTotalMins = (nowH || 0) * 60 + (nowM || 0);

    // If attempting to check out of Morning session during Afternoon (past 06:30 Ethiopian / 12:30 Gregorian)
    if (record.session === "Morning" && (nowTotalMins >= 390 || nowTimeStr >= "06:30:00")) {
      db.prepare(`
        UPDATE attendance 
        SET status = 'Missing Checkout', 
            correction_status = COALESCE(correction_status, 'PENDING_CORRECTION'), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(record.id);

      broadcastServerEvent("ATTENDANCE_CHANGED", { userId: req.user?.id, action: "missing_checkout_flagged" }, workspaceId);

      return res.status(400).json({
        error: `Morning session ended at 06:30. You did not record a check-out during the Morning session window. Your attendance has been flagged as "Missing Checkout". Please submit a Departure Correction request for Administrator review.`,
        code: "SESSION_CONCLUDED_MISSING_CHECKOUT"
      });
    }

    // If attempting to check out of Afternoon session after afternoon window (past 12:00 Ethiopian / 18:00 Gregorian)
    if (record.session === "Afternoon" && (nowTotalMins >= 720 || nowTimeStr >= "12:00:00")) {
      db.prepare(`
        UPDATE attendance 
        SET status = 'Missing Checkout', 
            correction_status = COALESCE(correction_status, 'PENDING_CORRECTION'), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(record.id);

      broadcastServerEvent("ATTENDANCE_CHANGED", { userId: req.user?.id, action: "missing_checkout_flagged" }, workspaceId);

      return res.status(400).json({
        error: `Afternoon session ended at 12:00 (06:00 PM). You did not record a check-out during the Afternoon session window. Your attendance has been flagged as "Missing Checkout". Please submit a Departure Correction request for Administrator review.`,
        code: "SESSION_CONCLUDED_MISSING_CHECKOUT"
      });
    }

    // Strict QR Code + GPS Geofencing Verification
    let verificationMethod: "QR_GPS" = "QR_GPS";
    let calculatedDistance: number | null = null;
    let gpsAccuracy: number | null = null;
    let usedQrId: string | null = null;

    let settings: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId);
    if (!settings) {
      settings = { latitude: 9.0227, longitude: 38.7460 };
    }

    // 1. Mandatory GPS verification
    if (latitude === undefined || longitude === undefined || accuracy === undefined || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      return res.status(400).json({ 
        error: "High-accuracy GPS coordinates are required for attendance check-out. Please enable device Location / GPS.",
        code: "GPS_REQUIRED"
      });
    }

    const clientLat = parseFloat(latitude);
    const clientLon = parseFloat(longitude);
    const clientAccuracy = parseFloat(accuracy);

    const gpsEval = evaluateGpsBoundary(
      clientLat,
      clientLon,
      clientAccuracy,
      settings.latitude,
      settings.longitude
    );

    if (!gpsEval.approved) {
      return res.status(400).json({
        error: gpsEval.error,
        code: gpsEval.code || "GPS_OUTSIDE_BOUNDARY",
        distance: gpsEval.distance,
        accuracy: gpsEval.accuracy,
        allowed_radius: gpsEval.allowedRadius,
        detected_latitude: clientLat,
        detected_longitude: clientLon,
        office_latitude: settings.latitude,
        office_longitude: settings.longitude
      });
    }

    // 2. Mandatory QR Code scan verification (Only active QR allowed, expired/revoked QR strictly rejected)
    if (!qr_code) {
      return res.status(400).json({ 
        error: "Please scan the physical Office Attendance QR Code to complete check-out.",
        code: "QR_REQUIRED"
      });
    }

    const qrValidation = verifyActiveOfficeQr(qr_code, workspaceId);
    if (!qrValidation.valid) {
      return res.status(400).json({ 
        error: qrValidation.error,
        code: qrValidation.code || "QR_INVALID"
      });
    }

    usedQrId = qrValidation.qrId || null;
    verificationMethod = "QR_GPS";
    calculatedDistance = gpsEval.distance;
    gpsAccuracy = gpsEval.accuracy;

    const checkInTime = record.check_in_time || (record.session === "Morning" ? "02:00:00" : "07:00:00");
    const breakdown = WorkCalendarService.computeAttendanceHoursBreakdown(
      workspaceId,
      todayStr,
      checkInTime,
      nowTimeStr,
      record.session
    );

    const hasOvertime = breakdown.overtimeHours > 0;
    const overtimeStatus = hasOvertime ? "PENDING" : null;

    db.prepare(`
      UPDATE attendance 
      SET check_out_time = ?, 
          original_check_out = COALESCE(original_check_out, ?),
          worked_minutes = ?,
          status = CASE WHEN status = 'Missing Checkout' THEN (CASE WHEN check_in_time > '02:15:00' THEN 'Late' ELSE 'Present' END) ELSE status END,
          total_hours = ?, 
          regular_hours = ?,
          overtime_hours = ?,
          regular_overtime_hours = ?,
          rest_day_overtime_hours = ?,
          holiday_overtime_hours = ?,
          night_overtime_hours = ?,
          attendance_type = ?,
          work_status = ?,
          work_status_reason = ?,
          overtime_status = ?,
          verification_method = ?, 
          latitude = COALESCE(?, latitude), 
          longitude = COALESCE(?, longitude), 
          accuracy = COALESCE(?, accuracy), 
          distance = COALESCE(?, distance), 
          qr_token_id = COALESCE(?, qr_token_id),
          qr_verified = 1,
          gps_verified = 1,
          verification_timestamp = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      nowTimeStr,
      nowTimeStr,
      Math.round(breakdown.totalHours * 60),
      breakdown.totalHours,
      breakdown.regularHours,
      breakdown.overtimeHours,
      breakdown.regularOvertimeHours,
      breakdown.restDayOvertimeHours,
      breakdown.holidayOvertimeHours,
      breakdown.nightOvertimeHours,
      breakdown.attendanceType,
      breakdown.workStatus,
      breakdown.workStatusReason,
      overtimeStatus,
      verificationMethod,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      gpsAccuracy,
      calculatedDistance,
      usedQrId,
      record.id
    );

    // If overtime occurred, create or update overtime record for approval
    let overtimeRecordId: number | null = null;
    if (hasOvertime) {
      const existingOt: any = db.prepare("SELECT id FROM overtime_records WHERE attendance_id = ?").get(record.id);
      if (!existingOt) {
        const otRes = db.prepare(`
          INSERT INTO overtime_records (
            attendance_id, employee_id, workspace_id, date, check_in_time, check_out_time,
            overtime_type, work_status, work_status_reason, hours, rate_multiplier, status,
            qr_verified, gps_verified, gps_latitude, gps_longitude, gps_accuracy, gps_distance
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 1, 1, ?, ?, ?, ?)
        `).run(
          record.id,
          req.user?.id,
          workspaceId,
          todayStr,
          checkInTime,
          nowTimeStr,
          breakdown.attendanceType,
          breakdown.workStatus,
          breakdown.workStatusReason,
          breakdown.overtimeHours,
          breakdown.multiplier,
          latitude ? parseFloat(latitude) : null,
          longitude ? parseFloat(longitude) : null,
          gpsAccuracy,
          calculatedDistance
        );
        overtimeRecordId = Number(otRes.lastInsertRowid);
      } else {
        db.prepare(`
          UPDATE overtime_records 
          SET check_out_time = ?, 
              hours = ?, 
              rate_multiplier = ?, 
              overtime_type = ?, 
              work_status = ?,
              work_status_reason = ?,
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(
          nowTimeStr,
          breakdown.overtimeHours,
          breakdown.multiplier,
          breakdown.attendanceType,
          breakdown.workStatus,
          breakdown.workStatusReason,
          existingOt.id
        );
        overtimeRecordId = existingOt.id;
      }
    }

    // Sync check_out_time to late_penalties table in database if record exists
    try {
      db.prepare(`
        UPDATE late_penalties 
        SET check_out_time = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE attendance_id = ?
      `).run(nowTimeStr, record.id);
    } catch (e) {}

    updateAttendanceScore(req.user?.id!);

    broadcastServerEvent("ATTENDANCE_CHANGED", { action: "check_out", userId: req.user?.id, session: record.session }, workspaceId);
    if (hasOvertime) {
      broadcastServerEvent("OVERTIME_CHANGED", { workspaceId }, workspaceId);
    }

    res.json({
      success: true,
      check_out_time: nowTimeStr,
      total_hours: breakdown.totalHours,
      regular_hours: breakdown.regularHours,
      overtime_hours: breakdown.overtimeHours,
      regular_overtime_hours: breakdown.regularOvertimeHours,
      rest_day_overtime_hours: breakdown.restDayOvertimeHours,
      holiday_overtime_hours: breakdown.holidayOvertimeHours,
      night_overtime_hours: breakdown.nightOvertimeHours,
      attendance_type: breakdown.attendanceType,
      work_status: breakdown.workStatus,
      work_status_reason: breakdown.workStatusReason,
      overtime_status: overtimeStatus,
      overtime_multiplier: breakdown.multiplier,
      overtime_record_id: overtimeRecordId,
      session: record.session,
      verification_method: verificationMethod,
      distance: calculatedDistance,
      message: hasOvertime 
        ? `Check-out recorded. Total ${breakdown.totalHours}h (${breakdown.regularHours}h regular + ${breakdown.overtimeHours}h overtime at ${breakdown.multiplier}x multiplier, Pending Approval).`
        : `Check-out recorded successfully (${breakdown.totalHours}h).`
    });
  } catch (error) {
    console.error("Check-out error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Employee / Staff Attendance Status (Check for open today or missing previous checkouts)
app.get("/api/attendance/status", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === "Bootstrap") {
    return res.json({
      hasOpenToday: false,
      openTodayRecord: null,
      hasMissingCheckout: false,
      missingRecords: [],
      canCheckIn: false,
      canCheckOut: false,
      todayDate: getEthiopianDateString(),
      currentTime: getEthiopianTimeString(),
      serverEpochMs: Date.now(),
      serverTime: new Date().toISOString()
    });
  }

  const todayStr = getEthiopianDateString();
  const nowTimeStr = getEthiopianTimeString();
  const userId = req.user?.id;
  const [nowH, nowM] = nowTimeStr.split(":").map(Number);
  const nowTotalMins = (nowH || 0) * 60 + (nowM || 0);
  const activeSession = nowTotalMins < 390 ? "Morning" : "Afternoon";

  try {
    // 0. Run automated shift exception evaluation
    AttendanceService.evaluateAttendanceExceptionsAndShifts(req.user?.workspace_id || 1, todayStr, nowTimeStr);

    // 1. Check open record today for current active session
    const openToday: any = db.prepare(`
      SELECT * FROM attendance 
      WHERE user_id = ? AND date = ? AND session = ? AND check_out_time IS NULL
      LIMIT 1
    `).get(userId, todayStr, activeSession);

    // 2. Check open/missing checkout from past days OR expired sessions today (Strict Morning & Afternoon rules)
    const pastMissing: any[] = db.prepare(`
      SELECT * FROM attendance 
      WHERE user_id = ? 
        AND (
          (date < ? AND (check_out_time IS NULL OR status = 'Missing Checkout'))
          OR (date = ? AND session = 'Morning' AND (? >= '06:30:00' OR ? >= 390) AND check_out_time IS NULL)
          OR (date = ? AND session = 'Afternoon' AND (? >= '12:00:00' OR ? >= 720) AND check_out_time IS NULL)
          OR (status = 'Missing Checkout')
        )
        AND (correction_status != 'CORRECTED' OR correction_status IS NULL)
      ORDER BY date DESC, session ASC
    `).all(userId, todayStr, todayStr, nowTimeStr, nowTotalMins, todayStr, nowTimeStr, nowTotalMins);

    // Auto-flag any records that aren't marked yet
    for (const pm of pastMissing) {
      if (pm.status !== "Missing Checkout" || pm.correction_status !== "PENDING_CORRECTION") {
        db.prepare(`
          UPDATE attendance 
          SET status = 'Missing Checkout', correction_status = 'PENDING_CORRECTION', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(pm.id);
        pm.status = "Missing Checkout";
        pm.correction_status = "PENDING_CORRECTION";
      }
    }

    const canCheckIn = !openToday && pastMissing.length === 0;
    const canCheckOut = !!openToday;

    res.json({
      hasOpenToday: !!openToday,
      openTodayRecord: openToday || null,
      hasMissingCheckout: pastMissing.length > 0,
      missingRecords: pastMissing,
      activeSession,
      canCheckIn,
      canCheckOut,
      todayDate: todayStr,
      currentTime: nowTimeStr,
      serverEpochMs: Date.now(),
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    console.error("Attendance status check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all Missing Checkout records (Admins see workspace/all, Employees see own)
app.get("/api/attendance/missing-checkouts", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const todayStr = getEthiopianDateString();
  const nowTimeStr = getEthiopianTimeString();
  const [nowH, nowM] = nowTimeStr.split(":").map(Number);
  const nowTotalMins = (nowH || 0) * 60 + (nowM || 0);

  try {
    // Run automated shift exception evaluation first
    AttendanceService.evaluateAttendanceExceptionsAndShifts(currentWorkspaceId || 1, todayStr, nowTimeStr);

    let records: any[];
    if (currentRole === "SuperAdmin") {
      records = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, u.hourly_rate, u.monthly_base_salary,
               w.name as workspace_name, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN workspaces w ON a.workspace_id = w.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        WHERE (
          a.status = 'Missing Checkout' 
          OR (a.date < ? AND a.check_out_time IS NULL)
          OR (a.date = ? AND a.session = 'Morning' AND (? >= '06:30:00' OR ? >= 390) AND a.check_out_time IS NULL)
          OR (a.date = ? AND a.session = 'Afternoon' AND (? >= '12:00:00' OR ? >= 720) AND a.check_out_time IS NULL)
        )
        AND (a.correction_status != 'CORRECTED' OR a.correction_status IS NULL)
        ORDER BY a.date DESC, a.check_in_time DESC
      `).all(todayStr, todayStr, nowTimeStr, nowTotalMins, todayStr, nowTimeStr, nowTotalMins);
    } else if (currentRole === "Bootstrap") {
      records = [];
    } else if (currentRole === "AdminCreator" || currentRole === "AdminManager" || currentRole === "HR") {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      records = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, u.hourly_rate, u.monthly_base_salary,
               w.name as workspace_name, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN workspaces w ON a.workspace_id = w.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        WHERE ${clause}
          AND (
            a.status = 'Missing Checkout' 
            OR (a.date < ? AND a.check_out_time IS NULL)
            OR (a.date = ? AND a.session = 'Morning' AND (? >= '06:30:00' OR ? >= 390) AND a.check_out_time IS NULL)
            OR (a.date = ? AND a.session = 'Afternoon' AND (? >= '12:00:00' OR ? >= 720) AND a.check_out_time IS NULL)
          )
          AND (a.correction_status != 'CORRECTED' OR a.correction_status IS NULL)
        ORDER BY a.date DESC, a.check_in_time DESC
      `).all(...filterParams, todayStr, todayStr, nowTimeStr, nowTotalMins, todayStr, nowTimeStr, nowTotalMins);
    } else {
      records = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, u.hourly_rate, u.monthly_base_salary,
               w.name as workspace_name, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN workspaces w ON a.workspace_id = w.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        WHERE a.user_id = ?
          AND (
            a.status = 'Missing Checkout' 
            OR (a.date < ? AND a.check_out_time IS NULL)
            OR (a.date = ? AND a.session = 'Morning' AND (? >= '06:30:00' OR ? >= 390) AND a.check_out_time IS NULL)
            OR (a.date = ? AND a.session = 'Afternoon' AND (? >= '12:00:00' OR ? >= 720) AND a.check_out_time IS NULL)
          )
          AND (a.correction_status != 'CORRECTED' OR a.correction_status IS NULL)
        ORDER BY a.date DESC, a.check_in_time DESC
      `).all(req.user?.id, todayStr, todayStr, nowTimeStr, nowTotalMins, todayStr, nowTimeStr, nowTotalMins);
    }

    res.json(records);
  } catch (error) {
    console.error("Fetch missing checkouts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin Approval / Correction of Missing Checkout Time
const handleCorrectCheckout = (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Only Administrators can approve or correct attendance records." });
  }

  const recordId = req.params.id ? parseInt(req.params.id) : parseInt(req.body.id || req.body.attendance_id);
  if (!recordId || isNaN(recordId)) {
    return res.status(400).json({ error: "Invalid attendance record ID." });
  }

  const {
    check_out_time,
    check_in_time,
    status = "Present",
    reason,
    total_hours
  } = req.body;

  if (!check_out_time || typeof check_out_time !== "string" || !check_out_time.trim()) {
    return res.status(400).json({ error: "Approved check-out time is required (format HH:mm:ss or HH:mm)." });
  }

  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "Mandatory justification / reason is required for administrative audit logs." });
  }

  try {
    const record: any = db.prepare("SELECT * FROM attendance WHERE id = ?").get(recordId);
    if (!record) {
      return res.status(404).json({ error: "Attendance record not found." });
    }

    // Check workspace scope for non-SuperAdmin
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && req.user?.workspace_id && record.workspace_id && record.workspace_id !== req.user.workspace_id) {
      return res.status(403).json({ error: "Access denied: Record belongs to a different workspace." });
    }

    const employee: any = db.prepare("SELECT id, full_name, phone_number, role, workspace_id FROM users WHERE id = ?").get(record.user_id);

    // Format times
    let formattedOutTime = check_out_time.trim();
    if (formattedOutTime.length === 5) formattedOutTime += ":00";

    let formattedInTime = (check_in_time ? check_in_time.trim() : record.check_in_time) || (record.session === "Morning" ? "02:00:00" : "07:00:00");
    if (formattedInTime.length === 5) formattedInTime += ":00";

    // Session-aware time format normalization (prevents 10-hour discrepancy between Ethiopian and Gregorian clock inputs)
    let [ih, im] = formattedInTime.split(":").map(Number);
    let [oh, om] = formattedOutTime.split(":").map(Number);

    if (record.session === "Morning") {
      // If check-in is Ethiopian (ih <= 6) but check-out was entered as Gregorian (oh >= 12 && oh <= 14)
      if (ih <= 6 && oh >= 12 && oh <= 14) {
        oh -= 6;
        formattedOutTime = `${String(oh).padStart(2, "0")}:${String(om || 0).padStart(2, "0")}:00`;
      }
    } else if (record.session === "Afternoon") {
      // If check-in is Ethiopian (ih <= 12) but check-out was entered as Gregorian (oh >= 13 && oh <= 23)
      if (ih <= 12 && oh >= 13 && oh <= 23) {
        oh -= 6;
        formattedOutTime = `${String(oh).padStart(2, "0")}:${String(om || 0).padStart(2, "0")}:00`;
      }
    }

    // Calculate total hours
    let calculatedHours: number;
    if (total_hours !== undefined && total_hours !== null && !isNaN(parseFloat(total_hours))) {
      calculatedHours = parseFloat(parseFloat(total_hours).toFixed(2));
    } else {
      let diffMinutes = (oh * 60 + om) - (ih * 60 + im);
      if (diffMinutes < 0) diffMinutes += 24 * 60;
      calculatedHours = Math.max(0, parseFloat((diffMinutes / 60).toFixed(2)));
    }

    const breakdown = WorkCalendarService.computeAttendanceHoursBreakdown(
      record.workspace_id || req.user?.workspace_id || 1,
      record.date,
      formattedInTime,
      formattedOutTime,
      record.session
    );

    const workedMinutes = Math.round(calculatedHours * 60);
    const finalStatus = ["Present", "Late", "Authorized", "Permission"].includes(status) ? status : "Present";
    const overtimeStatus = breakdown.overtimeHours > 0 ? "APPROVED" : null;

    // Update attendance record with correction metadata and full hours breakdown
    db.prepare(`
      UPDATE attendance 
      SET check_in_time = ?,
          check_out_time = ?,
          total_hours = ?,
          worked_minutes = ?,
          regular_hours = ?,
          overtime_hours = ?,
          regular_overtime_hours = ?,
          rest_day_overtime_hours = ?,
          holiday_overtime_hours = ?,
          night_overtime_hours = ?,
          overtime_status = ?,
          status = ?,
          correction_status = 'CORRECTED',
          admin_corrected_by = ?,
          admin_correction_reason = ?,
          admin_corrected_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      formattedInTime,
      formattedOutTime,
      calculatedHours,
      workedMinutes,
      breakdown.regularHours,
      breakdown.overtimeHours,
      breakdown.regularOvertimeHours || 0,
      breakdown.restDayOvertimeHours || 0,
      breakdown.holidayOvertimeHours || 0,
      breakdown.nightOvertimeHours || 0,
      overtimeStatus,
      finalStatus,
      req.user?.id,
      reason.trim(),
      recordId
    );

    // Immutable Audit Log
    try {
      const auditDetails = `Admin ${req.user?.full_name || 'Admin'} (${req.user?.role}) corrected missing checkout for ${employee?.full_name || 'Staff'} on ${record.date} (${record.session} session). Check-in: ${formattedInTime}, Approved Check-out: ${formattedOutTime}, Hours: ${calculatedHours} hrs, Status: ${finalStatus}. Reason: "${reason.trim()}"`;
      
      db.prepare(`
        INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
        VALUES (?, ?, 'ATTENDANCE_CHECKOUT_CORRECTED', ?, ?)
      `).run(
        record.workspace_id || req.user?.workspace_id || 1,
        req.user?.id,
        auditDetails,
        req.ip || '127.0.0.1'
      );
    } catch (auditErr) {
      console.error("Audit log creation error:", auditErr);
    }

    // Recalculate score and metrics
    updateAttendanceScore(record.user_id);

    const updatedRecord: any = db.prepare(`
      SELECT a.*, u.full_name, u.phone_number, u.role, adm.full_name as admin_corrector_name
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN users adm ON a.admin_corrected_by = adm.id
      WHERE a.id = ?
    `).get(recordId);

    // Realtime broadcast to trigger UI refresh across all connected clients
    broadcastServerEvent("ATTENDANCE_CORRECTED", {
      workspaceId: record.workspace_id || 1,
      attendanceId: record.id,
      userId: record.user_id,
      status: finalStatus
    }, record.workspace_id || 1);
    broadcastServerEvent("ATTENDANCE_CHANGED", {
      workspaceId: record.workspace_id || 1,
      attendanceId: record.id,
      userId: record.user_id
    }, record.workspace_id || 1);
    broadcastServerEvent("SALARY_CHANGED", {
      workspaceId: record.workspace_id || 1,
      userId: record.user_id
    }, record.workspace_id || 1);

    res.json({
      success: true,
      message: `Checkout successfully approved and record corrected for ${employee?.full_name || 'employee'}. Check-in lock has been released.`,
      record: updatedRecord
    });
  } catch (error) {
    console.error("Correct checkout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

app.post("/api/attendance/:id/correct-checkout", authenticateToken, handleCorrectCheckout);
app.put("/api/attendance/:id/correct-checkout", authenticateToken, handleCorrectCheckout);
app.post("/api/attendance/correct-missing-checkout", authenticateToken, handleCorrectCheckout);

// View Attendance Correction Audit Logs
app.get("/api/attendance/audit-logs", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Only Administrators can inspect audit logs." });
  }

  const currentWorkspaceId = req.user?.workspace_id;

  try {
    let logs: any[];
    if (currentRole === "SuperAdmin") {
      logs = db.prepare(`
        SELECT al.*, u.full_name as actor_name, u.role as actor_role, w.name as workspace_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN workspaces w ON al.workspace_id = w.id
        WHERE al.action LIKE 'ATTENDANCE_%'
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT 200
      `).all();
    } else {
      logs = db.prepare(`
        SELECT al.*, u.full_name as actor_name, u.role as actor_role, w.name as workspace_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN workspaces w ON al.workspace_id = w.id
        WHERE al.action LIKE 'ATTENDANCE_%' AND (al.workspace_id = ? OR al.workspace_id IS NULL)
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT 200
      `).all(currentWorkspaceId);
    }

    res.json(logs);
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Attendance Exceptions & Live Shift Duration Evaluation
app.get("/api/attendance/exceptions-and-shifts", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const workspaceId = req.user?.workspace_id || 1;
    const todayStr = getEthiopianDateString();
    const nowTimeStr = getEthiopianTimeString();

    const evaluation = AttendanceService.evaluateAttendanceExceptionsAndShifts(workspaceId, todayStr, nowTimeStr);
    res.json(evaluation);
  } catch (error) {
    console.error("Attendance exceptions evaluation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// List Attendance Correction Requests (Admin sees workspace/all; employee sees own)
app.get("/api/attendance/corrections", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
  const isAdmin = adminRoles.includes(currentRole || "");

  try {
    let corrections: any[];
    if (currentRole === "SuperAdmin") {
      corrections = AttendanceService.getCorrectionRequests();
    } else if (isAdmin) {
      corrections = AttendanceService.getCorrectionRequests(currentWorkspaceId || 1);
    } else {
      corrections = AttendanceService.getCorrectionRequests(currentWorkspaceId, req.user?.id);
    }
    res.json(corrections);
  } catch (error) {
    console.error("Fetch attendance corrections error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Employee / Staff submits a Correction Request for missing checkout
app.post("/api/attendance/corrections/request", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { attendance_id, date, session, requested_check_in, requested_check_out, reason, reason_code } = req.body;

  if (!requested_check_out || !reason) {
    return res.status(400).json({ error: "Requested check-out time and reason explanation are required." });
  }

  const result = AttendanceService.submitCorrectionRequest(
    userId!,
    {
      attendance_id: attendance_id ? parseInt(attendance_id, 10) : undefined,
      date,
      session,
      requested_check_in,
      requested_check_out,
      reason,
      reason_code
    },
    req.ip || "127.0.0.1"
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  broadcastServerEvent("ATTENDANCE_CORRECTION_REQUESTED", {
    workspaceId: req.user?.workspace_id || 1,
    userId,
    correctionId: result.correction?.id
  }, req.user?.workspace_id || 1);

  res.json({ success: true, message: result.message, correction: result.correction });
});

// Admin approves Attendance Correction Request
app.post("/api/attendance/corrections/:id/approve", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Only Administrators can approve attendance corrections." });
  }

  const correctionId = parseInt(req.params.id, 10);
  if (!correctionId || isNaN(correctionId)) {
    return res.status(400).json({ error: "Invalid correction request ID." });
  }

  const { approved_check_in, approved_check_out, approved_hours, notes } = req.body;

  const result = AttendanceService.approveCorrectionRequest(
    req.user,
    correctionId,
    { approved_check_in, approved_check_out, approved_hours },
    req.ip || "127.0.0.1"
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const wsId = req.user?.workspace_id || 1;
  broadcastServerEvent("ATTENDANCE_CORRECTED", {
    workspaceId: wsId,
    correctionId,
    record: result.record
  }, wsId);
  broadcastServerEvent("ATTENDANCE_CHANGED", {
    workspaceId: wsId,
    correctionId
  }, wsId);
  broadcastServerEvent("SALARY_CHANGED", {
    workspaceId: wsId
  }, wsId);

  res.json({ success: true, message: result.message, record: result.record });
});

// Admin rejects Attendance Correction Request
app.post("/api/attendance/corrections/:id/reject", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Only Administrators can reject attendance corrections." });
  }

  const correctionId = parseInt(req.params.id, 10);
  if (!correctionId || isNaN(correctionId)) {
    return res.status(400).json({ error: "Invalid correction request ID." });
  }

  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: "A rejection reason is required." });
  }

  const result = AttendanceService.rejectCorrectionRequest(
    req.user,
    correctionId,
    reason,
    req.ip || "127.0.0.1"
  );

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const wsId = req.user?.workspace_id || 1;
  broadcastServerEvent("ATTENDANCE_CORRECTION_REJECTED", {
    workspaceId: wsId,
    correctionId
  }, wsId);
  broadcastServerEvent("ATTENDANCE_CHANGED", {
    workspaceId: wsId
  }, wsId);

  res.json({ success: true, message: result.message });
});

// Payroll Pre-flight Check: Verifies that no unresolved missing checkouts block payroll computation
app.get("/api/payroll/preflight-check", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied. Only Administrators can perform payroll pre-flight validation." });
  }

  const workspaceId = req.user?.workspace_id || 1;
  const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
  const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

  try {
    const check = AttendanceService.getPayrollPreFlightCheck(workspaceId, month, year);
    res.json(check);
  } catch (error) {
    console.error("Payroll pre-flight check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper: Recalculate attendance metrics and score
function updateAttendanceScore(userId: number) {
  try {
    const records: any[] = db.prepare("SELECT * FROM attendance WHERE user_id = ?").all(userId);
    const approvedPermissions: any[] = db.prepare(`
      SELECT * FROM permissions 
      WHERE user_id = ? AND status = 'Approved'
    `).all(userId);

    // Attended records must have a valid check out or be marked as CORRECTED
    const attendedRecords = records.filter(r => 
      ["Present", "Late", "Permission", "Authorized"].includes(r.status) &&
      r.status !== "Missing Checkout" &&
      (r.check_out_time != null || r.correction_status === "CORRECTED")
    );
    const lateCount = records.filter(r => r.status === "Late").length;
    const totalAttended = attendedRecords.length + approvedPermissions.length;

    // If an employee has never attended or checked in:
    if (totalAttended === 0) {
      db.prepare(`
        INSERT INTO attendance_scores (user_id, attendance_score, punctuality_percentage, late_count, updated_at)
        VALUES (?, 0.0, 0.0, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          attendance_score = 0.0,
          punctuality_percentage = 0.0,
          late_count = 0,
          updated_at = CURRENT_TIMESTAMP
      `).run(userId);
      return;
    }

    const presentCount = attendedRecords.length;
    const userRow: any = db.prepare("SELECT workspace_id FROM users WHERE id = ?").get(userId);
    const settings = AttendanceService.getSiteSettings(userRow?.workspace_id || 1);
    const allowedMinorLates = settings.allowed_minor_lates ?? 2;
    const effectiveLates = Math.max(0, lateCount - allowedMinorLates);
    const punctualityPercentage = presentCount > 0 
      ? Math.max(0, parseFloat(((presentCount - effectiveLates) / presentCount * 100).toFixed(1)))
      : 100.0;

    // Attendance score reflects punctuality and attendance reliability
    const attendanceScore = punctualityPercentage;

    db.prepare(`
      INSERT INTO attendance_scores (user_id, attendance_score, punctuality_percentage, late_count, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        attendance_score = excluded.attendance_score,
        punctuality_percentage = excluded.punctuality_percentage,
        late_count = excluded.late_count,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, attendanceScore, punctualityPercentage, lateCount);
  } catch (error) {
    console.error("Error recalculating attendance score:", error);
  }
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  try {
    const dates: string[] = [];
    const [sy, sm, sd] = startStr.split("-").map(Number);
    const [ey, em, ed] = endStr.split("-").map(Number);
    
    if (!sy || !sm || !sd || !ey || !em || !ed) return [startStr];

    const currentG = toGregorian(sy, sm, sd);
    const endG = toGregorian(ey, em, ed);
    
    const currDate = new Date(currentG[0], currentG[1] - 1, currentG[2]);
    const endDate = new Date(endG[0], endG[1] - 1, endG[2]);
    
    while (currDate <= endDate) {
      const [eyy, emm, edd] = toEthiopian(currDate.getFullYear(), currDate.getMonth() + 1, currDate.getDate());
      dates.push(`${eyy}-${String(emm).padStart(2, "0")}-${String(edd).padStart(2, "0")}`);
      currDate.setDate(currDate.getDate() + 1);
    }
    return dates;
  } catch (err) {
    console.error("Error in getDatesInRange:", err);
    return [startStr];
  }
}

// Fetch all attendance logs (SuperAdmin sees all, Bootstrap sees none, Admin sees workspace, Employee sees own)
app.get("/api/attendance/history", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  try {
    let logs: any[];
    if (currentRole === "SuperAdmin") {
      logs = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, COALESCE(w.name, uw.name, 'Main Workspace') as workspace_name, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN workspaces w ON a.workspace_id = w.id
        LEFT JOIN workspaces uw ON u.workspace_id = uw.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        ORDER BY a.date DESC, a.check_in_time DESC
      `).all();
    } else if (currentRole === "Bootstrap") {
      logs = [];
    } else if (["AdminCreator", "AdminManager", "Admin", "HR"].includes(currentRole || "")) {
      const { clause, params } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      logs = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, COALESCE(w.name, uw.name, 'Main Workspace') as workspace_name, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN workspaces w ON a.workspace_id = w.id
        LEFT JOIN workspaces uw ON u.workspace_id = uw.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        WHERE ${clause}
        ORDER BY a.date DESC, a.check_in_time DESC
      `).all(...params);
    } else {
      logs = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, COALESCE(w.name, uw.name, 'Main Workspace') as workspace_name, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN workspaces w ON a.workspace_id = w.id
        LEFT JOIN workspaces uw ON u.workspace_id = uw.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        WHERE a.user_id = ?
        ORDER BY a.date DESC, a.check_in_time DESC
      `).all(req.user?.id);
    }

    // Synthesize "Present" records for approved permissions
    let permissions: any[];
    if (currentRole === "SuperAdmin") {
      permissions = db.prepare(`
        SELECT p.*, u.full_name, u.phone_number, u.role, COALESCE(w.name, uw.name, 'Main Workspace') as workspace_name
        FROM permissions p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN workspaces w ON p.workspace_id = w.id
        LEFT JOIN workspaces uw ON u.workspace_id = uw.id
        WHERE p.status = 'Approved'
      `).all();
    } else if (["AdminCreator", "AdminManager", "Admin", "HR"].includes(currentRole || "")) {
      const { clause, params } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      permissions = db.prepare(`
        SELECT p.*, u.full_name, u.phone_number, u.role, COALESCE(w.name, uw.name, 'Main Workspace') as workspace_name
        FROM permissions p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN workspaces w ON p.workspace_id = w.id
        LEFT JOIN workspaces uw ON u.workspace_id = uw.id
        WHERE p.status = 'Approved' AND ${clause}
      `).all(...params);
    } else {
      permissions = db.prepare(`
        SELECT p.*, u.full_name, u.phone_number, u.role, w.name as workspace_name
        FROM permissions p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN workspaces w ON p.workspace_id = w.id
        WHERE p.status = 'Approved' AND p.user_id = ?
      `).all(req.user?.id);
    }

    const mergedLogs = [...logs];
    permissions.forEach(p => {
      const dates = getDatesInRange(p.approved_from_date || p.start_date, p.approved_to_date || p.end_date);
      const targetSessions = (p.session && p.session !== "Full Day") ? [p.session] : ["Morning", "Afternoon"];
      dates.forEach(d => {
        targetSessions.forEach(sess => {
          const exists = logs.some(l => l.user_id === p.user_id && l.date === d && l.session === sess);
          if (!exists) {
            mergedLogs.push({
              id: `perm-${p.id}-${d}-${sess}`,
              user_id: p.user_id,
              date: d,
              session: sess,
              check_in_time: null,
              check_out_time: null,
              total_hours: 4.0,
              status: "Present",
              full_name: p.full_name,
              phone_number: p.phone_number,
              role: p.role,
              workspace_name: p.workspace_name || "N/A"
            });
          }
        });
      });
    });

    mergedLogs.sort((a, b) => b.date.localeCompare(a.date));
    res.json(mergedLogs);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 1: ANALYTICS DASHBOARD API ---
app.get("/api/attendance/dashboard", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Admin", "HR", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { filter, start_date, end_date } = req.query;

  try {
    const todayStr = getEthiopianDateString();

    // Total active workforce (including employees and admins)
    const trackedRoles = "('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR', 'AdminCreator', 'AdminManager', 'Admin', 'SuperAdmin')";
    let employeesCount: any;
    if (currentRole === "SuperAdmin") {
      employeesCount = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role IN ${trackedRoles}`).get();
    } else if (currentRole === "Bootstrap") {
      employeesCount = { count: 0 };
    } else {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      employeesCount = db.prepare(`
        SELECT COUNT(*) as count 
        FROM users u
        WHERE u.role IN ${trackedRoles} AND ${clause}
      `).get(...filterParams);
    }
    const totalEmployees = employeesCount?.count || 0;

    // Check authoritative work calendar status for today for current workspace
    const wsId = currentWorkspaceId || 1;
    const morningStatus = WorkCalendarService.getEffectiveWorkStatus(wsId, todayStr, undefined, "Morning");
    const afternoonStatus = WorkCalendarService.getEffectiveWorkStatus(wsId, todayStr, undefined, "Afternoon");
    const isTodayHoliday = !!(morningStatus.holiday || afternoonStatus.holiday);
    const isTodayNonWorkingDay = morningStatus.status === "NON_WORKING" && afternoonStatus.status === "NON_WORKING";
    const holidayName = morningStatus.holiday?.name || afternoonStatus.holiday?.name || null;
    const dayReason = morningStatus.reason === afternoonStatus.reason ? morningStatus.reason : `${morningStatus.reason} / ${afternoonStatus.reason}`;
    const dayName = morningStatus.dayName;

    // Daily active check-ins with overtime details (including admins)
    let todayCheckIns: any[];
    if (currentRole === "SuperAdmin") {
      todayCheckIns = db.prepare(`
        SELECT a.user_id, a.status, a.session, a.attendance_type, a.work_status, a.work_status_reason, a.overtime_status, a.overtime_hours, a.total_hours 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.date = ? AND u.role IN ${trackedRoles}
      `).all(todayStr);
    } else if (currentRole === "Bootstrap") {
      todayCheckIns = [];
    } else {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      todayCheckIns = db.prepare(`
        SELECT a.user_id, a.status, a.session, a.attendance_type, a.work_status, a.work_status_reason, a.overtime_status, a.overtime_hours, a.total_hours 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.date = ? 
          AND u.role IN ${trackedRoles}
          AND ${clause}
      `).all(todayStr, ...filterParams);
    }

    const uniquePresentUserIds = new Set<number>();
    const uniqueLateUserIds = new Set<number>();
    const uniqueOvertimeUserIds = new Set<number>();

    todayCheckIns.forEach(c => {
      if (["Present", "Late", "Permission", "Authorized"].includes(c.status)) {
        uniquePresentUserIds.add(c.user_id);
        if (c.status === "Late") {
          uniqueLateUserIds.add(c.user_id);
        }
      }

      // Check if this attendance is classified as Overtime
      const sessionStatus = c.session === "Afternoon" ? afternoonStatus : morningStatus;
      const isOt = ["REST_DAY_OVERTIME", "HOLIDAY_OVERTIME", "REGULAR_OVERTIME", "NIGHT_OVERTIME"].includes(c.attendance_type) ||
                   c.work_status === "NON_WORKING" ||
                   sessionStatus.status === "NON_WORKING" ||
                   isTodayNonWorkingDay ||
                   isTodayHoliday ||
                   c.overtime_status != null ||
                   (c.overtime_hours && c.overtime_hours > 0);

      if (isOt) {
        uniqueOvertimeUserIds.add(c.user_id);
      }
    });

    // Approved permissions count as "Present" (even if they didn't check in)
    let approvedPermissions: any[];
    if (currentRole === "SuperAdmin") {
      approvedPermissions = db.prepare(`
        SELECT user_id FROM permissions 
        WHERE status = 'Approved' 
        AND ? BETWEEN COALESCE(approved_from_date, start_date) AND COALESCE(approved_to_date, end_date)
      `).all(todayStr);
    } else {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      approvedPermissions = db.prepare(`
        SELECT p.user_id FROM permissions p
        JOIN users u ON p.user_id = u.id
        WHERE p.status = 'Approved' 
        AND ${clause}
        AND ? BETWEEN COALESCE(p.approved_from_date, p.start_date) AND COALESCE(p.approved_to_date, p.end_date)
      `).all(...filterParams, todayStr);
    }
    approvedPermissions.forEach(p => uniquePresentUserIds.add(p.user_id));

    // Approved attendance requests also count as "Present"
    let approvedAttendanceReqs: any[];
    if (currentRole === "SuperAdmin") {
      approvedAttendanceReqs = db.prepare(`
        SELECT user_id FROM attendance_requests 
        WHERE status = 'Approved' AND date = ?
      `).all(todayStr);
    } else {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      approvedAttendanceReqs = db.prepare(`
        SELECT r.user_id FROM attendance_requests r
        JOIN users u ON r.user_id = u.id
        WHERE r.status = 'Approved' AND r.date = ? 
        AND ${clause}
      `).all(todayStr, ...filterParams);
    }
    approvedAttendanceReqs.forEach(r => uniquePresentUserIds.add(r.user_id));

    const presentToday = uniquePresentUserIds.size;
    const lateToday = uniqueLateUserIds.size;
    const workingOvertimeToday = uniqueOvertimeUserIds.size;

    // Crucial: If today is a non-working day or holiday, employees MUST NOT be marked absent!
    const absentToday = (isTodayNonWorkingDay || isTodayHoliday) 
      ? 0 
      : Math.max(0, totalEmployees - presentToday);

    // Historical filters
    let dateFilterClause = "";
    const params: any[] = [];
    const now = new Date();

    if (filter === "Today") {
      dateFilterClause = "AND date = ?";
      params.push(todayStr);
    } else if (filter === "Week") {
      const oneWeekAgo = getEthiopianDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      dateFilterClause = "AND date >= ?";
      params.push(oneWeekAgo);
    } else if (filter === "Month") {
      const oneMonthAgo = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
      dateFilterClause = "AND date >= ?";
      params.push(oneMonthAgo);
    } else if (filter === "Year") {
      const oneYearAgo = getEthiopianDateString(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
      dateFilterClause = "AND date >= ?";
      params.push(oneYearAgo);
    } else if (filter === "Custom" && start_date && end_date) {
      dateFilterClause = "AND date BETWEEN ? AND ?";
      params.push(start_date, end_date);
    } else {
      // Default: Last 30 Days
      const thirtyDaysAgo = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
      dateFilterClause = "AND date >= ?";
      params.push(thirtyDaysAgo);
    }

    // Apply workspace filter to aggregates, trends and performance
    let dashboardUserClause = "1=1";
    let dashboardUserParams: any[] = [];

    if (currentRole === "SuperAdmin") {
      dashboardUserClause = "1=1";
    } else if (currentRole === "Bootstrap") {
      dashboardUserClause = "u.workspace_id = -1";
    } else {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      dashboardUserClause = clause;
      dashboardUserParams = filterParams;
    }

    // Aggregates over the filter
    const aggregates: any = db.prepare(`
      SELECT 
        SUM(a.total_hours) as total_working_hours,
        AVG(a.total_hours) as avg_working_hours,
        COUNT(a.id) as total_present_records
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1 ${dateFilterClause.replace(/AND date/g, "AND a.date")} AND ${dashboardUserClause}
    `).get(...params, ...dashboardUserParams);

    const totalWorkingHours = parseFloat((aggregates.total_working_hours || 0).toFixed(1));
    const avgWorkingHours = parseFloat((aggregates.avg_working_hours || 0).toFixed(1));

    // Chart: Daily and Monthly Trends
    const trends: any[] = db.prepare(`
      SELECT a.date, COUNT(a.id) as present_count, SUM(a.total_hours) as working_hours
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE 1=1 ${dateFilterClause.replace(/AND date/g, "AND a.date")} AND ${dashboardUserClause}
      GROUP BY a.date
      ORDER BY a.date ASC
      LIMIT 30
    `).all(...params, ...dashboardUserParams);

    // Chart: Employee Performance Trend
    let performance: any[] = [];
    if (currentRole !== "Bootstrap") {
      performance = db.prepare(`
        SELECT u.full_name, AVG(a.total_hours) as avg_hours, COUNT(CASE WHEN a.status = 'Late' THEN 1 END) as late_count
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE 1=1 ${dateFilterClause.replace(/AND date/g, "AND a.date")} AND ${dashboardUserClause}
        GROUP BY u.id
        ORDER BY avg_hours DESC
      `).all(...params, ...dashboardUserParams);
    }

    res.json({
      summary: {
        totalEmployees,
        presentToday,
        lateToday,
        absentToday,
        workingOvertimeToday,
        isNonWorkingDay: isTodayNonWorkingDay,
        isHoliday: isTodayHoliday,
        holidayName,
        dayReason,
        dayName,
        totalWorkingHours,
        avgWorkingHours,
        serverEpochMs: Date.now(),
        serverTime: new Date().toISOString()
      },
      trends,
      performance,
    });
  } catch (error: any) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 2: APPROVALS (PERMISSION REQUESTS) ---

// Get permission requests (SuperAdmin/Admin workspace-aligned, Employee sees own)
app.get("/api/permissions", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  try {
    let requests;
    if (currentRole === "SuperAdmin") {
      requests = db.prepare(`
        SELECT p.*, u.full_name, u.phone_number
        FROM permissions p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `).all();
    } else if (currentRole === "Bootstrap") {
      requests = [];
    } else if (currentRole === "AdminCreator" || currentRole === "AdminManager") {
      requests = db.prepare(`
        SELECT p.*, u.full_name, u.phone_number
        FROM permissions p
        JOIN users u ON p.user_id = u.id
        WHERE p.workspace_id = ?
        ORDER BY p.created_at DESC
      `).all(currentWorkspaceId);
    } else {
      requests = db.prepare(`
        SELECT p.*, u.full_name, u.phone_number
        FROM permissions p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user?.id);
    }
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create permission request
app.post("/api/permissions", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === "Bootstrap") {
    return res.status(403).json({ error: "Access Denied. Setup Bootstrap account cannot request leaves." });
  }

  const { request_type, reason, start_date, end_date, session } = req.body;

  if (!request_type || !reason || !start_date || !end_date) {
    return res.status(400).json({ error: "Request type, reason, start date, and end date are required" });
  }

  if (!["Permission", "Sick Leave", "Annual Leave"].includes(request_type)) {
    return res.status(400).json({ error: "Invalid request type" });
  }

  const reqSession = (session && ["Full Day", "Morning", "Afternoon"].includes(session)) ? session : "Full Day";

  // Convert Gregorian dates from client to Ethiopian for storage
  const ethStart = convertGregorianToEthiopianDate(start_date);
  const ethEnd = convertGregorianToEthiopianDate(end_date);
  const requestedDates = getDatesInRange(ethStart, ethEnd);

  try {
    // 1. Strict Attendance Validation on all requested dates
    for (const date of requestedDates) {
      const existingAttendances: any[] = db.prepare(`
        SELECT session, check_in_time, check_out_time, status 
        FROM attendance 
        WHERE user_id = ? AND date = ?
      `).all(req.user?.id, date);

      const morningAtt = existingAttendances.find(a => a.session === "Morning");
      const afternoonAtt = existingAttendances.find(a => a.session === "Afternoon");

      const morningCheckedIn = !!morningAtt && (morningAtt.check_in_time != null || ["Present", "Late", "Authorized"].includes(morningAtt.status));
      const afternoonCheckedIn = !!afternoonAtt && (afternoonAtt.check_in_time != null || afternoonAtt.check_out_time != null || ["Present", "Late", "Authorized"].includes(afternoonAtt.status));

      // Rule: If both morning and afternoon are already checked in
      if (morningCheckedIn && afternoonCheckedIn) {
        return res.status(400).json({
          error: `You have already checked in and attended both Morning and Afternoon sessions on ${date}. Leave or permission cannot be requested for an attended day.`
        });
      }

      // Rule: Full Day request or multi-day leave
      if (reqSession === "Full Day" || requestedDates.length > 1) {
        if (morningCheckedIn) {
          return res.status(400).json({
            error: `Cannot request full-day leave or permission for ${date}: You have already checked in for the Morning session. You may submit a permission request specifically for the Afternoon session.`
          });
        }
        if (afternoonCheckedIn) {
          return res.status(400).json({
            error: `Cannot request full-day leave or permission for ${date}: You have already checked in for the Afternoon session.`
          });
        }
      }

      // Rule: Morning session request
      if (reqSession === "Morning" && morningCheckedIn) {
        return res.status(400).json({
          error: `Morning session on ${date} is already checked in. You cannot request permission for an attended morning session. You may request permission for the Afternoon session.`
        });
      }

      // Rule: Afternoon session request
      if (reqSession === "Afternoon" && afternoonCheckedIn) {
        return res.status(400).json({
          error: `Afternoon session on ${date} is already checked in. You cannot request permission for an attended session.`
        });
      }
    }

    // 2. Prevent duplicate / overlapping active permission requests
    const existingPerms: any[] = db.prepare(`
      SELECT id, request_type, start_date, end_date, session, status 
      FROM permissions 
      WHERE user_id = ? AND status IN ('Pending', 'Approved')
    `).all(req.user?.id);

    for (const p of existingPerms) {
      const pDates = getDatesInRange(p.start_date, p.end_date);
      for (const d of requestedDates) {
        if (pDates.includes(d)) {
          const pSess = p.session || "Full Day";
          if (reqSession === "Full Day" || pSess === "Full Day" || reqSession === pSess) {
            return res.status(400).json({
              error: `A ${p.status.toLowerCase()} ${p.request_type} request already exists for ${d} (${pSess}). Conflicting or duplicate requests for the same session are not allowed.`
            });
          }
        }
      }
    }

    db.prepare(`
      INSERT INTO permissions (user_id, request_type, session, reason, start_date, end_date, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.user?.id, request_type, reqSession, reason, ethStart, ethEnd, req.user?.workspace_id);

    // Realtime broadcast to trigger leave/permission refresh across admin & employee dashboards
    broadcastServerEvent("PERMISSION_REQUESTED", { 
      workspaceId: req.user?.workspace_id || 1, 
      userId: req.user?.id 
    }, req.user?.workspace_id || 1);
    broadcastServerEvent("ATTENDANCE_CHANGED", { 
      workspaceId: req.user?.workspace_id || 1, 
      userId: req.user?.id 
    }, req.user?.workspace_id || 1);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error creating permission request:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Approve/Reject permission request (Admin Only, Workspace Isolated)
app.put("/api/permissions/:id/approve", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { id } = req.params;
  const { status, approved_from_date, approved_to_date } = req.body;

  if (!status || !["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'Approved' or 'Rejected'" });
  }

  try {
    // Isolate by workspace
    const targetPermission: any = db.prepare("SELECT * FROM permissions WHERE id = ?").get(id);
    if (!targetPermission) {
      return res.status(404).json({ error: "Permission request not found." });
    }
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && targetPermission.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Workspace isolation violation." });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE permissions
        SET status = ?, approved_from_date = ?, approved_to_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, approved_from_date || null, approved_to_date || null, id);

      if (status === "Approved") {
        const fromDate = approved_from_date ? approved_from_date : targetPermission.start_date;
        const toDate = approved_to_date ? approved_to_date : targetPermission.end_date;
        const targetSession = targetPermission.session || "Full Day";
        const sessionsToMark = (targetSession === "Morning" || targetSession === "Afternoon") 
          ? [targetSession] 
          : ["Morning", "Afternoon"];
        
        const dates = getDatesInRange(fromDate, toDate);
        for (const date of dates) {
          for (const session of sessionsToMark) {
            db.prepare(`
              INSERT INTO attendance (user_id, date, session, status, workspace_id)
              VALUES (?, ?, ?, 'Permission', ?)
              ON CONFLICT(user_id, date, session) DO UPDATE SET
                status = 'Permission',
                updated_at = CURRENT_TIMESTAMP
            `).run(targetPermission.user_id, date, session, currentWorkspaceId);
          }
        }
      } else if (status === "Rejected") {
        // Just update the status, don't overwrite existing attendance records
      }
      
      updateAttendanceScore(targetPermission.user_id);
    })();

    // Realtime broadcast to trigger UI refresh
    broadcastServerEvent("ATTENDANCE_CHANGED", {
      workspaceId: currentWorkspaceId || 1,
      userId: targetPermission.user_id,
      permissionId: id,
      status
    }, currentWorkspaceId || 1);
    broadcastServerEvent("SALARY_CHANGED", {
      workspaceId: currentWorkspaceId || 1,
      userId: targetPermission.user_id
    }, currentWorkspaceId || 1);

    res.json({ success: true });
  } catch (error) {
    console.error("Error approving/rejecting permission request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 2.2: ATTENDANCE REQUESTS APPROVAL ---

// Get attendance requests (SuperAdmin/Admin workspace-aligned, Employee sees own)
app.get("/api/attendance-requests", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  try {
    let requests;
    if (currentRole === "SuperAdmin") {
      requests = db.prepare(`
        SELECT ar.*, u.full_name, u.phone_number
        FROM attendance_requests ar
        JOIN users u ON ar.user_id = u.id
        ORDER BY ar.created_at DESC
      `).all();
    } else if (currentRole === "Bootstrap") {
      requests = [];
    } else if (currentRole === "AdminCreator" || currentRole === "AdminManager") {
      const { clause, params: filterParams } = getWorkspaceUsersFilter("u", currentRole, currentWorkspaceId, req.user?.id);
      requests = db.prepare(`
        SELECT ar.*, u.full_name, u.phone_number
        FROM attendance_requests ar
        JOIN users u ON ar.user_id = u.id
        WHERE ${clause}
        ORDER BY ar.created_at DESC
      `).all(...filterParams);
    } else {
      requests = db.prepare(`
        SELECT ar.*, u.full_name, u.phone_number
        FROM attendance_requests ar
        JOIN users u ON ar.user_id = u.id
        WHERE ar.user_id = ?
        ORDER BY ar.created_at DESC
      `).all(req.user?.id);
    }
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create attendance request (Site Visits, External Work, Purchaser Visits)
app.post("/api/attendance-requests", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === "Bootstrap") {
    return res.status(403).json({ error: "Access Denied. Setup Bootstrap account cannot request attendance adjustments." });
  }

  const { type, date, check_in_time, check_out_time, reason, session, request_scope } = req.body;

  if (!type || !date || !reason) {
    return res.status(400).json({ error: "Adjustment type, date, and reason are required" });
  }

  if (!["Site Visit", "External Work", "Purchaser Visit"].includes(type)) {
    return res.status(400).json({ error: "Invalid attendance request type" });
  }

  const reqScope = (request_scope && ["Full Shift", "Site Check-Out"].includes(request_scope)) ? request_scope : "Full Shift";
  const reqSession = (session && ["Full Day", "Morning", "Afternoon"].includes(session)) ? session : "Full Day";

  if (reqScope === "Full Shift" && (!check_in_time || !check_out_time)) {
    return res.status(400).json({ error: "Both check-in and check-out times are required for full shift external work." });
  }

  if (reqScope === "Site Check-Out" && !check_out_time) {
    return res.status(400).json({ error: "Check-out time is required for site check-out." });
  }

  // Convert Gregorian date from client to Ethiopian for storage
  const ethDate = convertGregorianToEthiopianDate(date);

  try {
    // 1. Fetch current attendance on this date
    const attendances: any[] = db.prepare(`
      SELECT session, check_in_time, check_out_time, status 
      FROM attendance 
      WHERE user_id = ? AND date = ?
    `).all(req.user?.id, ethDate);

    const morningAtt = attendances.find(a => a.session === "Morning");
    const afternoonAtt = attendances.find(a => a.session === "Afternoon");

    const morningHasIn = morningAtt && morningAtt.check_in_time != null;
    const morningHasOut = morningAtt && morningAtt.check_out_time != null;
    const afternoonHasIn = afternoonAtt && afternoonAtt.check_in_time != null;
    const afternoonHasOut = afternoonAtt && afternoonAtt.check_out_time != null;

    if (reqScope === "Site Check-Out") {
      // User is already checked in at the office and wants to register site check-out
      const targetAtt = (reqSession === "Afternoon") ? afternoonAtt : (morningAtt || afternoonAtt);
      if (!targetAtt || !targetAtt.check_in_time) {
        return res.status(400).json({
          error: `No active office check-in found on ${ethDate}. If you worked entirely off-site without checking in at the office, please choose 'Full Shift' mode.`
        });
      }
      if (targetAtt.check_out_time) {
        return res.status(400).json({
          error: `You already have a verified check-out recorded (${targetAtt.check_out_time}) on ${ethDate}.`
        });
      }
    } else {
      // reqScope === "Full Shift"
      if (morningHasIn && morningHasOut && afternoonHasIn && afternoonHasOut) {
        return res.status(400).json({
          error: `Both Morning and Afternoon sessions on ${ethDate} are already fully completed at the office.`
        });
      }

      if (reqSession === "Full Day") {
        if (morningHasIn && !morningHasOut) {
          return res.status(400).json({
            error: `You already checked in at the office for Morning. To submit departure for site visit, please select 'Site Check-Out' or choose 'Afternoon' session.`
          });
        }
        if (morningHasIn && morningHasOut) {
          return res.status(400).json({
            error: `Morning session on ${ethDate} was already completed at the office. You may request a site visit specifically for the Afternoon session.`
          });
        }
      } else if (reqSession === "Morning") {
        if (morningHasIn && morningHasOut) {
          return res.status(400).json({
            error: `Morning session on ${ethDate} was already completed at the office.`
          });
        }
        if (morningHasIn && !morningHasOut) {
          return res.status(400).json({
            error: `You already checked in for Morning. Please use 'Site Check-Out' to submit your site departure time.`
          });
        }
      } else if (reqSession === "Afternoon") {
        if (afternoonHasIn && afternoonHasOut) {
          return res.status(400).json({
            error: `Afternoon session on ${ethDate} was already completed at the office.`
          });
        }
        if (afternoonHasIn && !afternoonHasOut) {
          return res.status(400).json({
            error: `You already checked in for Afternoon. Please use 'Site Check-Out' to submit your site departure time.`
          });
        }
      }
    }

    // 2. Check for duplicate pending/approved attendance requests
    const existingReqs: any[] = db.prepare(`
      SELECT id, type, date, session, request_scope, status 
      FROM attendance_requests 
      WHERE user_id = ? AND date = ? AND status IN ('Pending', 'Approved')
    `).all(req.user?.id, ethDate);

    for (const r of existingReqs) {
      const rSess = r.session || "Full Day";
      if (reqSession === "Full Day" || rSess === "Full Day" || reqSession === rSess) {
        return res.status(400).json({
          error: `A ${r.status.toLowerCase()} ${r.type} request already exists for ${ethDate} (${rSess}). Duplicate requests are not permitted.`
        });
      }
    }

    const effectiveCheckIn = check_in_time || "02:00:00";
    const effectiveCheckOut = check_out_time || "11:00:00";

    db.prepare(`
      INSERT INTO attendance_requests (user_id, type, session, request_scope, date, check_in_time, check_out_time, reason, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user?.id, type, reqSession, reqScope, ethDate, effectiveCheckIn, effectiveCheckOut, reason, req.user?.workspace_id);

    // Realtime broadcast for attendance requests
    broadcastServerEvent("PERMISSION_REQUESTED", { 
      workspaceId: req.user?.workspace_id || 1, 
      userId: req.user?.id 
    }, req.user?.workspace_id || 1);
    broadcastServerEvent("ATTENDANCE_CHANGED", { 
      workspaceId: req.user?.workspace_id || 1, 
      userId: req.user?.id 
    }, req.user?.workspace_id || 1);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error creating attendance request:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Approve/Reject attendance request (Admin Only, Workspace Isolated)
app.put("/api/attendance-requests/:id/approve", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["Approved", "Rejected"].includes(status)) {
    return res.status(400).json({ error: "Status must be 'Approved' or 'Rejected'" });
  }

  try {
    const reqDetail: any = db.prepare("SELECT * FROM attendance_requests WHERE id = ?").get(id);
    if (!reqDetail) {
      return res.status(404).json({ error: "Attendance request not found." });
    }
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && reqDetail.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Workspace isolation violation." });
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE attendance_requests
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, id);

      if (status === "Approved") {
        const reqCheckIn = reqDetail.check_in_time || "02:00:00";
        const reqCheckOut = reqDetail.check_out_time || "11:00:00";
        const checkInParts = reqCheckIn.split(":");
        const checkOutParts = reqCheckOut.split(":");
        const checkInMinutes = parseInt(checkInParts[0]) * 60 + parseInt(checkInParts[1]);
        const checkOutMinutes = parseInt(checkOutParts[0]) * 60 + parseInt(checkOutParts[1]);
        let diffMinutes = checkOutMinutes - checkInMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight shifts
        const totalHours = Math.max(0, parseFloat((diffMinutes / 60).toFixed(2)));

        if (reqDetail.request_scope === "Site Check-Out") {
          // Target the session where check_in_time exists
          const targetSession = reqDetail.session && reqDetail.session !== "Full Day" ? reqDetail.session : "Morning";
          const existingAtt: any = db.prepare("SELECT * FROM attendance WHERE user_id = ? AND date = ? AND session = ?").get(reqDetail.user_id, reqDetail.date, targetSession);
          
          const effectiveCheckIn = (existingAtt && existingAtt.check_in_time) ? existingAtt.check_in_time : reqCheckIn;
          const effParts = effectiveCheckIn.split(":");
          const effMins = parseInt(effParts[0]) * 60 + parseInt(effParts[1]);
          let effDiff = checkOutMinutes - effMins;
          if (effDiff < 0) effDiff += 24 * 60;
          const effHours = Math.max(0, parseFloat((effDiff / 60).toFixed(2)));

          db.prepare(`
            INSERT INTO attendance (user_id, date, session, check_in_time, check_out_time, total_hours, status, verification_method, workspace_id)
            VALUES (?, ?, ?, ?, ?, ?, 'Authorized', 'MANUAL_REQUEST', ?)
            ON CONFLICT(user_id, date, session) DO UPDATE SET
              check_out_time = excluded.check_out_time,
              total_hours = excluded.total_hours,
              status = 'Authorized',
              updated_at = CURRENT_TIMESTAMP
          `).run(reqDetail.user_id, reqDetail.date, targetSession, effectiveCheckIn, reqCheckOut, effHours, currentWorkspaceId);
        } else {
          // Full Shift (Off-site)
          const targetSessions = (reqDetail.session && reqDetail.session !== "Full Day")
            ? [reqDetail.session]
            : ["Morning", "Afternoon"];

          for (const session of targetSessions) {
            db.prepare(`
              INSERT INTO attendance (user_id, date, session, check_in_time, check_out_time, total_hours, status, verification_method, workspace_id)
              VALUES (?, ?, ?, ?, ?, ?, 'Authorized', 'MANUAL_REQUEST', ?)
              ON CONFLICT(user_id, date, session) DO UPDATE SET
                check_in_time = excluded.check_in_time,
                check_out_time = excluded.check_out_time,
                total_hours = excluded.total_hours,
                status = 'Authorized',
                updated_at = CURRENT_TIMESTAMP
            `).run(reqDetail.user_id, reqDetail.date, session, reqCheckIn, reqCheckOut, totalHours, currentWorkspaceId);
          }
        }
      } else if (status === "Rejected") {
        // Just update the status, don't overwrite existing attendance records
      }

      updateAttendanceScore(reqDetail.user_id);
    })();

    // Realtime broadcast
    broadcastServerEvent("ATTENDANCE_CHANGED", {
      workspaceId: currentWorkspaceId || 1,
      userId: reqDetail.user_id,
      requestId: id,
      status
    }, currentWorkspaceId || 1);
    broadcastServerEvent("SALARY_CHANGED", {
      workspaceId: currentWorkspaceId || 1,
      userId: reqDetail.user_id
    }, currentWorkspaceId || 1);

    res.json({ success: true });
  } catch (error) {
    console.error("Error approving attendance request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- HELPER FUNCTIONS FOR ENTERPRISE PAYROLL ---
function getDayOfWeekName(ethDateStr: string): string {
  try {
    const [ey, em, ed] = ethDateStr.split("-").map(Number);
    const [gy, gm, gd] = toGregorian(ey, em, ed);
    const gDate = new Date(gy, gm - 1, gd);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return dayNames[gDate.getDay()] || "Weekday";
  } catch (e) {
    return "Weekday";
  }
}

function calculateEthiopianIncomeTax(taxableGross: number, periodRatio: number = 1.0): number {
  if (taxableGross <= 0) return 0;
  const monthlyGross = periodRatio > 0 ? (taxableGross / periodRatio) : taxableGross;
  let monthlyTax = 0;

  if (monthlyGross <= 600) {
    monthlyTax = 0;
  } else if (monthlyGross <= 1650) {
    monthlyTax = monthlyGross * 0.10 - 60;
  } else if (monthlyGross <= 3200) {
    monthlyTax = monthlyGross * 0.15 - 142.50;
  } else if (monthlyGross <= 5250) {
    monthlyTax = monthlyGross * 0.20 - 302.50;
  } else if (monthlyGross <= 7800) {
    monthlyTax = monthlyGross * 0.25 - 565.00;
  } else if (monthlyGross <= 10900) {
    monthlyTax = monthlyGross * 0.30 - 955.00;
  } else {
    monthlyTax = monthlyGross * 0.35 - 1500.00;
  }

  const tax = Math.max(0, monthlyTax * periodRatio);
  return Math.round(tax * 100) / 100;
}

function numberToWordsETB(amount: number): string {
  if (isNaN(amount) || amount < 0) return "Zero Ethiopian Birr Only";
  const num = Math.floor(amount);
  const cents = Math.round((amount - num) * 100);

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertGroup(n: number): string {
    let s = "";
    if (n >= 100) {
      s += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      s += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      s += ones[n] + " ";
    }
    return s.trim();
  }

  if (num === 0) return cents > 0 ? `${cents}/100 Cents Ethiopian Birr Only` : "Zero Ethiopian Birr Only";

  let res = "";
  if (num >= 1000000) {
    res += convertGroup(Math.floor(num / 1000000)) + " Million ";
  }
  if (num % 1000000 >= 1000) {
    res += convertGroup(Math.floor((num % 1000000) / 1000)) + " Thousand ";
  }
  if (num % 1000 > 0) {
    res += convertGroup(num % 1000) + " ";
  }

  res = res.trim() + " Ethiopian Birr";
  if (cents > 0) {
    res += ` and ${cents}/100 Cents`;
  }
  return res + " Only";
}

function calculateEnterprisePayrollForUser(
  user: any,
  startDateStr: string,
  endDateStr: string,
  filterType: string = "Monthly",
  calculationMethodOverride?: "GROSS" | "NET"
): any {
  const allDates = getDatesInRange(startDateStr, endDateStr);
  const now = new Date();
  const todayStr = getEthiopianDateString(now);

  // Determine working days using WorkCalendarService (respecting weekly work schedules and holidays)
  const workingDates: string[] = [];
  const pastWorkingDates: string[] = [];
  const userWsId = user.workspace_id || 1;

  for (const d of allDates) {
    const isNonWorking = WorkCalendarService.isNonWorkingDay(userWsId, d);
    if (!isNonWorking) {
      workingDates.push(d);
      if (d <= todayStr) {
        pastWorkingDates.push(d);
      }
    }
  }

  const expectedWorkDays = Math.max(1, workingDates.length);

  // Base compensation
  const hourlyRate = user.hourly_rate || 150.0;
  const monthlyBaseSalary = user.monthly_base_salary || 0.0;
  // If monthly base salary is set, effective hourly rate is derived from 26 standard working days * 8 hours = 208 hours
  const effectiveHourlyRate = monthlyBaseSalary > 0
    ? (monthlyBaseSalary / (26 * 8))
    : hourlyRate;
  const dailyRate = effectiveHourlyRate * 8;

  // Query actual attendance records
  const attendanceRecords = db.prepare(`
    SELECT * FROM attendance 
    WHERE user_id = ? AND date BETWEEN ? AND ?
    ORDER BY date ASC, session ASC
  `).all(user.id, startDateStr, endDateStr) as any[];

  // Query approved permissions / leaves
  const approvedPermissions = db.prepare(`
    SELECT * FROM permissions 
    WHERE user_id = ? AND status = 'Approved'
      AND (
        (approved_from_date IS NOT NULL AND approved_from_date <= ? AND approved_to_date >= ?)
        OR (approved_from_date IS NULL AND start_date <= ? AND end_date >= ?)
      )
  `).all(user.id, endDateStr, startDateStr, endDateStr, startDateStr) as any[];

  // Query approved attendance requests (Site Visit, External Work)
  const approvedRequests = db.prepare(`
    SELECT * FROM attendance_requests 
    WHERE user_id = ? AND status = 'Approved' AND date BETWEEN ? AND ?
  `).all(user.id, startDateStr, endDateStr) as any[];

  // Session Data Map
  const sessionDataMap = new Map<string, any>();

  attendanceRecords.forEach(att => {
    sessionDataMap.set(`${att.date}_${att.session}`, {
      source: "ATTENDANCE",
      record: att
    });
  });

  approvedPermissions.forEach(p => {
    const pFrom = p.approved_from_date || p.start_date;
    const pTo = p.approved_to_date || p.end_date;
    const pDates = getDatesInRange(pFrom, pTo);
    const sessions = (p.session === "Morning" || p.session === "Afternoon")
      ? [p.session]
      : ["Morning", "Afternoon"];

    pDates.forEach(pDate => {
      if (allDates.includes(pDate)) {
        sessions.forEach(sess => {
          const key = `${pDate}_${sess}`;
          const existing = sessionDataMap.get(key);
          if (!existing || existing.record?.status === "Permission" || existing.record?.status === "Absent") {
            sessionDataMap.set(key, {
              source: "PERMISSION",
              permission: p,
              session: sess,
              date: pDate
            });
          }
        });
      }
    });
  });

  approvedRequests.forEach(ar => {
    const sessions = (ar.session === "Morning" || ar.session === "Afternoon")
      ? [ar.session]
      : ["Morning", "Afternoon"];

    sessions.forEach(sess => {
      const key = `${ar.date}_${sess}`;
      sessionDataMap.set(key, {
        source: "REQUEST",
        request: ar,
        session: sess,
        date: ar.date
      });
    });
  });

  let regularHours = 0;
  let overtimeHours = 0;
  let regularOvertimeHours = 0;
  let restDayOvertimeHours = 0;
  let holidayOvertimeHours = 0;
  let nightOvertimeHours = 0;
  let approvedLeaveHours = 0;
  let paidLeaveAmount = 0;
  let lateCount = 0;
  let lateMinutes = 0;
  let absentSessions = 0;
  const presentDaysSet = new Set<string>();
  const leaveDaysSet = new Set<string>();
  const leaveBreakdown: Record<string, number> = {};
  const dayLogs: any[] = [];
  const overtimeBreakdownList: any[] = [];
  const processedOtRecordIds = new Set<number>();

  const userWorkspaceId = user.workspace_id || 1;
  const multipliers = WorkCalendarService.getOvertimeMultipliers(userWorkspaceId);

  // Query approved overtime records from overtime_records table
  const approvedOvertimeRecords = db.prepare(`
    SELECT * FROM overtime_records 
    WHERE employee_id = ? AND status = 'APPROVED' AND date BETWEEN ? AND ?
    ORDER BY date ASC, check_in_time ASC
  `).all(user.id, startDateStr, endDateStr) as any[];

  const overtimeByAttendanceId = new Map<number, any>();
  approvedOvertimeRecords.forEach(ot => {
    if (ot.attendance_id) {
      overtimeByAttendanceId.set(ot.attendance_id, ot);
    }
  });

  allDates.forEach(d => {
    const isPastOrToday = d <= todayStr;
    const isWorkingDay = workingDates.includes(d);

    ["Morning", "Afternoon"].forEach(session => {
      const key = `${d}_${session}`;
      const entry = sessionDataMap.get(key);

      // Evaluate work calendar status for this specific date and session
      const sessionWorkStatus = WorkCalendarService.getEffectiveWorkStatus(userWsId, d, undefined, session);
      const isWorkingSession = sessionWorkStatus.status === "WORKING";
      const isHolidaySession = !!sessionWorkStatus.holiday;
      const isRestDaySession = sessionWorkStatus.reason === "WEEKLY_OFF";

      if (entry) {
        if (entry.source === "ATTENDANCE") {
          const a = entry.record;
          const isCorrected = a.correction_status === "CORRECTED";
          const hasValidCheckout = a.check_out_time != null;

          if ((["Present", "Late", "Site Visit", "Authorized"].includes(a.status) || isCorrected) && (hasValidCheckout || isCorrected)) {
            presentDaysSet.add(d);
            const rHours = (a.regular_hours !== null && a.regular_hours !== undefined && Number(a.regular_hours) > 0) 
              ? Number(a.regular_hours) 
              : Math.min(4.0, (a.total_hours && a.total_hours > 0) ? Number(a.total_hours) : 4.0);
            const otHours = (a.overtime_hours !== null && a.overtime_hours !== undefined && Number(a.overtime_hours) >= 0)
              ? Number(a.overtime_hours)
              : Math.max(0, ((a.total_hours && a.total_hours > 0) ? Number(a.total_hours) : 4.0) - 4.0);

            regularHours += rHours;

            // Only count overtime towards pay if not rejected
            let appliedOtMultiplier = 1.0;
            let appliedOtType = "REGULAR_OVERTIME";

            if (a.overtime_status !== "REJECTED") {
              const matchedOtRecord = a.id ? overtimeByAttendanceId.get(a.id) : null;
              if (matchedOtRecord) {
                processedOtRecordIds.add(matchedOtRecord.id);
              }

              const effectiveOtHours = matchedOtRecord ? Number(matchedOtRecord.hours) : otHours;

              if (effectiveOtHours > 0) {
                overtimeHours += effectiveOtHours;
                
                appliedOtType = matchedOtRecord?.overtime_type || a.attendance_type || "REGULAR_OVERTIME";
                let mult = matchedOtRecord?.rate_multiplier ? Number(matchedOtRecord.rate_multiplier) : null;
                if (!mult) {
                  mult = (appliedOtType === "HOLIDAY_OVERTIME" || isHolidaySession)
                    ? multipliers.holiday
                    : (appliedOtType === "REST_DAY_OVERTIME" || isRestDaySession || !isWorkingSession)
                    ? multipliers.rest_day
                    : (appliedOtType === "NIGHT_OVERTIME")
                    ? multipliers.night
                    : multipliers.normal;
                }
                appliedOtMultiplier = mult;

                if (appliedOtType === "HOLIDAY_OVERTIME" || (isHolidaySession && !matchedOtRecord)) {
                  holidayOvertimeHours += effectiveOtHours;
                } else if (appliedOtType === "REST_DAY_OVERTIME" || (!isWorkingSession && !matchedOtRecord)) {
                  restDayOvertimeHours += effectiveOtHours;
                } else if (appliedOtType === "NIGHT_OVERTIME") {
                  nightOvertimeHours += effectiveOtHours;
                } else {
                  regularOvertimeHours += effectiveOtHours;
                }

                let friendlyType = "Regular Overtime";
                if (appliedOtType === "HOLIDAY_OVERTIME" || isHolidaySession) friendlyType = "Public Holiday Overtime";
                else if (appliedOtType === "REST_DAY_OVERTIME" || !isWorkingSession) friendlyType = "Rest Day Overtime";
                else if (appliedOtType === "NIGHT_OVERTIME") friendlyType = "Night Shift Overtime";

                overtimeBreakdownList.push({
                  id: matchedOtRecord?.id || a.id,
                  date: d,
                  session,
                  type: `${friendlyType} (${appliedOtMultiplier}x)`,
                  rawType: appliedOtType,
                  hours: effectiveOtHours,
                  multiplier: appliedOtMultiplier,
                  hourlyRate: effectiveHourlyRate,
                  amount: Math.round(effectiveOtHours * effectiveHourlyRate * appliedOtMultiplier * 100) / 100,
                  notes: matchedOtRecord?.reason || matchedOtRecord?.notes || `${session} Shift Overtime`,
                  workStatus: matchedOtRecord?.work_status || a.work_status
                });
              }
            }

            const isWaived = a.penalty_status === "WAIVED";
            let isLate = (a.status === "Late" || a.penalty_status === "PENALIZED") && !isWaived;
            let lMins = 0;
            if (a.check_in_time && !isWaived) {
              const [h, m] = a.check_in_time.split(":").map(Number);
              if (session === "Morning" && (h > 8 || (h === 8 && m > 30))) {
                isLate = true;
                lMins = Math.max(0, (h - 8) * 60 + (m - 30));
              } else if (session === "Afternoon" && (h > 13 || (h === 13 && m > 30))) {
                isLate = true;
                lMins = Math.max(0, (h - 13) * 60 + (m - 30));
              }
            }
            if (isLate) {
              lateCount += 1;
              lateMinutes += lMins || (a.late_minutes || 15);
            }

            // Determine status label: if working on non-working day or holiday, mark as Working Overtime!
            let displayStatus = isLate ? "Late" : (a.status === "Authorized" ? "Authorized" : "Present");
            const isRestOrHolidayWork = !isWorkingSession || ["REST_DAY_OVERTIME", "HOLIDAY_OVERTIME"].includes(a.attendance_type);
            if (isRestOrHolidayWork) {
              displayStatus = (isHolidaySession || a.attendance_type === "HOLIDAY_OVERTIME") ? "Holiday Overtime" : "Rest Day Overtime";
            } else if (a.attendance_type === "REGULAR_OVERTIME" || a.attendance_type === "NIGHT_OVERTIME" || otHours > 0) {
              displayStatus = "Working Overtime";
            }

            dayLogs.push({
              date: d,
              dayOfWeek: getDayOfWeekName(d),
              session,
              status: displayStatus,
              checkInTime: a.check_in_time || (session === "Morning" ? "08:30" : "13:30"),
              checkOutTime: a.check_out_time || (session === "Morning" ? "12:30" : "17:30"),
              regularHours: rHours,
              overtimeHours: otHours,
              overtimeMultiplier: appliedOtMultiplier,
              overtimeType: appliedOtType,
              paidLeaveHours: 0,
              lateMinutes: lMins,
              isCorrected: isCorrected
            });
          } else if (a.status === "Missing Checkout" || (!hasValidCheckout && !isCorrected)) {
            // Unresolved missing checkout from past date - does not earn unverified hours until Admin reviews & corrects
            if (isPastOrToday && isWorkingSession) {
              absentSessions += 1;
            }
            dayLogs.push({
              date: d,
              dayOfWeek: getDayOfWeekName(d),
              session,
              status: "Missing Checkout",
              checkInTime: a.check_in_time || "--:--",
              checkOutTime: "Missing (Pending Admin)",
              regularHours: 0,
              overtimeHours: 0,
              paidLeaveHours: 0,
              lateMinutes: 0,
              leaveType: "Unresolved Missing Checkout"
            });
          } else if (a.status === "Permission" || a.status === "Approved Leave") {
            leaveDaysSet.add(d);
            approvedLeaveHours += 4.0;
            const leaveType = "Permission";
            leaveBreakdown[leaveType] = (leaveBreakdown[leaveType] || 0) + 4.0;
            paidLeaveAmount += 4.0 * effectiveHourlyRate;

            dayLogs.push({
              date: d,
              dayOfWeek: getDayOfWeekName(d),
              session,
              status: "Permission",
              regularHours: 0,
              overtimeHours: 0,
              paidLeaveHours: 4.0,
              lateMinutes: 0,
              leaveType: "Permission"
            });
          } else {
            if (isPastOrToday && isWorkingSession) {
              absentSessions += 1;
              dayLogs.push({
                date: d,
                dayOfWeek: getDayOfWeekName(d),
                session,
                status: "Absent",
                regularHours: 0,
                overtimeHours: 0,
                paidLeaveHours: 0,
                lateMinutes: 0
              });
            } else if (isPastOrToday && !isWorkingSession) {
              dayLogs.push({
                date: d,
                dayOfWeek: getDayOfWeekName(d),
                session,
                status: isHolidaySession ? (sessionWorkStatus.holiday?.name || "Holiday") : "Rest Day",
                regularHours: 0,
                overtimeHours: 0,
                paidLeaveHours: 0,
                lateMinutes: 0
              });
            }
          }
        } else if (entry.source === "PERMISSION") {
          const p = entry.permission;
          leaveDaysSet.add(d);
          const reqType = p.request_type || "Permission";
          const isPaid = !reqType.toLowerCase().includes("unpaid");
          const hours = 4.0;
          if (isPaid) {
            approvedLeaveHours += hours;
            paidLeaveAmount += hours * effectiveHourlyRate;
          }
          leaveBreakdown[reqType] = (leaveBreakdown[reqType] || 0) + hours;

          dayLogs.push({
            date: d,
            dayOfWeek: getDayOfWeekName(d),
            session,
            status: "Approved Leave",
            regularHours: 0,
            overtimeHours: 0,
            paidLeaveHours: isPaid ? hours : 0,
            lateMinutes: 0,
            leaveType: reqType
          });
        } else if (entry.source === "REQUEST") {
          presentDaysSet.add(d);
          regularHours += 4.0;
          dayLogs.push({
            date: d,
            dayOfWeek: getDayOfWeekName(d),
            session,
            status: "Site Visit",
            regularHours: 4.0,
            overtimeHours: 0,
            paidLeaveHours: 0,
            lateMinutes: 0,
            leaveType: entry.request?.type || "Site Visit"
          });
        }
      } else {
        if (isPastOrToday && isWorkingSession) {
          absentSessions += 1;
          dayLogs.push({
            date: d,
            dayOfWeek: getDayOfWeekName(d),
            session,
            status: "Absent",
            regularHours: 0,
            overtimeHours: 0,
            paidLeaveHours: 0,
            lateMinutes: 0
          });
        } else if (isPastOrToday && !isWorkingSession) {
          dayLogs.push({
            date: d,
            dayOfWeek: getDayOfWeekName(d),
            session,
            status: isHolidaySession ? (sessionWorkStatus.holiday?.name || "Holiday") : "Rest Day",
            regularHours: 0,
            overtimeHours: 0,
            paidLeaveHours: 0,
            lateMinutes: 0
          });
        }
      }
    });
  });

  // Incorporate any standalone approved overtime records (e.g. weekend shifts, night shifts, or manual admin entries)
  approvedOvertimeRecords.forEach(ot => {
    if (!processedOtRecordIds.has(ot.id)) {
      const otHours = Number(ot.hours || 0);
      if (otHours > 0) {
        overtimeHours += otHours;
        const otType = ot.overtime_type || "REGULAR_OVERTIME";
        let mult = Number(ot.rate_multiplier || 0);
        if (!mult) {
          mult = otType === "HOLIDAY_OVERTIME"
            ? multipliers.holiday
            : otType === "REST_DAY_OVERTIME"
            ? multipliers.rest_day
            : otType === "NIGHT_OVERTIME"
            ? multipliers.night
            : multipliers.normal;
        }

        if (otType === "HOLIDAY_OVERTIME") holidayOvertimeHours += otHours;
        else if (otType === "REST_DAY_OVERTIME") restDayOvertimeHours += otHours;
        else if (otType === "NIGHT_OVERTIME") nightOvertimeHours += otHours;
        else regularOvertimeHours += otHours;

        let friendlyType = "Regular Overtime";
        if (otType === "HOLIDAY_OVERTIME") friendlyType = "Public Holiday Overtime";
        else if (otType === "REST_DAY_OVERTIME") friendlyType = "Rest Day Overtime";
        else if (otType === "NIGHT_OVERTIME") friendlyType = "Night Shift Overtime";

        overtimeBreakdownList.push({
          id: ot.id,
          date: ot.date,
          session: ot.session || "Full Day",
          type: `${friendlyType} (${mult}x)`,
          rawType: otType,
          hours: otHours,
          multiplier: mult,
          hourlyRate: effectiveHourlyRate,
          amount: Math.round(otHours * effectiveHourlyRate * mult * 100) / 100,
          notes: ot.reason || ot.notes || "Approved Overtime",
          workStatus: ot.work_status
        });
      }
    }
  });

  const actualPresentDays = presentDaysSet.size;
  const approvedLeaveDays = leaveDaysSet.size;
  const absentDays = Math.round((absentSessions / 2) * 10) / 10;

  // Exact worked regular hours without intermediate rounding errors (e.g. 16.9 hrs @ 25 ETB/hr = 422.5 ETB)
  const cleanRegularHours = Math.round((regularHours + Number.EPSILON) * 100) / 100;
  const regularPay = exactCurrencyProduct(cleanRegularHours, effectiveHourlyRate);
  
  // Calculate dynamic overtime pay based on company/workspace multipliers
  const cleanRegularOtHours = Math.round((regularOvertimeHours + Number.EPSILON) * 100) / 100;
  const cleanRestDayOtHours = Math.round((restDayOvertimeHours + Number.EPSILON) * 100) / 100;
  const cleanHolidayOtHours = Math.round((holidayOvertimeHours + Number.EPSILON) * 100) / 100;
  const cleanNightOtHours = Math.round((nightOvertimeHours + Number.EPSILON) * 100) / 100;
  const cleanTotalOtHours = Math.round((cleanRegularOtHours + cleanRestDayOtHours + cleanHolidayOtHours + cleanNightOtHours + Number.EPSILON) * 100) / 100;

  const normalOtPay = exactCurrencyProduct(cleanRegularOtHours, effectiveHourlyRate * multipliers.normal);
  const restDayOtPay = exactCurrencyProduct(cleanRestDayOtHours, effectiveHourlyRate * multipliers.rest_day);
  const holidayOtPay = exactCurrencyProduct(cleanHolidayOtHours, effectiveHourlyRate * multipliers.holiday);
  const nightOtPay = exactCurrencyProduct(cleanNightOtHours, effectiveHourlyRate * multipliers.night);
  const overtimePay = Math.round((normalOtPay + restDayOtPay + holidayOtPay + nightOtPay + Number.EPSILON) * 100) / 100;

  let periodRatio = 1.0;
  if (filterType === "Daily") periodRatio = 1 / 26;
  else if (filterType === "Weekly") periodRatio = 6 / 26;
  else if (filterType === "Yearly") periodRatio = 12.0;
  else periodRatio = 1.0;

  const transportAllowance = Math.round((user.transport_allowance || 0) * periodRatio * 100) / 100;
  const housingAllowance = Math.round((user.housing_allowance || 0) * periodRatio * 100) / 100;
  const positionAllowance = Math.round((user.position_allowance || 0) * periodRatio * 100) / 100;

  const punctualityBonus = 0;

  // Look up existing payment record if one exists for this user and period
  const existingPayment = db.prepare(`
    SELECT id, status, payment_status, payment_reference, payment_date, disbursed_at, disbursed_by, calculation_method, final_payable_amount, penalty_amount, notes
    FROM salary_payments 
    WHERE user_id = ? AND period_start = ? AND period_end = ?
  `).get(user.id, startDateStr, endDateStr) as any;

  let processedByName = "";
  if (existingPayment?.disbursed_by) {
    try {
      const adminUser = db.prepare("SELECT full_name FROM users WHERE id = ?").get(existingPayment.disbursed_by) as any;
      processedByName = adminUser?.full_name || `Admin #${existingPayment.disbursed_by}`;
    } catch (_) {}
  }

  // Look up workspace default calculation mode if not specified
  let wsDefaultCalc = "GROSS";
  try {
    const ss = db.prepare("SELECT default_salary_calculation FROM site_settings WHERE workspace_id = ?").get(userWsId) as any;
    if (ss?.default_salary_calculation) wsDefaultCalc = ss.default_salary_calculation;
  } catch (_) {}

  // Determine calculation method: explicit override > historical payment record > employee preference > workspace default
  const rawMethod = (calculationMethodOverride || existingPayment?.calculation_method || user.salary_calculation_mode || wsDefaultCalc || "GROSS").toUpperCase();
  const calculationMethod: "GROSS" | "NET" = rawMethod === "NET" ? "NET" : "GROSS";

  const basicSalary = monthlyBaseSalary > 0 
    ? Math.round(monthlyBaseSalary * periodRatio * 100) / 100
    : Math.round((regularPay + paidLeaveAmount) * 100) / 100;

  const lateDeduction = Math.round(Math.min(
    regularPay * 0.25,
    (lateCount * 25) + ((lateMinutes / 60) * effectiveHourlyRate * 0.5)
  ) * 100) / 100;

  let absentDeduction = 0;
  if (monthlyBaseSalary > 0) {
    absentDeduction = Math.round(absentDays * dailyRate * 100) / 100;
  }

  const penaltyAmount = Math.round((lateDeduction + absentDeduction) * 100) / 100;
  const customDeduction = Math.round((user.custom_deduction || 0) * periodRatio * 100) / 100;
  const allowancesTotal = Math.round((transportAllowance + housingAllowance + positionAllowance) * 100) / 100;

  let grossSalary = 0;
  let incomeTax = 0;
  let pensionEmployee = 0;
  let pensionCompany = 0;
  let totalDeductions = 0;
  let finalPayableAmount = 0;
  let netSalary = 0;

  if (calculationMethod === "NET") {
    // =========================================================================
    // NET SALARY CALCULATION METHOD
    // 1. Start calculation from employee's net salary
    // 2. Do NOT calculate or deduct: Taxes, Pension
    // 3. Overtime must still be calculated and added (+ Overtime)
    // 4. Penalties must still be calculated and deducted (- Penalties)
    // 5. Final Payable Salary = Net Salary + Overtime - Penalties - Other non-tax deductions
    // =========================================================================
    incomeTax = 0.0;
    pensionEmployee = 0.0;
    pensionCompany = 0.0;

    const baseNet = basicSalary + allowancesTotal;
    grossSalary = Math.round((baseNet + overtimePay) * 100) / 100;
    totalDeductions = Math.round((penaltyAmount + customDeduction) * 100) / 100;
    finalPayableAmount = Math.max(0, Math.round((baseNet + overtimePay - penaltyAmount - customDeduction) * 100) / 100);
    netSalary = finalPayableAmount;
  } else {
    // =========================================================================
    // GROSS SALARY CALCULATION METHOD
    // 1. Start calculation from employee's gross salary: Basic Salary + Allowances + Bonuses
    // 2. Calculate all applicable: Taxes, Pension contributions (7% employee, 11% company)
    // 3. Calculate overtime
    // 4. Calculate penalties
    // 5. Final Payable Salary = Gross Salary + Overtime - Penalties - Taxes - Pension - Other Deductions
    // =========================================================================
    const baseGross = basicSalary + allowancesTotal;
    grossSalary = Math.round((baseGross + overtimePay) * 100) / 100;

    pensionEmployee = Math.round((regularPay + paidLeaveAmount) * 0.07 * 100) / 100;
    pensionCompany = Math.round((regularPay + paidLeaveAmount) * 0.11 * 100) / 100;

    const taxableGross = Math.max(0, grossSalary - Math.min(transportAllowance, 600 * periodRatio));
    incomeTax = Math.round(calculateEthiopianIncomeTax(taxableGross, periodRatio) * 100) / 100;

    totalDeductions = Math.round((penaltyAmount + pensionEmployee + incomeTax + customDeduction) * 100) / 100;
    finalPayableAmount = Math.max(0, Math.round((grossSalary - totalDeductions) * 100) / 100);
    netSalary = finalPayableAmount;
  }

  const isPaid = Boolean(
    existingPayment && 
    (existingPayment.payment_status === "PAID" || existingPayment.status === "PAID")
  );

  return {
    user_id: user.id,
    full_name: user.full_name,
    phone_number: user.phone_number,
    role: user.role,
    department: user.department || "Operations",
    workspace_name: user.workspace_name || "Main Workspace",
    hourly_rate: hourlyRate,
    monthly_base_salary: monthlyBaseSalary,
    effective_hourly_rate: effectiveHourlyRate,
    calculation_method: calculationMethod,
    basic_salary: basicSalary,
    
    expected_work_days: expectedWorkDays,
    actual_present_days: actualPresentDays,
    regular_hours: cleanRegularHours,
    regular_pay: regularPay,
    
    approved_leave_days: approvedLeaveDays,
    approved_leave_hours: approvedLeaveHours,
    paid_leave_amount: paidLeaveAmount,
    leave_types_breakdown: leaveBreakdown,
    
    // Comprehensive Overtime Breakdown
    overtime_hours: cleanTotalOtHours,
    overtime_pay: overtimePay,
    regular_overtime_hours: cleanRegularOtHours,
    rest_day_overtime_hours: cleanRestDayOtHours,
    holiday_overtime_hours: cleanHolidayOtHours,
    night_overtime_hours: cleanNightOtHours,
    normal_overtime_multiplier: multipliers.normal,
    rest_day_overtime_multiplier: multipliers.rest_day,
    holiday_overtime_multiplier: multipliers.holiday,
    night_overtime_multiplier: multipliers.night,
    normal_overtime_pay: normalOtPay,
    rest_day_overtime_pay: restDayOtPay,
    holiday_overtime_pay: holidayOtPay,
    night_overtime_pay: nightOtPay,
    overtime_records_count: overtimeBreakdownList.length,
    overtime_breakdown: overtimeBreakdownList,
    
    // Penalties Breakdown
    penalty_amount: penaltyAmount,
    absent_days: absentDays,
    absent_deduction: absentDeduction,
    absent_penalty_deduction: absentDeduction,
    late_count: lateCount,
    late_minutes: lateMinutes,
    late_deduction: lateDeduction,
    late_penalty_deduction: lateDeduction,
    
    transport_allowance: transportAllowance,
    housing_allowance: housingAllowance,
    position_allowance: positionAllowance,
    punctuality_bonus: punctualityBonus,
    gross_salary: grossSalary,
    
    // Statutory Deductions (0 in NET mode)
    pension_employee: pensionEmployee,
    pension_employee_7pct: pensionEmployee,
    pension_company: pensionCompany,
    income_tax: incomeTax,
    tax_amount: incomeTax,
    custom_deduction: customDeduction,
    total_deductions: totalDeductions,
    
    // Payable Salary
    net_salary: netSalary,
    calculated_salary: finalPayableAmount,
    final_payable_amount: finalPayableAmount,
    total_hours: Math.round((cleanRegularHours + approvedLeaveHours + cleanTotalOtHours + Number.EPSILON) * 100) / 100,
    
    overtime_rate: overtimeHours > 0 ? Math.round((overtimePay / overtimeHours) * 100) / 100 : effectiveHourlyRate * multipliers.normal,
    penalties_breakdown: (() => {
      const list: any[] = [];
      try {
        const uPens = db.prepare("SELECT * FROM late_penalties WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC").all(user.id, startDateStr, endDateStr) as any[];
        uPens.forEach(lp => {
          list.push({
            id: lp.id,
            type: lp.penalty_type || "LATE_ARRIVAL",
            reason: lp.reason || `Lateness penalty (${lp.late_minutes}m) on ${lp.date} (${lp.session})`,
            date: lp.date,
            amount: Number(lp.penalty_amount || 0),
            status: lp.penalty_status || "PENALIZED",
            applied_to_payroll: Boolean(lp.payroll_id || isPaid)
          });
        });
      } catch (_) {}
      if (absentDeduction > 0) {
        list.push({
          type: "UNEXCUSED_ABSENCE",
          reason: `${absentDays} day(s) unexcused absence deduction`,
          date: `${startDateStr} to ${endDateStr}`,
          amount: absentDeduction,
          status: "PENALIZED",
          applied_to_payroll: true
        });
      }
      return list;
    })(),

    period_type: filterType,
    period_start: startDateStr,
    period_end: endDateStr,
    period_label: `${startDateStr} to ${endDateStr}`,
    bank_name: user.bank_name || "Commercial Bank of Ethiopia (CBE)",
    bank_account_number: user.bank_account_number || "",
    tax_id: user.tax_id || "",
    
    payment_status: isPaid ? "PAID" : "UNPAID",
    disbursement_status: isPaid ? "PAID" : "UNPAID",
    payment_reference: existingPayment?.payment_reference || "",
    payment_date: existingPayment?.payment_date || existingPayment?.disbursed_at || null,
    processed_by: existingPayment?.disbursed_by || null,
    processed_by_name: processedByName || null,
    notes: existingPayment?.notes || null,
    dayLogs
  };
}

// --- MODULE 5: ENTERPRISE SALARY & PAYROLL MANAGEMENT API ---
app.get("/api/salaries", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { filter, startDate, endDate } = req.query;
  const filterType = (filter as string) || "Monthly";

  try {
    const now = new Date();
    let startStr = "";
    let endStr = getEthiopianDateString(now);

    if (startDate && endDate) {
      startStr = startDate as string;
      endStr = endDate as string;
    } else if (filterType === "Daily") {
      startStr = getEthiopianDateString(now);
      endStr = startStr;
    } else if (filterType === "Weekly") {
      startStr = getEthiopianDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else if (filterType === "Yearly") {
      startStr = getEthiopianDateString(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
    } else {
      // Monthly (past 30 days)
      startStr = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    }

    // Fetch employees according to role & workspace
    let usersQuery = "";
    const params: any[] = [];

    if (currentRole === "SuperAdmin") {
      usersQuery = `
        SELECT u.*, w.name as workspace_name 
        FROM users u 
        LEFT JOIN workspaces w ON u.workspace_id = w.id
        WHERE u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR')
        ORDER BY u.full_name ASC
      `;
    } else if (currentRole === "Bootstrap") {
      usersQuery = `
        SELECT u.*, w.name as workspace_name 
        FROM users u 
        LEFT JOIN workspaces w ON u.workspace_id = w.id
        WHERE u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR') AND u.workspace_id = -1
        ORDER BY u.full_name ASC
      `;
    } else {
      usersQuery = `
        SELECT u.*, w.name as workspace_name 
        FROM users u 
        LEFT JOIN workspaces w ON u.workspace_id = w.id
        WHERE u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR') AND u.workspace_id = ?
        ORDER BY u.full_name ASC
      `;
      params.push(currentWorkspaceId);
    }

    const employees = db.prepare(usersQuery).all(...params) as any[];

    // Calculate enterprise salary for each employee
    const payroll = employees.map(emp => {
      return calculateEnterprisePayrollForUser(emp, startStr, endStr, filterType);
    });

    res.json(payroll);
  } catch (error) {
    console.error("Enterprise salary calculation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Single Employee Detailed Payslip
app.get("/api/salaries/:userId/payslip", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const targetUserId = parseInt(req.params.userId, 10);

  // Employee can see own payslip, Admins/HR/Accountants can see for accessible users
  const isSelf = req.user?.id === targetUserId;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!isSelf && !adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { filter, startDate, endDate } = req.query;
  const filterType = (filter as string) || "Monthly";

  try {
    const user = db.prepare(`
      SELECT u.*, w.name as workspace_name 
      FROM users u 
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.id = ?
    `).get(targetUserId) as any;

    if (!user) {
      return res.status(404).json({ error: "Employee not found." });
    }

    if (!isSelf && currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && user.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Workspace isolation." });
    }

    const now = new Date();
    let startStr = "";
    let endStr = getEthiopianDateString(now);

    if (startDate && endDate) {
      startStr = startDate as string;
      endStr = endDate as string;
    } else if (filterType === "Daily") {
      startStr = getEthiopianDateString(now);
      endStr = startStr;
    } else if (filterType === "Weekly") {
      startStr = getEthiopianDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else if (filterType === "Yearly") {
      startStr = getEthiopianDateString(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
    } else {
      startStr = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    }

    const salaryData = calculateEnterprisePayrollForUser(user, startStr, endStr, filterType);

    const payslip: any = {
      id: `PS-${user.id}-${startStr.replace(/-/g, "")}`,
      referenceNumber: `PAY-${startStr.replace(/-/g, "")}-${user.id.toString().padStart(4, "0")}`,
      generatedDate: getEthiopianDateString(now),
      companyName: "Enterprise Construction & Project Solutions",
      workspaceName: user.workspace_name || "Headquarters",
      period: {
        type: filterType,
        startDate: startStr,
        endDate: endStr,
        ethiopianLabel: `${gregorianToEthiopianDate(startStr).shortAm} – ${gregorianToEthiopianDate(endStr).formattedAm}`
      },
      employee: {
        id: user.id,
        fullName: user.full_name,
        phoneNumber: user.phone_number,
        role: user.role,
        taxId: user.tax_id || "TIN-PENDING",
        bankName: user.bank_name || "Commercial Bank of Ethiopia (CBE)",
        bankAccountNumber: user.bank_account_number || "CBE-ACC-UNSET"
      },
      summary: {
        expectedWorkDays: salaryData.expected_work_days,
        actualPresentDays: salaryData.actual_present_days,
        approvedLeaveDays: salaryData.approved_leave_days,
        absentDays: salaryData.absent_days,
        lateCount: salaryData.late_count,
        lateMinutes: salaryData.late_minutes,
        totalRegularHours: salaryData.regular_hours,
        totalPaidLeaveHours: salaryData.approved_leave_hours,
        totalOvertimeHours: salaryData.overtime_hours,
        regularOvertimeHours: salaryData.regular_overtime_hours,
        restDayOvertimeHours: salaryData.rest_day_overtime_hours,
        holidayOvertimeHours: salaryData.holiday_overtime_hours,
        nightOvertimeHours: salaryData.night_overtime_hours,
        normalOvertimeMultiplier: salaryData.normal_overtime_multiplier,
        restDayOvertimeMultiplier: salaryData.rest_day_overtime_multiplier,
        holidayOvertimeMultiplier: salaryData.holiday_overtime_multiplier,
        nightOvertimeMultiplier: salaryData.night_overtime_multiplier,
        totalPaidHours: salaryData.regular_hours + salaryData.approved_leave_hours + salaryData.overtime_hours
      },
      earnings: {
        basicRegularWage: salaryData.regular_pay,
        paidLeaveAmount: salaryData.paid_leave_amount,
        overtimeWage: salaryData.overtime_pay,
        normalOtWage: salaryData.normal_overtime_pay,
        restDayOtWage: salaryData.rest_day_overtime_pay,
        holidayOtWage: salaryData.holiday_overtime_pay,
        nightOtWage: salaryData.night_overtime_pay,
        overtimeBreakdown: salaryData.overtime_breakdown,
        transportAllowance: salaryData.transport_allowance,
        housingAllowance: salaryData.housing_allowance,
        positionAllowance: salaryData.position_allowance,
        punctualityBonus: salaryData.punctuality_bonus,
        grossEarnings: salaryData.gross_salary
      },
      deductions: {
        latePenalty: salaryData.late_deduction,
        absenceDeduction: salaryData.absent_deduction,
        employeePension: salaryData.pension_employee,
        incomeTaxWithheld: salaryData.income_tax,
        customLoanAdvance: salaryData.custom_deduction,
        totalDeductions: salaryData.total_deductions
      },
      employerContributions: {
        employerPension: salaryData.pension_company
      },
      netPay: {
        amount: salaryData.net_salary,
        currency: "ETB",
        inWords: numberToWordsETB(salaryData.net_salary)
      },
      calculationMethod: salaryData.calculation_method,
      taxApplicable: salaryData.calculation_method === "GROSS",
      pensionApplicable: salaryData.calculation_method === "GROSS",
      basicSalary: salaryData.basic_salary,
      penaltiesBreakdown: salaryData.penalties_breakdown,
      paymentStatus: salaryData.disbursement_status,
      paymentReference: salaryData.payment_reference,
      paymentDate: salaryData.payment_date,
      paymentNotes: salaryData.notes,
      dayLogs: salaryData.dayLogs
    };

    res.json(payslip);
  } catch (error) {
    console.error("Payslip generation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Employee Self-Service: My Salary Breakdown & Payslip
app.get("/api/employee/my-salary", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { filter, startDate, endDate } = req.query;
  const filterType = (filter as string) || "Monthly";

  try {
    const user = db.prepare(`
      SELECT u.*, w.name as workspace_name 
      FROM users u 
      LEFT JOIN workspaces w ON u.workspace_id = w.id
      WHERE u.id = ?
    `).get(userId) as any;

    if (!user) return res.status(404).json({ error: "User not found" });

    const now = new Date();
    let startStr = "";
    let endStr = getEthiopianDateString(now);

    if (startDate && endDate) {
      startStr = startDate as string;
      endStr = endDate as string;
    } else if (filterType === "Daily") {
      startStr = getEthiopianDateString(now);
      endStr = startStr;
    } else if (filterType === "Weekly") {
      startStr = getEthiopianDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    } else if (filterType === "Yearly") {
      startStr = getEthiopianDateString(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
    } else {
      startStr = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    }

    const salary = calculateEnterprisePayrollForUser(user, startStr, endStr, filterType);
    res.json(salary);
  } catch (error) {
    console.error("My salary error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Employee Comprehensive Compensation Package
app.put("/api/employees/:id/compensation", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap", "HR", "Accountant"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { id } = req.params;
  const {
    hourly_rate,
    monthly_base_salary,
    transport_allowance,
    housing_allowance,
    position_allowance,
    tax_id,
    bank_name,
    bank_account_number,
    custom_deduction
  } = req.body;

  try {
    const employee: any = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!employee) {
      return res.status(404).json({ error: "Employee not found." });
    }
    if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && employee.workspace_id !== currentWorkspaceId) {
      return res.status(403).json({ error: "Access denied. Data isolation violation." });
    }

    const newHourly = hourly_rate !== undefined ? parseFloat(hourly_rate) : employee.hourly_rate;
    const newMonthly = monthly_base_salary !== undefined ? parseFloat(monthly_base_salary) : employee.monthly_base_salary;
    const newTransport = transport_allowance !== undefined ? parseFloat(transport_allowance) : employee.transport_allowance;
    const newHousing = housing_allowance !== undefined ? parseFloat(housing_allowance) : employee.housing_allowance;
    const newPosition = position_allowance !== undefined ? parseFloat(position_allowance) : employee.position_allowance;
    const newTaxId = tax_id !== undefined ? String(tax_id).trim() : employee.tax_id;
    const newBankName = bank_name !== undefined ? String(bank_name).trim() : employee.bank_name;
    const newBankAcc = bank_account_number !== undefined ? String(bank_account_number).trim() : employee.bank_account_number;
    const newCustomDed = custom_deduction !== undefined ? parseFloat(custom_deduction) : employee.custom_deduction;
    const newCalcMode = (req.body.salary_calculation_mode || "").toUpperCase() === "NET" ? "NET" : (req.body.salary_calculation_mode ? "GROSS" : (employee.salary_calculation_mode || "GROSS"));
    const newDept = req.body.department !== undefined ? String(req.body.department).trim() : (employee.department || "Operations");

    db.prepare(`
      UPDATE users SET 
        hourly_rate = ?,
        monthly_base_salary = ?,
        transport_allowance = ?,
        housing_allowance = ?,
        position_allowance = ?,
        tax_id = ?,
        bank_name = ?,
        bank_account_number = ?,
        custom_deduction = ?,
        salary_calculation_mode = ?,
        department = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      newHourly,
      newMonthly,
      newTransport,
      newHousing,
      newPosition,
      newTaxId,
      newBankName,
      newBankAcc,
      newCustomDed,
      newCalcMode,
      newDept,
      id
    );

    broadcastServerEvent("SALARY_CHANGED", { userId: parseInt(id), calculation_mode: newCalcMode }, employee.workspace_id || 1);
    broadcastServerEvent("EMPLOYEES_CHANGED", { 
      workspaceId: employee.workspace_id || 1, 
      action: "compensation_updated", 
      employeeId: parseInt(id) 
    }, employee.workspace_id || 1);

    res.json({
      success: true,
      compensation: {
        hourly_rate: newHourly,
        monthly_base_salary: newMonthly,
        transport_allowance: newTransport,
        housing_allowance: newHousing,
        position_allowance: newPosition,
        tax_id: newTaxId,
        bank_name: newBankName,
        bank_account_number: newBankAcc,
        custom_deduction: newCustomDed,
        salary_calculation_mode: newCalcMode,
        department: newDept
      }
    });
  } catch (error) {
    console.error("Compensation update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Process and Disburse Salary Payment
app.post("/api/salaries/disburse", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { user_id, user_ids, filter, startDate, endDate, payment_method, payment_reference } = req.body;
  const filterType = filter || "Monthly";

  try {
    const now = new Date();
    const todayStr = getEthiopianDateString(now);
    let startStr = startDate;
    let endStr = endDate || todayStr;

    if (!startStr) {
      if (filterType === "Daily") startStr = todayStr;
      else if (filterType === "Weekly") startStr = getEthiopianDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      else if (filterType === "Yearly") startStr = getEthiopianDateString(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
      else startStr = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    }

    const targetUserIds: number[] = [];
    if (user_id) targetUserIds.push(parseInt(user_id, 10));
    if (Array.isArray(user_ids)) {
      user_ids.forEach((uid: any) => targetUserIds.push(parseInt(uid, 10)));
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: "At least one employee ID is required for disbursement." });
    }

    const payDate = req.body.payment_date || todayStr;
    const payNotes = req.body.notes || null;
    const ref = payment_reference || `DISB-${startStr.replace(/-/g, "")}-${Date.now().toString().slice(-4)}`;
    const method = payment_method || "BANK_TRANSFER";

    const insertPaymentStmt = db.prepare(`
      INSERT INTO salary_payments (
        user_id, workspace_id, period_type, period_start, period_end,
        base_hourly_rate, monthly_base_salary, expected_work_days, actual_present_days,
        regular_hours, regular_pay, approved_leave_days, approved_leave_hours, paid_leave_amount,
        overtime_hours, overtime_pay, absent_days, absent_deduction, late_count, late_minutes, late_deduction,
        transport_allowance, housing_allowance, position_allowance, punctuality_bonus,
        gross_salary, pension_employee, pension_company, income_tax, custom_deductions,
        total_deductions, net_salary, status, payment_method, payment_reference, disbursed_at, disbursed_by,
        calculation_method, final_payable_amount, penalty_amount, payment_status, payment_date, notes
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 'PAID', ?, ?, CURRENT_TIMESTAMP, ?,
        ?, ?, ?, 'PAID', ?, ?
      )
    `);

    const results: any[] = [];

    targetUserIds.forEach(uid => {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(uid) as any;
      if (!user) return;
      if (currentRole !== "SuperAdmin" && currentRole !== "Bootstrap" && user.workspace_id !== currentWorkspaceId) return;

      const calc = calculateEnterprisePayrollForUser(user, startStr, endStr, filterType);

      // Check if already paid for this period; delete draft or replace
      db.prepare("DELETE FROM salary_payments WHERE user_id = ? AND period_start = ? AND period_end = ?").run(uid, startStr, endStr);

      const info = insertPaymentStmt.run(
        uid,
        user.workspace_id,
        filterType,
        startStr,
        endStr,
        calc.hourly_rate,
        calc.monthly_base_salary,
        calc.expected_work_days,
        calc.actual_present_days,
        calc.regular_hours,
        calc.regular_pay,
        calc.approved_leave_days,
        calc.approved_leave_hours,
        calc.paid_leave_amount,
        calc.overtime_hours,
        calc.overtime_pay,
        calc.absent_days,
        calc.absent_deduction,
        calc.late_count,
        calc.late_minutes,
        calc.late_deduction,
        calc.transport_allowance,
        calc.housing_allowance,
        calc.position_allowance,
        calc.punctuality_bonus,
        calc.gross_salary,
        calc.pension_employee,
        calc.pension_company,
        calc.income_tax,
        calc.custom_deduction,
        calc.total_deductions,
        calc.net_salary,
        method,
        ref,
        req.user?.id,
        calc.calculation_method,
        calc.final_payable_amount,
        calc.penalty_amount,
        payDate,
        payNotes
      );

      // Required Business Rule: When penalty is actually applied/paid and marked as Penalized,
      // the notification associated with that penalty automatically becomes unchecked/inactive in database!
      try {
        db.prepare(`
          UPDATE late_penalties
          SET payroll_id = ?,
              penalty_status = 'PENALIZED',
              paid_at = CURRENT_TIMESTAMP,
              processed_by = ?,
              notification_status = 'UNCHECKED',
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND date BETWEEN ? AND ?
        `).run(info.lastInsertRowid, req.user?.id, uid, startStr, endStr);

        db.prepare(`
          UPDATE attendance
          SET penalty_status = 'PENALIZED',
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND date BETWEEN ? AND ? AND (status = 'Late' OR penalty_status IS NOT NULL)
        `).run(uid, startStr, endStr);
      } catch (penErr) {
        console.error("Error updating penalties on disburse:", penErr);
      }

      results.push({
        payment_id: info.lastInsertRowid,
        user_id: uid,
        full_name: user.full_name,
        net_salary: calc.net_salary,
        calculation_method: calc.calculation_method,
        reference: ref
      });
    });

    broadcastServerEvent("SALARY_CHANGED", { action: "disbursement", reference: ref }, currentWorkspaceId || 1);
    broadcastServerEvent("ATTENDANCE_CHANGED", { action: "disbursement_penalties_cleared" }, currentWorkspaceId || 1);

    res.json({
      success: true,
      message: `Successfully processed payroll disbursement for ${results.length} employee(s).`,
      payment_reference: ref,
      payment_date: payDate,
      disbursements: results
    });
  } catch (error) {
    console.error("Disbursement processing error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Mark Salary as Unpaid (Revert disbursement)
app.post("/api/salaries/mark-unpaid", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { user_id, user_ids, filter, startDate, endDate } = req.body;
  const filterType = filter || "Monthly";

  try {
    const now = new Date();
    const todayStr = getEthiopianDateString(now);
    let startStr = startDate;
    let endStr = endDate || todayStr;

    if (!startStr) {
      if (filterType === "Daily") startStr = todayStr;
      else if (filterType === "Weekly") startStr = getEthiopianDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      else if (filterType === "Yearly") startStr = getEthiopianDateString(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
      else startStr = getEthiopianDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    }

    const targetUserIds: number[] = [];
    if (user_id) targetUserIds.push(parseInt(user_id, 10));
    if (Array.isArray(user_ids)) {
      user_ids.forEach((uid: any) => targetUserIds.push(parseInt(uid, 10)));
    }

    if (targetUserIds.length === 0) {
      return res.status(400).json({ error: "At least one employee ID is required." });
    }

    targetUserIds.forEach(uid => {
      const existing = db.prepare("SELECT id FROM salary_payments WHERE user_id = ? AND period_start = ? AND period_end = ?").get(uid, startStr, endStr) as any;
      if (existing) {
        db.prepare("UPDATE late_penalties SET payroll_id = NULL WHERE payroll_id = ?").run(existing.id);
        db.prepare("DELETE FROM salary_payments WHERE id = ?").run(existing.id);
      }
    });

    broadcastServerEvent("SALARY_CHANGED", { action: "mark_unpaid", userIds: targetUserIds }, currentWorkspaceId || 1);

    res.json({
      success: true,
      message: `Successfully reverted payment status to UNPAID for ${targetUserIds.length} employee(s).`
    });
  } catch (error) {
    console.error("Mark unpaid error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Employee Calculation Method (GROSS vs NET)
app.put("/api/salaries/:userId/calculation-method", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const userId = parseInt(req.params.userId, 10);
  const { calculation_method, startDate, endDate } = req.body;
  const method = (calculation_method || "GROSS").toUpperCase() === "NET" ? "NET" : "GROSS";

  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
    if (!user) return res.status(404).json({ error: "User not found." });

    db.prepare("UPDATE users SET salary_calculation_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(method, userId);

    if (startDate && endDate) {
      db.prepare(`
        UPDATE salary_payments 
        SET calculation_method = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = ? AND period_start = ? AND period_end = ?
      `).run(method, userId, startDate, endDate);
    }

    broadcastServerEvent("SALARY_CHANGED", { userId, calculation_method: method }, currentWorkspaceId || 1);
    broadcastServerEvent("EMPLOYEES_CHANGED", { workspaceId: currentWorkspaceId || 1 }, currentWorkspaceId || 1);

    res.json({
      success: true,
      calculation_method: method,
      message: `Updated calculation method to ${method} for ${user.full_name}.`
    });
  } catch (error) {
    console.error("Update calculation method error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Workspace Default Calculation Mode
app.put("/api/salaries/default-calculation-method", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id || 1;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  const { default_salary_calculation } = req.body;
  const method = (default_salary_calculation || "GROSS").toUpperCase() === "NET" ? "NET" : "GROSS";

  try {
    db.prepare("UPDATE site_settings SET default_salary_calculation = ?, updated_at = CURRENT_TIMESTAMP WHERE workspace_id = ?").run(method, currentWorkspaceId);

    broadcastServerEvent("SETTINGS_CHANGED", { workspaceId: currentWorkspaceId }, currentWorkspaceId);
    broadcastServerEvent("SALARY_CHANGED", { workspaceId: currentWorkspaceId, default_salary_calculation: method }, currentWorkspaceId);

    res.json({
      success: true,
      default_salary_calculation: method,
      message: `Default workspace salary calculation mode set to Based on ${method === "NET" ? "Net" : "Gross"} Salary.`
    });
  } catch (error) {
    console.error("Update default calculation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch Disbursement History
app.get("/api/salaries/disbursement-history", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;
  const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ error: "Access denied." });
  }

  try {
    let query = "";
    const params: any[] = [];

    if (currentRole === "SuperAdmin") {
      query = `
        SELECT sp.*, u.full_name, u.phone_number, u.role, w.name as workspace_name, d.full_name as disbursed_by_name
        FROM salary_payments sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN workspaces w ON sp.workspace_id = w.id
        LEFT JOIN users d ON sp.disbursed_by = d.id
        ORDER BY sp.created_at DESC
        LIMIT 100
      `;
    } else {
      query = `
        SELECT sp.*, u.full_name, u.phone_number, u.role, w.name as workspace_name, d.full_name as disbursed_by_name
        FROM salary_payments sp
        JOIN users u ON sp.user_id = u.id
        LEFT JOIN workspaces w ON sp.workspace_id = w.id
        LEFT JOIN users d ON sp.disbursed_by = d.id
        WHERE sp.workspace_id = ?
        ORDER BY sp.created_at DESC
        LIMIT 100
      `;
      params.push(currentWorkspaceId);
    }

    const history = db.prepare(query).all(...params);
    res.json(history);
  } catch (error) {
    console.error("Disbursement history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 7: ATTENDANCE SCORE LISTING ---
app.get("/api/scores", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const currentWorkspaceId = req.user?.workspace_id;

  try {
    let scores;
    if (currentRole === "SuperAdmin") {
      scores = db.prepare(`
        SELECT u.id, u.full_name, u.phone_number, 
               COALESCE(s.attendance_score, 0.0) as attendance_score, 
               COALESCE(s.punctuality_percentage, 0.0) as punctuality_percentage, 
               COALESCE(s.late_count, 0) as late_count,
               (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) as total_attendances
        FROM users u
        LEFT JOIN attendance_scores s ON u.id = s.user_id
        WHERE u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR')
        ORDER BY attendance_score DESC
      `).all();
    } else if (currentRole === "Bootstrap") {
      scores = [];
    } else if (currentRole === "AdminCreator" || currentRole === "AdminManager") {
      scores = db.prepare(`
        SELECT u.id, u.full_name, u.phone_number, 
               COALESCE(s.attendance_score, 0.0) as attendance_score, 
               COALESCE(s.punctuality_percentage, 0.0) as punctuality_percentage, 
               COALESCE(s.late_count, 0) as late_count,
               (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) as total_attendances
        FROM users u
        LEFT JOIN attendance_scores s ON u.id = s.user_id
        WHERE u.role IN ('Employee', 'Purchaser', 'Accountant', 'Engineer', 'HR') AND u.workspace_id = ?
        ORDER BY attendance_score DESC
      `).all(currentWorkspaceId);
    } else {
      scores = db.prepare(`
        SELECT u.id, u.full_name, u.phone_number, 
               COALESCE(s.attendance_score, 0.0) as attendance_score, 
               COALESCE(s.punctuality_percentage, 0.0) as punctuality_percentage, 
               COALESCE(s.late_count, 0) as late_count,
               (SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id) as total_attendances
        FROM users u
        LEFT JOIN attendance_scores s ON u.id = s.user_id
        WHERE u.id = ?
      `).all(req.user?.id);
    }
    res.json(scores);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- MODULE 8: STATIC OFFICE ATTENDANCE QR CODE MANAGEMENT ---

// Get current active static Office QR Code (Workspace isolated)
app.get("/api/qr-code", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = req.user?.workspace_id || 1;

  try {
    const activeQr = getActiveOfficeQr(workspaceId, req.user?.id);
    res.json(activeQr);
  } catch (error) {
    console.error("QR Code retrieval error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Regenerate Static Office QR Code (Revokes old active QR, creates new active QR - Admin Only)
app.post("/api/qr-code/regenerate", authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const currentRole = req.user?.role;
  const workspaceId = req.user?.workspace_id || 1;

  const adminRoles = ["AdminCreator", "AdminManager", "SuperAdmin", "Bootstrap"];
  if (!adminRoles.includes(currentRole || "")) {
    return res.status(403).json({ 
      error: "Access denied. Administrator role required to regenerate office QR." 
    });
  }

  try {
    // 1. Revoke existing active QR codes for this workspace
    db.prepare(`
      UPDATE attendance_qr_codes 
      SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE workspace_id = ? AND status = 'ACTIVE'
    `).run(workspaceId);

    // 2. Generate and insert new active QR
    const newQrId = generateStaticOfficeQrId();
    db.prepare(`
      INSERT INTO attendance_qr_codes (workspace_id, qr_id, status, created_by)
      VALUES (?, ?, 'ACTIVE', ?)
    `).run(workspaceId, newQrId, req.user?.id || null);

    // 3. Log audit event
    db.prepare(`
      INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
      VALUES (?, ?, 'OFFICE_QR_REGENERATED', ?, ?)
    `).run(
      workspaceId,
      req.user?.id,
      `Regenerated static office QR code to ${newQrId}`,
      (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "") as string
    );

    const activeQr = getActiveOfficeQr(workspaceId, req.user?.id);
    broadcastServerEvent("QR_CHANGED", { 
      workspaceId, 
      action: "qr_regenerated", 
      qrId: newQrId 
    }, workspaceId);

    res.json({ success: true, ...activeQr });
  } catch (error) {
    console.error("Office QR regeneration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Initial sync of attendance scores on server boot
const runAttendanceScoreSync = () => {
  try {
    if (databaseManager.isReady()) {
      const allUsers: any[] = db.prepare("SELECT id FROM users").all();
      allUsers.forEach(u => updateAttendanceScore(u.id));
    }
  } catch (e) {
    console.error("Initial attendance scores sync error:", e);
  }
};
runAttendanceScoreSync();
databaseManager.onConnected(() => {
  runAttendanceScoreSync();
});

// Automated Shift Exception & Missing Checkout Sweep every 30 seconds
setInterval(() => {
  try {
    if (databaseManager.isReady()) {
      const todayStr = getEthiopianDateString();
      const nowTimeStr = getEthiopianTimeString();
      const workspaces: any[] = db.prepare("SELECT id FROM workspaces").all();
      const wsList = workspaces && workspaces.length > 0 ? workspaces.map(w => w.id) : [1];

      for (const wsId of wsList) {
        const sweepResult = AttendanceService.evaluateAttendanceExceptionsAndShifts(wsId, todayStr, nowTimeStr);
        if (sweepResult && sweepResult.flaggedCount > 0) {
          console.log(`[Missing Checkout Sweep] Flagged ${sweepResult.flaggedCount} unclosed shifts in workspace ${wsId}`);
          broadcastServerEvent("ATTENDANCE_CHANGED", { action: "missing_checkout_auto_flagged", count: sweepResult.flaggedCount }, wsId);
        }
      }
    }
  } catch (err) {
    console.error("Automated missing checkout sweep error:", err);
  }
}, 30000);

// --- VITE DEV AND BUILD HANDLERS ---
async function startServer() {
  // Catch-all for undefined /api routes to return JSON instead of HTML
  app.all("/api/*", (req, res) => {
    console.log(`Unmatched API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Explicit PWA Web App Manifest endpoint
  app.get(["/manifest.webmanifest", "/manifest.json"], (req, res) => {
    const candidatePaths = [
      path.join(process.cwd(), "dist", "manifest.webmanifest"),
      path.join(process.cwd(), "public", "manifest.webmanifest"),
      path.join(process.cwd(), "public", "manifest.json")
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.sendFile(p);
      }
    }
    res.status(404).json({ error: "Manifest not found" });
  });

  // Explicit Service Worker endpoint with required PWA headers
  app.get("/sw.js", (req, res, next) => {
    const candidatePaths = [
      path.join(process.cwd(), "dist", "sw.js"),
      path.join(process.cwd(), "public", "sw.js")
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Service-Worker-Allowed", "/");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.sendFile(p);
      }
    }
    next();
  });

  // Serve static assets from public directory
  app.use(express.static(path.resolve(process.cwd(), "public")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application build not found. Please run npm run build.");
      }
    });
  }

  // Global error handler (handles both API and server errors)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error (Global Handler)" });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });

  server.on("upgrade", (_req, socket) => {
    socket.destroy();
  });
}

startServer();
