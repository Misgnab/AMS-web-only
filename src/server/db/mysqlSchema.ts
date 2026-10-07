/**
 * MySQL schema definitions, table orders, and export SQL generators
 */

export const DATABASE_TABLE_ORDER = [
  "workspaces",
  "users",
  "site_settings",
  "attendance_qr_codes",
  "work_schedules",
  "holidays",
  "attendance_scores",
  "attendance",
  "attendance_corrections",
  "attendance_requests",
  "permissions",
  "overtime_records",
  "late_penalties",
  "salary_payments",
  "audit_logs"
] as const;

export const MYSQL_CREATE_TABLE_QUERIES: Record<string, string> = {
  workspaces: `
    CREATE TABLE IF NOT EXISTS workspaces (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      created_by INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(191) NOT NULL UNIQUE,
      role VARCHAR(50) NOT NULL,
      password VARCHAR(255) NOT NULL,
      photo LONGTEXT,
      hourly_rate DOUBLE DEFAULT 150.00,
      monthly_base_salary DOUBLE DEFAULT 0.0,
      transport_allowance DOUBLE DEFAULT 0.0,
      housing_allowance DOUBLE DEFAULT 0.0,
      position_allowance DOUBLE DEFAULT 0.0,
      tax_id VARCHAR(100) DEFAULT '',
      bank_name VARCHAR(100) DEFAULT '',
      bank_account_number VARCHAR(100) DEFAULT '',
      custom_deduction DOUBLE DEFAULT 0.0,
      registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      workspace_id INT,
      created_by INT DEFAULT NULL,
      registered_device_id VARCHAR(255),
      device_name VARCHAR(255),
      device_registered_at VARCHAR(100),
      device_status VARCHAR(50) DEFAULT 'APPROVED',
      salary_calculation_mode VARCHAR(50) DEFAULT 'GROSS',
      department VARCHAR(100) DEFAULT 'Operations',
      INDEX idx_users_phone (phone_number),
      INDEX idx_users_workspace (workspace_id),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  site_settings: `
    CREATE TABLE IF NOT EXISTS site_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      office_name VARCHAR(255) DEFAULT 'Main Office',
      latitude DOUBLE DEFAULT 9.0227,
      longitude DOUBLE DEFAULT 38.7460,
      office_wifi_ssid VARCHAR(191) DEFAULT 'Apex_HQ_WiFi',
      office_wifi_bssid VARCHAR(191) DEFAULT '00:11:22:33:44:55',
      wifi_ssid VARCHAR(191) DEFAULT 'Apex_HQ_WiFi',
      wifi_ip VARCHAR(100) DEFAULT '',
      use_wifi_verification INT DEFAULT 1,
      normal_overtime_multiplier DOUBLE DEFAULT 1.5,
      rest_day_overtime_multiplier DOUBLE DEFAULT 2.0,
      holiday_overtime_multiplier DOUBLE DEFAULT 2.5,
      night_overtime_multiplier DOUBLE DEFAULT 1.5,
      allowed_radius DOUBLE DEFAULT 35.0,
      late_grace_minutes INT DEFAULT 15,
      allowed_minor_lates INT DEFAULT 2,
      late_penalty_fixed_amount DOUBLE DEFAULT 25.0,
      late_penalty_hourly_multiplier DOUBLE DEFAULT 0.5,
      punctuality_bonus_amount DOUBLE DEFAULT 500.0,
      max_shift_duration_hours DOUBLE DEFAULT 14.0,
      default_salary_calculation VARCHAR(50) DEFAULT 'GROSS',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      workspace_id INT UNIQUE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  attendance_qr_codes: `
    CREATE TABLE IF NOT EXISTS attendance_qr_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT NOT NULL,
      qr_id VARCHAR(191) NOT NULL UNIQUE,
      status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by INT,
      revoked_at VARCHAR(100),
      INDEX idx_attendance_qr_ws_status (workspace_id, status),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  work_schedules: `
    CREATE TABLE IF NOT EXISTS work_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT NOT NULL,
      day_of_week INT NOT NULL,
      day_name VARCHAR(50) NOT NULL,
      morning_status VARCHAR(50) NOT NULL DEFAULT 'WORKING',
      afternoon_status VARCHAR(50) NOT NULL DEFAULT 'WORKING',
      morning_start VARCHAR(20) DEFAULT '02:00',
      morning_end VARCHAR(20) DEFAULT '06:00',
      afternoon_start VARCHAR(20) DEFAULT '07:00',
      afternoon_end VARCHAR(20) DEFAULT '11:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_ws_day (workspace_id, day_of_week),
      INDEX idx_work_schedules_ws_day (workspace_id, day_of_week),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  holidays: `
    CREATE TABLE IF NOT EXISTS holidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT NOT NULL,
      date VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'PUBLIC',
      duration VARCHAR(50) NOT NULL DEFAULT 'FULL_DAY',
      description TEXT,
      is_active INT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_ws_date_duration (workspace_id, date, duration),
      INDEX idx_holidays_ws_date (workspace_id, date),
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  attendance_scores: `
    CREATE TABLE IF NOT EXISTS attendance_scores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNIQUE NOT NULL,
      attendance_score DOUBLE DEFAULT 100.0,
      punctuality_percentage DOUBLE DEFAULT 100.0,
      late_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  attendance: `
    CREATE TABLE IF NOT EXISTS attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      date VARCHAR(50) NOT NULL,
      session VARCHAR(50) NOT NULL DEFAULT 'Morning',
      check_in_time VARCHAR(50),
      check_out_time VARCHAR(50),
      total_hours DOUBLE DEFAULT 0.0,
      status VARCHAR(50) DEFAULT 'Present',
      latitude DOUBLE,
      longitude DOUBLE,
      accuracy DOUBLE,
      distance DOUBLE,
      verification_method VARCHAR(50) DEFAULT 'WIFI',
      ssid VARCHAR(191),
      bssid VARCHAR(191),
      qr_token_id VARCHAR(191),
      device_id VARCHAR(191),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      workspace_id INT,
      admin_corrected_by INT,
      admin_correction_reason TEXT,
      admin_corrected_at VARCHAR(100),
      correction_status VARCHAR(50) DEFAULT 'NONE',
      attendance_type VARCHAR(50) DEFAULT 'REGULAR_WORK',
      work_status VARCHAR(50) DEFAULT 'WORKING',
      work_status_reason VARCHAR(100) DEFAULT 'NORMAL_WORKDAY',
      overtime_status VARCHAR(50) DEFAULT NULL,
      regular_hours DOUBLE DEFAULT 0.0,
      overtime_hours DOUBLE DEFAULT 0.0,
      regular_overtime_hours DOUBLE DEFAULT 0.0,
      rest_day_overtime_hours DOUBLE DEFAULT 0.0,
      holiday_overtime_hours DOUBLE DEFAULT 0.0,
      night_overtime_hours DOUBLE DEFAULT 0.0,
      late_minutes INT DEFAULT 0,
      penalty_amount DOUBLE DEFAULT 0.0,
      penalty_status VARCHAR(50) DEFAULT NULL,
      penalty_waived_reason TEXT,
      penalty_waived_by INT,
      penalty_waived_at VARCHAR(100),
      original_check_in VARCHAR(50),
      original_check_out VARCHAR(50),
      worked_minutes INT DEFAULT 0,
      provisional_checkout_time VARCHAR(50),
      correction_requested_by INT,
      correction_requested_at VARCHAR(100),
      correction_reason TEXT,
      rejection_reason TEXT,
      qr_verified INT DEFAULT 1,
      gps_verified INT DEFAULT 1,
      verification_timestamp VARCHAR(100),
      UNIQUE KEY uniq_user_date_session (user_id, date, session),
      INDEX idx_attendance_user_date (user_id, date),
      INDEX idx_attendance_workspace (workspace_id),
      INDEX idx_attendance_workspace_date (workspace_id, date),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  attendance_corrections: `
    CREATE TABLE IF NOT EXISTS attendance_corrections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attendance_id INT,
      employee_id INT NOT NULL,
      workspace_id INT,
      date VARCHAR(50) NOT NULL,
      session VARCHAR(50) DEFAULT 'Morning',
      original_check_in VARCHAR(50),
      original_check_out VARCHAR(50),
      requested_check_in VARCHAR(50) NOT NULL,
      requested_check_out VARCHAR(50) NOT NULL,
      approved_check_in VARCHAR(50),
      approved_check_out VARCHAR(50),
      reason TEXT NOT NULL,
      reason_code VARCHAR(100) DEFAULT 'FORGOTTEN_CHECKOUT',
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      requested_by INT NOT NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_by INT,
      reviewed_at VARCHAR(100),
      rejection_reason TEXT,
      previous_status VARCHAR(50),
      new_status VARCHAR(50),
      previous_worked_minutes INT DEFAULT 0,
      new_worked_minutes INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_att_corr_emp (employee_id),
      INDEX idx_att_corr_att (attendance_id),
      INDEX idx_att_corr_status (status),
      INDEX idx_att_corr_ws (workspace_id),
      FOREIGN KEY (employee_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  attendance_requests: `
    CREATE TABLE IF NOT EXISTS attendance_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type VARCHAR(100) NOT NULL,
      session VARCHAR(50) DEFAULT 'Full Day',
      request_scope VARCHAR(50) DEFAULT 'Full Shift',
      date VARCHAR(50) NOT NULL,
      check_in_time VARCHAR(50) NOT NULL,
      check_out_time VARCHAR(50) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      workspace_id INT,
      INDEX idx_attendance_requests_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  permissions: `
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      request_type VARCHAR(100) NOT NULL,
      session VARCHAR(50) DEFAULT 'Full Day',
      reason TEXT NOT NULL,
      start_date VARCHAR(50) NOT NULL,
      end_date VARCHAR(50) NOT NULL,
      approved_from_date VARCHAR(50),
      approved_to_date VARCHAR(50),
      status VARCHAR(50) NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      workspace_id INT,
      INDEX idx_permissions_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  overtime_records: `
    CREATE TABLE IF NOT EXISTS overtime_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attendance_id INT,
      employee_id INT NOT NULL,
      workspace_id INT,
      date VARCHAR(50) NOT NULL,
      check_in_time VARCHAR(50),
      check_out_time VARCHAR(50),
      overtime_type VARCHAR(50) NOT NULL DEFAULT 'REGULAR_OVERTIME',
      work_status VARCHAR(50) NOT NULL DEFAULT 'NON_WORKING',
      work_status_reason VARCHAR(100),
      hours DOUBLE NOT NULL DEFAULT 0.0,
      rate_multiplier DOUBLE DEFAULT 1.5,
      status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
      approved_by INT,
      approved_at VARCHAR(100),
      rejection_reason TEXT,
      notes TEXT,
      reason TEXT,
      qr_verified INT DEFAULT 1,
      gps_verified INT DEFAULT 1,
      gps_latitude DOUBLE,
      gps_longitude DOUBLE,
      gps_accuracy DOUBLE,
      gps_distance DOUBLE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_overtime_employee_date (employee_id, date),
      INDEX idx_overtime_ws_status (workspace_id, status),
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  late_penalties: `
    CREATE TABLE IF NOT EXISTS late_penalties (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attendance_id INT,
      user_id INT NOT NULL,
      workspace_id INT DEFAULT 1,
      date VARCHAR(50) NOT NULL,
      session VARCHAR(50) NOT NULL DEFAULT 'Morning',
      check_in_time VARCHAR(50),
      check_out_time VARCHAR(50),
      scheduled_start_time VARCHAR(50) DEFAULT '02:00:00',
      late_minutes INT NOT NULL DEFAULT 0,
      is_within_grace INT NOT NULL DEFAULT 0,
      penalty_amount DOUBLE NOT NULL DEFAULT 0.0,
      penalty_status VARCHAR(50) NOT NULL DEFAULT 'PENALIZED',
      penalty_waived_reason TEXT,
      penalty_waived_by INT,
      penalty_waived_at VARCHAR(100),
      notification_status VARCHAR(50) DEFAULT 'ACTIVE',
      penalty_type VARCHAR(100) DEFAULT 'LATE_ARRIVAL',
      reason TEXT,
      payroll_id INT,
      paid_at VARCHAR(100),
      processed_by INT,
      verification_method VARCHAR(50) DEFAULT 'QR_GPS',
      distance DOUBLE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_late_penalties_user (user_id),
      INDEX idx_late_penalties_date (date),
      INDEX idx_late_penalties_status (penalty_status),
      INDEX idx_late_penalties_notif (notification_status),
      INDEX idx_late_penalties_ws (workspace_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  salary_payments: `
    CREATE TABLE IF NOT EXISTS salary_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      workspace_id INT,
      calculation_method VARCHAR(50) DEFAULT 'GROSS',
      period_type VARCHAR(50) NOT NULL,
      period_start VARCHAR(50) NOT NULL,
      period_end VARCHAR(50) NOT NULL,
      base_hourly_rate DOUBLE NOT NULL,
      monthly_base_salary DOUBLE DEFAULT 0.0,
      expected_work_days INT DEFAULT 0,
      actual_present_days INT DEFAULT 0,
      regular_hours DOUBLE DEFAULT 0.0,
      regular_pay DOUBLE DEFAULT 0.0,
      approved_leave_days INT DEFAULT 0,
      approved_leave_hours DOUBLE DEFAULT 0.0,
      paid_leave_amount DOUBLE DEFAULT 0.0,
      overtime_hours DOUBLE DEFAULT 0.0,
      overtime_pay DOUBLE DEFAULT 0.0,
      penalty_amount DOUBLE DEFAULT 0.0,
      absent_days INT DEFAULT 0,
      absent_deduction DOUBLE DEFAULT 0.0,
      late_count INT DEFAULT 0,
      late_minutes INT DEFAULT 0,
      late_deduction DOUBLE DEFAULT 0.0,
      transport_allowance DOUBLE DEFAULT 0.0,
      housing_allowance DOUBLE DEFAULT 0.0,
      position_allowance DOUBLE DEFAULT 0.0,
      punctuality_bonus DOUBLE DEFAULT 0.0,
      gross_salary DOUBLE NOT NULL,
      pension_employee DOUBLE DEFAULT 0.0,
      pension_company DOUBLE DEFAULT 0.0,
      income_tax DOUBLE DEFAULT 0.0,
      custom_deductions DOUBLE DEFAULT 0.0,
      total_deductions DOUBLE NOT NULL,
      net_salary DOUBLE NOT NULL,
      final_payable_amount DOUBLE DEFAULT 0.0,
      payment_status VARCHAR(50) DEFAULT 'UNPAID',
      status VARCHAR(50) DEFAULT 'DRAFT',
      payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
      payment_reference VARCHAR(100),
      payment_date VARCHAR(100),
      disbursed_at VARCHAR(100),
      disbursed_by INT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_salary_user_period (user_id, period_start, period_end),
      INDEX idx_salary_status (payment_status),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,

  audit_logs: `
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      workspace_id INT,
      user_id INT,
      action VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_logs_ws (workspace_id, created_at),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `
};

/**
 * Generates pure MySQL DDL schema script ready to run in MySQL console or phpMyAdmin
 */
export function generateMysqlSchemaSql(databaseName = "buildtrack_ams"): string {
  const lines: string[] = [
    `-- =========================================================================`,
    `-- BuildTrack AMS Enterprise Database Schema for MySQL 8.0+ / MariaDB 10.5+`,
    `-- Generated on: ${new Date().toISOString()}`,
    `-- =========================================================================`,
    ``,
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `USE \`${databaseName}\`;`,
    ``,
    `SET FOREIGN_KEY_CHECKS = 0;`,
    ``
  ];

  for (const tableName of DATABASE_TABLE_ORDER) {
    lines.push(`-- Table: ${tableName}`);
    lines.push(MYSQL_CREATE_TABLE_QUERIES[tableName].trim());
    lines.push(``);
  }

  lines.push(`SET FOREIGN_KEY_CHECKS = 1;`);
  lines.push(``);
  lines.push(`-- Schema initialization complete.`);
  return lines.join("\n");
}
