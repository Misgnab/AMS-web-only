/**
 * Single Authoritative Attendance Session & Time Conversion Engine
 * 
 * Provides consistent, workspace-aware attendance session detection and time conversions
 * across Frontend, Backend, Attendance Status API, Admin Attendance, and Employee Check-In.
 */

export type AttendanceSession = "Morning" | "Afternoon";

export type SessionState = 
  | "MORNING" 
  | "AFTERNOON" 
  | "BETWEEN_SHIFTS" 
  | "BEFORE_SHIFTS" 
  | "AFTER_SHIFTS" 
  | "INVALID_CONFIG";

export interface WorkspaceShiftWindows {
  morningStartMins: number;
  morningEndMins: number;
  afternoonStartMins: number;
  afternoonEndMins: number;
  morningStartStr: string;
  morningEndStr: string;
  afternoonStartStr: string;
  afternoonEndStr: string;
  isValid: boolean;
  validationError?: string;
}

export interface AttendanceSessionResult {
  activeSession: AttendanceSession | null;
  status: SessionState;
  message: string;
  currentEthiopianTime: string;
  currentEthiopianMinutes: number;
  shiftWindows: WorkspaceShiftWindows;
  nextSession: AttendanceSession | null;
  nextSessionOpensAt: string | null;
}

/**
 * Converts a time string into Ethiopian minutes from 00:00 (12:00 ጧት sunrise).
 * Intelligently recognizes both:
 * 1. Already-Ethiopian time strings:
 *    - Morning: "02:00" -> 120 mins (2:00 ጧት)
 *    - Break/Noon: "06:00" -> 360 mins (6:00 ከሰዓት / ጧት)
 *    - Afternoon: "07:00" -> 420 mins (7:00 ከሰዓት)
 *    - Afternoon End: "11:00" -> 660 mins (11:00 ከሰዓት)
 * 2. 24-hour Gregorian time strings:
 *    - "08:00" / "08:30" -> 120 / 150 mins
 *    - "12:00" / "12:30" -> 360 / 390 mins
 *    - "13:00" / "13:30" -> 420 / 450 mins
 *    - "17:00" / "17:30" -> 660 / 690 mins
 */
export function parseTimeToEthiopianMinutes(
  timeStr?: string | null,
  context?: 
    | "MorningStart" 
    | "MorningEnd" 
    | "AfternoonStart" 
    | "AfternoonEnd" 
    | "MorningCheckin" 
    | "AfternoonCheckin" 
    | "MorningCheckout" 
    | "AfternoonCheckout"
    | "Current" 
    | "General"
): number | null {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) {
    return null;
  }

  const parts = timeStr.trim().split(":");
  const rawH = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);

  if (isNaN(rawH) || isNaN(m)) return null;

  const ctx = context || "General";

  // 1. Current Ethiopian time (from getEthiopianTimeString(), e.g. "06:09:18")
  if (ctx === "Current") {
    return rawH * 60 + m;
  }

  // 2. Morning Start:
  if (ctx === "MorningStart") {
    // Ethiopian hours 1..6 (e.g. 02:00 -> 2, 02:30 -> 2)
    if (rawH >= 1 && rawH <= 6) {
      return rawH * 60 + m;
    }
    // Gregorian hours 7..11 (e.g. 08:00 -> 2, 08:30 -> 2)
    if (rawH >= 7 && rawH <= 11) {
      return (rawH - 6) * 60 + m;
    }
    // Fallback: 12..23 (unlikely for morning, but if passed)
    return ((rawH - 6 + 24) % 24) * 60 + m;
  }

  // 3. Morning End:
  if (ctx === "MorningEnd" || ctx === "MorningCheckout") {
    // Ethiopian hours 4..6 (e.g. 06:00 -> 6, 06:30 -> 6)
    if (rawH >= 4 && rawH <= 6) {
      return rawH * 60 + m;
    }
    // Gregorian hours 11..13 (e.g. 12:00 -> 6, 12:30 -> 6)
    if (rawH >= 11 && rawH <= 13) {
      return (rawH - 6) * 60 + m;
    }
    // Ethiopian 1..3 (unlikely morning end, but if configured)
    if (rawH >= 1 && rawH <= 3) {
      return rawH * 60 + m;
    }
    return ((rawH - 6 + 24) % 24) * 60 + m;
  }

  // 4. Afternoon Start:
  if (ctx === "AfternoonStart") {
    // Ethiopian hours 6..11 (e.g. 07:00 -> 7, 07:30 -> 7)
    if (rawH >= 6 && rawH <= 11) {
      return rawH * 60 + m;
    }
    // Gregorian hours 12..16 (e.g. 13:00 -> 7, 13:30 -> 7)
    if (rawH >= 12 && rawH <= 16) {
      return (rawH - 6) * 60 + m;
    }
    // 12-hour clock (1:00 PM, 1:30 PM) -> hour 1, 2, 3
    if (rawH >= 1 && rawH <= 3) {
      return (rawH + 6) * 60 + m;
    }
    return ((rawH - 6 + 24) % 24) * 60 + m;
  }

  // 5. Afternoon End:
  if (ctx === "AfternoonEnd" || ctx === "AfternoonCheckout") {
    // Ethiopian hours 8..12 (e.g. 11:00 -> 11, 11:30 -> 11, 12:00 -> 12)
    if (rawH >= 8 && rawH <= 12) {
      return rawH * 60 + m;
    }
    // Gregorian hours 16..20 (e.g. 17:00 -> 11, 17:30 -> 11, 18:00 -> 12)
    if (rawH >= 16 && rawH <= 20) {
      return (rawH - 6) * 60 + m;
    }
    // 12-hour clock (4:00 PM to 6:00 PM) -> hour 4, 5, 6
    if (rawH >= 4 && rawH <= 6) {
      return (rawH + 6) * 60 + m;
    }
    return ((rawH - 6 + 24) % 24) * 60 + m;
  }

  // 6. Morning Checkin window:
  if (ctx === "MorningCheckin") {
    if (rawH >= 1 && rawH <= 6) return rawH * 60 + m;
    if (rawH >= 7 && rawH <= 11) return (rawH - 6) * 60 + m;
    return ((rawH - 6 + 24) % 24) * 60 + m;
  }

  // 7. Afternoon Checkin window:
  if (ctx === "AfternoonCheckin") {
    if (rawH >= 6 && rawH <= 11) return rawH * 60 + m;
    if (rawH >= 12 && rawH <= 16) return (rawH - 6) * 60 + m;
    if (rawH >= 1 && rawH <= 3) return (rawH + 6) * 60 + m;
    return ((rawH - 6 + 24) % 24) * 60 + m;
  }

  // General fallback:
  // If rawH is 1..5: likely Ethiopian morning (01..05)
  // If rawH is 7..11: likely Ethiopian afternoon (07..11)
  // If rawH is 13..23: Gregorian 24h
  if (rawH >= 13 && rawH <= 23) {
    return (rawH - 6) * 60 + m;
  }
  return rawH * 60 + m;
}

/**
 * Formats Ethiopian minutes (e.g. 420) into a clean "HH:MM" Ethiopian time string ("07:00")
 */
export function formatMinutesToEthiopianTimeStr(mins: number): string {
  const normalized = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Extracts and validates shift windows from workspace site_settings
 */
export function getWorkspaceShiftWindows(settings: any): WorkspaceShiftWindows {
  const rawMStart = settings?.morning_start_time || settings?.work_start_time || "02:00";
  const rawMEnd = settings?.morning_end_time || "06:00";
  const rawAStart = settings?.afternoon_start_time || "07:00";
  const rawAEnd = settings?.afternoon_end_time || settings?.work_end_time || "11:00";

  let morningStartMins = parseTimeToEthiopianMinutes(rawMStart, "MorningStart");
  let morningEndMins = parseTimeToEthiopianMinutes(rawMEnd, "MorningEnd");
  let afternoonStartMins = parseTimeToEthiopianMinutes(rawAStart, "AfternoonStart");
  let afternoonEndMins = parseTimeToEthiopianMinutes(rawAEnd, "AfternoonEnd");

  // Fallback to standard corporate Ethiopian shift if completely unparseable
  if (morningStartMins === null) morningStartMins = 120; // 02:00
  if (morningEndMins === null) morningEndMins = 360;     // 06:00
  if (afternoonStartMins === null) afternoonStartMins = 420; // 07:00
  if (afternoonEndMins === null) afternoonEndMins = 660; // 11:00

  // Earliest check-in buffer windows (if configured)
  const rawMEarliest = settings?.morning_earliest_checkin_time || settings?.earliest_checkin_time;
  const rawAEarliest = settings?.afternoon_earliest_checkin_time;

  let morningCheckinOpenMins = morningStartMins;
  if (rawMEarliest) {
    const parsedME = parseTimeToEthiopianMinutes(rawMEarliest, "MorningCheckin");
    if (parsedME !== null && parsedME <= morningStartMins) {
      morningCheckinOpenMins = parsedME;
    }
  }

  let afternoonCheckinOpenMins = afternoonStartMins;
  if (rawAEarliest) {
    const parsedAE = parseTimeToEthiopianMinutes(rawAEarliest, "AfternoonCheckin");
    // Afternoon earliest check-in cannot open before morning shift end (strict lunch break preservation)
    if (parsedAE !== null && parsedAE <= afternoonStartMins && parsedAE >= morningEndMins) {
      afternoonCheckinOpenMins = parsedAE;
    }
  }

  // Validation
  let isValid = true;
  let validationError: string | undefined;

  if (morningStartMins >= morningEndMins) {
    isValid = false;
    validationError = `Morning start (${formatMinutesToEthiopianTimeStr(morningStartMins)}) must be before morning end (${formatMinutesToEthiopianTimeStr(morningEndMins)}).`;
  } else if (afternoonStartMins >= afternoonEndMins) {
    isValid = false;
    validationError = `Afternoon start (${formatMinutesToEthiopianTimeStr(afternoonStartMins)}) must be before afternoon end (${formatMinutesToEthiopianTimeStr(afternoonEndMins)}).`;
  } else if (morningEndMins > afternoonStartMins) {
    isValid = false;
    validationError = `Morning end (${formatMinutesToEthiopianTimeStr(morningEndMins)}) cannot exceed afternoon start (${formatMinutesToEthiopianTimeStr(afternoonStartMins)}).`;
  }

  return {
    morningStartMins,
    morningEndMins,
    afternoonStartMins,
    afternoonEndMins,
    morningStartStr: formatMinutesToEthiopianTimeStr(morningStartMins),
    morningEndStr: formatMinutesToEthiopianTimeStr(morningEndMins),
    afternoonStartStr: formatMinutesToEthiopianTimeStr(afternoonStartMins),
    afternoonEndStr: formatMinutesToEthiopianTimeStr(afternoonEndMins),
    isValid,
    validationError
  };
}

/**
 * Single Authoritative Session-Detection Function
 * 
 * Returns:
 * - "Morning" if current time is within [morningStart, morningEnd)
 * - "Afternoon" if current time is within [afternoonStart, afternoonEnd)
 * - null if in break between shifts [morningEnd, afternoonStart)
 * - null if before morning shift or after afternoon shift
 */
export function detectActiveAttendanceSession(
  currentTimeStr: string,
  settings: any
): AttendanceSessionResult {
  const shiftWindows = getWorkspaceShiftWindows(settings);

  // If configuration is invalid, do NOT silently treat as valid
  if (!shiftWindows.isValid) {
    return {
      activeSession: null,
      status: "INVALID_CONFIG",
      message: `Invalid workspace shift configuration: ${shiftWindows.validationError || "Shift times are misconfigured."}`,
      currentEthiopianTime: currentTimeStr,
      currentEthiopianMinutes: 0,
      shiftWindows,
      nextSession: null,
      nextSessionOpensAt: null
    };
  }

  // Parse current Ethiopian time to minutes
  const currentEthiopianMinutes = parseTimeToEthiopianMinutes(currentTimeStr, "Current") ?? 0;

  const { morningStartMins, morningEndMins, afternoonStartMins, afternoonEndMins } = shiftWindows;

  // 1. Inside Morning Session Window: [morningStart, morningEnd)
  if (currentEthiopianMinutes >= morningStartMins && currentEthiopianMinutes < morningEndMins) {
    return {
      activeSession: "Morning",
      status: "MORNING",
      message: `Morning session active (${shiftWindows.morningStartStr} – ${shiftWindows.morningEndStr}).`,
      currentEthiopianTime: currentTimeStr,
      currentEthiopianMinutes,
      shiftWindows,
      nextSession: "Afternoon",
      nextSessionOpensAt: shiftWindows.afternoonStartStr
    };
  }

  // 2. Inside Afternoon Session Window: [afternoonStart, afternoonEnd)
  if (currentEthiopianMinutes >= afternoonStartMins && currentEthiopianMinutes < afternoonEndMins) {
    return {
      activeSession: "Afternoon",
      status: "AFTERNOON",
      message: `Afternoon session active (${shiftWindows.afternoonStartStr} – ${shiftWindows.afternoonEndStr}).`,
      currentEthiopianTime: currentTimeStr,
      currentEthiopianMinutes,
      shiftWindows,
      nextSession: null,
      nextSessionOpensAt: null
    };
  }

  // 3. Between Morning and Afternoon Shifts (Break / Lunch): [morningEnd, afternoonStart)
  if (currentEthiopianMinutes >= morningEndMins && currentEthiopianMinutes < afternoonStartMins) {
    return {
      activeSession: null,
      status: "BETWEEN_SHIFTS",
      message: `Currently between shifts (${shiftWindows.morningEndStr} – ${shiftWindows.afternoonStartStr}). Afternoon check-in opens at ${shiftWindows.afternoonStartStr} Ethiopian time.`,
      currentEthiopianTime: currentTimeStr,
      currentEthiopianMinutes,
      shiftWindows,
      nextSession: "Afternoon",
      nextSessionOpensAt: shiftWindows.afternoonStartStr
    };
  }

  // 4. Before Morning Shift: < morningStart
  if (currentEthiopianMinutes < morningStartMins) {
    return {
      activeSession: null,
      status: "BEFORE_SHIFTS",
      message: `Outside attendance hours. Morning shift check-in opens at ${shiftWindows.morningStartStr} Ethiopian time.`,
      currentEthiopianTime: currentTimeStr,
      currentEthiopianMinutes,
      shiftWindows,
      nextSession: "Morning",
      nextSessionOpensAt: shiftWindows.morningStartStr
    };
  }

  // 5. After Afternoon Shift: >= afternoonEnd
  return {
    activeSession: null,
    status: "AFTER_SHIFTS",
    message: `Work shifts for today have concluded at ${shiftWindows.afternoonEndStr}. No active attendance session.`,
    currentEthiopianTime: currentTimeStr,
    currentEthiopianMinutes,
    shiftWindows,
    nextSession: null,
    nextSessionOpensAt: null
  };
}
