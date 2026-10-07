import React, { useState, useEffect } from "react";
import { useAppStore } from "../store.js";
import { WorkScheduleDay, Holiday, EffectiveWorkStatus } from "../types.js";
import {
  formatToEthiopianTime,
  formatEthiopianTimeRange,
  gregorianToEthiopianDate,
  ethiopianToGregorianDate,
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_PRESET_SHIFTS,
  ETHIOPIAN_QUICK_TIMES,
  EthiopianPresetShift
} from "../utils/ethiopianTime.js";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Check,
  X,
  RefreshCw,
  Sun,
  Moon,
  CalendarCheck,
  Filter,
  Lock,
  ShieldCheck,
  Globe
} from "lucide-react";

interface WorkCalendarTabProps {
  readOnly?: boolean;
}

export const WorkCalendarTab: React.FC<WorkCalendarTabProps> = ({ readOnly = false }) => {
  const {
    workSchedules,
    holidays,
    fetchWorkCalendar,
    updateWorkCalendar,
    fetchHolidays,
    createHoliday,
    updateHoliday,
    deleteHoliday,
    fetchWorkCalendarStatus
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<"schedule" | "holidays" | "simulator">("schedule");
  const [timeFormatMode, setTimeFormatMode] = useState<"ETHIOPIAN" | "DUAL" | "GREGORIAN">("DUAL");

  // Local state for editing schedules
  const [localSchedules, setLocalSchedules] = useState<WorkScheduleDay[]>([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Holiday modal state
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [hCalendarMode, setHCalendarMode] = useState<"ETHIOPIAN" | "GREGORIAN">("ETHIOPIAN");
  const [hEthYear, setHEthYear] = useState<number>(2019);
  const [hEthMonth, setHEthMonth] = useState<number>(1);
  const [hEthDay, setHEthDay] = useState<number>(1);
  const [hDate, setHDate] = useState("");
  const [hName, setHName] = useState("");
  const [hType, setHType] = useState<"PUBLIC" | "COMPANY" | "SPECIAL">("PUBLIC");
  const [hDuration, setHDuration] = useState<"FULL_DAY" | "MORNING" | "AFTERNOON">("FULL_DAY");
  const [hDesc, setHDesc] = useState("");
  const [hActive, setHActive] = useState(true);
  const [holidaySaving, setHolidaySaving] = useState(false);
  const [holidayFilter, setHolidayFilter] = useState<string>("ALL");
  const [holidaySearch, setHolidaySearch] = useState("");

  // Work status simulator state
  const [simDate, setSimDate] = useState(new Date().toISOString().split("T")[0]);
  const [simTime, setSimTime] = useState("02:00");
  const [simSession, setSimSession] = useState<string>("Morning");
  const [simResult, setSimResult] = useState<EffectiveWorkStatus | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    fetchWorkCalendar();
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (workSchedules && workSchedules.length > 0) {
      setLocalSchedules(workSchedules);
    }
  }, [workSchedules]);

  const handleToggleSessionStatus = async (dayIndex: number, session: "morning" | "afternoon") => {
    let nextStatus = "WORKING";
    const updated = localSchedules.map((item, idx) => {
      if (idx !== dayIndex) return item;
      if (session === "morning") {
        nextStatus = item.morning_status === "WORKING" ? "NON_WORKING" : "WORKING";
        return { ...item, morning_status: nextStatus };
      } else {
        nextStatus = item.afternoon_status === "WORKING" ? "NON_WORKING" : "WORKING";
        return { ...item, afternoon_status: nextStatus };
      }
    });
    setLocalSchedules(updated);

    // Auto-save and trigger real-time website-wide refresh immediately
    setScheduleSaving(true);
    const dayName = localSchedules[dayIndex]?.day_name || "Day";
    const res = await updateWorkCalendar(updated);
    setScheduleSaving(false);
    if (res.success) {
      setScheduleMsg({
        type: "success",
        text: `✓ ${dayName} ${session === "morning" ? "Morning" : "Afternoon"} changed to ${nextStatus === "WORKING" ? "Working" : "Rest / Off"} — website auto-updated live!`
      });
      setTimeout(() => setScheduleMsg(null), 3500);
    } else {
      setScheduleMsg({ type: "error", text: res.error || "Failed to save work schedule." });
    }
  };

  const handleToggleEntireDay = async (dayIndex: number) => {
    const targetDay = localSchedules[dayIndex];
    if (!targetDay) return;
    const isCurrentlyRest = targetDay.morning_status === "NON_WORKING" && targetDay.afternoon_status === "NON_WORKING";
    const nextStatus = isCurrentlyRest ? "WORKING" : "NON_WORKING";

    const updated = localSchedules.map((item, idx) => {
      if (idx !== dayIndex) return item;
      return {
        ...item,
        morning_status: nextStatus,
        afternoon_status: nextStatus
      };
    });
    setLocalSchedules(updated);

    // Auto-save and trigger real-time website-wide refresh immediately
    setScheduleSaving(true);
    const res = await updateWorkCalendar(updated);
    setScheduleSaving(false);
    if (res.success) {
      setScheduleMsg({
        type: "success",
        text: `✓ ${targetDay.day_name} changed to ${nextStatus === "WORKING" ? "Full Working Day" : "Full Rest Day"} — website auto-updated live!`
      });
      setTimeout(() => setScheduleMsg(null), 3500);
    } else {
      setScheduleMsg({ type: "error", text: res.error || "Failed to save work schedule." });
    }
  };

  const handleTimeChange = (
    dayIndex: number,
    field: "morning_start" | "morning_end" | "afternoon_start" | "afternoon_end",
    val: string
  ) => {
    setLocalSchedules((prev) =>
      prev.map((item, idx) => (idx === dayIndex ? { ...item, [field]: val } : item))
    );
  };

  const handleApplyPresetShift = (preset: EthiopianPresetShift) => {
    setLocalSchedules((prev) =>
      prev.map((item) => {
        if (item.day_of_week === 0) return item; // Preserve Sunday rest day
        return {
          ...item,
          morning_start: preset.morning_start,
          morning_end: preset.morning_end,
          afternoon_start: preset.afternoon_start,
          afternoon_end: preset.afternoon_end
        };
      })
    );
    setScheduleMsg({
      type: "success",
      text: `Applied "${preset.nameAm} (${preset.name})": Morning ${preset.morning_ethiopian}, Afternoon ${preset.afternoon_ethiopian}. Click "Save Schedule Changes" to apply.`
    });
  };

  const handleSaveSchedules = async () => {
    setScheduleSaving(true);
    setScheduleMsg(null);
    const res = await updateWorkCalendar(localSchedules);
    setScheduleSaving(false);
    if (res.success) {
      setScheduleMsg({ type: "success", text: "Weekly work calendar schedule saved successfully!" });
      setTimeout(() => setScheduleMsg(null), 4000);
    } else {
      setScheduleMsg({ type: "error", text: res.error || "Failed to save work schedule." });
    }
  };

  const handleEthDateChange = (y: number, m: number, d: number) => {
    setHEthYear(y);
    setHEthMonth(m);
    setHEthDay(d);
    const greg = ethiopianToGregorianDate(y, m, d);
    setHDate(greg);
  };

  const handleGregDateChange = (greg: string) => {
    setHDate(greg);
    const eth = gregorianToEthiopianDate(greg);
    setHEthYear(eth.year);
    setHEthMonth(eth.month);
    setHEthDay(eth.day);
  };

  const openCreateHolidayModal = () => {
    setEditingHoliday(null);
    const ethNow = gregorianToEthiopianDate();
    setHEthYear(ethNow.year);
    setHEthMonth(ethNow.month);
    setHEthDay(ethNow.day);
    setHDate(ethNow.gregorianDate);
    setHName("");
    setHType("PUBLIC");
    setHDuration("FULL_DAY");
    setHDesc("");
    setHActive(true);
    setHCalendarMode("ETHIOPIAN");
    setIsHolidayModalOpen(true);
  };

  const openEditHolidayModal = (h: Holiday) => {
    setEditingHoliday(h);
    const eth = gregorianToEthiopianDate(h.date);
    setHEthYear(eth.year);
    setHEthMonth(eth.month);
    setHEthDay(eth.day);
    setHDate(h.date);
    setHName(h.name);
    setHType(h.type);
    setHDuration(h.duration);
    setHDesc(h.description || "");
    setHActive(h.is_active === 1 || h.is_active === true);
    setHCalendarMode("ETHIOPIAN");
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hDate || !hName) return;

    setHolidaySaving(true);
    if (editingHoliday) {
      const res = await updateHoliday(editingHoliday.id, {
        date: hDate,
        name: hName,
        type: hType,
        duration: hDuration,
        description: hDesc,
        is_active: hActive ? 1 : 0
      });
      setHolidaySaving(false);
      if (res.success) {
        setIsHolidayModalOpen(false);
      }
    } else {
      const res = await createHoliday({
        date: hDate,
        name: hName,
        type: hType,
        duration: hDuration,
        description: hDesc,
        is_active: hActive ? 1 : 0
      });
      setHolidaySaving(false);
      if (res.success) {
        setIsHolidayModalOpen(false);
      }
    }
  };

  const handleDeleteHoliday = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to remove the holiday "${name}"?`)) {
      await deleteHoliday(id);
    }
  };

  const handleRunSimulator = async () => {
    setSimLoading(true);
    const res = await fetchWorkCalendarStatus(simDate, simTime, simSession);
    setSimResult(res);
    setSimLoading(false);
  };

  const filteredHolidays = holidays.filter((h) => {
    if (holidayFilter !== "ALL" && h.type !== holidayFilter) return false;
    if (holidaySearch && !h.name.toLowerCase().includes(holidaySearch.toLowerCase()) && !h.date.includes(holidaySearch)) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <Calendar className="text-blue-600" size={24} />
              Work Calendar & Holiday Schedule
            </h2>
            {readOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1.5 shadow-xs">
                <Lock size={12} className="text-slate-500" /> Read-Only View
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            {readOnly
              ? "Official company weekly working schedule, shift hours, rest days, and holiday calendar"
              : "Configure weekly working days, official holidays, half-day shifts, and overtime triggers"}
          </p>
        </div>

        <div className="flex bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
          <button
            onClick={() => setActiveSubTab("schedule")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === "schedule" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Clock size={14} /> Weekly Schedule
          </button>
          <button
            onClick={() => setActiveSubTab("holidays")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === "holidays" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <CalendarCheck size={14} /> Holidays ({holidays.length})
          </button>
          <button
            onClick={() => setActiveSubTab("simulator")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === "simulator" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Sparkles size={14} /> Status Inspector
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: Weekly 7-Day Work Schedule */}
      {activeSubTab === "schedule" && (
        <div className="space-y-4">
          {/* Current Ethiopian Date & Time Banner */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Globe className="text-amber-300" size={20} />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-200">
                  ዛሬ በኢትዮጵያ ቀን መቁጠሪያ
                </div>
                <div className="text-base font-extrabold text-white flex items-center gap-2 flex-wrap">
                  <span>{gregorianToEthiopianDate().formattedAm}</span>
                   <span className="text-blue-200 text-xs font-medium font-sans">
                     ({gregorianToEthiopianDate().formattedEn})
                   </span>
                  <span className="text-amber-400 text-xs font-bold">
                    • {formatToEthiopianTime(new Date().toTimeString().slice(0, 5)).fullText}
                  </span>
                </div>
              </div>
            </div>

            {/* Time View Switcher */}
            <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setTimeFormatMode("ETHIOPIAN")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  timeFormatMode === "ETHIOPIAN" ? "bg-white text-blue-900 shadow-sm" : "text-blue-100 hover:text-white"
                }`}
              >
                የኢትዮጵያ ሰዓት
              </button>
              <button
                onClick={() => setTimeFormatMode("DUAL")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  timeFormatMode === "DUAL" ? "bg-white text-blue-900 shadow-sm" : "text-blue-100 hover:text-white"
                }`}
              >
                Dual (የኢትዮጵያ + 24H)
              </button>
              <button
                onClick={() => setTimeFormatMode("GREGORIAN")}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                  timeFormatMode === "GREGORIAN" ? "bg-white text-blue-900 shadow-sm" : "text-blue-100 hover:text-white"
                }`}
              >
                Standard 24H
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Weekly Shift & Working Days Schedule</h3>
                <p className="text-xs text-gray-500">
                  {readOnly
                    ? "Official weekly work schedule and session classifications configured in Ethiopian time format. Work performed during Rest / Off sessions qualifies as Overtime."
                    : "Toggle Morning and Afternoon sessions for each day of the week. Times are displayed and validated in Ethiopian business hours (ጧት & ከሰዓት)."}
                </p>
              </div>
              {readOnly ? (
                <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0">
                  <ShieldCheck size={14} className="text-blue-600" />
                  <span>Company Schedule</span>
                </div>
              ) : (
                <button
                  onClick={handleSaveSchedules}
                  disabled={scheduleSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-2 shrink-0 disabled:opacity-60"
                >
                  {scheduleSaving ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                  Save Schedule Changes
                </button>
              )}
            </div>

            {/* Quick Shift Presets Bar for Admins */}
            {!readOnly && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                <div className="text-xs text-slate-700">
                  <span className="font-bold text-blue-900">የፈረቃ ቅድመ-ቅምጦች (Quick Shift Presets): </span>
                   <span className="text-gray-500 text-[11px]">Apply standard Ethiopian work shift templates across weekdays</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ETHIOPIAN_PRESET_SHIFTS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleApplyPresetShift(preset)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg text-[11px] font-bold transition shadow-2xs flex items-center gap-1"
                      title={preset.description}
                    >
                      <Clock size={12} className="text-blue-500" />
                      <span>{preset.nameAm}</span>
                      <span className="text-gray-400 font-normal">({preset.morning_start.slice(0, 5)} - {preset.afternoon_end.slice(0, 5)})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {scheduleMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  scheduleMsg.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border-rose-200 text-rose-800"
                }`}
              >
                {scheduleMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {scheduleMsg.text}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Day of Week</th>
                    <th className="py-3 px-4">Morning Session (የጧት)</th>
                    <th className="py-3 px-4">Morning Hours (የጧት ሰዓት)</th>
                    <th className="py-3 px-4">Afternoon Session (የከሰዓት)</th>
                    <th className="py-3 px-4">Afternoon Hours (የከሰዓት ሰዓት)</th>
                    <th className="py-3 px-4 text-right">Day Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {localSchedules.map((item, idx) => {
                    const isFullyNonWorking =
                      item.morning_status === "NON_WORKING" && item.afternoon_status === "NON_WORKING";
                    const isHalfDay =
                      (item.morning_status === "WORKING" && item.afternoon_status === "NON_WORKING") ||
                      (item.morning_status === "NON_WORKING" && item.afternoon_status === "WORKING");

                    const mStartEth = formatToEthiopianTime(item.morning_start || "02:00", "Morning");
                    const mEndEth = formatToEthiopianTime(item.morning_end || "06:00", "Morning");
                    const aStartEth = formatToEthiopianTime(item.afternoon_start || "07:00", "Afternoon");
                    const aEndEth = formatToEthiopianTime(item.afternoon_end || "11:00", "Afternoon");

                    return (
                      <tr
                        key={item.day_of_week}
                        className={`hover:bg-slate-50/70 transition ${
                          isFullyNonWorking ? "bg-amber-50/30" : isHalfDay ? "bg-blue-50/20" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                isFullyNonWorking ? "bg-amber-500" : isHalfDay ? "bg-sky-500" : "bg-emerald-500"
                              }`}
                            />
                            <span className="text-slate-900 font-extrabold text-xs">{item.day_name}</span>
                            {isFullyNonWorking ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                Rest Day
                              </span>
                            ) : isHalfDay ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold border border-blue-200">
                                Half Day
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                Working Day
                              </span>
                            )}
                          </div>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => handleToggleEntireDay(idx)}
                              disabled={scheduleSaving}
                              className={`mt-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-md border transition inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                                isFullyNonWorking
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                                  : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-300"
                              }`}
                              title={isFullyNonWorking ? "Click to set entire day as Working Day" : "Click to set entire day as Rest Day"}
                            >
                              {isFullyNonWorking ? (
                                <>
                                  <Sun size={11} className="text-emerald-600" />
                                  <span>Set as Working Day</span>
                                </>
                              ) : (
                                <>
                                  <Moon size={11} className="text-amber-600" />
                                  <span>Set as Rest Day</span>
                                </>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Morning Status Toggle */}
                        <td className="py-3.5 px-4">
                          {readOnly ? (
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 select-none ${
                                item.morning_status === "WORKING"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "bg-amber-50 border-amber-200 text-amber-700"
                              }`}
                            >
                              <Sun size={12} />
                              {item.morning_status === "WORKING" ? "Working" : "Rest / Off"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleSessionStatus(idx, "morning")}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
                                item.morning_status === "WORKING"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                              }`}
                            >
                              <Sun size={12} />
                              {item.morning_status === "WORKING" ? "Working" : "Rest / Off"}
                            </button>
                          )}
                        </td>

                        {/* Morning Hours (Ethiopian Time Focused) */}
                        <td className="py-3.5 px-4">
                          {readOnly ? (
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span className="text-blue-700 font-semibold">
                                  {mStartEth.shortText} – {mEndEth.shortText}
                                </span>
                              </div>
                              {(timeFormatMode === "DUAL" || timeFormatMode === "GREGORIAN") && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                  {item.morning_start || "02:00"} - {item.morning_end || "06:00"} (Ethiopian Clock)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={item.morning_start || "02:00"}
                                  onChange={(e) => handleTimeChange(idx, "morning_start", e.target.value)}
                                  disabled={item.morning_status === "NON_WORKING"}
                                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs w-24 disabled:opacity-40 disabled:bg-gray-100"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                  type="time"
                                  value={item.morning_end || "06:00"}
                                  onChange={(e) => handleTimeChange(idx, "morning_end", e.target.value)}
                                  disabled={item.morning_status === "NON_WORKING"}
                                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs w-24 disabled:opacity-40 disabled:bg-gray-100"
                                />
                              </div>
                              <div className="text-[10px] font-bold text-blue-700 mt-1 flex items-center gap-1">
                                <Clock size={11} className="text-blue-500" />
                                <span>
                                  {mStartEth.shortText} – {mEndEth.shortText}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Afternoon Status Toggle */}
                        <td className="py-3.5 px-4">
                          {readOnly ? (
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border inline-flex items-center gap-1.5 select-none ${
                                item.afternoon_status === "WORKING"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "bg-amber-50 border-amber-200 text-amber-700"
                              }`}
                            >
                              <Moon size={12} />
                              {item.afternoon_status === "WORKING" ? "Working" : "Rest / Off"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleSessionStatus(idx, "afternoon")}
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition inline-flex items-center gap-1.5 ${
                                item.afternoon_status === "WORKING"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                  : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                              }`}
                            >
                              <Moon size={12} />
                              {item.afternoon_status === "WORKING" ? "Working" : "Rest / Off"}
                            </button>
                          )}
                        </td>

                        {/* Afternoon Hours (Ethiopian Time Focused) */}
                        <td className="py-3.5 px-4">
                          {readOnly ? (
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                <span className="text-blue-700 font-semibold">
                                  {aStartEth.shortText} – {aEndEth.shortText}
                                </span>
                              </div>
                              {(timeFormatMode === "DUAL" || timeFormatMode === "GREGORIAN") && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                  {item.afternoon_start || "07:00"} - {item.afternoon_end || "11:00"} (Ethiopian Clock)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1">
                                <input
                                  type="time"
                                  value={item.afternoon_start || "07:00"}
                                  onChange={(e) => handleTimeChange(idx, "afternoon_start", e.target.value)}
                                  disabled={item.afternoon_status === "NON_WORKING"}
                                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs w-24 disabled:opacity-40 disabled:bg-gray-100"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                  type="time"
                                  value={item.afternoon_end || "11:00"}
                                  onChange={(e) => handleTimeChange(idx, "afternoon_end", e.target.value)}
                                  disabled={item.afternoon_status === "NON_WORKING"}
                                  className="px-2 py-1 rounded-lg border border-gray-200 text-xs w-24 disabled:opacity-40 disabled:bg-gray-100"
                                />
                              </div>
                              <div className="text-[10px] font-bold text-blue-700 mt-1 flex items-center gap-1">
                                <Clock size={11} className="text-blue-500" />
                                <span>
                                  {aStartEth.shortText} – {aEndEth.shortText}
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Summary Classification Pill */}
                        <td className="py-3.5 px-4 text-right">
                          {isFullyNonWorking ? (
                            <span className="inline-block px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              Full Rest Day (2.0x OT)
                            </span>
                          ) : isHalfDay ? (
                            <span className="inline-block px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                              Half Day (PM is OT)
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              Full Working Day
                            </span>
                          )}
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

      {/* Sub-Tab 2: Holidays Management */}
      {activeSubTab === "holidays" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Official Calendar Holidays</h3>
                <p className="text-xs text-gray-500">
                  {readOnly
                    ? "Official national holidays, religious observances, and company closures. Work performed on holidays qualifies for 2.5x holiday overtime."
                    : "National holidays, religious observances, and company-wide closures. Work performed on holidays qualifies for 2.5x holiday overtime."}
                </p>
              </div>

              {readOnly ? (
                <div className="px-3.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0">
                  <CalendarCheck size={14} className="text-rose-600" />
                  <span>{filteredHolidays.length} Official Holidays</span>
                </div>
              ) : (
                <button
                  onClick={openCreateHolidayModal}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <Plus size={14} />
                  Add New Holiday
                </button>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search holiday by name or YYYY-MM-DD..."
                  value={holidaySearch}
                  onChange={(e) => setHolidaySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
                {["ALL", "PUBLIC", "COMPANY", "SPECIAL"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setHolidayFilter(type)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                      holidayFilter === type ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {type === "ALL" ? "All Types" : type}
                  </button>
                ))}
              </div>
            </div>

            {/* Holiday Cards / Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Date (የቀን መቁጠሪያ)</th>
                    <th className="py-3 px-4">Holiday Name (የበዓል ስም)</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Duration & Shift Hours (የፈረቃ ሰዓት)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">{readOnly ? "Work Rule" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredHolidays.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No holidays found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredHolidays.map((h) => {
                      const ethDate = gregorianToEthiopianDate(h.date);
                      return (
                        <tr key={h.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                              <span className="text-blue-700 font-semibold">{ethDate.formattedAm}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>{ethDate.formattedEn}</span>
                              <span className="text-gray-300">•</span>
                              <span className="text-slate-400">{h.date}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{h.name}</div>
                            {h.description && <div className="text-[11px] text-gray-500 mt-0.5">{h.description}</div>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                h.type === "PUBLIC"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : h.type === "COMPANY"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-purple-50 text-purple-700 border border-purple-200"
                              }`}
                            >
                              {h.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-800 block">
                              {h.duration === "FULL_DAY"
                                ? "Full Day (ሙሉ ቀን)"
                                : h.duration === "MORNING"
                                ? "Morning Half-Day (የጧት)"
                                : "Afternoon Half-Day (የከሰዓት)"}
                            </span>
                            <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1 mt-0.5 font-mono">
                              <Clock size={11} className="text-blue-500" />
                              {h.duration === "FULL_DAY"
                                ? "2:30 ጧት – 11:30 ከሰዓት"
                                : h.duration === "MORNING"
                                ? "2:30 ጧት – 6:30 ከሰዓት"
                                : "7:30 ከሰዓት – 11:30 ከሰዓት"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {h.is_active === 1 || (h as any).is_active === true ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 size={12} /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                Disabled
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {readOnly ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                                2.5x OT If Worked
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditHolidayModal(h)}
                                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="Edit Holiday"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteHoliday(h.id, h.name)}
                                  className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title="Delete Holiday"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Status Inspector & Live Evaluator */}
      {activeSubTab === "simulator" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Effective Work Status Inspector</h3>
              <p className="text-xs text-gray-500">
                Inspect how the server evaluates any combination of date, time, and session against the combined Weekly Work Schedule and Holidays table using Ethiopian time conversion.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Test Date</label>
                <input
                  type="date"
                  value={simDate}
                  onChange={(e) => setSimDate(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                />
                <div className="text-[11px] font-semibold text-blue-700 mt-1">
                  {gregorianToEthiopianDate(simDate).formattedAm}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Test Time</label>
                <input
                  type="time"
                  value={simTime}
                  onChange={(e) => setSimTime(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                />
                <div className="text-[11px] font-bold text-blue-700 mt-1 flex items-center gap-1">
                  <Clock size={11} />
                  <span>{formatToEthiopianTime(simTime).fullText}</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Session</label>
                <select
                  value={simSession}
                  onChange={(e) => setSimSession(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                >
                  <option value="Morning">Morning (የጧት)</option>
                  <option value="Afternoon">Afternoon (የከሰዓት)</option>
                </select>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {[
                    { label: "2:00 ጧት", time: "02:00", s: "Morning" },
                    { label: "6:00 ከሰዓት", time: "06:00", s: "Morning" },
                    { label: "7:00 ከሰዓት", time: "07:00", s: "Afternoon" },
                    { label: "11:00 ከሰዓት", time: "11:00", s: "Afternoon" }
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSimTime(p.time);
                        setSimSession(p.s);
                      }}
                      className="px-1.5 py-0.5 text-[10px] bg-white border border-gray-200 hover:border-blue-400 text-slate-700 font-semibold rounded"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleRunSimulator}
                  disabled={simLoading}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                >
                  {simLoading ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  Inspect Status
                </button>
              </div>
            </div>

            {simResult && (
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Server Evaluation Result:
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      simResult.status === "WORKING"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300"
                    }`}
                  >
                    {simResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Ethiopian Date</span>
                    <span className="font-bold text-blue-800">
                      {simResult.ethiopian_date || gregorianToEthiopianDate(simDate).formattedAm}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Ethiopian Time</span>
                    <span className="font-bold text-blue-800">
                      {simResult.ethiopian_time || formatToEthiopianTime(simTime).shortText}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Day Name</span>
                    <span className="font-bold text-slate-800">{simResult.dayName}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Attendance Type</span>
                    <span className="font-bold text-blue-700">{simResult.attendanceType}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Work Status Reason</span>
                    <span className="font-bold text-slate-800">{simResult.reason}</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Pay Multiplier</span>
                    <span className="font-extrabold text-amber-600">{simResult.overtimeMultiplier}x</span>
                  </div>
                </div>

                {simResult.holidayName && (
                  <div className="text-xs text-rose-700 font-semibold flex items-center gap-1.5">
                    <CalendarCheck size={14} />
                    Holiday matched: <strong>{simResult.holidayName}</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Holiday Creation & Edit Modal */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingHoliday ? "Edit Calendar Holiday" : "Add New Calendar Holiday"}
                </h3>
                <p className="text-[11px] text-gray-500">
                  Configure holiday date in Ethiopian Calendar or Gregorian Calendar
                </p>
              </div>
              <button
                onClick={() => setIsHolidayModalOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-4">
              {/* Calendar Mode Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setHCalendarMode("ETHIOPIAN")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    hCalendarMode === "ETHIOPIAN"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  የኢትዮጵያ ቀን መቁጠሪያ (Ethiopian Calendar)
                </button>
                <button
                  type="button"
                  onClick={() => setHCalendarMode("GREGORIAN")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    hCalendarMode === "GREGORIAN"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Gregorian Calendar
                </button>
              </div>

              {/* Ethiopian Date Fields */}
              {hCalendarMode === "ETHIOPIAN" ? (
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                  <div className="text-[11px] font-bold text-blue-900">የኢትዮጵያ ቀን (Ethiopian Date):</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ወር (Month)</label>
                      <select
                        value={hEthMonth}
                        onChange={(e) => handleEthDateChange(hEthYear, Number(e.target.value), hEthDay)}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-blue-600"
                      >
                        {ETHIOPIAN_MONTHS.map((m) => (
                          <option key={m.index} value={m.index}>
                            {m.amharic} ({m.english})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ቀን (Day 1-30)</label>
                      <input
                        type="number"
                        min={1}
                        max={hEthMonth === 13 ? 6 : 30}
                        value={hEthDay}
                        onChange={(e) => handleEthDateChange(hEthYear, hEthMonth, Number(e.target.value))}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">ዓመተ ምሕረት (Year)</label>
                      <input
                        type="number"
                        min={2010}
                        max={2030}
                        value={hEthYear}
                        onChange={(e) => handleEthDateChange(Number(e.target.value), hEthMonth, hEthDay)}
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-300 bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-blue-800 font-semibold flex items-center justify-between pt-1">
                    <span>
                      {ETHIOPIAN_MONTHS.find((m) => m.index === hEthMonth)?.amharic} {hEthDay}, {hEthYear} ዓ.ም.
                    </span>
                    <span className="text-gray-500 font-mono text-[10px]">
                      Equivalent: {hDate || ethiopianToGregorianDate(hEthYear, hEthMonth, hEthDay)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Holiday Date (YYYY-MM-DD)*</label>
                  <input
                    type="date"
                    required
                    value={hDate}
                    onChange={(e) => handleGregDateChange(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600"
                  />
                  {hDate && (
                    <div className="text-[11px] font-bold text-blue-700">
                      የኢትዮጵያ ቀን: {gregorianToEthiopianDate(hDate).formattedAm} ({gregorianToEthiopianDate(hDate).formattedEn})
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Holiday Name (የበዓሉ ስም)*</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. መስቀል (Meskel), እንቁጣጣሽ (Enkutatash), ገና (Genna)"
                  value={hName}
                  onChange={(e) => setHName(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Holiday Type</label>
                  <select
                    value={hType}
                    onChange={(e) => setHType(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="PUBLIC">PUBLIC (National Holiday)</option>
                    <option value="COMPANY">COMPANY (Corporate Holiday)</option>
                    <option value="SPECIAL">SPECIAL (Observance)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Duration & Shift Hours</label>
                  <select
                    value={hDuration}
                    onChange={(e) => setHDuration(e.target.value as any)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="FULL_DAY">Full Day (2:30 ጧት – 11:30 ከሰዓት)</option>
                    <option value="MORNING">Morning Shift (2:30 ጧት – 6:30 ከሰዓት)</option>
                    <option value="AFTERNOON">Afternoon Shift (7:30 ከሰዓት – 11:30 ከሰዓት)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Official public holiday celebration"
                  value={hDesc}
                  onChange={(e) => setHDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="hActive"
                  checked={hActive}
                  onChange={(e) => setHActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <label htmlFor="hActive" className="text-xs text-slate-700 font-medium">
                  Holiday is Active (Enforces 2.5x Overtime Rate If Worked)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holidaySaving}
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm disabled:opacity-60"
                >
                  {holidaySaving ? "Saving..." : editingHoliday ? "Update Holiday" : "Create Holiday"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
