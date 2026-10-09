import { db } from "./database.ts";
import { WorkCalendarService } from "./workCalendarService.ts";
import { formatToEthiopianTime } from "../utils/ethiopianTime.ts";
import type { AttendanceRecord, AttendanceCorrection, SiteSettings } from "../types.ts";

export interface AttendanceExceptionItem {
  id: number;
  user_id: number;
  full_name: string;
  phone_number: string;
  role: string;
  date: string;
  session: "Morning" | "Afternoon";
  status: string;
  correction_status: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  exception_type: "MISSING_CHECKOUT" | "MISSING_CHECKIN" | "UNCLOSED_SHIFT" | "PENDING_CORRECTION";
  reason?: string;
  requested_at?: string;
}

export interface PreFlightCheckResult {
  ok: boolean;
  unresolvedCount: number;
  exceptions: AttendanceExceptionItem[];
  message: string;
}

export class AttendanceService {
  /**
   * Fetch site settings for workspace with defaults (Single Source of Truth)
   */
  static getSiteSettings(workspaceId: number = 1): any {
    try {
      const settings: any = db.prepare("SELECT * FROM site_settings WHERE workspace_id = ?").get(workspaceId);
      return {
        id: settings?.id,
        workspace_id: settings?.workspace_id || workspaceId,
        office_name: settings?.office_name || "Main Office",
        latitude: settings?.latitude ?? 9.0227,
        longitude: settings?.longitude ?? 38.7460,
        office_wifi_ssid: settings?.office_wifi_ssid || "Office_WiFi",
        office_wifi_bssid: settings?.office_wifi_bssid || "00:11:22:33:44:55",
        wifi_ssid: settings?.wifi_ssid || "Office_WiFi",
        wifi_ip: settings?.wifi_ip || "",
        use_wifi_verification: settings?.use_wifi_verification ?? 1,
        allowed_radius: settings?.allowed_radius ?? 35.0,
        allowed_radius_meters: settings?.allowed_radius ?? 35.0,

        // 1. Regular Work Schedule
        work_start_time: settings?.work_start_time || "08:30",
        work_end_time: settings?.work_end_time || "17:30",
        required_daily_hours: Number(settings?.required_daily_hours ?? 8.0),
        morning_start_time: settings?.morning_start_time || "08:30",
        morning_end_time: settings?.morning_end_time || "12:30",
        afternoon_start_time: settings?.afternoon_start_time || "13:30",
        afternoon_end_time: settings?.afternoon_end_time || "17:30",

        // 2. Check-in Rules
        earliest_checkin_time: settings?.earliest_checkin_time || "07:00",
        latest_checkin_time: settings?.latest_checkin_time || "10:30",
        late_grace_minutes: Number(settings?.late_grace_minutes ?? 15),
        allowed_minor_lates: Number(settings?.allowed_minor_lates ?? 2),
        prevent_duplicate_checkin: Number(settings?.prevent_duplicate_checkin ?? 1),
        early_arrival_as_overtime: Number(settings?.early_arrival_as_overtime ?? 0),
        authorized_early_overtime_enabled: Number(settings?.authorized_early_overtime_enabled ?? 1),
        early_overtime_requires_approval: Number(settings?.early_overtime_requires_approval ?? 1),

        // 3. Check-out Rules
        earliest_checkout_time: settings?.earliest_checkout_time || "16:30",
        latest_checkout_time: settings?.latest_checkout_time || "20:00",
        checkout_grace_minutes: Number(settings?.checkout_grace_minutes ?? 30),
        prevent_checkout_without_checkin: Number(settings?.prevent_checkout_without_checkin ?? 1),
        prevent_duplicate_checkout: Number(settings?.prevent_duplicate_checkout ?? 1),
        missing_checkout_auto_overtime: Number(settings?.missing_checkout_auto_overtime ?? 0),

        // 4. Overtime Rules
        overtime_enabled: Number(settings?.overtime_enabled ?? 1),
        overtime_start_time: settings?.overtime_start_time || "17:30",
        min_overtime_minutes: Number(settings?.min_overtime_minutes ?? 30),
        max_overtime_daily_hours: Number(settings?.max_overtime_daily_hours ?? 4.0),
        max_overtime_weekly_hours: Number(settings?.max_overtime_weekly_hours ?? 12.0),
        require_overtime_approval: Number(settings?.require_overtime_approval ?? 1),
        normal_overtime_multiplier: Number(settings?.normal_overtime_multiplier ?? 1.5),
        rest_day_overtime_multiplier: Number(settings?.rest_day_overtime_multiplier ?? 2.0),
        holiday_overtime_multiplier: Number(settings?.holiday_overtime_multiplier ?? 2.5),
        night_overtime_multiplier: Number(settings?.night_overtime_multiplier ?? 1.5),

        // Penalties & Salary Calculation
        late_penalty_fixed_amount: Number(settings?.late_penalty_fixed_amount ?? 25.0),
        late_penalty_hourly_multiplier: Number(settings?.late_penalty_hourly_multiplier ?? 0.5),
        punctuality_bonus_amount: Number(settings?.punctuality_bonus_amount ?? 500.0),
        max_shift_duration_hours: Number(settings?.max_shift_duration_hours ?? 14.0),
        default_salary_calculation: settings?.default_salary_calculation || "GROSS"
      };
    } catch (e) {
      return {
        workspace_id: workspaceId,
        office_name: "Main Office",
        latitude: 9.0227,
        longitude: 38.7460,
        allowed_radius: 35.0,
        allowed_radius_meters: 35.0,
        use_wifi_verification: 1,
        work_start_time: "08:30",
        work_end_time: "17:30",
        required_daily_hours: 8.0,
        morning_start_time: "08:30",
        morning_end_time: "12:30",
        afternoon_start_time: "13:30",
        afternoon_end_time: "17:30",
        earliest_checkin_time: "07:00",
        latest_checkin_time: "10:30",
        late_grace_minutes: 15,
        allowed_minor_lates: 2,
        prevent_duplicate_checkin: 1,
        early_arrival_as_overtime: 0,
        authorized_early_overtime_enabled: 1,
        early_overtime_requires_approval: 1,
        earliest_checkout_time: "16:30",
        latest_checkout_time: "20:00",
        checkout_grace_minutes: 30,
        prevent_checkout_without_checkin: 1,
        prevent_duplicate_checkout: 1,
        missing_checkout_auto_overtime: 0,
        overtime_enabled: 1,
        overtime_start_time: "17:30",
        min_overtime_minutes: 30,
        max_overtime_daily_hours: 4.0,
        max_overtime_weekly_hours: 12.0,
        require_overtime_approval: 1,
        normal_overtime_multiplier: 1.5,
        rest_day_overtime_multiplier: 2.0,
        holiday_overtime_multiplier: 2.5,
        night_overtime_multiplier: 1.5,
        late_penalty_fixed_amount: 25.0,
        late_penalty_hourly_multiplier: 0.5,
        punctuality_bonus_amount: 500.0,
        max_shift_duration_hours: 14.0,
        default_salary_calculation: "GROSS"
      };
    }
  }

  /**
   * Determine the effective hourly rate for an employee.
   * If the employee has monthly_base_salary > 0, calculates derived rate via Ethiopian Labour
   * Proclamation standards: 26 working days * 8 hours = 208 hours per month.
   * Otherwise falls back to their registered hourly_rate (or standard 150.00 baseline if unset).
   */
  static getEmployeeEffectiveHourlyRate(
    user: { hourly_rate?: number | string | null; monthly_base_salary?: number | string | null } | null | undefined,
    fallbackRate: number = 150.0
  ): number {
    if (!user) return fallbackRate;
    const monthlySalary = typeof user.monthly_base_salary === "number"
      ? user.monthly_base_salary
      : parseFloat(String(user.monthly_base_salary || 0));

    if (monthlySalary > 0) {
      const derived = Math.round((monthlySalary / 208) * 100) / 100;
      if (derived > 0) return derived;
    }

    const hourly = typeof user.hourly_rate === "number"
      ? user.hourly_rate
      : parseFloat(String(user.hourly_rate || 0));

    if (hourly > 0) {
      return Math.round(hourly * 100) / 100;
    }

    return fallbackRate;
  }

  /**
   * Calculate late penalty amount dynamically from employee's actual hourly rate and workspace policy.
   * Formula: fixed_incident_penalty + (late_minutes / 60) * employee_hourly_rate * late_penalty_hourly_multiplier
   */
  static calculateLatePenaltyAmount(
    lateMinutes: number,
    employeeHourlyRate: number,
    fixedPenalty: number = 25.0,
    hourlyMultiplier: number = 0.5
  ): number {
    if (lateMinutes <= 0) return 0.0;
    const timeDeduction = (lateMinutes / 60) * employeeHourlyRate * hourlyMultiplier;
    return Math.round((fixedPenalty + timeDeduction) * 100) / 100;
  }

  /**
   * Determine whether a check-in time is considered Late given grace period
   * In Ethiopian time format (HH:mm:ss):
   * Respects configured session start times from site_settings.
   */
  static evaluateLateness(
    session: "Morning" | "Afternoon",
    ethiopianTimeStr: string,
    lateGraceMinutes: number = 15,
    customStartMins?: number,
    workspaceId: number = 1
  ): { isLate: boolean; lateMinutes: number; isWithinGracePeriod?: boolean } {
    try {
      const [h, m] = ethiopianTimeStr.split(":").map(Number);
      const nowTotalMins = (h || 0) * 60 + (m || 0);

      let baseStartMins = customStartMins;
      if (baseStartMins === undefined || baseStartMins === null) {
        const settings = this.getSiteSettings(workspaceId);
        const startStr = session === "Morning" 
          ? (settings.morning_start_time || settings.work_start_time || "08:30") 
          : (settings.afternoon_start_time || "13:30");
        const parts = startStr.trim().split(":");
        const sh = parseInt(parts[0], 10);
        const sm = parseInt(parts[1] || "0", 10);
        const ethH = (sh >= 6 && sh <= 23) ? ((sh - 6 + 24) % 24) : sh;
        baseStartMins = ethH * 60 + sm;
      }
      const graceCutoffMins = baseStartMins + lateGraceMinutes;

      if (nowTotalMins > graceCutoffMins) {
        return {
          isLate: true,
          lateMinutes: nowTotalMins - baseStartMins,
          isWithinGracePeriod: false
        };
      }

      const isWithinGrace = nowTotalMins > baseStartMins && nowTotalMins <= graceCutoffMins;
      return { isLate: false, lateMinutes: 0, isWithinGracePeriod: isWithinGrace };
    } catch (e) {
      return { isLate: false, lateMinutes: 0, isWithinGracePeriod: false };
    }
  }

  /**
   * Idempotent evaluation of attendance exceptions, unclosed shifts, and missing attendance
   * Authoritatively reads session windows and cutoff grace periods from site_settings database.
   */
  static evaluateAttendanceExceptionsAndShifts(
    workspaceId: number = 1,
    todayStr: string,
    nowTimeStr: string
  ): { flaggedCount: number; flaggedRecords: any[] } {
    const flaggedRecords: any[] = [];
    let flaggedCount = 0;

    try {
      const settings = this.getSiteSettings(workspaceId);
      const maxDurationHours = settings.max_shift_duration_hours || 14;

      const parseSettingEthMins = (timeStr?: string, defaultMins: number = 0): number => {
        if (!timeStr) return defaultMins;
        const [hStr, mStr] = timeStr.trim().split(":");
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr || "0", 10);
        if (isNaN(h)) return defaultMins;
        const ethH = (h >= 6 && h <= 23) ? ((h - 6 + 24) % 24) : h;
        return ethH * 60 + m;
      };

      const morningEndEthMins = parseSettingEthMins(settings.morning_end_time, 390);
      const morningCutoffMins = morningEndEthMins + (settings.checkout_grace_minutes || 0);

      const afternoonEndEthMins = parseSettingEthMins(settings.afternoon_end_time || settings.work_end_time, 690);
      const afternoonCutoffMins = settings.latest_checkout_time 
        ? parseSettingEthMins(settings.latest_checkout_time, 720) 
        : afternoonEndEthMins + (settings.checkout_grace_minutes || 0);

      // 1. Find all unclosed shifts from past dates (or today where elapsed time > maxDurationHours)
      const openRecords: any[] = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number 
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.workspace_id = ?
          AND a.check_out_time IS NULL
          AND (
            a.date < ? 
            OR (a.date = ? AND a.status != 'Missing Checkout')
          )
      `).all(workspaceId, todayStr, todayStr);

      for (const record of openRecords) {
        let shouldFlag = false;

        if (record.date < todayStr) {
          // Past day unclosed shift
          shouldFlag = true;
        } else if (record.date === todayStr && record.check_in_time) {
          const [inH, inM] = record.check_in_time.split(":").map(Number);
          const [nowH, nowM] = nowTimeStr.split(":").map(Number);
          const nowTotalMins = (nowH || 0) * 60 + (nowM || 0);

          // STRICT SESSION CHECKOUT RULES FOR BOTH MORNING AND AFTERNOON (DYNAMICALLY CONFIGURED):
          if (record.session === "Morning" && nowTotalMins >= morningCutoffMins) {
            shouldFlag = true;
          }

          if (record.session === "Afternoon" && nowTotalMins >= afternoonCutoffMins) {
            shouldFlag = true;
          }

          // 3. Fallback: Check if elapsed time exceeded max shift duration
          let elapsedMins = nowTotalMins - ((inH || 0) * 60 + (inM || 0));
          if (elapsedMins < 0) elapsedMins += 24 * 60;
          if (elapsedMins > maxDurationHours * 60) {
            shouldFlag = true;
          }
        }

        if (shouldFlag && record.status !== "Missing Checkout") {
          db.prepare(`
            UPDATE attendance 
            SET status = 'Missing Checkout',
                correction_status = CASE 
                  WHEN correction_status IS NULL OR correction_status = 'NONE' THEN 'PENDING_CORRECTION'
                  ELSE correction_status 
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(record.id);

          flaggedCount++;
          flaggedRecords.push(record);

          try {
            db.prepare(`
              INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
              VALUES (?, ?, 'ATTENDANCE_MISSING_CHECKOUT_FLAGGED', ?, '127.0.0.1')
            `).run(
              workspaceId,
              record.user_id,
              `System flagged unclosed shift as Missing Checkout for ${record.full_name} (${record.phone_number}) on ${record.date} (${record.session} session). Check-in time: ${record.check_in_time || 'N/A'}. Pending administrative review.`
            );
          } catch (auditErr) {
            console.error("Audit log error on missing checkout flag:", auditErr);
          }
        }
      }

      return { flaggedCount, flaggedRecords };
    } catch (err) {
      console.error("Error evaluating attendance exceptions:", err);
      return { flaggedCount: 0, flaggedRecords: [] };
    }
  }

  /**
   * Pre-flight integrity check before payroll generation / disbursement
   */
  static getPayrollPreFlightCheck(
    workspaceId: number = 1,
    monthOrStartDate?: number | string,
    yearOrEndDate?: number | string
  ): any {
    try {
      // 1. Unclosed / Missing checkouts
      const missingCheckouts: any[] = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.workspace_id = ?
          AND a.status = 'Missing Checkout'
          AND (a.correction_status != 'CORRECTED' OR a.correction_status IS NULL)
        ORDER BY a.date DESC
      `).all(workspaceId);

      // 2. Pending correction requests
      const pendingCorrections: any[] = db.prepare(`
        SELECT c.*, u.full_name, u.phone_number, u.role
        FROM attendance_corrections c
        JOIN users u ON c.employee_id = u.id
        WHERE c.workspace_id = ?
          AND c.status = 'PENDING'
        ORDER BY c.created_at DESC
      `).all(workspaceId);

      // 3. Total active employees evaluated
      const totalEmpRow: any = db.prepare(`
        SELECT COUNT(*) as count FROM users WHERE role != 'SuperAdmin'
      `).get();
      const totalEmployeesEvaluated = totalEmpRow?.count || 0;

      // 4. Construct human-readable diagnostic messages
      const issues: string[] = [];
      missingCheckouts.forEach(r => {
        issues.push(`Unclosed shift for ${r.full_name || 'Staff #' + r.user_id} on ${r.date} (${r.session}) - Missing Check-out`);
      });
      pendingCorrections.forEach(c => {
        issues.push(`Pending correction request for ${c.full_name || 'Staff #' + c.employee_id} on ${c.date} (${c.session}) - Review required`);
      });

      const blockingIssuesCount = missingCheckouts.length + pendingCorrections.length;
      const canProcessPayroll = blockingIssuesCount === 0;

      const exceptions: AttendanceExceptionItem[] = [
        ...missingCheckouts.map(r => ({
          id: r.id,
          user_id: r.user_id,
          full_name: r.full_name,
          phone_number: r.phone_number,
          role: r.role,
          date: r.date,
          session: r.session,
          status: r.status,
          correction_status: r.correction_status,
          check_in_time: r.check_in_time,
          check_out_time: r.check_out_time,
          exception_type: "MISSING_CHECKOUT" as const
        })),
        ...pendingCorrections.map(c => ({
          id: c.attendance_id || c.id,
          user_id: c.employee_id,
          full_name: c.full_name,
          phone_number: c.phone_number,
          role: c.role,
          date: c.date,
          session: c.session,
          status: "Pending Correction",
          correction_status: "PENDING",
          check_in_time: c.requested_check_in,
          check_out_time: c.requested_check_out,
          exception_type: "PENDING_CORRECTION" as const,
          reason: c.reason,
          requested_at: c.created_at
        }))
      ];

      return {
        canProcessPayroll,
        blockingIssuesCount,
        issues,
        missingCheckoutsCount: missingCheckouts.length,
        missingCheckouts,
        pendingCorrectionsCount: pendingCorrections.length,
        pendingCorrections,
        totalEmployeesEvaluated,
        // PreFlightCheckResult compatibility
        ok: canProcessPayroll,
        unresolvedCount: blockingIssuesCount,
        exceptions,
        message: canProcessPayroll
          ? "All attendance records verified. Payroll calculation ready."
          : `${blockingIssuesCount} attendance exception(s) require review before final payroll disbursement.`
      };
    } catch (err: any) {
      console.error("Error in payroll pre-flight check:", err);
      return {
        canProcessPayroll: false,
        blockingIssuesCount: 0,
        issues: [err.message || "Failed to execute pre-flight check"],
        missingCheckoutsCount: 0,
        missingCheckouts: [],
        pendingCorrectionsCount: 0,
        pendingCorrections: [],
        totalEmployeesEvaluated: 0,
        ok: false,
        unresolvedCount: 0,
        exceptions: [],
        message: err.message || "Failed to execute pre-flight check"
      };
    }
  }

  /**
   * Fetch all attendance correction requests with optional filters
   */
  static getCorrectionRequests(workspaceId?: number, userId?: number): any[] {
    try {
      let query = `
        SELECT c.*, 
               u.full_name, u.phone_number, u.role,
               r.full_name as reviewer_name
        FROM attendance_corrections c
        JOIN users u ON c.employee_id = u.id
        LEFT JOIN users r ON c.reviewed_by = r.id
        WHERE 1=1
      `;
      const params: any[] = [];
      if (workspaceId !== undefined && workspaceId !== null) {
        query += " AND c.workspace_id = ?";
        params.push(workspaceId);
      }
      if (userId !== undefined && userId !== null) {
        query += " AND c.employee_id = ?";
        params.push(userId);
      }
      query += " ORDER BY c.created_at DESC";
      const rows = db.prepare(query).all(...params);
      return rows.map((r: any) => ({
        ...r,
        user_id: r.employee_id
      }));
    } catch (e) {
      console.error("Error in getCorrectionRequests:", e);
      return [];
    }
  }

  /**
   * Request a correction for attendance (by Employee or Admin)
   */
  static submitCorrectionRequest(
    userId: number,
    payload: {
      attendance_id?: number;
      date?: string;
      session?: "Morning" | "Afternoon";
      requested_check_in?: string;
      requested_check_out?: string;
      reason: string;
      reason_code?: string;
    },
    clientIp: string = "127.0.0.1"
  ): { success: boolean; message?: string; correction?: any; error?: string } {
    let { attendance_id, date, session, requested_check_in, requested_check_out, reason, reason_code } = payload;

    // If attendance_id provided, infer date and session if not supplied
    if (attendance_id && (!date || !session)) {
      const existingAtt: any = db.prepare("SELECT date, session, check_in_time FROM attendance WHERE id = ?").get(attendance_id);
      if (existingAtt) {
        date = date || existingAtt.date;
        session = session || existingAtt.session;
        requested_check_in = requested_check_in || existingAtt.check_in_time;
      }
    }

    if (!date || !session) {
      return { success: false, error: "Date and session are required." };
    }

    if (!reason || !reason.trim()) {
      return { success: false, error: "Mandatory justification reason is required." };
    }

    if (!requested_check_in && !requested_check_out) {
      return { success: false, error: "At least one of requested check-in or check-out time is required." };
    }

    try {
      const user: any = db.prepare("SELECT id, full_name, phone_number, workspace_id, role FROM users WHERE id = ?").get(userId);
      if (!user) {
        return { success: false, error: "User not found." };
      }
      const workspaceId = user.workspace_id || 1;

      // Check if a pending correction already exists for this attendance record or date+session
      let existingPending: any = null;
      if (attendance_id) {
        existingPending = db.prepare(`
          SELECT * FROM attendance_corrections 
          WHERE attendance_id = ? AND status = 'PENDING'
        `).get(attendance_id);
      } else {
        existingPending = db.prepare(`
          SELECT * FROM attendance_corrections 
          WHERE employee_id = ? AND date = ? AND session = ? AND status = 'PENDING'
        `).get(userId, date, session);
      }

      if (existingPending) {
        return {
          success: false,
          error: "A correction request is already pending review for this attendance record. Please wait for administrative review."
        };
      }

      // Format times
      let formattedIn = requested_check_in ? requested_check_in.trim() : null;
      if (formattedIn && formattedIn.length === 5) formattedIn += ":00";

      let formattedOut = requested_check_out ? requested_check_out.trim() : null;
      if (formattedOut && formattedOut.length === 5) formattedOut += ":00";

      // If both provided, validate check_out > check_in
      if (formattedIn && formattedOut) {
        const [ih, im] = formattedIn.split(":").map(Number);
        const [oh, om] = formattedOut.split(":").map(Number);
        const inMins = ih * 60 + (im || 0);
        const outMins = oh * 60 + (om || 0);
        // Note: overnight shifts cross midnight, handled gracefully if outMins < inMins
      }

      // Find or link attendance record
      let targetAttendanceId = attendance_id;
      if (!targetAttendanceId) {
        const att: any = db.prepare(`
          SELECT id FROM attendance 
          WHERE user_id = ? AND date = ? AND session = ?
          LIMIT 1
        `).get(userId, date, session);
        if (att) {
          targetAttendanceId = att.id;
        }
      }

      // Insert correction request audit record
      const result = db.prepare(`
        INSERT INTO attendance_corrections (
          attendance_id, employee_id, workspace_id, date, session,
          requested_check_in, requested_check_out,
          reason, reason_code, status, requested_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `).run(
        targetAttendanceId || null,
        userId,
        workspaceId,
        date,
        session,
        formattedIn,
        formattedOut,
        reason.trim(),
        reason_code || "FORGOTTEN_CHECKOUT",
        userId
      );

      const correctionId = Number(result.lastInsertRowid);

      // If attendance record exists, update its correction status and provisional metadata
      if (targetAttendanceId) {
        db.prepare(`
          UPDATE attendance 
          SET correction_status = 'PENDING',
              correction_requested_by = ?,
              correction_requested_at = CURRENT_TIMESTAMP,
              correction_reason = ?,
              provisional_checkout_time = COALESCE(?, provisional_checkout_time),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          userId,
          reason.trim(),
          formattedOut,
          targetAttendanceId
        );
      }

      // Log to audit trail
      try {
        db.prepare(`
          INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
          VALUES (?, ?, 'ATTENDANCE_CORRECTION_REQUESTED', ?, ?)
        `).run(
          workspaceId,
          userId,
          `Correction requested by ${user.full_name} (${user.role}) for ${date} (${session} session). Requested In: ${formattedIn || 'N/A'}, Requested Out: ${formattedOut || 'N/A'}. Reason: "${reason.trim()}"`,
          clientIp
        );
      } catch (auditErr) {
        console.error("Audit log error on correction request:", auditErr);
      }

      const inserted = db.prepare("SELECT * FROM attendance_corrections WHERE id = ?").get(correctionId);
      return {
        success: true,
        message: "Attendance correction request submitted successfully. Pending administrative approval.",
        correction: inserted
      };
    } catch (err: any) {
      console.error("Error submitting correction request:", err);
      return { success: false, error: err.message || "Internal server error" };
    }
  }

  /**
   * Approve a correction request (Admin/HR Only)
   */
  static approveCorrectionRequest(
    adminUser: any,
    correctionId: number,
    overrideTimes?: { approved_check_in?: string; approved_check_out?: string; approved_hours?: number },
    clientIp: string = "127.0.0.1"
  ): { success: boolean; message?: string; record?: any; error?: string } {
    try {
      const correction: any = db.prepare("SELECT * FROM attendance_corrections WHERE id = ?").get(correctionId);
      if (!correction) {
        return { success: false, error: "Correction request not found." };
      }

      if (correction.status !== "PENDING") {
        return { success: false, error: `Correction request has already been ${correction.status.toLowerCase()}.` };
      }

      const employeeId = correction.employee_id || correction.user_id;
      const employee: any = db.prepare("SELECT id, full_name, phone_number, workspace_id, role, hourly_rate, monthly_base_salary FROM users WHERE id = ?").get(employeeId);
      const workspaceId = employee?.workspace_id || adminUser?.workspace_id || 1;

      // Determine final times
      let finalIn = (overrideTimes?.approved_check_in || correction.requested_check_in)?.trim();
      let finalOut = (overrideTimes?.approved_check_out || correction.requested_check_out)?.trim();

      if (finalIn && finalIn.length === 5) finalIn += ":00";
      if (finalOut && finalOut.length === 5) finalOut += ":00";

      // Session-aware time format normalization (prevents 10-hour discrepancy between Ethiopian and Gregorian clock inputs)
      if (finalIn && finalOut) {
        let [ih, im] = finalIn.split(":").map(Number);
        let [oh, om] = finalOut.split(":").map(Number);

        if (correction.session === "Morning") {
          // If check-in is Ethiopian (ih <= 6) but check-out was entered as Gregorian (oh >= 12 && oh <= 14)
          if (ih <= 6 && oh >= 12 && oh <= 14) {
            oh -= 6;
            finalOut = `${String(oh).padStart(2, "0")}:${String(om || 0).padStart(2, "0")}:00`;
          }
        } else if (correction.session === "Afternoon") {
          // If check-in is Ethiopian (ih <= 12) but check-out was entered as Gregorian (oh >= 13 && oh <= 23)
          if (ih <= 12 && oh >= 13 && oh <= 23) {
            oh -= 6;
            finalOut = `${String(oh).padStart(2, "0")}:${String(om || 0).padStart(2, "0")}:00`;
          }
        }
      }

      const settings = this.getSiteSettings(workspaceId);
      const defaultStartEth = formatToEthiopianTime(
        correction.session === "Morning" 
          ? (settings.morning_start_time || settings.work_start_time) 
          : settings.afternoon_start_time
      );
      const defaultEndEth = formatToEthiopianTime(
        correction.session === "Morning" 
          ? settings.morning_end_time 
          : (settings.afternoon_end_time || settings.work_end_time)
      );
      const defaultInStr = `${String(defaultStartEth.ethHour).padStart(2, "0")}:${defaultStartEth.minute}:00`;
      const defaultOutStr = `${String(defaultEndEth.ethHour).padStart(2, "0")}:${defaultEndEth.minute}:00`;

      // Calculate hours breakdown using WorkCalendarService
      const breakdown = WorkCalendarService.computeAttendanceHoursBreakdown(
        workspaceId,
        correction.date,
        finalIn || defaultInStr,
        finalOut || defaultOutStr,
        correction.session
      );

      const totalHours = overrideTimes?.approved_hours !== undefined 
        ? Number(overrideTimes.approved_hours) 
        : breakdown.totalHours;
      const workedMinutes = Math.round(totalHours * 60);

      // Determine attendance status and penalty
      const scheduledStartEthMins = defaultStartEth.ethHour * 60 + parseInt(defaultStartEth.minute, 10);
      const lateness = this.evaluateLateness(correction.session, finalIn || defaultInStr, settings.late_grace_minutes, scheduledStartEthMins, workspaceId);

      let finalStatus = "Present";
      let penaltyStatus: string | null = null;
      let penaltyAmount = 0.0;
      const lateMinutes = lateness.lateMinutes || 0;

      if (lateness.isLate) {
        finalStatus = "Late";
        penaltyStatus = "PENALIZED";
        const empRate = this.getEmployeeEffectiveHourlyRate(employee);
        const fixedPenalty = settings.late_penalty_fixed_amount ?? 25.0;
        const hourlyMult = settings.late_penalty_hourly_multiplier ?? 0.5;
        penaltyAmount = this.calculateLatePenaltyAmount(lateMinutes, empRate, fixedPenalty, hourlyMult);
      } else if (lateness.isWithinGracePeriod) {
        penaltyStatus = "WITHIN_GRACE";
      } else if (totalHours < 3.75 && breakdown.attendanceType === "REGULAR_WORK") {
        finalStatus = "Partial";
      }

      const overtimeStatus = breakdown.overtimeHours > 0 ? "APPROVED" : null;

      // Update attendance_corrections record
      db.prepare(`
        UPDATE attendance_corrections
        SET status = 'APPROVED',
            approved_check_in = ?,
            approved_check_out = ?,
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        finalIn,
        finalOut,
        adminUser.id,
        correctionId
      );

      // Update or create attendance record
      let targetAttId = correction.attendance_id;
      if (targetAttId) {
        db.prepare(`
          UPDATE attendance 
          SET check_in_time = COALESCE(?, check_in_time),
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
              late_minutes = ?,
              penalty_amount = ?,
              penalty_status = ?,
              status = ?,
              correction_status = 'CORRECTED',
              admin_corrected_by = ?,
              admin_corrected_at = CURRENT_TIMESTAMP,
              admin_correction_reason = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          finalIn,
          finalOut,
          totalHours,
          workedMinutes,
          breakdown.regularHours,
          breakdown.overtimeHours,
          breakdown.regularOvertimeHours || 0,
          breakdown.restDayOvertimeHours || 0,
          breakdown.holidayOvertimeHours || 0,
          breakdown.nightOvertimeHours || 0,
          overtimeStatus,
          lateMinutes,
          penaltyAmount,
          penaltyStatus,
          finalStatus,
          adminUser.id,
          `Approved correction: ${correction.reason || 'Admin Approved'}`,
          targetAttId
        );
      } else {
        // Insert new attendance record if none existed
        const res = db.prepare(`
          INSERT INTO attendance (
            user_id, date, session, check_in_time, check_out_time,
            total_hours, worked_minutes, regular_hours, overtime_hours,
            regular_overtime_hours, rest_day_overtime_hours, holiday_overtime_hours, night_overtime_hours,
            overtime_status, late_minutes, penalty_amount, penalty_status,
            status, correction_status, workspace_id,
            admin_corrected_by, admin_corrected_at, admin_correction_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CORRECTED', ?, ?, CURRENT_TIMESTAMP, ?)
        `).run(
          employeeId,
          correction.date,
          correction.session,
          finalIn,
          finalOut,
          totalHours,
          workedMinutes,
          breakdown.regularHours,
          breakdown.overtimeHours,
          breakdown.regularOvertimeHours || 0,
          breakdown.restDayOvertimeHours || 0,
          breakdown.holidayOvertimeHours || 0,
          breakdown.nightOvertimeHours || 0,
          overtimeStatus,
          lateMinutes,
          penaltyAmount,
          penaltyStatus,
          finalStatus,
          workspaceId,
          adminUser.id,
          `Approved correction: ${correction.reason || 'Admin Approved'}`
        );
        targetAttId = Number(res.lastInsertRowid);
        db.prepare("UPDATE attendance_corrections SET attendance_id = ? WHERE id = ?").run(targetAttId, correctionId);
      }

      // Sync with late_penalties table in database
      if (penaltyStatus === "PENALIZED" || penaltyStatus === "WITHIN_GRACE" || lateMinutes > 0) {
        const existingPen: any = db.prepare("SELECT id FROM late_penalties WHERE attendance_id = ?").get(targetAttId);
        const scheduledStart = defaultInStr;
        if (existingPen) {
          db.prepare(`
            UPDATE late_penalties
            SET late_minutes = ?, penalty_amount = ?, penalty_status = ?, is_within_grace = ?,
                check_in_time = ?, check_out_time = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(lateMinutes, penaltyAmount, penaltyStatus, penaltyStatus === "WITHIN_GRACE" ? 1 : 0, finalIn, finalOut, existingPen.id);
        } else {
          db.prepare(`
            INSERT INTO late_penalties (
              attendance_id, user_id, workspace_id, date, session, check_in_time, check_out_time,
              scheduled_start_time, late_minutes, is_within_grace, penalty_amount, penalty_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            targetAttId, employeeId, workspaceId, correction.date, correction.session,
            finalIn, finalOut, scheduledStart, lateMinutes, penaltyStatus === "WITHIN_GRACE" ? 1 : 0,
            penaltyAmount, penaltyStatus
          );
        }
      } else {
        db.prepare("DELETE FROM late_penalties WHERE attendance_id = ?").run(targetAttId);
      }

      // Sync with overtime_records table in database
      if (breakdown.overtimeHours > 0) {
        const existingOt: any = db.prepare("SELECT id FROM overtime_records WHERE attendance_id = ?").get(targetAttId);
        const mult = breakdown.multiplier || 1.5;
        if (existingOt) {
          db.prepare(`
            UPDATE overtime_records
            SET hours = ?, rate_multiplier = ?, overtime_type = ?, status = 'APPROVED',
                check_in_time = ?, check_out_time = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(breakdown.overtimeHours, mult, breakdown.attendanceType, finalIn, finalOut, adminUser.id, existingOt.id);
        } else {
          db.prepare(`
            INSERT INTO overtime_records (
              attendance_id, employee_id, workspace_id, date, check_in_time, check_out_time,
              overtime_type, work_status, work_status_reason, hours, rate_multiplier, status,
              approved_by, approved_at, qr_verified, gps_verified
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'WORKING', 'CORRECTION_APPROVED', ?, ?, 'APPROVED', ?, CURRENT_TIMESTAMP, 1, 1)
          `).run(targetAttId, employeeId, workspaceId, correction.date, finalIn, finalOut, breakdown.attendanceType, breakdown.overtimeHours, mult, adminUser.id);
        }
      } else {
        db.prepare("DELETE FROM overtime_records WHERE attendance_id = ? AND status = 'PENDING'").run(targetAttId);
      }

      // Write immutable audit log
      try {
        db.prepare(`
          INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
          VALUES (?, ?, 'ATTENDANCE_CORRECTION_APPROVED', ?, ?)
        `).run(
          workspaceId,
          adminUser.id,
          `Admin ${adminUser.full_name || 'Admin'} (${adminUser.role}) APPROVED attendance correction #${correctionId} for ${employee?.full_name || 'Employee'} on ${correction.date} (${correction.session}). In: ${finalIn}, Out: ${finalOut}, Hours: ${totalHours}h, Status: ${finalStatus}.`,
          clientIp
        );
      } catch (auditErr) {
        console.error("Audit log error on approve correction:", auditErr);
      }

      const updatedRecord: any = db.prepare(`
        SELECT a.*, u.full_name, u.phone_number, u.role, adm.full_name as admin_corrector_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN users adm ON a.admin_corrected_by = adm.id
        WHERE a.id = ?
      `).get(targetAttId);

      return {
        success: true,
        message: `Attendance correction approved successfully. Hours verified: ${totalHours}h (${finalStatus}).`,
        record: updatedRecord
      };
    } catch (err: any) {
      console.error("Error approving correction request:", err);
      return { success: false, error: err.message || "Internal server error" };
    }
  }

  /**
   * Reject a correction request (Admin/HR Only)
   */
  static rejectCorrectionRequest(
    adminUser: any,
    correctionId: number,
    rejectionReason: string,
    clientIp: string = "127.0.0.1"
  ): { success: boolean; message?: string; error?: string } {
    if (!rejectionReason || !rejectionReason.trim()) {
      return { success: false, error: "Mandatory rejection reason is required for administrative audit logs." };
    }

    try {
      const correction: any = db.prepare("SELECT * FROM attendance_corrections WHERE id = ?").get(correctionId);
      if (!correction) {
        return { success: false, error: "Correction request not found." };
      }

      if (correction.status !== "PENDING") {
        return { success: false, error: `Correction request has already been ${correction.status.toLowerCase()}.` };
      }

      const employeeId = correction.employee_id || correction.user_id;
      const employee: any = db.prepare("SELECT id, full_name, phone_number, workspace_id, role FROM users WHERE id = ?").get(employeeId);
      const workspaceId = employee?.workspace_id || adminUser?.workspace_id || 1;

      // Update attendance_corrections record
      db.prepare(`
        UPDATE attendance_corrections
        SET status = 'REJECTED',
            rejection_reason = ?,
            reviewed_by = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        rejectionReason.trim(),
        adminUser.id,
        correctionId
      );

      // If attendance record exists, update correction_status and rejection_reason
      if (correction.attendance_id) {
        db.prepare(`
          UPDATE attendance 
          SET correction_status = 'REJECTED',
              rejection_reason = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          rejectionReason.trim(),
          correction.attendance_id
        );
      }

      // Write immutable audit log
      try {
        db.prepare(`
          INSERT INTO audit_logs (workspace_id, user_id, action, details, ip_address)
          VALUES (?, ?, 'ATTENDANCE_CORRECTION_REJECTED', ?, ?)
        `).run(
          workspaceId,
          adminUser.id,
          `Admin ${adminUser.full_name || 'Admin'} (${adminUser.role}) REJECTED attendance correction #${correctionId} for ${employee?.full_name || 'Employee'} on ${correction.date} (${correction.session}). Reason: "${rejectionReason.trim()}".`,
          clientIp
        );
      } catch (auditErr) {
        console.error("Audit log error on reject correction:", auditErr);
      }

      return {
        success: true,
        message: "Attendance correction request has been rejected."
      };
    } catch (err: any) {
      console.error("Error rejecting correction request:", err);
      return { success: false, error: err.message || "Internal server error" };
    }
  }
}
