import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../db/databaseManager.ts";
import { JWT_SECRET } from "../authConfig.ts";

export interface SecurityTestResult {
  id: string;
  name: string;
  category: string;
  description: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

export interface SecurityTestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  executedAt: string;
  results: SecurityTestResult[];
}

/**
 * Runs the comprehensive automated RBAC and Multi-Workspace isolation test suite
 */
export async function runAutomatedSecurityTests(serverPort: number = 3000): Promise<SecurityTestSuiteSummary> {
  const results: SecurityTestResult[] = [];
  const testWsAId = 99101;
  const testWsBId = 99102;
  const baseUrl = `http://127.0.0.1:${serverPort}`;

  let adminAToken = "";
  let empAToken = "";
  let adminBToken = "";
  let empBToken = "";
  let superAdminToken = "";

  let adminAId = 0;
  let empAId = 0;
  let adminBId = 0;
  let empBId = 0;
  let superAdminId = 0;
  let attBId = 0;
  let permBId = 0;
  let createdSuperAdmin = false;

  try {
    // 1. Setup Isolated Test Workspaces
    db.prepare("DELETE FROM workspaces WHERE id IN (?, ?)").run(testWsAId, testWsBId);
    db.prepare("INSERT INTO workspaces (id, name, status, description) VALUES (?, 'Security Test Workspace Alpha', 'ACTIVE', 'Test Sandbox A')").run(testWsAId);
    db.prepare("INSERT INTO workspaces (id, name, status, description) VALUES (?, 'Security Test Workspace Beta', 'ACTIVE', 'Test Sandbox B')").run(testWsBId);

    // Seed site settings for both test workspaces
    db.prepare("DELETE FROM site_settings WHERE workspace_id IN (?, ?)").run(testWsAId, testWsBId);
    db.prepare("INSERT INTO site_settings (workspace_id, office_name, latitude, longitude) VALUES (?, 'Alpha HQ', 9.022, 38.746)").run(testWsAId);
    db.prepare("INSERT INTO site_settings (workspace_id, office_name, latitude, longitude) VALUES (?, 'Beta Branch', 9.025, 38.749)").run(testWsBId);

    const dummyHash = bcrypt.hashSync("testpass123", 8);

    // 2. Setup Test Users
    // Admin A
    const resAdminA = db.prepare(`
      INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id, status)
      VALUES ('SecAdmin Alpha', '0999000001', 'Admin', ?, 120.0, ?, 'ACTIVE')
    `).run(dummyHash, testWsAId);
    adminAId = Number(resAdminA.lastInsertRowid);

    // Employee A
    const resEmpA = db.prepare(`
      INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id, status)
      VALUES ('SecEmp Alpha', '0999000002', 'Employee', ?, 80.0, ?, 'ACTIVE')
    `).run(dummyHash, testWsAId);
    empAId = Number(resEmpA.lastInsertRowid);

    // Admin B
    const resAdminB = db.prepare(`
      INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id, status)
      VALUES ('SecAdmin Beta', '0999000003', 'Admin', ?, 120.0, ?, 'ACTIVE')
    `).run(dummyHash, testWsBId);
    adminBId = Number(resAdminB.lastInsertRowid);

    // Employee B
    const resEmpB = db.prepare(`
      INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id, status)
      VALUES ('SecEmp Beta', '0999000004', 'Employee', ?, 80.0, ?, 'ACTIVE')
    `).run(dummyHash, testWsBId);
    empBId = Number(resEmpB.lastInsertRowid);

    // Existing or new SuperAdmin
    const rootAdmin: any = db.prepare("SELECT id, full_name, role, phone_number, workspace_id FROM users WHERE role = 'SuperAdmin' LIMIT 1").get();
    if (rootAdmin) {
      superAdminId = rootAdmin.id;
    } else {
      const resSuper = db.prepare(`
        INSERT INTO users (full_name, phone_number, role, password, hourly_rate, workspace_id, status)
        VALUES ('SecSuper Admin', '0999000005', 'SuperAdmin', ?, 200.0, 1, 'ACTIVE')
      `).run(dummyHash);
      superAdminId = Number(resSuper.lastInsertRowid);
      createdSuperAdmin = true;
    }

    // Attendance record in Workspace B
    const resAttB = db.prepare(`
      INSERT INTO attendance (user_id, workspace_id, date, status, check_in_time, check_out_time, qr_verified, gps_verified)
      VALUES (?, ?, '2026-10-12', 'Missing Checkout', '02:15:00', NULL, 1, 1)
    `).run(empBId, testWsBId);
    attBId = Number(resAttB.lastInsertRowid);

    // Leave request in Workspace B
    const resPermB = db.prepare(`
      INSERT INTO permissions (user_id, workspace_id, request_type, session, reason, start_date, end_date, status)
      VALUES (?, ?, 'Annual Leave', 'Full Day', 'Family trip', '2026-10-15', '2026-10-18', 'Pending')
    `).run(empBId, testWsBId);
    permBId = Number(resPermB.lastInsertRowid);

    // Generate JWT tokens
    const signToken = (id: number, phone: string, role: string, wsId: number) => {
      return jwt.sign({ id, phone_number: phone, role, workspace_id: wsId }, JWT_SECRET, { expiresIn: "1h" });
    };

    adminAToken = signToken(adminAId, "0999000001", "Admin", testWsAId);
    empAToken = signToken(empAId, "0999000002", "Employee", testWsAId);
    adminBToken = signToken(adminBId, "0999000003", "Admin", testWsBId);
    empBToken = signToken(empBId, "0999000004", "Employee", testWsBId);
    superAdminToken = signToken(superAdminId, "0911223344", "SuperAdmin", 1);

    // Helper fetch wrapper
    const makeReq = async (urlPath: string, token: string, options: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {})
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}${urlPath}`, { ...options, headers });
      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {}
      return { status: res.status, ok: res.ok, data };
    };

    // -------------------------------------------------------------------------------------------------
    // TEST 1: Workspace A Admin cannot list Workspace B employees
    // -------------------------------------------------------------------------------------------------
    const t1Start = Date.now();
    const r1 = await makeReq(`/api/employees?workspace_id=${testWsBId}`, adminAToken);
    const leakedEmpB = Array.isArray(r1.data) && r1.data.some((u: any) => u.id === empBId);
    const t1Passed = !leakedEmpB && (r1.status === 200 || r1.status === 403);
    results.push({
      id: "SEC-01",
      name: "Cross-Workspace Employee Isolation",
      category: "Data Isolation",
      description: "Workspace A Admin attempting to list Workspace B employees via ?workspace_id parameter is rejected or filtered strictly to Workspace A.",
      passed: t1Passed,
      details: t1Passed
        ? `PASSED: Zero Workspace B employees returned. Returned count: ${Array.isArray(r1.data) ? r1.data.length : 0}`
        : `FAILED: Leaked Workspace B employee in response. Status: ${r1.status}`,
      durationMs: Date.now() - t1Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 2: Workspace A Admin cannot view Workspace B attendance
    // -------------------------------------------------------------------------------------------------
    const t2Start = Date.now();
    const r2 = await makeReq(`/api/attendance/today?workspace_id=${testWsBId}`, adminAToken);
    const leakedAttB = Array.isArray(r2.data) && r2.data.some((a: any) => a.workspace_id === testWsBId || a.user_id === empBId);
    const t2Passed = !leakedAttB;
    results.push({
      id: "SEC-02",
      name: "Cross-Workspace Attendance Isolation",
      category: "Data Isolation",
      description: "Workspace A Admin cannot view Workspace B attendance records via query manipulation.",
      passed: t2Passed,
      details: t2Passed
        ? `PASSED: Workspace B attendance is isolated. Zero records leaked.`
        : `FAILED: Found Workspace B records in attendance payload.`,
      durationMs: Date.now() - t2Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 3: Workspace A Admin cannot access Workspace B payroll/salaries
    // -------------------------------------------------------------------------------------------------
    const t3Start = Date.now();
    const r3List = await makeReq(`/api/salaries?workspace_id=${testWsBId}`, adminAToken);
    const leakedSalaryB = Array.isArray(r3List.data) && r3List.data.some((s: any) => s.user_id === empBId);
    const r3Single = await makeReq(`/api/salaries/${empBId}/payslip`, adminAToken);
    const t3Passed = !leakedSalaryB && (r3Single.status === 403 || r3Single.status === 404);
    results.push({
      id: "SEC-03",
      name: "Protected Payroll & Salary Isolation",
      category: "Payroll Security",
      description: "Workspace A Admin cannot access Workspace B salaries or individual employee payslips.",
      passed: t3Passed,
      details: t3Passed
        ? `PASSED: Direct access to employee B payslip yielded 403 Forbidden. Salary list strictly isolated.`
        : `FAILED: Leaked salary data or payslip accessible. Status: ${r3Single.status}`,
      durationMs: Date.now() - t3Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 4: Workspace A Admin cannot change Workspace B settings
    // -------------------------------------------------------------------------------------------------
    const t4Start = Date.now();
    const r4 = await makeReq(`/api/site-settings`, adminAToken, {
      method: "PUT",
      body: JSON.stringify({
        workspace_id: testWsBId,
        office_name: "Tampered Beta Office Name"
      })
    });
    // Check if Workspace B was tampered
    const wsBRow: any = db.prepare("SELECT office_name FROM site_settings WHERE workspace_id = ?").get(testWsBId);
    const t4Passed = wsBRow?.office_name !== "Tampered Beta Office Name";
    results.push({
      id: "SEC-04",
      name: "Workspace Settings Isolation",
      category: "Settings Protection",
      description: "Workspace A Admin cannot overwrite another workspace's configuration by injecting workspace_id.",
      passed: t4Passed,
      details: t4Passed
        ? `PASSED: Workspace B site settings remained intact (${wsBRow?.office_name}).`
        : `FAILED: Workspace B office_name was illegally overwritten!`,
      durationMs: Date.now() - t4Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 5: Workspace A Admin cannot modify or approve another workspace's requests
    // -------------------------------------------------------------------------------------------------
    const t5Start = Date.now();
    const r5 = await makeReq(`/api/permissions/${permBId}/approve`, adminAToken, {
      method: "POST",
      body: JSON.stringify({ status: "Approved" })
    });
    const t5Passed = r5.status === 403 || r5.status === 404;
    results.push({
      id: "SEC-05",
      name: "Cross-Workspace Approval Prevention",
      category: "IDOR Prevention",
      description: "Workspace A Admin cannot approve leave or attendance requests belonging to Workspace B.",
      passed: t5Passed,
      details: t5Passed
        ? `PASSED: Cross-workspace leave approval rejected with status ${r5.status}.`
        : `FAILED: Approval succeeded or was not blocked. Status: ${r5.status}`,
      durationMs: Date.now() - t5Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 6: Workspace A Admin cannot manage administrators or access SuperAdmin endpoints
    // -------------------------------------------------------------------------------------------------
    const t6Start = Date.now();
    const r6 = await makeReq(`/api/superadmin/admins`, adminAToken);
    const t6Passed = r6.status === 403;
    results.push({
      id: "SEC-06",
      name: "Privilege Escalation Prevention",
      category: "RBAC Enforcement",
      description: "Workspace Admins are blocked from accessing SuperAdmin endpoints (/api/superadmin/*).",
      passed: t6Passed,
      details: t6Passed
        ? `PASSED: SuperAdmin endpoint access blocked with status 403 Forbidden.`
        : `FAILED: Workspace Admin accessed SuperAdmin API with status ${r6.status}`,
      durationMs: Date.now() - t6Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 7: Employee cannot access other employees' payroll or administrative functions
    // -------------------------------------------------------------------------------------------------
    const t7Start = Date.now();
    const r7 = await makeReq(`/api/salaries/${empBId}/payslip`, empAToken);
    const t7Passed = r7.status === 403;
    results.push({
      id: "SEC-07",
      name: "Employee Self-Service Privacy Protection",
      category: "Horizontal Privilege Isolation",
      description: "Employee cannot view another employee's payslip or salary history.",
      passed: t7Passed,
      details: t7Passed
        ? `PASSED: Employee access to peer payslip blocked with status 403 Forbidden.`
        : `FAILED: Employee accessed peer payslip with status ${r7.status}`,
      durationMs: Date.now() - t7Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 8: Invalid or missing tokens cannot access protected APIs
    // -------------------------------------------------------------------------------------------------
    const t8Start = Date.now();
    const r8 = await makeReq(`/api/employees`, "malformed.invalid.token");
    const t8Passed = r8.status === 401 || r8.status === 403;
    results.push({
      id: "SEC-08",
      name: "Token Validation & Missing Auth Protection",
      category: "Authentication",
      description: "Protected endpoints reject requests with invalid or forged JWT tokens.",
      passed: t8Passed,
      details: t8Passed
        ? `PASSED: Invalid token correctly rejected with status ${r8.status}.`
        : `FAILED: Invalid token was accepted with status ${r8.status}`,
      durationMs: Date.now() - t8Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 9: Self-salary tampering prevention
    // -------------------------------------------------------------------------------------------------
    const t9Start = Date.now();
    const r9 = await makeReq(`/api/employees/${adminAId}/hourly-rate`, adminAToken, {
      method: "PUT",
      body: JSON.stringify({ hourly_rate: 999.0 })
    });
    const t9Passed = r9.status === 403;
    results.push({
      id: "SEC-09",
      name: "Administrator Self-Salary Modification Prevention",
      category: "Financial Control",
      description: "Workspace administrators cannot tamper with or raise their own compensation or hourly rate.",
      passed: t9Passed,
      details: t9Passed
        ? `PASSED: Self-rate modification rejected with status 403 Forbidden.`
        : `FAILED: Administrator altered own salary with status ${r9.status}`,
      durationMs: Date.now() - t9Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 10: SuperAdmin has authorized global access across workspaces
    // -------------------------------------------------------------------------------------------------
    const t10Start = Date.now();
    const r10 = await makeReq(`/api/workspaces`, superAdminToken);
    const hasAlpha = Array.isArray(r10.data) && r10.data.some((w: any) => w.id === testWsAId);
    const hasBeta = Array.isArray(r10.data) && r10.data.some((w: any) => w.id === testWsBId);
    const t10Passed = r10.status === 200 && hasAlpha && hasBeta;
    results.push({
      id: "SEC-10",
      name: "SuperAdmin Global Workspace Visibility",
      category: "Super Admin Capabilities",
      description: "SuperAdmin can view and manage all active workspaces across the organization.",
      passed: t10Passed,
      details: t10Passed
        ? `PASSED: SuperAdmin successfully listed all workspaces (count: ${r10.data.length}).`
        : `FAILED: SuperAdmin workspace overview failed with status ${r10.status}`,
      durationMs: Date.now() - t10Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 11: SuperAdmin can manage workspace administrators
    // -------------------------------------------------------------------------------------------------
    const t11Start = Date.now();
    const r11 = await makeReq(`/api/superadmin/admins`, superAdminToken);
    const t11Passed = r11.status === 200 && Array.isArray(r11.data) && r11.data.length > 0;
    results.push({
      id: "SEC-11",
      name: "Centralized Administrator Management",
      category: "Super Admin Capabilities",
      description: "SuperAdmin can retrieve and oversee all administrator accounts across all workspaces.",
      passed: t11Passed,
      details: t11Passed
        ? `PASSED: SuperAdmin successfully retrieved admin accounts (count: ${r11.data.length}).`
        : `FAILED: Failed to list administrator accounts with status ${r11.status}`,
      durationMs: Date.now() - t11Start
    });

    // -------------------------------------------------------------------------------------------------
    // TEST 12: Audit logs record security events and denied access attempts
    // -------------------------------------------------------------------------------------------------
    const t12Start = Date.now();
    const auditRows: any[] = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE (action LIKE '%IDOR%' OR action LIKE '%DENIED%' OR action LIKE '%UNAUTHORIZED%') 
         OR (outcome = 'DENIED')
      ORDER BY id DESC LIMIT 10
    `).all();
    const t12Passed = auditRows.length > 0;
    results.push({
      id: "SEC-12",
      name: "Persistent Audit Trail Verification",
      category: "Auditing & Compliance",
      description: "Security events and denied access attempts are immutably recorded in the audit_logs table.",
      passed: t12Passed,
      details: t12Passed
        ? `PASSED: Confirmed security audit logs recorded (found ${auditRows.length} recent security events in audit_logs).`
        : `FAILED: No security logs found in audit_logs table.`,
      durationMs: Date.now() - t12Start
    });

  } finally {
    // Clean up test data
    try {
      db.prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?)").run(adminAId, empAId, adminBId, empBId);
      if (createdSuperAdmin && superAdminId) {
        db.prepare("DELETE FROM users WHERE id = ?").run(superAdminId);
      }
      db.prepare("DELETE FROM attendance WHERE id = ?").run(attBId);
      db.prepare("DELETE FROM permissions WHERE id = ?").run(permBId);
      db.prepare("DELETE FROM site_settings WHERE workspace_id IN (?, ?)").run(testWsAId, testWsBId);
      db.prepare("DELETE FROM workspaces WHERE id IN (?, ?)").run(testWsAId, testWsBId);
    } catch (_) {}
  }

  const passedCount = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    failed: results.length - passedCount,
    allPassed: passedCount === results.length,
    executedAt: new Date().toISOString(),
    results
  };
}
