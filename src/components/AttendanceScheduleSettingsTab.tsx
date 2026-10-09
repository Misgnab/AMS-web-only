import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../store.js";
import { SiteSettings, WorkScheduleDay } from "../types.js";
import { formatToEthiopianTime } from "../utils/ethiopianTime.js";
import {
  Clock,
  Calendar,
  Shield,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  X,
  Sliders,
  DollarSign,
  Sun,
  Moon,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookOpen
} from "lucide-react";

interface ValidationErrors {
  workSchedule?: string;
  morningSchedule?: string;
  afternoonSchedule?: string;
  checkIn?: string;
  checkOut?: string;
  overtime?: string;
}

export const AttendanceScheduleSettingsTab: React.FC = () => {
  const {
    siteSettings,
    workSchedules,
    fetchSiteSettings,
    fetchWorkCalendar,
    saveAttendanceSettings,
    user
  } = useAppStore();

  const isAdmin = ["AdminCreator", "AdminManager", "SuperAdmin", "HR"].includes(user?.role || "");

  // Local form state
  const [formData, setFormData] = useState<Partial<SiteSettings>>({
    work_start_time: "08:30",
    work_end_time: "17:30",
    required_daily_hours: 8.0,
    morning_start_time: "08:30",
    morning_end_time: "12:30",
    afternoon_start_time: "13:30",
    afternoon_end_time: "17:30",
    earliest_checkin_time: "07:00",
    latest_checkin_time: "10:30",
    late_grace_minutes: 15,
    allowed_minor_lates: 2,
    prevent_duplicate_checkin: 1,
    early_arrival_as_overtime: 0,
    authorized_early_overtime_enabled: 1,
    early_overtime_requires_approval: 1,
    earliest_checkout_time: "16:30",
    latest_checkout_time: "20:00",
    checkout_grace_minutes: 30,
    prevent_checkout_without_checkin: 1,
    prevent_duplicate_checkout: 1,
    missing_checkout_auto_overtime: 0,
    overtime_enabled: 1,
    overtime_start_time: "17:30",
    min_overtime_minutes: 30,
    max_overtime_daily_hours: 4.0,
    max_overtime_weekly_hours: 12.0,
    require_overtime_approval: 1,
    normal_overtime_multiplier: 1.5,
    rest_day_overtime_multiplier: 2.0,
    holiday_overtime_multiplier: 2.5,
    night_overtime_multiplier: 1.5
  });

  const [schedulesList, setSchedulesList] = useState<WorkScheduleDay[]>([]);
  const [activeSection, setActiveSection] = useState<"ALL" | "REGULAR" | "CHECKIN" | "CHECKOUT" | "OVERTIME">("ALL");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Initialize from loaded settings
  useEffect(() => {
    fetchSiteSettings();
    fetchWorkCalendar();
  }, [fetchSiteSettings, fetchWorkCalendar]);

  useEffect(() => {
    if (siteSettings) {
      setFormData({
        work_start_time: siteSettings.work_start_time || "08:30",
        work_end_time: siteSettings.work_end_time || "17:30",
        required_daily_hours: Number(siteSettings.required_daily_hours ?? 8.0),
        morning_start_time: siteSettings.morning_start_time || "08:30",
        morning_end_time: siteSettings.morning_end_time || "12:30",
        afternoon_start_time: siteSettings.afternoon_start_time || "13:30",
        afternoon_end_time: siteSettings.afternoon_end_time || "17:30",
        earliest_checkin_time: siteSettings.earliest_checkin_time || "07:00",
        latest_checkin_time: siteSettings.latest_checkin_time || "10:30",
        late_grace_minutes: Number(siteSettings.late_grace_minutes ?? 15),
        allowed_minor_lates: Number(siteSettings.allowed_minor_lates ?? 2),
        prevent_duplicate_checkin: Number(siteSettings.prevent_duplicate_checkin ?? 1),
        early_arrival_as_overtime: Number(siteSettings.early_arrival_as_overtime ?? 0),
        authorized_early_overtime_enabled: Number(siteSettings.authorized_early_overtime_enabled ?? 1),
        early_overtime_requires_approval: Number(siteSettings.early_overtime_requires_approval ?? 1),
        earliest_checkout_time: siteSettings.earliest_checkout_time || "16:30",
        latest_checkout_time: siteSettings.latest_checkout_time || "20:00",
        checkout_grace_minutes: Number(siteSettings.checkout_grace_minutes ?? 30),
        prevent_checkout_without_checkin: Number(siteSettings.prevent_checkout_without_checkin ?? 1),
        prevent_duplicate_checkout: Number(siteSettings.prevent_duplicate_checkout ?? 1),
        missing_checkout_auto_overtime: Number(siteSettings.missing_checkout_auto_overtime ?? 0),
        overtime_enabled: Number(siteSettings.overtime_enabled ?? 1),
        overtime_start_time: siteSettings.overtime_start_time || "17:30",
        min_overtime_minutes: Number(siteSettings.min_overtime_minutes ?? 30),
        max_overtime_daily_hours: Number(siteSettings.max_overtime_daily_hours ?? 4.0),
        max_overtime_weekly_hours: Number(siteSettings.max_overtime_weekly_hours ?? 12.0),
        require_overtime_approval: Number(siteSettings.require_overtime_approval ?? 1),
        normal_overtime_multiplier: Number(siteSettings.normal_overtime_multiplier ?? 1.5),
        rest_day_overtime_multiplier: Number(siteSettings.rest_day_overtime_multiplier ?? 2.0),
        holiday_overtime_multiplier: Number(siteSettings.holiday_overtime_multiplier ?? 2.5),
        night_overtime_multiplier: Number(siteSettings.night_overtime_multiplier ?? 1.5)
      });
    }
  }, [siteSettings]);

  useEffect(() => {
    if (workSchedules && workSchedules.length > 0) {
      setSchedulesList(workSchedules);
    }
  }, [workSchedules]);

  // Handle setting updates
  const handleChange = (field: keyof SiteSettings, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
  };

  // Helper to toggle schedule status
  const handleScheduleStatusChange = (
    dayIndex: number,
    session: "morning" | "afternoon",
    newStatus: "WORKING" | "NON_WORKING"
  ) => {
    setSchedulesList((prev) =>
      prev.map((s) => {
        if (s.day_of_week === dayIndex) {
          return {
            ...s,
            [session === "morning" ? "morning_status" : "afternoon_status"]: newStatus
          };
        }
        return s;
      })
    );
  };

  // Time conversion helper
  const toMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  // Real-time conflict validations
  const validationErrors = useMemo<ValidationErrors>(() => {
    const errors: ValidationErrors = {};

    const workStart = toMinutes(formData.work_start_time);
    const workEnd = toMinutes(formData.work_end_time);
    if (workStart >= workEnd) {
      errors.workSchedule = "Normal check-in time must be earlier than normal check-out time.";
    }

    const morningStart = toMinutes(formData.morning_start_time);
    const morningEnd = toMinutes(formData.morning_end_time);
    if (morningStart >= morningEnd) {
      errors.morningSchedule = "Morning session start must be earlier than morning session end.";
    }

    const afternoonStart = toMinutes(formData.afternoon_start_time);
    const afternoonEnd = toMinutes(formData.afternoon_end_time);
    if (afternoonStart >= afternoonEnd) {
      errors.afternoonSchedule = "Afternoon session start must be earlier than afternoon session end.";
    }

    if (morningEnd > afternoonStart) {
      errors.morningSchedule = "Morning session end cannot be after Afternoon session start (break period overlap).";
    }

    const reqDaily = Number(formData.required_daily_hours || 0);
    if (reqDaily > 10.0 || reqDaily <= 0) {
      errors.workSchedule = "Under Ethiopian Labour Proclamation No. 1156/2019 Art. 61, regular daily work hours cannot exceed 8 to 10 hours.";
    }

    const earliestCheckin = toMinutes(formData.earliest_checkin_time);
    if (earliestCheckin > workStart) {
      errors.checkIn = "Earliest allowed check-in time cannot be later than normal check-in time.";
    }

    const latestCheckin = toMinutes(formData.latest_checkin_time);
    if (latestCheckin > 0 && latestCheckin < workStart) {
      errors.checkIn = "Latest allowed check-in cutoff cannot be earlier than normal check-in time.";
    }

    if (Number(formData.late_grace_minutes || 0) < 0) {
      errors.checkIn = "Check-in grace period cannot be negative.";
    }

    const earliestCheckout = toMinutes(formData.earliest_checkout_time);
    if (earliestCheckout > workEnd) {
      errors.checkOut = "Earliest allowed check-out cannot be after normal check-out time.";
    }

    const latestCheckout = toMinutes(formData.latest_checkout_time);
    if (latestCheckout > 0 && latestCheckout < workEnd) {
      errors.checkOut = "Latest allowed check-out cutoff cannot be earlier than normal check-out time.";
    }

    if (Number(formData.checkout_grace_minutes || 0) < 0) {
      errors.checkOut = "Checkout grace period cannot be negative.";
    }

    const otStart = toMinutes(formData.overtime_start_time);
    if (otStart > 0 && otStart < workEnd) {
      errors.overtime = "Overtime start time cannot be earlier than normal work end time.";
    }

    const minOt = Number(formData.min_overtime_minutes || 0);
    const maxOtDaily = Number(formData.max_overtime_daily_hours || 0);
    const maxOtWeekly = Number(formData.max_overtime_weekly_hours || 0);

    if (minOt < 0) {
      errors.overtime = "Minimum overtime duration cannot be negative.";
    } else if (maxOtDaily <= 0) {
      errors.overtime = "Maximum daily overtime must be greater than zero.";
    } else if (maxOtDaily > 4.0) {
      errors.overtime = "Under Ethiopian Labour Proclamation No. 1156/2019 Art. 67, daily overtime shall not exceed 4 hours.";
    } else if (maxOtWeekly < maxOtDaily) {
      errors.overtime = "Maximum weekly overtime cap cannot be lower than daily overtime cap.";
    } else if (maxOtWeekly > 12.0) {
      errors.overtime = "Under Ethiopian Labour Proclamation No. 1156/2019 Art. 67, weekly overtime shall not exceed 12 hours.";
    }

    if (Number(formData.normal_overtime_multiplier || 0) < 1.0) {
      errors.overtime = "Overtime multiplier must be at least 1.0x (Labour Proclamation Art. 68 mandates 1.25x for standard overtime).";
    }

    return errors;
  }, [formData]);

  const hasErrors = Object.keys(validationErrors).length > 0;

  // Handle Save
  const handleSave = async () => {
    if (hasErrors) {
      setSaveErrorMessage("Please resolve configuration conflicts before saving.");
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);

    const payload = {
      ...formData,
      weekly_schedule: schedulesList
    };

    const result = await saveAttendanceSettings(payload);
    setIsSaving(false);

    if (result.success) {
      setSaveSuccessMessage("Settings saved successfully! All attendance validation, overtime, and salary calculations are now synchronized.");
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } else {
      setSaveErrorMessage(result.error || "Failed to save settings. Please try again.");
    }
  };

  // Revert/Reset
  const handleReset = () => {
    if (siteSettings) {
      setFormData({
        work_start_time: siteSettings.work_start_time || "08:30",
        work_end_time: siteSettings.work_end_time || "17:30",
        required_daily_hours: Number(siteSettings.required_daily_hours ?? 8.0),
        morning_start_time: siteSettings.morning_start_time || "08:30",
        morning_end_time: siteSettings.morning_end_time || "12:30",
        afternoon_start_time: siteSettings.afternoon_start_time || "13:30",
        afternoon_end_time: siteSettings.afternoon_end_time || "17:30",
        earliest_checkin_time: siteSettings.earliest_checkin_time || "07:00",
        latest_checkin_time: siteSettings.latest_checkin_time || "10:30",
        late_grace_minutes: Number(siteSettings.late_grace_minutes ?? 15),
        allowed_minor_lates: Number(siteSettings.allowed_minor_lates ?? 2),
        prevent_duplicate_checkin: Number(siteSettings.prevent_duplicate_checkin ?? 1),
        early_arrival_as_overtime: Number(siteSettings.early_arrival_as_overtime ?? 0),
        authorized_early_overtime_enabled: Number(siteSettings.authorized_early_overtime_enabled ?? 1),
        early_overtime_requires_approval: Number(siteSettings.early_overtime_requires_approval ?? 1),
        earliest_checkout_time: siteSettings.earliest_checkout_time || "16:30",
        latest_checkout_time: siteSettings.latest_checkout_time || "20:00",
        checkout_grace_minutes: Number(siteSettings.checkout_grace_minutes ?? 30),
        prevent_checkout_without_checkin: Number(siteSettings.prevent_checkout_without_checkin ?? 1),
        prevent_duplicate_checkout: Number(siteSettings.prevent_duplicate_checkout ?? 1),
        missing_checkout_auto_overtime: Number(siteSettings.missing_checkout_auto_overtime ?? 0),
        overtime_enabled: Number(siteSettings.overtime_enabled ?? 1),
        overtime_start_time: siteSettings.overtime_start_time || "17:30",
        min_overtime_minutes: Number(siteSettings.min_overtime_minutes ?? 30),
        max_overtime_daily_hours: Number(siteSettings.max_overtime_daily_hours ?? 4.0),
        max_overtime_weekly_hours: Number(siteSettings.max_overtime_weekly_hours ?? 12.0),
        require_overtime_approval: Number(siteSettings.require_overtime_approval ?? 1),
        normal_overtime_multiplier: Number(siteSettings.normal_overtime_multiplier ?? 1.5),
        rest_day_overtime_multiplier: Number(siteSettings.rest_day_overtime_multiplier ?? 2.0),
        holiday_overtime_multiplier: Number(siteSettings.holiday_overtime_multiplier ?? 2.5),
        night_overtime_multiplier: Number(siteSettings.night_overtime_multiplier ?? 1.5)
      });
      setSchedulesList(workSchedules || []);
      setSaveSuccessMessage("Settings reverted to active configuration.");
      setSaveErrorMessage(null);
    }
  };

  // Presets
  const applyStandardEthiopianPreset = () => {
    setFormData((prev) => ({
      ...prev,
      work_start_time: "08:30",
      work_end_time: "17:30",
      required_daily_hours: 8.0,
      morning_start_time: "08:30",
      morning_end_time: "12:30",
      afternoon_start_time: "13:30",
      afternoon_end_time: "17:30",
      earliest_checkin_time: "07:00",
      latest_checkin_time: "10:30",
      late_grace_minutes: 15,
      earliest_checkout_time: "16:30",
      latest_checkout_time: "20:00",
      overtime_start_time: "17:30",
      min_overtime_minutes: 30,
      max_overtime_daily_hours: 4.0,
      max_overtime_weekly_hours: 12.0,
      normal_overtime_multiplier: 1.5,
      rest_day_overtime_multiplier: 2.0,
      holiday_overtime_multiplier: 2.5
    }));
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6 sm:p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-8">
        <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Admin-Only Access</h2>
        <p className="text-slate-600 mt-2 text-sm max-w-md mx-auto">
          Attendance & Work Schedule Settings are restricted to Administrators and HR Managers. Please contact an Administrator to configure schedule and overtime policies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Sticky Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Single Source of Truth
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                Labour Proclamation Compliant
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Sliders className="w-6 h-6 text-blue-600" />
              Attendance & Work Schedule Settings
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Configures the master policy for attendance punches, morning & afternoon shifts, checkout grace periods, authorized overtime, and automatic salary integration.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset / Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || hasErrors}
              className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5 ${
                hasErrors
                  ? "bg-slate-300 cursor-not-allowed opacity-75"
                  : "bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-500/20"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving Policy..." : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Feedback Notifications */}
        {saveSuccessMessage && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-2.5 text-xs font-medium animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {saveErrorMessage && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center gap-2.5 text-xs font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveErrorMessage}</span>
          </div>
        )}

        {hasErrors && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Configuration Conflicts Detected:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1 font-medium">
              {Object.values(validationErrors).map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mt-6 pt-4 border-t border-slate-100">
          {[
            { id: "ALL", label: "All Settings", icon: Sliders },
            { id: "REGULAR", label: "1. Regular Work Schedule", icon: Clock },
            { id: "CHECKIN", label: "2. Check-in Rules", icon: Sun },
            { id: "CHECKOUT", label: "3. Check-out Rules", icon: Moon },
            { id: "OVERTIME", label: "4. Overtime & Rates", icon: DollarSign }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}

          <div className="ml-auto">
            <button
              type="button"
              onClick={applyStandardEthiopianPreset}
              className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-600" />
              Load Standard Ethiopian 8H Preset
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: REGULAR WORK SCHEDULE */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "REGULAR") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">1. Regular Work Schedule & Working Hours</h2>
                <p className="text-xs text-slate-500">
                  Defines daily standard start and end times, daily required hours, and morning/afternoon session durations.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              Standard: 8.0 hrs / day
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Normal Check-in / Start Time */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Normal Check-in / Start Time (Daily)
              </label>
              <input
                type="time"
                value={formData.work_start_time || "08:30"}
                onChange={(e) => handleChange("work_start_time", e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Ethiopian Local Time:</span>
                <span className="font-bold text-blue-700">
                  {formatToEthiopianTime(formData.work_start_time || "08:30").shortText}
                </span>
              </div>
            </div>

            {/* Normal Check-out / End Time */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Normal Check-out / End Time (Daily)
              </label>
              <input
                type="time"
                value={formData.work_end_time || "17:30"}
                onChange={(e) => handleChange("work_end_time", e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Ethiopian Local Time:</span>
                <span className="font-bold text-blue-700">
                  {formatToEthiopianTime(formData.work_end_time || "17:30").shortText}
                </span>
              </div>
            </div>

            {/* Required Daily Hours */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Required Daily Working Hours
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.25"
                  min="1"
                  max="12"
                  value={formData.required_daily_hours || 8.0}
                  onChange={(e) => handleChange("required_daily_hours", parseFloat(e.target.value) || 8.0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium">hrs</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Standard under Ethiopian Labour Proclamation Art. 61 is 8 hours / day (48 hrs / week).
              </p>
            </div>
          </div>

          {/* Morning & Afternoon Session Times */}
          <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                Morning & Afternoon Shift Windows
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Morning Start */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Morning Session Start</span>
                <input
                  type="time"
                  value={formData.morning_start_time || "08:30"}
                  onChange={(e) => handleChange("morning_start_time", e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                />
                <span className="text-[10px] text-slate-500 block">
                  {formatToEthiopianTime(formData.morning_start_time || "08:30").shortText}
                </span>
              </div>

              {/* Morning End */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Morning Session End</span>
                <input
                  type="time"
                  value={formData.morning_end_time || "12:30"}
                  onChange={(e) => handleChange("morning_end_time", e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                />
                <span className="text-[10px] text-slate-500 block">
                  {formatToEthiopianTime(formData.morning_end_time || "12:30").shortText}
                </span>
              </div>

              {/* Afternoon Start */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Afternoon Session Start</span>
                <input
                  type="time"
                  value={formData.afternoon_start_time || "13:30"}
                  onChange={(e) => handleChange("afternoon_start_time", e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                />
                <span className="text-[10px] text-slate-500 block">
                  {formatToEthiopianTime(formData.afternoon_start_time || "13:30").shortText}
                </span>
              </div>

              {/* Afternoon End */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-600">Afternoon Session End</span>
                <input
                  type="time"
                  value={formData.afternoon_end_time || "17:30"}
                  onChange={(e) => handleChange("afternoon_end_time", e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold"
                />
                <span className="text-[10px] text-slate-500 block">
                  {formatToEthiopianTime(formData.afternoon_end_time || "17:30").shortText}
                </span>
              </div>
            </div>
          </div>

          {/* 7-Day Weekly Work Schedule */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                Working Days & Weekly Operating Schedule (Sunday – Saturday)
              </label>
              <span className="text-[11px] text-slate-500">
                Click toggles to enable or disable Morning / Afternoon sessions
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Day of Week</th>
                    <th className="py-2.5 px-4">Morning Shift</th>
                    <th className="py-2.5 px-4">Afternoon Shift</th>
                    <th className="py-2.5 px-4">Day Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedulesList.map((day) => {
                    const isMorningWork = day.morning_status === "WORKING";
                    const isAfternoonWork = day.afternoon_status === "WORKING";
                    const isFullOff = !isMorningWork && !isAfternoonWork;
                    const isHalfDay = (isMorningWork && !isAfternoonWork) || (!isMorningWork && isAfternoonWork);

                    return (
                      <tr key={day.day_of_week} className="hover:bg-slate-50/50">
                        <td className="py-2 px-4 font-bold text-slate-800">
                          {day.day_name}
                        </td>
                        <td className="py-2 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              handleScheduleStatusChange(
                                day.day_of_week,
                                "morning",
                                isMorningWork ? "NON_WORKING" : "WORKING"
                              )
                            }
                            className={`px-3 py-1 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                              isMorningWork
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {isMorningWork ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {isMorningWork ? "Working (Morning)" : "Off (Morning)"}
                          </button>
                        </td>
                        <td className="py-2 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              handleScheduleStatusChange(
                                day.day_of_week,
                                "afternoon",
                                isAfternoonWork ? "NON_WORKING" : "WORKING"
                              )
                            }
                            className={`px-3 py-1 rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                              isAfternoonWork
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}
                          >
                            {isAfternoonWork ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            {isAfternoonWork ? "Working (Afternoon)" : "Off (Afternoon)"}
                          </button>
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              isFullOff
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : isHalfDay
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {isFullOff ? "Full Rest Day (Off)" : isHalfDay ? "Half Working Day" : "Regular Working Day"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 2: CHECK-IN RULES */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "CHECKIN") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Check-in Rules & Access Restrictions</h2>
                <p className="text-xs text-slate-500">
                  Enforces earliest arrival boundaries, normal check-in times, grace periods, and duplicate punch restrictions.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg">
              Check-in Controls
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Earliest Check-in Time */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Earliest Allowed Check-in
              </label>
              <input
                type="time"
                value={formData.earliest_checkin_time || "07:00"}
                onChange={(e) => handleChange("earliest_checkin_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.earliest_checkin_time || "07:00").shortText}</b>
              </span>
              <p className="text-[10px] text-slate-400">Punches before this time are rejected.</p>
            </div>

            {/* Normal Check-in Time */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Normal Check-in Time
              </label>
              <input
                type="time"
                value={formData.work_start_time || "08:30"}
                onChange={(e) => handleChange("work_start_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.work_start_time || "08:30").shortText}</b>
              </span>
              <p className="text-[10px] text-slate-400">Shift start for normal hours.</p>
            </div>

            {/* Latest Allowed Check-in */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Latest Allowed Check-in Cutoff
              </label>
              <input
                type="time"
                value={formData.latest_checkin_time || "10:30"}
                onChange={(e) => handleChange("latest_checkin_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.latest_checkin_time || "10:30").shortText}</b>
              </span>
              <p className="text-[10px] text-slate-400">Cutoff for self-service check-in.</p>
            </div>

            {/* Late Grace Period */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Late Check-in Grace Period
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={formData.late_grace_minutes ?? 15}
                  onChange={(e) => handleChange("late_grace_minutes", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-400">mins</span>
              </div>
              <p className="text-[10px] text-slate-400">Grace before marked Late & penalized.</p>
            </div>
          </div>

          {/* Critical Early Arrival Business & Legal Policy */}
          <div className="p-4.5 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-blue-900">
                  Critical Rule: Early Arrival Physical Presence vs. Overtime
                </h3>
                <p className="text-xs text-blue-800/90 leading-relaxed">
                  Under Ethiopian labour standards and company policy, an employee arriving before the normal check-in time (e.g. arriving at 7:30 AM for an 8:00 AM shift) does <b>NOT</b> automatically receive overtime. If the employee is merely waiting or present on site, regular working hours start counting only at the scheduled shift time. Early work only constitutes payable overtime when explicitly authorized and approved.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={Number(formData.prevent_duplicate_checkin) === 1}
                  onChange={(e) => handleChange("prevent_duplicate_checkin", e.target.checked ? 1 : 0)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Prevent Duplicate Check-in</span>
                  <span className="text-[11px] text-slate-500">Blocks multiple check-in attempts for the same session.</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition">
                <input
                  type="checkbox"
                  checked={Number(formData.authorized_early_overtime_enabled) === 1}
                  onChange={(e) => handleChange("authorized_early_overtime_enabled", e.target.checked ? 1 : 0)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Allow Authorized Early-Start Overtime</span>
                  <span className="text-[11px] text-slate-500">Early work is counted only with explicit administrative approval.</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: CHECK-OUT RULES */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "CHECKOUT") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">3. Check-out Rules & Departure Restrictions</h2>
                <p className="text-xs text-slate-500">
                  Controls normal departure times, earliest allowed departures, cutoff restrictions, and missing-checkout rules.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg">
              Departure Controls
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Normal Checkout Time */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Normal Check-out Time
              </label>
              <input
                type="time"
                value={formData.work_end_time || "17:30"}
                onChange={(e) => handleChange("work_end_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.work_end_time || "17:30").shortText}</b>
              </span>
            </div>

            {/* Earliest Allowed Checkout */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Earliest Allowed Check-out
              </label>
              <input
                type="time"
                value={formData.earliest_checkout_time || "16:30"}
                onChange={(e) => handleChange("earliest_checkout_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.earliest_checkout_time || "16:30").shortText}</b>
              </span>
              <p className="text-[10px] text-slate-400">Earlier checkouts require departure permission.</p>
            </div>

            {/* Latest Allowed Checkout */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Latest Allowed Check-out Cutoff
              </label>
              <input
                type="time"
                value={formData.latest_checkout_time || "20:00"}
                onChange={(e) => handleChange("latest_checkout_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.latest_checkout_time || "20:00").shortText}</b>
              </span>
              <p className="text-[10px] text-slate-400">After this, unclosed shifts are flagged missing.</p>
            </div>

            {/* Checkout Grace Period */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Checkout Grace Window
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={formData.checkout_grace_minutes ?? 30}
                  onChange={(e) => handleChange("checkout_grace_minutes", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-400">mins</span>
              </div>
              <p className="text-[10px] text-slate-400">Grace period past session conclusion.</p>
            </div>
          </div>

          {/* Validation Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 transition">
              <input
                type="checkbox"
                checked={Number(formData.prevent_checkout_without_checkin) === 1}
                onChange={(e) => handleChange("prevent_checkout_without_checkin", e.target.checked ? 1 : 0)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Prevent Check-out Without Check-in</span>
                <span className="text-[11px] text-slate-500">Employee must have a verified active check-in record.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-300 transition">
              <input
                type="checkbox"
                checked={Number(formData.prevent_duplicate_checkout) === 1}
                onChange={(e) => handleChange("prevent_duplicate_checkout", e.target.checked ? 1 : 0)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Prevent Duplicate Check-out</span>
                <span className="text-[11px] text-slate-500">Cannot check out twice for the same shift session.</span>
              </div>
            </label>

            <div className="flex items-center gap-3 p-3 bg-emerald-50/50 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-emerald-900 block">Missing Check-out Overtime Protection</span>
                <span className="text-[11px] text-emerald-800">
                  Unclosed shifts strictly produce <b>0</b> overtime and require admin departure correction.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: OVERTIME RULES & RATES */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "OVERTIME") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">4. Overtime Configuration & Labour Proclamation Rates</h2>
                <p className="text-xs text-slate-500">
                  Configures overtime activation, minimum qualifying duration, daily/weekly legal caps, and rate multipliers.
                </p>
              </div>
            </div>

            {/* Master Overtime Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Overtime System:</span>
              <button
                type="button"
                onClick={() => handleChange("overtime_enabled", Number(formData.overtime_enabled) === 1 ? 0 : 1)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  Number(formData.overtime_enabled) === 1 ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    Number(formData.overtime_enabled) === 1 ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overtime Start Time */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Overtime Threshold Time
              </label>
              <input
                type="time"
                value={formData.overtime_start_time || "17:30"}
                onChange={(e) => handleChange("overtime_start_time", e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-500 block">
                Ethiopian: <b className="text-slate-700">{formatToEthiopianTime(formData.overtime_start_time || "17:30").shortText}</b>
              </span>
              <p className="text-[10px] text-slate-400">Work after this time is eligible for overtime.</p>
            </div>

            {/* Minimum Overtime Duration */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Minimum Qualifying Duration
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="120"
                  step="5"
                  value={formData.min_overtime_minutes ?? 30}
                  onChange={(e) => handleChange("min_overtime_minutes", parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-400">mins</span>
              </div>
              <p className="text-[10px] text-slate-400">Work under this duration does not earn overtime.</p>
            </div>

            {/* Maximum Overtime Per Day */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Maximum Overtime Per Day Cap
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="10"
                  value={formData.max_overtime_daily_hours ?? 4.0}
                  onChange={(e) => handleChange("max_overtime_daily_hours", parseFloat(e.target.value) || 4.0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-400">hrs</span>
              </div>
              <p className="text-[10px] text-slate-400">Ethiopian law Art. 67 recommends max 2–4 hrs/day.</p>
            </div>

            {/* Maximum Overtime Per Week */}
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Maximum Overtime Per Week Cap
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="24"
                  value={formData.max_overtime_weekly_hours ?? 12.0}
                  onChange={(e) => handleChange("max_overtime_weekly_hours", parseFloat(e.target.value) || 12.0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                />
                <span className="absolute right-3 top-2 text-[11px] text-slate-400">hrs</span>
              </div>
              <p className="text-[10px] text-slate-400">Compliant with Ethiopian Labour Proclamation Art. 67.</p>
            </div>
          </div>

          {/* Overtime Approval Policy Switch */}
          <div className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Mandatory Administrative / Managerial Approval Required
              </h3>
              <p className="text-xs text-amber-800/90 max-w-2xl">
                When enabled, overtime hours are marked as <b>PENDING</b>. Unapproved overtime is <b>never included in payable payroll</b>. Only explicitly approved overtime integrates into salary calculation.
              </p>
            </div>

            <label className="flex items-center gap-3 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={Number(formData.require_overtime_approval) === 1}
                onChange={(e) => handleChange("require_overtime_approval", e.target.checked ? 1 : 0)}
                className="rounded text-amber-600 focus:ring-amber-500 w-5 h-5 cursor-pointer"
              />
              <span className="text-xs font-bold text-amber-900">
                {Number(formData.require_overtime_approval) === 1 ? "Approval Required" : "Auto-Approved"}
              </span>
            </label>
          </div>

          {/* Configurable Overtime Multipliers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Overtime Multiplier Rates (Ethiopian Labour Proclamation Art. 68)
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">Applied to basic hourly wage</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Normal Overtime Multiplier */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Normal Day Overtime</span>
                <span className="text-[10px] text-slate-400 block">Standard overtime on regular workday</span>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="3.0"
                    value={formData.normal_overtime_multiplier ?? 1.5}
                    onChange={(e) => handleChange("normal_overtime_multiplier", parseFloat(e.target.value) || 1.5)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800 pr-10"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">x</span>
                </div>
                <span className="text-[10px] text-emerald-700 font-semibold block">Art. 68(1)(a): 1.25x – 1.50x</span>
              </div>

              {/* Night Overtime Multiplier */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Night Shift Overtime</span>
                <span className="text-[10px] text-slate-400 block">Work between 10:00 PM and 6:00 AM</span>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="3.0"
                    value={formData.night_overtime_multiplier ?? 1.5}
                    onChange={(e) => handleChange("night_overtime_multiplier", parseFloat(e.target.value) || 1.5)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800 pr-10"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">x</span>
                </div>
                <span className="text-[10px] text-indigo-700 font-semibold block">Art. 68(1)(b): 1.50x base</span>
              </div>

              {/* Rest Day Overtime Multiplier */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Weekly Rest Day Overtime</span>
                <span className="text-[10px] text-slate-400 block">Work performed on scheduled rest days</span>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="4.0"
                    value={formData.rest_day_overtime_multiplier ?? 2.0}
                    onChange={(e) => handleChange("rest_day_overtime_multiplier", parseFloat(e.target.value) || 2.0)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800 pr-10"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">x</span>
                </div>
                <span className="text-[10px] text-purple-700 font-semibold block">Art. 68(1)(c): 2.00x double pay</span>
              </div>

              {/* Public Holiday Multiplier */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-bold text-slate-700 block">Public Holiday Overtime</span>
                <span className="text-[10px] text-slate-400 block">Work on national or gazetted public holidays</span>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="4.0"
                    value={formData.holiday_overtime_multiplier ?? 2.5}
                    onChange={(e) => handleChange("holiday_overtime_multiplier", parseFloat(e.target.value) || 2.5)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-800 pr-10"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">x</span>
                </div>
                <span className="text-[10px] text-rose-700 font-semibold block">Art. 68(1)(d): 2.50x premium rate</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 5: ACTIVE POLICY SUMMARY & COMPLIANCE BRIEF */}
      {/* ======================================================== */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">Active Policy Summary (Single Source of Truth)</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Synced with Backend Attendance Engine & Payroll
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Normal Shift</span>
            <span className="text-sm font-bold text-white">
              {formData.work_start_time} – {formData.work_end_time}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {formatToEthiopianTime(formData.work_start_time).shortText} – {formatToEthiopianTime(formData.work_end_time).shortText}
            </span>
          </div>

          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Check-in Window</span>
            <span className="text-sm font-bold text-amber-300">
              {formData.earliest_checkin_time} – {formData.latest_checkin_time}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Grace: {formData.late_grace_minutes} mins
            </span>
          </div>

          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Check-out Window</span>
            <span className="text-sm font-bold text-indigo-300">
              {formData.earliest_checkout_time} – {formData.latest_checkout_time}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Grace: {formData.checkout_grace_minutes} mins
            </span>
          </div>

          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Daily Standard</span>
            <span className="text-sm font-bold text-emerald-300">
              {formData.required_daily_hours} Hours
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Weekly: 48.0 Hours Max
            </span>
          </div>

          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Overtime Status</span>
            <span className={`text-sm font-bold ${Number(formData.overtime_enabled) === 1 ? "text-emerald-400" : "text-rose-400"}`}>
              {Number(formData.overtime_enabled) === 1 ? "Active (Enabled)" : "Disabled"}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Approval: {Number(formData.require_overtime_approval) === 1 ? "Mandatory" : "Automatic"}
            </span>
          </div>

          <div className="bg-slate-800/70 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Overtime Caps</span>
            <span className="text-sm font-bold text-blue-300">
              {formData.max_overtime_daily_hours}h/d · {formData.max_overtime_weekly_hours}h/w
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Min Threshold: {formData.min_overtime_minutes}m
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
          <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>
            <b>Legal Safety Guarantee:</b> Physical early presence never produces automatic overtime without approval. Forgotten/missing checkouts never generate overtime. All settings directly govern the backend validation and salary engines.
          </span>
        </div>
      </div>
    </div>
  );
};
