import { toEthiopian, toGregorian } from "ethiopian-date";

export type EthiopianPeriod = "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT";

export interface EthiopianMonthInfo {
  index: number; // 1 to 13
  amharic: string;
  english: string;
}

export const ETHIOPIAN_MONTHS: EthiopianMonthInfo[] = [
  { index: 1, amharic: "መስከረም", english: "Meskerem" },
  { index: 2, amharic: "ጥቅምት", english: "Tikimt" },
  { index: 3, amharic: "ኅዳር", english: "Hidar" },
  { index: 4, amharic: "ታኅሣሥ", english: "Tahsas" },
  { index: 5, amharic: "ጥር", english: "Tir" },
  { index: 6, amharic: "የካቲት", english: "Yakatit" },
  { index: 7, amharic: "መጋቢት", english: "Megabit" },
  { index: 8, amharic: "ሚያዝያ", english: "Miazia" },
  { index: 9, amharic: "ግንቦት", english: "Ginbot" },
  { index: 10, amharic: "ሰኔ", english: "Sene" },
  { index: 11, amharic: "ሐምሌ", english: "Hamle" },
  { index: 12, amharic: "ነሐሴ", english: "Nehase" },
  { index: 13, amharic: "ጳጉሜን", english: "Pagume" }
];

export interface FormattedEthiopianTime {
  ethHour: number; // 1 to 12
  minute: string; // "00" to "59"
  period: EthiopianPeriod;
  periodAmharic: string; // "ጧት", "ከሰዓት", "ምሽት", "ሌሊት"
  periodEnglish: string; // "Morning", "Afternoon", "Evening", "Night"
  shortText: string; // e.g. "2:30 ጧት"
  fullText: string; // e.g. "2:30 ጧት (Morning)"
  dualText: string; // e.g. "2:30 ጧት (08:30 AM)"
  gregorianTime: string; // e.g. "08:30 AM"
}

/**
 * Converts time to Ethiopian Time display format.
 * Intelligently handles:
 * 1. Already-Ethiopian times (e.g. "02:15:00" in morning, "07:30:00" in afternoon) - PREVENTS DOUBLE CONVERSION
 * 2. 24-hour Gregorian times (e.g. "08:15", "13:30", "17:30")
 * 
 * Ethiopian clock is 6 hours offset from solar/Gregorian 24-hour cycle:
 * - 06:00 AM Gregorian = 12:00 ጧት (Sunrise)
 * - 07:00 AM Gregorian = 1:00 ጧት
 * - 08:00 AM Gregorian = 2:00 ጧት
 * - 12:00 PM Gregorian = 6:00 ከሰዓት / ጧት (Midday)
 * - 01:00 PM Gregorian = 7:00 ከሰዓት
 * - 05:00 PM Gregorian = 11:00 ከሰዓት
 * - 06:00 PM Gregorian = 12:00 ምሽት (Sunset)
 */
export function formatToEthiopianTime(
  timeStr?: string | null,
  sessionHint?: string | null
): FormattedEthiopianTime {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) {
    return {
      ethHour: 2,
      minute: "00",
      period: "MORNING",
      periodAmharic: "ጧት",
      periodEnglish: "Morning",
      shortText: "--:--",
      fullText: "--:--",
      dualText: "--:--",
      gregorianTime: "--:--"
    };
  }

  const parts = timeStr.trim().split(":");
  let rawH = parseInt(parts[0], 10);
  if (isNaN(rawH)) rawH = 0;
  const m = (parts[1] || "00").slice(0, 2).padStart(2, "0");

  let ethHour = 0;
  let period: EthiopianPeriod = "MORNING";
  let periodAmharic = "ጧት";
  let periodEnglish = "Morning";
  let gregPadded = "";

  const hint = (sessionHint || "").toLowerCase();
  const isMorningHint = hint.includes("morning");
  const isAfternoonHint = hint.includes("afternoon");

  if (isMorningHint) {
    // In Morning Shift:
    // Ethiopian hours: 1 to 6 (representing 07:00 AM to 12:00 PM)
    // Gregorian hours: 07:00 to 12:00
    if (rawH >= 1 && rawH <= 6) {
      // ALREADY Ethiopian morning
      ethHour = rawH;
      period = "MORNING";
      periodAmharic = "ጧት";
      periodEnglish = "Morning";
      const gregH = (rawH + 6) % 24;
      gregPadded = `${String(gregH).padStart(2, "0")}:${m} AM`;
    } else {
      // 24-hr Gregorian morning e.g. 07:00 - 12:00
      const ethTotalHours = (rawH - 6 + 24) % 24;
      ethHour = ethTotalHours % 12;
      if (ethHour === 0) ethHour = 12;
      period = rawH === 12 ? "AFTERNOON" : "MORNING";
      periodAmharic = rawH === 12 ? "ከሰዓት" : "ጧት";
      periodEnglish = rawH === 12 ? "Afternoon" : "Morning";
      const greg12 = rawH > 12 ? rawH - 12 : rawH;
      gregPadded = `${String(greg12).padStart(2, "0")}:${m} ${rawH >= 12 ? "PM" : "AM"}`;
    }
  } else if (isAfternoonHint) {
    // In Afternoon Shift:
    // Ethiopian hours: 6 to 12 (representing 12:00 PM to 06:00 PM)
    // Gregorian hours: 12:00 to 18:00 (or 1:00 PM to 6:00 PM)
    if (rawH >= 6 && rawH <= 12) {
      // ALREADY Ethiopian afternoon
      ethHour = rawH;
      period = "AFTERNOON";
      periodAmharic = "ከሰዓት";
      periodEnglish = "Afternoon";
      const gregH = (rawH + 6) % 24;
      const greg12 = gregH > 12 ? gregH - 12 : (gregH === 0 ? 12 : gregH);
      gregPadded = `${String(greg12).padStart(2, "0")}:${m} PM`;
    } else if (rawH >= 13 && rawH <= 23) {
      // 24-hr Gregorian afternoon (13:00 to 23:00)
      const ethTotalHours = (rawH - 6 + 24) % 24;
      ethHour = ethTotalHours % 12;
      if (ethHour === 0) ethHour = 12;
      period = rawH >= 18 ? "EVENING" : "AFTERNOON";
      periodAmharic = rawH >= 18 ? "ምሽት" : "ከሰዓት";
      periodEnglish = rawH >= 18 ? "Evening" : "Afternoon";
      const greg12 = rawH - 12;
      gregPadded = `${String(greg12).padStart(2, "0")}:${m} PM`;
    } else if (rawH >= 1 && rawH <= 5) {
      // 12-hour format e.g. 1:30 PM = 13:30 = 7:30 ከሰዓት
      ethHour = rawH + 6;
      period = "AFTERNOON";
      periodAmharic = "ከሰዓት";
      periodEnglish = "Afternoon";
      gregPadded = `${String(rawH).padStart(2, "0")}:${m} PM`;
    } else {
      ethHour = 12;
      period = "AFTERNOON";
      periodAmharic = "ከሰዓት";
      periodEnglish = "Afternoon";
      gregPadded = `12:${m} PM`;
    }
  } else {
    // No session hint provided:
    if (rawH >= 1 && rawH <= 5) {
      // In Ethiopian attendance system, 1 to 5 without hint represents Ethiopian Morning (07:00 AM to 11:00 AM)
      ethHour = rawH;
      period = "MORNING";
      periodAmharic = "ጧት";
      periodEnglish = "Morning";
      const gregH = rawH + 6;
      gregPadded = `${String(gregH).padStart(2, "0")}:${m} AM`;
    } else if (rawH === 6) {
      // 6:00 is 12:00 noon
      ethHour = 6;
      period = "MORNING";
      periodAmharic = "ከሰዓት / ጧት";
      periodEnglish = "Midday";
      gregPadded = `12:${m} PM`;
    } else if (rawH >= 7 && rawH <= 11) {
      // In Ethiopian local time, 7 to 11 represents Ethiopian Afternoon / Kese'at (07:00 to 11:00, corresponding to 01:00 PM to 05:00 PM)
      ethHour = rawH;
      period = "AFTERNOON";
      periodAmharic = "ከሰዓት";
      periodEnglish = "Afternoon";
      const gregH = (rawH + 6) % 24;
      const greg12 = gregH > 12 ? gregH - 12 : (gregH === 0 ? 12 : gregH);
      gregPadded = `${String(greg12).padStart(2, "0")}:${m} PM`;
    } else if (rawH === 12) {
      ethHour = 12;
      period = "AFTERNOON";
      periodAmharic = "ከሰዓት / ማታ";
      periodEnglish = "Evening";
      gregPadded = `06:${m} PM`;
    } else if (rawH >= 13 && rawH <= 23) {
      // 24-hr afternoon / evening (13:00 - 23:00)
      const ethTotalHours = (rawH - 6 + 24) % 24;
      ethHour = ethTotalHours % 12;
      if (ethHour === 0) ethHour = 12;
      period = rawH >= 18 ? "EVENING" : "AFTERNOON";
      periodAmharic = rawH >= 18 ? "ምሽት" : "ከሰዓት";
      periodEnglish = rawH >= 18 ? "Evening" : "Afternoon";
      const greg12 = rawH - 12;
      gregPadded = `${String(greg12).padStart(2, "0")}:${m} PM`;
    } else {
      // 00:xx midnight
      ethHour = 6;
      period = "NIGHT";
      periodAmharic = "ሌሊት";
      periodEnglish = "Night";
      gregPadded = `12:${m} AM`;
    }
  }

  const shortText = `${ethHour}:${m} ${periodAmharic}`;
  const fullText = `${ethHour}:${m} ${periodAmharic} (${periodEnglish})`;
  const dualText = `${ethHour}:${m} ${periodAmharic} (${gregPadded})`;

  return {
    ethHour,
    minute: m,
    period,
    periodAmharic,
    periodEnglish,
    shortText,
    fullText,
    dualText,
    gregorianTime: gregPadded
  };
}

/**
 * Formats a shift time range into Ethiopian time (e.g. "02:00" to "06:00" -> "2:00 ጧት - 6:00 ከሰዓት")
 */
export function formatEthiopianTimeRange(startStr?: string | null, endStr?: string | null): {
  ethiopian: string;
  gregorian: string;
  display: string;
} {
  const start = formatToEthiopianTime(startStr || "02:00", "Morning");
  const end = formatToEthiopianTime(endStr || "06:00", "Morning");

  const ethiopian = `${start.shortText} - ${end.shortText}`;
  const gregorian = `${start.gregorianTime} - ${end.gregorianTime}`;
  const display = `${ethiopian} (${gregorian})`;

  return { ethiopian, gregorian, display };
}

/**
 * Convert Ethiopian 12-hour clock + period back to 24-hour Gregorian "HH:MM"
 */
export function ethiopianToGregorianTime(
  ethHour: number,
  minute: number | string,
  period: EthiopianPeriod | "ጧት" | "ከሰዓት" | "ምሽት" | "ሌሊት"
): string {
  const m = String(minute).padStart(2, "0").slice(0, 2);
  const normalizedHour = ethHour % 12;

  let gregH = 0;
  if (period === "MORNING" || period === "ጧት") {
    gregH = 6 + normalizedHour;
  } else if (period === "AFTERNOON" || period === "ከሰዓት") {
    gregH = 6 + normalizedHour;
  } else if (period === "EVENING" || period === "ምሽት") {
    gregH = 18 + normalizedHour;
  } else {
    gregH = (18 + normalizedHour) % 24;
  }

  return `${String(gregH).padStart(2, "0")}:${m}`;
}

export interface FormattedEthiopianDate {
  year: number;
  month: number;
  day: number;
  monthNameAm: string;
  monthNameEn: string;
  formattedAm: string; // e.g. "መስከረም 1, 2019 ዓ.ም."
  formattedEn: string; // e.g. "Meskerem 1, 2019 E.C."
  shortAm: string; // e.g. "መስከረም 1"
  shortEn: string; // e.g. "Meskerem 1"
  gregorianDate: string; // e.g. "2026-09-11"
}

/**
 * Formats a date string into an Ethiopian Date object and formatted strings.
 * CRITICAL ANTI-DOUBLE-CONVERSION GUARANTEE:
 * If the input is ALREADY an Ethiopian calendar date string (e.g. "2019-01-19", "2017-02-15"),
 * it NEVER calls toEthiopian() on it (which would subtract another ~8 years).
 * It preserves the exact Ethiopian year, month, and day and derives the Gregorian equivalent via toGregorian().
 */
export function gregorianToEthiopianDate(dateStr?: string | null): FormattedEthiopianDate {
  if (!dateStr || typeof dateStr !== "string") {
    const today = new Date();
    dateStr = today.toISOString().split("T")[0];
  }

  try {
    const parts = dateStr.trim().split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [y, m, d] = parts;
      let ey: number, em: number, ed: number;
      let gregDateStr = dateStr;

      // Smart Anti-Double-Conversion Detection:
      // If the year is between 2000 and 2023 (or month 13 Pagume),
      // it is ALREADY an Ethiopian calendar date from our database (e.g. 2016, 2017, 2018, 2019 E.C.)!
      // In our current era (Gregorian 2024-2030), active Ethiopian years are 2016-2023.
      // Therefore, if y <= 2023 or m === 13, DO NOT pass to toEthiopian()!
      if ((y >= 1900 && y <= 2023 && m >= 1 && m <= 13 && d >= 1 && d <= 30) || m === 13) {
        ey = y;
        em = m;
        ed = d;
        try {
          const [gy, gm, gd] = toGregorian(ey, em, ed);
          gregDateStr = `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
        } catch {
          gregDateStr = dateStr;
        }
      } else {
        // It is a Gregorian date (e.g. 2026-09-29), convert to Ethiopian once
        const [convEy, convEm, convEd] = toEthiopian(y, m, d);
        ey = convEy;
        em = convEm;
        ed = convEd;
      }

      const monthInfo = ETHIOPIAN_MONTHS.find((mi) => mi.index === em) || {
        amharic: `ወር ${em}`,
        english: `Month ${em}`
      };

      return {
        year: ey,
        month: em,
        day: ed,
        monthNameAm: monthInfo.amharic,
        monthNameEn: monthInfo.english,
        formattedAm: `${monthInfo.amharic} ${ed}, ${ey} ዓ.ም.`,
        formattedEn: `${monthInfo.english} ${ed}, ${ey} E.C.`,
        shortAm: `${monthInfo.amharic} ${ed}`,
        shortEn: `${monthInfo.english} ${ed}`,
        gregorianDate: gregDateStr
      };
    }
  } catch (err) {
    console.error("Error in gregorianToEthiopianDate:", err);
  }

  return {
    year: 2019,
    month: 1,
    day: 1,
    monthNameAm: "መስከረም",
    monthNameEn: "Meskerem",
    formattedAm: "መስከረም 1, 2019 ዓ.ም.",
    formattedEn: "Meskerem 1, 2019 E.C.",
    shortAm: "መስከረም 1",
    shortEn: "Meskerem 1",
    gregorianDate: dateStr || ""
  };
}

/**
 * Convert Ethiopian Date (Year, Month, Day) to Gregorian YYYY-MM-DD
 */
export function ethiopianToGregorianDate(ey: number, em: number, ed: number): string {
  try {
    const [gy, gm, gd] = toGregorian(ey, em, ed);
    return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
  } catch (err) {
    console.error("Error in ethiopianToGregorianDate:", err);
    return `${ey}-${String(em).padStart(2, "0")}-${String(ed).padStart(2, "0")}`;
  }
}

/**
 * Returns the Ethiopian calendar date in YYYY-MM-DD format for a given Date or string.
 * NEVER converts an already Ethiopian date for the second time!
 */
export function getEthiopianDateString(dateInput?: Date | string | null): string {
  try {
    let gy: number, gm: number, gd: number;
    if (dateInput instanceof Date) {
      gy = dateInput.getFullYear();
      gm = dateInput.getMonth() + 1;
      gd = dateInput.getDate();
      const [ey, em, ed] = toEthiopian(gy, gm, gd);
      return `${ey}-${String(em).padStart(2, "0")}-${String(ed).padStart(2, "0")}`;
    } else if (typeof dateInput === "string" && dateInput.includes("-")) {
      const parts = dateInput.split("T")[0].split("-").map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        const [y, m, d] = parts;
        // If already Ethiopian date (year <= 2023 or month 13): return as is!
        if ((y >= 1900 && y <= 2023 && m >= 1 && m <= 13 && d >= 1 && d <= 30) || m === 13) {
          return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        }
        // If Gregorian date (year >= 2024):
        const [ey, em, ed] = toEthiopian(y, m, d);
        return `${ey}-${String(em).padStart(2, "0")}-${String(ed).padStart(2, "0")}`;
      }
    }
    // Default: current date
    const now = new Date();
    gy = now.getFullYear();
    gm = now.getMonth() + 1;
    gd = now.getDate();
    const [ey, em, ed] = toEthiopian(gy, gm, gd);
    return `${ey}-${String(em).padStart(2, "0")}-${String(ed).padStart(2, "0")}`;
  } catch (err) {
    console.error("Error calculating Ethiopian date string:", err);
    return "2019-01-01";
  }
}

export interface EthiopianPresetShift {
  name: string;
  nameAm: string;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
  morning_ethiopian: string;
  afternoon_ethiopian: string;
  description: string;
}

export const ETHIOPIAN_PRESET_SHIFTS: EthiopianPresetShift[] = [
  {
    name: "Standard Ethiopian Corporate (02:00 - 06:00, 07:00 - 11:00)",
    nameAm: "መደበኛ የኢትዮጵያ ሰዓት (2:00 - 6:00, 7:00 - 11:00)",
    morning_start: "02:00",
    morning_end: "06:00",
    afternoon_start: "07:00",
    afternoon_end: "11:00",
    morning_ethiopian: "2:00 ጧት – 6:00 ከሰዓት",
    afternoon_ethiopian: "7:00 ከሰዓት – 11:00 ከሰዓት",
    description: "Standard Ethiopian work schedule: 4 hours morning (02:00 to 06:00) + 4 hours afternoon (07:00 to 11:00)"
  },
  {
    name: "Ethiopian Shift with 30m Flex (02:30 - 06:30, 07:30 - 11:30)",
    nameAm: "የተራዘመ የኢትዮጵያ ሰዓት (2:30 - 6:30, 7:30 - 11:30)",
    morning_start: "02:30",
    morning_end: "06:30",
    afternoon_start: "07:30",
    afternoon_end: "11:30",
    morning_ethiopian: "2:30 ጧት – 6:30 ከሰዓት",
    afternoon_ethiopian: "7:30 ከሰዓት – 11:30 ከሰዓት",
    description: "Shift with 30m buffer: 02:30 - 06:30 and 07:30 - 11:30"
  },
  {
    name: "Commercial & Retail Shift (02:00 - 06:00, 07:00 - 12:00)",
    nameAm: "የንግድ / የሱቅ ፈረቃ (2:00 - 6:00, 7:00 - 12:00)",
    morning_start: "02:00",
    morning_end: "06:00",
    afternoon_start: "07:00",
    afternoon_end: "12:00",
    morning_ethiopian: "2:00 ጧት – 6:00 ከሰዓት",
    afternoon_ethiopian: "7:00 ከሰዓት – 12:00 ምሽት",
    description: "Extended hours: 02:00 - 06:00 and 07:00 - 12:00"
  }
];

export const ETHIOPIAN_QUICK_TIMES = [
  { label: "1:00 ጧት (01:00)", value: "01:00" },
  { label: "1:30 ጧት (01:30)", value: "01:30" },
  { label: "2:00 ጧት (02:00)", value: "02:00" },
  { label: "2:30 ጧት (02:30)", value: "02:30" },
  { label: "3:00 ጧት (03:00)", value: "03:00" },
  { label: "4:00 ጧት (04:00)", value: "04:00" },
  { label: "5:00 ጧት (05:00)", value: "05:00" },
  { label: "6:00 ከሰዓት (06:00)", value: "06:00" },
  { label: "6:30 ከሰዓት (06:30)", value: "06:30" },
  { label: "7:00 ከሰዓት (07:00)", value: "07:00" },
  { label: "7:30 ከሰዓት (07:30)", value: "07:30" },
  { label: "8:00 ከሰዓት (08:00)", value: "08:00" },
  { label: "10:00 ከሰዓት (10:00)", value: "10:00" },
  { label: "11:00 ከሰዓat (11:00)", value: "11:00" },
  { label: "11:30 ከሰዓት (11:30)", value: "11:30" },
  { label: "12:00 ምሽት (12:00)", value: "12:00" }
];

/**
 * Authoritative Ethiopian time string (Addis Ababa timezone, 24-hr Ethiopian clock 00:00:00 - 23:59:59)
 * Offset by 6 hours from Gregorian time in Africa/Addis_Ababa:
 * 06:00 AM Gregorian -> 00:00 Ethiopian
 * 12:00 PM Gregorian -> 06:00 Ethiopian
 * 01:00 PM Gregorian -> 07:00 Ethiopian
 * 05:00 PM Gregorian -> 11:00 Ethiopian
 * 06:00 PM Gregorian -> 12:00 Ethiopian
 */
export function getEthiopianTimeString(dateInput: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Addis_Ababa",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const formatted = formatter.format(dateInput);
    const parts = formatted.split(":");
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const s = parts[2];
    const ethH = (h - 6 + 24) % 24;
    return `${String(ethH).padStart(2, "0")}:${m}:${s}`;
  } catch (err) {
    const d = new Date(dateInput);
    const h = d.getHours();
    const ethH = (h - 6 + 24) % 24;
    return `${String(ethH).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }
}

/**
 * Normalizes any configured shift time string to Ethiopian minutes from 00:00 Ethiopian (06:00 AM).
 * Handles:
 * 1. 24-hr Gregorian ("08:00", "08:30", "12:00", "12:30", "13:00", "13:30", "17:00", "17:30")
 * 2. Ethiopian clock ("01:00", "02:00", "06:00", "07:00", "11:00", "12:00")
 * 3. Prevents catastrophic double conversions (e.g. converting Ethiopian 07:00 to 01:00 AM).
 */
export function parseTimeToEthMinutes(
  timeStr?: string | null,
  defaultMins: number = 0,
  sessionHint?: "Morning" | "Afternoon" | string
): number {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return defaultMins;
  const parts = timeStr.trim().split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return defaultMins;

  const hint = (sessionHint || "").toLowerCase();
  const isMorning = hint.includes("morning");
  const isAfternoon = hint.includes("afternoon");

  if (isMorning) {
    // In morning session:
    // Ethiopian morning: 01:00 to 06:30 (60 to 390 min).
    // Gregorian morning: 07:00 to 12:30.
    if (h >= 1 && h <= 6) {
      // Already Ethiopian morning (01:00 - 06:00)
      return h * 60 + m;
    }
    if (h >= 7 && h <= 12) {
      // 24-hr Gregorian morning (07:00 - 12:00)
      return (h - 6) * 60 + m;
    }
    if (h >= 6 && h <= 23) {
      return ((h - 6 + 24) % 24) * 60 + m;
    }
  } else if (isAfternoon) {
    // In afternoon session:
    // Ethiopian afternoon: 06:00 to 12:00 (360 to 720 min, or up to 14:00 for OT).
    // Gregorian afternoon: 12:00 to 20:00 (or up to 23:59).
    if (h >= 12 && h <= 23) {
      // 24-hr Gregorian afternoon (12:00, 12:30, 13:00, 17:30)
      return (h - 6) * 60 + m;
    }
    if (h >= 1 && h <= 11) {
      // Already Ethiopian afternoon (07:00 = 1 PM, 11:00 = 5 PM)
      return h * 60 + m;
    }
  }

  // Fallback:
  if (h >= 6 && h <= 23) {
    return (h - 6) * 60 + m;
  }
  return h * 60 + m;
}

export type AttendanceSession = "Morning" | "Afternoon";

export type SessionState =
  | "MORNING"
  | "AFTERNOON"
  | "BETWEEN_SHIFTS"
  | "BEFORE_HOURS"
  | "AFTER_HOURS"
  | "INVALID_CONFIG";

export interface AttendanceSessionDetermination {
  activeSession: AttendanceSession | null;
  sessionState: SessionState;
  statusMessage: string;
  isBetweenShifts: boolean;
  isOutsideHours: boolean;
  nowEthiopianTime: string;
  nowTotalMins: number;
  morningStartEthMins: number;
  morningEndEthMins: number;
  morningEarliestCheckinEthMins: number;
  morningLatestCheckinEthMins: number;
  afternoonStartEthMins: number;
  afternoonEndEthMins: number;
  afternoonEarliestCheckinEthMins: number;
  afternoonLatestCheckinEthMins: number;
  canCheckIn: boolean;
  canCheckInMorning: boolean;
  canCheckInAfternoon: boolean;
  isWithinMorningWindow: boolean;
  isWithinAfternoonWindow: boolean;
  morningShiftEnded: boolean;
  afternoonShiftEnded: boolean;
  nextSession: AttendanceSession | null;
  nextSessionOpensAt: string | null;
  nextSessionOpensInMinutes: number | null;
  blockReason?: string | null;
}

/**
 * Formats Ethiopian minutes (from 00:00 Ethiopian / 06:00 AM) to a standard HH:mm string.
 */
export function formatEthMinutesToStr(totalMins: number): string {
  const norm = ((totalMins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Authoritative Attendance Session Engine
 * Resolves session dynamically based on workspace settings and current Ethiopian clock.
 * Correctly distinguishes Morning session, Afternoon session, Break Between Shifts, and Outside Hours.
 */
export function determineAttendanceSession(
  settings: any,
  nowOrTimeStr?: Date | string | null
): AttendanceSessionDetermination {
  let nowTimeStr: string;
  if (!nowOrTimeStr) {
    nowTimeStr = getEthiopianTimeString(new Date());
  } else if (nowOrTimeStr instanceof Date) {
    nowTimeStr = getEthiopianTimeString(nowOrTimeStr);
  } else if (typeof nowOrTimeStr === "string") {
    if (nowOrTimeStr.includes("T")) {
      nowTimeStr = getEthiopianTimeString(new Date(nowOrTimeStr));
    } else if (nowOrTimeStr.includes(":")) {
      nowTimeStr = nowOrTimeStr.trim();
    } else {
      nowTimeStr = getEthiopianTimeString(new Date());
    }
  } else {
    nowTimeStr = getEthiopianTimeString(new Date());
  }

  const parts = nowTimeStr.split(":");
  const nowH = parseInt(parts[0], 10) || 0;
  const nowM = parseInt(parts[1], 10) || 0;
  const nowTotalMins = nowH * 60 + nowM;

  // 1. Morning Shift Boundaries
  const morningStartEthMins = parseTimeToEthMinutes(
    settings?.morning_start_time || settings?.work_start_time || "08:30",
    150,
    "Morning"
  );
  const morningEndEthMins = parseTimeToEthMinutes(
    settings?.morning_end_time || "12:30",
    390,
    "Morning"
  );
  const morningEarliestCheckinEthMins = parseTimeToEthMinutes(
    settings?.morning_earliest_checkin_time || settings?.earliest_checkin_time || "07:00",
    Math.max(0, morningStartEthMins - 60),
    "Morning"
  );
  const morningLatestCheckinEthMins = parseTimeToEthMinutes(
    settings?.morning_latest_checkin_time || settings?.latest_checkin_time || "10:30",
    morningEndEthMins,
    "Morning"
  );

  // 2. Afternoon Shift Boundaries
  const afternoonStartEthMins = parseTimeToEthMinutes(
    settings?.afternoon_start_time || "13:30",
    450,
    "Afternoon"
  );
  const afternoonEndEthMins = parseTimeToEthMinutes(
    settings?.afternoon_end_time || settings?.work_end_time || "17:30",
    690,
    "Afternoon"
  );
  const afternoonEarliestCheckinEthMins = parseTimeToEthMinutes(
    settings?.afternoon_earliest_checkin_time || "12:30",
    Math.max(morningEndEthMins, afternoonStartEthMins - 60),
    "Afternoon"
  );
  const afternoonLatestCheckinEthMins = parseTimeToEthMinutes(
    settings?.afternoon_latest_checkin_time || "15:30",
    afternoonEndEthMins,
    "Afternoon"
  );

  // Validate settings integrity safely
  if (morningStartEthMins >= morningEndEthMins || afternoonStartEthMins >= afternoonEndEthMins) {
    return {
      activeSession: null,
      sessionState: "INVALID_CONFIG",
      statusMessage: "Shift schedule configuration error: Shift start time must precede shift end time.",
      isBetweenShifts: false,
      isOutsideHours: true,
      nowEthiopianTime: nowTimeStr,
      nowTotalMins,
      morningStartEthMins,
      morningEndEthMins,
      morningEarliestCheckinEthMins,
      morningLatestCheckinEthMins,
      afternoonStartEthMins,
      afternoonEndEthMins,
      afternoonEarliestCheckinEthMins,
      afternoonLatestCheckinEthMins,
      canCheckIn: false,
      canCheckInMorning: false,
      canCheckInAfternoon: false,
      isWithinMorningWindow: false,
      isWithinAfternoonWindow: false,
      morningShiftEnded: false,
      afternoonShiftEnded: false,
      nextSession: null,
      nextSessionOpensAt: null,
      nextSessionOpensInMinutes: null,
      blockReason: "Invalid workspace schedule configuration."
    };
  }

  const morningShiftEnded = nowTotalMins >= morningEndEthMins;
  const afternoonShiftEnded = nowTotalMins >= afternoonEndEthMins;

  // Afternoon envelope ends after checkout grace period or configured latest checkout
  const afternoonGrace = settings?.afternoon_checkout_grace_minutes ?? settings?.checkout_grace_minutes ?? 60;
  const afternoonLatestCheckout = settings?.afternoon_latest_checkout_time 
    ? parseTimeToEthMinutes(settings.afternoon_latest_checkout_time, afternoonEndEthMins + afternoonGrace, "Afternoon")
    : (afternoonEndEthMins + afternoonGrace);
  const afternoonEnvelopeEnd = Math.max(afternoonEndEthMins + afternoonGrace, afternoonLatestCheckout);

  const isWithinMorningWindow = nowTotalMins >= morningEarliestCheckinEthMins && nowTotalMins < morningEndEthMins;
  const isWithinAfternoonWindow = nowTotalMins >= afternoonEarliestCheckinEthMins && nowTotalMins < afternoonEnvelopeEnd;

  // Determine active session & state
  let activeSession: AttendanceSession | null = null;
  let sessionState: SessionState = "BEFORE_HOURS";
  let isBetweenShifts = false;
  let isOutsideHours = false;
  let statusMessage = "";
  let nextSession: AttendanceSession | null = null;
  let nextSessionOpensAt: string | null = null;
  let nextSessionOpensInMinutes: number | null = null;
  let canCheckInMorning = false;
  let canCheckInAfternoon = false;
  let blockReason: string | null = null;

  if (nowTotalMins < morningEarliestCheckinEthMins) {
    // Early morning before attendance window opens
    activeSession = null;
    sessionState = "BEFORE_HOURS";
    isOutsideHours = true;
    nextSession = "Morning";
    nextSessionOpensAt = formatEthMinutesToStr(morningEarliestCheckinEthMins);
    nextSessionOpensInMinutes = morningEarliestCheckinEthMins - nowTotalMins;
    statusMessage = `Morning attendance window opens at ${nextSessionOpensAt} Ethiopian time (Shift: ${formatEthMinutesToStr(morningStartEthMins)} - ${formatEthMinutesToStr(morningEndEthMins)}).`;
    blockReason = `Attendance window has not opened yet. Morning check-in opens at ${nextSessionOpensAt}.`;
  } else if (isWithinMorningWindow) {
    // Morning session is active!
    activeSession = "Morning";
    sessionState = "MORNING";
    canCheckInMorning = nowTotalMins <= morningLatestCheckinEthMins || nowTotalMins < morningEndEthMins;
    statusMessage = `Morning attendance session is active (Shift: ${formatEthMinutesToStr(morningStartEthMins)} - ${formatEthMinutesToStr(morningEndEthMins)}).`;
    nextSession = "Afternoon";
    nextSessionOpensAt = formatEthMinutesToStr(afternoonEarliestCheckinEthMins);
    if (!canCheckInMorning) {
      blockReason = `Morning check-in closed at ${formatEthMinutesToStr(morningLatestCheckinEthMins)}.`;
    }
  } else if (nowTotalMins >= morningEndEthMins && nowTotalMins < afternoonEarliestCheckinEthMins) {
    // Break between shifts (Midday Break / Lunch Break)!
    activeSession = null;
    sessionState = "BETWEEN_SHIFTS";
    isBetweenShifts = true;
    nextSession = "Afternoon";
    nextSessionOpensAt = formatEthMinutesToStr(afternoonEarliestCheckinEthMins);
    nextSessionOpensInMinutes = afternoonEarliestCheckinEthMins - nowTotalMins;
    statusMessage = `Between Shifts: Morning session ended at ${formatEthMinutesToStr(morningEndEthMins)}. Afternoon check-in opens at ${nextSessionOpensAt} (Shift: ${formatEthMinutesToStr(afternoonStartEthMins)} - ${formatEthMinutesToStr(afternoonEndEthMins)}).`;
    blockReason = `Between shifts: Morning shift has concluded. Afternoon check-in opens at ${nextSessionOpensAt} (${nextSessionOpensInMinutes}m remaining).`;
  } else if (isWithinAfternoonWindow) {
    // Afternoon session is active!
    activeSession = "Afternoon";
    sessionState = "AFTERNOON";
    canCheckInAfternoon = (nowTotalMins <= afternoonLatestCheckinEthMins || nowTotalMins < afternoonEndEthMins);
    statusMessage = `Afternoon attendance session is active (Shift: ${formatEthMinutesToStr(afternoonStartEthMins)} - ${formatEthMinutesToStr(afternoonEndEthMins)}).`;
    if (!canCheckInAfternoon) {
      blockReason = `Afternoon check-in closed at ${formatEthMinutesToStr(afternoonLatestCheckinEthMins)}.`;
    }
  } else {
    // Past afternoon envelope (Night / Closed)
    activeSession = null;
    sessionState = "AFTER_HOURS";
    isOutsideHours = true;
    nextSession = "Morning";
    nextSessionOpensAt = formatEthMinutesToStr(morningEarliestCheckinEthMins);
    statusMessage = `Attendance hours for today have closed. Afternoon shift ended at ${formatEthMinutesToStr(afternoonEndEthMins)}.`;
    blockReason = "Attendance hours for today have ended.";
  }

  const canCheckIn = activeSession === "Morning" ? canCheckInMorning : (activeSession === "Afternoon" ? canCheckInAfternoon : false);

  return {
    activeSession,
    sessionState,
    statusMessage,
    isBetweenShifts,
    isOutsideHours,
    nowEthiopianTime: nowTimeStr,
    nowTotalMins,
    morningStartEthMins,
    morningEndEthMins,
    morningEarliestCheckinEthMins,
    morningLatestCheckinEthMins,
    afternoonStartEthMins,
    afternoonEndEthMins,
    afternoonEarliestCheckinEthMins,
    afternoonLatestCheckinEthMins,
    canCheckIn,
    canCheckInMorning,
    canCheckInAfternoon,
    isWithinMorningWindow,
    isWithinAfternoonWindow,
    morningShiftEnded,
    afternoonShiftEnded,
    nextSession,
    nextSessionOpensAt,
    nextSessionOpensInMinutes,
    blockReason
  };
}
