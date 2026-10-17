/**
 * Comprehensive Automated Security & RBAC Test Suite
 * Validates strict workspace data isolation, RBAC role hierarchy,
 * payroll protection, audit logging, and Super Admin governance.
 */

import http from "http";

const BASE_URL = "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

async function apiRequest(path: string, options: {
  method?: string;
  token?: string | null;
  body?: any;
  headers?: Record<string, string>;
} = {}): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const bodyStr = options.body ? JSON.stringify(options.body) : undefined;

    const reqHeaders: Record<string, string> = {
      ...(options.headers || {})
    };

    if (bodyStr) {
      reqHeaders["Content-Type"] = "application/json";
      reqHeaders["Content-Length"] = Buffer.byteLength(bodyStr).toString();
    }

    if (options.token) {
      reqHeaders["Authorization"] = `Bearer ${options.token}`;
    }

    const req = http.request(url, {
      method: options.method || "GET",
      headers: reqHeaders
    }, (res) => {
      let rawData = "";
      res.on("data", (chunk) => { rawData += chunk; });
      res.on("end", () => {
        let parsed: any = rawData;
        try {
          parsed = JSON.parse(rawData);
        } catch (_) {}
        resolve({ status: res.statusCode || 500, data: parsed, headers: res.headers });
      });
    });

    req.on("error", (err) => reject(err));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function assert(name: string, condition: boolean, expected: string, actual: string, details?: string) {
  results.push({
    name,
    passed: condition,
    expected,
    actual,
    details
  });
  const symbol = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`${symbol} | ${name} (Expected: ${expected}, Got: ${actual})`);
  if (!condition && details) {
    console.error(`   Details: ${details}`);
  }
}

async function runAllSecurityTests() {
  console.log("===============================================================================");
  console.log("       STARTING AUTOMATED SECURITY & WORKSPACE DATA ISOLATION TEST SUITE       ");
  console.log("===============================================================================");

  // 1. Authenticate Super Admin (Auto-bootstraps via setup-admin if database is clean)
  console.log("\n[SETUP] Authenticating test accounts...");
  let superLogin = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { phone_number: "0911223344", password: "admin123" }
  });
  if (superLogin.status !== 200) {
    const setupCheck = await apiRequest("/api/auth/setup-check");
    if (setupCheck.data?.empty) {
      console.log("[SETUP] Clean database detected: Bootstrapping Super Admin test account...");
      await apiRequest("/api/auth/setup-admin", {
        method: "POST",
        body: {
          full_name: "System Administrator",
          phone_number: "0911223344",
          password: "admin123",
          company_name: "Apex Engineering",
          role: "SuperAdmin"
        }
      });
      superLogin = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { phone_number: "0911223344", password: "admin123" }
      });
    }
  }
  const superToken = superLogin.data?.token;
  assert("Super Admin Authentication", superLogin.status === 200 && !!superToken, "HTTP 200 with JWT token", `Status ${superLogin.status}`);

  // 2. Ensure Test Workspaces exist (Workspace 1: Main Office, Workspace 2: Branch Hawassa)
  const wsListRes = await apiRequest("/api/super-admin/workspaces", { token: superToken });
  let ws1 = wsListRes.data?.find((w: any) => w.id === 1);
  let ws2 = wsListRes.data?.find((w: any) => w.id === 2);

  if (!ws2) {
    const createWsRes = await apiRequest("/api/super-admin/workspaces", {
      method: "POST",
      token: superToken,
      body: { name: "Branch Hawassa Project", code: "HAW-1", description: "Test Branch Site", status: "ACTIVE" }
    });
    ws2 = createWsRes.data?.workspace;
  }
  assert("Dual Test Workspaces Available", !!ws1 && !!ws2, "Workspaces 1 & 2 exist", `WS1: ${ws1?.name || "none"}, WS2: ${ws2?.name || "none"}`);

  // 3. Ensure Workspace B Admin exists (Mulugeta Tadesse, phone: 0922334455, workspace: 2)
  let adminBLogin = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { phone_number: "0922334455", password: "adminpassword123" }
  });

  if (adminBLogin.status !== 200) {
    // Create Admin B via Super Admin
    await apiRequest("/api/super-admin/admins", {
      method: "POST",
      token: superToken,
      body: {
        full_name: "Mulugeta Tadesse",
        phone_number: "0922334455",
        role: "AdminCreator",
        workspace_id: 2,
        password: "adminpassword123",
        department: "Hawassa Operations"
      }
    });
    adminBLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { phone_number: "0922334455", password: "adminpassword123" }
    });
  }
  const adminBToken = adminBLogin.data?.token;
  assert("Workspace B Admin Authenticated", adminBLogin.status === 200 && !!adminBToken, "HTTP 200 with JWT", `Status ${adminBLogin.status}`);

  // 4. Ensure Workspace A Admin exists (Desta Alemu, phone: 0933445566, workspace: 1)
  let adminALogin = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { phone_number: "0933445566", password: "adminpassword123" }
  });

  if (adminALogin.status !== 200) {
    await apiRequest("/api/super-admin/admins", {
      method: "POST",
      token: superToken,
      body: {
        full_name: "Desta Alemu",
        phone_number: "0933445566",
        role: "AdminCreator",
        workspace_id: 1,
        password: "adminpassword123",
        department: "HQ Operations"
      }
    });
    adminALogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { phone_number: "0933445566", password: "adminpassword123" }
    });
  }
  const adminAToken = adminALogin.data?.token;
  assert("Workspace A Admin Authenticated", adminALogin.status === 200 && !!adminAToken, "HTTP 200 with JWT", `Status ${adminALogin.status}`);

  // 5. Ensure Employees exist in Workspace A and Workspace B
  // Emp A in Workspace 1
  let empALogin = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { phone_number: "0944556677", password: "emppassword123" }
  });
  if (empALogin.status !== 200) {
    await apiRequest("/api/employees/register", {
      method: "POST",
      token: adminAToken,
      body: {
        full_name: "Tigist Haile (Emp A)",
        phone_number: "0944556677",
        role: "Employee",
        password: "emppassword123",
        hourly_rate: 180,
        monthly_base_salary: 8000
      }
    });
    empALogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { phone_number: "0944556677", password: "emppassword123" }
    });
  }
  const empAToken = empALogin.data?.token;
  const empAUser = empALogin.data?.user;

  // Emp B in Workspace 2
  let empBLogin = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { phone_number: "0955667788", password: "emppassword123" }
  });
  if (empBLogin.status !== 200) {
    await apiRequest("/api/employees/register", {
      method: "POST",
      token: adminBToken,
      body: {
        full_name: "Yonas Bekele (Emp B)",
        phone_number: "0955667788",
        role: "Employee",
        password: "emppassword123",
        hourly_rate: 200,
        monthly_base_salary: 9500
      }
    });
    empBLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { phone_number: "0955667788", password: "emppassword123" }
    });
  }
  const empBToken = empBLogin.data?.token;
  const empBUser = empBLogin.data?.user;

  console.log("\n--- TEST GROUP 1: WORKSPACE DATA ISOLATION ---");

  // TEST 1: Workspace A Admin cannot list Workspace B employees
  const empListRes = await apiRequest("/api/employees", { token: adminAToken });
  const hasEmpBInWsA = Array.isArray(empListRes.data) && empListRes.data.some((e: any) => e.id === empBUser?.id || e.phone_number === "0955667788");
  assert(
    "Workspace A Admin cannot list Workspace B employees",
    !hasEmpBInWsA,
    "Emp B excluded from Workspace A list",
    hasEmpBInWsA ? "Emp B leaked into list" : "Emp B properly excluded"
  );

  // TEST 2: Workspace A Admin cannot view Workspace B attendance
  const attWsARes = await apiRequest("/api/attendance/history", { token: adminAToken });
  const hasEmpBAttendance = Array.isArray(attWsARes.data) && attWsARes.data.some((a: any) => a.user_id === empBUser?.id);
  assert(
    "Workspace A Admin cannot view Workspace B attendance",
    !hasEmpBAttendance,
    "Workspace B attendance isolated",
    hasEmpBAttendance ? "Leaked Workspace B attendance" : "Workspace B attendance completely hidden"
  );

  // TEST 3: Workspace A Admin cannot access Workspace B payroll or salaries
  const salariesWsARes = await apiRequest("/api/salaries", { token: adminAToken });
  const hasEmpBPayroll = Array.isArray(salariesWsARes.data) && salariesWsARes.data.some((s: any) => s.user_id === empBUser?.id);
  assert(
    "Workspace A Admin cannot access Workspace B payroll",
    !hasEmpBPayroll,
    "Workspace B payroll isolated",
    hasEmpBPayroll ? "Leaked Workspace B payroll" : "Workspace B payroll completely hidden"
  );

  // TEST 4: Workspace A Admin cannot change Workspace B settings (tampered payload)
  const tamperSettingsRes = await apiRequest("/api/site-settings", {
    method: "PUT",
    token: adminAToken,
    body: { workspace_id: 2, office_name: "Compromised Site Name" }
  });
  assert(
    "Workspace A Admin cannot change Workspace B settings",
    tamperSettingsRes.status === 403,
    "HTTP 403 Forbidden",
    `Status ${tamperSettingsRes.status} (${tamperSettingsRes.data?.error || "none"})`
  );

  // TEST 5: Workspace A Admin cannot modify Workspace B employee records
  if (empBUser?.id) {
    const tamperEmpRes = await apiRequest(`/api/employees/${empBUser.id}/hourly-rate`, {
      method: "PUT",
      token: adminAToken,
      body: { hourly_rate: 999 }
    });
    assert(
      "Workspace A Admin cannot modify Workspace B employee compensation",
      tamperEmpRes.status === 403,
      "HTTP 403 Forbidden",
      `Status ${tamperEmpRes.status} (${tamperEmpRes.data?.error || "none"})`
    );
  }

  // TEST 6: Workspace A Admin cannot export entire SQL dump
  const exportDumpRes = await apiRequest("/api/database/export-sql", { token: adminAToken });
  assert(
    "Workspace Admin cannot export entire database SQL dump",
    exportDumpRes.status === 403,
    "HTTP 403 Forbidden",
    `Status ${exportDumpRes.status} (${exportDumpRes.data?.error || "none"})`
  );

  // TEST 7: Workspace A Admin cannot access Super Admin endpoints
  const superAdminAccessRes = await apiRequest("/api/super-admin/overview", { token: adminAToken });
  assert(
    "Workspace Admin cannot access Super Admin Hub overview",
    superAdminAccessRes.status === 403,
    "HTTP 403 Forbidden",
    `Status ${superAdminAccessRes.status} (${superAdminAccessRes.data?.error || "none"})`
  );

  // TEST 8: Workspace A Admin cannot create new workspaces
  const tamperWsCreateRes = await apiRequest("/api/super-admin/workspaces", {
    method: "POST",
    token: adminAToken,
    body: { name: "Unauthorized Workspace" }
  });
  assert(
    "Workspace Admin cannot create unauthorized workspaces",
    tamperWsCreateRes.status === 403,
    "HTTP 403 Forbidden",
    `Status ${tamperWsCreateRes.status} (${tamperWsCreateRes.data?.error || "none"})`
  );

  console.log("\n--- TEST GROUP 2: EMPLOYEE LEVEL ISOLATION ---");

  // TEST 9: Employee A cannot access Employee B's payslip
  if (empBUser?.id) {
    const empPayslipRes = await apiRequest(`/api/salaries/${empBUser.id}/payslip`, { token: empAToken });
    assert(
      "Employee cannot access peer's private payslip",
      empPayslipRes.status === 403,
      "HTTP 403 Forbidden",
      `Status ${empPayslipRes.status} (${empPayslipRes.data?.error || "none"})`
    );
  }

  // TEST 10: Employee cannot access administrative endpoints
  const empAdminAccess = await apiRequest("/api/employees", { token: empAToken });
  assert(
    "Employee cannot access admin workforce registry",
    empAdminAccess.status === 403,
    "HTTP 403 Forbidden",
    `Status ${empAdminAccess.status} (${empAdminAccess.data?.error || "none"})`
  );

  // TEST 11: Employee CAN access their own salary endpoint
  const mySalaryRes = await apiRequest("/api/employee/my-salary", { token: empAToken });
  assert(
    "Employee can legitimately access own salary information",
    mySalaryRes.status === 200 && mySalaryRes.data?.user_id === empAUser?.id,
    "HTTP 200 with own salary record",
    `Status ${mySalaryRes.status}, User ID: ${mySalaryRes.data?.user_id}`
  );

  console.log("\n--- TEST GROUP 3: AUTHENTICATION & SECURITY CONTROLS ---");

  // TEST 12: Invalid or expired token cannot access protected APIs
  const invalidTokenRes = await apiRequest("/api/employees", { token: "invalid.fake.token.12345" });
  assert(
    "Invalid JWT token rejected",
    invalidTokenRes.status === 401,
    "HTTP 401 Unauthorized",
    `Status ${invalidTokenRes.status} (${invalidTokenRes.data?.error || "none"})`
  );

  // TEST 13: Missing token rejected
  const missingTokenRes = await apiRequest("/api/employees", {});
  assert(
    "Missing authentication token rejected",
    missingTokenRes.status === 401,
    "HTTP 401 Unauthorized",
    `Status ${missingTokenRes.status} (${missingTokenRes.data?.error || "none"})`
  );

  // TEST 14: Minimal public health check does not expose sensitive database metadata
  const publicHealthRes = await apiRequest("/api/health", {});
  const publicHealthExposesStats = publicHealthRes.data?.stats !== undefined || publicHealthRes.data?.mysql?.details !== undefined;
  assert(
    "Public health endpoint does not leak internal stats or database details",
    !publicHealthExposesStats && publicHealthRes.data?.status === "ok",
    "Minimal status payload without stats",
    publicHealthExposesStats ? "Exposed internal stats" : "Minimal sanitized response"
  );

  // TEST 15: Administrator cannot alter their own compensation package (self-salary modification blocked)
  if (adminALogin.data?.user?.id) {
    const selfCompRes = await apiRequest(`/api/employees/${adminALogin.data.user.id}/compensation`, {
      method: "PUT",
      token: adminAToken,
      body: { hourly_rate: 9999, monthly_base_salary: 999999 }
    });
    assert(
      "Administrator cannot modify own compensation package (self-salary protected)",
      selfCompRes.status === 403,
      "HTTP 403 Forbidden",
      `Status ${selfCompRes.status} (${selfCompRes.data?.error || "none"})`
    );
  }

  // TEST 16: Administrator cannot self-disburse or self-approve their own salary
  if (adminALogin.data?.user?.id) {
    const selfDisbRes = await apiRequest("/api/salaries/disburse", {
      method: "POST",
      token: adminAToken,
      body: { user_id: adminALogin.data.user.id, filter: "Monthly" }
    });
    assert(
      "Administrator cannot self-disburse own salary payment",
      selfDisbRes.status === 403,
      "HTTP 403 Forbidden",
      `Status ${selfDisbRes.status} (${selfDisbRes.data?.error || "none"})`
    );
  }

  console.log("\n--- TEST GROUP 4: SUPER ADMIN MANAGEMENT & AUDIT ---");

  // TEST 17: Super Admin can list all workspaces
  const allWsRes = await apiRequest("/api/super-admin/workspaces", { token: superToken });
  assert(
    "Super Admin can view all global workspaces",
    allWsRes.status === 200 && Array.isArray(allWsRes.data) && allWsRes.data.length >= 2,
    "Array with >= 2 workspaces",
    `Status ${allWsRes.status}, Count: ${allWsRes.data?.length}`
  );

  // TEST 18: Super Admin can list all workspace administrators
  const allAdminsRes = await apiRequest("/api/super-admin/admins", { token: superToken });
  assert(
    "Super Admin can view all administrators across workspaces",
    allAdminsRes.status === 200 && Array.isArray(allAdminsRes.data) && allAdminsRes.data.length >= 3,
    "Array with all administrators",
    `Status ${allAdminsRes.status}, Count: ${allAdminsRes.data?.length}`
  );

  // TEST 19: Super Admin can suspend administrator and suspension blocks login
  if (adminBLogin.data?.user?.id) {
    // Suspend Admin B
    const suspendRes = await apiRequest(`/api/super-admin/admins/${adminBLogin.data.user.id}/status`, {
      method: "PUT",
      token: superToken,
      body: { status: "SUSPENDED" }
    });
    assert(
      "Super Admin can suspend administrator access",
      suspendRes.status === 200 && suspendRes.data?.status === "SUSPENDED",
      "Status set to SUSPENDED",
      `Status ${suspendRes.status}`
    );

    // Verify suspended login fails
    const blockedLogin = await apiRequest("/api/auth/login", {
      method: "POST",
      body: { phone_number: "0922334455", password: "adminpassword123" }
    });
    assert(
      "Suspended administrator login is blocked",
      blockedLogin.status === 403 && blockedLogin.data?.code === "ACCOUNT_SUSPENDED",
      "HTTP 403 ACCOUNT_SUSPENDED",
      `Status ${blockedLogin.status} (${blockedLogin.data?.code || "none"})`
    );

    // Reactivate Admin B
    const reactivateRes = await apiRequest(`/api/super-admin/admins/${adminBLogin.data.user.id}/status`, {
      method: "PUT",
      token: superToken,
      body: { status: "ACTIVE" }
    });
    assert(
      "Super Admin can reactivate administrator access",
      reactivateRes.status === 200 && reactivateRes.data?.status === "ACTIVE",
      "Status set to ACTIVE",
      `Status ${reactivateRes.status}`
    );
  }

  // TEST 20: Audit trail records security events
  const auditLogsRes = await apiRequest("/api/super-admin/audit-logs?limit=20", { token: superToken });
  const hasAuditRecords = Array.isArray(auditLogsRes.data) && auditLogsRes.data.length > 0;
  const hasSecurityAction = Array.isArray(auditLogsRes.data) && auditLogsRes.data.some((l: any) =>
    l.action.includes("LOGIN") || l.action.includes("UNAUTHORIZED") || l.action.includes("ADMIN")
  );
  assert(
    "Audit trail persistently records operations and security events",
    hasAuditRecords && hasSecurityAction,
    "Audit trail populated with logged actions",
    hasAuditRecords ? `Found ${auditLogsRes.data.length} audit records` : "No audit records found"
  );

  console.log("\n===============================================================================");
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TEST SUMMARY: Total: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log("===============================================================================");

  if (failedCount > 0) {
    console.error(`\n❌ ${failedCount} SECURITY TEST(S) FAILED! Review details above.`);
    process.exit(1);
  } else {
    console.log(`\n🎉 ALL ${passedCount} AUTOMATED SECURITY & RBAC TESTS PASSED SUCCESSFULLY!`);
    process.exit(0);
  }
}

runAllSecurityTests().catch((err) => {
  console.error("Fatal error running security tests:", err);
  process.exit(1);
});
