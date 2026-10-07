import { create } from "zustand";
import { networkTimeManager } from "./utils/networkTime.js";
import { 
  User, 
  AttendanceRecord, 
  AttendanceRequest, 
  PermissionRequest, 
  SalaryPayment, 
  EnterprisePayslip,
  CompensationUpdatePayload,
  AttendanceScoreRecord, 
  QRCodeData, 
  DashboardData, 
  SiteSettings,
  MissingCheckoutCorrectionPayload,
  AuditLogRecord,
  AttendanceStatusResponse,
  WorkScheduleDay,
  Holiday,
  OvertimeRecord,
  OvertimeDashboardStats,
  EffectiveWorkStatus,
  DualDatabaseStatus,
  MysqlFormConfig,
  SyncResult,
  AttendanceCorrection,
  AttendanceCorrectionRequestPayload,
  PayrollPreFlightResult,
  LatePenaltyRecord,
  LatePenaltyStats,
  LatePenaltyPolicy
} from "./types.js";

interface AppState {
  token: string | null;
  user: User | null;
  employees: User[];
  todayAttendance: AttendanceRecord[];
  attendanceHistory: AttendanceRecord[];
  missingCheckouts: AttendanceRecord[];
  attendanceCorrections: AttendanceCorrection[];
  attendanceAuditLogs: AuditLogRecord[];
  payrollPreflight: PayrollPreFlightResult | null;
  attendanceStatus: AttendanceStatusResponse | null;
  permissions: PermissionRequest[];
  attendanceRequests: AttendanceRequest[];
  salaries: SalaryPayment[];
  mySalary: SalaryPayment | null;
  disbursements: any[];
  scores: AttendanceScoreRecord[];
  qrCode: QRCodeData | null;
  dashboardData: DashboardData | null;
  siteSettings: SiteSettings | null;
  workSchedules: WorkScheduleDay[];
  holidays: Holiday[];
  overtimeRecords: OvertimeRecord[];
  overtimeStats: OvertimeDashboardStats | null;
  effectiveWorkStatus: EffectiveWorkStatus | null;
  latePenalties: LatePenaltyRecord[];
  penaltyStats: LatePenaltyStats | null;
  penaltyPolicy: LatePenaltyPolicy | null;
  penaltiesLoading: boolean;
  databaseConnected: boolean;
  databaseStatus: DualDatabaseStatus | null;
  databaseLoading: boolean;
  databaseSyncing: boolean;
  databaseError: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  setupDatabaseConnection: (config: MysqlFormConfig) => Promise<{ success: boolean; error?: string; message?: string }>;
  fetchDatabaseStatus: () => Promise<DualDatabaseStatus | null>;
  testMysqlConnection: (config: MysqlFormConfig) => Promise<{ success: boolean; latencyMs?: number; version?: string; error?: string }>;
  updateDatabaseConfig: (config: { activeEngine?: "mysql"; mysql: MysqlFormConfig }) => Promise<{ success: boolean; error?: string; warning?: string; message?: string }>;
  syncDatabases: () => Promise<SyncResult>;
  exportSqlDump: () => Promise<void>;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  login: (phone: string, pass: string) => Promise<boolean>;
  logout: () => void;
  fetchProfile: () => Promise<boolean>;
  updateProfile: (data: { full_name: string; phone_number: string; password?: string; current_password?: string; new_password?: string; photo?: string }) => Promise<boolean>;
  checkSetup: () => Promise<boolean>;
  setupAdmin: (fullName: string, phone: string, pass: string, companyName?: string, role?: string) => Promise<boolean>;

  // Admin Actions
  registerEmployee: (data: any) => Promise<{ success: boolean; error?: string }>;
  fetchEmployees: () => Promise<void>;
  updateHourlyRate: (id: number, rate: number) => Promise<boolean>;
  updateCompensation: (id: number, data: CompensationUpdatePayload) => Promise<{ success: boolean; error?: string }>;
  updateEmployee: (id: number, data: any) => Promise<{ success: boolean; error?: string }>;
  deleteEmployee: (id: number) => Promise<{ success: boolean; error?: string }>;
  resetEmployeeDevice: (id: number) => Promise<{ success: boolean; message?: string; error?: string }>;
  activeDashboardFilter: string;
  activeSalaryFilter: string;
  fetchDashboard: (filter?: string, startDate?: string, endDate?: string) => Promise<void>;
  approvePermission: (id: number, status: "Approved" | "Rejected", from?: string, to?: string) => Promise<boolean>;
  approveAttendanceRequest: (id: number, status: "Approved" | "Rejected") => Promise<boolean>;
  fetchSalaries: (filter?: string, startDate?: string, endDate?: string) => Promise<void>;
  fetchPayslip: (userId: number, filter?: string, startDate?: string, endDate?: string) => Promise<EnterprisePayslip | null>;
  fetchMySalary: (filter?: string, startDate?: string, endDate?: string) => Promise<SalaryPayment | null>;
  disburseSalary: (payload: { user_id?: number; user_ids?: number[]; filter?: string; startDate?: string; endDate?: string; payment_method?: string; payment_reference?: string; payment_date?: string; notes?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  markSalaryUnpaid: (payload: { user_id?: number; user_ids?: number[]; filter?: string; startDate?: string; endDate?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  updateSalaryCalculationMethod: (userId: number, method: "GROSS" | "NET", startDate?: string, endDate?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  updateDefaultSalaryCalculation: (method: "GROSS" | "NET") => Promise<{ success: boolean; message?: string; error?: string }>;
  fetchDisbursementHistory: () => Promise<any[]>;
  regenerateQRCode: () => Promise<{ success: boolean; error?: string; qrCode?: any }>;
  captureOfficeNetwork: () => Promise<{ success: boolean; captured_ip?: string; message?: string; error?: string }>;
  fetchMissingCheckouts: () => Promise<AttendanceRecord[]>;
  correctMissingCheckout: (id: number, data: MissingCheckoutCorrectionPayload) => Promise<{ success: boolean; message?: string; error?: string; record?: AttendanceRecord }>;
  fetchAttendanceCorrections: () => Promise<AttendanceCorrection[]>;
  requestAttendanceCorrection: (payload: AttendanceCorrectionRequestPayload) => Promise<{ success: boolean; message?: string; error?: string; correction?: AttendanceCorrection }>;
  approveAttendanceCorrection: (id: number, payload?: { approved_check_in?: string; approved_check_out?: string; notes?: string }) => Promise<{ success: boolean; message?: string; error?: string }>;
  rejectAttendanceCorrection: (id: number, reason: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  fetchPayrollPreflightCheck: (month?: number, year?: number) => Promise<PayrollPreFlightResult | null>;
  fetchAttendanceAuditLogs: () => Promise<AuditLogRecord[]>;
  fetchAttendanceStatus: () => Promise<AttendanceStatusResponse | null>;
  resetSystemToBootstrap: () => Promise<{ success: boolean; error?: string }>;

  // Common/Employee Actions
  fetchTodayAttendance: () => Promise<void>;
  checkIn: (qrCode?: string, locData?: { latitude?: number; longitude?: number; accuracy?: number; wifi_ssid?: string; wifi_bssid?: string; wifi_ip?: string; device_id?: string; device_name?: string; session?: string }) => Promise<{
    success: boolean;
    error?: string;
    code?: string;
    session?: string;
    verification_method?: string;
    distance?: number;
    accuracy?: number;
    allowed_radius?: number;
    detected_latitude?: number;
    detected_longitude?: number;
    office_latitude?: number;
    office_longitude?: number;
  }>;
  checkOut: (qrCode?: string, locData?: { latitude?: number; longitude?: number; accuracy?: number; wifi_ssid?: string; wifi_bssid?: string; wifi_ip?: string; device_id?: string; device_name?: string; session?: string }) => Promise<{
    success: boolean;
    error?: string;
    code?: string;
    session?: string;
    verification_method?: string;
    distance?: number;
    accuracy?: number;
    allowed_radius?: number;
    detected_latitude?: number;
    detected_longitude?: number;
    office_latitude?: number;
    office_longitude?: number;
  }>;
  fetchAttendanceHistory: () => Promise<void>;
  fetchPermissions: () => Promise<void>;
  submitPermission: (data: { request_type: string; reason: string; start_date: string; end_date: string; session?: "Full Day" | "Morning" | "Afternoon" }) => Promise<{ success: boolean; error?: string }>;
  fetchAttendanceRequests: () => Promise<void>;
  submitAttendanceRequest: (data: { type: string; date: string; check_in_time: string; check_out_time: string; reason: string; session?: "Full Day" | "Morning" | "Afternoon"; request_scope?: "Full Shift" | "Site Check-Out" }) => Promise<{ success: boolean; error?: string }>;
  fetchScores: () => Promise<void>;
  fetchQRCode: () => Promise<void>;
  fetchSiteSettings: () => Promise<void>;
  updateSiteSettings: (data: Partial<SiteSettings>) => Promise<boolean>;

  // Work Calendar, Holidays & Overtime Actions
  fetchWorkCalendar: () => Promise<void>;
  updateWorkCalendar: (schedules: WorkScheduleDay[]) => Promise<{ success: boolean; error?: string }>;
  fetchHolidays: () => Promise<void>;
  createHoliday: (data: Partial<Holiday>) => Promise<{ success: boolean; error?: string }>;
  updateHoliday: (id: number, data: Partial<Holiday>) => Promise<{ success: boolean; error?: string }>;
  deleteHoliday: (id: number) => Promise<{ success: boolean; error?: string }>;
  fetchWorkCalendarStatus: (date?: string, time?: string, session?: string) => Promise<EffectiveWorkStatus | null>;
  fetchOvertimeRecords: (status?: string, employeeId?: number) => Promise<void>;
  fetchOvertimeStats: () => Promise<void>;
  approveOvertime: (id: number) => Promise<{ success: boolean; error?: string }>;
  rejectOvertime: (id: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  updateOvertimeRates: (rates: { normal: number; rest_day: number; holiday: number; night: number; allowed_radius?: number }) => Promise<{ success: boolean; error?: string }>;
  runSystemTests: () => Promise<{ success: boolean; summary?: any; results?: any[]; error?: string }>;

  // Penalty Management Actions
  fetchPenalties: (params?: { status?: string; session?: string; search?: string; employeeId?: number }) => Promise<void>;
  waivePenalty: (id: number, reason: string) => Promise<{ success: boolean; error?: string }>;
  reinstatePenalty: (id: number) => Promise<{ success: boolean; error?: string }>;
  updatePenaltyPolicy: (policy: Partial<LatePenaltyPolicy>) => Promise<{ success: boolean; error?: string }>;
  addManualPenalty: (payload: { user_id: number; date: string; session: string; late_minutes: number; penalty_amount: number; check_in_time?: string; reason?: string }) => Promise<{ success: boolean; error?: string }>;
  updatePenaltyStatus: (id: number, status: string, reason?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  updatePenaltyNotification: (id: number, notification_status: "ACTIVE" | "UNCHECKED") => Promise<{ success: boolean; message?: string; error?: string }>;
  bulkUpdatePenaltyStatus: (ids: number[], status: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

// Universal safe JSON parser for fetch responses
const safeJson = async (res: Response): Promise<any> => {
  let text = "";
  try {
    text = await res.text();
    if (!text || text.trim() === "") return {};
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[SafeJSON] Non-JSON payload received from ${res.url || "endpoint"} (Status: ${res.status}):`, text.slice(0, 120), err);
    if (res.status === 403) {
      return { error: "Access denied. Action not authorized for this account role (403)." };
    }
    if (res.status === 401) {
      return { error: "Session expired or invalid. Please sign in again (401)." };
    }
    if (res.status === 404) {
      return { error: "The requested resource was not found (404)." };
    }
    if (res.status >= 500) {
      return { error: `Server error occurred (${res.status}). Please try again.` };
    }
    return { error: `Network request returned error status (${res.status})` };
  }
};

// Safe local storage reader for user & token
const getStoredToken = (): string | null => {
  try {
    const token = localStorage.getItem("attendance_token");
    if (!token || token === "null" || token === "undefined") return null;
    return token;
  } catch {
    return null;
  }
};

const getStoredUser = (): User | null => {
  try {
    const userStr = localStorage.getItem("attendance_user");
    if (!userStr || userStr === "null" || userStr === "undefined") return null;
    return JSON.parse(userStr);
  } catch (err) {
    console.warn("Corrupted attendance_user in localStorage, clearing cache...", err);
    try {
      localStorage.removeItem("attendance_user");
    } catch {}
    return null;
  }
};

// Helper for authenticated API calls with automatic 401 session expiration handling
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  onUnauthorized?: () => void
): Promise<Response> => {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      console.warn(`401 Unauthorized on ${url}. Session expired or invalid.`);
      try {
        localStorage.removeItem("attendance_token");
        localStorage.removeItem("attendance_user");
      } catch {}
      if (onUnauthorized) {
        onUnauthorized();
      }
    }
    return res;
  } catch (err: any) {
    console.warn(`[Network] Fetch warning on ${url}:`, err?.message || err);
    throw err;
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  employees: [],
  todayAttendance: [],
  attendanceHistory: [],
  missingCheckouts: [],
  attendanceCorrections: [],
  attendanceAuditLogs: [],
  payrollPreflight: null,
  attendanceStatus: null,
  permissions: [],
  attendanceRequests: [],
  salaries: [],
  mySalary: null,
  disbursements: [],
  scores: [],
  qrCode: null,
  dashboardData: null,
  activeDashboardFilter: "Today",
  activeSalaryFilter: "Monthly",
  siteSettings: null,
  workSchedules: [],
  holidays: [],
  overtimeRecords: [],
  overtimeStats: null,
  effectiveWorkStatus: null,
  latePenalties: [],
  penaltyStats: null,
  penaltyPolicy: null,
  penaltiesLoading: false,
  databaseConnected: true,
  databaseStatus: null,
  databaseLoading: false,
  databaseSyncing: false,
  databaseError: null,
  loading: false,
  error: null,

  setToken: (token) => {
    try {
      if (token) localStorage.setItem("attendance_token", token);
      else localStorage.removeItem("attendance_token");
    } catch {}
    set({ token });
  },

  setUser: (user) => {
    try {
      if (user) localStorage.setItem("attendance_user", JSON.stringify(user));
      else localStorage.removeItem("attendance_user");
    } catch {}
    set({ user });
  },

  login: async (phone, pass) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phone, password: pass }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        set({ error: data?.error || "Login failed", loading: false });
        return false;
      }
      get().setToken(data.token);
      get().setUser(data.user);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: "Server connection failed", loading: false });
      return false;
    }
  },

  checkSetup: async () => {
    // Retry with backoff to handle container bootup / iframe warm-up smoothly
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch("/api/auth/setup-check", {
          signal: controller.signal,
          headers: { "Accept": "application/json" }
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP status ${res.status}`);
        }

        const data = await safeJson(res);
        if (data && data.databaseConnected === false) {
          set({
            databaseConnected: false,
            databaseError: data.databaseError || "MySQL database is not connected. Please verify your credentials."
          });
          return false;
        }
        set({ databaseConnected: true, databaseError: null });
        const isEmpty = !!data?.empty;
        if (isEmpty) {
          get().logout();
        }
        return isEmpty;
      } catch (err: any) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 400));
        } else {
          console.warn("[SetupCheck] Initial connection check deferred:", err?.message || err);
          // Gracefully maintain optimistic connection state so UI does not flash error
          set((state) => ({
            databaseConnected: state.databaseConnected !== false,
            databaseError: null
          }));
          return false;
        }
      }
    }
    return false;
  },

  setupDatabaseConnection: async (config: MysqlFormConfig) => {
    set({ databaseLoading: true, databaseError: null });
    try {
      const res = await fetch("/api/database/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      const data = await safeJson(res);
      set({ databaseLoading: false });
      if (res.ok && data?.success) {
        set({ databaseConnected: true, databaseError: null });
        await get().checkSetup();
        return { success: true, message: data.message };
      } else {
        set({ databaseError: data?.error || "Database connection failed" });
        return { success: false, error: data?.error || "Database connection failed" };
      }
    } catch (err: any) {
      set({ databaseLoading: false, databaseError: err.message || "Network error" });
      return { success: false, error: err.message || "Network error" };
    }
  },

  setupAdmin: async (fullName, phone, pass, companyName, role) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/auth/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone_number: phone, password: pass, company_name: companyName, role: role || "Bootstrap" }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        set({ error: data?.error || "Setup failed", loading: false });
        return false;
      }
      get().setToken(data.token);
      get().setUser(data.user);
      set({ loading: false });
      return true;
    } catch (err: any) {
      set({ error: "Server connection failed", loading: false });
      return false;
    }
  },

  resetSystemToBootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const token = get().token;
      const res = await fetch("/api/system/reset-to-bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await safeJson(res);
      if (!res.ok) {
        set({ error: data?.error || "Reset failed", loading: false });
        return { success: false, error: data?.error || "Reset failed" };
      }
      get().logout();
      set({ loading: false });
      return { success: true };
    } catch (err: any) {
      set({ error: "Server connection failed", loading: false });
      return { success: false, error: "Server connection failed" };
    }
  },

  logout: () => {
    get().setToken(null);
    get().setUser(null);
    set({
      employees: [],
      todayAttendance: [],
      attendanceHistory: [],
      permissions: [],
      attendanceRequests: [],
      salaries: [],
      scores: [],
      qrCode: null,
      dashboardData: null,
      error: null
    });
  },

  fetchProfile: async () => {
    const { token } = get();
    if (!token) return false;
    try {
      const res = await authenticatedFetch("/api/auth/me", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data && data.id) {
          get().setUser(data);
          return true;
        }
      } else if (res.status === 401) {
        get().logout();
        return false;
      }
      return false;
    } catch (err: any) {
      console.warn("[Profile] Fetch profile request deferred:", err?.message || err);
      return false;
    }
  },

  updateProfile: async (data) => {
    const { token } = get();
    if (!token) return false;
    set({ loading: true, error: null });
    try {
      const res = await authenticatedFetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, () => get().logout());
      const resData = await safeJson(res);
      if (!res.ok) {
        set({ error: resData?.error || "Profile update failed", loading: false });
        return false;
      }
      get().setUser(resData.user);
      set({ loading: false });
      return true;
    } catch (err) {
      set({ error: "Failed to update profile", loading: false });
      return false;
    }
  },

  registerEmployee: async (data) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    set({ loading: true, error: null });
    try {
      const res = await authenticatedFetch("/api/employees/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, () => get().logout());
      
      const resData = await safeJson(res);
      set({ loading: false });

      if (!res.ok || (resData && resData.success === false)) {
        return { success: false, error: resData?.error || "Registration failed" };
      }
      get().fetchEmployees(); // Refresh employee list
      return { success: true };
    } catch (err: any) {
      console.error("Registration fetch error:", err);
      set({ loading: false });
      return { success: false, error: `Network connection failed: ${err.message || 'Unknown error'}` };
    }
  },

  fetchEmployees: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/employees", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ employees: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  updateHourlyRate: async (id, rate) => {
    const { token } = get();
    if (!token) return false;
    try {
      const res = await authenticatedFetch(`/api/employees/${id}/hourly-rate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourly_rate: rate }),
      }, () => get().logout());
      if (res.ok) {
        get().fetchEmployees();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  updateCompensation: async (id, data) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/employees/${id}/compensation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, () => get().logout());
      if (res.ok) {
        get().fetchEmployees();
        return { success: true };
      }
      const errJson = await safeJson(res);
      return { success: false, error: errJson?.error || "Failed to update compensation" };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  updateEmployee: async (id, data) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, () => get().logout());
      const resData = await safeJson(res);
      if (res.ok) {
        get().fetchEmployees();
        return { success: true };
      }
      return { success: false, error: resData?.error || "Failed to update employee details" };
    } catch (err) {
      console.error(err);
      return { success: false, error: "Network connection failed" };
    }
  },

  deleteEmployee: async (id) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/employees/${id}`, {
        method: "DELETE",
      }, () => get().logout());
      const resData = await safeJson(res);
      if (res.ok) {
        get().fetchEmployees();
        return { success: true };
      }
      return { success: false, error: resData?.error || "Failed to delete employee" };
    } catch (err) {
      console.error(err);
      return { success: false, error: "Network connection failed" };
    }
  },

  resetEmployeeDevice: async (id) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/employees/${id}/reset-device`, {
        method: "POST",
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchEmployees();
        return { success: true, message: data?.message };
      }
      return { success: false, error: data?.error || "Failed to reset device binding" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchDashboard: async (filter, startDate, endDate) => {
    const { token } = get();
    if (!token) return;
    const targetFilter = filter || get().activeDashboardFilter || "Today";
    set({ activeDashboardFilter: targetFilter });
    try {
      let url = `/api/attendance/dashboard?filter=${targetFilter}`;
      if (targetFilter === "Custom" && startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const res = await authenticatedFetch(url, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data && data.summary) {
          if (data.summary.serverEpochMs) {
            networkTimeManager.recordServerTimestamp(data.summary.serverEpochMs);
          }
          set({ dashboardData: data });
        } else {
          console.warn("[store] fetchDashboard received response without summary:", data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  },

  fetchTodayAttendance: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/attendance/today", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ todayAttendance: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  checkIn: async (qrCode, locData) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          qr_code: qrCode,
          ...locData
        }),
      }, () => get().logout());
      
      const data = await safeJson(res);

      if (res.ok) {
        get().fetchTodayAttendance();
        get().fetchAttendanceHistory();
        get().fetchScores();
        return {
          success: true,
          session: data?.session,
          verification_method: data?.verification_method,
          distance: data?.distance
        };
      } else {
        return { 
          success: false, 
          error: data?.error,
          code: data?.code,
          distance: data?.distance,
          accuracy: data?.accuracy,
          allowed_radius: data?.allowed_radius,
          detected_latitude: data?.detected_latitude,
          detected_longitude: data?.detected_longitude,
          office_latitude: data?.office_latitude,
          office_longitude: data?.office_longitude
        };
      }
    } catch (err: any) {
      console.error("Check-in fetch error:", err);
      return { success: false, error: `Network error during check-in: ${err.message}` };
    }
  },

  checkOut: async (qrCode, locData) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          qr_code: qrCode,
          ...locData
        }),
      }, () => get().logout());

      const data = await safeJson(res);

      if (res.ok) {
        get().fetchTodayAttendance();
        get().fetchAttendanceHistory();
        get().fetchScores();
        return {
          success: true,
          session: data?.session,
          verification_method: data?.verification_method,
          distance: data?.distance
        };
      } else {
        return { 
          success: false, 
          error: data?.error,
          code: data?.code,
          distance: data?.distance,
          accuracy: data?.accuracy,
          allowed_radius: data?.allowed_radius,
          detected_latitude: data?.detected_latitude,
          detected_longitude: data?.detected_longitude,
          office_latitude: data?.office_latitude,
          office_longitude: data?.office_longitude
        };
      }
    } catch (err: any) {
      console.error("Check-out fetch error:", err);
      return { success: false, error: `Network error during check-out: ${err.message}` };
    }
  },

  fetchAttendanceHistory: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/attendance/history", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ attendanceHistory: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  fetchPermissions: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/permissions", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ permissions: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  submitPermission: async (data) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, () => get().logout());
      const resData = await safeJson(res);
      if (res.ok && resData?.success) {
        get().fetchPermissions();
        return { success: true };
      }
      return { success: false, error: resData?.error || "Failed to submit permission request" };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  approvePermission: async (id, status, from, to) => {
    const { token } = get();
    if (!token) return false;
    try {
      const res = await authenticatedFetch(`/api/permissions/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approved_from_date: from, approved_to_date: to }),
      }, () => get().logout());
      if (res.ok) {
        get().fetchPermissions();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  fetchAttendanceRequests: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/attendance-requests", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ attendanceRequests: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  submitAttendanceRequest: async (data) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/attendance-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }, () => get().logout());
      const resData = await safeJson(res);
      if (res.ok && resData?.success) {
        get().fetchAttendanceRequests();
        return { success: true };
      }
      return { success: false, error: resData?.error || "Failed to submit attendance adjustment request" };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  approveAttendanceRequest: async (id, status) => {
    const { token } = get();
    if (!token) return false;
    try {
      const res = await authenticatedFetch(`/api/attendance-requests/${id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }, () => get().logout());
      if (res.ok) {
        get().fetchAttendanceRequests();
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  fetchSalaries: async (filter, startDate, endDate) => {
    const { token } = get();
    if (!token) return;
    const targetFilter = filter || get().activeSalaryFilter || "Monthly";
    set({ activeSalaryFilter: targetFilter });
    try {
      let query = `/api/salaries?filter=${targetFilter}`;
      if (startDate && endDate) {
        query += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      }
      const res = await authenticatedFetch(query, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ salaries: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error("fetchSalaries error:", err);
    }
  },

  fetchPayslip: async (userId, filter = "Monthly", startDate, endDate) => {
    const { token } = get();
    if (!token) return null;
    try {
      let query = `/api/salaries/${userId}/payslip?filter=${filter}`;
      if (startDate && endDate) {
        query += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      }
      const res = await authenticatedFetch(query, {}, () => get().logout());
      if (res.ok) {
        return await safeJson(res);
      }
      return null;
    } catch (err) {
      console.error("fetchPayslip error:", err);
      return null;
    }
  },

  fetchMySalary: async (filter = "Monthly", startDate, endDate) => {
    const { token } = get();
    if (!token) return null;
    try {
      let query = `/api/employee/my-salary?filter=${filter}`;
      if (startDate && endDate) {
        query += `&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      }
      const res = await authenticatedFetch(query, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ mySalary: data });
        return data;
      }
      return null;
    } catch (err) {
      console.error("fetchMySalary error:", err);
      return null;
    }
  },

  disburseSalary: async (payload) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/salaries/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchSalaries(payload.filter || "Monthly", payload.startDate, payload.endDate);
        get().fetchPenalties();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || "Disbursement failed" };
    } catch (err: any) {
      console.error("disburseSalary error:", err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  markSalaryUnpaid: async (payload) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/salaries/mark-unpaid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchSalaries(payload.filter || "Monthly", payload.startDate, payload.endDate);
        get().fetchPenalties();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || "Failed to mark as unpaid" };
    } catch (err: any) {
      console.error("markSalaryUnpaid error:", err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  updateSalaryCalculationMethod: async (userId: number, method: "GROSS" | "NET", startDate?: string, endDate?: string) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/salaries/${userId}/calculation-method`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calculation_method: method, startDate, endDate })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchSalaries(get().activeSalaryFilter || "Monthly", startDate, endDate);
        get().fetchEmployees();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || "Failed to update calculation method" };
    } catch (err: any) {
      console.error("updateSalaryCalculationMethod error:", err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  updateDefaultSalaryCalculation: async (method: "GROSS" | "NET") => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/salaries/default-calculation-method", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_salary_calculation: method })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchSalaries(get().activeSalaryFilter || "Monthly");
        get().fetchSiteSettings();
        return { success: true, message: data.message };
      }
      return { success: false, error: data.error || "Failed to update default calculation method" };
    } catch (err: any) {
      console.error("updateDefaultSalaryCalculation error:", err);
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchDisbursementHistory: async () => {
    const { token } = get();
    if (!token) return [];
    try {
      const res = await authenticatedFetch("/api/salaries/disbursement-history", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        const list = Array.isArray(data) ? data : [];
        set({ disbursements: list });
        return list;
      }
      return [];
    } catch (err) {
      console.error("fetchDisbursementHistory error:", err);
      return [];
    }
  },

  fetchScores: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/scores", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ scores: Array.isArray(data) ? data : [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  fetchQRCode: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/qr-code", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ qrCode: data });
      }
    } catch (err) {
      console.error(err);
    }
  },

  regenerateQRCode: async () => {
    const { token } = get();
    if (!token) return { success: false, error: "Authentication token missing." };
    try {
      const res = await authenticatedFetch("/api/qr-code/regenerate", {
        method: "POST",
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        set({ qrCode: data });
        return { success: true, qrCode: data };
      }
      return { success: false, error: data?.error || "Failed to regenerate QR Code" };
    } catch (err: any) {
      console.error(err);
      return { success: false, error: err.message || "Network communication error" };
    }
  },

  fetchSiteSettings: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/site-settings", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ siteSettings: data });
      }
    } catch (err) {
      console.error("Error fetching site settings:", err);
    }
  },

  updateSiteSettings: async (data) => {
    const { token } = get();
    if (!token) return false;
    try {
      const res = await authenticatedFetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }, () => get().logout());
      if (res.ok) {
        get().fetchSiteSettings();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error updating site settings:", err);
      return false;
    }
  },

  captureOfficeNetwork: async () => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/site-settings/capture-network", {
        method: "POST",
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchSiteSettings();
        return { success: true, captured_ip: data?.captured_ip, message: data?.message };
      }
      return { success: false, error: data?.error || "Failed to capture network IP" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchAttendanceStatus: async () => {
    const { token } = get();
    if (!token) return null;
    try {
      const res = await authenticatedFetch("/api/attendance/status", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data?.serverEpochMs) {
          networkTimeManager.recordServerTimestamp(data.serverEpochMs);
        }
        set({ attendanceStatus: data });
        return data;
      }
      return null;
    } catch (err) {
      console.error("Error fetching attendance status:", err);
      return null;
    }
  },

  fetchMissingCheckouts: async () => {
    const { token } = get();
    if (!token) return [];
    try {
      const res = await authenticatedFetch("/api/attendance/missing-checkouts", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ missingCheckouts: Array.isArray(data) ? data : [] });
        return Array.isArray(data) ? data : [];
      }
      return [];
    } catch (err) {
      console.error("Error fetching missing checkouts:", err);
      return [];
    }
  },

  correctMissingCheckout: async (id, payload) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/attendance/${id}/correct-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchMissingCheckouts();
        get().fetchAttendanceHistory();
        get().fetchTodayAttendance();
        get().fetchScores();
        get().fetchAttendanceAuditLogs();
        get().fetchAttendanceStatus();
        return { success: true, message: data?.message, record: data?.record };
      }
      return { success: false, error: data?.error || "Failed to correct attendance record" };
    } catch (err: any) {
      console.error("Error correcting missing checkout:", err);
      return { success: false, error: err.message || "Network communication error" };
    }
  },

  fetchAttendanceAuditLogs: async () => {
    const { token } = get();
    if (!token) return [];
    try {
      const res = await authenticatedFetch("/api/attendance/audit-logs", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        const list = Array.isArray(data) ? data : [];
        set({ attendanceAuditLogs: list });
        return list;
      }
      return [];
    } catch (err) {
      console.error("Error fetching attendance audit logs:", err);
      return [];
    }
  },

  fetchAttendanceCorrections: async () => {
    const { token } = get();
    if (!token) return [];
    try {
      const res = await authenticatedFetch("/api/attendance/corrections", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        const list = Array.isArray(data) ? data : [];
        set({ attendanceCorrections: list });
        return list;
      }
      return [];
    } catch (err) {
      console.error("Error fetching attendance corrections:", err);
      return [];
    }
  },

  requestAttendanceCorrection: async (payload) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/attendance/corrections/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchAttendanceCorrections();
        get().fetchMissingCheckouts();
        get().fetchAttendanceStatus();
        return { success: true, message: data?.message, correction: data?.correction };
      }
      return { success: false, error: data?.error || "Failed to submit correction request" };
    } catch (err: any) {
      console.error("Error requesting attendance correction:", err);
      return { success: false, error: err.message || "Network communication error" };
    }
  },

  approveAttendanceCorrection: async (id, payload = {}) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/attendance/corrections/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchAttendanceCorrections();
        get().fetchMissingCheckouts();
        get().fetchAttendanceHistory();
        get().fetchTodayAttendance();
        get().fetchScores();
        get().fetchAttendanceAuditLogs();
        get().fetchAttendanceStatus();
        return { success: true, message: data?.message };
      }
      return { success: false, error: data?.error || "Failed to approve correction" };
    } catch (err: any) {
      console.error("Error approving correction:", err);
      return { success: false, error: err.message || "Network communication error" };
    }
  },

  rejectAttendanceCorrection: async (id, reason) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/attendance/corrections/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok) {
        get().fetchAttendanceCorrections();
        get().fetchMissingCheckouts();
        get().fetchAttendanceAuditLogs();
        return { success: true, message: data?.message };
      }
      return { success: false, error: data?.error || "Failed to reject correction" };
    } catch (err: any) {
      console.error("Error rejecting correction:", err);
      return { success: false, error: err.message || "Network communication error" };
    }
  },

  fetchPayrollPreflightCheck: async (month, year) => {
    const { token } = get();
    if (!token) return null;
    try {
      const params = new URLSearchParams();
      if (month) params.append("month", month.toString());
      if (year) params.append("year", year.toString());
      const queryStr = params.toString() ? `?${params.toString()}` : "";

      const res = await authenticatedFetch(`/api/payroll/preflight-check${queryStr}`, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        set({ payrollPreflight: data });
        return data;
      }
      return null;
    } catch (err) {
      console.error("Error fetching payroll preflight check:", err);
      return null;
    }
  },

  // ==========================================
  // WORK CALENDAR, HOLIDAYS & OVERTIME ACTIONS
  // ==========================================

  fetchWorkCalendar: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/work-calendar", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success && Array.isArray(data.schedules)) {
          set({ workSchedules: data.schedules });
        }
      }
    } catch (err) {
      console.error("Error fetching work calendar:", err);
    }
  },

  updateWorkCalendar: async (schedules: WorkScheduleDay[]) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/work-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        if (Array.isArray(data.schedules)) {
          set({ workSchedules: data.schedules });
        }
        // Immediately trigger local state refreshes
        get().fetchWorkCalendarStatus();
        get().fetchTodayAttendance();
        get().fetchAttendanceStatus();
        const role = get().user?.role || "";
        const isAdmin = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"].includes(role);
        if (isAdmin) {
          get().fetchDashboard("Today");
          get().fetchSalaries("Monthly");
          get().fetchOvertimeStats();
        } else {
          get().fetchMySalary("Monthly");
        }
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to update work calendar" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchHolidays: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/holidays", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success && Array.isArray(data.holidays)) {
          set({ holidays: data.holidays });
        }
      }
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  },

  createHoliday: async (holidayData: Partial<Holiday>) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holidayData)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchHolidays();
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to create holiday" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  updateHoliday: async (id: number, holidayData: Partial<Holiday>) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/holidays/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(holidayData)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchHolidays();
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to update holiday" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  deleteHoliday: async (id: number) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/holidays/${id}`, {
        method: "DELETE"
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchHolidays();
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to delete holiday" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchWorkCalendarStatus: async (date?: string, time?: string, session?: string) => {
    const { token } = get();
    if (!token) return null;
    try {
      const params = new URLSearchParams();
      if (date) params.append("date", date);
      if (time) params.append("time", time);
      if (session) params.append("session", session);
      const res = await authenticatedFetch(`/api/work-calendar/status?${params.toString()}`, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success && data.effective_status) {
          set({ effectiveWorkStatus: data.effective_status });
          return data.effective_status;
        }
      }
      return null;
    } catch (err) {
      console.error("Error fetching work calendar status:", err);
      return null;
    }
  },

  fetchOvertimeRecords: async (status?: string, employeeId?: number) => {
    const { token } = get();
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      if (employeeId) params.append("employee_id", employeeId.toString());
      const res = await authenticatedFetch(`/api/overtime?${params.toString()}`, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success && Array.isArray(data.records)) {
          set({ overtimeRecords: data.records });
        }
      }
    } catch (err) {
      console.error("Error fetching overtime records:", err);
    }
  },

  fetchOvertimeStats: async () => {
    const { token } = get();
    if (!token) return;
    try {
      const res = await authenticatedFetch("/api/overtime/stats", {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success && data.stats) {
          set({ overtimeStats: data.stats });
        }
      }
    } catch (err) {
      console.error("Error fetching overtime stats:", err);
    }
  },

  approveOvertime: async (id: number) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/overtime/${id}/approve`, {
        method: "PUT"
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchOvertimeRecords();
        get().fetchOvertimeStats();
        get().fetchAttendanceHistory();
        get().fetchSalaries("Monthly");
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to approve overtime" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  rejectOvertime: async (id: number, reason: string) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/overtime/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchOvertimeRecords();
        get().fetchOvertimeStats();
        get().fetchAttendanceHistory();
        get().fetchSalaries("Monthly");
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to reject overtime" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  updateOvertimeRates: async (rates: { normal: number; rest_day: number; holiday: number; night: number; allowed_radius?: number }) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/site-settings/overtime-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rates)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchSiteSettings();
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to update overtime rates" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  runSystemTests: async () => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/work-calendar/run-tests", {
        method: "POST"
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        return { success: true, summary: data.summary, results: data.results };
      }
      return { success: false, error: data?.error || "Failed to run system test suite" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchPenalties: async (params = {}) => {
    const { token } = get();
    if (!token) return;
    try {
      set({ penaltiesLoading: true });
      const q = new URLSearchParams();
      if (params.status) q.append("status", params.status);
      if (params.session) q.append("session", params.session);
      if (params.search) q.append("search", params.search);
      if (params.employeeId) q.append("employee_id", params.employeeId.toString());

      const res = await authenticatedFetch(`/api/penalties?${q.toString()}`, {}, () => get().logout());
      if (res.ok) {
        const data = await safeJson(res);
        if (data.success) {
          set({
            latePenalties: data.records || [],
            penaltyStats: data.stats || null,
            penaltyPolicy: data.policy || null,
            penaltiesLoading: false
          });
        }
      } else {
        set({ penaltiesLoading: false });
      }
    } catch (err) {
      console.error("Error fetching penalties:", err);
      set({ penaltiesLoading: false });
    }
  },

  waivePenalty: async (id: number, reason: string) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/penalties/${id}/waive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        get().fetchAttendanceHistory();
        get().fetchSalaries("Monthly");
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to waive penalty" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  reinstatePenalty: async (id: number) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/penalties/${id}/reinstate`, {
        method: "POST"
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        get().fetchAttendanceHistory();
        get().fetchSalaries("Monthly");
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to reinstate penalty" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  updatePenaltyPolicy: async (policy: Partial<LatePenaltyPolicy>) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/penalties/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        get().fetchSiteSettings();
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to update penalty policy" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  addManualPenalty: async (payload) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/penalties/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        get().fetchAttendanceHistory();
        get().fetchSalaries("Monthly");
        return { success: true };
      }
      return { success: false, error: data?.error || "Failed to record manual penalty" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  updatePenaltyStatus: async (id: number, status: string, reason?: string) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/penalties/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        get().fetchAttendanceHistory();
        get().fetchSalaries(get().activeSalaryFilter || "Monthly");
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || "Failed to update penalty status" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  updatePenaltyNotification: async (id: number, notification_status: "ACTIVE" | "UNCHECKED") => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch(`/api/penalties/${id}/notification`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_status })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || "Failed to update notification" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  bulkUpdatePenaltyStatus: async (ids: number[], status: string) => {
    const { token } = get();
    if (!token) return { success: false, error: "Not authenticated" };
    try {
      const res = await authenticatedFetch("/api/penalties/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        get().fetchPenalties();
        get().fetchAttendanceHistory();
        get().fetchSalaries(get().activeSalaryFilter || "Monthly");
        return { success: true, message: data.message };
      }
      return { success: false, error: data?.error || "Failed to bulk update penalties" };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error" };
    }
  },

  fetchDatabaseStatus: async () => {
    try {
      set({ databaseLoading: true, databaseError: null });
      const res = await fetch("/api/database/status");
      const data = await safeJson(res);
      if (res.ok) {
        set({ databaseStatus: data, databaseLoading: false });
        return data;
      } else {
        set({ databaseLoading: false, databaseError: data?.error || "Failed to fetch database status" });
        return null;
      }
    } catch (err: any) {
      set({ databaseLoading: false, databaseError: err.message });
      return null;
    }
  },

  testMysqlConnection: async (config: MysqlFormConfig) => {
    try {
      const res = await authenticatedFetch("/api/database/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      }, () => get().logout());
      const data = await safeJson(res);
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || "Network connection test failed" };
    }
  },

  updateDatabaseConfig: async (config: { activeEngine?: "mysql"; mysql: MysqlFormConfig }) => {
    try {
      set({ databaseLoading: true, databaseError: null });
      const res = await authenticatedFetch("/api/database/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeEngine: "mysql", ...config })
      }, () => get().logout());
      const data = await safeJson(res);
      if (res.ok && data.success) {
        set({ databaseStatus: data.status, databaseLoading: false });
        return { success: true, warning: data.warning, message: data.message };
      }
      set({ databaseLoading: false, databaseError: data?.error || "Failed to update database configuration" });
      return { success: false, error: data?.error || "Configuration update failed" };
    } catch (err: any) {
      set({ databaseLoading: false, databaseError: err.message });
      return { success: false, error: err.message };
    }
  },

  syncDatabases: async () => {
    try {
      set({ databaseSyncing: true, databaseError: null });
      const res = await authenticatedFetch("/api/database/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }, () => get().logout());
      const data = await safeJson(res);
      set({ databaseSyncing: false });
      if (data && data.success) {
        get().fetchDatabaseStatus();
      }
      return data;
    } catch (err: any) {
      set({ databaseSyncing: false, databaseError: err.message });
      return { success: false, errors: [err.message], durationMs: 0, syncedTables: {}, timestamp: new Date().toISOString(), direction: "mysql-active" };
    }
  },

  exportSqlDump: async () => {
    try {
      const { token } = get();
      const res = await fetch("/api/database/export-sql", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to export SQL script");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buildtrack_ams_dump_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Export SQL error:", err);
    }
  }
}));
