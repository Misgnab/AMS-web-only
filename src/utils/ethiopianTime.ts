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
  { label: "11:00 ከሰዓት (11:00)", value: "11:00" },
  { label: "11:30 ከሰዓት (11:30)", value: "11:30" },
  { label: "12:00 ምሽት (12:00)", value: "12:00" }
];
