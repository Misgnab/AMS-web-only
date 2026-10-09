import React, { useState, useEffect } from "react";
import { useAppStore } from "./store.js";
import { QRCodeSVG } from "qrcode.react";
import { QRScanner } from "./components/QRScanner";
import { PrintableQRModal } from "./components/PrintableQRModal";
import { MissingCheckoutModal } from "./components/MissingCheckoutModal";
import { MissingCheckoutManagement } from "./components/MissingCheckoutManagement";
import { ForgottenCheckoutAlert } from "./components/ForgottenCheckoutAlert";
import { WorkCalendarTab } from "./components/WorkCalendarTab";
import { OvertimeManagementTab } from "./components/OvertimeManagementTab";
import { LatePenaltyManagement } from "./components/LatePenaltyManagement";
import { EnterprisePayslipModal } from "./components/EnterprisePayslipModal";
import { EmployeeOvertimeModal } from "./components/EmployeeOvertimeModal";
import { EditCompensationModal } from "./components/EditCompensationModal";
import { SalaryManagementTab } from "./components/SalaryManagementTab";
import { WorkingDayStatusCard } from "./components/WorkingDayStatusCard";
import { AttendanceScheduleSettingsTab } from "./components/AttendanceScheduleSettingsTab";
import { useRealtimeSync } from "./utils/useRealtimeSync";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { EnterprisePayslip, SalaryPayment, User } from "./types";
import { Footer } from "./components/Footer";
import { toEthiopian } from "ethiopian-date";
import { gregorianToEthiopianDate } from "./utils/ethiopianTime.js";
import { getOrCreateDeviceId, getDeviceDisplayName } from "./utils/security.js";
import { useNetworkTime, getNetworkDate } from "./utils/networkTime.js";
import { 
  Briefcase, 
  Calendar, 
  CalendarCheck,
  CheckCircle, 
  Clock, 
  FileText, 
  Key, 
  LogOut, 
  MapPin, 
  Phone, 
  QrCode, 
  RefreshCw, 
  RotateCcw, 
  DollarSign, 
  Award, 
  User as UserIcon, 
  UserPlus, 
  Users, 
  XCircle, 
  Smartphone, 
  Check, 
  AlertTriangle,
  Lock,
  ChevronRight,
  TrendingUp,
  Camera,
  Settings,
  Menu,
  Wifi,
  WifiOff,
  AlertCircle,
  HelpCircle,
  X,
  ShieldCheck,
  Zap,
  Compass,
  Copy,
  Edit2,
  Printer,
  Download,
  CreditCard,
  Crosshair,
  ExternalLink,
  Navigation,
  Trash2,
  Database,
  Server,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function App() {
  const {
    token,
    user,
    employees,
    todayAttendance,
    attendanceHistory,
    permissions,
    attendanceRequests,
    salaries,
    scores,
    qrCode,
    dashboardData,
    loading,
    error,
    login,
    logout,
    fetchProfile,
    updateProfile,
    registerEmployee,
    fetchEmployees,
    updateHourlyRate,
    updateEmployee,
    deleteEmployee,
    resetEmployeeDevice,
    fetchDashboard,
    approvePermission,
    approveAttendanceRequest,
    fetchSalaries,
    fetchTodayAttendance,
    checkIn,
    checkOut,
    fetchAttendanceHistory,
    fetchPermissions,
    submitPermission,
    fetchAttendanceRequests,
    submitAttendanceRequest,
    fetchScores,
    fetchQRCode,
    regenerateQRCode,
    siteSettings,
    fetchSiteSettings,
    updateSiteSettings,
    captureOfficeNetwork,
    checkSetup,
    setupAdmin,
    resetSystemToBootstrap,
    databaseConnected,
    databaseError,
    databaseLoading,
    setupDatabaseConnection,
    testMysqlConnection,
    missingCheckouts,
    attendanceCorrections,
    attendanceAuditLogs,
    attendanceStatus,
    overtimeStats,
    effectiveWorkStatus,
    fetchMissingCheckouts,
    fetchAttendanceCorrections,
    correctMissingCheckout,
    fetchAttendanceAuditLogs,
    fetchAttendanceStatus,
    fetchWorkCalendar,
    fetchHolidays,
    fetchWorkCalendarStatus,
    fetchOvertimeStats,
    fetchOvertimeRecords,
    penaltyStats,
    fetchPenalties,
    fetchPayslip,
    disburseSalary,
    updateCompensation,
    mySalary,
    fetchMySalary
  } = useAppStore();

  // Real-time synchronization via Server-Sent Events (SSE)
  const realtimeSync = useRealtimeSync();

  // Salary & Overtime Modal states
  const [selectedPayslip, setSelectedPayslip] = useState<EnterprisePayslip | null>(null);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState<boolean>(false);
  const [selectedOvertimeRecord, setSelectedOvertimeRecord] = useState<SalaryPayment | null>(null);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState<boolean>(false);
  const [selectedCompensationEmployee, setSelectedCompensationEmployee] = useState<User | null>(null);
  const [isCompensationModalOpen, setIsCompensationModalOpen] = useState<boolean>(false);
  const [loadingPayslipUserId, setLoadingPayslipUserId] = useState<number | null>(null);

  const handleViewPayslip = async (targetUserId: number) => {
    setLoadingPayslipUserId(targetUserId);
    try {
      const payslipData = await fetchPayslip(targetUserId, salaryFilter);
      if (payslipData) {
        setSelectedPayslip(payslipData);
        setIsPayslipModalOpen(true);
      } else {
        triggerNotification("error", "Could not load itemized payslip. Please try again.");
      }
    } catch (err) {
      triggerNotification("error", "Error loading payslip");
    } finally {
      setLoadingPayslipUserId(null);
    }
  };

  // Navigation states
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileTab, setMobileTab] = useState<string>("mobile-home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isMissingCheckoutModalOpen, setIsMissingCheckoutModalOpen] = useState<boolean>(false);
  const [missingCheckoutInitialId, setMissingCheckoutInitialId] = useState<number | null>(null);
  const [missingCheckoutInitialTab, setMissingCheckoutInitialTab] = useState<"requests" | "unclosed" | "payroll" | "audit" | "my-unclosed" | "my-requests" | null>(null);

  // Ethiopian calendar month names (13 months)
  const ETHIOPIAN_MONTH_NAMES = [
    "",
    "Meskerem",
    "Tekemt",
    "Hedar",
    "Tahsas",
    "Ter",
    "Yakatit",
    "Megabit",
    "Miazia",
    "Genbot",
    "Sene",
    "Hamle",
    "Nehase",
    "Pagume"
  ];

  // Helper to get Year, Month, Day in Addis Ababa timezone
  const getAddisAbabaYMD = (date: Date = getNetworkDate()): { year: number, month: number, day: number } => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Addis_Ababa',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(date);
    
    let year = 0, month = 0, day = 0;
    for (const part of parts) {
      if (part.type === 'year') year = parseInt(part.value, 10);
      if (part.type === 'month') month = parseInt(part.value, 10);
      if (part.type === 'day') day = parseInt(part.value, 10);
    }
    return { year, month, day };
  };

  // Convert a date to Ethiopian Calendar date string (YYYY-MM-DD format)
  const getEthiopianDateString = (date: Date = getNetworkDate()): string => {
    try {
      const g = getAddisAbabaYMD(date);
      const [ey, em, ed] = toEthiopian(g.year, g.month, g.day);
      const mm = String(em).padStart(2, "0");
      const dd = String(ed).padStart(2, "0");
      return `${ey}-${mm}-${dd}`;
    } catch (err) {
      console.error("Error converting date to Ethiopian calendar:", err);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Addis_Ababa',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(date);
    }
  };

  const getEthiopianTimeString = (date: Date = getNetworkDate()): string => {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const formatted = formatter.format(date);
      const parts = formatted.split(":");
      const h = parseInt(parts[0], 10);
      const m = parts[1];
      const s = parts[2];
      
      const ethH = (h - 6 + 24) % 24;
      return `${String(ethH).padStart(2, "0")}:${m}:${s}`;
    } catch (err) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      return formatter.format(date);
    }
  };

  const getEthiopianLocalClockTimeString = (date: Date = getNetworkDate()): string => {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const formatted = formatter.format(date);
      const parts = formatted.split(":");
      const h = parseInt(parts[0], 10);
      const m = parts[1];
      const s = parts[2];
      
      const ethH = (h - 6 + 24) % 24;
      const displayH = ethH % 12 === 0 ? 12 : ethH % 12;
      return `${String(displayH).padStart(2, "0")}:${m}:${s}`;
    } catch (err) {
      return getEthiopianTimeString(date);
    }
  };

  const getEthiopianTimePeriod = (date: Date = getNetworkDate()): string => {
    try {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Addis_Ababa',
        hour: '2-digit',
        hour12: false
      });
      const h = parseInt(formatter.format(date), 10);
      const ethH = (h - 6 + 24) % 24;
      if (ethH >= 0 && ethH < 6) return "Tewat (ጠዋት / Morning)";
      if (ethH >= 6 && ethH < 12) return "Kese'at (ከሰዓት / Afternoon)";
      if (ethH >= 12 && ethH < 18) return "Mishit (ምሽት / Evening)";
      return "Lelit (ሌሊት / Night)";
    } catch (err) {
      return "";
    }
  };

  const getEthiopianNiceDateString = (date: Date = getNetworkDate()): string => {
    try {
      const g = getAddisAbabaYMD(date);
      const [ey, em, ed] = toEthiopian(g.year, g.month, g.day);
      const monthName = ETHIOPIAN_MONTH_NAMES[em] || "";
      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Addis_Ababa',
        weekday: 'long'
      }).format(date);
      return `${weekday}, ${monthName} ${ed}, ${ey} E.C.`;
    } catch (err) {
      console.error("Error formatting nice Ethiopian date:", err);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Addis_Ababa',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return formatter.format(date);
    }
  };

  // Helper to format registration date to Ethiopian Calendar nicely (prevents double conversion)
  const getEthiopianFormattedDateString = (dateStr: string): string => {
    try {
      if (!dateStr) return "";
      return gregorianToEthiopianDate(dateStr).formattedEn;
    } catch (e) {
      return dateStr;
    }
  };

  // Authoritative Network-provided Time hook synchronized with backend server
  const {
    currentTime,
    isNetworkSynced,
    syncStatus,
    offsetMs: networkOffsetMs,
    rttMs: networkLatencyMs,
    resync: resyncNetworkTime
  } = useNetworkTime();

  // Database first-time setup state
  const [isDbEmpty, setIsDbEmpty] = useState<boolean>(false);
  const [setupName, setSetupName] = useState("");
  const [setupPhone, setSetupPhone] = useState("");
  const [setupPass, setSetupPass] = useState("");
  const [setupCompany, setSetupCompany] = useState("");
  const [setupRole, setSetupRole] = useState<"Bootstrap" | "AdminCreator" | "SuperAdmin">("Bootstrap");
  const [setupErr, setSetupErr] = useState("");

  // Database connection setup states (for initial connection or degraded mode)
  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("3306");
  const [dbUser, setDbUser] = useState("");
  const [dbPassword, setDbPassword] = useState("");
  const [dbName, setDbName] = useState("buildtrack_ams");
  const [dbTesting, setDbTesting] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);
  const [showCpanelGuide, setShowCpanelGuide] = useState(false);

  const handleTestDatabaseConnection = async () => {
    setDbTesting(true);
    setDbTestResult(null);
    try {
      const res = await testMysqlConnection({
        host: dbHost.trim() || "localhost",
        port: parseInt(dbPort, 10) || 3306,
        user: dbUser.trim() || "root",
        password: dbPassword,
        database: dbName.trim() || "buildtrack_ams"
      });
      if (res.success) {
        setDbTestResult({
          success: true,
          message: `Connection successful! (${res.version || "MySQL"}, ${res.latencyMs || 0}ms latency)`,
          version: res.version
        });
      } else {
        setDbTestResult({
          success: false,
          message: res.error || "Connection failed. Please check host, port, user and password."
        });
      }
    } catch (e: any) {
      setDbTestResult({
        success: false,
        message: e.message || "Connection failed."
      });
    } finally {
      setDbTesting(false);
    }
  };

  const handleSaveDatabaseConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbTestResult(null);
    const res = await setupDatabaseConnection({
      host: dbHost.trim() || "localhost",
      port: parseInt(dbPort, 10) || 3306,
      user: dbUser.trim() || "root",
      password: dbPassword,
      database: dbName.trim() || "buildtrack_ams"
    });
    if (res.success) {
      triggerNotification("success", "Database connected successfully!");
      const empty = await checkSetup();
      setIsDbEmpty(empty);
    } else {
      triggerNotification("error", res.error || "Database connection failed");
    }
  };

  useEffect(() => {
    const runCheck = async () => {
      const empty = await checkSetup();
      setIsDbEmpty(empty);
    };
    runCheck();
  }, [checkSetup]);
  
  // Geofencing and Wi-Fi Compliance Settings states
  const [editOfficeName, setEditOfficeName] = useState("Main Head Office");
  const [isEditingHeaderTitle, setIsEditingHeaderTitle] = useState(false);
  const [tempHeaderTitle, setTempHeaderTitle] = useState("");
  const [editLatitude, setEditLatitude] = useState("9.0227");
  const [editLongitude, setEditLongitude] = useState("38.7460");
  const [editWifiSsid, setEditWifiSsid] = useState("Apex_HQ_WiFi");
  const [editWifiBssid, setEditWifiBssid] = useState("00:11:22:33:44:55");
  const [editAllowedRadius, setEditAllowedRadius] = useState("30");
  const [editExtendedRadius, setEditExtendedRadius] = useState("60");
  const [editWifiIp, setEditWifiIp] = useState("");
  const [editUseWifi, setEditUseWifi] = useState(true);

  // Multi-step GPS accuracy status overlay
  const [gpsAccuracyStatus, setGpsAccuracyStatus] = useState<{
    stage: "idle" | "acquiring" | "waiting_better_signal" | "poor_rejected" | "acquired";
    accuracy?: number;
    message?: string;
    tier?: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  }>({ stage: "idle" });

  // Public IP tracking for auto-compliance verification
  const [currentPublicIp, setCurrentPublicIp] = useState<string>("");
  const [isScanningQR, setIsScanningQR] = useState(false);
  const [isCheckoutScan, setIsCheckoutScan] = useState(false);
  const [pendingLocData, setPendingLocData] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isRegenerateModalOpen, setIsRegenerateModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateSuccessInfo, setRegenerateSuccessInfo] = useState<{ qr_id: string } | null>(null);
  
  // GPS Error Modal state for mismatch assistance
  const [gpsErrorModalData, setGpsErrorModalData] = useState<{
    error: string;
    distance?: number;
    accuracy?: number;
    allowed_radius?: number;
    detected_latitude?: number;
    detected_longitude?: number;
    office_latitude?: number;
    office_longitude?: number;
    session?: "Morning" | "Afternoon";
    isCheckout?: boolean;
    decodedText?: string;
  } | null>(null);

  // Office GPS calibration states
  const [isDetectingOfficeGps, setIsDetectingOfficeGps] = useState(false);
  const [detectOfficeGpsStatus, setDetectOfficeGpsStatus] = useState<string | null>(null);
  const [isCapturingNetwork, setIsCapturingNetwork] = useState(false);
  const [captureNetworkStatus, setCaptureNetworkStatus] = useState<string | null>(null);
  const [testDistanceResult, setTestDistanceResult] = useState<{
    distance: number;
    inside: boolean;
    accuracy?: number;
    message: string;
  } | null>(null);

  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const triggerNotification = (type: "success" | "error" | "info", msg: string) => {
    setNotification({ type, message: msg });
    // Automatically dismiss after 6 seconds
    setTimeout(() => {
      setNotification(prev => prev?.message === msg ? null : prev);
    }, 6000);
  };
  
  // Login input states
  const [loginPhone, setLoginPhone] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginErr, setLoginErr] = useState<string>("");

  // Filters
  const [dashboardFilter, setDashboardFilter] = useState<string>("Month");
  const [salaryFilter, setSalaryFilter] = useState<string>("Monthly");
  const [feedFilter, setFeedFilter] = useState<"All" | "Present" | "Working Overtime" | "Late" | "Absent" | "Permission">("All");

  // Registration states
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regRate, setRegRate] = useState("25.00");
  const [regRole, setRegRole] = useState<string>("Employee");
  const [regSuccessMsg, setRegSuccessMsg] = useState("");
  const [regErrorMsg, setRegErrorMsg] = useState("");

  useEffect(() => {
    if (user?.role === "Bootstrap") {
      setRegRole("AdminCreator");
      setActiveTab("registration");
    } else {
      setRegRole("Employee");
    }
  }, [user?.role]);

  // Employee Edit states
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpPhone, setEditEmpPhone] = useState("");
  const [editEmpRole, setEditEmpRole] = useState<string>("Employee");
  const [editEmpRate, setEditEmpRate] = useState("");
  const [editEmpPass, setEditEmpPass] = useState("");

  // Profile Edit states
  const [profName, setProfName] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profCurrentPass, setProfCurrentPass] = useState("");
  const [profNewPass, setProfNewPass] = useState("");
  const [profConfirmPass, setProfConfirmPass] = useState("");
  const [profPhoto, setProfPhoto] = useState("");
  const [profSuccess, setProfSuccess] = useState(false);

  // Leave Form states
  const [leaveType, setLeaveType] = useState<"Permission" | "Sick Leave" | "Annual Leave">("Permission");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveSession, setLeaveSession] = useState<"Full Day" | "Morning" | "Afternoon">("Full Day");
  const [leaveSuccess, setLeaveSuccess] = useState(false);

  // Attendance Request Form states
  const [reqType, setReqType] = useState<"Site Visit" | "External Work" | "Purchaser Visit">("Site Visit");
  const [reqDate, setReqDate] = useState("");
  const [reqIn, setReqIn] = useState("");
  const [reqOut, setReqOut] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [reqSession, setReqSession] = useState<"Full Day" | "Morning" | "Afternoon">("Full Day");
  const [reqScope, setReqScope] = useState<"Full Shift" | "Site Check-Out">("Full Shift");
  const [reqSuccess, setReqSuccess] = useState(false);

  // Approval Modal states (Admin sets approved range)
  const [selectedPermission, setSelectedPermission] = useState<any>(null);
  const [appFromDate, setAppFromDate] = useState("");
  const [appToDate, setAppToDate] = useState("");

  // Hourly Rate Edit states
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState("");

  // Selected Employee Details Modal
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [selectedEmployeeTab, setSelectedEmployeeTab] = useState<"today" | "weekly" | "monthly" | "yearly">("today");
  const [selectedDetailMonth, setSelectedDetailMonth] = useState<string>("");
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState<"All" | "Present" | "Late" | "Absent" | "Permission">("All");
  const [modalCustomRate, setModalCustomRate] = useState<string>("");

  // Delete Employee Confirmation state
  const [deletingEmployee, setDeletingEmployee] = useState<{ id: number; fullName: string } | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  // Reset Device Binding Confirmation state
  const [resettingDeviceEmployee, setResettingDeviceEmployee] = useState<{ id: number; fullName: string } | null>(null);
  const [isResettingDeviceLoading, setIsResettingDeviceLoading] = useState(false);

  // Camera Scan state simulation
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");

  // On initial mount or auth change
  useEffect(() => {
    if (token) {
      fetchProfile().then((isValid) => {
        if (!isValid) return;

        fetchTodayAttendance();
        fetchAttendanceHistory();
        fetchPermissions();
        fetchAttendanceRequests();
        fetchScores();
        fetchQRCode();
        fetchSiteSettings();
        fetchMissingCheckouts();
        fetchAttendanceCorrections();
        fetchAttendanceStatus();
        fetchWorkCalendarStatus();
        fetchWorkCalendar();
        fetchHolidays();

        const currentUser = useAppStore.getState().user;
        const adminRoles = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"];
        if (currentUser?.role && adminRoles.includes(currentUser.role)) {
          fetchEmployees();
          fetchDashboard(dashboardFilter);
          fetchSalaries(salaryFilter);
          fetchAttendanceAuditLogs();
          fetchOvertimeStats();
          fetchOvertimeRecords();
          fetchPenalties();
        }
      });
    }
  }, [token]);

  // Sync site settings state variables
  useEffect(() => {
    if (siteSettings) {
      setEditOfficeName(siteSettings.office_name || "Apex Head Office");
      setEditLatitude(siteSettings.latitude?.toString() || "9.0227");
      setEditLongitude(siteSettings.longitude?.toString() || "38.7460");
      setEditWifiSsid(siteSettings.office_wifi_ssid || siteSettings.wifi_ssid || "Apex_HQ_WiFi");
      setEditWifiBssid(siteSettings.office_wifi_bssid || "00:11:22:33:44:55");
      setEditAllowedRadius(siteSettings.allowed_radius?.toString() || "30");
      setEditExtendedRadius(siteSettings.extended_radius?.toString() || "60");
      setEditWifiIp(siteSettings.wifi_ip || "");
      setEditUseWifi(siteSettings.use_wifi_verification === 1);
    }
  }, [siteSettings]);

  // Sync profile fields
  useEffect(() => {
    if (user) {
      setProfName(user.full_name);
      setProfPhone(user.phone_number);
      setProfPhoto(user.photo || "");
    }
  }, [user]);

  // Fetch client's public IP address automatically for compliance checks
  useEffect(() => {
    fetch("/api/client-ip")
      .then(async (r) => {
        if (!r.ok) return null;
        try {
          return await r.json();
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (data && data.ip) {
          setCurrentPublicIp(data.ip);
        }
      })
      .catch((err) => console.warn("Could not auto-fetch client IP:", err));
  }, []);

  // Handle dashboard filter change
  const handleDashboardFilterChange = (filter: string) => {
    setDashboardFilter(filter);
    fetchDashboard(filter);
  };

  // Handle salary filter change
  const handleSalaryFilterChange = (filter: string) => {
    setSalaryFilter(filter);
    fetchSalaries(filter);
  };

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    if (!loginPhone || !loginPassword) {
      setLoginErr("Please fill in both phone number and password");
      return;
    }
    const ok = await login(loginPhone, loginPassword);
    if (!ok) {
      setLoginErr(error || "Invalid phone number or password");
    }
  };

  // Handle first-time Admin Setup submission
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupErr("");
    if (!setupName || !setupPhone || !setupPass) {
      setSetupErr("All required fields must be filled");
      return;
    }
    const ok = await setupAdmin(setupName, setupPhone, setupPass, setupCompany, setupRole);
    if (!ok) {
      setSetupErr(error || "Failed to setup account");
    } else {
      setIsDbEmpty(false);
      const roleLabel = setupRole === "Bootstrap" ? "Bootstrap Creator" : setupRole === "AdminCreator" ? "Admin Creator" : "Super Admin";
      triggerNotification("success", `${roleLabel} account created successfully!`);
    }
  };

  // Handle Registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSuccessMsg("");
    setRegErrorMsg("");

    if (!regName || !regPhone || !regPass) {
      setRegErrorMsg("All fields are required");
      return;
    }

    const res = await registerEmployee({
      full_name: regName,
      phone_number: regPhone,
      role: regRole,
      password: regPass,
      hourly_rate: parseFloat(regRate)
    });

    if (res.success) {
      setRegSuccessMsg(`${regRole} successfully registered!`);
      setRegName("");
      setRegPhone("");
      setRegPass("");
      setRegRate("25.00");
      setRegRole(user?.role === "Bootstrap" ? "AdminCreator" : "Employee");
    } else {
      setRegErrorMsg(res.error || "Failed to register employee");
    }
  };

  // Handle Profile Save
  const handleProfileUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfSuccess(false);

    if (profNewPass || profCurrentPass || profConfirmPass) {
      if (!profCurrentPass) {
        triggerNotification("error", "Current password required to save changes.");
        return;
      }
      if (profNewPass !== profConfirmPass) {
        triggerNotification("error", "New passwords do not match.");
        return;
      }
      if (profNewPass.length < 4) {
        triggerNotification("error", "New password must be at least 4 characters long.");
        return;
      }
    }

    const ok = await updateProfile({
      full_name: profName,
      phone_number: profPhone,
      current_password: profCurrentPass || undefined,
      new_password: profNewPass || undefined,
      photo: profPhoto || undefined
    });
    if (ok) {
      setProfSuccess(true);
      setProfCurrentPass("");
      setProfNewPass("");
      setProfConfirmPass("");
      triggerNotification("success", "Profile updated successfully!");
      setTimeout(() => setProfSuccess(false), 4000);
    } else {
      triggerNotification("error", "Profile update failed.");
    }
  };

  // Handle Leave Submission
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveReason || !leaveStart || !leaveEnd) {
      triggerNotification("error", "Please fill in all leave request fields.");
      return;
    }
    const res = await submitPermission({
      request_type: leaveType,
      reason: leaveReason,
      start_date: leaveStart,
      end_date: leaveEnd,
      session: leaveType === "Permission" ? leaveSession : "Full Day"
    });
    if (res.success) {
      setLeaveSuccess(true);
      setLeaveReason("");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveSession("Full Day");
      triggerNotification("success", "Leave request submitted successfully!");
      setTimeout(() => setLeaveSuccess(false), 4000);
    } else {
      triggerNotification("error", res.error || "Failed to submit leave request.");
    }
  };

  // Handle Attendance Request Submission
  const handleAttendanceRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDate || !reqReason) {
      triggerNotification("error", "Please fill in date and reason.");
      return;
    }
    if (reqScope === "Full Shift" && (!reqIn || !reqOut)) {
      triggerNotification("error", "Please specify both Check-In and Check-Out times for full shift external work.");
      return;
    }
    if (reqScope === "Site Check-Out" && !reqOut) {
      triggerNotification("error", "Please specify your Check-Out time from the site.");
      return;
    }

    const res = await submitAttendanceRequest({
      type: reqType,
      date: reqDate,
      check_in_time: reqScope === "Site Check-Out" ? "02:00:00" : (reqIn + ":00"),
      check_out_time: reqOut + ":00",
      reason: reqReason,
      session: reqSession,
      request_scope: reqScope
    });
    if (res.success) {
      setReqSuccess(true);
      setReqDate("");
      setReqIn("");
      setReqOut("");
      setReqReason("");
      setReqScope("Full Shift");
      setReqSession("Full Day");
      triggerNotification("success", "Adjustment request submitted successfully!");
      setTimeout(() => setReqSuccess(false), 4000);
    } else {
      triggerNotification("error", res.error || "Failed to submit adjustment request.");
    }
  };

  // Handle Permission Approval (Admin clicks Approve)
  const handlePermissionApprovalSubmit = async (status: "Approved" | "Rejected") => {
    if (!selectedPermission) return;
    const ok = await approvePermission(
      selectedPermission.id,
      status,
      status === "Approved" ? appFromDate : undefined,
      status === "Approved" ? appToDate : undefined
    );
    if (ok) {
      setSelectedPermission(null);
      setAppFromDate("");
      setAppToDate("");
      triggerNotification("success", `Request has been marked as ${status}.`);
    } else {
      triggerNotification("error", "Failed to submit approval update.");
    }
  };

  // High-speed, high-accuracy GPS acquisition helper with intelligent fallback
  const acquireHighAccuracyGps = async (): Promise<GeolocationPosition> => {
    setGpsAccuracyStatus({ stage: "acquiring", message: "Acquiring GPS fix..." });

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser.");
    }

    return new Promise<GeolocationPosition>((resolve, reject) => {
      // 1. First attempt: Fast high-accuracy fix with 3.5s timeout and 8s cache allowance
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const acc = Math.round(pos.coords.accuracy);
          const tier = acc <= 25 ? "EXCELLENT" : acc <= 50 ? "GOOD" : "FAIR";
          setGpsAccuracyStatus({
            stage: "acquired",
            accuracy: acc,
            tier,
            message: `GPS Ready (±${acc}m)`
          });
          resolve(pos);
        },
        (err) => {
          if (err.code === 1) {
            reject(new Error("Location permission denied. Please enable location permissions in your browser."));
            return;
          }
          // 2. Fallback: standard accuracy fix with 2.5s timeout
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const acc = Math.round(fallbackPos.coords.accuracy);
              setGpsAccuracyStatus({
                stage: "acquired",
                accuracy: acc,
                tier: "FAIR",
                message: `GPS Ready (±${acc}m)`
              });
              resolve(fallbackPos);
            },
            () => {
              setGpsAccuracyStatus({
                stage: "poor_rejected",
                message: "Unable to retrieve GPS signal."
              });
              reject(new Error("Unable to retrieve GPS signal. Please ensure location is enabled on your device."));
            },
            { enableHighAccuracy: false, timeout: 2500, maximumAge: 15000 }
          );
        },
        { enableHighAccuracy: true, timeout: 3500, maximumAge: 8000 }
      );
    });
  };

  // Real check-in requiring QR code scan & GPS geofencing verification
  const handleRealScan = async (session?: "Morning" | "Afternoon") => {
    // Launch QR Scanner directly with background GPS geofence acquisition
    await startGpsAndQR(undefined, session, false);
  };

  // Helper to trigger QR scanner launch with background high-accuracy GPS acquisition
  const startGpsAndQR = async (wifi_ip: string | undefined, session: any, isCheckout: boolean) => {
    setIsScanning(false);
    setIsCheckoutScan(isCheckout);
    setIsScanningQR(true);

    const deviceId = getOrCreateDeviceId();
    const deviceName = getDeviceDisplayName();

    // Acquire/warm GPS fix in parallel so it's ready when scan occurs
    acquireHighAccuracyGps().then((pos) => {
      setPendingLocData({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        device_id: deviceId,
        device_name: deviceName,
        session
      });
    }).catch((err) => {
      console.warn("Background GPS warming warning:", err);
    });
  };

  // Real check-out requiring QR code scan & GPS geofencing verification
  const handleRealCheckOut = async (session?: "Morning" | "Afternoon") => {
    // Launch QR Scanner directly with background GPS geofence acquisition
    await startGpsAndQR(undefined, session, true);
  };

  const handleQRScanSuccess = async (decodedText: string) => {
    setIsScanningQR(false);
    setIsScanning(true);
    setScanMessage("Verifying Office QR & GPS Boundary...");

    const targetSsid = siteSettings?.office_wifi_ssid || siteSettings?.wifi_ssid || editWifiSsid || "Apex_HQ_WiFi";
    let locData = pendingLocData;

    // If GPS is still resolving, finish acquiring quickly
    if (!locData || !locData.latitude) {
      try {
        const pos = await acquireHighAccuracyGps();
        locData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          wifi_ip: currentPublicIp || undefined,
          wifi_ssid: targetSsid,
          device_id: getOrCreateDeviceId(),
          device_name: getDeviceDisplayName(),
          session: pendingLocData?.session
        };
      } catch (err: any) {
        setIsScanning(false);
        triggerNotification("error", err.message || "GPS coordinates required for verification.");
        return;
      }
    }

    const res = isCheckoutScan 
      ? await checkOut(decodedText, locData)
      : await checkIn(decodedText, locData);

    setIsScanning(false);
    setPendingLocData(null);

    if (res.success) {
      fetchAttendanceStatus();
      fetchMissingCheckouts();
      fetchTodayAttendance();
      triggerNotification(
        "success", 
        `${isCheckoutScan ? "Checked Out" : "Checked In"} Successfully! (${res.verification_method || "QR_GPS"}${res.distance !== null && res.distance !== undefined ? `, Distance: ${res.distance}m` : ""})`
      );
    } else {
      // Handle Missing Checkout Lock
      if (res.code === "MISSING_CHECKOUT_LOCKED") {
        fetchAttendanceStatus();
        fetchMissingCheckouts();
        setIsMissingCheckoutModalOpen(true);
        triggerNotification("error", res.error || "Check-in blocked: You have an open attendance record from a previous day. Please request admin correction.");
        return;
      }

      // Handle Already Checked In
      if (res.code === "ALREADY_CHECKED_IN") {
        fetchAttendanceStatus();
        triggerNotification("error", res.error || "You are already checked in for today. Please proceed to check out when leaving.");
        return;
      }

      // Trigger rich GPS resolution modal if outside geofence boundary
      if (res.code === "GPS_OUTSIDE_BOUNDARY" || (res.distance !== undefined && res.distance > (res.allowed_radius || 50))) {
        setGpsErrorModalData({
          error: res.error || "You are outside the office perimeter.",
          distance: res.distance,
          accuracy: res.accuracy || locData.accuracy,
          allowed_radius: res.allowed_radius || 50,
          detected_latitude: res.detected_latitude || locData.latitude,
          detected_longitude: res.detected_longitude || locData.longitude,
          office_latitude: res.office_latitude || (typeof siteSettings?.latitude === "number" ? siteSettings.latitude : parseFloat(siteSettings?.latitude || editLatitude)),
          office_longitude: res.office_longitude || (typeof siteSettings?.longitude === "number" ? siteSettings.longitude : parseFloat(siteSettings?.longitude || editLongitude)),
          session: locData.session,
          isCheckout: isCheckoutScan,
          decodedText
        });
      }
      triggerNotification("error", res.error || "Verification failed.");
    }
  };

  // Helper for computing distance locally for calibration testing
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Auto-detect current device location for office geofence calibration
  const handleDetectOfficeLocation = () => {
    setIsDetectingOfficeGps(true);
    setDetectOfficeGpsStatus("Accessing device satellite GPS hardware...");
    setTestDistanceResult(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setIsDetectingOfficeGps(false);
      setDetectOfficeGpsStatus("Geolocation not supported by browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingOfficeGps(false);
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        const acc = Math.round(pos.coords.accuracy);

        setEditLatitude(lat);
        setEditLongitude(lon);
        setDetectOfficeGpsStatus(`✓ Real GPS Captured: ${lat}, ${lon} (Hardware Accuracy: ±${acc}m)`);
        triggerNotification("success", `Captured device GPS (${lat}, ${lon}, ±${acc}m accuracy)`);
      },
      (err) => {
        setIsDetectingOfficeGps(false);
        const msg = err.code === 1 
          ? "Permission denied. Please allow browser location access." 
          : "Unable to retrieve device GPS coordinates.";
        setDetectOfficeGpsStatus(`Error: ${msg}`);
        triggerNotification("error", msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Test distance between current device and the values typed in the form
  const handleTestCurrentDistance = () => {
    const targetLat = parseFloat(editLatitude);
    const targetLon = parseFloat(editLongitude);
    const allowedRad = parseFloat(editAllowedRadius) || 30;

    if (isNaN(targetLat) || isNaN(targetLon)) {
      triggerNotification("error", "Please enter valid office latitude and longitude numbers first.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      triggerNotification("error", "Geolocation not supported.");
      return;
    }

    triggerNotification("success", "Measuring distance to configured office coordinates...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLat = pos.coords.latitude;
        const currentLon = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy);
        const dist = calculateHaversineDistance(currentLat, currentLon, targetLat, targetLon);
        const inside = dist <= allowedRad;

        setTestDistanceResult({
          distance: dist,
          inside,
          accuracy: acc,
          message: inside 
            ? `Device is ${dist}m away from Office (INSIDE the ${allowedRad}m perimeter). Perfect! ✓`
            : `Device is ${dist}m away from Office (OUTSIDE the ${allowedRad}m perimeter). ⚠️`
        });
      },
      (err) => {
        triggerNotification("error", "Failed to get current GPS to test distance.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Auto-capture current connected office Wi-Fi network (public IP / network signature)
  const handleCaptureOfficeNetwork = async () => {
    setIsCapturingNetwork(true);
    setCaptureNetworkStatus("Detecting office network public IP...");
    try {
      const res = await captureOfficeNetwork();
      if (res.success && res.captured_ip) {
        setEditWifiIp(res.captured_ip);
        setCaptureNetworkStatus(`✓ Office Wi-Fi Network Captured: ${res.captured_ip}`);
        triggerNotification("success", `Captured Office Network IP (${res.captured_ip}). Priority 1 Wi-Fi direct verification is ready!`);
      } else {
        setCaptureNetworkStatus(`Failed: ${res.error || "Could not detect IP"}`);
        triggerNotification("error", res.error || "Failed to capture network IP.");
      }
    } catch (err: any) {
      setCaptureNetworkStatus(`Error: ${err.message || "Failed to capture network"}`);
      triggerNotification("error", "Error capturing network IP.");
    } finally {
      setIsCapturingNetwork(false);
    }
  };

  // Format attendance score rating description
  const getRating = (score: number, totalAttendances?: number) => {
    if (score === 0 || (totalAttendances !== undefined && totalAttendances === 0)) {
      return { text: "No Attendance / Absent", color: "text-slate-600 bg-slate-100 border-slate-200" };
    }
    if (score >= 90) return { text: "Excellent", color: "text-emerald-600 bg-emerald-50 border-emerald-200" };
    if (score >= 75) return { text: "Good", color: "text-blue-600 bg-blue-50 border-blue-200" };
    if (score >= 50) return { text: "Fair", color: "text-amber-600 bg-amber-50 border-amber-200" };
    return { text: "Needs Improvement", color: "text-rose-600 bg-rose-50 border-rose-200" };
  };

  // Dynamic status pill style
  const getStatusPill = (status: string) => {
    switch (status) {
      case "Approved":
        return "text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1";
      case "Rejected":
        return "text-rose-700 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1";
      default:
        return "text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1";
    }
  };

  // Helper to render high-contrast GPS calibration and error modal
  const renderGpsErrorModal = () => {
    if (!gpsErrorModalData) return null;

    const isAdmin = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap"].includes(user?.role || "");

    return (
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl text-slate-800 border border-slate-100 space-y-5">
          
          {/* Header */}
          <div className="flex justify-between items-start pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                <MapPin size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                  Office Geofence Perimeter Check
                </h3>
                <p className="text-xs text-rose-600 font-bold">
                  Distance: {gpsErrorModalData.distance !== undefined ? `${gpsErrorModalData.distance.toFixed(1)}m away` : "Out of bounds"} (Allowed: {gpsErrorModalData.allowed_radius || 50}m)
                </p>
              </div>
            </div>
            <button
              onClick={() => setGpsErrorModalData(null)}
              className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Coordinates Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                📱 Your Phone's Real Satellite GPS
              </span>
              <div className="font-mono font-bold text-slate-800 text-xs">
                {gpsErrorModalData.detected_latitude?.toFixed(6) || "Unknown"}, {gpsErrorModalData.detected_longitude?.toFixed(6) || "Unknown"}
              </div>
              {gpsErrorModalData.accuracy && (
                <span className="text-[10px] text-emerald-600 font-bold block">
                  ✓ Hardware Precision: ±{gpsErrorModalData.accuracy.toFixed(0)}m
                </span>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                🏢 Configured Office Coordinates
              </span>
              <div className="font-mono font-bold text-slate-800 text-xs">
                {gpsErrorModalData.office_latitude?.toFixed(6) || editLatitude}, {gpsErrorModalData.office_longitude?.toFixed(6) || editLongitude}
              </div>
              <span className="text-[10px] text-amber-600 font-bold block">
                Target Office Center
              </span>
            </div>
          </div>

          {/* Root Cause Explanation */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs space-y-2 text-amber-900">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle size={15} className="shrink-0 text-amber-600" />
              Why did this happen? (IP Location vs. Real GPS)
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800/90 font-medium">
              The office coordinates currently configured in settings (<code>{gpsErrorModalData.office_latitude?.toFixed(4) || "9.0245"}, {gpsErrorModalData.office_longitude?.toFixed(4) || "38.7485"}</code>) were taken from an <strong>IP lookup website (mylocation.org)</strong>, which only points to the Ethio Telecom central routing exchange in Addis Ababa (~7km away). Your phone's real satellite GPS chip is detecting your physical building at its true location.
            </p>
          </div>

          {/* Quick calibration for Admins */}
          {isAdmin && gpsErrorModalData.detected_latitude && gpsErrorModalData.detected_longitude && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-blue-600" />
                Admin 1-Click Fix: Are you physically in the office now?
              </div>
              <p className="text-[11px] text-blue-800/90 leading-relaxed font-medium">
                Click below to instantly calibrate the office geofence to your current coordinates:
              </p>
              <button
                type="button"
                onClick={async () => {
                  const newLat = gpsErrorModalData.detected_latitude!;
                  const newLon = gpsErrorModalData.detected_longitude!;
                  const ok = await updateSiteSettings({
                    latitude: newLat,
                    longitude: newLon
                  });
                  if (ok) {
                    setEditLatitude(newLat.toString());
                    setEditLongitude(newLon.toString());
                    triggerNotification("success", `Office location calibrated to ${newLat.toFixed(5)}, ${newLon.toFixed(5)}! Retrying verification...`);
                    
                    const session = gpsErrorModalData.session;
                    const isCheckout = gpsErrorModalData.isCheckout;
                    const decodedText = gpsErrorModalData.decodedText;
                    setGpsErrorModalData(null);

                    if (decodedText) {
                      const locData = {
                        latitude: newLat,
                        longitude: newLon,
                        accuracy: gpsErrorModalData.accuracy || 15,
                        device_id: getOrCreateDeviceId(),
                        session
                      };
                      const res = isCheckout ? await checkOut(decodedText, locData) : await checkIn(decodedText, locData);
                      if (res.success) {
                        triggerNotification("success", `${isCheckout ? "Checked Out" : "Checked In"} Successfully! (${res.verification_method || "QR_GPS"}, Distance: ${res.distance || 0}m)`);
                      }
                    }
                  } else {
                    triggerNotification("error", "Failed to update office coordinates.");
                  }
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MapPin size={15} /> Set Office Location to My Current GPS ({gpsErrorModalData.detected_latitude.toFixed(5)}, {gpsErrorModalData.detected_longitude.toFixed(5)})
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {gpsErrorModalData.detected_latitude && gpsErrorModalData.detected_longitude && (
              <a
                href={`https://www.google.com/maps?q=${gpsErrorModalData.detected_latitude},${gpsErrorModalData.detected_longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                <ExternalLink size={14} /> View My Pin on Google Maps
              </a>
            )}
            <button
              type="button"
              onClick={() => setGpsErrorModalData(null)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    );
  };

  // --- RENDER LOGIN OR FIRST-TIME SETUP IF NOT LOGGED IN ---
  if (!token || !user) {
    return (
      <div id="login_page" className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 relative">
        <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg shadow-blue-500/20">
              <Briefcase size={28} />
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Nabi Tech PLC Attendance</h1>
            <p className="text-gray-500 text-sm mt-1">
              {!databaseConnected 
                ? "Enterprise Database Configuration" 
                : isDbEmpty 
                ? "Bootstrap Creator & System Launch" 
                : "Attendance Management Control Panel"}
            </p>
          </div>

          {!databaseConnected ? (
            <form onSubmit={handleSaveDatabaseConnection} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Database size={15} /> Database Connection Required
                </div>
                <p className="text-[11px] leading-relaxed">
                  The application server is ready, but MySQL is currently not reachable. Enter your MySQL database credentials below or configure them in your server environment (<code>.env</code>).
                </p>
                {databaseError && (
                  <div className="p-2 bg-white/90 rounded-lg border border-amber-200 font-mono text-[10px] text-rose-700 break-all">
                    {databaseError}
                  </div>
                )}
              </div>

              {dbTestResult && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  dbTestResult.success 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  {dbTestResult.success ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                  <span className="break-all">{dbTestResult.message}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-bold text-gray-700">Host</label>
                  <input
                    type="text"
                    value={dbHost}
                    onChange={(e) => setDbHost(e.target.value)}
                    placeholder="localhost or 127.0.0.1"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Port</label>
                  <input
                    type="text"
                    value={dbPort}
                    onChange={(e) => setDbPort(e.target.value)}
                    placeholder="3306"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Database Name</label>
                <input
                  type="text"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  placeholder="e.g. buildtrack_ams or cPanel DB"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Database Username</label>
                <input
                  type="text"
                  value={dbUser}
                  onChange={(e) => setDbUser(e.target.value)}
                  placeholder="e.g. root or cPanel DB user"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Database Password</label>
                <input
                  type="password"
                  value={dbPassword}
                  onChange={(e) => setDbPassword(e.target.value)}
                  placeholder="Enter database password"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={dbTesting || databaseLoading}
                  onClick={handleTestDatabaseConnection}
                  className="flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={dbTesting ? "animate-spin" : ""} />
                  {dbTesting ? "Testing..." : "Test Connection"}
                </button>
                <button
                  type="submit"
                  disabled={databaseLoading || dbTesting}
                  className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Database size={13} />
                  {databaseLoading ? "Connecting..." : "Save & Connect"}
                </button>
              </div>

              {/* Collapsible cPanel instructions */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-3">
                <button
                  type="button"
                  onClick={() => setShowCpanelGuide(!showCpanelGuide)}
                  className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 text-left text-xs font-semibold text-slate-700 flex items-center justify-between transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-slate-500" />
                    cPanel / Production Hosting Guide
                  </span>
                  {showCpanelGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showCpanelGuide && (
                  <div className="p-3 bg-white text-[11px] text-slate-600 space-y-2 border-t border-slate-100 leading-relaxed">
                    <p className="font-semibold text-slate-800">For cPanel / Shared Hosting:</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Log in to cPanel &rarr; <strong>MySQL® Databases</strong>.</li>
                      <li>Create a new database (e.g. <code>username_attendnow</code>).</li>
                      <li>Create a new database user and set a strong password.</li>
                      <li>Add user to database and grant <strong>ALL PRIVILEGES</strong>.</li>
                      <li>Enter credentials above or put them in your <code>.env</code> file:</li>
                    </ol>
                    <div className="p-2 bg-slate-900 text-slate-100 rounded-lg text-[10px] font-mono whitespace-pre overflow-x-auto">
{`MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_db_user
MYSQL_PASSWORD=your_db_password
MYSQL_DATABASE=your_db_name`}
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : isDbEmpty ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl text-xs font-semibold leading-relaxed">
                <strong>Bootstrap Creator Mode:</strong> Fresh deployment detected with no registered accounts. Configure your root administrator account below to initialize the workspace.
              </div>

              {setupErr && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm flex items-start gap-2.5">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{setupErr}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldCheck size={16} className="text-blue-600" /> Initial Administrator Role
                </label>
                <select
                  value={setupRole}
                  onChange={(e) => setSetupRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white cursor-pointer"
                >
                  <option value="Bootstrap">Bootstrap Creator (System Setup & Admin Registry)</option>
                  <option value="AdminCreator">Admin Creator (Workspace Creator & Full Operations)</option>
                  <option value="SuperAdmin">Super Administrator (Global Master Access)</option>
                </select>
                <p className="text-[11px] text-gray-500 font-medium leading-tight">
                  {setupRole === "Bootstrap"
                    ? "Bootstrap Creator mode: Launches in the Administrator Registry to register Workspace Admin accounts."
                    : setupRole === "AdminCreator"
                    ? "Admin Creator mode: Immediate full authority over attendance, staff, payroll, QR codes, and settings."
                    : "Super Administrator: Global multi-tenant master access across all company workspaces."}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <UserIcon size={16} className="text-gray-400" /> Administrator Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. System Administrator"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Briefcase size={16} className="text-gray-400" /> Organization / Company Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nabi Tech PLC"
                  value={setupCompany}
                  onChange={(e) => setSetupCompany(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Phone size={16} className="text-gray-400" /> Phone Number (Login ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 0912345678"
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <Lock size={16} className="text-gray-400" /> Password
                </label>
                <input
                  type="password"
                  placeholder="Create a secure password"
                  value={setupPass}
                  onChange={(e) => setSetupPass(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/20 active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 text-sm cursor-pointer mt-4"
              >
                <ShieldCheck size={18} />
                {setupRole === "Bootstrap" ? "Launch Bootstrap Creator" : setupRole === "AdminCreator" ? "Create Admin Creator & Launch" : "Create Super Admin & Launch"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              {loginErr && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm flex items-start gap-2.5">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{loginErr}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Phone size={16} className="text-gray-400" /> Phone Number
                </label>
                <input
                  type="text"
                  placeholder="Enter registered phone number"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Lock size={16} className="text-gray-400" /> Password
                </label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition text-sm font-semibold text-slate-900 bg-white placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Enter registered credentials to access your portal</span>
              </div>

              <button
                id="login_btn"
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-600/15 hover:shadow-blue-600/20 active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                Log In to Portal
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setLoginPhone("0911223344");
                    setLoginPassword("admin123");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
                  title="Click to fill Demo Admin credentials"
                >
                  <span className="text-slate-500">Demo Admin:</span>
                  <span className="font-mono font-bold text-blue-600">0911223344 / admin123</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- EMPLOYEE ONLY PORTAL VIEW (CENTRALIZED DEVICE ENCLOSURE FOR REALISM) ---
  const renderEmployeePortal = () => {
    const mainContent = (
      <div className="h-full bg-[#F8FAFC] flex flex-col overflow-y-auto overflow-x-hidden">
        {/* Mobile Header */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-4 bg-slate-900 text-white flex justify-between items-center shrink-0 w-full max-w-full gap-2 relative z-20">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                {user.photo ? (
                  <img src={user.photo} alt={user.full_name} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-slate-700 shrink-0" />
                ) : (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs sm:text-sm text-white shrink-0">
                    {user.full_name[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1.5 truncate">
                    <span>Welcome</span>
                    {user.workspace_name && (
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded font-black uppercase truncate">
                        {user.workspace_name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-semibold truncate">{user.full_name}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Live Real-Time SSE Sync Indicator */}
                <button
                  type="button"
                  onClick={realtimeSync.triggerManualRefresh}
                  className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:bg-slate-700 transition cursor-pointer min-h-[36px]"
                  title={`Live Sync: ${realtimeSync.status}. Click to refresh.`}
                >
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {realtimeSync.status === "CONNECTED" ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </>
                    ) : (
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400 animate-pulse"></span>
                    )}
                  </span>
                  <span className="font-semibold text-[9px] text-emerald-400 hidden xs:inline">Live</span>
                  <RefreshCw size={9} className={`text-slate-400 ${realtimeSync.status === "CONNECTING" ? "animate-spin" : ""}`} />
                </button>

                {/* Role indicator */}
                <span className="text-[9px] sm:text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded hidden sm:inline-block">
                  Site
                </span>
                <button 
                  onClick={logout} 
                  className="p-2 hover:bg-slate-800 rounded-lg text-rose-300 hover:text-white transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center bg-rose-500/10 sm:bg-transparent border border-rose-500/30 sm:border-transparent active:bg-rose-600/30 shrink-0"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>

            {/* Mobile App Viewport */}
            <div className="flex-1 p-4 space-y-4">
              {notification && (
                <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-left shadow-sm transition-all duration-300 relative ${
                  notification.type === "success" 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                    : "bg-rose-50 text-rose-800 border-rose-200"
                }`}>
                  <div className="mt-0.5 shrink-0">
                    {notification.type === "success" ? (
                      <Check className="w-4 h-4 text-emerald-600 font-bold" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 font-bold" />
                    )}
                  </div>
                  <div className="flex-1 pr-5">
                    <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">
                      {notification.type === "success" ? "Authorized" : "Not Allowed"}
                    </p>
                    <p className="text-[11px] leading-snug font-medium">{notification.message}</p>
                  </div>
                  <button 
                    onClick={() => setNotification(null)}
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0"
                    id="close-notification"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Live Location Verification Status */}
              {gpsAccuracyStatus.stage !== "idle" && (
                <div className={`p-3 rounded-2xl border text-xs font-medium flex items-center gap-2.5 shadow-sm text-left ${
                  gpsAccuracyStatus.stage === "waiting_better_signal"
                    ? "bg-amber-50 border-amber-200 text-amber-900 animate-pulse"
                    : gpsAccuracyStatus.stage === "poor_rejected"
                    ? "bg-rose-50 border-rose-200 text-rose-900"
                    : gpsAccuracyStatus.stage === "acquired"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-blue-50 border-blue-200 text-blue-900"
                }`}>
                  <Compass size={16} className="shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <span className="font-semibold">{gpsAccuracyStatus.message}</span>
                  </div>
                </div>
              )}

              {mobileTab === "mobile-home" && (
                <>
                  {/* Warnings & Alerts for Late or Absent */}
                  {(() => {
                    const lateRecord = attendanceHistory.find(h => h.user_id === user?.id && h.status === "Late");
                    const absentRecord = attendanceHistory.find(h => h.user_id === user?.id && h.status === "Absent");
                    
                    if (!lateRecord && !absentRecord) return null;
                    
                    return (
                      <div className="space-y-3 mb-4 text-left">
                        {lateRecord && (
                          <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-xl p-3.5 flex items-start gap-3 shadow-sm border border-amber-100/50 animate-fade-in">
                            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-amber-900">Punctuality Warning: Late Attendance</h4>
                              <p className="text-[10px] text-amber-700 leading-relaxed font-medium">
                                You registered a <strong className="font-extrabold uppercase text-amber-800">Late</strong> status on <span className="font-bold font-mono">{lateRecord.date}</span> (Checked in at <span className="font-bold font-mono">{lateRecord.check_in_time}</span>). Please adhere to standard timing rules to maintain your excellent attendance index.
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {absentRecord && (
                          <div className="bg-rose-50/70 border-l-4 border-rose-500 rounded-xl p-3.5 flex items-start gap-3 shadow-sm border border-rose-100/50 animate-fade-in">
                            <AlertCircle className="text-rose-600 shrink-0 mt-0.5" size={16} />
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-rose-900">Attendance Alert: Absenteeism Registered</h4>
                              <p className="text-[10px] text-rose-700 leading-relaxed font-medium">
                                You have been marked <strong className="font-extrabold uppercase text-rose-800">Absent</strong> for the shift on <span className="font-bold font-mono">{absentRecord.date}</span>. If you had an authorized reason, please submit a professional Leave Request immediately.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Device Binding & Network Status Chips */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Smartphone size={13} className={user?.registered_device_id ? "text-emerald-600" : "text-blue-600"} />
                      <span>
                        {user?.registered_device_id 
                          ? `Device: ${user.device_name || "Registered Phone"}` 
                          : "Device Binding: Active on First Check-In"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-700 font-semibold bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md text-[10px]">
                      <QrCode size={11} />
                      <span>QR Code + GPS Required</span>
                    </div>
                  </div>

                  {/* Forgotten Check-out & Active Session Alert */}
                  <ForgottenCheckoutAlert
                    onOpenCheckOut={() => handleRealCheckOut()}
                    onOpenMissingModal={(tab) => {
                      if (tab) setMissingCheckoutInitialTab(tab);
                      setIsMissingCheckoutModalOpen(true);
                    }}
                  />

                  {/* Attendance Check-In / Out Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm text-center relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 text-gray-50/50">
                      <Clock size={120} />
                    </div>
                    <div className="flex items-center justify-between mb-1 relative z-10">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Today's Attendance</h3>
                      <div 
                        className="inline-flex items-center text-[10px] font-bold transition cursor-default"
                        title={isNetworkSynced ? `Authoritative network time provided by backend server (${networkLatencyMs}ms ping, device offset: ${networkOffsetMs >= 0 ? "+" : ""}${Math.round(networkOffsetMs / 1000)}s)` : "Synchronizing with server network clock..."}
                      >
                        {isNetworkSynced ? (
                          <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>Network Time</span>
                          </span>
                        ) : syncStatus === "syncing" ? (
                          <span className="flex items-center gap-1 text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            <RefreshCw size={10} className="animate-spin text-blue-500" />
                            <span>Syncing Time...</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <WifiOff size={10} />
                            <span>Local Clock</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Live Digital Clock */}
                    <div className="my-3 relative z-10">
                      <span className="text-3xl font-extrabold text-[#0F172A] tracking-tight font-mono block">
                        {getEthiopianLocalClockTimeString(currentTime)}
                      </span>
                      <div className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wider mt-0.5">
                        {getEthiopianTimePeriod(currentTime)}
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        {getEthiopianNiceDateString(currentTime)}
                      </div>
                    </div>

                    {/* Live Working Day / Non-Working Day Status Indicator */}
                    <div className="mb-4 text-left">
                      <WorkingDayStatusCard
                        status={effectiveWorkStatus}
                        currentTime={currentTime}
                        onNavigateToCalendar={() => setMobileTab("mobile-calendar")}
                      />
                    </div>

                    {/* Sessions section */}
                    <div className="space-y-4 text-left mt-4">
                      {/* Morning Session Block */}
                      {(() => {
                        const morningRecord = Array.isArray(todayAttendance) ? todayAttendance.find(r => r.session === "Morning") : null;
                        const afternoonRecord = Array.isArray(todayAttendance) ? todayAttendance.find(r => r.session === "Afternoon") : null;
                        
                        const now = currentTime;
                        const currentHour = parseInt(getEthiopianTimeString(now).split(":")[0], 10);
                        const isMorningSession = currentHour < 6;
                        
                        const hasActiveMorningCheckIn = !!(morningRecord && !morningRecord.check_out_time);
                        const hasActiveAfternoonCheckIn = !!(afternoonRecord && !afternoonRecord.check_out_time);
                        
                        const showMorning = isMorningSession || hasActiveMorningCheckIn;
                        const showAfternoon = !isMorningSession || hasActiveAfternoonCheckIn;

                        return (
                          <>
                            {showMorning && (
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Morning Session</h4>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                                        (effectiveWorkStatus?.morning_status === "NON_WORKING" || (!effectiveWorkStatus && currentTime.getDay() === 0))
                                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      }`}>
                                        {(effectiveWorkStatus?.morning_status === "NON_WORKING" || (!effectiveWorkStatus && currentTime.getDay() === 0))
                                          ? "Non-Working / OT"
                                          : "Working Shift"}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">02:00 - 06:00 (Ethiopian Time)</p>
                                  </div>
                                  {morningRecord ? (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      morningRecord.check_out_time 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}>
                                      {morningRecord.check_out_time ? "Completed" : "Active Check-In"}
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      Not Checked In
                                    </span>
                                  )}
                                </div>

                                {morningRecord && (
                                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
                                    <div className="flex justify-between">
                                      <span>Check-In:</span>
                                      <span className="font-mono font-semibold text-slate-800">
                                        {morningRecord.check_in_time} {morningRecord.status === "Late" && <span className="text-red-500 font-bold text-[9px] ml-1">(LATE)</span>}
                                      </span>
                                    </div>
                                    {morningRecord.check_out_time && (
                                      <>
                                        <div className="flex justify-between">
                                          <span>Check-Out:</span>
                                          <span className="font-mono font-semibold text-slate-800">{morningRecord.check_out_time}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-100 pt-1 mt-1 text-slate-800 font-bold">
                                          <span>Worked:</span>
                                          <span>{morningRecord.total_hours} hrs</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="pt-1">
                                  {!morningRecord ? (
                                    <button
                                      onClick={() => handleRealScan("Morning")}
                                      disabled={isScanning}
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-blue-600/10 transition flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
                                    >
                                      <QrCode size={14} />
                                      {isScanning ? "Scanning..." : "Check-In Morning"}
                                    </button>
                                  ) : !morningRecord.check_out_time ? (
                                    <button
                                      onClick={() => handleRealCheckOut("Morning")}
                                      disabled={isScanning}
                                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-rose-600/10 transition flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
                                    >
                                      <LogOut size={14} />
                                      {isScanning ? "Processing..." : "Check-Out Morning"}
                                    </button>
                                  ) : (
                                    <div className="text-center py-2 text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                      <Check size={14} /> Morning Session Completed
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {showAfternoon && (
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Afternoon Session</h4>
                                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                                        (effectiveWorkStatus?.afternoon_status === "NON_WORKING" || (!effectiveWorkStatus && (currentTime.getDay() === 0 || currentTime.getDay() === 6)))
                                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                                          : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      }`}>
                                        {(effectiveWorkStatus?.afternoon_status === "NON_WORKING" || (!effectiveWorkStatus && (currentTime.getDay() === 0 || currentTime.getDay() === 6)))
                                          ? "Non-Working / OT"
                                          : "Working Shift"}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-gray-400">07:00 - 11:00 (Ethiopian Time)</p>
                                  </div>
                                  {afternoonRecord ? (
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      afternoonRecord.check_out_time 
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}>
                                      {afternoonRecord.check_out_time ? "Completed" : "Active Check-In"}
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                      Not Checked In
                                    </span>
                                  )}
                                </div>

                                {afternoonRecord && (
                                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
                                    <div className="flex justify-between">
                                      <span>Check-In:</span>
                                      <span className="font-mono font-semibold text-slate-800">
                                        {afternoonRecord.check_in_time} {afternoonRecord.status === "Late" && <span className="text-red-500 font-bold text-[9px] ml-1">(LATE)</span>}
                                      </span>
                                    </div>
                                    {afternoonRecord.check_out_time && (
                                      <>
                                        <div className="flex justify-between">
                                          <span>Check-Out:</span>
                                          <span className="font-mono font-semibold text-slate-800">{afternoonRecord.check_out_time}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-slate-100 pt-1 mt-1 text-slate-800 font-bold">
                                          <span>Worked:</span>
                                          <span>{afternoonRecord.total_hours} hrs</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                <div className="pt-1">
                                  {!afternoonRecord ? (
                                    <button
                                      onClick={() => handleRealScan("Afternoon")}
                                      disabled={isScanning}
                                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-blue-600/10 transition flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
                                    >
                                      <QrCode size={14} />
                                      {isScanning ? "Scanning..." : "Check-In Afternoon"}
                                    </button>
                                  ) : !afternoonRecord.check_out_time ? (
                                    <button
                                      onClick={() => handleRealCheckOut("Afternoon")}
                                      disabled={isScanning}
                                      className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-rose-600/10 transition flex items-center justify-center gap-2 text-xs active:scale-[0.98]"
                                    >
                                      <LogOut size={14} />
                                      {isScanning ? "Processing..." : "Check-Out Afternoon"}
                                    </button>
                                  ) : (
                                    <div className="text-center py-2 text-[11px] text-emerald-600 font-bold flex items-center justify-center gap-1 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                                      <Check size={14} /> Afternoon Session Completed
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {isScanning && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 text-blue-800 text-xs rounded-xl flex items-center gap-2.5 justify-center animate-pulse">
                        <Camera size={16} className="animate-bounce" />
                        <span>{scanMessage}</span>
                      </div>
                    )}

                    {/* Auto-Detection Status Panel commented out as requested */}
                    {/*
                    <div className="mt-4 pt-4 border-t border-gray-100 text-left space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                        <Smartphone size={14} className="text-blue-600" />
                        <span>System Auto-Detection Diagnostics</span>
                      </div>

                      <div className="space-y-1.5 text-[11px] text-gray-600">
                        <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                          <span className="font-medium text-gray-500">Your Current Public IP:</span>
                          <span className="font-mono text-blue-700 font-semibold">{currentPublicIp || "Detecting..."}</span>
                        </div>
                        
                        <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                          <span className="font-medium text-gray-500">Configured Office Location:</span>
                          <span className="font-semibold text-gray-800 truncate max-w-[150px]" title={editOfficeName}>{editOfficeName}</span>
                        </div>

                        {siteSettings?.use_wifi_verification === 1 && siteSettings?.wifi_ip && (
                          <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                            <span className="font-medium text-gray-500">Office WiFi Router IP:</span>
                            <span className="font-mono text-gray-700">{siteSettings.wifi_ip}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] text-gray-500 leading-normal bg-white p-2.5 rounded border border-gray-100 flex gap-1.5">
                        <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>
                          <strong>Dual Attendance Verification</strong>: Connected office Wi-Fi takes precedence. If Wi-Fi is not connected, it falls back strictly to the head office's GPS Geofence (30 meters).
                        </span>
                      </div>
                    </div>
                    */}
                  </div>

                  {/* Attendance Score Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center border border-amber-500/20 shrink-0">
                        <Award size={22} />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400">Attendance Rating</h4>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-lg font-bold text-[#0F172A]">
                            {scores[0] ? scores[0].attendance_score : 100}%
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${getRating(scores[0] ? scores[0].attendance_score : 100).color}`}>
                            {getRating(scores[0] ? scores[0].attendance_score : 100).text}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 font-medium">Lates count</div>
                      <div className="text-sm font-bold text-[#0F172A] mt-0.5">
                        {scores[0] ? scores[0].late_count : 0} Days
                      </div>
                    </div>
                  </div>

                  {/* Quick navigation modules */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMobileTab("mobile-leave")}
                      className="p-4 bg-white hover:bg-slate-50 border border-gray-100 rounded-2xl text-left shadow-sm group transition"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center justify-center mb-3">
                        <FileText size={18} />
                      </div>
                      <div className="text-xs font-bold text-[#0F172A] group-hover:text-blue-600 transition">Request Leave</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Permissions, Sick, Annual</div>
                    </button>

                    <button
                      onClick={() => setMobileTab("mobile-adjust")}
                      className="p-4 bg-white hover:bg-slate-50 border border-gray-100 rounded-2xl text-left shadow-sm group transition"
                    >
                      <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 flex items-center justify-center mb-3">
                        <MapPin size={18} />
                      </div>
                      <div className="text-xs font-bold text-[#0F172A] group-hover:text-blue-600 transition">Site Adjust</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">Visits & external work</div>
                    </button>
                  </div>

                  {/* History Logs */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Your Recent Logs</h3>
                      <button onClick={() => setMobileTab("mobile-history")} className="text-xs text-blue-600 font-semibold hover:underline">
                        View All
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {attendanceHistory.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center text-xs text-gray-400 font-medium">
                          No recent attendance logs
                        </div>
                      ) : (
                        attendanceHistory.slice(0, 4).map((h) => (
                          <div key={h.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-2 h-2 rounded-full ${h.status === "Present" ? "bg-emerald-500" : h.status === "Late" ? "bg-amber-500" : "bg-rose-500"}`}></div>
                              <div>
                                <div className="text-xs font-bold text-gray-800">{h.date}</div>
                                <div className="text-[10px] text-gray-400 font-medium">
                                  {h.check_in_time || "--:--"} to {h.check_out_time || "Pending"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                h.status === "Present" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100"
                              }`}>
                                {h.status}
                              </span>
                              {h.attendance_type && h.attendance_type !== "REGULAR_WORK" && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                  {h.attendance_type === "REST_DAY_OVERTIME" ? "Rest OT" : h.attendance_type === "HOLIDAY_OVERTIME" ? "Holiday OT" : "OT"}
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Leave Requests Tab */}
              {mobileTab === "mobile-leave" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                    <button onClick={() => setMobileTab("mobile-home")} className="text-xs text-blue-600 font-bold hover:underline">Back</button>
                    <span className="text-xs text-gray-400">/</span>
                    <span className="text-xs font-bold text-gray-700">Request Leave</span>
                  </div>

                  <form onSubmit={handleLeaveSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm">
                    {leaveSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                        Leave request submitted successfully!
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Leave Type</label>
                      <select 
                        value={leaveType} 
                        onChange={(e) => setLeaveType(e.target.value as any)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100 font-medium"
                      >
                        <option value="Permission">Permission (Partial or Daily Leave)</option>
                        <option value="Sick Leave">Sick Leave</option>
                        <option value="Annual Leave">Annual Leave</option>
                      </select>
                    </div>

                    {leaveType === "Permission" && (
                      <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                          <span>Permission Session Scope</span>
                          <span className="text-[10px] text-blue-600 font-semibold normal-case">Strict Validation</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["Full Day", "Morning", "Afternoon"] as const).map((s) => (
                            <button
                              type="button"
                              key={s}
                              onClick={() => setLeaveSession(s)}
                              className={`py-1.5 text-xs font-bold rounded-lg border transition ${
                                leaveSession === s
                                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {s === "Full Day" ? "Full Day" : `${s} Only`}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          💡 <strong>Notice:</strong> If you already checked in for the morning session, select <strong>Afternoon Only</strong>. You cannot request permission for sessions you already attended.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Start Date</label>
                        <input 
                          type="date" 
                          value={leaveStart}
                          onChange={(e) => setLeaveStart(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">End Date</label>
                        <input 
                          type="date" 
                          value={leaveEnd}
                          onChange={(e) => setLeaveEnd(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Reason</label>
                      <textarea 
                        rows={3}
                        placeholder="State reason here..."
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full text-xs bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-700 transition shadow-sm"
                    >
                      Submit Leave Request
                    </button>
                  </form>

                  {/* History of Leave Requests */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leave History</h4>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                      {permissions.length === 0 ? (
                        <div className="text-xs text-gray-400 bg-white p-3 rounded-xl border border-gray-100 text-center font-medium">
                          No leave requests found
                        </div>
                      ) : (
                        permissions.map((p) => (
                          <div key={p.id} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm text-xs space-y-1.5">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-gray-800 flex items-center gap-1.5">
                                {p.request_type}
                                {p.session && p.session !== "Full Day" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                    {p.session}
                                  </span>
                                )}
                              </span>
                              <span className={getStatusPill(p.status)}>{p.status}</span>
                            </div>
                            <p className="text-gray-500 text-[11px] truncate">{p.reason}</p>
                            <div className="text-[10px] text-gray-400 font-medium">
                              {p.start_date} to {p.end_date}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Site Adjust Tab */}
              {mobileTab === "mobile-adjust" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                    <button onClick={() => setMobileTab("mobile-home")} className="text-xs text-blue-600 font-bold hover:underline">Back</button>
                    <span className="text-xs text-gray-400">/</span>
                    <span className="text-xs font-bold text-gray-700">Attendance Adjustment</span>
                  </div>

                  <form onSubmit={handleAttendanceRequestSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                    {reqSuccess && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                        Attendance request submitted successfully!
                      </div>
                    )}

                    {/* Mode selection: Full Shift vs Site Check-out */}
                    <div className="space-y-1.5 p-3 bg-teal-50/60 border border-teal-200/70 rounded-xl">
                      <label className="text-[11px] font-bold text-teal-900 uppercase tracking-wide flex items-center justify-between">
                        <span>Work Location / Adjustment Scope</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setReqScope("Site Check-Out")}
                          className={`py-2 px-2 text-left rounded-lg border transition ${
                            reqScope === "Site Check-Out"
                              ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="text-xs font-bold">Site Check-Out</div>
                          <div className={`text-[10px] leading-tight ${reqScope === "Site Check-Out" ? "text-teal-100" : "text-slate-500"}`}>
                            Already checked in at office
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setReqScope("Full Shift")}
                          className={`py-2 px-2 text-left rounded-lg border transition ${
                            reqScope === "Full Shift"
                              ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="text-xs font-bold">Full Shift Off-Site</div>
                          <div className={`text-[10px] leading-tight ${reqScope === "Full Shift" ? "text-teal-100" : "text-slate-500"}`}>
                            Entire shift was away
                          </div>
                        </button>
                      </div>
                      <p className="text-[10px] text-teal-800 leading-relaxed">
                        {reqScope === "Site Check-Out" 
                          ? "✓ Ideal for site visits: You checked in physically at the office in the morning and need to log your departure/checkout from the site."
                          : "✓ For full-day or half-day external field assignments where you could not check in at the office."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Type</label>
                        <select 
                          value={reqType} 
                          onChange={(e) => setReqType(e.target.value as any)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600 font-medium"
                        >
                          <option value="Site Visit">Site Visit</option>
                          <option value="External Work">External Work</option>
                          <option value="Purchaser Visit">Purchaser Visit</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Session</label>
                        <select 
                          value={reqSession} 
                          onChange={(e) => setReqSession(e.target.value as any)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600 font-medium"
                        >
                          <option value="Full Day">Full Day</option>
                          <option value="Morning">Morning Session</option>
                          <option value="Afternoon">Afternoon Session</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Date</label>
                      <input 
                        type="date" 
                        value={reqDate}
                        onChange={(e) => setReqDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600"
                      />
                    </div>

                    {reqScope === "Full Shift" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Check-In Time</label>
                          <input 
                            type="time" 
                            value={reqIn}
                            onChange={(e) => setReqIn(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Check-Out Time</label>
                          <input 
                            type="time" 
                            value={reqOut}
                            onChange={(e) => setReqOut(e.target.value)}
                            className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Site Departure / Check-Out Time</label>
                        <input 
                          type="time" 
                          value={reqOut}
                          onChange={(e) => setReqOut(e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600"
                        />
                        <span className="text-[10px] text-gray-400">Office check-in time will be retained from your physical check-in.</span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Reason / Site Description</label>
                      <textarea 
                        rows={2}
                        placeholder="State purpose of trip or client site visited..."
                        value={reqReason}
                        onChange={(e) => setReqReason(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-600"
                      />
                    </div>

                    <button 
                      type="submit"
                      className="w-full text-xs bg-teal-600 text-white font-bold py-2.5 rounded-lg hover:bg-teal-700 transition shadow-sm"
                    >
                      Submit Adjustment Request
                    </button>
                  </form>

                  {/* History of adjustments */}
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Adjustment History</h4>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                      {attendanceRequests.length === 0 ? (
                        <div className="text-xs text-gray-400 bg-white p-3 rounded-xl border border-gray-100 text-center font-medium">
                          No adjustments found
                        </div>
                      ) : (
                        attendanceRequests.map((r) => (
                          <div key={r.id} className="bg-white border border-gray-100 p-3 rounded-xl shadow-sm text-xs space-y-1">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-gray-800 flex items-center gap-1.5">
                                {r.type}
                                {r.request_scope === "Site Check-Out" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                                    Site Out
                                  </span>
                                )}
                              </span>
                              <span className={getStatusPill(r.status)}>{r.status}</span>
                            </div>
                            <p className="text-gray-500 text-[11px] truncate">{r.reason}</p>
                            <div className="text-[10px] text-gray-400 font-medium">
                              Date: {r.date} ({r.check_in_time} - {r.check_out_time})
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Official Calendar & Holidays (Read-Only for Employees) */}
              {mobileTab === "mobile-calendar" && (
                <div className="space-y-4 animate-fade-in text-left">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <button 
                      onClick={() => setMobileTab("mobile-home")} 
                      className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                      ← Back to Today
                    </button>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                      <Lock size={10} /> Employee Read-Only
                    </span>
                  </div>

                  <WorkCalendarTab readOnly={true} />
                </div>
              )}

              {/* Full History Logs Tab */}
              {mobileTab === "mobile-history" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                    <button onClick={() => setMobileTab("mobile-home")} className="text-xs text-blue-600 font-bold hover:underline">Back</button>
                    <span className="text-xs text-gray-400">/</span>
                    <span className="text-xs font-bold text-gray-700">All Attendance History</span>
                  </div>

                  <div className="space-y-2.5">
                    {attendanceHistory.map((h) => (
                      <div key={h.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
                        <div>
                          <div className="text-xs font-extrabold text-[#0F172A]">{h.date}</div>
                          <div className="text-[11px] text-gray-500 font-medium mt-1">
                            In: {h.check_in_time || "--:--"}
                          </div>
                          <div className="text-[11px] text-gray-500 font-medium">
                            Out: {h.check_out_time || "--:--"}
                          </div>
                        </div>

                        <div className="text-right space-y-1.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            h.status === "Present" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100"
                          }`}>
                            {h.status}
                          </span>
                          <div className="text-xs font-bold text-gray-700">{h.total_hours} hrs worked</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Employee Earnings & Overtime Tab */}
              {mobileTab === "mobile-salary" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setMobileTab("mobile-home")} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">Back</button>
                      <span className="text-xs text-gray-400">/</span>
                      <span className="text-xs font-bold text-gray-800">My Earnings & Overtime</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchMySalary("Monthly")}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RefreshCw size={11} /> Refresh
                    </button>
                  </div>

                  {mySalary ? (
                    <div className="space-y-3">
                      {/* Net Salary Highlight */}
                      <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
                        <div className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider">Estimated Net Salary (Monthly)</div>
                        <div className="text-2xl font-black mt-1">
                          ETB {(mySalary.net_salary ?? mySalary.final_payable_amount ?? (mySalary.basic_salary ?? Math.round(((mySalary.regular_hours ?? mySalary.total_hours ?? 0) * (mySalary.effective_hourly_rate || mySalary.hourly_rate || 0) + Number.EPSILON) * 100) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-700/80 text-[11px] text-blue-200">
                          <span>Base Rate: ETB {mySalary.hourly_rate?.toFixed(2)}/hr</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            mySalary.payment_status === "PAID" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          }`}>
                            {mySalary.payment_status || "UNPAID"}
                          </span>
                        </div>
                      </div>

                      {/* Regular Work vs Overtime Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                          <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase">
                            <span>Regular Work</span>
                            <Clock size={12} className="text-blue-500" />
                          </div>
                          <div className="text-base font-extrabold text-slate-800 mt-1">
                            {(mySalary.regular_hours ?? mySalary.total_hours ?? 0) % 1 === 0 
                              ? (mySalary.regular_hours ?? mySalary.total_hours ?? 0).toFixed(1) 
                              : Number((mySalary.regular_hours ?? mySalary.total_hours ?? 0).toFixed(2))} hrs
                          </div>
                          <div className="text-[11px] font-semibold text-blue-600 mt-0.5">
                            ETB {(mySalary.regular_pay ?? (Math.round(((mySalary.regular_hours ?? mySalary.total_hours ?? 0) * (mySalary.effective_hourly_rate || mySalary.hourly_rate || 0) + Number.EPSILON) * 100) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 shadow-xs">
                          <div className="flex items-center justify-between text-amber-800 text-[10px] font-bold uppercase">
                            <span>Total Overtime</span>
                            <Zap size={12} className="text-amber-600" />
                          </div>
                          <div className="text-base font-extrabold text-amber-900 mt-1">
                            {(mySalary.overtime_hours ?? 0).toFixed(1)} hrs
                          </div>
                          <div className="text-[11px] font-semibold text-amber-700 mt-0.5">
                            ETB {(mySalary.overtime_pay ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>

                      {/* Multi-Rate Overtime Breakdown (Ethiopian Labor Law) */}
                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Zap size={13} className="text-amber-500" />
                            <span>Overtime Breakdown by Multiplier</span>
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium">Labor Law Proclamation</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                              <span>Normal (1.5x)</span>
                              <span>{(mySalary.regular_overtime_hours ?? 0).toFixed(1)}h</span>
                            </div>
                            <div className="font-bold text-slate-800 mt-0.5 text-[11px]">
                              ETB {(mySalary.normal_overtime_pay ?? 0).toFixed(2)}
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                              <span>Rest Day (2.0x)</span>
                              <span>{(mySalary.rest_day_overtime_hours ?? 0).toFixed(1)}h</span>
                            </div>
                            <div className="font-bold text-slate-800 mt-0.5 text-[11px]">
                              ETB {(mySalary.rest_day_overtime_pay ?? 0).toFixed(2)}
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                              <span>Holiday (2.5x)</span>
                              <span>{(mySalary.holiday_overtime_hours ?? 0).toFixed(1)}h</span>
                            </div>
                            <div className="font-bold text-slate-800 mt-0.5 text-[11px]">
                              ETB {(mySalary.holiday_overtime_pay ?? 0).toFixed(2)}
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                              <span>Night Shift (1.5x)</span>
                              <span>{(mySalary.night_overtime_hours ?? 0).toFixed(1)}h</span>
                            </div>
                            <div className="font-bold text-slate-800 mt-0.5 text-[11px]">
                              ETB {(mySalary.night_overtime_pay ?? 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Allowances & Deductions Summary */}
                      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                          <span>Allowances:</span>
                          <span className="font-bold text-emerald-600">
                            +ETB {((mySalary.transport_allowance || 0) + (mySalary.housing_allowance || 0) + (mySalary.position_allowance || 0)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Late Penalties & Absences:</span>
                          <span className="font-bold text-rose-600">
                            -ETB {((mySalary.late_penalty_deduction || 0) + (mySalary.absent_penalty_deduction || 0)).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Pension 7% & Tax Deductions:</span>
                          <span className="font-bold text-slate-700">
                            -ETB {((mySalary.pension_employee_7pct || 0) + (mySalary.tax_amount || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* View Official Payslip Button */}
                      <button
                        type="button"
                        onClick={() => handleViewPayslip(user.id)}
                        disabled={loadingPayslipUserId === user.id}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98] cursor-pointer"
                      >
                        {loadingPayslipUserId === user.id ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <FileText size={14} />
                        )}
                        <span>Open Itemized Official Payslip</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-white rounded-xl border border-slate-200 p-4">
                      <DollarSign className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-700">Loading your salary details...</p>
                      <button
                        type="button"
                        onClick={() => fetchMySalary("Monthly")}
                        className="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Fetch My Salary
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div className="border-t border-gray-100 bg-white px-3 py-2.5 flex justify-between items-center shrink-0 shadow-lg">
              <button 
                onClick={() => setMobileTab("mobile-home")}
                className={`flex flex-col items-center gap-1 transition ${mobileTab === "mobile-home" ? "text-blue-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
              >
                <Clock size={18} />
                <span className="text-[10px] font-semibold">Today</span>
              </button>
              <button 
                onClick={() => setMobileTab("mobile-calendar")}
                className={`flex flex-col items-center gap-1 transition ${mobileTab === "mobile-calendar" ? "text-blue-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
              >
                <Calendar size={18} />
                <span className="text-[10px] font-semibold">Calendar</span>
              </button>
              <button 
                onClick={() => setMobileTab("mobile-leave")}
                className={`flex flex-col items-center gap-1 transition ${mobileTab === "mobile-leave" ? "text-blue-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
              >
                <FileText size={18} />
                <span className="text-[10px] font-semibold">Leaves</span>
              </button>
              <button 
                onClick={() => {
                  setMobileTab("mobile-salary");
                  fetchMySalary("Monthly");
                }}
                className={`flex flex-col items-center gap-1 transition ${mobileTab === "mobile-salary" ? "text-blue-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
              >
                <DollarSign size={18} />
                <span className="text-[10px] font-semibold">Earnings</span>
              </button>
              <button 
                onClick={() => setMobileTab("mobile-adjust")}
                className={`flex flex-col items-center gap-1 transition ${mobileTab === "mobile-adjust" ? "text-blue-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
              >
                <MapPin size={18} />
                <span className="text-[10px] font-semibold">Adjust</span>
              </button>
              <button 
                onClick={() => setMobileTab("mobile-history")}
                className={`flex flex-col items-center gap-1 transition ${mobileTab === "mobile-history" ? "text-blue-600 font-bold" : "text-gray-400 hover:text-gray-600"}`}
              >
                <CalendarCheck size={18} />
                <span className="text-[10px] font-semibold">History</span>
              </button>
            </div>
          </div>
      );

      return (
        <div className="bg-[#0F172A] min-h-screen flex justify-center items-center p-0 md:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-white min-h-screen md:min-h-0 md:max-h-[92vh] md:rounded-3xl md:shadow-2xl overflow-hidden flex flex-col relative md:border-4 md:border-slate-800">
            {mainContent}
          </div>
          {isScanningQR && (
            <QRScanner 
              onScanSuccess={handleQRScanSuccess} 
              onClose={() => setIsScanningQR(false)} 
              gpsInfo={pendingLocData}
              workStatus={effectiveWorkStatus ? {
                isWorkingDay: effectiveWorkStatus.is_working_day ?? (effectiveWorkStatus.status === "WORKING"),
                label: effectiveWorkStatus.working_day_label || (effectiveWorkStatus.status === "WORKING" ? "Standard Work Shift" : "Scheduled Rest Day / Holiday"),
                description: effectiveWorkStatus.working_day_description
              } : {
                isWorkingDay: currentTime.getDay() !== 0,
                label: currentTime.getDay() === 0 ? "Non-Working Day (Sunday Rest Day)" : "Official Working Day"
              }}
            />
          )}
          {renderGpsErrorModal()}

          {/* Employee Payslip & Overtime Modals */}
          <EnterprisePayslipModal
            isOpen={isPayslipModalOpen}
            onClose={() => setIsPayslipModalOpen(false)}
            payslip={selectedPayslip}
          />
          <EmployeeOvertimeModal
            isOpen={isOvertimeModalOpen}
            onClose={() => setIsOvertimeModalOpen(false)}
            salaryRecord={selectedOvertimeRecord}
          />
        </div>
      );
  };

  // If logged in as an Employee, show the mobile portal immediately
  const employeeRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR"];
  if (employeeRoles.includes(user.role)) {
    return renderEmployeePortal();
  }

  // --- ADMIN WEB APPLICATION PANEL ---
  return (
    <div className="min-h-screen md:h-screen bg-[#F8FAFC] flex flex-col font-sans relative overflow-x-hidden">
      
      {notification && (
        <div className="fixed top-6 right-6 z-[9999] animate-bounce-short">
          <div className={`p-4 rounded-2xl border flex items-start gap-3 text-left shadow-2xl max-w-sm transition-all duration-300 ${
            notification.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-emerald-500/10" 
              : "bg-rose-50 text-rose-800 border-rose-200 shadow-rose-500/10"
          }`}>
            <div className="mt-0.5 shrink-0">
              {notification.type === "success" ? (
                <Check className="w-5 h-5 text-emerald-600 font-bold" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 font-bold" />
              )}
            </div>
            <div className="flex-1 pr-5">
              <p className="font-extrabold text-[10px] uppercase tracking-wider mb-0.5">
                {notification.type === "success" ? "Authorized" : "Action Required"}
              </p>
              <p className="text-[11px] leading-snug font-semibold text-gray-700">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-lg transition shrink-0"
              id="close-admin-notification"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      
      {/* Top Banner & Header */}
      <header className="bg-[#0F172A] text-white py-2 sm:py-3.5 px-2.5 sm:px-4 md:px-6 flex justify-between items-center shrink-0 shadow-md w-full max-w-full gap-1.5 sm:gap-2 relative z-30">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
          {/* Hamburger button on mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center active:bg-slate-700"
            aria-label="Toggle Menu"
          >
            <Menu size={20} />
          </button>

          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-sm md:text-lg shadow-lg shadow-blue-500/20 shrink-0">
            {user.full_name ? user.full_name.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm md:text-lg font-bold tracking-tight flex items-center gap-1.5 truncate">
              <span className="truncate">{user.full_name}</span>
              {user.workspace_name && (
                <span className="text-[9px] md:text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 hidden xs:inline-block">
                  {user.workspace_name}
                </span>
              )}
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 font-medium flex items-center gap-1.5 truncate">
              <span className="truncate">{siteSettings?.office_name || "Nabi Tech PLC Attendance Panel"}</span>
              <span className="text-slate-500 shrink-0 hidden sm:inline">({user.role === "AdminManager" ? "Second Admin" : user.role === "AdminCreator" ? "Normal Admin" : user.role})</span>
              {["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap"].includes(user.role || "") && (
                <button
                  type="button"
                  onClick={() => {
                    setTempHeaderTitle(siteSettings?.office_name || "Nabi Tech PLC Attendance Panel");
                    setIsEditingHeaderTitle(true);
                  }}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 rounded transition text-[10px] hidden sm:flex items-center gap-1 ml-1 shrink-0"
                  title="Edit System / Header Title"
                >
                  <Edit2 size={11} />
                  <span>Edit Title</span>
                </button>
              )}
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Network-provided Clock Badge */}
          <div 
            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 shadow-xs cursor-default"
            title={isNetworkSynced ? `Authoritative network time provided by server (${networkLatencyMs}ms ping, device offset: ${networkOffsetMs >= 0 ? "+" : ""}${Math.round(networkOffsetMs / 1000)}s)` : "Syncing network time..."}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {isNetworkSynced ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              )}
            </span>
            <span className="font-mono font-bold text-slate-100">{getEthiopianLocalClockTimeString(currentTime)}</span>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider pl-1 border-l border-slate-700">{getEthiopianTimePeriod(currentTime).split(" ")[0]}</span>
          </div>

          {/* Live Real-Time SSE Sync Indicator */}
          <button
            type="button"
            onClick={() => {
              realtimeSync.triggerManualRefresh();
              triggerNotification("success", "Synchronized all operational data with live server.");
            }}
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 hover:bg-slate-700/80 transition cursor-pointer shadow-xs min-h-[36px]"
            title={`Real-Time SSE Sync: ${realtimeSync.status} (${realtimeSync.eventCount} events received, ${realtimeSync.isOnline ? "Online" : "Offline"}). Click to refresh.`}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {realtimeSync.status === "CONNECTED" ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </>
              ) : realtimeSync.status === "OFFLINE" ? (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
              )}
            </span>
            <span className="font-semibold text-[10px] text-emerald-400 hidden md:inline">
              {realtimeSync.status === "CONNECTED" ? "Live" : realtimeSync.status === "OFFLINE" ? "Offline" : "Syncing"}
            </span>
            <RefreshCw 
              size={11} 
              className={`text-slate-400 ${(realtimeSync.status === "CONNECTING" || realtimeSync.status === "RECONNECTING" || realtimeSync.isRefreshing) ? "animate-spin text-emerald-400" : ""}`} 
            />
          </button>

          {(user.role === "SuperAdmin" || user.role === "AdminCreator" || user.role === "AdminManager" || user.role === "Bootstrap") && (
            <button
              type="button"
              onClick={() => {
                setActiveTab("missing_checkouts");
                setIsMissingCheckoutModalOpen(false);
              }}
              className={`border px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg transition text-[11px] font-semibold flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-xs min-h-[36px] ${
                activeTab === "missing_checkouts"
                  ? "bg-blue-600 text-white font-bold border-blue-500 shadow-sm"
                  : missingCheckouts.length > 0
                  ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/40 text-amber-300"
                  : "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 hidden sm:flex"
              }`}
              title="Manage & Approve Missing Check-Outs"
            >
              <AlertTriangle size={13} className={activeTab === "missing_checkouts" ? "text-white" : missingCheckouts.length > 0 ? "text-amber-400" : "text-slate-400"} />
              <span className="hidden sm:inline">Missing Checkouts</span>
              {missingCheckouts.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeTab === "missing_checkouts" ? "bg-white text-blue-700" : "bg-amber-500 text-slate-900 font-black"}`}>
                  {missingCheckouts.length}
                </span>
              )}
            </button>
          )}

          {/* User profile & Logout */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="text-[10px] md:text-xs font-bold text-slate-300 truncate max-w-[80px] md:max-w-[120px] hidden md:inline-block">
              {user.full_name}
            </span>
            <button
              onClick={logout}
              className="text-rose-300 hover:text-white hover:bg-rose-600/30 p-2 rounded-lg transition shrink-0 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center bg-rose-500/10 sm:bg-slate-800/80 border border-rose-500/30 sm:border-slate-700/80 active:bg-rose-600/40"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={16} />
              <span className="text-xs font-bold text-rose-300 ml-1.5 hidden xs:inline sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main split dashboard view */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative overflow-hidden">
        
        {/* Mobile Navigation Drawer Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Navigation Drawer Content */}
        <aside 
          className={`fixed top-0 bottom-0 left-0 w-64 bg-white z-50 p-5 flex flex-col justify-between shadow-2xl border-r border-gray-100 transition-transform duration-300 md:hidden ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="space-y-6 overflow-y-auto pr-1 flex-1">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm">
                  B
                </div>
                <span className="font-bold text-slate-800 text-sm">Nabi Tech PLC Navigation</span>
              </div>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={18} />
              </button>
            </div>
            {user?.workspace_name && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-0.5 mx-1 mt-3">
                <div className="text-[9px] font-extrabold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                  <Briefcase size={10} />
                  Active Workspace
                </div>
                <div className="text-[11px] font-black text-slate-800 truncate">
                  {user.workspace_name}
                </div>
                <div className="text-[9px] font-semibold text-slate-500">
                  Role: {user.role === "AdminManager" ? "Second Admin" : user.role === "AdminCreator" ? "Normal Admin" : user.role}
                </div>
              </div>
            )}

            {/* Mobile Real-Time Liveness Status Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mx-1 mt-3 text-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    {realtimeSync.status === "CONNECTED" ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </>
                    ) : realtimeSync.status === "OFFLINE" ? (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400 animate-pulse"></span>
                    )}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                    {realtimeSync.status === "CONNECTED" ? "Real-Time Live" : realtimeSync.status === "OFFLINE" ? "Offline" : "Reconnecting"}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {realtimeSync.eventCount} syncs
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                {realtimeSync.lastEventTime 
                  ? `Last event: ${realtimeSync.lastEventType || "LIVE"} at ${realtimeSync.lastEventTime.toLocaleTimeString()}`
                  : "Live push updates active for attendance & shifts"}
              </p>
              <button
                type="button"
                onClick={() => {
                  realtimeSync.triggerManualRefresh();
                  triggerNotification("success", "Synchronized all operational data with live server.");
                }}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
              >
                <RefreshCw size={12} className={realtimeSync.isRefreshing ? "animate-spin text-emerald-400" : "text-slate-400"} />
                {realtimeSync.isRefreshing ? "Refreshing..." : "Force Sync All Data"}
              </button>
            </div>
            <div>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Management</h3>
              <nav className="space-y-1">
                {user?.role !== "Bootstrap" && (
                  <>
                    <button
                      onClick={() => { setActiveTab("dashboard"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "dashboard" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <TrendingUp size={18} /> Analytics Dashboard
                    </button>
                    <button
                      onClick={() => { setActiveTab("approvals"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "approvals" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <CheckCircle size={18} /> Approvals & Leaves
                      {(permissions.filter(p => p.status === "Pending").length + attendanceRequests.filter(r => r.status === "Pending").length) > 0 && (
                        <span className="ml-auto w-5 h-5 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                          {permissions.filter(p => p.status === "Pending").length + attendanceRequests.filter(r => r.status === "Pending").length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { setActiveTab("attendance"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "attendance" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Clock size={18} /> Admin Attendance
                    </button>
                    <button
                      onClick={() => { setActiveTab("missing_checkouts"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition cursor-pointer min-h-[44px] ${
                        activeTab === "missing_checkouts"
                          ? "bg-blue-50 text-blue-600 font-bold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <AlertTriangle size={18} className={activeTab === "missing_checkouts" ? "text-blue-600" : missingCheckouts.length > 0 ? "text-amber-500" : "text-gray-400"} />
                      <span>Missing Check-Outs</span>
                      {missingCheckouts.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                          {missingCheckouts.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { setActiveTab("salary"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "salary" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <DollarSign size={18} /> Salary Management
                    </button>
                    <button
                      onClick={() => { setActiveTab("calendar"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "calendar" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Calendar size={18} /> Work Calendar & Holidays
                    </button>
                    <button
                      onClick={() => { setActiveTab("overtime"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "overtime" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Clock size={18} /> Overtime & Penalty
                      {overtimeStats && overtimeStats.pendingCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                          {overtimeStats.pendingCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { setActiveTab("penalties"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "penalties" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <AlertTriangle size={18} /> Late Penalties
                      {penaltyStats && penaltyStats.penalizedCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                          {penaltyStats.penalizedCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { setActiveTab("attendance_settings"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "attendance_settings" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Settings size={18} /> Schedule & Overtime Settings
                    </button>
                  </>
                )}
                <button
                  onClick={() => { setActiveTab("registration"); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                    activeTab === "registration" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <UserPlus size={18} /> {user?.role === "Bootstrap" ? "Administrator Registry" : "Employee Registration"}
                </button>
                {user?.role !== "Bootstrap" && (
                  <>
                    <button
                      onClick={() => { setActiveTab("scores"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "scores" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Award size={18} /> Attendance Scores
                    </button>
                    <button
                      onClick={() => { setActiveTab("qr_code"); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "qr_code" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <QrCode size={18} /> QR Management
                    </button>
                  </>
                )}
              </nav>
            </div>

            {user?.role !== "Bootstrap" && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Settings</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => { setActiveTab("profile"); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                      activeTab === "profile" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <UserIcon size={18} /> Admin Profile
                  </button>
                </nav>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-100 mt-2 space-y-2">
            <button
              onClick={() => { setIsMobileMenuOpen(false); logout(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-sm transition cursor-pointer active:bg-rose-200 min-h-[44px]"
            >
              <LogOut size={16} />
              <span>Log Out ({user.full_name})</span>
            </button>

            <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-gray-100">
              <span className="text-[10px] text-gray-400 uppercase font-bold">App Environment</span>
              <div className="text-xs font-bold text-gray-700 mt-0.5">Live Pure MySQL Engine</div>
            </div>
          </div>
        </aside>

        {/* Desktop Navigation Sidebar */}
        <aside className="hidden md:flex w-64 bg-white border-r border-gray-100 p-5 flex-col justify-between shrink-0 h-full overflow-y-auto">
          <div className="space-y-6 flex-1">
            {user?.workspace_name && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-1">
                <div className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest flex items-center gap-1">
                  <Briefcase size={12} />
                  Active Workspace
                </div>
                <div className="text-xs font-black text-slate-800 truncate">
                  {user.workspace_name}
                </div>
                <div className="text-[10px] font-semibold text-slate-500">
                  Role: {user.role === "AdminManager" ? "Second Admin" : user.role === "AdminCreator" ? "Normal Admin" : user.role}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Management</h3>
              <nav className="space-y-1">
                {user?.role !== "Bootstrap" && (
                  <>
                    <button
                      onClick={() => setActiveTab("dashboard")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "dashboard" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <TrendingUp size={18} /> Analytics Dashboard
                    </button>
                    <button
                      onClick={() => setActiveTab("approvals")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "approvals" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <CheckCircle size={18} /> Approvals & Leaves
                      {(permissions.filter(p => p.status === "Pending").length + attendanceRequests.filter(r => r.status === "Pending").length) > 0 && (
                        <span className="ml-auto w-5 h-5 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                          {permissions.filter(p => p.status === "Pending").length + attendanceRequests.filter(r => r.status === "Pending").length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("attendance")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "attendance" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Clock size={18} /> Admin Attendance
                    </button>
                    <button
                      onClick={() => setActiveTab("missing_checkouts")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition cursor-pointer min-h-[44px] ${
                        activeTab === "missing_checkouts"
                          ? "bg-blue-50 text-blue-600 font-bold"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <AlertTriangle size={18} className={activeTab === "missing_checkouts" ? "text-blue-600" : missingCheckouts.length > 0 ? "text-amber-500" : "text-gray-400"} />
                      <span>Missing Check-Outs</span>
                      {missingCheckouts.length > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                          {missingCheckouts.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("salary")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "salary" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <DollarSign size={18} /> Salary Management
                    </button>
                    <button
                      onClick={() => setActiveTab("calendar")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "calendar" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Calendar size={18} /> Work Calendar & Holidays
                    </button>
                    <button
                      onClick={() => setActiveTab("overtime")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "overtime" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Clock size={18} /> Overtime & Penalty
                      {overtimeStats && overtimeStats.pendingCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-amber-500 text-white text-[10px] rounded-full font-bold">
                          {overtimeStats.pendingCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("penalties")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "penalties" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <AlertTriangle size={18} /> Late Penalties
                      {penaltyStats && penaltyStats.penalizedCount > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                          {penaltyStats.penalizedCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab("attendance_settings")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "attendance_settings" ? "bg-blue-50 text-blue-600 font-bold" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Settings size={18} /> Schedule & Overtime Settings
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveTab("registration")}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                    activeTab === "registration" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <UserPlus size={18} /> {user?.role === "Bootstrap" ? "Administrator Registry" : "Employee Registration"}
                </button>
                {user?.role !== "Bootstrap" && (
                  <>
                    <button
                      onClick={() => setActiveTab("scores")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "scores" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Award size={18} /> Attendance Scores
                    </button>
                    <button
                      onClick={() => setActiveTab("qr_code")}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                        activeTab === "qr_code" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <QrCode size={18} /> QR Management
                    </button>
                  </>
                )}
              </nav>
            </div>

            {user?.role !== "Bootstrap" && (
              <div>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">Settings</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition ${
                      activeTab === "profile" ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <UserIcon size={18} /> Admin Profile
                  </button>
                </nav>
              </div>
            )}
          </div>

          {/* App Environment badge commented out as requested */}
          {/*
          <div className="bg-slate-50 rounded-xl p-3 text-center border border-gray-100">
            <span className="text-[10px] text-gray-400 uppercase font-bold">App Environment</span>
            <div className="text-xs font-bold text-gray-700 mt-1">Live Pure MySQL Engine</div>
          </div>
          */}
        </aside>

        {/* Content Panel */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto min-h-0 space-y-6">
          
          {/* Module 1: Dashboard */}
          {activeTab === "dashboard" && (
            dashboardData?.summary ? (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] tracking-tight">Analytics Dashboard</h2>
                  <p className="text-gray-500 text-xs md:text-sm mt-0.5">Real-time attendance summaries and metrics for the workforce</p>
                </div>

                <div className="flex gap-1.5 bg-white border border-gray-200 p-1 rounded-xl shadow-sm shrink-0">
                  {["Today", "Week", "Month", "Year"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleDashboardFilterChange(opt)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                        dashboardFilter === opt ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Missing Check-Outs & Forgotten Shift Alert */}
              <ForgottenCheckoutAlert
                onOpenCheckOut={() => handleRealCheckOut()}
                onOpenMissingModal={(tab) => {
                  if (tab) setMissingCheckoutInitialTab(tab);
                  setIsMissingCheckoutModalOpen(true);
                }}
              />

              {/* Work Calendar / Non-Working Day or Holiday Status Banner */}
              {(dashboardData?.summary?.isNonWorkingDay || dashboardData?.summary?.isHoliday) && (
                <div className="bg-gradient-to-r from-amber-50 via-orange-50/70 to-blue-50/50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-800">
                          {dashboardData.summary?.isHoliday
                            ? `Public Holiday: ${dashboardData.summary?.holidayName || "Official Holiday"}`
                            : `Official Non-Working Day (${dashboardData.summary?.dayName || "Weekly Off"})`}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900 uppercase tracking-wider">
                          Attendance Not Mandatory
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Employees are <strong>not marked absent</strong> today. Any employee working today is classified as <strong>Working Overtime</strong> with special holiday/rest multipliers applied.
                      </p>
                    </div>
                  </div>
                  {(dashboardData.summary?.workingOvertimeToday ?? 0) > 0 && (
                    <button
                      onClick={() => {
                        setFeedFilter("Working Overtime");
                        document.getElementById("todays-shift-feed")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0 self-start sm:self-auto"
                    >
                      <Zap size={14} />
                      <span>View {dashboardData.summary?.workingOvertimeToday || 0} Overtime Staff</span>
                    </button>
                  )}
                </div>
              )}

              {/* Summary Cards Grid (5 Cards: Total, Present, Overtime, Late, Absent) */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 md:gap-4">
                <button
                  onClick={() => {
                    setActiveTab("registration");
                    setModalSearchTerm("");
                  }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-1.5 text-left hover:border-blue-200 hover:shadow-md transition duration-200 group focus:outline-none w-full"
                >
                  <span className="text-xs text-gray-400 font-bold uppercase tracking-wider group-hover:text-blue-600 transition">Total Staff</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">{dashboardData.summary?.totalEmployees ?? 0}</span>
                    <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">Active ↗</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFeedFilter("Present");
                    document.getElementById("todays-shift-feed")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-1.5 text-left hover:border-emerald-200 hover:shadow-md transition duration-200 group focus:outline-none w-full"
                >
                  <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider group-hover:text-emerald-700 transition">Present Today</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">{dashboardData.summary?.presentToday ?? 0}</span>
                    <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">On-site ↓</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFeedFilter("Working Overtime");
                    document.getElementById("todays-shift-feed")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-sm space-y-1.5 text-left hover:shadow-md transition duration-200 group focus:outline-none w-full ${
                    (dashboardData.summary?.workingOvertimeToday ?? 0) > 0 ? "border-orange-200 bg-orange-50/20" : "border-gray-100 hover:border-orange-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-orange-600 font-bold uppercase tracking-wider group-hover:text-orange-700 transition">Working Overtime</span>
                    {(dashboardData.summary?.workingOvertimeToday ?? 0) > 0 && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-orange-600">{dashboardData.summary?.workingOvertimeToday || 0}</span>
                    <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">OT Duty ↓</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFeedFilter("Late");
                    document.getElementById("todays-shift-feed")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-1.5 text-left hover:border-amber-200 hover:shadow-md transition duration-200 group focus:outline-none w-full"
                >
                  <span className="text-xs text-amber-600 font-bold uppercase tracking-wider group-hover:text-amber-700 transition">Late Checked-In</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl sm:text-3xl font-extrabold text-amber-500">{dashboardData.summary?.lateToday ?? 0}</span>
                    <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">Punctual ↓</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setFeedFilter("Absent");
                    document.getElementById("todays-shift-feed")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm space-y-1.5 text-left hover:border-rose-200 hover:shadow-md transition duration-200 group focus:outline-none w-full"
                >
                  <span className={`text-xs font-bold uppercase tracking-wider transition ${
                    (dashboardData.summary?.isNonWorkingDay || dashboardData.summary?.isHoliday) ? "text-gray-500" : "text-rose-600 group-hover:text-rose-700"
                  }`}>
                    Absent Today
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl sm:text-3xl font-extrabold ${
                      (dashboardData.summary?.isNonWorkingDay || dashboardData.summary?.isHoliday) ? "text-gray-400" : "text-rose-500"
                    }`}>
                      {dashboardData.summary?.absentToday ?? 0}
                    </span>
                    {(dashboardData.summary?.isNonWorkingDay || dashboardData.summary?.isHoliday) ? (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        {dashboardData.summary?.isHoliday ? "Holiday" : "Rest Day"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">Off-duty ↓</span>
                    )}
                  </div>
                </button>
              </div>

              {/* Extra Summary Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Worked Hours ({dashboardFilter})</span>
                    <div className="text-3xl font-extrabold text-[#0F172A] mt-1">{dashboardData.summary?.totalWorkingHours ?? 0} hrs</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                    <Clock size={24} />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Avg Daily Hours ({dashboardFilter})</span>
                    <div className="text-3xl font-extrabold text-[#0F172A] mt-1">{dashboardData.summary?.avgWorkingHours ?? 0} hrs</div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center">
                    <Briefcase size={24} />
                  </div>
                </div>
              </div>

              {/* Charts & Trends Row */}
              <div className="grid grid-cols-1 gap-6">
                
                {/* Employee Performance Trend */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4 w-full">
                  <h3 className="text-sm font-bold text-[#0F172A]">Employee Performance Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[350px] overflow-y-auto">
                    {(!dashboardData.performance || dashboardData.performance.length === 0) ? (
                      <div className="text-xs text-gray-400 text-center py-10 font-medium col-span-full">
                        No performance stats loaded
                      </div>
                    ) : (
                      dashboardData.performance.map((p, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-700">{p.full_name}</span>
                            <span className="font-mono text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-100">{(p.avg_hours || 0).toFixed(1)} hrs/day</span>
                          </div>
                          
                          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${p.avg_hours >= 8 ? "bg-emerald-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(100, ((p.avg_hours || 0) / 10) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Today's Daily Activity Feed */}
              <div id="todays-shift-feed" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-md shadow-slate-100/40 space-y-4 w-full relative border-l-4 border-l-blue-600">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A]">Today's Shift Feed</h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">Live attendance and session breakdowns for employee shifts</p>
                  </div>
                  <div className="flex gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl shrink-0 overflow-x-auto">
                    {(["All", "Present", "Working Overtime", "Late", "Absent", "Permission"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setFeedFilter(opt)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition whitespace-nowrap ${
                          feedFilter === opt 
                            ? opt === "Present" ? "bg-emerald-600 text-white"
                              : opt === "Working Overtime" ? "bg-orange-600 text-white"
                              : opt === "Late" ? "bg-amber-500 text-white"
                              : opt === "Absent" ? "bg-rose-500 text-white"
                              : opt === "Permission" ? "bg-blue-600 text-white"
                              : "bg-slate-700 text-white"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border border-gray-100 rounded-xl overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                  <table className="w-full text-left text-xs text-gray-500 min-w-[800px]">
                    <thead className="bg-slate-50 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="p-3.5">Employee Name</th>
                        <th className="p-3.5">Morning Session</th>
                        <th className="p-3.5">Afternoon Session</th>
                        <th className="p-3.5">Total Hours</th>
                        <th className="p-3.5">Punctuality / Shift Status</th>
                        <th className="p-3.5 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {(() => {
                        const todayStr = getEthiopianDateString();
                        const todayLogs = attendanceHistory.filter(h => h.date === todayStr);
                        const isTodayNonWorking = !!(dashboardData?.summary?.isNonWorkingDay || dashboardData?.summary?.isHoliday);
                        
                        // Approved permissions and attendance requests for today
                        const todayPermissions = permissions.filter(p => 
                          p.status === "Approved" && 
                          todayStr >= p.start_date && 
                          todayStr <= p.end_date
                        );
                        const todayAttendanceReqs = attendanceRequests.filter(r =>
                          r.status === "Approved" &&
                          r.date === todayStr
                        );

                        // Group logs by user_id, pre-populated with all registered employees of role 'Employee', etc.
                        const groupedTodayLogs: Record<number, {
                          user_id: number;
                          full_name: string;
                          role: string;
                          morning: any;
                          afternoon: any;
                          approvedPermission: any;
                          approvedAttendanceReq: any;
                        }> = {};

                        const staffRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR", "AdminCreator", "AdminManager", "Admin", "SuperAdmin"];
                        employees.filter(e => staffRoles.includes(e.role)).forEach(e => {
                          groupedTodayLogs[e.id] = {
                            user_id: e.id,
                            full_name: e.full_name || "Registered Staff",
                            role: e.role || "Employee",
                            morning: null,
                            afternoon: null,
                            approvedPermission: todayPermissions.find(p => p.user_id === e.id) || null,
                            approvedAttendanceReq: todayAttendanceReqs.find(r => r.user_id === e.id) || null,
                          };
                        });

                        for (const log of todayLogs) {
                          const uid = log.user_id;
                          if (!groupedTodayLogs[uid]) {
                            const emp = employees.find(e => e.id === uid);
                            groupedTodayLogs[uid] = {
                              user_id: uid,
                              full_name: log.full_name || emp?.full_name || `Staff #${uid}`,
                              role: log.role || emp?.role || "Staff",
                              morning: null,
                              afternoon: null,
                              approvedPermission: todayPermissions.find(p => p.user_id === uid) || null,
                              approvedAttendanceReq: todayAttendanceReqs.find(r => r.user_id === uid) || null,
                            };
                          }
                          if (groupedTodayLogs[uid]) {
                            if (log.session === "Morning") {
                              groupedTodayLogs[uid].morning = log;
                            } else if (log.session === "Afternoon") {
                              groupedTodayLogs[uid].afternoon = log;
                            } else {
                              // Fallback if session is not set
                              if (!groupedTodayLogs[uid].morning) {
                                groupedTodayLogs[uid].morning = log;
                              } else {
                                groupedTodayLogs[uid].afternoon = log;
                              }
                            }
                          }
                        }

                        let groupedList = Object.values(groupedTodayLogs);

                        // Apply the dashboard card filter
                        if (feedFilter === "Present") {
                          groupedList = groupedList.filter(g => 
                            (g.morning && ["Present", "Late", "Authorized"].includes(g.morning.status)) || 
                            (g.afternoon && ["Present", "Late", "Authorized"].includes(g.afternoon.status))
                          );
                        } else if (feedFilter === "Working Overtime") {
                          groupedList = groupedList.filter(g => {
                            const isMorningOt = g.morning && (
                              ["REST_DAY_OVERTIME", "HOLIDAY_OVERTIME", "REGULAR_OVERTIME", "NIGHT_OVERTIME"].includes(g.morning.attendance_type) ||
                              g.morning.work_status === "NON_WORKING" ||
                              isTodayNonWorking ||
                              g.morning.overtime_status != null ||
                              (g.morning.overtime_hours && g.morning.overtime_hours > 0)
                            );
                            const isAfternoonOt = g.afternoon && (
                              ["REST_DAY_OVERTIME", "HOLIDAY_OVERTIME", "REGULAR_OVERTIME", "NIGHT_OVERTIME"].includes(g.afternoon.attendance_type) ||
                              g.afternoon.work_status === "NON_WORKING" ||
                              isTodayNonWorking ||
                              g.afternoon.overtime_status != null ||
                              (g.afternoon.overtime_hours && g.afternoon.overtime_hours > 0)
                            );
                            return (isMorningOt && ["Present", "Late", "Authorized"].includes(g.morning?.status)) ||
                                   (isAfternoonOt && ["Present", "Late", "Authorized"].includes(g.afternoon?.status));
                          });
                        } else if (feedFilter === "Late") {
                          groupedList = groupedList.filter(g => g.morning?.status === "Late" || g.afternoon?.status === "Late");
                        } else if (feedFilter === "Absent") {
                          if (isTodayNonWorking) {
                            groupedList = [];
                          } else {
                            groupedList = groupedList.filter(g => 
                              (!g.morning || g.morning.status === "Absent") && 
                              (!g.afternoon || g.afternoon.status === "Absent") &&
                              !g.approvedPermission && 
                              !g.approvedAttendanceReq
                            );
                          }
                        } else if (feedFilter === "Permission") {
                          groupedList = groupedList.filter(g => 
                            g.approvedPermission || 
                            g.approvedAttendanceReq || 
                            g.morning?.status === "Permission" || 
                            g.afternoon?.status === "Permission"
                          );
                        }

                        if (groupedList.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-gray-400">
                                {feedFilter === "Absent" && isTodayNonWorking
                                  ? `Today is an official ${dashboardData.summary?.isHoliday ? "holiday" : "non-working day"}. Employees are not marked absent.`
                                  : feedFilter === "All" 
                                  ? "No employees registered" 
                                  : `No employees are ${feedFilter.toLowerCase()} today.`}
                              </td>
                            </tr>
                          );
                        }

                        return groupedList.map((g) => {
                          const totalHrs = parseFloat(
                            ((g.morning?.total_hours || 0) + (g.afternoon?.total_hours || 0)).toFixed(2)
                          );
                          const currentEthHour = parseInt(getEthiopianTimeString(currentTime).split(":")[0], 10);
                          const isMorningNow = currentEthHour < 6;

                          const isMorningOt = g.morning && (
                            isTodayNonWorking || 
                            ["REST_DAY_OVERTIME", "HOLIDAY_OVERTIME", "REGULAR_OVERTIME", "NIGHT_OVERTIME"].includes(g.morning.attendance_type) ||
                            g.morning.work_status === "NON_WORKING"
                          );
                          const isAfternoonOt = g.afternoon && (
                            isTodayNonWorking || 
                            ["REST_DAY_OVERTIME", "HOLIDAY_OVERTIME", "REGULAR_OVERTIME", "NIGHT_OVERTIME"].includes(g.afternoon.attendance_type) ||
                            g.afternoon.work_status === "NON_WORKING"
                          );

                          return (
                            <tr key={g.user_id}>
                              <td className="p-3.5 font-bold text-gray-800">{g.full_name}</td>
                              
                              {/* Morning Session Column */}
                              <td className="p-3.5">
                                {g.morning && (g.morning.status !== "Absent") ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-gray-400 uppercase font-extrabold w-6">In:</span>
                                      <span className="font-mono text-xs text-slate-800">
                                        {g.morning.check_in_time || (g.morning.status === "Permission" ? "On Leave" : "Authorized")}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-gray-400 uppercase font-extrabold w-6">Out:</span>
                                      <span className="font-mono text-xs text-slate-800">
                                        {g.morning.check_out_time || (g.morning.check_in_time ? "Active" : "Approved")}
                                      </span>
                                    </div>
                                    {isMorningOt && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded border border-orange-200 w-max">
                                        <Zap size={10} /> Working Overtime
                                      </span>
                                    )}
                                  </div>
                                ) : g.approvedPermission ? (
                                  <span className="text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-0.5 font-bold text-[10px] flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> {g.approvedPermission.request_type}
                                  </span>
                                ) : g.approvedAttendanceReq ? (
                                  <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 font-bold text-[10px] flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {g.approvedAttendanceReq.type}
                                  </span>
                                ) : isTodayNonWorking ? (
                                  <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 font-bold text-[10px] inline-flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-600" />
                                    {dashboardData?.summary?.isHoliday ? "Holiday Off" : "Rest Day Off"}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-0.5 font-bold text-[10px]">Absent</span>
                                )}
                              </td>

                              {/* Afternoon Session Column */}
                              <td className="p-3.5">
                                {g.afternoon && (g.afternoon.status !== "Absent") ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-gray-400 uppercase font-extrabold w-6">In:</span>
                                      <span className="font-mono text-xs text-slate-800">
                                        {g.afternoon.check_in_time || (g.afternoon.status === "Permission" ? "On Leave" : "Authorized")}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] text-gray-400 uppercase font-extrabold w-6">Out:</span>
                                      <span className="font-mono text-xs text-slate-800">
                                        {g.afternoon.check_out_time || (g.afternoon.check_in_time ? "Active" : "Approved")}
                                      </span>
                                    </div>
                                    {isAfternoonOt && (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-orange-700 bg-orange-100/80 px-1.5 py-0.5 rounded border border-orange-200 w-max">
                                        <Zap size={10} /> Working Overtime
                                      </span>
                                    )}
                                  </div>
                                ) : isMorningNow ? (
                                  <span className="text-gray-300 font-normal">-</span>
                                ) : g.approvedPermission ? (
                                  <span className="text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-0.5 font-bold text-[10px] flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> {g.approvedPermission.request_type}
                                  </span>
                                ) : g.approvedAttendanceReq ? (
                                  <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 font-bold text-[10px] flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {g.approvedAttendanceReq.type}
                                  </span>
                                ) : isTodayNonWorking ? (
                                  <span className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 font-bold text-[10px] inline-flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-amber-600" />
                                    {dashboardData?.summary?.isHoliday ? "Holiday Off" : "Rest Day Off"}
                                  </span>
                                ) : (
                                  <span className="text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-0.5 font-bold text-[10px]">Absent</span>
                                )}
                              </td>

                              <td className="p-3.5 font-bold text-slate-800">{totalHrs} hrs</td>
                              
                              <td className="p-3.5">
                                <div className="flex flex-col gap-1">
                                  {g.morning ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max ${
                                      isMorningOt ? "bg-orange-100 text-orange-800 border border-orange-200" :
                                      ["Present", "Permission", "Authorized"].includes(g.morning.status) ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                      g.morning.status === "Late" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                      "bg-rose-50 text-rose-600 border border-rose-100"
                                    }`}>
                                      {isMorningOt ? "AM: Working Overtime" : `AM: ${g.morning.status}`}
                                    </span>
                                  ) : g.approvedPermission ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-blue-50 text-blue-600 border border-blue-100">
                                      AM: {g.approvedPermission.request_type}
                                    </span>
                                  ) : g.approvedAttendanceReq ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-indigo-50 text-indigo-600 border border-indigo-100">
                                      AM: {g.approvedAttendanceReq.type}
                                    </span>
                                  ) : isTodayNonWorking ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-amber-50 text-amber-700 border border-amber-200">
                                      AM: {dashboardData?.summary?.isHoliday ? "Holiday Off" : "Rest Day Off"}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-rose-50 text-rose-600 border border-rose-100">
                                      AM: Absent
                                    </span>
                                  )}
                                  {g.afternoon ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max ${
                                      isAfternoonOt ? "bg-orange-100 text-orange-800 border border-orange-200" :
                                      ["Present", "Permission", "Authorized"].includes(g.afternoon.status) ? "bg-indigo-50 text-indigo-600 border border-indigo-100" :
                                      g.afternoon.status === "Late" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                      "bg-rose-50 text-rose-600 border border-rose-100"
                                    }`}>
                                      {isAfternoonOt ? "PM: Working Overtime" : `PM: ${g.afternoon.status}`}
                                    </span>
                                  ) : isMorningNow ? null : g.approvedPermission ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-blue-50 text-blue-600 border border-blue-100">
                                      PM: {g.approvedPermission.request_type}
                                    </span>
                                  ) : g.approvedAttendanceReq ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-indigo-50 text-indigo-600 border border-indigo-100">
                                      PM: {g.approvedAttendanceReq.type}
                                    </span>
                                  ) : isTodayNonWorking ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-amber-50 text-amber-700 border border-amber-200">
                                      PM: {dashboardData?.summary?.isHoliday ? "Holiday Off" : "Rest Day Off"}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold inline-block w-max bg-rose-50 text-rose-600 border border-rose-100">
                                      PM: Absent
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3.5 text-right">
                                <button
                                  onClick={() => {
                                    setSelectedEmployeeId(g.user_id);
                                    setSelectedEmployeeTab("monthly");
                                    setModalSearchTerm("");
                                    setModalStatusFilter("All");
                                    setModalCustomRate("");
                                  }}
                                  className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold transition text-[11px] hover:shadow-sm"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-100 shadow-sm text-center space-y-4">
              <div className="w-10 h-10 rounded-full border-3 border-blue-600 border-t-transparent animate-spin"></div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Loading Dashboard Metrics</h3>
                <p className="text-xs text-slate-500 mt-1">Fetching real-time workforce analytics and Ethiopian work calendar status...</p>
              </div>
              <button
                type="button"
                onClick={() => fetchDashboard(dashboardFilter)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Refresh Metrics
              </button>
            </div>
          ))}

          {/* Module 2: Approvals */}
          {activeTab === "approvals" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Approvals Panel</h2>
                <p className="text-gray-500 text-sm mt-0.5">Approve permission/leave requests and site adjustment hours</p>
              </div>

              {/* 1. Permission Requests List */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <FileText size={18} className="text-purple-600" /> Permission & Leave Approvals
                </h3>

                <div className="border border-gray-100 rounded-xl overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs text-gray-500 min-w-[700px]">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="p-3.5">Employee</th>
                        <th className="p-3.5">Request Type</th>
                        <th className="p-3.5">Duration</th>
                        <th className="p-3.5">Reason</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {permissions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400">
                            No leave or permission requests logged
                          </td>
                        </tr>
                      ) : (
                        permissions.map((p) => (
                          <tr key={p.id}>
                            <td className="p-3.5 font-bold text-gray-800">{p.full_name}</td>
                            <td className="p-3.5 font-bold text-purple-600">
                              <div className="flex items-center gap-1.5">
                                <span>{p.request_type}</span>
                                {p.session && p.session !== "Full Day" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                                    {p.session}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5 text-gray-500">
                              {p.start_date} to {p.end_date}
                              {p.status === "Approved" && p.approved_from_date && (
                                <div className="text-[10px] text-emerald-600 font-bold mt-0.5">
                                  Approved: {p.approved_from_date} to {p.approved_to_date}
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-gray-500 max-w-[200px] truncate" title={p.reason}>{p.reason}</td>
                            <td className="p-3.5">
                              <span className={getStatusPill(p.status)}>{p.status}</span>
                            </td>
                            <td className="p-3.5 text-right">
                              {p.status === "Pending" ? (
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedPermission(p);
                                      setAppFromDate(p.start_date);
                                      setAppToDate(p.end_date);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded text-[11px] transition"
                                  >
                                    Approve...
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const ok = await approvePermission(p.id, "Rejected");
                                      if (ok) {
                                        triggerNotification("success", "Leave permission rejected.");
                                      } else {
                                        triggerNotification("error", "Failed to reject permission.");
                                      }
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1 px-2.5 rounded text-[11px] transition"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[11px]">Processed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Attendance Adjustments List */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-1.5">
                  <MapPin size={18} className="text-teal-600" /> Attendance Adjustment Requests (Site Visits / External Work)
                </h3>

                <div className="border border-gray-100 rounded-xl overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs text-gray-500 min-w-[700px]">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="p-3.5">Employee</th>
                        <th className="p-3.5">Adjustment Type</th>
                        <th className="p-3.5">Date & Times</th>
                        <th className="p-3.5">Reason</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {attendanceRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400">
                            No attendance adjustments logged
                          </td>
                        </tr>
                      ) : (
                        attendanceRequests.map((r) => (
                          <tr key={r.id}>
                            <td className="p-3.5 font-bold text-gray-800">{r.full_name}</td>
                            <td className="p-3.5 font-bold text-teal-600">
                              <div className="flex items-center gap-1.5">
                                <span>{r.type}</span>
                                {r.request_scope === "Site Check-Out" ? (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                                    Site Out
                                  </span>
                                ) : (
                                  r.session && r.session !== "Full Day" && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                                      {r.session}
                                    </span>
                                  )
                                )}
                              </div>
                            </td>
                            <td className="p-3.5 text-gray-500">
                              {r.date} ({r.check_in_time} - {r.check_out_time})
                            </td>
                            <td className="p-3.5 text-gray-500 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                            <td className="p-3.5">
                              <span className={getStatusPill(r.status)}>{r.status}</span>
                            </td>
                            <td className="p-3.5 text-right">
                              {r.status === "Pending" ? (
                                <div className="inline-flex gap-2">
                                  <button
                                    onClick={async () => {
                                      const ok = await approveAttendanceRequest(r.id, "Approved");
                                      if (ok) {
                                        triggerNotification("success", "Attendance adjustment approved.");
                                      } else {
                                        triggerNotification("error", "Action failed.");
                                      }
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded text-[11px] transition"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const ok = await approveAttendanceRequest(r.id, "Rejected");
                                      if (ok) {
                                        triggerNotification("success", "Attendance adjustment rejected.");
                                      } else {
                                        triggerNotification("error", "Action failed.");
                                      }
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1 px-2.5 rounded text-[11px] transition"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[11px]">Processed</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Permission approval dates config modal/form overlay */}
              {selectedPermission && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-gray-100 shadow-xl space-y-4">
                    <h3 className="text-lg font-bold text-gray-800">Set Approved Date Range</h3>
                    <p className="text-xs text-gray-500">
                      Approve leave for <span className="font-bold">{selectedPermission.full_name}</span>. Original requested dates: {selectedPermission.start_date} to {selectedPermission.end_date}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">From Date</label>
                        <input 
                          type="date"
                          value={appFromDate}
                          onChange={(e) => setAppFromDate(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">To Date</label>
                        <input 
                          type="date"
                          value={appToDate}
                          onChange={(e) => setAppToDate(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-gray-200"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2.5 justify-end">
                      <button
                        onClick={() => setSelectedPermission(null)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-lg text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handlePermissionApprovalSubmit("Approved")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs"
                      >
                        Confirm Approval
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Employee Details popup modal */}
          {selectedEmployeeId !== null && (() => {
                const selectedEmp = employees.find(e => e.id === selectedEmployeeId) || {
                  id: selectedEmployeeId,
                  full_name: attendanceHistory.find(h => h.user_id === selectedEmployeeId)?.full_name || "Registered Employee",
                  phone_number: attendanceHistory.find(h => h.user_id === selectedEmployeeId)?.phone_number || "No Phone Registered",
                  role: "Employee",
                  hourly_rate: 25.0
                };

                const empLogs = attendanceHistory.filter(h => h.user_id === selectedEmployeeId);
                const now = currentTime;
                const todayStr = getEthiopianDateString(now);

                let filteredPeriodLogs: any[] = [];
                let tabTitle = "";
                let description = "";

                if (selectedEmployeeTab === "today") {
                  filteredPeriodLogs = empLogs.filter(l => l.date === todayStr);
                  tabTitle = "Today's Attendance Status";
                  description = "Detailed parameters of today's active shift log.";
                } else if (selectedEmployeeTab === "weekly") {
                  filteredPeriodLogs = empLogs.filter(l => {
                    const logTime = new Date(l.date + 'T00:00:00').getTime();
                    const todayStart = new Date(todayStr + 'T00:00:00').getTime();
                    const diffDays = (todayStart - logTime) / (1000 * 60 * 60 * 24);
                    return diffDays >= 0 && diffDays < 7;
                  });
                  tabTitle = "Weekly Analytics";
                  description = "Historical performance from the last 7 calendar days.";
                } else if (selectedEmployeeTab === "monthly") {
                  const [currYear, currMonth] = todayStr.split("-").map(Number);
                  let activeDetailMonth = selectedDetailMonth;
                  if (!activeDetailMonth || activeDetailMonth === "all") {
                    activeDetailMonth = String(currMonth).padStart(2, "0");
                  }
                  const activeDetailYear = currYear;

                  filteredPeriodLogs = empLogs.filter(l => {
                    const parts = l.date.split("-");
                    if (parts.length < 2) return false;
                    const logYear = Number(parts[0]);
                    const logMonth = parts[1]; // e.g. "01" or "10"
                    return logMonth === activeDetailMonth && logYear === activeDetailYear;
                  });
                  const monthName = ETHIOPIAN_MONTH_NAMES[Number(activeDetailMonth)] || "Selected Month";
                  tabTitle = `${monthName} ${activeDetailYear} Attendance Matrix`;
                  description = `Monthly breakdown and interactive attendance grid for ${monthName}.`;
                } else if (selectedEmployeeTab === "yearly") {
                  const [currYear, currMonth] = todayStr.split("-").map(Number);
                  const activeDetailMonth = selectedDetailMonth || "all";
                  const activeDetailYear = currYear;

                  filteredPeriodLogs = empLogs.filter(l => {
                    const parts = l.date.split("-");
                    if (parts.length < 2) return false;
                    
                    // Filter within 365 days
                    const logTime = new Date(l.date + 'T00:00:00').getTime();
                    const todayStart = new Date(todayStr + 'T00:00:00').getTime();
                    const diffDays = (todayStart - logTime) / (1000 * 60 * 60 * 24);
                    const withinYear = diffDays >= 0 && diffDays < 365;

                    if (!withinYear) return false;

                    if (activeDetailMonth !== "all") {
                      const logMonth = parts[1];
                      return logMonth === activeDetailMonth;
                    }
                    return true;
                  });

                  if (activeDetailMonth !== "all") {
                    const monthName = ETHIOPIAN_MONTH_NAMES[Number(activeDetailMonth)] || "Selected Month";
                    tabTitle = `Yearly Ledger - ${monthName} Filter`;
                    description = `Attendance metrics for ${monthName} within the past year.`;
                  } else {
                    tabTitle = "Yearly Attendance Ledger";
                    description = `Consolidated performance overview for the last 365 days.`;
                  }
                }

                // Apply interactive search and status filtering on the logs
                let finalLogs = [...filteredPeriodLogs];
                if (modalStatusFilter !== "All") {
                  finalLogs = finalLogs.filter(l => l.status === modalStatusFilter);
                }
                if (modalSearchTerm.trim() !== "") {
                  const query = modalSearchTerm.toLowerCase();
                  finalLogs = finalLogs.filter(l => 
                    l.date.toLowerCase().includes(query) || 
                    (l.check_in_time && l.check_in_time.toLowerCase().includes(query)) ||
                    (l.check_out_time && l.check_out_time.toLowerCase().includes(query)) ||
                    l.status.toLowerCase().includes(query)
                  );
                }

                // Compute stats
                const totalHours = parseFloat((filteredPeriodLogs.reduce((sum, l) => sum + (l.total_hours || 0), 0)).toFixed(1));
                const totalDays = filteredPeriodLogs.length;
                const uniqueDaysLogged = new Set(filteredPeriodLogs.map(l => l.date)).size;
                const presentCount = filteredPeriodLogs.filter(l => ["Present", "Permission", "Authorized"].includes(l.status)).length;
                const lateCount = filteredPeriodLogs.filter(l => l.status === "Late").length;
                const absentCount = filteredPeriodLogs.filter(l => l.status === "Absent").length;
                const punctuality = totalDays > 0 ? Math.round(((presentCount + lateCount) / totalDays) * 100) : 100;

                // Session breakdowns
                const morningLogs = filteredPeriodLogs.filter(l => l.session === "Morning");
                const afternoonLogs = filteredPeriodLogs.filter(l => l.session === "Afternoon");

                const morningHours = parseFloat(morningLogs.reduce((sum, l) => sum + (l.total_hours || 0), 0).toFixed(2));
                const morningPresent = morningLogs.filter(l => l.status === "Present").length;
                const morningLate = morningLogs.filter(l => l.status === "Late").length;
                const morningTotal = morningLogs.length;
                const morningPunctuality = morningTotal > 0 ? Math.round((morningPresent / morningTotal) * 100) : 100;

                const afternoonHours = parseFloat(afternoonLogs.reduce((sum, l) => sum + (l.total_hours || 0), 0).toFixed(2));
                const afternoonPresent = afternoonLogs.filter(l => l.status === "Present").length;
                const afternoonLate = afternoonLogs.filter(l => l.status === "Late").length;
                const afternoonTotal = afternoonLogs.length;
                const afternoonPunctuality = afternoonTotal > 0 ? Math.round((afternoonPresent / afternoonTotal) * 100) : 100;
                
                // Interactive payout calculator (updates live if custom hourly rate is entered)
                const effectiveRate = modalCustomRate !== "" ? parseFloat(modalCustomRate) || 0 : selectedEmp.hourly_rate || 25;
                const hours10 = Math.round(totalHours * 10);
                const rate100 = Math.round(effectiveRate * 100);
                const estimatedPayout = Math.round((hours10 * rate100) / 10) / 100;

                return (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-5xl w-full border border-gray-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all">
                      {/* Modal Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shrink-0 relative">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2.5 py-1 rounded-md text-white/90">
                              Interactive Employee Diagnostic
                            </span>
                            <h3 className="text-xl font-bold mt-2">{selectedEmp.full_name}</h3>
                            <p className="text-xs text-blue-100 mt-1">
                              Phone: <span className="font-mono">{selectedEmp.phone_number}</span> • Registered Rate: <span className="font-bold">ETB {selectedEmp.hourly_rate?.toFixed(2)}/hr</span>
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedEmployeeId(null)}
                            className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition text-white/90"
                          >
                            <XCircle size={20} />
                          </button>
                        </div>

                        {/* Modal Sub-Tabs (Interactive Period selector) */}
                        <div className="flex gap-1 bg-white/10 p-1 rounded-xl mt-6">
                          {(["today", "weekly", "monthly", "yearly"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setSelectedEmployeeTab(t)}
                              className={`flex-1 text-center py-2 text-xs font-bold capitalize rounded-lg transition-all ${
                                selectedEmployeeTab === t
                                  ? "bg-white text-blue-700 shadow-md"
                                  : "text-white/80 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Modal Body (Scrollable) */}
                      <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
                        {/* Title block */}
                        <div className="border-b border-gray-100 pb-4">
                          <h4 className="text-base font-bold text-slate-800">{tabTitle}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                        </div>

                        {/* Beautiful 2-Column Responsive Layout */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                          
                          {/* LEFT COLUMN: Analytics & Calculator (col-span-4) */}
                          <div className="lg:col-span-4 space-y-6">
                            
                            {/* Ethiopian Month Selector Widget (for monthly & yearly) */}
                            {(selectedEmployeeTab === "monthly" || selectedEmployeeTab === "yearly") && (() => {
                              const [currYear, currMonth] = todayStr.split("-").map(Number);
                              const activeDetailMonth = selectedDetailMonth || String(currMonth).padStart(2, "0");
                              
                              return (
                                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-md space-y-3 relative overflow-hidden">
                                  {/* Decorative top stripe */}
                                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                                  
                                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                      <Calendar size={15} />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">Evaluation Period</h5>
                                      <p className="text-[10px] text-slate-400 font-semibold">Select month to filter logs</p>
                                    </div>
                                  </div>

                                  <div className="space-y-1 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                                    {/* Option for Full Year (only shown or particularly relevant for Yearly) */}
                                    {selectedEmployeeTab === "yearly" && (
                                      <button
                                        onClick={() => setSelectedDetailMonth("all")}
                                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                          activeDetailMonth === "all"
                                            ? "bg-blue-600 text-white shadow-sm"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                      >
                                        <span className="flex items-center gap-2">
                                          <span className={`w-1.5 h-1.5 rounded-full ${
                                            activeDetailMonth === "all" ? "bg-white" : "bg-indigo-400"
                                          }`} />
                                          Full Year (All Months)
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                          activeDetailMonth === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                        }`}>
                                          {empLogs.length} logs
                                        </span>
                                      </button>
                                    )}

                                    {Array.from({ length: 13 }, (_, i) => i + 1).map((m) => {
                                      const val = String(m).padStart(2, "0");
                                      const monthName = ETHIOPIAN_MONTH_NAMES[m];
                                      
                                      // Count logs for this specific month in the current active year
                                      const [currYear] = todayStr.split("-").map(Number);
                                      const monthLogCount = empLogs.filter(l => {
                                        const parts = l.date.split("-");
                                        return parts[0] === String(currYear) && parts[1] === val;
                                      }).length;

                                      return (
                                        <button
                                          key={m}
                                          onClick={() => {
                                            setSelectedDetailMonth(val);
                                          }}
                                          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${
                                            activeDetailMonth === val
                                              ? "bg-blue-600 text-white shadow-sm"
                                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                          }`}
                                        >
                                          <span className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                              activeDetailMonth === val ? "bg-white" : "bg-blue-500"
                                            }`} />
                                            {m}. {monthName}
                                          </span>
                                          {monthLogCount > 0 && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-black ${
                                              activeDetailMonth === val ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                                            }`}>
                                              {monthLogCount} {monthLogCount === 1 ? 'log' : 'logs'}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            {/* Bento Statistics Grid (Rearranged as 2x2 compact grid) */}
                            <div className="space-y-3">
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Diagnostic Performance Metrics</h5>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hours Tracked</span>
                                  <div className="text-lg font-black text-slate-800 font-mono mt-1">{totalHours} hrs</div>
                                  <span className="text-[8px] text-slate-400 mt-1 block">Total active work</span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Punctuality</span>
                                  <div className={`text-lg font-black font-mono mt-1 ${punctuality >= 90 ? "text-emerald-600" : punctuality >= 75 ? "text-amber-500" : "text-rose-600"}`}>
                                    {punctuality}%
                                  </div>
                                  <span className="text-[8px] text-slate-400 mt-1 block">Attendance ratio</span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Days Logged</span>
                                  <div className="text-lg font-black text-slate-800 font-mono mt-1">{totalDays} shifts</div>
                                  <span className="text-[8px] text-slate-400 mt-1 block">Total shift count</span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Payout Rate</span>
                                  <div className="text-lg font-black text-indigo-600 font-mono mt-1">${effectiveRate.toFixed(1)}/hr</div>
                                  <span className="text-[8px] text-slate-400 mt-1 block">Effective multiplier</span>
                                </div>
                              </div>
                            </div>

                            {/* Interactive Payout Calculator Tuning Widget */}
                            <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100/50 space-y-3 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                                  <DollarSign size={15} />
                                  Interactive Payout Calculator
                                </span>
                                <span className="text-[9px] text-blue-500 font-extrabold bg-blue-100/60 px-2 py-0.5 rounded">Live Engine</span>
                              </div>
                              <div className="space-y-2.5">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Tune Hourly Rate (ETB)</label>
                                  <input
                                    type="number"
                                    value={modalCustomRate}
                                    placeholder={`${selectedEmp.hourly_rate || 25}`}
                                    onChange={(e) => setModalCustomRate(e.target.value)}
                                    className="w-full text-xs font-bold bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500 shadow-sm"
                                  />
                                </div>
                                <div className="pt-2 border-t border-blue-100 flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">Projected Earnings</span>
                                  <span className="text-xl font-black text-blue-600 font-mono">ETB {estimatedPayout.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Ratio Progress Bars */}
                            {selectedEmployeeTab !== "today" && (
                              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Attendance Distribution</h5>
                                <div className="h-2 rounded-full overflow-hidden bg-slate-100 flex">
                                  <div style={{ width: `${totalDays > 0 ? (presentCount / totalDays) * 100 : 100}%` }} className="bg-emerald-500 h-full" title="Present" />
                                  <div style={{ width: `${totalDays > 0 ? (lateCount / totalDays) * 100 : 0}%` }} className="bg-amber-500 h-full" title="Late" />
                                  <div style={{ width: `${totalDays > 0 ? (absentCount / totalDays) * 100 : 0}%` }} className="bg-rose-500 h-full" title="Absent" />
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] font-bold">
                                  <div className="flex items-center gap-1.5 text-emerald-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>Present: {presentCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-amber-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    <span>Late: {lateCount}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-rose-600">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>Absent: {absentCount}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Session-Specific Diagnostics (Morning vs. Afternoon summary) */}
                            <div className="space-y-3">
                              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Shift Performance Matrix</h5>
                              
                              {/* Morning Session Card */}
                              <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm space-y-2.5">
                                <div className="flex justify-between items-center pb-1.5 border-b border-slate-50">
                                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Morning Shift
                                  </span>
                                  <span className="text-[8px] text-slate-400 font-bold">02:00 - 06:00 (Ethiopian Time)</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                  <div className="bg-slate-50/50 p-1 rounded-lg">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase block">Hours</span>
                                    <span className="text-[10px] font-bold text-slate-700 font-mono">{morningHours.toFixed(1)} hrs</span>
                                  </div>
                                  <div className="bg-slate-50/50 p-1 rounded-lg">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase block">On-Time</span>
                                    <span className="text-[10px] font-bold text-emerald-600 font-mono">{morningPresent}</span>
                                  </div>
                                  <div className="bg-slate-50/50 p-1 rounded-lg">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase block">Late</span>
                                    <span className="text-[10px] font-bold text-amber-500 font-mono">{morningLate}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Afternoon Session Card */}
                              <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-sm space-y-2.5">
                                <div className="flex justify-between items-center pb-1.5 border-b border-slate-50">
                                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                    Afternoon Shift
                                  </span>
                                  <span className="text-[8px] text-slate-400 font-bold">07:00 - 11:00 (Ethiopian Time)</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 text-center">
                                  <div className="bg-slate-50/50 p-1 rounded-lg">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase block">Hours</span>
                                    <span className="text-[10px] font-bold text-slate-700 font-mono">{afternoonHours.toFixed(1)} hrs</span>
                                  </div>
                                  <div className="bg-slate-50/50 p-1 rounded-lg">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase block">On-Time</span>
                                    <span className="text-[10px] font-bold text-indigo-600 font-mono">{afternoonPresent}</span>
                                  </div>
                                  <div className="bg-slate-50/50 p-1 rounded-lg">
                                    <span className="text-[7px] text-slate-400 font-bold uppercase block">Late</span>
                                    <span className="text-[10px] font-bold text-amber-500 font-mono">{afternoonLate}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* RIGHT COLUMN: Interactive Month Select, Checked Grid, and Logs Table (col-span-8) */}
                          <div className="lg:col-span-8 space-y-6">
                            
                            {/* Monthly Mode Select and Beautiful Attendance Grid */}
                            {selectedEmployeeTab === "monthly" && (() => {
                              const [currYear, currMonth] = todayStr.split("-").map(Number);
                              const activeDetailMonth = selectedDetailMonth || String(currMonth).padStart(2, "0");
                              const activeDetailYear = currYear;
                              const daysInMonth = Number(activeDetailMonth) === 13 ? 6 : 30;

                              return (
                                <div className="space-y-4">
                                  {/* Active Month Selected Header Banner */}
                                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                        <Calendar size={18} />
                                      </div>
                                      <div>
                                        <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                          Ethiopian Month Matrix: {ETHIOPIAN_MONTH_NAMES[Number(activeDetailMonth)]}
                                        </h5>
                                        <p className="text-[11px] text-slate-400 font-semibold">
                                          Grid layout ledger for month {activeDetailMonth} of year {activeDetailYear} (Selected on the left)
                                        </p>
                                      </div>
                                    </div>
                                    <span className="text-xs font-black text-blue-700 bg-blue-50/50 border border-blue-100 px-3 py-1.5 rounded-lg shrink-0">
                                      {ETHIOPIAN_MONTH_NAMES[Number(activeDetailMonth)]} ({activeDetailMonth})
                                    </span>
                                  </div>

                                  {/* Grid Layout Table Form with checked circles */}
                                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                                    <div className="flex justify-between items-center">
                                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Attendance Grid Matrix</h5>
                                      <div className="flex gap-3 text-[9px] font-bold">
                                        <span className="flex items-center gap-1 text-slate-500">
                                          <span className="w-1.5 h-1.5 rounded-sm bg-slate-200" /> Unattended
                                        </span>
                                        <span className="flex items-center gap-1 text-emerald-600">
                                          <span className="w-1.5 h-1.5 rounded-sm bg-emerald-500" /> AM Present
                                        </span>
                                        <span className="flex items-center gap-1 text-indigo-600">
                                          <span className="w-1.5 h-1.5 rounded-sm bg-indigo-500" /> PM Present
                                        </span>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                                        const dayStr = String(d).padStart(2, "0");
                                        const fullDateStr = `${activeDetailYear}-${activeDetailMonth}-${dayStr}`;
                                        const dayLogs = empLogs.filter(l => l.date === fullDateStr);
                                        const mRec = dayLogs.find(l => l.session === "Morning");
                                        const aRec = dayLogs.find(l => l.session === "Afternoon");

                                        const isMPresent = mRec && ["Present", "Late", "Permission", "Authorized"].includes(mRec.status);
                                        const isAPresent = aRec && ["Present", "Late", "Permission", "Authorized"].includes(aRec.status);

                                        return (
                                          <div 
                                            key={d} 
                                            className="bg-white rounded-xl border border-slate-100 p-2.5 flex flex-col justify-between hover:shadow-md hover:border-blue-100 transition-all duration-200 shadow-sm"
                                          >
                                            <div className="flex justify-between items-center mb-1.5">
                                              <span className="text-[11px] font-black text-slate-700">Day {dayStr}</span>
                                              <span className="text-[9px] text-slate-400 font-mono">{ETHIOPIAN_MONTH_NAMES[Number(activeDetailMonth)].slice(0,3)} {d}</span>
                                            </div>
                                            <div className="space-y-1 bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/50">
                                              <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-slate-500 font-bold">Morning</span>
                                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                                                  isMPresent 
                                                    ? "bg-emerald-500 border-emerald-600 text-white shadow-sm" 
                                                    : "bg-slate-100 border-slate-200 text-transparent"
                                                }`}>
                                                  <Check size={9} strokeWidth={4} />
                                                </div>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-[9px] text-slate-500 font-bold">Afternoon</span>
                                                <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                                                  isAPresent 
                                                    ? "bg-indigo-500 border-indigo-600 text-white shadow-sm" 
                                                    : "bg-slate-100 border-slate-200 text-transparent"
                                                }`}>
                                                  <Check size={9} strokeWidth={4} />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Raw Logs Table and Advanced Search Filters */}
                            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div>
                                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Interactive Filter Board</h5>
                                  <p className="text-[10px] text-slate-500 font-medium">Search, filter, or export raw session records</p>
                                </div>
                                <div className="flex gap-1.5 bg-slate-50 border border-gray-200 p-1 rounded-lg self-stretch sm:self-auto">
                                  {(["All", "Present", "Late"] as const).map((st) => (
                                    <button
                                      key={st}
                                      onClick={() => setModalStatusFilter(st)}
                                      className={`flex-1 sm:flex-initial px-3 py-1 text-[10px] font-bold rounded transition-all ${
                                        modalStatusFilter === st
                                          ? "bg-blue-600 text-white shadow-sm"
                                          : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                      }`}
                                    >
                                      {st}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="flex gap-3">
                                <div className="flex-1 relative">
                                  <input
                                    type="text"
                                    placeholder="Search logs by date, session or check-in..."
                                    value={modalSearchTerm}
                                    onChange={(e) => setModalSearchTerm(e.target.value)}
                                    className="w-full text-xs bg-slate-50 border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-gray-700 focus:outline-none focus:border-blue-500 font-semibold shadow-sm"
                                  />
                                  {modalSearchTerm && (
                                    <button 
                                      onClick={() => setModalSearchTerm("")}
                                      className="absolute right-2.5 top-2 py-0.5 text-slate-400 hover:text-slate-600 font-bold text-sm"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Work Logs Table */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <h5 className="text-xs font-bold text-slate-700">Detailed Verification Log ({finalLogs.length} matching)</h5>
                                  {finalLogs.length > 0 && (
                                    <button
                                      onClick={() => {
                                        const headers = ["Date", "Session", "Check-In Time", "Check-Out Time", "Total Hours", "Status"];
                                        const rows = finalLogs.map(log => [log.date, log.session || "Morning", log.check_in_time || "", log.check_out_time || "", log.total_hours || "0", log.status]);
                                        const csvContent = "data:text/csv;charset=utf-8," 
                                          + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
                                        const encodedUri = encodeURI(csvContent);
                                        const link = document.createElement("a");
                                        link.setAttribute("href", encodedUri);
                                        link.setAttribute("download", `${selectedEmp.full_name.replace(/\s+/g, '_')}_ledger.csv`);
                                        document.body.appendChild(link);
                                        link.click();
                                        document.body.removeChild(link);
                                      }}
                                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 transition flex items-center gap-1"
                                    >
                                      📥 Export CSV Ledger
                                    </button>
                                  )}
                                </div>
                                <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto scrollbar-thin shadow-sm max-h-[300px]">
                                  <table className="w-full text-left text-xs text-slate-500 min-w-[500px]">
                                    <thead className="bg-slate-50 border-b border-gray-100 font-bold uppercase text-[9px] tracking-wider text-slate-400 sticky top-0 z-10">
                                      <tr>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Session</th>
                                        <th className="p-3">Check-In</th>
                                        <th className="p-3">Check-Out</th>
                                        <th className="p-3">Total Hours</th>
                                        <th className="p-3 text-right">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-medium text-slate-700">
                                      {finalLogs.length === 0 ? (
                                        <tr>
                                          <td colSpan={6} className="p-8 text-center text-slate-400">
                                            No verified logs found for this period or filters
                                          </td>
                                        </tr>
                                      ) : (
                                        finalLogs.map((log) => (
                                          <tr key={log.id} className="hover:bg-slate-50/50 transition">
                                            <td className="p-3 font-semibold text-slate-800">{log.date}</td>
                                            <td className="p-3">
                                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                                log.session === "Morning" ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                                              }`}>
                                                {log.session || "Morning"}
                                              </span>
                                            </td>
                                            <td className="p-3 font-mono text-slate-600">{log.check_in_time || (log.status === "Present" ? "Authorized" : "--")}</td>
                                            <td className="p-3 font-mono text-slate-600">{log.check_out_time || (log.status === "Present" && !log.check_in_time ? "Permission" : "Active")}</td>
                                            <td className="p-3 font-bold text-slate-800">{log.total_hours} hrs</td>
                                            <td className="p-3 text-right">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                log.status === "Present" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : 
                                                log.status === "Late" ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                                "bg-rose-50 text-rose-600 border border-rose-100"
                                              }`}>
                                                {log.status}
                                              </span>
                                            </td>
                                          </tr>
                                        ))
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="bg-slate-100 border-t border-slate-200/60 p-4 shrink-0 flex justify-between items-center">
                        <div className="text-[11px] text-slate-400 font-semibold font-mono">
                          ID: {selectedEmp.id}
                        </div>
                        <button
                          onClick={() => setSelectedEmployeeId(null)}
                          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition shadow-sm"
                        >
                          Close Diagnostic Ledger
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

          {/* Module 3: Admin Attendance */}
          {activeTab === "attendance" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Admin Attendance</h2>
                <p className="text-gray-500 text-sm mt-0.5">Check-in and check-out to log your administrative worked hours</p>
              </div>

              {/* Missing Check-Outs & Forgotten Shift Alert */}
              <ForgottenCheckoutAlert
                onOpenCheckOut={() => handleRealCheckOut()}
                onOpenMissingModal={(tab) => {
                  if (tab) setMissingCheckoutInitialTab(tab);
                  setIsMissingCheckoutModalOpen(true);
                }}
              />

              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm max-w-xl text-center space-y-5">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600">
                  <Clock size={32} />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-800">Your Daily Shift Loop</h3>
                  <p className="text-gray-500 text-xs mt-1">
                    Store and view your administrative timing records
                  </p>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl py-3 px-5 my-4 inline-block">
                    <div className="flex items-center justify-center gap-1.5 mb-2">
                      {isNetworkSynced ? (
                        <span 
                          className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200/80 px-2.5 py-0.5 rounded-full"
                          title={`Network synchronized with backend server (${networkLatencyMs}ms ping, device offset: ${networkOffsetMs >= 0 ? "+" : ""}${Math.round(networkOffsetMs / 1000)}s)`}
                        >
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                          </span>
                          <span>Network Time (Addis Ababa)</span>
                        </span>
                      ) : syncStatus === "syncing" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-full">
                          <RefreshCw size={10} className="animate-spin text-blue-500" />
                          <span>Syncing Network Time...</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-full">
                          <WifiOff size={10} />
                          <span>Local Fallback Clock</span>
                        </span>
                      )}
                    </div>
                    <span className="text-2xl font-extrabold text-[#0F172A] tracking-tight font-mono block">
                      {getEthiopianLocalClockTimeString(currentTime)}
                    </span>
                    <div className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wider mt-0.5">
                      {getEthiopianTimePeriod(currentTime)}
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wider">
                      {getEthiopianNiceDateString(currentTime)}
                    </div>
                  </div>
                </div>

                {/* Status indicator */}
                {(() => {
                  const morningRecord = Array.isArray(todayAttendance) ? todayAttendance.find(r => r.session === "Morning") : null;
                  const afternoonRecord = Array.isArray(todayAttendance) ? todayAttendance.find(r => r.session === "Afternoon") : null;
                  
                  const now = currentTime;
                  const currentHour = parseInt(getEthiopianTimeString(now).split(":")[0], 10);
                  const isMorningSession = currentHour < 6;
                  
                  const hasActiveMorningCheckIn = !!(morningRecord && !morningRecord.check_out_time);
                  const hasActiveAfternoonCheckIn = !!(afternoonRecord && !afternoonRecord.check_out_time);
                  
                  const showMorning = isMorningSession || hasActiveMorningCheckIn;
                  const showAfternoon = !isMorningSession || hasActiveAfternoonCheckIn;

                  return (
                    <div className="space-y-4 w-full">
                      {/* Live Working Day / Non-Working Day Status Indicator */}
                      <div className="w-full text-left mb-2">
                        <WorkingDayStatusCard
                          status={effectiveWorkStatus}
                          currentTime={currentTime}
                          onNavigateToCalendar={() => setActiveTab("calendar")}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {showMorning && (
                          <div className={`p-3.5 rounded-xl border text-xs font-bold text-left space-y-1.5 ${
                            morningRecord 
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            <div className="flex items-center justify-between">
                              <p className="uppercase text-[10px] text-gray-500 font-bold">Morning Session (02:00 - 06:00)</p>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                (effectiveWorkStatus?.morning_status === "NON_WORKING" || (!effectiveWorkStatus && currentTime.getDay() === 0))
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                {(effectiveWorkStatus?.morning_status === "NON_WORKING" || (!effectiveWorkStatus && currentTime.getDay() === 0))
                                  ? "Non-Working / OT"
                                  : "Working Shift"}
                              </span>
                            </div>
                            {morningRecord ? (
                              <div className="font-mono text-slate-800">
                                Checked In: {morningRecord.check_in_time}
                                {morningRecord.check_out_time ? ` | Checked Out: ${morningRecord.check_out_time}` : " (Active)"}
                              </div>
                            ) : (
                              <div className="text-slate-400 font-normal">Not Checked In</div>
                            )}
                          </div>
                        )}

                        {showAfternoon && (
                          <div className={`p-3.5 rounded-xl border text-xs font-bold text-left space-y-1.5 ${
                            afternoonRecord 
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                              : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            <div className="flex items-center justify-between">
                              <p className="uppercase text-[10px] text-gray-500 font-bold">Afternoon Session (07:00 - 11:00)</p>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                (effectiveWorkStatus?.afternoon_status === "NON_WORKING" || (!effectiveWorkStatus && (currentTime.getDay() === 0 || currentTime.getDay() === 6)))
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}>
                                {(effectiveWorkStatus?.afternoon_status === "NON_WORKING" || (!effectiveWorkStatus && (currentTime.getDay() === 0 || currentTime.getDay() === 6)))
                                  ? "Non-Working / OT"
                                  : "Working Shift"}
                              </span>
                            </div>
                            {afternoonRecord ? (
                              <div className="font-mono text-slate-800">
                                Checked In: {afternoonRecord.check_in_time}
                                {afternoonRecord.check_out_time ? ` | Checked Out: ${afternoonRecord.check_out_time}` : " (Active)"}
                              </div>
                            ) : (
                              <div className="text-slate-400 font-normal">Not Checked In</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2.5 justify-center pt-2">
                        {/* Morning controls */}
                        {showMorning && (
                          <div className="flex gap-2">
                            {!morningRecord ? (
                              <button
                                onClick={() => handleRealScan("Morning")}
                                disabled={isScanning}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition disabled:opacity-50"
                              >
                                {isScanning ? "Processing..." : "Check In Morning"}
                              </button>
                            ) : !morningRecord.check_out_time ? (
                              <button
                                onClick={() => handleRealCheckOut("Morning")}
                                disabled={isScanning}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition disabled:opacity-50"
                              >
                                {isScanning ? "Processing..." : "Check Out Morning"}
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-xs p-2 bg-emerald-50 border border-emerald-100 rounded-lg">Morning Completed</span>
                            )}
                          </div>
                        )}

                        {/* Afternoon controls */}
                        {showAfternoon && (
                          <div className="flex gap-2">
                            {!afternoonRecord ? (
                              <button
                                onClick={() => handleRealScan("Afternoon")}
                                disabled={isScanning}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition disabled:opacity-50"
                              >
                                {isScanning ? "Processing..." : "Check In Afternoon"}
                              </button>
                            ) : !afternoonRecord.check_out_time ? (
                              <button
                                onClick={() => handleRealCheckOut("Afternoon")}
                                disabled={isScanning}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition disabled:opacity-50"
                              >
                                {isScanning ? "Processing..." : "Check Out Afternoon"}
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-xs p-2 bg-emerald-50 border border-emerald-100 rounded-lg">Afternoon Completed</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Display Admin's log history */}
                <div className="border-t border-gray-100 pt-6 space-y-3 text-left">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Administrative Log history</h4>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto">
                    {attendanceHistory.filter(h => ["SuperAdmin", "AdminCreator", "AdminManager", "Admin", "Bootstrap"].includes(h.role || "")).map((h) => (
                      <div key={h.id} className="bg-slate-50 border border-gray-100 rounded-xl p-3 flex items-center justify-between text-xs font-semibold">
                        <div>
                          <div className="text-gray-800">{h.date}</div>
                          <div className="text-gray-400 font-medium text-[10px]">
                            Shift: {h.check_in_time} to {h.check_out_time || "Active"}
                          </div>
                        </div>
                        <div className="text-blue-600 font-bold">{h.total_hours} worked hours</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module 4: Profile */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Admin Profile</h2>
                <p className="text-gray-500 text-sm mt-0.5">Manage your personal credentials, phone number, and password</p>
              </div>

              <form onSubmit={handleProfileUpdateSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm max-w-xl space-y-4">
                {profSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
                    Admin Profile updated successfully!
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">Admin Full Name</label>
                  <input
                    type="text"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500">Phone Number (Login ID)</label>
                  <input
                    type="text"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 block">Profile Picture</label>
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-gray-200">
                    {profPhoto ? (
                      <div className="relative shrink-0">
                        <img 
                          src={profPhoto} 
                          alt="Profile Preview" 
                          className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-sm" 
                        />
                        <button
                          type="button"
                          onClick={() => setProfPhoto("")}
                          className="absolute -top-1 -right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full shadow transition"
                          title="Remove Photo"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        <UserIcon size={24} />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="inline-block px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold rounded-lg text-xs cursor-pointer transition border border-blue-100">
                        Choose Profile File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setProfPhoto(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">PNG, JPG, or GIF. Converted to secure base64 string.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Security Credentials</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500">Current Password</label>
                    <input
                      type="password"
                      placeholder="Required to set a new password"
                      value={profCurrentPass}
                      onChange={(e) => setProfCurrentPass(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">New Password</label>
                      <input
                        type="password"
                        placeholder="Min 4 characters"
                        value={profNewPass}
                        onChange={(e) => setProfNewPass(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">Confirm New Password</label>
                      <input
                        type="password"
                        placeholder="Repeat new password"
                        value={profConfirmPass}
                        onChange={(e) => setProfConfirmPass(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-xs shadow-lg shadow-blue-600/10 transition"
                >
                  Save Profile Settings
                </button>
              </form>
            </div>
          )}

          {/* Module 5: Salary Management */}
          {activeTab === "salary" && (
            <SalaryManagementTab
              salaries={salaries}
              employees={employees}
              salaryFilter={salaryFilter}
              onFilterChange={handleSalaryFilterChange}
              onViewPayslip={handleViewPayslip}
              onOpenOvertimeModal={(record) => {
                setSelectedOvertimeRecord(record);
                setIsOvertimeModalOpen(true);
              }}
              onOpenCompensationModal={(emp) => {
                setSelectedCompensationEmployee(emp);
                setIsCompensationModalOpen(true);
              }}
              loadingPayslipUserId={loadingPayslipUserId}
              triggerNotification={triggerNotification}
            />
          )}

          {/* Module 6: Employee Registration & Directory */}
          {activeTab === "registration" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Staff & Employee Registry</h2>
                <p className="text-gray-500 text-sm mt-0.5">Register new accounts, manage system roles, hourly wages, and update login credentials</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Registration Form */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-extrabold text-[#0F172A] pb-2 border-b border-gray-100">Add New Staff Member</h3>
                  
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    {regSuccessMsg && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
                        {regSuccessMsg}
                      </div>
                    )}

                    {regErrorMsg && (
                      <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                        {regErrorMsg}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Abebe Kebede (Site Supervisor)"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">Phone Number (Login ID)</label>
                      <input
                        type="text"
                        placeholder="e.g. 0987654321"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">System Role</label>
                      <select
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                      >
                        {user?.role === "Bootstrap" && (
                          <option value="AdminCreator">Normal Admin (Workspace Creator)</option>
                        )}
                        {user?.role === "AdminCreator" && (
                          <>
                            <option value="Employee">Employee (Workers, Masons, Operators)</option>
                            <option value="Purchaser">Purchaser</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Engineer">Engineer</option>
                            <option value="HR">HR</option>
                            <option value="AdminCreator">Normal Admin (Workspace Creator)</option>
                            <option value="AdminManager">Second Admin (Workspace Manager)</option>
                          </>
                        )}
                        {user?.role === "AdminManager" && (
                          <>
                            <option value="Employee">Employee (Workers, Masons, Operators)</option>
                            <option value="Purchaser">Purchaser</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Engineer">Engineer</option>
                            <option value="HR">HR</option>
                          </>
                        )}
                        {user?.role === "SuperAdmin" && (
                          <>
                            <option value="Employee">Employee (Workers, Masons, Operators)</option>
                            <option value="Purchaser">Purchaser</option>
                            <option value="Accountant">Accountant</option>
                            <option value="Engineer">Engineer</option>
                            <option value="HR">HR</option>
                            <option value="AdminCreator">Normal Admin (Workspace Creator)</option>
                            <option value="AdminManager">Second Admin (Workspace Manager)</option>
                            <option value="SuperAdmin">Super Admin (Global)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">Standard Hourly Rate (ETB)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={regRate}
                        onChange={(e) => setRegRate(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-500">Security Password</label>
                      <input
                        type="password"
                        placeholder="Specify secure login password"
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-xs shadow-lg shadow-blue-600/10 transition cursor-pointer"
                    >
                      Register Member
                    </button>
                  </form>
                </div>

                {/* Right: Registered Employees Table */}
                <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <h3 className="text-sm font-extrabold text-[#0F172A]">Staff & Employee Directory</h3>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search staff members..."
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        className="w-full sm:w-64 pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="absolute left-2.5 top-2.5 text-slate-400">🔍</span>
                    </div>
                  </div>

                  <div className="border border-gray-100 rounded-xl overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-500 min-w-[700px]">
                      <thead className="bg-gray-50 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                        <tr>
                          <th className="p-3">Staff Member</th>
                          <th className="p-3">Phone (ID)</th>
                          <th className="p-3">System Role</th>
                          <th className="p-3">Bound Phone</th>
                          <th className="p-3">Hourly Rate</th>
                          <th className="p-3">Date Registered</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        {(() => {
                          const filtered = employees.filter((emp) =>
                            emp.full_name.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                            emp.phone_number.includes(modalSearchTerm)
                          );

                          if (filtered.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="p-8 text-center text-gray-400">
                                  No registered staff members found matching search query
                                </td>
                              </tr>
                            );
                          }

                          return filtered.map((emp) => {
                            const isCurrentUser = emp.id === user?.id;
                            const employeeRoles = ["Employee", "Purchaser", "Accountant", "Engineer", "HR"];
                            const isEditable = !(user?.role === "AdminManager" && !employeeRoles.includes(emp.role || "Employee"));
                            const isDeletable = !isCurrentUser && !(user?.role === "AdminManager" && !employeeRoles.includes(emp.role || "Employee"));

                            return (
                              <tr key={emp.id} className="hover:bg-slate-50 transition">
                                <td className="p-3 font-bold text-gray-800">
                                  <div className="flex items-center gap-2">
                                    <span>{emp.full_name}</span>
                                    {isCurrentUser && (
                                      <span className="bg-blue-50 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        You
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-gray-500 font-mono text-[11px]">{emp.phone_number}</td>
                                <td className="p-3">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                    !employeeRoles.includes(emp.role || "Employee") 
                                      ? "bg-blue-50 text-blue-700 border border-blue-100" 
                                      : "bg-slate-50 text-slate-700 border border-slate-100"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${!employeeRoles.includes(emp.role || "Employee") ? "bg-blue-500" : "bg-slate-500"}`} />
                                    {emp.role || "Employee"}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {emp.registered_device_id ? (
                                    <div className="space-y-0.5">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <Smartphone size={10} />
                                        {emp.device_name || "Phone Bound"}
                                      </span>
                                      <div className="text-[9px] text-gray-400 font-mono truncate max-w-[110px]" title={emp.registered_device_id}>
                                        ID: {emp.registered_device_id.slice(0, 10)}...
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                      Unbound (Pending)
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-bold text-gray-600">ETB {emp.hourly_rate?.toFixed(2)}/hr</td>
                                <td className="p-3 text-gray-400 text-[10px]">
                                  {emp.registration_date 
                                    ? getEthiopianFormattedDateString(emp.registration_date)
                                    : "Initial Seed"}
                                </td>
                                <td className="p-3 text-center">
                                  <div className="inline-flex items-center justify-center gap-2">
                                    {isEditable && (
                                      <button
                                        onClick={() => {
                                          setEditingEmpId(emp.id);
                                          setEditEmpName(emp.full_name);
                                          setEditEmpPhone(emp.phone_number);
                                          setEditEmpRole(emp.role || "Employee");
                                          setEditEmpRate(emp.hourly_rate?.toString() || "25.00");
                                          setEditEmpPass("");
                                        }}
                                        className="text-indigo-600 hover:text-indigo-900 font-bold text-[11px] hover:underline"
                                      >
                                        Edit
                                      </button>
                                    )}

                                    {emp.registered_device_id && (
                                      <button
                                        onClick={() => {
                                          setResettingDeviceEmployee({ id: emp.id, fullName: emp.full_name });
                                        }}
                                        className="text-amber-600 hover:text-amber-900 font-bold text-[11px] hover:underline flex items-center gap-0.5"
                                        title="Clear bound phone for this employee"
                                      >
                                        <RotateCcw size={10} />
                                        Reset Phone
                                      </button>
                                    )}
                                    
                                    {isDeletable && (
                                      <button
                                        onClick={() => {
                                          setDeletingEmployee({ id: emp.id, fullName: emp.full_name });
                                        }}
                                        className="text-rose-600 hover:text-rose-900 font-bold text-[11px] hover:underline"
                                      >
                                        Delete
                                      </button>
                                    )}

                                    {!isEditable && !isDeletable && !emp.registered_device_id && (
                                      <span className="text-[10px] text-gray-400 italic">No Actions</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Edit Employee Modal */}
              {editingEmpId !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xl max-w-md w-full space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <h3 className="text-base font-extrabold text-[#0F172A]">Edit Staff Account Details</h3>
                      <button 
                        onClick={() => setEditingEmpId(null)}
                        className="text-gray-400 hover:text-gray-600 font-extrabold text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!editEmpName || !editEmpPhone || !editEmpRole) {
                          triggerNotification("error", "Name, phone, and role are required.");
                          return;
                        }
                        const res = await updateEmployee(editingEmpId, {
                          full_name: editEmpName,
                          phone_number: editEmpPhone,
                          role: editEmpRole,
                          hourly_rate: parseFloat(editEmpRate),
                          password: editEmpPass || undefined
                        });
                        if (res.success) {
                          triggerNotification("success", "Account details updated successfully!");
                          setEditingEmpId(null);
                        } else {
                          triggerNotification("error", res.error || "Failed to update profile.");
                        }
                      }}
                      className="space-y-4"
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">Full Name</label>
                        <input
                          type="text"
                          value={editEmpName}
                          onChange={(e) => setEditEmpName(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">Phone Number (Login ID)</label>
                        <input
                          type="text"
                          value={editEmpPhone}
                          onChange={(e) => setEditEmpPhone(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">System Role</label>
                        <select
                          value={editEmpRole}
                          onChange={(e) => setEditEmpRole(e.target.value)}
                          disabled={editingEmpId === user?.id || user?.role === "AdminManager"}
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400 cursor-pointer"
                        >
                          {user?.role === "Bootstrap" && (
                            <option value="AdminCreator">Normal Admin (Workspace Creator)</option>
                          )}
                          {user?.role === "AdminCreator" && (
                            <>
                              <option value="Employee">Employee (Workers, Masons, Operators)</option>
                              <option value="Purchaser">Purchaser</option>
                              <option value="Accountant">Accountant</option>
                              <option value="Engineer">Engineer</option>
                              <option value="HR">HR</option>
                              <option value="AdminCreator">Normal Admin (Workspace Creator)</option>
                              <option value="AdminManager">Second Admin (Workspace Manager)</option>
                            </>
                          )}
                          {user?.role === "AdminManager" && (
                            <>
                              <option value="Employee">Employee (Workers, Masons, Operators)</option>
                              <option value="Purchaser">Purchaser</option>
                              <option value="Accountant">Accountant</option>
                              <option value="Engineer">Engineer</option>
                              <option value="HR">HR</option>
                            </>
                          )}
                          {user?.role === "SuperAdmin" && (
                            <>
                              <option value="Employee">Employee (Workers, Masons, Operators)</option>
                              <option value="Purchaser">Purchaser</option>
                              <option value="Accountant">Accountant</option>
                              <option value="Engineer">Engineer</option>
                              <option value="HR">HR</option>
                              <option value="AdminCreator">Normal Admin (Workspace Creator)</option>
                              <option value="AdminManager">Second Admin (Workspace Manager)</option>
                              <option value="SuperAdmin">Super Admin (Global)</option>
                            </>
                          )}
                        </select>
                        {editingEmpId === user?.id && (
                          <span className="text-[10px] text-amber-500 font-bold block mt-0.5">
                            You cannot change your own admin status here to prevent lockouts.
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">Standard Hourly Rate (ETB)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editEmpRate}
                          onChange={(e) => setEditEmpRate(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500">Change Password (Optional)</label>
                        <input
                          type="password"
                          placeholder="Leave blank to keep existing password"
                          value={editEmpPass}
                          onChange={(e) => setEditEmpPass(e.target.value)}
                          className="w-full px-4 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-slate-900 bg-white placeholder:text-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingEmpId(null)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-600/10 transition"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete Employee Confirmation Modal */}
              {deletingEmployee !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-2xl border border-red-100 p-6 shadow-2xl max-w-md w-full space-y-5 relative overflow-hidden">
                    {/* Decorative red top bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-red-600" />
                    
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shrink-0">
                        <AlertTriangle size={24} className="animate-pulse" />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Delete Staff Profile?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          Are you sure you want to delete <span className="text-slate-800 font-extrabold">{deletingEmployee.fullName}</span>?
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100 text-[11px] text-slate-500 space-y-1.5 font-semibold">
                      <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-wider text-[9px]">
                        <AlertCircle size={11} />
                        Destructive Action Notice
                      </div>
                      <p className="leading-relaxed text-slate-600">
                        Proceeding with this action will permanently remove this employee's profile from the system. This operation cannot be undone and will remove:
                      </p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-500 font-medium">
                        <li>All historical attendance sessions and records</li>
                        <li>Calculated attendance and punctuality index scores</li>
                        <li>Active leave request entries & permissions logs</li>
                        <li>Generated payroll ledger history</li>
                      </ul>
                    </div>

                    <div className="flex gap-2.5 justify-end pt-1">
                      <button
                        type="button"
                        disabled={isDeletingLoading}
                        onClick={() => setDeletingEmployee(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Keep Account
                      </button>
                      <button
                        type="button"
                        disabled={isDeletingLoading}
                        onClick={async () => {
                          setIsDeletingLoading(true);
                          try {
                            const res = await deleteEmployee(deletingEmployee.id);
                            if (res.success) {
                              triggerNotification("success", "Staff profile and all related data removed successfully.");
                              setDeletingEmployee(null);
                            } else {
                              triggerNotification("error", res.error || "Failed to delete staff member.");
                            }
                          } catch (err) {
                            triggerNotification("error", "An unexpected error occurred.");
                          } finally {
                            setIsDeletingLoading(false);
                          }
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-600/15 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {isDeletingLoading ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          "Yes, Delete Profile"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Employee Device Binding Confirmation Modal */}
              {resettingDeviceEmployee !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-2xl border border-amber-100 p-6 shadow-2xl max-w-md w-full space-y-5 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-600" />
                    
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                        <Smartphone size={24} />
                      </div>
                      <div className="space-y-1.5">
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Reset Bound Phone?</h3>
                        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                          Are you sure you want to clear the registered phone for <span className="text-slate-800 font-extrabold">{resettingDeviceEmployee.fullName}</span>?
                        </p>
                      </div>
                    </div>

                    <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-100 text-[11px] text-slate-600 space-y-1.5 font-semibold">
                      <p>
                        Once cleared, the employee will be able to bind their new phone on their next check-in. The previous phone will no longer have permission to check in for this account.
                      </p>
                    </div>

                    <div className="flex gap-2.5 justify-end pt-1">
                      <button
                        type="button"
                        disabled={isResettingDeviceLoading}
                        onClick={() => setResettingDeviceEmployee(null)}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isResettingDeviceLoading}
                        onClick={async () => {
                          setIsResettingDeviceLoading(true);
                          try {
                            const res = await resetEmployeeDevice(resettingDeviceEmployee.id);
                            if (res.success) {
                              triggerNotification("success", `Phone binding cleared for ${resettingDeviceEmployee.fullName}.`);
                              setResettingDeviceEmployee(null);
                            } else {
                              triggerNotification("error", res.error || "Failed to reset phone binding.");
                            }
                          } catch (err) {
                            triggerNotification("error", "An unexpected error occurred.");
                          } finally {
                            setIsResettingDeviceLoading(false);
                          }
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-lg shadow-amber-600/15 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {isResettingDeviceLoading ? (
                          <>
                            <RefreshCw size={12} className="animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          "Yes, Reset Device"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Module 7: Attendance Score */}
          {activeTab === "scores" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Attendance Scores</h2>
                <p className="text-gray-500 text-sm mt-0.5">Assess workforce reliability, punctuality, and attendance indices</p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                <div className="border border-gray-100 rounded-xl overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left text-xs text-gray-500 min-w-[700px]">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="p-3.5">Employee Name</th>
                        <th className="p-3.5">Attendance Score</th>
                        <th className="p-3.5">Punctuality Percentage</th>
                        <th className="p-3.5">Lates Registered</th>
                        <th className="p-3.5 text-right">Overall Rating</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                      {scores.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-400">
                            No scored employees in database
                          </td>
                        </tr>
                      ) : (
                        scores.map((sc) => (
                          <tr key={sc.id}>
                            <td className="p-3.5 font-bold text-gray-800">{sc.full_name}</td>
                            <td className="p-3.5 font-extrabold text-[#0F172A]">{sc.attendance_score}%</td>
                            <td className="p-3.5 text-gray-500">{sc.punctuality_percentage}%</td>
                            <td className="p-3.5 text-rose-600 font-bold">{sc.late_count} times</td>
                            <td className="p-3.5 text-right">
                              <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getRating(sc.attendance_score, sc.total_attendances).color}`}>
                                {getRating(sc.attendance_score, sc.total_attendances).text}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module 8: QR Code Management & Site Settings */}
          {activeTab === "qr_code" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Site Security & Compliance</h2>
                  <p className="text-gray-500 text-sm mt-0.5">Manage office QR verification point, Wi-Fi subnet boundaries, and GPS geofence rules</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2 shrink-0 cursor-pointer active:scale-[0.98]"
                >
                  <QrCode size={15} /> Display & Print QR Sign
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* QR Code Section */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between space-y-5">
                  <div className="space-y-4 text-center">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                          <QrCode size={16} />
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-bold text-[#0F172A]">Office QR Verification</h3>
                          <p className="text-[10px] text-gray-500">Physical attendance check-in point</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Active
                      </span>
                    </div>

                    {/* Prominent Visual QR Code Graphic */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
                      <div className="p-3 bg-white border border-gray-200 rounded-xl shadow-xs">
                        <QRCodeSVG 
                          value={qrCode?.qr_id || "OFFICE-ACTIVE-ATTENDANCE"} 
                          size={160} 
                          level="H" 
                          includeMargin={true}
                        />
                      </div>
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-mono font-bold text-slate-700">
                        <span>{qrCode?.qr_id || "OFFICE-ACTIVE-ATTENDANCE"}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (qrCode?.qr_id) {
                              navigator.clipboard.writeText(qrCode.qr_id);
                              triggerNotification("success", "QR Code ID copied to clipboard!");
                            }
                          }}
                          className="text-gray-400 hover:text-blue-600 transition cursor-pointer p-0.5"
                          title="Copy QR Code ID"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRegenerateSuccessInfo(null);
                          setIsRegenerateModalOpen(true);
                        }}
                        className="py-2.5 px-4 rounded-xl text-xs font-bold transition inline-flex items-center justify-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.98]"
                        title="Regenerate Office QR"
                      >
                        <RefreshCw size={13} />
                        Regenerate QR
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPrintModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-blue-600/10 transition inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Printer size={14} /> Display & Print Sign
                      </button>
                    </div>
                  </div>
                </div>

                {/* Office GPS and Network Settings Form */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <Settings size={20} className="text-blue-600" />
                    <div>
                      <h3 className="text-sm font-bold text-[#0F172A]">Office Geofencing & QR Code Configuration</h3>
                      <p className="text-xs text-gray-400">Specify physical office GPS boundaries for QR-based check-ins</p>
                    </div>
                  </div>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ok = await updateSiteSettings({
                        office_name: editOfficeName,
                        latitude: parseFloat(editLatitude) || 9.0227,
                        longitude: parseFloat(editLongitude) || 38.7460,
                        office_wifi_ssid: editWifiSsid,
                        office_wifi_bssid: editWifiBssid,
                        wifi_ssid: editWifiSsid,
                        wifi_ip: editWifiIp,
                        allowed_radius: parseFloat(editAllowedRadius) || 30,
                        extended_radius: parseFloat(editExtendedRadius) || 60,
                        use_wifi_verification: 0
                      });
                      if (ok) {
                        triggerNotification("success", "Geofence compliance settings successfully updated!");
                      } else {
                        triggerNotification("error", "Failed to update site compliance settings.");
                      }
                    }} 
                    className="space-y-4"
                  >
                    {/* GPS Calibration & Guidance Toolbar */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-amber-900">Why Phone GPS & IP Location Differ</h4>
                          <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium mt-0.5">
                            IP lookup websites (like <em>mylocation.org</em>) only estimate the ISP (Ethio Telecom) central exchange in Addis Ababa (around Kazanchis), which is usually 6–10 km away from your actual office building. Your phone uses <strong>real satellite GPS</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                        <button
                          type="button"
                          onClick={handleDetectOfficeLocation}
                          disabled={isDetectingOfficeGps}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3.5 rounded-xl text-xs shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                          {isDetectingOfficeGps ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              Acquiring High-Accuracy GPS...
                            </>
                          ) : (
                            <>
                              <MapPin size={13} className="text-emerald-400" />
                              Auto-Detect Real Office GPS
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleTestCurrentDistance}
                          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Crosshair size={13} className="text-blue-600" />
                          Test My Distance
                        </button>

                        {editLatitude && editLongitude && (
                          <a
                            href={`https://www.google.com/maps?q=${editLatitude},${editLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-2 px-3.5 rounded-xl text-xs transition inline-flex items-center gap-1.5 ml-auto"
                          >
                            <ExternalLink size={13} className="text-gray-500" />
                            View on Google Maps
                          </a>
                        )}
                      </div>

                      {detectOfficeGpsStatus && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] font-bold text-emerald-800 flex items-center gap-2">
                          <Check size={14} className="text-emerald-600 shrink-0" />
                          <span>{detectOfficeGpsStatus}</span>
                        </div>
                      )}

                      {testDistanceResult && (
                        <div className={`p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-2 border ${
                          testDistanceResult.inside 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}>
                          {testDistanceResult.inside ? (
                            <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                          )}
                          <span>{testDistanceResult.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-gray-500">System / Office Header Title (Displayed on Top Banner)</label>
                        <input
                          type="text"
                          value={editOfficeName}
                          onChange={(e) => setEditOfficeName(e.target.value)}
                          className="w-full px-4 py-2 text-slate-900 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-gray-500">Office Latitude</label>
                          <span className="text-[10px] text-gray-400 font-mono">Decimal Degrees</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={editLatitude}
                          onChange={(e) => setEditLatitude(e.target.value)}
                          className="w-full px-4 py-2 text-slate-900 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-gray-500">Office Longitude</label>
                          <span className="text-[10px] text-gray-400 font-mono">Decimal Degrees</span>
                        </div>
                        <input
                          type="number"
                          step="any"
                          value={editLongitude}
                          onChange={(e) => setEditLongitude(e.target.value)}
                          className="w-full px-4 py-2 text-slate-900 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">Standard Geofence Radius (meters)</label>
                        <input
                          type="number"
                          value={editAllowedRadius}
                          onChange={(e) => setEditAllowedRadius(e.target.value)}
                          className="w-full px-4 py-2 text-slate-900 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <span className="text-[10px] text-gray-400">Default: 30m–50m for office perimeter</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">Extended Radius for Fair GPS (meters)</label>
                        <input
                          type="number"
                          value={editExtendedRadius}
                          onChange={(e) => setEditExtendedRadius(e.target.value)}
                          className="w-full px-4 py-2 text-slate-900 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500 font-mono"
                        />
                        <span className="text-[10px] text-gray-400">Default: 60m–100m for weak GPS indoor drift</span>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl flex items-center gap-2 text-xs text-blue-800 font-medium">
                      <QrCode size={16} className="text-blue-600 shrink-0" />
                      <span><strong>Attendance Enforcement:</strong> Physical Office QR Code scan + High-Accuracy GPS Geofence matching are strictly enforced for all check-ins and check-outs.</span>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button
                        type="submit"
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check size={15} /> Save Geofence Configuration
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Module 9: Work Calendar & Holiday Management */}
          {activeTab === "calendar" && (
            <WorkCalendarTab
              readOnly={!user?.role || !["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"].includes(user.role)}
              onNavigateToSettings={() => setActiveTab("attendance_settings")}
            />
          )}

          {/* Module 10: Overtime Management & Automated Test Suite */}
          {activeTab === "overtime" && (
            <OvertimeManagementTab 
              onNavigateToSettings={() => setActiveTab("attendance_settings")}
            />
          )}

          {/* Module 11: Late Arrival Penalties Management */}
          {activeTab === "penalties" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
                    <AlertTriangle className="text-amber-600" size={24} />
                    Late Arrival & Penalty Management
                  </h2>
                  <p className="text-gray-500 text-xs md:text-sm mt-0.5">
                    Track employee lateness, manage deduction penalties, review pardon requests, and enforce punctuality guidelines
                  </p>
                </div>
              </div>
              <LatePenaltyManagement />
            </div>
          )}

          {/* Module 12: Missing Checkouts & Unclosed Shifts Management Page */}
          {activeTab === "missing_checkouts" && (
            <div className="space-y-6">
              <MissingCheckoutManagement
                isModal={false}
                initialRecordId={missingCheckoutInitialId}
                initialTab={missingCheckoutInitialTab}
              />
            </div>
          )}

          {/* Module 13: Attendance & Work Schedule Settings Page */}
          {activeTab === "attendance_settings" && (
            <AttendanceScheduleSettingsTab />
          )}

          <div className="pt-6 pb-2 mt-auto">
            <Footer />
          </div>
        </main>

        {isScanningQR && (
          <QRScanner 
            onScanSuccess={handleQRScanSuccess} 
            onClose={() => setIsScanningQR(false)} 
            gpsInfo={pendingLocData}
            workStatus={effectiveWorkStatus ? {
              isWorkingDay: effectiveWorkStatus.is_working_day ?? (effectiveWorkStatus.status === "WORKING"),
              label: effectiveWorkStatus.working_day_label || (effectiveWorkStatus.status === "WORKING" ? "Standard Work Shift" : "Scheduled Rest Day / Holiday"),
              description: effectiveWorkStatus.working_day_description
            } : {
              isWorkingDay: currentTime.getDay() !== 0,
              label: currentTime.getDay() === 0 ? "Non-Working Day (Sunday Rest Day)" : "Official Working Day"
            }}
          />
        )}

        {isEditingHeaderTitle && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-800 border border-slate-100 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Edit2 size={18} className="text-blue-600" />
                  Edit System / Header Title
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingHeaderTitle(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">Header Title / System Name</label>
                <input
                  type="text"
                  value={tempHeaderTitle}
                  onChange={(e) => setTempHeaderTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="e.g. Nabi Tech PLC Attendance Panel"
                  autoFocus
                />
                <p className="text-[11px] text-gray-400">
                  This title is displayed in the main header across the app for all users and admins.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingHeaderTitle(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!tempHeaderTitle.trim()) return;
                    const ok = await updateSiteSettings({ office_name: tempHeaderTitle.trim() });
                    if (ok) {
                      setEditOfficeName(tempHeaderTitle.trim());
                      triggerNotification("success", "Header title updated successfully!");
                      setIsEditingHeaderTitle(false);
                    } else {
                      triggerNotification("error", "Failed to update header title.");
                    }
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-500/20"
                >
                  Save Title
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Interactive QR Code Regeneration Modal */}
        {isRegenerateModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div 
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-5 transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {!regenerateSuccessInfo ? (
                <>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center shrink-0">
                      <AlertTriangle size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-[#0F172A]">Regenerate Office QR Code</h3>
                        <button
                          type="button"
                          onClick={() => setIsRegenerateModalOpen(false)}
                          disabled={isRegenerating}
                          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Workspace: <span className="font-semibold text-slate-700">{user?.workspace_name || "Primary Office"}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/70 border border-amber-200/70 rounded-xl space-y-2 text-xs text-amber-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <Lock size={13} />
                      Important Notice
                    </div>
                    <p>
                      Regenerating will <strong>immediately revoke</strong> the existing Office QR code. 
                    </p>
                    <p className="text-amber-800/90 font-normal">
                      Any previously printed wall signs, poster cards, or desk standees will no longer be accepted by the attendance scanner. You will need to print or display the new QR code.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsRegenerateModalOpen(false)}
                      disabled={isRegenerating}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isRegenerating}
                      onClick={async () => {
                        setIsRegenerating(true);
                        try {
                          const res = await regenerateQRCode();
                          if (res.success) {
                            setRegenerateSuccessInfo({ qr_id: res.qrCode?.qr_id || qrCode?.qr_id || "OFFICE-UPDATED" });
                            triggerNotification("success", "New Office QR Code generated successfully!");
                          } else {
                            triggerNotification("error", res.error || "Failed to regenerate QR code.");
                          }
                        } catch (err: any) {
                          triggerNotification("error", err.message || "An unexpected error occurred.");
                        } finally {
                          setIsRegenerating(false);
                        }
                      }}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-600/20 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isRegenerating ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} />
                          Yes, Regenerate QR
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                      <CheckCircle size={30} />
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#0F172A]">New Office QR Code Activated</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        The previous QR code was revoked. Your new verification identifier is ready.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col items-center justify-center space-y-3">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                        <QRCodeSVG value={qrCode?.code || regenerateSuccessInfo.qr_id} size={110} level="M" />
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-mono font-bold">
                        <span>Identifier:</span>
                        <span className="text-blue-900">{regenerateSuccessInfo.qr_id}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegenerateModalOpen(false);
                          setRegenerateSuccessInfo(null);
                        }}
                        className="py-2.5 px-4 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegenerateModalOpen(false);
                          setRegenerateSuccessInfo(null);
                          setIsPrintModalOpen(true);
                        }}
                        className="py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-md shadow-blue-600/20 inline-flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98]"
                      >
                        <Printer size={14} /> Display & Print Sign
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Printable Office QR Code Sign Modal */}
        <PrintableQRModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          qrCode={qrCode}
          siteSettings={siteSettings}
          workspaceName={user?.workspace_name}
        />

        {/* Missing Check-Outs & Forgotten Shift Resolution Modal */}
        <MissingCheckoutModal
          isOpen={isMissingCheckoutModalOpen}
          onClose={() => {
            setIsMissingCheckoutModalOpen(false);
            setMissingCheckoutInitialId(null);
            setMissingCheckoutInitialTab(null);
          }}
          initialRecordId={missingCheckoutInitialId}
          initialTab={missingCheckoutInitialTab}
        />

        {/* GPS Distance & Calibration Assistance Modal */}
        {renderGpsErrorModal()}

        {/* Enterprise Official Payslip & Multi-Rate Overtime Audit Modal */}
        <EnterprisePayslipModal
          isOpen={isPayslipModalOpen}
          onClose={() => setIsPayslipModalOpen(false)}
          payslip={selectedPayslip}
          onDisburseSuccess={() => {
            fetchSalaries(salaryFilter);
            triggerNotification("success", "Payroll disbursement marked successfully!");
          }}
        />

        {/* Employee Overtime Audit Modal */}
        <EmployeeOvertimeModal
          isOpen={isOvertimeModalOpen}
          onClose={() => setIsOvertimeModalOpen(false)}
          salaryRecord={selectedOvertimeRecord}
          onOpenPayslip={() => {
            if (selectedOvertimeRecord) {
              handleViewPayslip(selectedOvertimeRecord.user_id);
            }
          }}
        />

        {/* Edit Employee Compensation Modal */}
        <EditCompensationModal
          isOpen={isCompensationModalOpen}
          onClose={() => setIsCompensationModalOpen(false)}
          employee={selectedCompensationEmployee}
          onSuccess={() => {
            fetchSalaries(salaryFilter);
            fetchEmployees();
            triggerNotification("success", "Compensation and allowances updated successfully!");
          }}
        />

        {/* Network Connectivity & Offline Mode Indicator */}
        <OfflineIndicator />

      </div>
    </div>
  );
}
