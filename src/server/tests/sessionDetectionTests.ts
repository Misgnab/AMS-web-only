/**
 * Automated Verification Test Suite for Authoritative Attendance Session Detection
 * 
 * Verifies:
 * 1. Time inside Morning shift returns Morning.
 * 2. Time inside Afternoon shift returns Afternoon.
 * 3. Time during the midday break returns no active session (BETWEEN_SHIFTS).
 * 4. Time before the Morning shift returns no active session (BEFORE_SHIFTS).
 * 5. Time after the Afternoon shift returns no active session (AFTER_SHIFTS).
 * 6. 24-hr Gregorian stored settings and Ethiopian clock stored settings are handled seamlessly.
 * 7. Workspace schedule changes take effect immediately without server restart.
 * 8. Multi-workspace schedule isolation: Different workspaces have independent schedules without interference.
 * 9. Safe handling of invalid configurations (returns INVALID_CONFIG without crashing).
 */

import { detectActiveAttendanceSession, getWorkspaceShiftWindows } from "../../utils/sessionDetection";

interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

export function runAttendanceSessionTests(): {
  allPassed: boolean;
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function assert(name: string, condition: boolean, expected: any, actual: any, details?: string) {
    results.push({
      name,
      passed: condition,
      expected,
      actual,
      details
    });
  }

  // Workspace Settings A: Standard Ethiopian Corporate (02:00 - 06:00, 07:00 - 11:00)
  const corporateEthSettings = {
    workspace_id: 101,
    morning_start_time: "02:00",
    morning_end_time: "06:00",
    afternoon_start_time: "07:00",
    afternoon_end_time: "11:00"
  };

  // 1. Time inside Morning shift returns Morning
  const t1 = detectActiveAttendanceSession("03:30:00", corporateEthSettings);
  assert(
    "1. Time inside Morning shift (03:30) returns 'Morning'",
    t1.activeSession === "Morning" && t1.status === "MORNING",
    { activeSession: "Morning", status: "MORNING" },
    { activeSession: t1.activeSession, status: t1.status }
  );

  // 2. Exact morning shift start boundary returns Morning
  const t2 = detectActiveAttendanceSession("02:00:00", corporateEthSettings);
  assert(
    "2. Exact morning start (02:00) returns 'Morning'",
    t2.activeSession === "Morning" && t2.status === "MORNING",
    { activeSession: "Morning", status: "MORNING" },
    { activeSession: t2.activeSession, status: t2.status }
  );

  // 3. Time inside Afternoon shift returns Afternoon
  const t3 = detectActiveAttendanceSession("08:15:00", corporateEthSettings);
  assert(
    "3. Time inside Afternoon shift (08:15) returns 'Afternoon'",
    t3.activeSession === "Afternoon" && t3.status === "AFTERNOON",
    { activeSession: "Afternoon", status: "AFTERNOON" },
    { activeSession: t3.activeSession, status: t3.status }
  );

  // 4. Exact afternoon shift start boundary returns Afternoon
  const t4 = detectActiveAttendanceSession("07:00:00", corporateEthSettings);
  assert(
    "4. Exact afternoon start (07:00) returns 'Afternoon'",
    t4.activeSession === "Afternoon" && t4.status === "AFTERNOON",
    { activeSession: "Afternoon", status: "AFTERNOON" },
    { activeSession: t4.activeSession, status: t4.status }
  );

  // 5. THE EXACT REPORTED BUG: Time during midday break (06:09:18) returns NO active session (BETWEEN_SHIFTS)
  const t5 = detectActiveAttendanceSession("06:09:18", corporateEthSettings);
  assert(
    "5. [Root Cause Fix] Midday break (06:09:18) returns activeSession: null and status: 'BETWEEN_SHIFTS'",
    t5.activeSession === null && t5.status === "BETWEEN_SHIFTS",
    { activeSession: null, status: "BETWEEN_SHIFTS" },
    { activeSession: t5.activeSession, status: t5.status },
    t5.message
  );

  // 6. Exact morning end boundary (06:00:00) is in break
  const t6 = detectActiveAttendanceSession("06:00:00", corporateEthSettings);
  assert(
    "6. Exact morning shift end (06:00:00) transitions to 'BETWEEN_SHIFTS'",
    t6.activeSession === null && t6.status === "BETWEEN_SHIFTS",
    { activeSession: null, status: "BETWEEN_SHIFTS" },
    { activeSession: t6.activeSession, status: t6.status }
  );

  // 7. Time before Morning shift (01:15:00) returns BEFORE_SHIFTS
  const t7 = detectActiveAttendanceSession("01:15:00", corporateEthSettings);
  assert(
    "7. Time before Morning shift (01:15:00) returns activeSession: null and status: 'BEFORE_SHIFTS'",
    t7.activeSession === null && t7.status === "BEFORE_SHIFTS",
    { activeSession: null, status: "BEFORE_SHIFTS" },
    { activeSession: t7.activeSession, status: t7.status }
  );

  // 8. Time after Afternoon shift (11:30:00) returns AFTER_SHIFTS
  const t8 = detectActiveAttendanceSession("11:30:00", corporateEthSettings);
  assert(
    "8. Time after Afternoon shift (11:30:00) returns activeSession: null and status: 'AFTER_SHIFTS'",
    t8.activeSession === null && t8.status === "AFTER_SHIFTS",
    { activeSession: null, status: "AFTER_SHIFTS" },
    { activeSession: t8.activeSession, status: t8.status }
  );

  // 9. 24-Hour Gregorian stored format: 08:30-12:30 and 13:30-17:30 (02:30-06:30 and 07:30-11:30 Ethiopian)
  const gregSettings = {
    workspace_id: 102,
    morning_start_time: "08:30",
    morning_end_time: "12:30",
    afternoon_start_time: "13:30",
    afternoon_end_time: "17:30"
  };

  const windowsGreg = getWorkspaceShiftWindows(gregSettings);
  assert(
    "9. 24h Gregorian correctly converts to Ethiopian windows (02:30-06:30, 07:30-11:30)",
    windowsGreg.morningStartStr === "02:30" && 
    windowsGreg.morningEndStr === "06:30" &&
    windowsGreg.afternoonStartStr === "07:30" &&
    windowsGreg.afternoonEndStr === "11:30",
    { morning: "02:30 – 06:30", afternoon: "07:30 – 11:30" },
    { morning: `${windowsGreg.morningStartStr} – ${windowsGreg.morningEndStr}`, afternoon: `${windowsGreg.afternoonStartStr} – ${windowsGreg.afternoonEndStr}` }
  );

  // 10. Under 08:30-12:30 schedule, 06:09:18 is inside Morning session (ends at 06:30)
  const t10 = detectActiveAttendanceSession("06:09:18", gregSettings);
  assert(
    "10. Under 08:30-12:30 (02:30-06:30), 06:09:18 is Morning session",
    t10.activeSession === "Morning" && t10.status === "MORNING",
    { activeSession: "Morning", status: "MORNING" },
    { activeSession: t10.activeSession, status: t10.status }
  );

  // 11. Under 08:30-12:30 schedule, 06:45:00 is between shifts (break is 06:30 - 07:30)
  const t11 = detectActiveAttendanceSession("06:45:00", gregSettings);
  assert(
    "11. Under 08:30-12:30, 06:45:00 is between shifts",
    t11.activeSession === null && t11.status === "BETWEEN_SHIFTS",
    { activeSession: null, status: "BETWEEN_SHIFTS" },
    { activeSession: t11.activeSession, status: t11.status }
  );

  // 12. Dynamic schedule change takes effect immediately:
  // Dynamically change schedule from corporate (02:00-06:00) to flexible (02:30-06:30)
  const dynamicSettings = { ...corporateEthSettings };
  const beforeChange = detectActiveAttendanceSession("06:09:18", dynamicSettings);
  dynamicSettings.morning_end_time = "06:30";
  const afterChange = detectActiveAttendanceSession("06:09:18", dynamicSettings);
  assert(
    "12. Workspace schedule change takes effect immediately",
    beforeChange.activeSession === null && afterChange.activeSession === "Morning",
    { before: null, after: "Morning" },
    { before: beforeChange.activeSession, after: afterChange.activeSession }
  );

  // 13. Multi-Workspace Isolation: Two distinct workspaces checked simultaneously
  const workspaceA = { workspace_id: 1, morning_start_time: "02:00", morning_end_time: "06:00", afternoon_start_time: "07:00", afternoon_end_time: "11:00" };
  const workspaceB = { workspace_id: 2, morning_start_time: "02:30", morning_end_time: "06:30", afternoon_start_time: "07:30", afternoon_end_time: "11:30" };
  const resA = detectActiveAttendanceSession("06:09:18", workspaceA);
  const resB = detectActiveAttendanceSession("06:09:18", workspaceB);
  assert(
    "13. Multi-workspace isolation: Workspace A returns break while Workspace B returns Morning",
    resA.activeSession === null && resA.status === "BETWEEN_SHIFTS" && resB.activeSession === "Morning" && resB.status === "MORNING",
    { wsA: { session: null, status: "BETWEEN_SHIFTS" }, wsB: { session: "Morning", status: "MORNING" } },
    { wsA: { session: resA.activeSession, status: resA.status }, wsB: { session: resB.activeSession, status: resB.status } }
  );

  // 14. Invalid shift configuration handling
  const invalidSettings = {
    morning_start_time: "06:00",
    morning_end_time: "02:00", // Start after end
    afternoon_start_time: "07:00",
    afternoon_end_time: "11:00"
  };
  const t14 = detectActiveAttendanceSession("03:00:00", invalidSettings);
  assert(
    "14. Invalid configuration returns INVALID_CONFIG and null activeSession safely",
    t14.activeSession === null && t14.status === "INVALID_CONFIG",
    { activeSession: null, status: "INVALID_CONFIG" },
    { activeSession: t14.activeSession, status: t14.status }
  );

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  return {
    allPassed: passed === total,
    total,
    passed,
    failed: total - passed,
    results
  };
}

// Allow direct execution via CLI
if (typeof process !== "undefined" && process.argv[1]?.includes("sessionDetectionTests")) {
  const summary = runAttendanceSessionTests();
  console.log(`\n========================================`);
  console.log(`Attendance Session Detection Test Suite`);
  console.log(`========================================`);
  console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}\n`);
  
  for (const r of summary.results) {
    const icon = r.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${icon}: ${r.name}`);
    if (!r.passed) {
      console.log(`  Expected:`, r.expected);
      console.log(`  Actual:  `, r.actual);
      if (r.details) console.log(`  Details: `, r.details);
    }
  }

  console.log(`\nResult: ${summary.allPassed ? "ALL TESTS PASSED!" : "SOME TESTS FAILED"}\n`);
  if (!summary.allPassed) {
    process.exit(1);
  }
}
