export interface User {
  id: number;
  full_name: string;
  phone_number: string;
  role: "Bootstrap" | "AdminCreator" | "AdminManager" | "SuperAdmin" | "Employee" | "Purchaser" | "Accountant" | "Engineer" | "HR";
  photo?: string;
  hourly_rate: number;
  monthly_base_salary?: number;
  transport_allowance?: number;
  housing_allowance?: number;
  position_allowance?: number;
  tax_id?: string;
  bank_name?: string;
  bank_account_number?: string;
  custom_deduction?: number;
  registration_date?: string;
  workspace_id?: number | null;
  workspace_name?: string;
  registered_device_id?: string | null;
  device_name?: string | null;
  device_registered_at?: string | null;
  device_status?: string | null;
  salary_calculation_mode?: "GROSS" | "NET";
  department?: string;
}

export interface SiteSettings {
  id?: number;
  workspace_id?: number;
  office_name: string;
  latitude: number;
  longitude: number;
  office_wifi_ssid?: string;
  office_wifi_bssid?: string;
  wifi_ssid?: string;
  wifi_bssid?: string;
  wifi_ip?: string;
  allowed_radius?: number;
  extended_radius?: number;
  qr_secret?: string;
  use_wifi_verification: number | boolean;
  normal_overtime_multiplier?: number;
  rest_day_overtime_multiplier?: number;
  holiday_overtime_multiplier?: number;
  night_overtime_multiplier?: number;
  late_grace_minutes?: number;
  allowed_minor_lates?: number;
  late_penalty_fixed_amount?: number;
  late_penalty_hourly_multiplier?: number;
  punctuality_bonus_amount?: number;
  max_shift_duration_hours?: number;
  default_salary_calculation?: "GROSS" | "NET";
  updated_at?: string;
}

export type VerificationMethod = "WIFI" | "QR_GPS" | "MANUAL_REQUEST";

export type AttendanceStatus = "Present" | "Late" | "Absent" | "Missing Checkout" | "Permission" | "Authorized" | "Partial" | "Missing Checkin" | "MISSING_CHECKOUT" | "MISSING_CHECKIN";

export type AttendanceType = "REGULAR_WORK" | "REGULAR_OVERTIME" | "REST_DAY_OVERTIME" | "HOLIDAY_OVERTIME" | "NIGHT_OVERTIME";
export type WorkStatusType = "WORKING" | "NON_WORKING";
export type WorkStatusReason = "NORMAL_WORKDAY" | "WEEKLY_OFF" | "PUBLIC_HOLIDAY" | "COMPANY_HOLIDAY" | "SPECIAL_HOLIDAY" | "SCHEDULED_OVERTIME";
export type OvertimeApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AttendanceRecord {
  id: number;
  user_id: number;
  workspace_id?: number;
  date: string;
  session?: "Morning" | "Afternoon";
  check_in_time?: string;
  check_out_time?: string;
  total_hours: number;
  worked_minutes?: number;
  provisional_checkout_time?: string;
  original_check_in?: string;
  original_check_out?: string;
  status: AttendanceStatus;
  full_name?: string;
  phone_number?: string;
  role?: string;
  // Work Calendar & Overtime classification
  attendance_type?: AttendanceType;
  work_status?: WorkStatusType;
  work_status_reason?: string;
  overtime_status?: OvertimeApprovalStatus | null;
  regular_hours?: number;
  overtime_hours?: number;
  rest_day_overtime_hours?: number;
  holiday_overtime_hours?: number;
  regular_overtime_hours?: number;
  night_overtime_hours?: number;
  qr_verified?: number;
  gps_verified?: number;
  verification_timestamp?: string;
  // Security attributes
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  verification_method?: VerificationMethod;
  ssid?: string | null;
  bssid?: string | null;
  qr_token_id?: string | null;
  device_id?: string | null;
  // Admin correction & missing checkout tracking
  correction_status?: "NONE" | "PENDING_CORRECTION" | "PENDING" | "CORRECTED" | "APPROVED" | "REJECTED";
  admin_corrected_by?: number | null;
  admin_corrector_name?: string | null;
  admin_correction_reason?: string | null;
  admin_corrected_at?: string | null;
  correction_requested_by?: number | null;
  correction_requested_at?: string | null;
  correction_reason?: string | null;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceCorrection {
  id: number;
  attendance_id?: number | null;
  employee_id: number;
  user_id?: number;
  workspace_id?: number | null;
  date: string;
  session: "Morning" | "Afternoon";
  original_check_in?: string | null;
  original_check_out?: string | null;
  requested_check_in: string;
  requested_check_out: string;
  approved_check_in?: string | null;
  approved_check_out?: string | null;
  reason: string;
  reason_code?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_by: number;
  requested_at: string;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  previous_status?: string | null;
  new_status?: string | null;
  previous_worked_minutes?: number;
  new_worked_minutes?: number;
  full_name?: string;
  phone_number?: string;
  role?: string;
  reviewer_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AuditLogRecord {
  id: number;
  workspace_id?: number;
  user_id?: number;
  action: string;
  details?: string;
  ip_address?: string;
  actor_name?: string;
  actor_role?: string;
  created_at: string;
}

export interface MissingCheckoutCorrectionPayload {
  check_out_time: string;
  status?: AttendanceStatus;
  reason: string;
  total_hours?: number;
  check_in_time?: string;
}

export interface AttendanceCorrectionRequestPayload {
  attendance_id?: number;
  date?: string;
  session?: "Morning" | "Afternoon";
  requested_check_in?: string;
  requested_check_out: string;
  reason: string;
  reason_code?: string;
}

export interface PayrollPreFlightResult {
  canProcessPayroll: boolean;
  blockingIssuesCount: number;
  issues: string[];
  missingCheckoutsCount: number;
  missingCheckouts: AttendanceRecord[];
  pendingCorrectionsCount: number;
  pendingCorrections: AttendanceCorrection[];
  totalEmployeesEvaluated: number;
}

export interface AttendanceStatusResponse {
  hasOpenToday: boolean;
  openTodayRecord: AttendanceRecord | null;
  hasMissingCheckout: boolean;
  missingRecords: AttendanceRecord[];
  canCheckIn: boolean;
  canCheckOut: boolean;
  todayDate: string;
  currentTime: string;
  serverEpochMs?: number;
  serverTime?: string;
}

export interface AttendanceRequest {
  id: number;
  user_id: number;
  type: "Site Visit" | "External Work" | "Purchaser Visit";
  session?: "Full Day" | "Morning" | "Afternoon";
  request_scope?: "Full Shift" | "Site Check-Out";
  date: string;
  check_in_time: string;
  check_out_time: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  full_name?: string;
  phone_number?: string;
  created_at?: string;
}

export interface PermissionRequest {
  id: number;
  user_id: number;
  request_type: "Permission" | "Sick Leave" | "Annual Leave";
  session?: "Full Day" | "Morning" | "Afternoon";
  reason: string;
  start_date: string;
  end_date: string;
  approved_from_date?: string;
  approved_to_date?: string;
  status: "Pending" | "Approved" | "Rejected";
  full_name?: string;
  phone_number?: string;
  created_at?: string;
}

export interface OvertimeBreakdownItem {
  id?: number;
  date: string;
  session?: string;
  type: string;
  rawType: string;
  hours: number;
  multiplier: number;
  hourlyRate: number;
  amount: number;
  notes?: string;
  workStatus?: string;
}

export interface SalaryPayment {
  user_id: number;
  full_name: string;
  phone_number: string;
  role?: string;
  workspace_name?: string;
  hourly_rate: number;
  monthly_base_salary: number;
  effective_hourly_rate: number;
  
  // Working Hours & Days
  expected_work_days: number;
  actual_present_days: number;
  regular_hours: number;
  regular_pay: number;
  
  // Approved Leaves & Permissions (Paid)
  approved_leave_days: number;
  approved_leave_hours: number;
  paid_leave_amount: number;
  leave_types_breakdown?: Record<string, number>;
  
  // Comprehensive Overtime Breakdown
  overtime_hours: number;
  overtime_pay: number;
  regular_overtime_hours?: number;
  rest_day_overtime_hours?: number;
  holiday_overtime_hours?: number;
  night_overtime_hours?: number;
  normal_overtime_multiplier?: number;
  rest_day_overtime_multiplier?: number;
  holiday_overtime_multiplier?: number;
  night_overtime_multiplier?: number;
  normal_overtime_pay?: number;
  rest_day_overtime_pay?: number;
  holiday_overtime_pay?: number;
  night_overtime_pay?: number;
  overtime_records_count?: number;
  overtime_breakdown?: OvertimeBreakdownItem[];
  
  // Absences & Lateness
  absent_days: number;
  absent_deduction: number;
  late_count: number;
  late_minutes: number;
  late_deduction: number;
  
  // Allowances & Bonuses
  transport_allowance: number;
  housing_allowance: number;
  position_allowance: number;
  punctuality_bonus: number;
  gross_salary: number;
  
  // Deductions
  pension_employee: number; // 7%
  pension_company: number;  // 11%
  income_tax: number;
  custom_deduction: number;
  total_deductions: number;
  
  // Net
  net_salary: number;
  calculated_salary: number; // Backwards compatible alias
  total_hours: number;       // Backwards compatible alias
  calculation_method?: "GROSS" | "NET";
  basic_salary?: number;
  penalty_amount?: number;
  final_payable_amount?: number;
  payment_status?: "UNPAID" | "PAID";
  late_penalty_deduction?: number;
  absent_penalty_deduction?: number;
  pension_employee_7pct?: number;
  tax_amount?: number;
  department?: string;
  payment_date?: string;
  processed_by?: number;
  processed_by_name?: string;
  notes?: string;
  
  // Period & Banking Info
  period_type: string;
  period_start: string;
  period_end: string;
  period_label?: string;
  bank_name?: string;
  bank_account_number?: string;
  tax_id?: string;
  disbursement_status?: "UNPAID" | "PAID";
  payment_reference?: string;
  overtime_rate?: number;
  penalties_breakdown?: Array<{
    id?: number;
    type: string;
    reason?: string;
    date: string;
    amount: number;
    status: string;
    applied_to_payroll?: boolean;
  }>;
  dayLogs?: any[];
}

export interface EnterprisePayslipDayLog {
  date: string;
  dayOfWeek: string;
  session: "Morning" | "Afternoon" | "Full Day";
  status: "Present" | "Late" | "Permission" | "Approved Leave" | "Site Visit" | "Absent";
  checkInTime?: string;
  checkOutTime?: string;
  regularHours: number;
  overtimeHours: number;
  paidLeaveHours: number;
  lateMinutes: number;
  leaveType?: string;
}

export interface EnterprisePayslip {
  id: string;
  referenceNumber: string;
  generatedDate: string;
  companyName: string;
  workspaceName: string;
  period: {
    type: string;
    startDate: string;
    endDate: string;
    ethiopianLabel: string;
  };
  employee: {
    id: number;
    fullName: string;
    phoneNumber: string;
    role: string;
    taxId: string;
    bankName: string;
    bankAccountNumber: string;
  };
  summary: {
    expectedWorkDays: number;
    actualPresentDays: number;
    approvedLeaveDays: number;
    absentDays: number;
    lateCount: number;
    lateMinutes: number;
    totalRegularHours: number;
    totalPaidLeaveHours: number;
    totalOvertimeHours: number;
    regularOvertimeHours?: number;
    restDayOvertimeHours?: number;
    holidayOvertimeHours?: number;
    nightOvertimeHours?: number;
    normalOvertimeMultiplier?: number;
    restDayOvertimeMultiplier?: number;
    holidayOvertimeMultiplier?: number;
    nightOvertimeMultiplier?: number;
    totalPaidHours: number;
  };
  earnings: {
    basicRegularWage: number;
    paidLeaveAmount: number;
    normalOtWage?: number;
    restDayOtWage?: number;
    holidayOtWage?: number;
    nightOtWage?: number;
    overtimeWage: number;
    overtimeBreakdown?: OvertimeBreakdownItem[];
    transportAllowance: number;
    housingAllowance: number;
    positionAllowance: number;
    punctualityBonus: number;
    grossEarnings: number;
  };
  deductions: {
    latePenalty: number;
    absenceDeduction: number;
    employeePension: number; // 7%
    incomeTaxWithheld: number;
    customLoanAdvance: number;
    totalDeductions: number;
  };
  employerContributions: {
    employerPension: number; // 11%
  };
  netPay: {
    amount: number;
    currency: string;
    inWords: string;
  };
  paymentStatus: "DRAFT" | "APPROVED" | "PAID";
  paymentReference?: string;
  paymentDate?: string;
  calculationMethod?: "GROSS" | "NET";
  taxApplicable?: boolean;
  pensionApplicable?: boolean;
  basicSalary?: number;
  penaltiesBreakdown?: Array<{
    id?: number;
    type: string;
    reason?: string;
    date: string;
    amount: number;
    status: string;
    applied_to_payroll?: boolean;
  }>;
  dayLogs?: EnterprisePayslipDayLog[];
}

export interface CompensationUpdatePayload {
  hourly_rate?: number;
  monthly_base_salary?: number;
  transport_allowance?: number;
  housing_allowance?: number;
  position_allowance?: number;
  tax_id?: string;
  bank_name?: string;
  bank_account_number?: string;
  custom_deduction?: number;
  salary_calculation_mode?: "GROSS" | "NET";
  department?: string;
}

export interface AttendanceScoreRecord {
  id: number;
  full_name: string;
  phone_number: string;
  attendance_score: number;
  punctuality_percentage: number;
  late_count: number;
  total_attendances?: number;
}

export interface OfficeQRCodeData {
  id?: number;
  qr_id: string;
  code: string;
  token_id?: string;
  status: "ACTIVE" | "REVOKED";
  workspace_id: number;
  created_at?: string;
  created_by?: number | null;
  revoked_at?: string | null;
}

export type QRCodeData = OfficeQRCodeData;

export interface DashboardData {
  summary: {
    totalEmployees: number;
    presentToday: number;
    lateToday: number;
    absentToday: number;
    workingOvertimeToday?: number;
    isNonWorkingDay?: boolean;
    isHoliday?: boolean;
    holidayName?: string | null;
    dayReason?: string;
    dayName?: string;
    totalWorkingHours: number;
    avgWorkingHours: number;
  };
  trends: Array<{
    date: string;
    present_count: number;
    working_hours: number;
  }>;
  performance: Array<{
    full_name: string;
    avg_hours: number;
    late_count: number;
  }>;
}

export interface WifiInfo {
  ssid: string;
  bssid: string;
  isMatched: boolean;
  ip?: string;
}

export interface GpsLocationInfo {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceToOffice: number;
  allowedRadius: number;
  status: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  isWithinRadius: boolean;
}

export interface VerificationCheckPayload {
  action: "check-in" | "check-out";
  qr_code?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  wifi_ssid?: string;
  wifi_bssid?: string;
  wifi_ip?: string;
  device_id?: string;
}

export interface OfflineAttendanceRecord {
  id: string;
  type: "check-in" | "check-out";
  payload: VerificationCheckPayload;
  timestamp: string;
  synced: boolean;
  error?: string;
}

export interface TestCaseResult {
  id: string;
  name: string;
  expectedResult: "Approve" | "Reject";
  actualResult: "Approve" | "Reject" | "Error";
  passed: boolean;
  details: string;
  verificationMethod?: string;
  category?: string;
}

export interface WorkScheduleDay {
  id?: number;
  workspace_id?: number;
  day_of_week: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  day_name: string;
  morning_status: WorkStatusType;
  afternoon_status: WorkStatusType;
  morning_start?: string; // e.g. "08:30"
  morning_end?: string; // e.g. "12:30"
  afternoon_start?: string; // e.g. "13:30"
  afternoon_end?: string; // e.g. "17:30"
  morning_start_ethiopian?: string; // e.g. "2:30 ጧት"
  morning_end_ethiopian?: string; // e.g. "6:30 ከሰዓት"
  afternoon_start_ethiopian?: string; // e.g. "7:30 ከሰዓት"
  afternoon_end_ethiopian?: string; // e.g. "11:30 ከሰዓት"
  updated_at?: string;
}

export interface Holiday {
  id: number;
  workspace_id?: number;
  date: string; // YYYY-MM-DD
  name: string;
  type: "PUBLIC" | "COMPANY" | "SPECIAL";
  duration: "FULL_DAY" | "MORNING" | "AFTERNOON";
  description?: string;
  is_active: number | boolean;
  ethiopian_date?: string; // e.g. "2019-01-01"
  ethiopian_date_am?: string; // e.g. "መስከረም 1, 2019 ዓ.ም."
  ethiopian_date_en?: string; // e.g. "Meskerem 1, 2019 E.C."
  ethiopian_hours?: string; // e.g. "2:30 ጧት – 11:30 ከሰዓት"
  created_at?: string;
  updated_at?: string;
}

export interface OvertimeRecord {
  id: number;
  attendance_id?: number;
  employee_id: number;
  employee_name?: string;
  employee_role?: string;
  phone_number?: string;
  workspace_id?: number;
  date: string;
  check_in_time?: string;
  check_out_time?: string;
  overtime_type: AttendanceType;
  work_status: WorkStatusType;
  work_status_reason?: string;
  hours: number;
  rate_multiplier: number;
  status: OvertimeApprovalStatus;
  approved_by?: number;
  approver_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  qr_verified?: number;
  gps_verified?: number;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_accuracy?: number;
  gps_distance?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EffectiveWorkStatus {
  status: WorkStatusType;
  period: "MORNING" | "AFTERNOON" | "FULL_DAY";
  reason: WorkStatusReason;
  dayOfWeek: number;
  dayName: string;
  holiday?: Holiday | null;
  schedule?: WorkScheduleDay | null;
  attendanceType: AttendanceType;
  ethiopian_date?: string;
  ethiopian_date_am?: string;
  ethiopian_time?: string;
  holidayName?: string;
  overtimeMultiplier?: number;
  is_working_day?: boolean;
  is_full_non_working_day?: boolean;
  is_half_day?: boolean;
  morning_status?: WorkStatusType;
  afternoon_status?: WorkStatusType;
  working_day_label?: string;
  working_day_description?: string;
}

export interface OvertimeDashboardStats {
  todayOvertimeHours: number;
  pendingOvertimeHours: number;
  pendingCount: number;
  approvedOvertimeHours: number;
  rejectedOvertimeHours: number;
  restDayOvertimeHours: number;
  holidayOvertimeHours: number;
  totalOvertimeHours: number;
  estimatedPayoutETB?: number;
}

export type DatabaseEngine = "mysql";

export interface DatabaseStatusDetails {
  engine: "mysql";
  connected: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  error?: string | null;
  latencyMs?: number;
  details?: Record<string, any>;
  tableCounts?: Record<string, number>;
}

export interface DualDatabaseStatus {
  activeEngine: DatabaseEngine;
  effectiveEngine: "mysql";
  isFallback?: boolean;
  mysql: DatabaseStatusDetails;
  tables: string[];
}

export interface MysqlFormConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  ssl?: boolean;
}

export interface SyncResult {
  success: boolean;
  direction: string;
  timestamp: string;
  durationMs: number;
  syncedTables: Record<string, number>;
  errors?: string[];
}

export type PenaltyStatus = "PENDING" | "PENALIZED" | "PAID" | "CANCELLED" | "WAIVED" | "WITHIN_GRACE";

export interface LatePenaltyRecord {
  id: number;
  user_id: number;
  employee_name: string;
  employee_role?: string;
  phone_number?: string;
  hourly_rate?: number;
  photo?: string | null;
  date: string;
  session: "Morning" | "Afternoon";
  check_in_time: string;
  check_out_time?: string | null;
  scheduled_start_time: string;
  late_minutes: number;
  is_within_grace: boolean;
  penalty_amount: number;
  penalty_status: PenaltyStatus;
  notification_status?: "ACTIVE" | "UNCHECKED" | "INACTIVE";
  penalty_type?: string;
  reason?: string;
  payroll_id?: number | null;
  paid_at?: string | null;
  processed_by?: number | null;
  penalty_waived_reason?: string | null;
  penalty_waived_by?: number | null;
  waived_by_name?: string | null;
  penalty_waived_at?: string | null;
  verification_method?: string;
  distance?: number;
}

export interface LatePenaltyStats {
  totalLateCount: number;
  penalizedCount: number;
  waivedCount: number;
  withinGraceCount: number;
  totalPenaltyAmount: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  punctualityRate: number;
}

export interface LatePenaltyPolicy {
  late_grace_minutes: number;
  allowed_minor_lates: number;
  late_penalty_fixed_amount: number;
  late_penalty_hourly_multiplier: number;
  punctuality_bonus_amount: number;
}
