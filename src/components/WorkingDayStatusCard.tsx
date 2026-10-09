import React from "react";
import { 
  Briefcase, 
  Calendar, 
  CalendarX, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Zap, 
  ChevronRight,
  ShieldCheck,
  Sun,
  Moon
} from "lucide-react";
import { EffectiveWorkStatus } from "../types";
import { useAppStore } from "../store";
import { formatToEthiopianTime } from "../utils/ethiopianTime";

interface WorkingDayStatusCardProps {
  status: EffectiveWorkStatus | null;
  currentTime?: Date;
  onNavigateToCalendar?: () => void;
  compact?: boolean;
}

export const WorkingDayStatusCard: React.FC<WorkingDayStatusCardProps> = ({
  status,
  currentTime = new Date(),
  onNavigateToCalendar,
  compact = false
}) => {
  // Determine working day status with rock-solid fallback logic
  const dayOfWeek = currentTime.getDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = dayNames[dayOfWeek];

  const isServerAvailable = Boolean(status);
  const isWorking = isServerAvailable 
    ? (status?.is_working_day ?? status?.status === "WORKING")
    : (dayOfWeek !== 0); // Sunday is weekly rest day by default

  const isHoliday = status?.reason === "PUBLIC_HOLIDAY" || status?.reason === "COMPANY_HOLIDAY" || status?.reason === "SPECIAL_HOLIDAY";
  const holidayName = status?.holiday?.name || status?.holidayName;

  const isRestDay = !isHoliday && (status?.reason === "WEEKLY_OFF" || dayOfWeek === 0);
  const isSaturday = dayOfWeek === 6;

  // Multiplier
  const otMultiplier = status?.overtimeMultiplier || (isHoliday ? 2.5 : isRestDay ? 2.0 : 1.5);

  // Label and description
  let title = isWorking ? "Official Working Day" : "Non-Working Day";
  if (!isWorking) {
    if (isHoliday && holidayName) {
      title = `Non-Working Day (${holidayName})`;
    } else if (isRestDay) {
      title = `Non-Working Day (${status?.dayName || currentDayName} Rest Day)`;
    } else {
      title = `Non-Working Day (${status?.dayName || currentDayName})`;
    }
  } else if (isSaturday) {
    title = `Working Day (${status?.dayName || currentDayName} Morning Shift)`;
  } else {
    title = `Official Working Day (${status?.dayName || currentDayName})`;
  }

  const { siteSettings } = useAppStore();
  const mStartEth = formatToEthiopianTime(siteSettings?.morning_start_time || siteSettings?.work_start_time || "08:30").shortText;
  const mEndEth = formatToEthiopianTime(siteSettings?.morning_end_time || "12:30").shortText;
  const aStartEth = formatToEthiopianTime(siteSettings?.afternoon_start_time || "13:30").shortText;
  const aEndEth = formatToEthiopianTime(siteSettings?.afternoon_end_time || siteSettings?.work_end_time || "17:30").shortText;

  const description = !isWorking
    ? (isHoliday 
        ? `Today is an official holiday: ${holidayName || "Public Holiday"}. Check-ins today are logged as Overtime (${otMultiplier}x rate).`
        : `Scheduled weekly rest day. Any hours worked will be logged as Rest Day Overtime (${otMultiplier}x rate).`)
    : (isSaturday
        ? `Morning session (${mStartEth} - ${mEndEth} Ethiopian Time) is a working shift. Afternoon is scheduled off.`
        : `Standard business working hours apply. Morning: ${mStartEth} – ${mEndEth} | Afternoon: ${aStartEth} – ${aEndEth} (Ethiopian Local Time).`);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs ${
        isWorking
          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
          : "bg-amber-50 text-amber-900 border-amber-200"
      }`}>
        <span className="relative flex h-2 w-2 shrink-0">
          {isWorking ? (
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          )}
        </span>
        <span className="uppercase tracking-wider text-[10px] font-black">
          {isWorking ? "Working Day" : "Non-Working Day"}
        </span>
        <span className="text-slate-400">·</span>
        <span className="text-[11px] font-medium text-slate-700 truncate max-w-[200px]">
          {isWorking ? (isSaturday ? "Saturday Morning" : "Standard Shift") : (isHoliday ? holidayName || "Holiday" : "Weekend Rest Day")}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`rounded-2xl border p-4.5 transition-all duration-200 shadow-xs relative overflow-hidden ${
        isWorking
          ? "bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border-emerald-200/90 text-emerald-950"
          : "bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 border-amber-200/90 text-amber-950"
      }`}
    >
      {/* Background watermark icon */}
      <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
        {isWorking ? <Briefcase size={120} /> : <CalendarX size={120} />}
      </div>

      <div className="relative z-10 space-y-3">
        {/* Top Header Row: Main Working Day Status Badge & Calendar Link */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {/* Status Pill */}
            <span 
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-xs ${
                isWorking
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-600 text-white"
              }`}
            >
              {isWorking ? (
                <>
                  <Briefcase size={13} strokeWidth={2.5} />
                  <span>WORKING DAY</span>
                </>
              ) : (
                <>
                  <CalendarX size={13} strokeWidth={2.5} />
                  <span>NON-WORKING DAY</span>
                </>
              )}
            </span>

            {/* Pulse Indicator */}
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isWorking ? "bg-emerald-400" : "bg-amber-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isWorking ? "bg-emerald-500" : "bg-amber-500"
              }`}></span>
            </span>
          </div>

          {onNavigateToCalendar && (
            <button
              type="button"
              onClick={onNavigateToCalendar}
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer shadow-2xs ${
                isWorking
                  ? "bg-white/90 hover:bg-white text-emerald-800 border-emerald-200"
                  : "bg-white/90 hover:bg-white text-amber-900 border-amber-200"
              }`}
              title="View full Work Calendar and upcoming public holidays"
            >
              <Calendar size={12} />
              <span>Work Calendar</span>
              <ChevronRight size={12} />
            </button>
          )}
        </div>

        {/* Title & Description */}
        <div>
          <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
            {title}
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
            {description}
          </p>
        </div>

        {/* Sessions & Shift Details Grid */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
          {/* Morning Session Info */}
          <div className="p-2 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sun size={13} className="text-amber-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Morning (02:00 - 06:00)</span>
                <span className={`text-[11px] font-bold truncate block ${
                  !isWorking ? "text-amber-700" : "text-emerald-700"
                }`}>
                  {!isWorking ? "Overtime Shift" : "Working Shift"}
                </span>
              </div>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
              !isWorking 
                ? "bg-amber-100 text-amber-800" 
                : "bg-emerald-100 text-emerald-800"
            }`}>
              {!isWorking ? "OT" : "Active"}
            </span>
          </div>

          {/* Afternoon Session Info */}
          <div className="p-2 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Moon size={13} className="text-indigo-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Afternoon (07:00 - 11:00)</span>
                <span className={`text-[11px] font-bold truncate block ${
                  !isWorking || isSaturday ? "text-amber-700" : "text-emerald-700"
                }`}>
                  {!isWorking || isSaturday ? "Overtime / Off" : "Working Shift"}
                </span>
              </div>
            </div>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
              !isWorking || isSaturday 
                ? "bg-amber-100 text-amber-800" 
                : "bg-emerald-100 text-emerald-800"
            }`}>
              {!isWorking || isSaturday ? "OT" : "Active"}
            </span>
          </div>
        </div>

        {/* Extra Overtime or Working Day Perks info */}
        {!isWorking ? (
          <div className="flex items-center gap-2 text-[11px] bg-amber-100/70 text-amber-900 px-3 py-1.5 rounded-xl border border-amber-200 font-medium">
            <Zap size={13} className="text-amber-700 shrink-0" />
            <span>
              Attendance today will automatically earn <strong>{otMultiplier}x Overtime Pay</strong> in this month's payroll.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] bg-emerald-100/60 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-200 font-medium">
            <ShieldCheck size={13} className="text-emerald-700 shrink-0" />
            <span>
              Punctual check-ins maintain an untarnished attendance record and avoid late penalty deductions.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
