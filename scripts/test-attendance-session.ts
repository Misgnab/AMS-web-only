import { parseTimeToEthMinutes, determineAttendanceSession, formatEthMinutesToStr } from "../src/utils/ethiopianTime.ts";

console.log("===============================================================================");
console.log("       STARTING ATTENDANCE SESSION DETECTION & CONVERSION TEST SUITE           ");
console.log("===============================================================================");

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`✅ PASS | ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL | ${description} ${details ? `(${details})` : ""}`);
    failed++;
  }
}

// TEST 1: Stored format normalization (24h Gregorian vs Ethiopian clock)
console.log("\n--- TEST GROUP 1: TIME CONVERSION TO ETHIOPIAN MINUTES ---");

// Morning shift: 02:00 Ethiopian (08:00 AM Gregorian) = 120 mins
assert(
  "parseTimeToEthMinutes('08:00', 0, 'Morning') resolves to 120 Ethiopian minutes",
  parseTimeToEthMinutes("08:00", 0, "Morning") === 120
);
assert(
  "parseTimeToEthMinutes('02:00', 0, 'Morning') resolves to 120 Ethiopian minutes",
  parseTimeToEthMinutes("02:00", 0, "Morning") === 120
);

// Morning shift end: 06:00 Ethiopian (12:00 PM Gregorian) = 360 mins
assert(
  "parseTimeToEthMinutes('12:00', 0, 'Morning') resolves to 360 Ethiopian minutes",
  parseTimeToEthMinutes("12:00", 0, "Morning") === 360
);
assert(
  "parseTimeToEthMinutes('06:00', 0, 'Morning') resolves to 360 Ethiopian minutes",
  parseTimeToEthMinutes("06:00", 0, "Morning") === 360
);

// Afternoon shift start: 07:00 Ethiopian (01:00 PM Gregorian = 13:00) = 420 mins
assert(
  "parseTimeToEthMinutes('13:00', 0, 'Afternoon') resolves to 420 Ethiopian minutes",
  parseTimeToEthMinutes("13:00", 0, "Afternoon") === 420
);
assert(
  "parseTimeToEthMinutes('07:00', 0, 'Afternoon') resolves to 420 Ethiopian minutes (Prevents double conversion to 01:00 AM!)",
  parseTimeToEthMinutes("07:00", 0, "Afternoon") === 420
);

// Afternoon shift end: 11:00 Ethiopian (05:00 PM Gregorian = 17:00) = 660 mins
assert(
  "parseTimeToEthMinutes('17:00', 0, 'Afternoon') resolves to 660 Ethiopian minutes",
  parseTimeToEthMinutes("17:00", 0, "Afternoon") === 660
);
assert(
  "parseTimeToEthMinutes('11:00', 0, 'Afternoon') resolves to 660 Ethiopian minutes",
  parseTimeToEthMinutes("11:00", 0, "Afternoon") === 660
);

// Afternoon earliest check-in: 12:30 Gregorian or 06:30 Ethiopian = 390 mins
assert(
  "parseTimeToEthMinutes('12:30', 0, 'Afternoon') resolves to 390 Ethiopian minutes",
  parseTimeToEthMinutes("12:30", 0, "Afternoon") === 390
);
assert(
  "parseTimeToEthMinutes('06:30', 0, 'Afternoon') resolves to 390 Ethiopian minutes",
  parseTimeToEthMinutes("06:30", 0, "Afternoon") === 390
);

console.log("\n--- TEST GROUP 2: BREAK BETWEEN SHIFTS (USER SCENARIO) ---");
// The problem described:
// - Current Ethiopian clock: 06:09:18 (Kese'at / Afternoon)
// - Morning shift: 02:00–06:00 Ethiopian time (ends at 06:00)
// - Afternoon shift: 07:00–11:00 Ethiopian time (starts at 07:00)
// At 06:09:18, it is between shifts (lunch break).
const shiftBreakSettings = {
  morning_start_time: "02:00",
  morning_end_time: "06:00",
  morning_earliest_checkin_time: "01:00",
  morning_latest_checkin_time: "05:00",
  afternoon_start_time: "07:00",
  afternoon_end_time: "11:00",
  afternoon_earliest_checkin_time: "07:00",
  afternoon_latest_checkin_time: "09:30"
};

const sessionAt0609Break = determineAttendanceSession(shiftBreakSettings, "06:09:18");

assert(
  "At 06:09:18 Ethiopian between shifts, activeSession is null (No active session)",
  sessionAt0609Break.activeSession === null,
  `Got: ${sessionAt0609Break.activeSession}`
);

assert(
  "At 06:09:18 Ethiopian between shifts, isBetweenShifts is true",
  sessionAt0609Break.isBetweenShifts === true
);

assert(
  "At 06:09:18 Ethiopian between shifts, sessionState is 'BETWEEN_SHIFTS'",
  sessionAt0609Break.sessionState === "BETWEEN_SHIFTS",
  `Got: ${sessionAt0609Break.sessionState}`
);

assert(
  "At 06:09:18 Ethiopian between shifts, canCheckIn is false",
  sessionAt0609Break.canCheckIn === false
);

assert(
  "At 06:09:18 Ethiopian between shifts, canCheckInMorning is false (morning shift ended)",
  sessionAt0609Break.canCheckInMorning === false
);

assert(
  "At 06:09:18 Ethiopian between shifts, canCheckInAfternoon is false (afternoon not open yet)",
  sessionAt0609Break.canCheckInAfternoon === false
);

assert(
  "At 06:09:18 Ethiopian between shifts, nextSession is 'Afternoon'",
  sessionAt0609Break.nextSession === "Afternoon"
);

assert(
  "At 06:09:18 Ethiopian between shifts, nextSessionOpensAt is '07:00'",
  sessionAt0609Break.nextSessionOpensAt === "07:00"
);

console.log("\n--- TEST GROUP 3: ACTIVE MORNING SESSION ---");
// At 02:15:00 Ethiopian time:
const sessionAt0215 = determineAttendanceSession(shiftBreakSettings, "02:15:00");

assert(
  "At 02:15:00 Ethiopian, activeSession is 'Morning'",
  sessionAt0215.activeSession === "Morning",
  `Got: ${sessionAt0215.activeSession}`
);

assert(
  "At 02:15:00 Ethiopian, sessionState is 'MORNING'",
  sessionAt0215.sessionState === "MORNING"
);

assert(
  "At 02:15:00 Ethiopian, canCheckIn is true",
  sessionAt0215.canCheckIn === true
);

assert(
  "At 02:15:00 Ethiopian, canCheckInMorning is true",
  sessionAt0215.canCheckInMorning === true
);

assert(
  "At 02:15:00 Ethiopian, canCheckInAfternoon is false (too early)",
  sessionAt0215.canCheckInAfternoon === false
);

assert(
  "At 02:15:00 Ethiopian, isBetweenShifts is false",
  sessionAt0215.isBetweenShifts === false
);

console.log("\n--- TEST GROUP 4: ACTIVE AFTERNOON SESSION ---");
// At 07:15:00 Ethiopian time:
const sessionAt0715 = determineAttendanceSession(shiftBreakSettings, "07:15:00");

assert(
  "At 07:15:00 Ethiopian, activeSession is 'Afternoon'",
  sessionAt0715.activeSession === "Afternoon",
  `Got: ${sessionAt0715.activeSession}`
);

assert(
  "At 07:15:00 Ethiopian, sessionState is 'AFTERNOON'",
  sessionAt0715.sessionState === "AFTERNOON"
);

assert(
  "At 07:15:00 Ethiopian, canCheckIn is true",
  sessionAt0715.canCheckIn === true
);

assert(
  "At 07:15:00 Ethiopian, canCheckInAfternoon is true",
  sessionAt0715.canCheckInAfternoon === true
);

assert(
  "At 07:15:00 Ethiopian, canCheckInMorning is false",
  sessionAt0715.canCheckInMorning === false
);

console.log("\n--- TEST GROUP 5: OUTSIDE ATTENDANCE HOURS ---");
// At 00:30 AM Ethiopian (= 06:30 AM Gregorian, before morning check-in opens at 01:00 Eth):
const sessionEarly = determineAttendanceSession(shiftBreakSettings, "00:30:00");
assert(
  "Early morning before earliest checkin (00:30 Eth), activeSession is null",
  sessionEarly.activeSession === null
);
assert(
  "Early morning before earliest checkin (00:30 Eth), sessionState is 'BEFORE_HOURS'",
  sessionEarly.sessionState === "BEFORE_HOURS"
);
assert(
  "Early morning before earliest checkin (00:30 Eth), isOutsideHours is true",
  sessionEarly.isOutsideHours === true
);

// At 01:00 PM Ethiopian (= 07:00 PM Gregorian, after afternoon envelope ends):
const sessionNight = determineAttendanceSession(shiftBreakSettings, "13:30:00");
assert(
  "Night time after shift ends (13:30 Eth), activeSession is null",
  sessionNight.activeSession === null
);
assert(
  "Night time after shift ends (13:30 Eth), sessionState is 'AFTER_HOURS'",
  sessionNight.sessionState === "AFTER_HOURS"
);

console.log("\n--- TEST GROUP 6: DEFAULT 24-HOUR SETTINGS COMPATIBILITY ---");
// Standard 24h settings:
const default24hSettings = {
  morning_start_time: "08:30",
  morning_end_time: "12:30",
  morning_earliest_checkin_time: "07:00",
  morning_latest_checkin_time: "10:30",
  afternoon_start_time: "13:30",
  afternoon_end_time: "17:30",
  afternoon_earliest_checkin_time: "13:00",
  afternoon_latest_checkin_time: "15:30"
};

// At 04:00 Ethiopian (= 10:00 AM Gregorian):
const morning24h = determineAttendanceSession(default24hSettings, "04:00:00");
assert(
  "With standard 24h settings at 10:00 AM (04:00 Eth), activeSession is 'Morning'",
  morning24h.activeSession === "Morning"
);

// At 06:45 Ethiopian (= 12:45 PM Gregorian, between 12:30 and 13:00):
const break24h = determineAttendanceSession(default24hSettings, "06:45:00");
assert(
  "With standard 24h settings at 12:45 PM (06:45 Eth), activeSession is null (Between Shifts)",
  break24h.activeSession === null && break24h.isBetweenShifts === true,
  `Got: activeSession=${break24h.activeSession}, isBetweenShifts=${break24h.isBetweenShifts}`
);

// At 07:30 Ethiopian (= 01:30 PM Gregorian):
const afternoon24h = determineAttendanceSession(default24hSettings, "07:30:00");
assert(
  "With standard 24h settings at 01:30 PM (07:30 Eth), activeSession is 'Afternoon'",
  afternoon24h.activeSession === "Afternoon"
);

console.log("\n--- TEST GROUP 7: INVALID CONFIGURATION HANDLING ---");
const invalidSettings = {
  morning_start_time: "12:00",
  morning_end_time: "08:00", // Start after end
  afternoon_start_time: "13:00",
  afternoon_end_time: "17:00"
};

const invalidResult = determineAttendanceSession(invalidSettings, "02:00:00");
assert(
  "Invalid configuration returns null activeSession and INVALID_CONFIG state",
  invalidResult.activeSession === null && invalidResult.sessionState === "INVALID_CONFIG"
);

console.log("\n===============================================================================");
console.log(`TEST SUMMARY: Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log("===============================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("🎉 ALL ATTENDANCE SESSION DETECTION & BUSINESS RULE TESTS PASSED!\n");
}
