import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, databaseManager } from "./db/databaseManager.ts";
import { AttendanceService } from "./attendanceService.ts";
export { db, databaseManager };

export function initDatabase() {
  if (!databaseManager.isReady()) {
    console.warn(`[DatabaseManager] Database is not ready yet (${databaseManager.getStatus().mysql.error || "disconnected"}). Deferring migrations and seeding until database is connected.`);
    return;
  }

  // 1. Ensure schema, tables, and indexes exist
  databaseManager.initSchema();

  // 2. Ensure non-breaking column additions for existing tables
  ensureColumnMigrations();

  // 3. Seed default Workspaces and Static Office QR Codes if none exist
  seedInitialData();

  // 4. Synchronize and ensure penalties and overtime are 100% database-backed
  syncDatabaseOvertimeAndPenalties();
}

// Auto-run initDatabase whenever databaseManager successfully connects
databaseManager.onConnected(() => {
  initDatabase();
});

function ensureColumnMigrations() {
  const addCol = (tableName: string, columnName: string, columnDef: string) => {
    try {
      const cols = db.prepare(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`).all(columnName);
      if (!cols || cols.length === 0) {
        db.exec(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef};`);
        console.log(`[Migration] Added column ${columnName} to ${tableName}`);
      }
    } catch (err: any) {
      // Column may already exist or table not initialized yet
    }
  };

  // site_settings columns
  addCol("site_settings", "late_grace_minutes", "INT DEFAULT 15");
  addCol("site_settings", "allowed_minor_lates", "INT DEFAULT 2");
  addCol("site_settings", "late_penalty_fixed_amount", "DOUBLE DEFAULT 25.0");
  addCol("site_settings", "late_penalty_hourly_multiplier", "DOUBLE DEFAULT 0.5");
  addCol("site_settings", "punctuality_bonus_amount", "DOUBLE DEFAULT 500.0");
  addCol("site_settings", "max_shift_duration_hours", "DOUBLE DEFAULT 14.0");
  addCol("site_settings", "normal_overtime_multiplier", "DOUBLE DEFAULT 1.5");
  addCol("site_settings", "rest_day_overtime_multiplier", "DOUBLE DEFAULT 2.0");
  addCol("site_settings", "holiday_overtime_multiplier", "DOUBLE DEFAULT 2.5");
  addCol("site_settings", "night_overtime_multiplier", "DOUBLE DEFAULT 1.5");
  addCol("site_settings", "allowed_radius", "DOUBLE DEFAULT 35.0");
  addCol("site_settings", "work_start_time", "VARCHAR(20) DEFAULT '08:30'");
  addCol("site_settings", "work_end_time", "VARCHAR(20) DEFAULT '17:30'");
  addCol("site_settings", "required_daily_hours", "DOUBLE DEFAULT 8.0");
  addCol("site_settings", "morning_start_time", "VARCHAR(20) DEFAULT '08:30'");
  addCol("site_settings", "morning_end_time", "VARCHAR(20) DEFAULT '12:30'");
  addCol("site_settings", "afternoon_start_time", "VARCHAR(20) DEFAULT '13:30'");
  addCol("site_settings", "afternoon_end_time", "VARCHAR(20) DEFAULT '17:30'");
  addCol("site_settings", "earliest_checkin_time", "VARCHAR(20) DEFAULT '07:00'");
  addCol("site_settings", "latest_checkin_time", "VARCHAR(20) DEFAULT '10:30'");
  addCol("site_settings", "prevent_duplicate_checkin", "INT DEFAULT 1");
  addCol("site_settings", "early_arrival_as_overtime", "INT DEFAULT 0");
  addCol("site_settings", "authorized_early_overtime_enabled", "INT DEFAULT 1");
  addCol("site_settings", "early_overtime_requires_approval", "INT DEFAULT 1");
  addCol("site_settings", "earliest_checkout_time", "VARCHAR(20) DEFAULT '16:30'");
  addCol("site_settings", "latest_checkout_time", "VARCHAR(20) DEFAULT '20:00'");
  addCol("site_settings", "checkout_grace_minutes", "INT DEFAULT 30");
  addCol("site_settings", "prevent_checkout_without_checkin", "INT DEFAULT 1");
  addCol("site_settings", "prevent_duplicate_checkout", "INT DEFAULT 1");
  addCol("site_settings", "missing_checkout_auto_overtime", "INT DEFAULT 0");
  addCol("site_settings", "overtime_enabled", "INT DEFAULT 1");
  addCol("site_settings", "overtime_start_time", "VARCHAR(20) DEFAULT '17:30'");
  addCol("site_settings", "min_overtime_minutes", "INT DEFAULT 30");
  addCol("site_settings", "max_overtime_daily_hours", "DOUBLE DEFAULT 4.0");
  addCol("site_settings", "max_overtime_weekly_hours", "DOUBLE DEFAULT 12.0");
  addCol("site_settings", "require_overtime_approval", "INT DEFAULT 1");

  // overtime_records columns
  addCol("overtime_records", "notes", "TEXT");
  addCol("overtime_records", "reason", "TEXT");

  // attendance columns
  addCol("attendance", "late_minutes", "INT DEFAULT 0");
  addCol("attendance", "penalty_amount", "DOUBLE DEFAULT 0.0");
  addCol("attendance", "penalty_status", "VARCHAR(50) DEFAULT NULL");
  addCol("attendance", "penalty_waived_reason", "TEXT");
  addCol("attendance", "penalty_waived_by", "INT");
  addCol("attendance", "penalty_waived_at", "VARCHAR(100)");
  addCol("attendance", "original_check_in", "VARCHAR(50)");
  addCol("attendance", "original_check_out", "VARCHAR(50)");
  addCol("attendance", "worked_minutes", "INT DEFAULT 0");
  addCol("attendance", "provisional_checkout_time", "VARCHAR(50)");
  addCol("attendance", "correction_requested_by", "INT");
  addCol("attendance", "correction_requested_at", "VARCHAR(100)");
  addCol("attendance", "correction_reason", "TEXT");
  addCol("attendance", "rejection_reason", "TEXT");

  // salary_payments columns
  addCol("salary_payments", "calculation_method", "VARCHAR(50) DEFAULT 'GROSS'");
  addCol("salary_payments", "final_payable_amount", "DOUBLE DEFAULT 0.0");
  addCol("salary_payments", "penalty_amount", "DOUBLE DEFAULT 0.0");
  addCol("salary_payments", "payment_date", "VARCHAR(100) DEFAULT NULL");
  addCol("salary_payments", "payment_status", "VARCHAR(50) DEFAULT 'UNPAID'");
  addCol("salary_payments", "notes", "TEXT DEFAULT NULL");

  // late_penalties columns
  addCol("late_penalties", "notification_status", "VARCHAR(50) DEFAULT 'ACTIVE'");
  addCol("late_penalties", "penalty_type", "VARCHAR(100) DEFAULT 'LATE_ARRIVAL'");
  addCol("late_penalties", "reason", "TEXT DEFAULT NULL");
  addCol("late_penalties", "payroll_id", "INT DEFAULT NULL");
  addCol("late_penalties", "paid_at", "VARCHAR(100) DEFAULT NULL");
  addCol("late_penalties", "processed_by", "INT DEFAULT NULL");

  // users columns
  addCol("users", "salary_calculation_mode", "VARCHAR(50) DEFAULT 'GROSS'");
  addCol("users", "department", "VARCHAR(100) DEFAULT 'Operations'");
  addCol("users", "created_by", "INT DEFAULT NULL");

  // workspaces columns
  addCol("workspaces", "created_by", "INT DEFAULT NULL");

  // site_settings columns
  addCol("site_settings", "default_salary_calculation", "VARCHAR(50) DEFAULT 'GROSS'");
}

function generateStaticQrId(): string {
  return `OFFICE-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

function seedInitialData() {
  try {
    // 1. Ensure the primary workspace exists
    const wsCount = (db.prepare("SELECT COUNT(*) as c FROM workspaces").get() as any)?.c || 0;
    if (wsCount === 0) {
      console.log("Initializing primary workspace...");
      db.prepare("INSERT INTO workspaces (id, name, created_by) VALUES (1, 'Main Office', NULL)").run();
    }

    // 2. Ensure default Administrator (0911223344 / admin123) is provisioned
    const existingDemoAdmin: any = db.prepare("SELECT id FROM users WHERE phone_number = ?").get("0911223344");
    if (!existingDemoAdmin) {
      console.log("Provisioning default Administrator account (0911223344 / admin123)...");
      const passwordHash = bcrypt.hashSync("admin123", 10);
      const res = db.prepare(`
        INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id)
        VALUES ('System Administrator', '0911223344', 'AdminCreator', ?, 150.00, 1)
      `).run(passwordHash);
      const seededId = Number(res.lastInsertRowid);
      db.prepare("UPDATE workspaces SET created_by = ? WHERE id = 1 AND (created_by IS NULL OR created_by = 0)").run(seededId);
      try {
        db.prepare(`
          INSERT INTO attendance_scores (user_id, attendance_score, punctuality_percentage, late_count)
          VALUES (?, 0.0, 0.0, 0)
        `).run(seededId);
      } catch (_) {}
    } else {
      // Migrate legacy 45.00 placeholder to standard rate
      try {
        db.prepare("UPDATE users SET hourly_rate = 150.00 WHERE id = ? AND hourly_rate = 45.00").run(existingDemoAdmin.id);
      } catch (_) {}
      try {
        const firstAdmin: any = db.prepare("SELECT id FROM users WHERE role IN ('Bootstrap', 'AdminCreator', 'SuperAdmin') ORDER BY id ASC LIMIT 1").get();
        if (firstAdmin?.id) {
          db.prepare("UPDATE workspaces SET created_by = ? WHERE id = 1 AND (created_by IS NULL OR created_by = 0)").run(firstAdmin.id);
        }
      } catch (_) {}
    }

    const workspaces = db.prepare("SELECT * FROM workspaces").all() as any[];

    for (const ws of workspaces) {
      // Ensure site_settings exist for workspace
      const ss = db.prepare("SELECT id FROM site_settings WHERE workspace_id = ?").get(ws.id);
      if (!ss) {
        db.prepare(`
          INSERT INTO site_settings (office_name, latitude, longitude, office_wifi_ssid, office_wifi_bssid, wifi_ssid, wifi_ip, use_wifi_verification, workspace_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(ws.name, 9.0227, 38.7460, 'Office_WiFi', '00:11:22:33:44:55', 'Office_WiFi', '', 1, ws.id);
      }

      // Ensure an ACTIVE static office QR code exists for each workspace
      const activeQr = db.prepare("SELECT id FROM attendance_qr_codes WHERE workspace_id = ? AND status = 'ACTIVE'").get(ws.id);
      if (!activeQr) {
        const qrId = generateStaticQrId();
        db.prepare(`
          INSERT INTO attendance_qr_codes (workspace_id, qr_id, status)
          VALUES (?, ?, 'ACTIVE')
        `).run(ws.id, qrId);
        console.log(`Initialized active static office QR for workspace ${ws.name}: ${qrId}`);
      }

      // Ensure default weekly work schedule (Sunday to Saturday) exists for workspace
      const scheduleCount = (db.prepare("SELECT COUNT(*) as c FROM work_schedules WHERE workspace_id = ?").get(ws.id) as any)?.c || 0;
      if (scheduleCount === 0) {
        const defaultSchedules = [
          { day: 0, name: "Sunday", morning: "NON_WORKING", afternoon: "NON_WORKING" },
          { day: 1, name: "Monday", morning: "WORKING", afternoon: "WORKING" },
          { day: 2, name: "Tuesday", morning: "WORKING", afternoon: "WORKING" },
          { day: 3, name: "Wednesday", morning: "WORKING", afternoon: "WORKING" },
          { day: 4, name: "Thursday", morning: "WORKING", afternoon: "WORKING" },
          { day: 5, name: "Friday", morning: "WORKING", afternoon: "WORKING" },
          { day: 6, name: "Saturday", morning: "WORKING", afternoon: "NON_WORKING" }
        ];

        const insertSchedule = db.prepare(`
          INSERT INTO work_schedules (workspace_id, day_of_week, day_name, morning_status, afternoon_status, morning_start, morning_end, afternoon_start, afternoon_end)
          VALUES (?, ?, ?, ?, ?, '02:00', '06:00', '07:00', '11:00')
        `);

        for (const s of defaultSchedules) {
          insertSchedule.run(ws.id, s.day, s.name, s.morning, s.afternoon);
        }
        console.log(`Initialized 7-day weekly work schedule for workspace ${ws.name}`);
      }

      // Automatically migrate any legacy Gregorian schedule times to Ethiopian Local Time (02:00 - 06:00, 07:00 - 11:00)
      try {
        db.prepare(`
          UPDATE work_schedules 
          SET morning_start = '02:00', morning_end = '06:00', afternoon_start = '07:00', afternoon_end = '11:00'
          WHERE morning_start IN ('08:00', '08:30') 
             OR afternoon_start IN ('13:00', '13:30', '01:00')
             OR morning_end IN ('12:00', '12:30', '06:30')
             OR afternoon_end IN ('17:00', '17:30', '11:30')
        `).run();
      } catch (_) {}

      // Ensure default Ethiopian & Company holidays exist for workspace
      const holidayCount = (db.prepare("SELECT COUNT(*) as c FROM holidays WHERE workspace_id = ?").get(ws.id) as any)?.c || 0;
      if (holidayCount === 0) {
        const defaultHolidays = [
          { date: "2026-09-11", name: "Ethiopian New Year (Enkutatash)", type: "PUBLIC", duration: "FULL_DAY", desc: "National celebration of the Ethiopian New Year" },
          { date: "2026-09-27", name: "Meskel (Finding of the True Cross)", type: "PUBLIC", duration: "FULL_DAY", desc: "UNESCO registered religious festival" },
          { date: "2026-10-18", name: "Mawlid (Prophet's Birthday)", type: "PUBLIC", duration: "FULL_DAY", desc: "Islamic public holiday celebration" },
          { date: "2027-01-07", name: "Genna (Ethiopian Christmas)", type: "PUBLIC", duration: "FULL_DAY", desc: "Orthodox Christmas celebration" },
          { date: "2027-01-19", name: "Timkat (Ethiopian Epiphany)", type: "PUBLIC", duration: "FULL_DAY", desc: "UNESCO cultural heritage celebration" },
          { date: "2027-03-02", name: "Victory of Adwa", type: "PUBLIC", duration: "FULL_DAY", desc: "National victory commemoration" },
          { date: "2027-04-30", name: "Siklet (Good Friday)", type: "PUBLIC", duration: "FULL_DAY", desc: "Orthodox Good Friday solemnity" },
          { date: "2027-05-02", name: "Fasika (Ethiopian Easter)", type: "PUBLIC", duration: "FULL_DAY", desc: "Easter holiday celebration" },
          { date: "2027-05-05", name: "Patriots' Victory Day", type: "PUBLIC", duration: "FULL_DAY", desc: "Liberation Day commemoration" },
          { date: "2027-05-28", name: "Ginbot 20 (Downfall of Derg)", type: "PUBLIC", duration: "FULL_DAY", desc: "National public holiday" }
        ];

        const insertHoliday = db.prepare(`
          INSERT INTO holidays (workspace_id, date, name, type, duration, description, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `);

        for (const h of defaultHolidays) {
          insertHoliday.run(ws.id, h.date, h.name, h.type, h.duration, h.desc);
        }
        console.log(`Initialized default Ethiopian public holidays for workspace ${ws.name}`);
      }
    }

    // Production Mode: Do not seed mock accounts or fake attendance records.
    // The initial administrator will register securely via /api/auth/setup-admin.
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}

/**
 * Ensures all penalties and overtime records are fully synchronized and persisted in database tables.
 */
export function syncDatabaseOvertimeAndPenalties() {
  try {
    // 1. Sync and backfill late penalties into late_penalties table
    const lateRows = db.prepare(`
      SELECT a.*, u.hourly_rate, u.monthly_base_salary 
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE (a.status = 'Late' OR a.late_minutes > 0 OR a.penalty_status IS NOT NULL)
    `).all() as any[];

    for (const a of lateRows) {
      const wsId = a.workspace_id || 1;
      const ss: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(wsId) || {};
      const fixedPenalty = ss.late_penalty_fixed_amount ?? 25.0;
      const hourlyMult = ss.late_penalty_hourly_multiplier ?? 0.5;
      const graceMins = ss.late_grace_minutes ?? 15;

      let effectiveStatus = a.penalty_status;
      let lateMins = a.late_minutes || 0;
      if (!lateMins && a.check_in_time) {
        const scheduledStart = a.session === "Morning" ? "02:00:00" : "07:00:00";
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

      if (!effectiveStatus) {
        if (lateMins > graceMins) {
          effectiveStatus = "PENALIZED";
        } else if (lateMins > 0) {
          effectiveStatus = "WITHIN_GRACE";
        }
      }

      let penaltyAmt = Number(a.penalty_amount || 0);
      if (penaltyAmt <= 0 && effectiveStatus === "PENALIZED") {
        const hrRate = AttendanceService.getEmployeeEffectiveHourlyRate(a);
        penaltyAmt = AttendanceService.calculateLatePenaltyAmount(lateMins, hrRate, fixedPenalty, hourlyMult);
      }

      // Update attendance if amount or status was missing or stale
      if (a.penalty_amount !== penaltyAmt || a.penalty_status !== effectiveStatus || a.late_minutes !== lateMins) {
        db.prepare(`
          UPDATE attendance 
          SET penalty_amount = ?, penalty_status = ?, late_minutes = ?
          WHERE id = ?
        `).run(penaltyAmt, effectiveStatus, lateMins, a.id);
      }

      // Ensure corresponding row exists in late_penalties table
      const existingPenalty: any = db.prepare("SELECT id FROM late_penalties WHERE attendance_id = ?").get(a.id);
      if (!existingPenalty) {
        const scheduledStart = a.session === "Morning" ? "02:00:00" : "07:00:00";
        db.prepare(`
          INSERT INTO late_penalties (
            attendance_id, user_id, workspace_id, date, session, check_in_time, check_out_time,
            scheduled_start_time, late_minutes, is_within_grace, penalty_amount, penalty_status,
            penalty_waived_reason, penalty_waived_by, penalty_waived_at, verification_method, distance
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          a.id,
          a.user_id,
          wsId,
          a.date,
          a.session || "Morning",
          a.check_in_time || "02:00:00",
          a.check_out_time,
          scheduledStart,
          lateMins,
          effectiveStatus === "WITHIN_GRACE" ? 1 : 0,
          penaltyAmt,
          effectiveStatus || "PENALIZED",
          a.penalty_waived_reason,
          a.penalty_waived_by,
          a.penalty_waived_at,
          a.verification_method || "QR_GPS",
          a.distance || 0
        );
      }
    }

    // 2. Sync and backfill overtime into overtime_records table
    const otAttendance = db.prepare(`
      SELECT a.*, u.hourly_rate
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.overtime_hours > 0
    `).all() as any[];

    for (const a of otAttendance) {
      const existingOt: any = db.prepare("SELECT id FROM overtime_records WHERE attendance_id = ?").get(a.id);
      if (!existingOt) {
        const otType = a.holiday_overtime_hours > 0
          ? "HOLIDAY_OVERTIME"
          : a.rest_day_overtime_hours > 0
          ? "REST_DAY_OVERTIME"
          : a.night_overtime_hours > 0
          ? "NIGHT_OVERTIME"
          : (a.attendance_type && a.attendance_type.includes("OVERTIME"))
          ? a.attendance_type
          : "REGULAR_OVERTIME";

        const ss: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(a.workspace_id || 1) || {};
        const mult = otType === "HOLIDAY_OVERTIME" 
          ? (ss.holiday_overtime_multiplier ?? 2.5)
          : otType === "REST_DAY_OVERTIME"
          ? (ss.rest_day_overtime_multiplier ?? 2.0)
          : otType === "NIGHT_OVERTIME"
          ? (ss.night_overtime_multiplier ?? 1.5)
          : (ss.normal_overtime_multiplier ?? 1.5);

        const status = a.overtime_status || "APPROVED";

        db.prepare(`
          INSERT INTO overtime_records (
            attendance_id, employee_id, workspace_id, date, check_in_time, check_out_time,
            overtime_type, work_status, work_status_reason, hours, rate_multiplier, status,
            qr_verified, gps_verified, gps_latitude, gps_longitude, gps_accuracy, gps_distance
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)
        `).run(
          a.id,
          a.user_id,
          a.workspace_id || 1,
          a.date,
          a.check_in_time,
          a.check_out_time,
          otType,
          a.work_status || "WORKING",
          a.work_status_reason || "OVERTIME_DUTY",
          a.overtime_hours,
          mult,
          status,
          a.latitude || 9.0227,
          a.longitude || 38.7460,
          a.accuracy || 10,
          a.distance || 0
        );
      }
    }
    console.log("[Database] Harmonized and synchronized penalty & overtime records with database tables.");
  } catch (syncErr) {
    console.error("[Database] Error synchronizing penalties and overtime:", syncErr);
  }
}



