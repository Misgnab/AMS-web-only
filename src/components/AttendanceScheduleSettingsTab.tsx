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
  BookOpen,
  Sunrise,
  Sunset
} from "lucide-react";

interface ValidationErrors {
  workSchedule?: string;
  morningSchedule?: string;
  afternoonSchedule?: string;
  morningCheckIn?: string;
  afternoonCheckIn?: string;
  morningCheckOut?: string;
  afternoonCheckOut?: string;
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

  const isAdmin = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(user?.role || "");

  // Local form state with full Morning and Afternoon session support
  const [formData, setFormData] = useState<Partial<SiteSettings>>({
    // Regular Work Schedule (Morning & Afternoon)
    work_start_time: "08:30",
    work_end_time: "17:30",
    required_daily_hours: 8.0,
    morning_start_time: "08:30",
    morning_end_time: "12:30",
    afternoon_start_time: "13:30",
    afternoon_end_time: "17:30",

    // Morning Session Check-in Rules
    morning_earliest_checkin_time: "07:00",
    morning_latest_checkin_time: "10:30",
    morning_late_grace_minutes: 15,

    // Afternoon Session Check-in Rules
    afternoon_earliest_checkin_time: "12:30",
    afternoon_latest_checkin_time: "15:30",
    afternoon_late_grace_minutes: 15,

    // General Check-in Safeguards & Fallbacks
    earliest_checkin_time: "07:00",
    latest_checkin_time: "10:30",
    late_grace_minutes: 15,
    allowed_minor_lates: 2,
    prevent_duplicate_checkin: 1,
    early_arrival_as_overtime: 0,
    authorized_early_overtime_enabled: 1,
    early_overtime_requires_approval: 1,

    // Morning Session Check-out Rules
    morning_earliest_checkout_time: "11:30",
    morning_latest_checkout_time: "13:30",
    morning_checkout_grace_minutes: 30,

    // Afternoon Session Check-out Rules
    afternoon_earliest_checkout_time: "16:30",
    afternoon_latest_checkout_time: "20:00",
    afternoon_checkout_grace_minutes: 30,

    // General Check-out Safeguards & Fallbacks
    earliest_checkout_time: "16:30",
    latest_checkout_time: "20:00",
    checkout_grace_minutes: 30,
    prevent_checkout_without_checkin: 1,
    prevent_duplicate_checkout: 1,
    missing_checkout_auto_overtime: 0,

    // Overtime Rules (Morning & Afternoon Sessions)
    overtime_enabled: 1,
    morning_overtime_enabled: 0,
    afternoon_overtime_enabled: 1,
    afternoon_overtime_start_time: "17:30",
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
        // Regular Work Schedule
        work_start_time: siteSettings.morning_start_time || siteSettings.work_start_time || "08:30",
        work_end_time: siteSettings.afternoon_end_time || siteSettings.work_end_time || "17:30",
        required_daily_hours: Number(siteSettings.required_daily_hours ?? 8.0),
        morning_start_time: siteSettings.morning_start_time || "08:30",
        morning_end_time: siteSettings.morning_end_time || "12:30",
        afternoon_start_time: siteSettings.afternoon_start_time || "13:30",
        afternoon_end_time: siteSettings.afternoon_end_time || "17:30",

        // Morning Session Check-in Rules
        morning_earliest_checkin_time: siteSettings.morning_earliest_checkin_time || siteSettings.earliest_checkin_time || "07:00",
        morning_latest_checkin_time: siteSettings.morning_latest_checkin_time || siteSettings.latest_checkin_time || "10:30",
        morning_late_grace_minutes: Number(siteSettings.morning_late_grace_minutes ?? siteSettings.late_grace_minutes ?? 15),

        // Afternoon Session Check-in Rules
        afternoon_earliest_checkin_time: siteSettings.afternoon_earliest_checkin_time || "12:30",
        afternoon_latest_checkin_time: siteSettings.afternoon_latest_checkin_time || "15:30",
        afternoon_late_grace_minutes: Number(siteSettings.afternoon_late_grace_minutes ?? siteSettings.late_grace_minutes ?? 15),

        // General Check-in Safeguards & Fallbacks
        earliest_checkin_time: siteSettings.morning_earliest_checkin_time || siteSettings.earliest_checkin_time || "07:00",
        latest_checkin_time: siteSettings.morning_latest_checkin_time || siteSettings.latest_checkin_time || "10:30",
        late_grace_minutes: Number(siteSettings.morning_late_grace_minutes ?? siteSettings.late_grace_minutes ?? 15),
        allowed_minor_lates: Number(siteSettings.allowed_minor_lates ?? 2),
        prevent_duplicate_checkin: Number(siteSettings.prevent_duplicate_checkin ?? 1),
        early_arrival_as_overtime: Number(siteSettings.early_arrival_as_overtime ?? 0),
        authorized_early_overtime_enabled: Number(siteSettings.authorized_early_overtime_enabled ?? 1),
        early_overtime_requires_approval: Number(siteSettings.early_overtime_requires_approval ?? 1),

        // Morning Session Check-out Rules
        morning_earliest_checkout_time: siteSettings.morning_earliest_checkout_time || "11:30",
        morning_latest_checkout_time: siteSettings.morning_latest_checkout_time || "13:30",
        morning_checkout_grace_minutes: Number(siteSettings.morning_checkout_grace_minutes ?? siteSettings.checkout_grace_minutes ?? 30),

        // Afternoon Session Check-out Rules
        afternoon_earliest_checkout_time: siteSettings.afternoon_earliest_checkout_time || siteSettings.earliest_checkout_time || "16:30",
        afternoon_latest_checkout_time: siteSettings.afternoon_latest_checkout_time || siteSettings.latest_checkout_time || "20:00",
        afternoon_checkout_grace_minutes: Number(siteSettings.afternoon_checkout_grace_minutes ?? siteSettings.checkout_grace_minutes ?? 30),

        // General Check-out Safeguards & Fallbacks
        earliest_checkout_time: siteSettings.afternoon_earliest_checkout_time || siteSettings.earliest_checkout_time || "16:30",
        latest_checkout_time: siteSettings.afternoon_latest_checkout_time || siteSettings.latest_checkout_time || "20:00",
        checkout_grace_minutes: Number(siteSettings.afternoon_checkout_grace_minutes ?? siteSettings.checkout_grace_minutes ?? 30),
        prevent_checkout_without_checkin: Number(siteSettings.prevent_checkout_without_checkin ?? 1),
        prevent_duplicate_checkout: Number(siteSettings.prevent_duplicate_checkout ?? 1),
        missing_checkout_auto_overtime: Number(siteSettings.missing_checkout_auto_overtime ?? 0),

        // Overtime Rules (Morning & Afternoon Sessions)
        overtime_enabled: Number(siteSettings.overtime_enabled ?? 1),
        morning_overtime_enabled: Number(siteSettings.morning_overtime_enabled ?? 0),
        afternoon_overtime_enabled: Number(siteSettings.afternoon_overtime_enabled ?? 1),
        afternoon_overtime_start_time: siteSettings.afternoon_overtime_start_time || siteSettings.overtime_start_time || "17:30",
        overtime_start_time: siteSettings.afternoon_overtime_start_time || siteSettings.overtime_start_time || "17:30",
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
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // Keep legacy fallbacks in sync with primary session settings
      if (field === "morning_start_time") next.work_start_time = value;
      if (field === "afternoon_end_time") next.work_end_time = value;
      if (field === "morning_earliest_checkin_time") next.earliest_checkin_time = value;
      if (field === "morning_latest_checkin_time") next.latest_checkin_time = value;
      if (field === "morning_late_grace_minutes") next.late_grace_minutes = value;
      if (field === "afternoon_earliest_checkout_time") next.earliest_checkout_time = value;
      if (field === "afternoon_latest_checkout_time") next.latest_checkout_time = value;
      if (field === "afternoon_checkout_grace_minutes") next.checkout_grace_minutes = value;
      if (field === "afternoon_overtime_start_time") next.overtime_start_time = value;
      return next;
    });
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
  };

  // Helper to toggle schedule status for weekly schedule
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

  // Real-time conflict validations across both morning and afternoon sessions
  const validationErrors = useMemo<ValidationErrors>(() => {
    const errors: ValidationErrors = {};

    const morningStart = toMinutes(formData.morning_start_time);
    const morningEnd = toMinutes(formData.morning_end_time);
    if (morningStart >= morningEnd) {
      errors.morningSchedule = "Morning session start time must be earlier than morning session end time.";
    }

    const afternoonStart = toMinutes(formData.afternoon_start_time);
    const afternoonEnd = toMinutes(formData.afternoon_end_time);
    if (afternoonStart >= afternoonEnd) {
      errors.afternoonSchedule = "Afternoon session start time must be earlier than afternoon session end time.";
    }

    if (morningEnd > afternoonStart) {
      errors.morningSchedule = "Morning session end cannot be after Afternoon session start (midday break overlap).";
    }

    const reqDaily = Number(formData.required_daily_hours || 0);
    if (reqDaily > 10.0 || reqDaily <= 0) {
      errors.workSchedule = "Under Ethiopian Labour Proclamation No. 1156/2019 Art. 61, regular daily work hours cannot exceed 8 to 10 hours.";
    }

    // Morning Session Check-in Rules
    const mEarliestCheckin = toMinutes(formData.morning_earliest_checkin_time);
    if (mEarliestCheckin > morningStart) {
      errors.morningCheckIn = "Morning earliest allowed check-in cannot be later than morning start time.";
    }
    const mLatestCheckin = toMinutes(formData.morning_latest_checkin_time);
    if (mLatestCheckin > 0 && mLatestCheckin < morningStart) {
      errors.morningCheckIn = "Morning latest check-in cutoff cannot be earlier than morning start time.";
    }
    if (Number(formData.morning_late_grace_minutes || 0) < 0) {
      errors.morningCheckIn = "Morning check-in grace period cannot be negative.";
    }

    // Afternoon Session Check-in Rules
    const aEarliestCheckin = toMinutes(formData.afternoon_earliest_checkin_time);
    if (aEarliestCheckin > afternoonStart) {
      errors.afternoonCheckIn = "Afternoon earliest allowed check-in cannot be later than afternoon start time.";
    }
    const aLatestCheckin = toMinutes(formData.afternoon_latest_checkin_time);
    if (aLatestCheckin > 0 && aLatestCheckin < afternoonStart) {
      errors.afternoonCheckIn = "Afternoon latest check-in cutoff cannot be earlier than afternoon start time.";
    }
    if (Number(formData.afternoon_late_grace_minutes || 0) < 0) {
      errors.afternoonCheckIn = "Afternoon check-in grace period cannot be negative.";
    }

    // Morning Session Check-out Rules
    const mEarliestCheckout = toMinutes(formData.morning_earliest_checkout_time);
    if (mEarliestCheckout > morningEnd) {
      errors.morningCheckOut = "Morning earliest allowed check-out cannot be after morning session end.";
    }
    const mLatestCheckout = toMinutes(formData.morning_latest_checkout_time);
    if (mLatestCheckout > 0 && mLatestCheckout < morningEnd) {
      errors.morningCheckOut = "Morning latest check-out cutoff cannot be earlier than morning session end.";
    }
    if (Number(formData.morning_checkout_grace_minutes || 0) < 0) {
      errors.morningCheckOut = "Morning checkout grace period cannot be negative.";
    }

    // Afternoon Session Check-out Rules
    const aEarliestCheckout = toMinutes(formData.afternoon_earliest_checkout_time);
    if (aEarliestCheckout > afternoonEnd) {
      errors.afternoonCheckOut = "Afternoon earliest allowed check-out cannot be after afternoon session end.";
    }
    const aLatestCheckout = toMinutes(formData.afternoon_latest_checkout_time);
    if (aLatestCheckout > 0 && aLatestCheckout < afternoonEnd) {
      errors.afternoonCheckOut = "Afternoon latest check-out cutoff cannot be earlier than afternoon session end.";
    }
    if (Number(formData.afternoon_checkout_grace_minutes || 0) < 0) {
      errors.afternoonCheckOut = "Afternoon checkout grace period cannot be negative.";
    }

    // Overtime Rules
    const otStart = toMinutes(formData.afternoon_overtime_start_time || formData.overtime_start_time);
    if (otStart > 0 && otStart < afternoonEnd) {
      errors.overtime = "Afternoon overtime start time cannot be earlier than afternoon session end time.";
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
      // Guarantee primary session sync
      work_start_time: formData.morning_start_time,
      work_end_time: formData.afternoon_end_time,
      earliest_checkin_time: formData.morning_earliest_checkin_time,
      latest_checkin_time: formData.morning_latest_checkin_time,
      late_grace_minutes: formData.morning_late_grace_minutes,
      earliest_checkout_time: formData.afternoon_earliest_checkout_time,
      latest_checkout_time: formData.afternoon_latest_checkout_time,
      checkout_grace_minutes: formData.afternoon_checkout_grace_minutes,
      overtime_start_time: formData.afternoon_overtime_start_time || formData.overtime_start_time,
      weekly_schedule: schedulesList
    };

    const result = await saveAttendanceSettings(payload);
    setIsSaving(false);

    if (result.success) {
      setSaveSuccessMessage("Morning and Afternoon schedule settings saved successfully! All attendance checks, overtime calculations, and payroll rules are now synchronized live.");
      setTimeout(() => setSaveSuccessMessage(null), 6000);
    } else {
      setSaveErrorMessage(result.error || "Failed to save settings. Please try again.");
    }
  };

  // Revert/Reset
  const handleReset = () => {
    if (siteSettings) {
      setFormData({
        work_start_time: siteSettings.morning_start_time || siteSettings.work_start_time || "08:30",
        work_end_time: siteSettings.afternoon_end_time || siteSettings.work_end_time || "17:30",
        required_daily_hours: Number(siteSettings.required_daily_hours ?? 8.0),
        morning_start_time: siteSettings.morning_start_time || "08:30",
        morning_end_time: siteSettings.morning_end_time || "12:30",
        afternoon_start_time: siteSettings.afternoon_start_time || "13:30",
        afternoon_end_time: siteSettings.afternoon_end_time || "17:30",
        morning_earliest_checkin_time: siteSettings.morning_earliest_checkin_time || "07:00",
        morning_latest_checkin_time: siteSettings.morning_latest_checkin_time || "10:30",
        morning_late_grace_minutes: Number(siteSettings.morning_late_grace_minutes ?? 15),
        afternoon_earliest_checkin_time: siteSettings.afternoon_earliest_checkin_time || "12:30",
        afternoon_latest_checkin_time: siteSettings.afternoon_latest_checkin_time || "15:30",
        afternoon_late_grace_minutes: Number(siteSettings.afternoon_late_grace_minutes ?? 15),
        earliest_checkin_time: siteSettings.morning_earliest_checkin_time || "07:00",
        latest_checkin_time: siteSettings.morning_latest_checkin_time || "10:30",
        late_grace_minutes: Number(siteSettings.morning_late_grace_minutes ?? 15),
        allowed_minor_lates: Number(siteSettings.allowed_minor_lates ?? 2),
        prevent_duplicate_checkin: Number(siteSettings.prevent_duplicate_checkin ?? 1),
        early_arrival_as_overtime: Number(siteSettings.early_arrival_as_overtime ?? 0),
        authorized_early_overtime_enabled: Number(siteSettings.authorized_early_overtime_enabled ?? 1),
        early_overtime_requires_approval: Number(siteSettings.early_overtime_requires_approval ?? 1),
        morning_earliest_checkout_time: siteSettings.morning_earliest_checkout_time || "11:30",
        morning_latest_checkout_time: siteSettings.morning_latest_checkout_time || "13:30",
        morning_checkout_grace_minutes: Number(siteSettings.morning_checkout_grace_minutes ?? 30),
        afternoon_earliest_checkout_time: siteSettings.afternoon_earliest_checkout_time || "16:30",
        afternoon_latest_checkout_time: siteSettings.afternoon_latest_checkout_time || "20:00",
        afternoon_checkout_grace_minutes: Number(siteSettings.afternoon_checkout_grace_minutes ?? 30),
        earliest_checkout_time: siteSettings.afternoon_earliest_checkout_time || "16:30",
        latest_checkout_time: siteSettings.afternoon_latest_checkout_time || "20:00",
        checkout_grace_minutes: Number(siteSettings.afternoon_checkout_grace_minutes ?? 30),
        prevent_checkout_without_checkin: Number(siteSettings.prevent_checkout_without_checkin ?? 1),
        prevent_duplicate_checkout: Number(siteSettings.prevent_duplicate_checkout ?? 1),
        missing_checkout_auto_overtime: Number(siteSettings.missing_checkout_auto_overtime ?? 0),
        overtime_enabled: Number(siteSettings.overtime_enabled ?? 1),
        morning_overtime_enabled: Number(siteSettings.morning_overtime_enabled ?? 0),
        afternoon_overtime_enabled: Number(siteSettings.afternoon_overtime_enabled ?? 1),
        afternoon_overtime_start_time: siteSettings.afternoon_overtime_start_time || "17:30",
        overtime_start_time: siteSettings.afternoon_overtime_start_time || "17:30",
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
  const applyStandardCommercialPreset = () => {
    setFormData((prev) => ({
      ...prev,
      work_start_time: "08:30",
      work_end_time: "17:30",
      required_daily_hours: 8.0,
      morning_start_time: "08:30",
      morning_end_time: "12:30",
      afternoon_start_time: "13:30",
      afternoon_end_time: "17:30",
      morning_earliest_checkin_time: "07:00",
      morning_latest_checkin_time: "10:30",
      morning_late_grace_minutes: 15,
      afternoon_earliest_checkin_time: "12:30",
      afternoon_latest_checkin_time: "15:30",
      afternoon_late_grace_minutes: 15,
      earliest_checkin_time: "07:00",
      latest_checkin_time: "10:30",
      late_grace_minutes: 15,
      morning_earliest_checkout_time: "11:30",
      morning_latest_checkout_time: "13:30",
      morning_checkout_grace_minutes: 30,
      afternoon_earliest_checkout_time: "16:30",
      afternoon_latest_checkout_time: "20:00",
      afternoon_checkout_grace_minutes: 30,
      earliest_checkout_time: "16:30",
      latest_checkout_time: "20:00",
      checkout_grace_minutes: 30,
      morning_overtime_enabled: 0,
      afternoon_overtime_enabled: 1,
      afternoon_overtime_start_time: "17:30",
      overtime_start_time: "17:30",
      min_overtime_minutes: 30,
      max_overtime_daily_hours: 4.0,
      max_overtime_weekly_hours: 12.0,
      normal_overtime_multiplier: 1.5,
      rest_day_overtime_multiplier: 2.0,
      holiday_overtime_multiplier: 2.5
    }));
  };

  const applyConstructionSitePreset = () => {
    setFormData((prev) => ({
      ...prev,
      work_start_time: "07:00",
      work_end_time: "16:00",
      required_daily_hours: 8.0,
      morning_start_time: "07:00",
      morning_end_time: "12:00",
      afternoon_start_time: "13:00",
      afternoon_end_time: "16:00",
      morning_earliest_checkin_time: "06:00",
      morning_latest_checkin_time: "08:30",
      morning_late_grace_minutes: 15,
      afternoon_earliest_checkin_time: "12:00",
      afternoon_latest_checkin_time: "14:00",
      afternoon_late_grace_minutes: 15,
      earliest_checkin_time: "06:00",
      latest_checkin_time: "08:30",
      late_grace_minutes: 15,
      morning_earliest_checkout_time: "11:00",
      morning_latest_checkout_time: "13:00",
      morning_checkout_grace_minutes: 30,
      afternoon_earliest_checkout_time: "15:30",
      afternoon_latest_checkout_time: "19:00",
      afternoon_checkout_grace_minutes: 30,
      earliest_checkout_time: "15:30",
      latest_checkout_time: "19:00",
      checkout_grace_minutes: 30,
      morning_overtime_enabled: 1,
      afternoon_overtime_enabled: 1,
      afternoon_overtime_start_time: "16:00",
      overtime_start_time: "16:00",
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
          Attendance & Work Schedule Settings are restricted to Administrators and HR Managers. Please contact an Administrator to configure session hours, check-in windows, and overtime policies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                Single Source of Truth
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                Morning & Afternoon Sessions Active
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                Labour Proclamation Compliant
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Sliders className="w-6 h-6 text-blue-600" />
              Attendance & Shift Schedule Settings
            </h1>
            <p className="text-sm text-slate-600 max-w-3xl">
              Configure master schedule policies for both <b>Morning (የጧት)</b> and <b>Afternoon (የከሰዓት)</b> sessions: working hours, check-in access windows, departure rules, grace periods, authorized overtime, and payroll synchronization.
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
              {isSaving ? "Saving Policy..." : "Save Schedule Changes"}
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
            { id: "REGULAR", label: "1. Work Shifts & Calendar", icon: Clock },
            { id: "CHECKIN", label: "2. Session Check-in Rules", icon: Sun },
            { id: "CHECKOUT", label: "3. Session Check-out Rules", icon: Moon },
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

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={applyStandardCommercialPreset}
              className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-blue-600" />
              Standard 8H Commercial
            </button>
            <button
              type="button"
              onClick={applyConstructionSitePreset}
              className="text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              Construction Site (7AM-4PM)
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: REGULAR WORK SCHEDULE & SHIFT SESSIONS */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "REGULAR") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">1. Regular Work Schedule & Shift Sessions</h2>
                <p className="text-xs text-slate-500">
                  Configures daily working hours for both <b>Morning (የጧት)</b> and <b>Afternoon (የከሰዓት)</b> shifts, midday break duration, and weekly operating days.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              Daily Target: {formData.required_daily_hours || 8.0} hrs
            </span>
          </div>

          {/* Morning & Afternoon Session Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Morning Session Card */}
            <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-200/80 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <Sunrise className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                      Morning Session (የጧት ፈረቃ)
                    </h3>
                    <span className="text-[11px] text-amber-800">First half of the business day</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900">
                  {toMinutes(formData.morning_end_time) > toMinutes(formData.morning_start_time)
                    ? `${((toMinutes(formData.morning_end_time) - toMinutes(formData.morning_start_time)) / 60).toFixed(1)} hrs`
                    : "4.0 hrs"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Morning Start */}
                <div className="bg-white p-3 rounded-xl border border-amber-200/70 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.morning_start_time || "08:30"}
                    onChange={(e) => handleChange("morning_start_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Ethiopian Clock:</span>
                    <span className="font-bold text-amber-800">
                      {formatToEthiopianTime(formData.morning_start_time || "08:30", "Morning").shortText}
                    </span>
                  </div>
                </div>

                {/* Morning End */}
                <div className="bg-white p-3 rounded-xl border border-amber-200/70 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning End Time
                  </label>
                  <input
                    type="time"
                    value={formData.morning_end_time || "12:30"}
                    onChange={(e) => handleChange("morning_end_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Ethiopian Clock:</span>
                    <span className="font-bold text-amber-800">
                      {formatToEthiopianTime(formData.morning_end_time || "12:30", "Morning").shortText}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Afternoon Session Card */}
            <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-200/80 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Sunset className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      Afternoon Session (የከሰዓት ፈረቃ)
                    </h3>
                    <span className="text-[11px] text-indigo-800">Second half of the business day</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-200/70 text-indigo-900">
                  {toMinutes(formData.afternoon_end_time) > toMinutes(formData.afternoon_start_time)
                    ? `${((toMinutes(formData.afternoon_end_time) - toMinutes(formData.afternoon_start_time)) / 60).toFixed(1)} hrs`
                    : "4.0 hrs"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Afternoon Start */}
                <div className="bg-white p-3 rounded-xl border border-indigo-200/70 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_start_time || "13:30"}
                    onChange={(e) => handleChange("afternoon_start_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Ethiopian Clock:</span>
                    <span className="font-bold text-indigo-800">
                      {formatToEthiopianTime(formData.afternoon_start_time || "13:30", "Afternoon").shortText}
                    </span>
                  </div>
                </div>

                {/* Afternoon End */}
                <div className="bg-white p-3 rounded-xl border border-indigo-200/70 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon End Time
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_end_time || "17:30"}
                    onChange={(e) => handleChange("afternoon_end_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Ethiopian Clock:</span>
                    <span className="font-bold text-indigo-800">
                      {formatToEthiopianTime(formData.afternoon_end_time || "17:30", "Afternoon").shortText}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Required Hours & Midday Break Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Required Daily Working Hours
              </span>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.25"
                  min="1"
                  max="12"
                  value={formData.required_daily_hours || 8.0}
                  onChange={(e) => handleChange("required_daily_hours", parseFloat(e.target.value) || 8.0)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none pr-12"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">hrs</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Ethiopian Labour Proclamation Art. 61: max 8h/day (48h/week).
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Scheduled Midday Break (Lunch)
              </span>
              <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {formData.morning_end_time} – {formData.afternoon_start_time}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                  {toMinutes(formData.afternoon_start_time) > toMinutes(formData.morning_end_time)
                    ? `${((toMinutes(formData.afternoon_start_time) - toMinutes(formData.morning_end_time)) / 60).toFixed(1)} hr break`
                    : "0 hr"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Rest period between Morning check-out and Afternoon check-in.
              </p>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Operating Spread
              </span>
              <div className="mt-1 p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 font-mono">
                  {formData.morning_start_time} – {formData.afternoon_end_time}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                  {formatToEthiopianTime(formData.morning_start_time || "08:30").shortText} – {formatToEthiopianTime(formData.afternoon_end_time || "17:30").shortText}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Daily facility opening and departure envelope.
              </p>
            </div>
          </div>

          {/* 7-Day Weekly Work Schedule Table */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                Working Days & Weekly Operating Schedule (Sunday – Saturday)
              </label>
              <span className="text-[11px] text-slate-500">
                Click switches to enable or disable Morning / Afternoon sessions per day
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4">Day of Week</th>
                    <th className="py-2.5 px-4">Morning Shift (የጧት ፈረቃ)</th>
                    <th className="py-2.5 px-4">Afternoon Shift (የከሰዓት ፈረቃ)</th>
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
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
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
                                ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
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
      {/* SECTION 2: SESSION CHECK-IN RULES */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "CHECKIN") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Session Check-in Rules & Access Windows</h2>
                <p className="text-xs text-slate-500">
                  Separately configure arrival validation for <b>Morning Session (የጧት መግቢያ)</b> and <b>Afternoon Session (የከሰዓት መግቢያ)</b>: earliest permitted punch, shift start, cutoff boundary, and late grace periods.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg">
              Session-Specific Boundaries
            </span>
          </div>

          {/* Morning & Afternoon Check-in Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Morning Session Check-in Rules */}
            <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-200/80 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                <Sunrise className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Morning Session Check-in Rules (የጧት መግቢያ ደንቦች)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Morning Normal Start Time */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Scheduled Start
                  </label>
                  <input
                    type="time"
                    value={formData.morning_start_time || "08:30"}
                    onChange={(e) => handleChange("morning_start_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-amber-800">{formatToEthiopianTime(formData.morning_start_time || "08:30", "Morning").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Shift start for normal morning hours.</p>
                </div>

                {/* Morning Earliest Allowed Check-in */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Earliest Check-in
                  </label>
                  <input
                    type="time"
                    value={formData.morning_earliest_checkin_time || "07:00"}
                    onChange={(e) => handleChange("morning_earliest_checkin_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-amber-800">{formatToEthiopianTime(formData.morning_earliest_checkin_time || "07:00", "Morning").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Punches before this time are rejected.</p>
                </div>

                {/* Morning Latest Check-in Cutoff */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Latest Check-in Cutoff
                  </label>
                  <input
                    type="time"
                    value={formData.morning_latest_checkin_time || "10:30"}
                    onChange={(e) => handleChange("morning_latest_checkin_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-amber-800">{formatToEthiopianTime(formData.morning_latest_checkin_time || "10:30", "Morning").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Cutoff for morning punch window.</p>
                </div>

                {/* Morning Late Grace Period */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Late Grace Period
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={formData.morning_late_grace_minutes ?? 15}
                      onChange={(e) => handleChange("morning_late_grace_minutes", parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">mins</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Grace before marked Late & penalized.</p>
                </div>
              </div>
            </div>

            {/* Afternoon Session Check-in Rules */}
            <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-200/80 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-indigo-200/60">
                <Sunset className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Afternoon Session Check-in Rules (የከሰዓት መግቢያ ደንቦች)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Afternoon Normal Start Time */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Scheduled Start
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_start_time || "13:30"}
                    onChange={(e) => handleChange("afternoon_start_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_start_time || "13:30", "Afternoon").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Shift start for afternoon hours.</p>
                </div>

                {/* Afternoon Earliest Allowed Check-in */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Earliest Check-in
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_earliest_checkin_time || "12:30"}
                    onChange={(e) => handleChange("afternoon_earliest_checkin_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_earliest_checkin_time || "12:30", "Afternoon").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Punches before this time are rejected.</p>
                </div>

                {/* Afternoon Latest Check-in Cutoff */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Latest Check-in Cutoff
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_latest_checkin_time || "15:30"}
                    onChange={(e) => handleChange("afternoon_latest_checkin_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_latest_checkin_time || "15:30", "Afternoon").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Cutoff for afternoon punch window.</p>
                </div>

                {/* Afternoon Late Grace Period */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Late Grace Period
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={formData.afternoon_late_grace_minutes ?? 15}
                      onChange={(e) => handleChange("afternoon_late_grace_minutes", parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">mins</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Grace before marked Late & penalized.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Common Check-in Policy Safeguards */}
          <div className="p-4.5 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-blue-900">
                  Critical Policy: Session Check-in Rules & Early Arrival Handling
                </h3>
                <p className="text-xs text-blue-800/90 leading-relaxed">
                  Under Ethiopian labour proclamation standards and company policy, arriving physically early for either the Morning or Afternoon session does <b>NOT</b> generate payable overtime automatically. Regular session hours begin counting only at the scheduled session start. Early work is counted as payable overtime only when authorized by an administrator.
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
                  <span className="text-xs font-bold text-slate-800 block">Prevent Duplicate Check-in Per Session</span>
                  <span className="text-[11px] text-slate-500">Blocks multiple check-in punches for the same shift session.</span>
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
                  <span className="text-xs font-bold text-slate-800 block">Allow Authorized Early Overtime</span>
                  <span className="text-[11px] text-slate-500">Work prior to session start counts only with explicit admin approval.</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: SESSION CHECK-OUT RULES */}
      {/* ======================================================== */}
      {(activeSection === "ALL" || activeSection === "CHECKOUT") && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">3. Session Check-out Rules & Departure Restrictions</h2>
                <p className="text-xs text-slate-500">
                  Separately configure departure validation for <b>Morning Session (የጧት መውጫ)</b> and <b>Afternoon Session (የከሰዓት መውጫ)</b>: earliest permitted punch, session end, cutoff boundary, and checkout grace windows.
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg">
              Session-Specific Departures
            </span>
          </div>

          {/* Morning & Afternoon Check-out Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Morning Session Check-out Rules */}
            <div className="p-5 bg-amber-50/30 rounded-2xl border border-amber-200/80 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-amber-200/60">
                <Sunrise className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Morning Session Check-out Rules (የጧት መውጫ ደንቦች)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Morning Normal End */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Scheduled End
                  </label>
                  <input
                    type="time"
                    value={formData.morning_end_time || "12:30"}
                    onChange={(e) => handleChange("morning_end_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-amber-800">{formatToEthiopianTime(formData.morning_end_time || "12:30", "Morning").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Scheduled conclusion of morning shift.</p>
                </div>

                {/* Morning Earliest Allowed Check-out */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Earliest Check-out
                  </label>
                  <input
                    type="time"
                    value={formData.morning_earliest_checkout_time || "11:30"}
                    onChange={(e) => handleChange("morning_earliest_checkout_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-amber-800">{formatToEthiopianTime(formData.morning_earliest_checkout_time || "11:30", "Morning").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Earlier departure requires permission.</p>
                </div>

                {/* Morning Latest Allowed Check-out Cutoff */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Latest Check-out Cutoff
                  </label>
                  <input
                    type="time"
                    value={formData.morning_latest_checkout_time || "13:30"}
                    onChange={(e) => handleChange("morning_latest_checkout_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-amber-800">{formatToEthiopianTime(formData.morning_latest_checkout_time || "13:30", "Morning").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">After this, unclosed morning shift is flagged.</p>
                </div>

                {/* Morning Checkout Grace Window */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Morning Grace Window
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={formData.morning_checkout_grace_minutes ?? 30}
                      onChange={(e) => handleChange("morning_checkout_grace_minutes", parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">mins</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Grace period past morning shift end.</p>
                </div>
              </div>
            </div>

            {/* Afternoon Session Check-out Rules */}
            <div className="p-5 bg-indigo-50/30 rounded-2xl border border-indigo-200/80 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-indigo-200/60">
                <Sunset className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                  Afternoon Session Check-out Rules (የከሰዓት መውጫ ደንቦች)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Afternoon Normal End */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Scheduled End
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_end_time || "17:30"}
                    onChange={(e) => handleChange("afternoon_end_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_end_time || "17:30", "Afternoon").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Scheduled conclusion of daily work.</p>
                </div>

                {/* Afternoon Earliest Allowed Check-out */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Earliest Check-out
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_earliest_checkout_time || "16:30"}
                    onChange={(e) => handleChange("afternoon_earliest_checkout_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_earliest_checkout_time || "16:30", "Afternoon").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">Earlier departure requires permission.</p>
                </div>

                {/* Afternoon Latest Allowed Check-out Cutoff */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Latest Check-out Cutoff
                  </label>
                  <input
                    type="time"
                    value={formData.afternoon_latest_checkout_time || "20:00"}
                    onChange={(e) => handleChange("afternoon_latest_checkout_time", e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_latest_checkout_time || "20:00", "Afternoon").shortText}</b>
                  </span>
                  <p className="text-[10px] text-slate-400">After this, unclosed shift is flagged missing.</p>
                </div>

                {/* Afternoon Checkout Grace Window */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Afternoon Grace Window
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={formData.afternoon_checkout_grace_minutes ?? 30}
                      onChange={(e) => handleChange("afternoon_checkout_grace_minutes", parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 pr-12"
                    />
                    <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">mins</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Grace period past afternoon shift end.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Validation Safeguards */}
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
                <span className="text-[11px] text-slate-500">Employee must have a verified active punch for the session.</span>
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
                  Session-specific overtime rules for <b>Morning (early arrival authorized OT)</b> and <b>Afternoon/Evening (post-shift OT)</b>, minimum qualifying thresholds, and legal wage multipliers.
                </p>
              </div>
            </div>

            {/* Master Overtime Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Master Overtime System:</span>
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

          {/* Morning & Afternoon Session Overtime Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Morning Session Overtime Policy Card */}
            <div className="p-4.5 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sunrise className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                    Morning Session Overtime Policy
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Number(formData.morning_overtime_enabled) === 1}
                    onChange={(e) => handleChange("morning_overtime_enabled", e.target.checked ? 1 : 0)}
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-amber-900">
                    {Number(formData.morning_overtime_enabled) === 1 ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              <p className="text-xs text-amber-900/80 leading-relaxed">
                Controls whether authorized work performed before the morning shift ({formData.morning_start_time}) qualifies for early-arrival overtime. Under company policy, morning overtime requires explicit manager approval before payroll calculation.
              </p>
            </div>

            {/* Afternoon / Evening Session Overtime Policy Card */}
            <div className="p-4.5 bg-indigo-50/40 rounded-xl border border-indigo-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sunset className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    Afternoon Session Overtime Policy
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Number(formData.afternoon_overtime_enabled) === 1}
                    onChange={(e) => handleChange("afternoon_overtime_enabled", e.target.checked ? 1 : 0)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-indigo-900">
                    {Number(formData.afternoon_overtime_enabled) === 1 ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Afternoon Overtime Start Threshold
                </label>
                <input
                  type="time"
                  value={formData.afternoon_overtime_start_time || formData.overtime_start_time || "17:30"}
                  onChange={(e) => {
                    handleChange("afternoon_overtime_start_time", e.target.value);
                    handleChange("overtime_start_time", e.target.value);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                />
                <span className="text-[11px] text-slate-500 block">
                  Ethiopian: <b className="text-indigo-800">{formatToEthiopianTime(formData.afternoon_overtime_start_time || "17:30", "Afternoon").shortText}</b>
                </span>
                <p className="text-[10px] text-slate-400">Work performed after this time is eligible for afternoon overtime.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">mins</span>
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
                <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">hrs</span>
              </div>
              <p className="text-[10px] text-slate-400">Ethiopian Labour Proclamation Art. 67: max 4 hrs/day.</p>
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
                <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-bold">hrs</span>
              </div>
              <p className="text-[10px] text-slate-400">Ethiopian Labour Proclamation Art. 67: max 12 hrs/week.</p>
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
                When enabled, morning and afternoon overtime hours are logged as <b>PENDING</b>. Unapproved overtime is <b>never included in payable payroll</b>. Only explicitly approved overtime integrates into salary calculation.
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
                <span className="text-[10px] text-slate-400 block">Work on national or gazetted holidays</span>
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
      {/* SECTION 5: ACTIVE POLICY SUMMARY (SINGLE SOURCE OF TRUTH) */}
      {/* ======================================================== */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold tracking-tight">Active Policy Summary (Morning & Afternoon Synchronized)</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Synced with Backend Attendance Verification & Payroll
          </span>
        </div>

        {/* Dual Morning & Afternoon Session Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Morning Session Summary */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-amber-500/30 space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sunrise className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  Morning Session (የጧት)
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                Shift: {formData.morning_start_time} – {formData.morning_end_time}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Check-in Window:</span>
                <span className="font-mono font-bold text-white">
                  {formData.morning_earliest_checkin_time} – {formData.morning_latest_checkin_time}
                </span>
                <span className="text-[10px] text-amber-300 block">
                  Grace: {formData.morning_late_grace_minutes}m
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Check-out Window:</span>
                <span className="font-mono font-bold text-white">
                  {formData.morning_earliest_checkout_time} – {formData.morning_latest_checkout_time}
                </span>
                <span className="text-[10px] text-amber-300 block">
                  Grace: {formData.morning_checkout_grace_minutes}m
                </span>
              </div>
            </div>
            <div className="pt-1 text-[10px] text-slate-300 flex items-center justify-between border-t border-slate-700/50">
              <span>Morning Early Overtime:</span>
              <span className={Number(formData.morning_overtime_enabled) === 1 ? "text-emerald-400 font-bold" : "text-slate-400 font-medium"}>
                {Number(formData.morning_overtime_enabled) === 1 ? "Active (Authorized Early)" : "Disabled"}
              </span>
            </div>
          </div>

          {/* Afternoon Session Summary */}
          <div className="bg-slate-800/80 p-4 rounded-xl border border-indigo-500/30 space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sunset className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
                  Afternoon Session (የከሰዓት)
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-400/20 text-indigo-300 font-bold">
                Shift: {formData.afternoon_start_time} – {formData.afternoon_end_time}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Check-in Window:</span>
                <span className="font-mono font-bold text-white">
                  {formData.afternoon_earliest_checkin_time} – {formData.afternoon_latest_checkin_time}
                </span>
                <span className="text-[10px] text-indigo-300 block">
                  Grace: {formData.afternoon_late_grace_minutes}m
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Check-out Window:</span>
                <span className="font-mono font-bold text-white">
                  {formData.afternoon_earliest_checkout_time} – {formData.afternoon_latest_checkout_time}
                </span>
                <span className="text-[10px] text-indigo-300 block">
                  Grace: {formData.afternoon_checkout_grace_minutes}m
                </span>
              </div>
            </div>
            <div className="pt-1 text-[10px] text-slate-300 flex items-center justify-between border-t border-slate-700/50">
              <span>Afternoon Overtime:</span>
              <span className={Number(formData.afternoon_overtime_enabled) === 1 ? "text-emerald-400 font-bold" : "text-slate-400 font-medium"}>
                {Number(formData.afternoon_overtime_enabled) === 1 ? `Active (After ${formData.afternoon_overtime_start_time || formData.overtime_start_time})` : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Global Policy Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Required Daily Work</span>
            <span className="text-sm font-bold text-emerald-300">
              {formData.required_daily_hours || 8.0} Hours
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Weekly Cap: 48.0 Hours
            </span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Overtime Legal Caps</span>
            <span className="text-sm font-bold text-blue-300">
              {formData.max_overtime_daily_hours}h/d · {formData.max_overtime_weekly_hours}h/w
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Min Threshold: {formData.min_overtime_minutes}m
            </span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Overtime Approval</span>
            <span className="text-sm font-bold text-amber-300">
              {Number(formData.require_overtime_approval) === 1 ? "Mandatory Approval" : "Auto-Approved"}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Protects Payroll Budget
            </span>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
            <span className="text-[10px] text-slate-400 block">Rate Multipliers</span>
            <span className="text-sm font-bold text-purple-300">
              {formData.normal_overtime_multiplier}x · {formData.rest_day_overtime_multiplier}x · {formData.holiday_overtime_multiplier}x
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Art. 68 Labour Proclamation
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
          <BookOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>
            <b>Legal & Operational Guarantee:</b> Both Morning and Afternoon sessions are independently validated by the backend. Arriving physically early does not create automatic overtime. Unclosed morning or afternoon shifts strictly produce zero overtime and require administrator review.
          </span>
        </div>
      </div>
    </div>
  );
};
