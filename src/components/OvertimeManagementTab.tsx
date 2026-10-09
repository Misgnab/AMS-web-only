import React, { useState, useEffect } from "react";
import { useAppStore } from "../store.js";
import { OvertimeRecord } from "../types.js";
import { gregorianToEthiopianDate, formatToEthiopianTime } from "../utils/ethiopianTime.js";
import { LatePenaltyManagement } from "./LatePenaltyManagement.js";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Zap,
  Sliders,
  Check,
  X,
  QrCode,
  MapPin,
  Calendar,
  DollarSign,
  Search,
  Filter,
  RefreshCw,
  ChevronRight
} from "lucide-react";

interface OvertimeManagementTabProps {
  initialSection?: "records" | "penalties" | "rates";
  onNavigateToSettings?: () => void;
}

export const OvertimeManagementTab: React.FC<OvertimeManagementTabProps> = ({ 
  initialSection = "records",
  onNavigateToSettings
}) => {
  const {
    overtimeRecords,
    overtimeStats,
    latePenalties,
    penaltyStats,
    siteSettings,
    fetchOvertimeRecords,
    fetchOvertimeStats,
    fetchPenalties,
    approveOvertime,
    rejectOvertime,
    updateOvertimeRates,
    updatePenaltyPolicy
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<"records" | "penalties" | "rates">(initialSection);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchEmployee, setSearchEmployee] = useState<string>("");

  // Rate Multiplier Configuration state
  const [rateNormal, setRateNormal] = useState<string>("1.5");
  const [rateRestDay, setRateRestDay] = useState<string>("2.0");
  const [rateHoliday, setRateHoliday] = useState<string>("2.5");
  const [rateNight, setRateNight] = useState<string>("1.5");
  const [radiusAllowed, setRadiusAllowed] = useState<string>("35");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateMsg, setRateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Late Penalty Policy Configuration state
  const [graceMinutes, setGraceMinutes] = useState<string>("15");
  const [allowedLates, setAllowedLates] = useState<string>("2");
  const [fixedPenalty, setFixedPenalty] = useState<string>("25");
  const [hourlyMultiplier, setHourlyMultiplier] = useState<string>("0.5");

  // Reject modal state
  const [rejectingRecord, setRejectingRecord] = useState<OvertimeRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    fetchOvertimeRecords();
    fetchOvertimeStats();
    fetchPenalties();
  }, []);

  useEffect(() => {
    if (siteSettings) {
      if (siteSettings.normal_overtime_multiplier !== undefined) {
        setRateNormal(siteSettings.normal_overtime_multiplier.toString());
      }
      if (siteSettings.rest_day_overtime_multiplier !== undefined) {
        setRateRestDay(siteSettings.rest_day_overtime_multiplier.toString());
      }
      if (siteSettings.holiday_overtime_multiplier !== undefined) {
        setRateHoliday(siteSettings.holiday_overtime_multiplier.toString());
      }
      if (siteSettings.night_overtime_multiplier !== undefined) {
        setRateNight(siteSettings.night_overtime_multiplier.toString());
      }
      if (siteSettings.allowed_radius !== undefined) {
        setRadiusAllowed(siteSettings.allowed_radius.toString());
      }
      if (siteSettings.late_grace_minutes !== undefined) {
        setGraceMinutes(siteSettings.late_grace_minutes.toString());
      }
      if (siteSettings.allowed_minor_lates !== undefined) {
        setAllowedLates(siteSettings.allowed_minor_lates.toString());
      }
      if (siteSettings.late_penalty_fixed_amount !== undefined) {
        setFixedPenalty(siteSettings.late_penalty_fixed_amount.toString());
      }
      if (siteSettings.late_penalty_hourly_multiplier !== undefined) {
        setHourlyMultiplier(siteSettings.late_penalty_hourly_multiplier.toString());
      }
    }
  }, [siteSettings]);

  const handleSaveRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateSaving(true);
    setRateMsg(null);
    const res = await updateOvertimeRates({
      normal: parseFloat(rateNormal) || 1.5,
      rest_day: parseFloat(rateRestDay) || 2.0,
      holiday: parseFloat(rateHoliday) || 2.5,
      night: parseFloat(rateNight) || 1.5,
      allowed_radius: parseFloat(radiusAllowed) || 35.0
    });
    const resPenalty = await updatePenaltyPolicy({
      late_grace_minutes: parseInt(graceMinutes, 10) || 15,
      allowed_minor_lates: parseInt(allowedLates, 10) || 2,
      late_penalty_fixed_amount: parseFloat(fixedPenalty) || 25,
      late_penalty_hourly_multiplier: parseFloat(hourlyMultiplier) || 0.5,
      punctuality_bonus_amount: 0
    });
    setRateSaving(false);
    if (res.success && resPenalty.success) {
      setRateMsg({ type: "success", text: "Overtime rates and late penalty policies updated successfully!" });
      setTimeout(() => setRateMsg(null), 4000);
    } else {
      setRateMsg({ type: "error", text: res.error || resPenalty.error || "Failed to update settings." });
    }
  };

  const handleApprove = async (id: number) => {
    await approveOvertime(id);
  };

  const openRejectModal = (record: OvertimeRecord) => {
    setRejectingRecord(record);
    setRejectReason("Work outside authorized overtime hours");
  };

  const handleConfirmReject = async () => {
    if (!rejectingRecord) return;
    setRejectLoading(true);
    await rejectOvertime(rejectingRecord.id, rejectReason);
    setRejectLoading(false);
    setRejectingRecord(null);
    setRejectReason("");
  };

  const filteredRecords = overtimeRecords.filter((rec) => {
    if (filterStatus !== "ALL" && rec.status !== filterStatus) return false;
    if (searchEmployee) {
      const q = searchEmployee.toLowerCase();
      const matchName = rec.employee_name && rec.employee_name.toLowerCase().includes(q);
      const matchDate = rec.date.includes(q);
      if (!matchName && !matchDate) return false;
    }
    return true;
  });

  const penalizedCount = penaltyStats?.penalizedCount ?? latePenalties.filter(r => r.penalty_status === "PENALIZED").length;

  return (
    <div className="space-y-6">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
            <Clock className="text-blue-600" size={24} />
            Overtime & Penalty Management
          </h2>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            Review overtime hours, track late arrivals & penalties, pardon justified tardiness, and adjust policy rates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 p-1 rounded-xl shadow-sm">
            <button
              onClick={() => setActiveSection("records")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSection === "records" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Clock size={14} /> Overtime Approvals
              {overtimeStats && overtimeStats.pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {overtimeStats.pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSection("penalties")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSection === "penalties" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <AlertTriangle size={14} className={activeSection === "penalties" ? "text-amber-200" : "text-amber-500"} />
              Late Penalties
              {penalizedCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeSection === "penalties" ? "bg-white text-blue-700" : "bg-rose-500 text-white"
                }`}>
                  {penalizedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSection("rates")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSection === "rates" ? "bg-blue-600 text-white" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Sliders size={14} /> Policies & Rates
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              fetchOvertimeRecords();
              fetchOvertimeStats();
              fetchPenalties();
            }}
            className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-blue-600 rounded-xl shadow-xs transition hover:bg-gray-50 cursor-pointer"
            title="Refresh Overtime & Penalties"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Section Content */}
      {activeSection === "penalties" && (
        <LatePenaltyManagement onOpenPolicyModal={() => setActiveSection("rates")} />
      )}

      {activeSection === "records" && (
        <div className="space-y-6">
          {/* KPI Stats Bar - Clean, Compact 5-Metric Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-white px-3.5 py-3 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Pending Approval</span>
              <span className="text-lg font-bold text-amber-600 font-mono mt-1">
                {overtimeStats?.pendingOvertimeHours || 0} hrs
              </span>
            </div>
            <div className="bg-white px-3.5 py-3 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Approved OT</span>
              <span className="text-lg font-bold text-emerald-600 font-mono mt-1">
                {overtimeStats?.approvedOvertimeHours || 0} hrs
              </span>
            </div>
            <div className="bg-white px-3.5 py-3 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Rest Day (2.0x)</span>
              <span className="text-lg font-bold text-purple-600 font-mono mt-1">
                {overtimeStats?.restDayOvertimeHours || 0} hrs
              </span>
            </div>
            <div className="bg-white px-3.5 py-3 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Holiday (2.5x)</span>
              <span className="text-lg font-bold text-rose-600 font-mono mt-1">
                {overtimeStats?.holidayOvertimeHours || 0} hrs
              </span>
            </div>
            <div className="bg-white px-3.5 py-3 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Est. Payroll Payout</span>
              <span className="text-lg font-bold text-blue-600 font-mono mt-1">
                ETB {overtimeStats?.estimatedPayoutETB ? overtimeStats.estimatedPayoutETB.toLocaleString() : "0"}
              </span>
            </div>
          </div>

          {/* Overtime Records & Approvals Queue */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-gray-100 pb-4">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by employee name or date..."
                  value={searchEmployee}
                  onChange={(e) => setSearchEmployee(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 shrink-0">
                {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-lg transition ${
                      filterStatus === st ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {st === "ALL" ? "All Records" : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Date & Session</th>
                    <th className="py-3 px-4">Hours & Multiplier</th>
                    <th className="py-3 px-4">Classification</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                        No overtime records found for current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{r.employee_name || `Employee #${r.employee_id}`}</div>
                          <div className="text-[11px] text-gray-400">{r.phone_number || r.employee_role}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-xs">
                            {gregorianToEthiopianDate(r.date).formattedAm}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {r.date}
                          </div>
                          <div className="text-[11px] text-blue-700 font-semibold mt-0.5 flex items-center gap-1 font-mono">
                            <Clock size={11} className="text-blue-500" />
                            <span>
                              {formatToEthiopianTime(r.check_in_time).shortText} - {r.check_out_time ? formatToEthiopianTime(r.check_out_time).shortText : "--:--"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-blue-600 font-mono text-sm">{r.hours} hrs</div>
                          <div className="text-[10px] font-semibold text-amber-600">Rate: {r.rate_multiplier}x</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              r.overtime_type === "HOLIDAY_OVERTIME"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : r.overtime_type === "REST_DAY_OVERTIME"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : r.overtime_type === "NIGHT_OVERTIME"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {r.overtime_type.replace(/_/g, " ")}
                          </span>
                          {r.work_status_reason && (
                            <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[140px]">
                              {r.work_status_reason.replace(/_/g, " ")}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`p-1 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                                r.qr_verified
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                              title="QR Code Authenticated"
                            >
                              <QrCode size={11} /> QR
                            </span>
                            <span
                              className={`p-1 rounded-md text-[10px] font-semibold flex items-center gap-1 ${
                                r.gps_verified
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                              title={`GPS Geofenced (${r.gps_distance ? `${r.gps_distance}m` : "Verified"})`}
                            >
                              <MapPin size={11} /> GPS
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              r.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.status === "REJECTED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {r.status}
                          </span>
                          {r.approver_name && (
                            <div className="text-[10px] text-gray-400 mt-0.5">By {r.approver_name}</div>
                          )}
                          {r.rejection_reason && (
                            <div className="text-[10px] text-rose-600 mt-0.5 truncate max-w-[130px]">
                              Reason: {r.rejection_reason}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {r.status === "PENDING" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApprove(r.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => openRejectModal(r)}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] transition"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-medium">Processed</span>
                          )}
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

      {/* Section 2: Overtime Rate Multipliers Configuration */}
      {activeSection === "rates" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-6 max-w-2xl">
          {onNavigateToSettings && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Clock size={14} className="text-blue-600" />
                  Centralized Attendance & Work Schedule Settings
                </span>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Manage normal check-in/out times, grace periods, earliest/latest cutoff thresholds, and daily/weekly overtime limits in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm shrink-0 flex items-center gap-1.5 self-start sm:self-center"
              >
                <span>Full Settings</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-slate-800">Company Overtime Multiplier Policies</h3>
            <p className="text-xs text-gray-500">
              Configure payroll multipliers applied to employee hourly rates based on Labor Proclamation No. 1156/2019.
            </p>
          </div>

          {rateMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                rateMsg.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {rateMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {rateMsg.text}
            </div>
          )}

          <form onSubmit={handleSaveRates} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <label className="text-xs font-bold text-slate-800 block">Normal Working Day Overtime Multiplier</label>
                <span className="text-[10px] text-gray-500 block">For hours worked past regular shift end</span>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rateNormal}
                    onChange={(e) => setRateNormal(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                  />
                  <span className="text-xs font-bold text-slate-600">x Hourly Rate</span>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1">
                <label className="text-xs font-bold text-amber-900 block">Weekly Rest Day (Sunday) Multiplier</label>
                <span className="text-[10px] text-amber-700 block">Standard legal benchmark: 2.0x hourly pay</span>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rateRestDay}
                    onChange={(e) => setRateRestDay(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                  />
                  <span className="text-xs font-bold text-amber-800">x Hourly Rate</span>
                </div>
              </div>

              <div className="p-3.5 bg-rose-50/50 rounded-xl border border-rose-200 space-y-1">
                <label className="text-xs font-bold text-rose-900 block">Public / Calendar Holiday Multiplier</label>
                <span className="text-[10px] text-rose-700 block">Standard legal benchmark: 2.5x hourly pay</span>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rateHoliday}
                    onChange={(e) => setRateHoliday(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                  />
                  <span className="text-xs font-bold text-rose-800">x Hourly Rate</span>
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-1">
                <label className="text-xs font-bold text-indigo-900 block">Night Shift Overtime Multiplier</label>
                <span className="text-[10px] text-indigo-700 block">Hours worked between 22:00 and 06:00</span>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    value={rateNight}
                    onChange={(e) => setRateNight(e.target.value)}
                    className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                  />
                  <span className="text-xs font-bold text-indigo-800">x Hourly Rate</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <label className="text-xs font-bold text-slate-800 block">Maximum Geofence Radius for Overtime (Meters)</label>
              <span className="text-[10px] text-gray-500 block mb-2">Maximum distance permitted from office GPS coordinate</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={radiusAllowed}
                  onChange={(e) => setRadiusAllowed(e.target.value)}
                  className="w-24 px-3 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                />
                <span className="text-xs font-bold text-slate-600">meters (Default 35m)</span>
              </div>
            </div>

            {/* Late Arrival Penalty Rules & Formulas */}
            <div className="pt-4 border-t border-gray-100">
              <div className="mb-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-600" />
                  Late Arrival & Tardiness Penalty Rules
                </h4>
                <p className="text-xs text-gray-500">
                  Configure grace periods, base fines, and per-hour salary deduction rates for delayed check-ins.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-1">
                  <label className="text-xs font-bold text-blue-900 block">Late Arrival Grace Period (Minutes)</label>
                  <span className="text-[10px] text-blue-700 block">
                    Employees checking in within this period after shift start are marked "Present" without salary penalty.
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={graceMinutes}
                      onChange={(e) => setGraceMinutes(e.target.value)}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                    />
                    <span className="text-xs font-bold text-slate-600">Minutes</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <label className="text-xs font-bold text-slate-800 block">Allowed Minor Lates per Month</label>
                  <span className="text-[10px] text-gray-500 block">
                    Number of late check-ins tolerated per month before attendance score penalty applies.
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={allowedLates}
                      onChange={(e) => setAllowedLates(e.target.value)}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                    />
                    <span className="text-xs font-bold text-slate-600">Incidents</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1">
                  <label className="text-xs font-bold text-amber-900 block">Fixed Incident Penalty</label>
                  <span className="text-[10px] text-amber-700 block">Base fine per late punch</span>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-slate-600">ETB</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={fixedPenalty}
                      onChange={(e) => setFixedPenalty(e.target.value)}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-1">
                  <label className="text-xs font-bold text-purple-900 block">Hourly Rate Multiplier</label>
                  <span className="text-[10px] text-purple-700 block">Per late hour deduction</span>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2.0"
                      value={hourlyMultiplier}
                      onChange={(e) => setHourlyMultiplier(e.target.value)}
                      className="w-20 px-2.5 py-1.5 rounded-lg border border-gray-300 font-mono font-bold text-sm bg-white"
                    />
                    <span className="text-xs font-bold text-slate-600">x Hourly Pay</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={rateSaving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-2 disabled:opacity-60"
              >
                {rateSaving ? "Saving All Policies..." : "Save All Policies & Rates"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[calc(100vh-2rem)] flex flex-col p-4 sm:p-5 shadow-2xl space-y-4 border border-gray-100 my-auto overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2.5 shrink-0">
              <h3 className="text-sm font-bold text-slate-800">Reject Overtime Record</h3>
              <button
                type="button"
                onClick={() => setRejectingRecord(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Rejecting overtime for <strong>{rejectingRecord.employee_name}</strong> on{" "}
              <strong>{rejectingRecord.date}</strong> ({rejectingRecord.hours} hrs). Overtime pay will be excluded from
              salary calculations.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1 uppercase tracking-wide">
                Reason for Rejection*
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="State why this overtime is not approved..."
                className="w-full text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setRejectingRecord(null)}
                className="w-full sm:w-auto px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectLoading || !rejectReason.trim()}
                onClick={handleConfirmReject}
                className="w-full sm:w-auto px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition shadow-sm disabled:opacity-50 text-center"
              >
                {rejectLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
