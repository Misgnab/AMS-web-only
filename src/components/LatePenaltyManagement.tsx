import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "../store.js";
import { LatePenaltyRecord, LatePenaltyPolicy } from "../types.js";
import {
  gregorianToEthiopianDate,
  formatToEthiopianTime,
  getEthiopianDateString
} from "../utils/ethiopianTime.js";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  UserX,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Sliders,
  PlusCircle,
  RotateCcw,
  RefreshCw,
  QrCode,
  MapPin,
  FileText,
  TrendingDown,
  Award,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUp,
  ChevronsDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Move,
  Maximize2,
  Minimize2,
  Navigation,
  Compass,
  X,
  Calendar,
  Calculator,
  HelpCircle,
  Check,
  Settings,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Sparkles,
  Percent
} from "lucide-react";

interface LatePenaltyManagementProps {
  onOpenPolicyModal?: () => void;
  initialView?: "records" | "policy";
}

export const LatePenaltyManagement: React.FC<LatePenaltyManagementProps> = ({
  onOpenPolicyModal,
  initialView = "records"
}) => {
  const {
    user,
    employees,
    latePenalties,
    penaltyStats,
    penaltyPolicy,
    penaltiesLoading,
    fetchPenalties,
    waivePenalty,
    reinstatePenalty,
    updatePenaltyPolicy,
    addManualPenalty,
    updatePenaltyStatus,
    updatePenaltyNotification
  } = useAppStore();

  const isManager = ["AdminCreator", "AdminManager", "SuperAdmin", "HR", "Bootstrap"].includes(user?.role || "");

  // Active top-level view: "records" or "policy"
  const [activeView, setActiveView] = useState<"records" | "policy">(initialView);

  // View mode for records: "table" or "cards"
  const [recordViewMode, setRecordViewMode] = useState<"table" | "cards">("table");

  // Filtering states
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sessionFilter, setSessionFilter] = useState<string>("ALL");
  const [timeFilter, setTimeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);

  // Notification Toast State
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Waive Modal State
  const [waiveRecord, setWaiveRecord] = useState<LatePenaltyRecord | null>(null);
  const [waiveReason, setWaiveReason] = useState<string>("");
  const [waiveLoading, setWaiveLoading] = useState<boolean>(false);

  // Manual Penalty Modal State
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualUserId, setManualUserId] = useState<number | "">("");
  const [manualDate, setManualDate] = useState<string>(getEthiopianDateString());
  const [manualSession, setManualSession] = useState<"Morning" | "Afternoon">("Morning");
  const [manualCheckIn, setManualCheckIn] = useState<string>("02:35:00");
  const [manualLateMinutes, setManualLateMinutes] = useState<number>(35);
  const [manualPenaltyAmount, setManualPenaltyAmount] = useState<number>(35);
  const [manualReason, setManualReason] = useState<string>("");
  const [manualLoading, setManualLoading] = useState<boolean>(false);

  // Policy Settings State
  const [showPolicyModal, setShowPolicyModal] = useState<boolean>(false);
  const [graceMinutes, setGraceMinutes] = useState<string>("15");
  const [allowedLates, setAllowedLates] = useState<string>("2");
  const [fixedPenalty, setFixedPenalty] = useState<string>("25");
  const [hourlyMultiplier, setHourlyMultiplier] = useState<string>("0.5");
  const [policySaving, setPolicySaving] = useState<boolean>(false);

  // Interactive Live Policy Simulator State
  const [simDelayMinutes, setSimDelayMinutes] = useState<number>(35);
  const [simHourlyRate, setSimHourlyRate] = useState<number>(50);

  // Detail Modal State
  const [detailRecord, setDetailRecord] = useState<LatePenaltyRecord | null>(null);

  useEffect(() => {
    fetchPenalties();
  }, []);

  useEffect(() => {
    if (penaltyPolicy) {
      setGraceMinutes(penaltyPolicy.late_grace_minutes?.toString() || "15");
      setAllowedLates(penaltyPolicy.allowed_minor_lates?.toString() || "2");
      setFixedPenalty(penaltyPolicy.late_penalty_fixed_amount?.toString() || "25");
      setHourlyMultiplier(penaltyPolicy.late_penalty_hourly_multiplier?.toString() || "0.5");
    }
  }, [penaltyPolicy]);

  // Recalculate manual penalty when employee or minutes change
  useEffect(() => {
    if (manualUserId && manualLateMinutes) {
      const emp = employees.find((e) => e.id === Number(manualUserId));
      const hrRate = emp?.hourly_rate || 45;
      const fixed = parseFloat(fixedPenalty) || 25;
      const mult = parseFloat(hourlyMultiplier) || 0.5;
      const calculated = Math.round((fixed + (manualLateMinutes / 60) * hrRate * mult) * 100) / 100;
      setManualPenaltyAmount(calculated);
    }
  }, [manualUserId, manualLateMinutes, fixedPenalty, hourlyMultiplier, employees]);

  const showNotification = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4500);
  };

  // Auto calculate late minutes when check-in time changes in manual modal
  const handleManualCheckInChange = (val: string) => {
    setManualCheckIn(val);
    const scheduledStart = manualSession === "Morning" ? "02:00:00" : "07:00:00";
    let [chH, chM] = val.split(":").map(Number);
    const [stH, stM] = scheduledStart.split(":").map(Number);
    if (!isNaN(chH) && !isNaN(chM)) {
      // Normalize if entered in 24h Gregorian time:
      if (manualSession === "Morning" && chH >= 7 && chH <= 12) {
        chH = chH - 6; // e.g. 08:35 AM -> 02:35 ጧት
      } else if (manualSession === "Afternoon" && chH >= 12 && chH <= 18) {
        chH = chH - 6; // e.g. 13:35 -> 07:35 ከሰዓት
      } else if (manualSession === "Afternoon" && chH >= 1 && chH <= 5) {
        chH = chH + 6; // e.g. 1:35 PM -> 07:35 ከሰዓት
      }
      const checkInTotal = chH * 60 + chM;
      const startTotal = stH * 60 + stM;
      if (checkInTotal > startTotal) {
        setManualLateMinutes(checkInTotal - startTotal);
      } else {
        setManualLateMinutes(0);
      }
    }
  };

  const handleManualSessionChange = (session: "Morning" | "Afternoon") => {
    setManualSession(session);
    const defaultTime = session === "Morning" ? "02:35:00" : "07:35:00";
    setManualCheckIn(defaultTime);
    setManualLateMinutes(35);
  };

  // Open Waive Modal
  const openWaiveModal = (rec: LatePenaltyRecord) => {
    setWaiveRecord(rec);
    setWaiveReason("Verified public transport / commuting delay");
  };

  // Confirm Waive
  const handleConfirmWaive = async () => {
    if (!waiveRecord) return;
    if (!waiveReason.trim()) {
      showNotification("error", "Please provide a valid reason or justification for pardoning this penalty.");
      return;
    }
    setWaiveLoading(true);
    const res = await waivePenalty(waiveRecord.id, waiveReason.trim());
    setWaiveLoading(false);
    if (res.success) {
      showNotification("success", `Penalty for ${waiveRecord.employee_name} on ${waiveRecord.date} has been waived.`);
      setWaiveRecord(null);
      setWaiveReason("");
    } else {
      showNotification("error", res.error || "Failed to waive penalty.");
    }
  };

  // Reinstate Penalty
  const handleReinstate = async (rec: LatePenaltyRecord) => {
    if (!window.confirm(`Are you sure you want to reinstate the late penalty of ETB ${rec.penalty_amount} for ${rec.employee_name}?`)) {
      return;
    }
    const res = await reinstatePenalty(rec.id);
    if (res.success) {
      showNotification("success", `Penalty for ${rec.employee_name} has been reinstated.`);
    } else {
      showNotification("error", res.error || "Failed to reinstate penalty.");
    }
  };

  // Submit Manual Penalty
  const handleSubmitManualPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserId) {
      showNotification("error", "Please select an employee.");
      return;
    }
    setManualLoading(true);
    const res = await addManualPenalty({
      user_id: Number(manualUserId),
      date: manualDate,
      session: manualSession,
      check_in_time: manualCheckIn,
      late_minutes: Number(manualLateMinutes),
      penalty_amount: Number(manualPenaltyAmount),
      reason: manualReason.trim() || "Manual late arrival penalty recorded by HR/Admin"
    });
    setManualLoading(false);
    if (res.success) {
      showNotification("success", "Manual late penalty registered successfully!");
      setShowManualModal(false);
      setManualReason("");
    } else {
      showNotification("error", res.error || "Failed to record manual penalty.");
    }
  };

  // Save Policy Settings
  const handleSavePolicy = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPolicySaving(true);
    const res = await updatePenaltyPolicy({
      late_grace_minutes: parseInt(graceMinutes, 10) || 15,
      allowed_minor_lates: parseInt(allowedLates, 10) || 2,
      late_penalty_fixed_amount: parseFloat(fixedPenalty) || 25,
      late_penalty_hourly_multiplier: parseFloat(hourlyMultiplier) || 0.5,
      punctuality_bonus_amount: 0
    });
    setPolicySaving(false);
    if (res.success) {
      showNotification("success", "Penalty policy rules updated successfully in system database!");
      setShowPolicyModal(false);
    } else {
      showNotification("error", res.error || "Failed to update penalty policy.");
    }
  };

  const handleResetPolicyDefaults = () => {
    setGraceMinutes("15");
    setAllowedLates("2");
    setFixedPenalty("25");
    setHourlyMultiplier("0.5");
  };

  // Filtered late penalties
  const filteredRecords = useMemo(() => {
    return latePenalties.filter((r) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "PAID") {
          const isPaid = r.penalty_status === "PAID" || Boolean(r.paid_at) || Boolean(r.payroll_id);
          if (!isPaid) return false;
        } else if (statusFilter === "PENDING") {
          const isSettled = r.penalty_status === "PAID" || r.penalty_status === "PENALIZED" || r.penalty_status === "WAIVED" || r.penalty_status === "CANCELLED" || r.penalty_status === "WITHIN_GRACE" || Boolean(r.paid_at) || Boolean(r.payroll_id);
          if (r.penalty_status !== "PENDING" && isSettled) return false;
        } else if (r.penalty_status !== statusFilter) {
          return false;
        }
      }
      if (sessionFilter !== "ALL" && r.session !== sessionFilter) return false;

      if (timeFilter === "TODAY") {
        const todayStr = getEthiopianDateString();
        const rEthDate = getEthiopianDateString(r.date);
        if (r.date !== todayStr && rEthDate !== todayStr) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const ethDate = gregorianToEthiopianDate(r.date);
        const matchName = r.employee_name && r.employee_name.toLowerCase().includes(q);
        const matchPhone = r.phone_number && r.phone_number.includes(q);
        const matchRole = r.employee_role && r.employee_role.toLowerCase().includes(q);
        const matchDate = (r.date && r.date.includes(q)) ||
                          (ethDate.formattedAm && ethDate.formattedAm.toLowerCase().includes(q)) ||
                          (ethDate.formattedEn && ethDate.formattedEn.toLowerCase().includes(q)) ||
                          (ethDate.gregorianDate && ethDate.gregorianDate.includes(q));
        if (!matchName && !matchPhone && !matchRole && !matchDate) return false;
      }
      return true;
    });
  }, [latePenalties, statusFilter, sessionFilter, timeFilter, searchQuery]);

  // Employee Leaderboard & Summary
  const employeeLeaderboard = useMemo(() => {
    const map = new Map<number, {
      userId: number;
      name: string;
      role?: string;
      phone?: string;
      photo?: string;
      lateCount: number;
      penalizedCount: number;
      waivedCount: number;
      totalLateMinutes: number;
      totalPenalty: number;
    }>();

    latePenalties.forEach((r) => {
      const curr = map.get(r.user_id) || {
        userId: r.user_id,
        name: r.employee_name,
        role: r.employee_role,
        phone: r.phone_number,
        photo: r.photo,
        lateCount: 0,
        penalizedCount: 0,
        waivedCount: 0,
        totalLateMinutes: 0,
        totalPenalty: 0
      };
      curr.lateCount += 1;
      if (r.penalty_status === "PENALIZED") {
        curr.penalizedCount += 1;
        curr.totalPenalty += r.penalty_amount || 0;
      } else if (r.penalty_status === "WAIVED") {
        curr.waivedCount += 1;
      }
      curr.totalLateMinutes += r.late_minutes || 0;
      map.set(r.user_id, curr);
    });

    return Array.from(map.values()).sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);
  }, [latePenalties]);

  // Table Scroll Management
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
  const [canScrollRight, setCanScrollRight] = useState<boolean>(false);
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [showDpad, setShowDpad] = useState<boolean>(false);
  const [tableHeightPreset, setTableHeightPreset] = useState<"compact" | "default" | "expanded">("default");

  const updateScrollStatus = () => {
    const el = tableScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollTop, scrollWidth, clientWidth, scrollHeight, clientHeight } = el;
    const maxLeft = Math.max(0, scrollWidth - clientWidth);
    const maxTop = Math.max(0, scrollHeight - clientHeight);
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft < maxLeft - 6);
    setCanScrollUp(scrollTop > 6);
    setCanScrollDown(scrollTop < maxTop - 6);
  };

  useEffect(() => {
    updateScrollStatus();
    const handleResize = () => updateScrollStatus();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [filteredRecords, tableHeightPreset, recordViewMode, activeView]);

  const handleScrollBy = (direction: "up" | "down" | "left" | "right", step = 250) => {
    const el = tableScrollRef.current;
    if (!el) return;
    let top = 0;
    let left = 0;
    if (direction === "up") top = -step;
    if (direction === "down") top = step;
    if (direction === "left") left = -step;
    if (direction === "right") left = step;
    el.scrollBy({ top, left, behavior: "smooth" });
    setTimeout(updateScrollStatus, 250);
  };

  const handleScrollToEdge = (edge: "top" | "bottom" | "left" | "right") => {
    const el = tableScrollRef.current;
    if (!el) return;
    if (edge === "top") el.scrollTo({ top: 0, behavior: "smooth" });
    if (edge === "bottom") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    if (edge === "left") el.scrollTo({ left: 0, behavior: "smooth" });
    if (edge === "right") el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    setTimeout(updateScrollStatus, 250);
  };

  const handleResetScroll = () => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    setTimeout(updateScrollStatus, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      handleScrollBy("up", 120);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      handleScrollBy("down", 120);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      handleScrollBy("left", 150);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleScrollBy("right", 150);
    }
  };

  // Calculation for live simulation
  const simCalculation = useMemo(() => {
    const grace = parseInt(graceMinutes, 10) || 15;
    const fixed = parseFloat(fixedPenalty) || 25;
    const mult = parseFloat(hourlyMultiplier) || 0.5;
    const wage = simHourlyRate || 50;
    const isWithinGrace = simDelayMinutes <= grace;

    if (isWithinGrace) {
      return {
        isWithinGrace: true,
        delayMinutes: simDelayMinutes,
        graceMinutes: grace,
        fixedPenalty: 0,
        hourlyDeduction: 0,
        totalPenalty: 0,
        status: "PRESENT (EXCUSED)"
      };
    }

    const hourlyDeduction = Math.round(((simDelayMinutes / 60) * wage * mult) * 100) / 100;
    const totalPenalty = Math.round((fixed + hourlyDeduction) * 100) / 100;

    return {
      isWithinGrace: false,
      delayMinutes: simDelayMinutes,
      graceMinutes: grace,
      fixedPenalty: fixed,
      hourlyDeduction,
      totalPenalty,
      status: "PENALIZED"
    };
  }, [simDelayMinutes, simHourlyRate, graceMinutes, fixedPenalty, hourlyMultiplier]);

  const quickWaiveReasons = [
    "Verified public transport / commuting delay",
    "Official off-site field mission duty",
    "Approved family / personal emergency",
    "Office QR terminal network / device congestion",
    "Management authorized exemption"
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Toast Notification */}
      {actionMessage && (
        <div
          role="status"
          className={`p-3 sm:p-4 rounded-xl border text-xs font-semibold flex items-center justify-between transition shadow-sm ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Primary Top View Navigation Bar (Responsive Tabs) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveView("records")}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeView === "records"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock size={15} className="text-amber-600" />
            <span>Late Incident Records</span>
            {latePenalties.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded-md font-mono">
                {latePenalties.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (onOpenPolicyModal) {
                onOpenPolicyModal();
              }
              setActiveView("policy");
            }}
            className={`flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeView === "policy"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sliders size={15} className="text-blue-600" />
            <span>Penalty Policy & Rules</span>
            <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-md font-mono">
              {graceMinutes}m Grace
            </span>
          </button>
        </div>

        {/* Action Quick Links */}
        <div className="flex items-center justify-end gap-2">
          {activeView === "records" && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setRecordViewMode("table")}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  recordViewMode === "table" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Desktop Table View"
              >
                <List size={14} />
                <span className="hidden md:inline text-[11px]">Table</span>
              </button>
              <button
                type="button"
                onClick={() => setRecordViewMode("cards")}
                className={`p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  recordViewMode === "cards" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
                title="Mobile Cards View"
              >
                <LayoutGrid size={14} />
                <span className="hidden md:inline text-[11px]">Cards</span>
              </button>
            </div>
          )}

          {isManager && activeView === "records" && (
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <PlusCircle size={14} />
              <span className="whitespace-nowrap">Manual Entry</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchPenalties()}
            disabled={penaltiesLoading}
            className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition"
            title="Refresh Records"
          >
            <RefreshCw size={14} className={penaltiesLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PENALTY RECORDS & INCIDENT LOGS                                   */}
      {/* ========================================================================= */}
      {activeView === "records" && (
        <div className="space-y-4 sm:space-y-6">
          {/* KPI Stats Bar - Responsive 6-Metric Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* Total Late Incidents */}
            <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Late</span>
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {penaltyStats?.totalLateCount ?? latePenalties.length}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Shift tardiness logs</span>
              </div>
            </div>

            {/* Active Penalties */}
            <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 uppercase tracking-wider">Penalized</span>
                <ShieldAlert size={15} className="text-rose-500 shrink-0" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-rose-600 font-mono">
                  {penaltyStats?.penalizedCount ?? latePenalties.filter((r) => r.penalty_status === "PENALIZED").length}
                </span>
                <span className="text-[10px] text-rose-600/70 block mt-0.5 truncate">Active deductions</span>
              </div>
            </div>

            {/* Total Deductions (ETB) */}
            <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-700 uppercase tracking-wider">Deductions</span>
                <DollarSign size={15} className="text-amber-600 shrink-0" />
              </div>
              <div className="mt-2">
                <span className="text-lg sm:text-xl font-black text-amber-700 font-mono truncate block">
                  ETB {penaltyStats?.totalPenaltyAmount ? penaltyStats.totalPenaltyAmount.toLocaleString() : "0"}
                </span>
                <span className="text-[10px] text-amber-600/80 block mt-0.5 truncate">Total fines</span>
              </div>
            </div>

            {/* Waived / Pardoned */}
            <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Waived</span>
                <ShieldCheck size={15} className="text-emerald-600 shrink-0" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-emerald-600 font-mono">
                  {penaltyStats?.waivedCount ?? latePenalties.filter((r) => r.penalty_status === "WAIVED").length}
                </span>
                <span className="text-[10px] text-emerald-600/70 block mt-0.5 truncate">Pardoned exceptions</span>
              </div>
            </div>

            {/* Average Delay Minutes */}
            <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Delay</span>
                <Clock size={15} className="text-blue-500 shrink-0" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                  {penaltyStats?.avgLateMinutes ?? 0}m
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">Average duration</span>
              </div>
            </div>

            {/* Punctuality Rate */}
            <div className="bg-white p-3 sm:p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Punctuality</span>
                <Award size={15} className="text-indigo-600 shrink-0" />
              </div>
              <div className="mt-2">
                <span className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">
                  {penaltyStats?.punctualityRate ? `${penaltyStats.punctualityRate}%` : "95.4%"}
                </span>
                <span className="text-[10px] text-indigo-600/70 block mt-0.5 truncate">On-time arrival</span>
              </div>
            </div>
          </div>

          {/* Main Content Container */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 shadow-xs space-y-4">
            {/* Search, Filter & Actions Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between border-b border-gray-100 pb-4">
              {/* Search Box */}
              <div className="relative flex-1 w-full md:max-w-xs lg:max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employee, phone, date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView("policy")}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Sliders size={14} />
                  <span>Penalty Rules</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                    showLeaderboard
                      ? "bg-amber-50 border-amber-300 text-amber-800"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <TrendingDown size={14} />
                  <span>{showLeaderboard ? "Hide Ranking" : "Lateness Ranking"}</span>
                </button>
              </div>
            </div>

            {/* Filter Controls Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              {/* Status Segmented Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar max-w-full">
                {[
                  { key: "ALL", label: "All Incidents" },
                  { key: "PENDING", label: "Pending" },
                  { key: "PENALIZED", label: "Penalized" },
                  { key: "PAID", label: "Paid" },
                  { key: "WAIVED", label: "Waived" },
                  { key: "CANCELLED", label: "Cancelled" },
                  { key: "WITHIN_GRACE", label: "Within Grace" }
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setStatusFilter(st.key)}
                    className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition whitespace-nowrap ${
                      statusFilter === st.key ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Session and Date Range Dropdowns */}
              <div className="flex items-center gap-2">
                <select
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Sessions</option>
                  <option value="Morning">Morning Shift (02:00 - 06:00)</option>
                  <option value="Afternoon">Afternoon Shift (07:00 - 11:00)</option>
                </select>

                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="ALL">All Time</option>
                  <option value="TODAY">Today Only</option>
                </select>
              </div>
            </div>

            {/* Collapsible Employee Leaderboard */}
            {showLeaderboard && (
              <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingDown size={14} className="text-amber-600" />
                    Employee Lateness & Deduction Summary
                  </h4>
                  <span className="text-[11px] text-gray-500">Sorted by total late minutes</span>
                </div>

                {employeeLeaderboard.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No late arrival history recorded.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {employeeLeaderboard.slice(0, 6).map((emp, index) => (
                      <div
                        key={emp.userId}
                        className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              index === 0
                                ? "bg-rose-100 text-rose-700 font-mono"
                                : index === 1
                                ? "bg-amber-100 text-amber-700 font-mono"
                                : "bg-slate-100 text-slate-700 font-mono"
                            }`}
                          >
                            #{index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{emp.name}</div>
                            <div className="text-[10px] text-gray-400 truncate">{emp.role || emp.phone}</div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-black text-rose-600 text-xs font-mono">
                            {emp.totalLateMinutes} mins
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium">
                            {emp.lateCount} lates · ETB {emp.totalPenalty}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* RECORD VIEW: CARDS MODE (MOBILE FRIENDLY / RESPONSIVE)    */}
            {/* ========================================================= */}
            {recordViewMode === "cards" ? (
              <div className="space-y-3">
                {penaltiesLoading && latePenalties.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-medium bg-slate-50 rounded-xl">
                    <RefreshCw size={20} className="animate-spin mx-auto text-blue-600 mb-2" />
                    Loading penalty and lateness records...
                  </div>
                ) : filteredRecords.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-medium bg-slate-50 rounded-xl">
                    <ShieldCheck size={28} className="mx-auto text-emerald-500 mb-2 opacity-70" />
                    No late arrival penalties found for current filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredRecords.map((r) => {
                      const ethDate = gregorianToEthiopianDate(r.date);
                      const isWaived = r.penalty_status === "WAIVED";
                      const isGrace = r.penalty_status === "WITHIN_GRACE";
                      const isPaid = Boolean(r.paid_at || r.payroll_id || r.penalty_status === "PAID");
                      const isPenalized = r.penalty_status === "PENALIZED";
                      const isNotificationChecked = r.notification_status === "ACTIVE" && !isPenalized && !isPaid;

                      return (
                        <div
                          key={r.id}
                          className="p-3.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition shadow-xs space-y-3 flex flex-col justify-between"
                        >
                          {/* Header: Employee & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300/60 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                                {r.photo ? (
                                  <img src={r.photo} alt={r.employee_name} className="w-full h-full object-cover" />
                                ) : (
                                  r.employee_name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-bold text-slate-900 text-xs truncate">{r.employee_name}</h5>
                                <div className="text-[10px] text-slate-400 truncate">
                                  <span>{r.employee_role || "Staff"}</span>
                                  {r.phone_number && <span> · {r.phone_number}</span>}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 inline-flex items-center gap-1 ${
                                isPenalized
                                  ? "bg-rose-100 text-rose-800 border border-rose-300"
                                  : isPaid
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : r.penalty_status === "PENDING"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : r.penalty_status === "CANCELLED"
                                  ? "bg-slate-100 text-slate-700 border border-slate-300"
                                  : isWaived
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}
                            >
                              {isPenalized ? "PENALIZED" : isPaid ? "PAID" : r.penalty_status || "PENDING"}
                            </span>
                          </div>

                          {/* Date, Session, Shift Timings */}
                          <div className="p-2 bg-slate-50 rounded-lg text-xs space-y-1.5 border border-slate-100">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium">Session & Date:</span>
                              <span className="font-bold text-slate-800">
                                {r.session} · {ethDate.formattedAm}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-slate-500">Scheduled:</span>
                              <span className="text-slate-700">
                                {r.scheduled_start_time
                                  ? formatToEthiopianTime(r.scheduled_start_time, r.session).dualText
                                  : (r.session === "Morning" ? "02:00 ጠዋት" : "07:00 ከሰዓት")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] font-mono">
                              <span className="text-rose-600 font-bold">Punch-in:</span>
                              <span className="font-bold text-rose-600 flex items-center gap-1">
                                <Clock size={11} />
                                {r.check_in_time ? formatToEthiopianTime(r.check_in_time, r.session).dualText : "--:--"}
                              </span>
                            </div>
                          </div>

                          {/* Late Delay & Deduction Metrics */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div>
                              <div className="text-[10px] text-slate-400 font-medium">Late Duration</div>
                              <div className="font-mono font-black text-sm text-rose-600">
                                {r.late_minutes} mins
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-400 font-medium">Deduction</div>
                              <div
                                className={`font-mono font-black text-sm ${
                                  isWaived ? "text-gray-400 line-through" : isGrace ? "text-slate-500" : "text-rose-600"
                                }`}
                              >
                                ETB {r.penalty_amount.toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Payment Status & Notification Controls (Card View) */}
                          <div className="p-2 bg-slate-50/80 rounded-lg border border-slate-200/80 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-slate-500 font-semibold">Payment Status:</span>
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={11} /> Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  <Clock size={11} /> Unpaid
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                              <span className="text-[11px] text-slate-500 font-semibold">Notification:</span>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isNotificationChecked}
                                  onChange={async (e) => {
                                    const nextStatus = e.target.checked ? "ACTIVE" : "UNCHECKED";
                                    const res = await updatePenaltyNotification(r.id, nextStatus);
                                    if (res.success) {
                                      showNotification("success", `Notification ${nextStatus === "ACTIVE" ? "enabled" : "unchecked"} for ${r.employee_name}`);
                                    } else {
                                      showNotification("error", res.error || "Failed to update notification");
                                    }
                                  }}
                                  className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  title={
                                    isPenalized || isPaid
                                      ? "Notification automatically unchecked because penalty is already processed / penalized"
                                      : isNotificationChecked
                                      ? "Active reminder notification (click to uncheck)"
                                      : "Notification unchecked (click to activate)"
                                  }
                                />
                                <span className="text-[10px] text-slate-600 font-bold">
                                  {isNotificationChecked ? "Active" : "Unchecked"}
                                </span>
                              </label>
                            </div>

                            {isManager && !isWaived && (
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="text-[11px] text-slate-500 font-semibold">Set Status:</span>
                                <select
                                  value={r.penalty_status || "PENDING"}
                                  onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    const res = await updatePenaltyStatus(r.id, newStatus);
                                    if (res.success) {
                                      showNotification("success", `Status updated to ${newStatus}. Notification automatically updated.`);
                                    } else {
                                      showNotification("error", res.error || "Failed to update penalty status");
                                    }
                                  }}
                                  className="text-[10px] py-0.5 px-2 rounded border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none cursor-pointer"
                                >
                                  <option value="PENDING">Pending</option>
                                  <option value="PENALIZED">Penalized</option>
                                  <option value="PAID">Paid</option>
                                  <option value="CANCELLED">Cancelled</option>
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setDetailRecord(r)}
                              className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg font-bold transition flex items-center gap-1"
                            >
                              <FileText size={13} />
                              <span>Details</span>
                            </button>

                            {isManager && (
                              <div className="flex items-center gap-1.5">
                                {!isWaived ? (
                                  <button
                                    type="button"
                                    onClick={() => openWaiveModal(r)}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                  >
                                    <ShieldCheck size={13} />
                                    <span>Pardon</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleReinstate(r)}
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                  >
                                    <RotateCcw size={13} />
                                    <span>Reinstate</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ========================================================= */
              /* RECORD VIEW: DESKTOP DATA TABLE MODE                       */
              /* ========================================================= */
              <div className="space-y-3">
                {/* Scroll controls toolbar */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Move size={12} className="text-blue-600" />
                      Table Scroll:
                    </span>
                    <div className="inline-flex items-center rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleScrollBy("left")}
                        disabled={!canScrollLeft}
                        className="px-2 py-1 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 transition"
                        title="Scroll Left"
                      >
                        <ArrowLeft size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScrollBy("right")}
                        disabled={!canScrollRight}
                        className="px-2 py-1 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 transition"
                        title="Scroll Right"
                      >
                        <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScrollBy("up")}
                        disabled={!canScrollUp}
                        className="px-2 py-1 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 transition"
                        title="Scroll Up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleScrollBy("down")}
                        disabled={!canScrollDown}
                        className="px-2 py-1 rounded text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:text-slate-300 transition"
                        title="Scroll Down"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-600">
                      <button
                        type="button"
                        onClick={() => setTableHeightPreset("compact")}
                        className={`px-2 py-0.5 rounded ${tableHeightPreset === "compact" ? "bg-blue-50 text-blue-700" : ""}`}
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableHeightPreset("default")}
                        className={`px-2 py-0.5 rounded ${tableHeightPreset === "default" ? "bg-blue-50 text-blue-700" : ""}`}
                      >
                        Default
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableHeightPreset("expanded")}
                        className={`px-2 py-0.5 rounded ${tableHeightPreset === "expanded" ? "bg-blue-50 text-blue-700" : ""}`}
                      >
                        Expanded
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table Viewport */}
                <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-900/10 to-transparent pointer-events-none z-30" />
                  )}
                  {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-900/10 to-transparent pointer-events-none z-30" />
                  )}

                  <div
                    ref={tableScrollRef}
                    onScroll={updateScrollStatus}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    className={`overflow-auto ${
                      tableHeightPreset === "compact"
                        ? "max-h-[360px]"
                        : tableHeightPreset === "expanded"
                        ? "max-h-[720px]"
                        : "max-h-[500px]"
                    } custom-scrollbar relative focus:outline-none focus:ring-1 focus:ring-blue-400`}
                  >
                    <table className="w-full text-left border-collapse min-w-[880px]">
                      <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs border-b border-slate-200">
                        <tr className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          <th className="py-3 px-4 sticky left-0 top-0 z-30 bg-slate-100 border-r border-slate-200">
                            Employee
                          </th>
                          <th className="py-3 px-4">Late Date & Session</th>
                          <th className="py-3 px-4">Penalty</th>
                          <th className="py-3 px-4 text-center">Payment Status</th>
                          <th className="py-3 px-4 text-center">Notification</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {penaltiesLoading && latePenalties.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                              <RefreshCw size={20} className="animate-spin mx-auto text-blue-600 mb-2" />
                              Loading records...
                            </td>
                          </tr>
                        ) : filteredRecords.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-gray-400 font-medium">
                              <ShieldCheck size={28} className="mx-auto text-emerald-500 mb-2 opacity-70" />
                              No late arrival penalties found for the current filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRecords.map((r) => {
                            const ethDate = gregorianToEthiopianDate(r.date);
                            const isWaived = r.penalty_status === "WAIVED";
                            const isGrace = r.penalty_status === "WITHIN_GRACE";
                            const isPaid = Boolean(r.paid_at || r.payroll_id || r.penalty_status === "PAID");
                            const isPenalized = r.penalty_status === "PENALIZED";
                            const isNotificationChecked = r.notification_status === "ACTIVE" && !isPenalized && !isPaid;

                            return (
                              <tr key={r.id} className="group hover:bg-slate-50/70 transition">
                                {/* 1. Employee Info - Sticky Left Column */}
                                <td className="py-3 px-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition border-r border-slate-200/80">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300/60 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0 overflow-hidden">
                                      {r.photo ? (
                                        <img src={r.photo} alt={r.employee_name} className="w-full h-full object-cover" />
                                      ) : (
                                        r.employee_name.slice(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900">{r.employee_name}</div>
                                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                                        <span>{r.employee_role || "Staff"}</span>
                                        {r.phone_number && <span>· {r.phone_number}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* 2. Late Date & Session */}
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900 text-xs">{ethDate.formattedAm}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">{r.date} · {ethDate.formattedEn}</div>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        r.session === "Morning"
                                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                                          : "bg-purple-50 text-purple-800 border border-purple-200"
                                      }`}
                                    >
                                      {r.session} Session
                                    </span>
                                    <span className="font-mono text-[10px] text-rose-600 font-bold">
                                      {r.late_minutes}m late
                                    </span>
                                    {r.late_minutes > (penaltyPolicy?.late_grace_minutes || 15) && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                                        +{r.late_minutes - (penaltyPolicy?.late_grace_minutes || 15)}m over grace
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 3. Penalty Amount */}
                                <td className="py-3 px-4">
                                  <div
                                    className={`font-mono font-black text-sm ${
                                      isWaived
                                        ? "text-gray-400 line-through"
                                        : isGrace
                                        ? "text-slate-500"
                                        : "text-rose-600"
                                    }`}
                                  >
                                    ETB {r.penalty_amount.toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    {isWaived ? "Pardoned" : isGrace ? "Within Grace (0 ETB)" : "Payroll fine"}
                                  </div>
                                </td>

                                {/* 4. Payment Status */}
                                <td className="py-3 px-4 text-center">
                                  {isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 size={11} /> Paid
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      <Clock size={11} /> Unpaid
                                    </span>
                                  )}
                                </td>

                                {/* 5. Notification Checkbox */}
                                <td className="py-3 px-4 text-center">
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    <input
                                      type="checkbox"
                                      checked={isNotificationChecked}
                                      onChange={async (e) => {
                                        const nextStatus = e.target.checked ? "ACTIVE" : "UNCHECKED";
                                        const res = await updatePenaltyNotification(r.id, nextStatus);
                                        if (res.success) {
                                          showNotification("success", `Notification ${nextStatus === "ACTIVE" ? "enabled" : "unchecked"} for ${r.employee_name}`);
                                        } else {
                                          showNotification("error", res.error || "Failed to update notification");
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      title={
                                        isPenalized || isPaid
                                          ? "Notification automatically unchecked because penalty is already processed / penalized"
                                          : isNotificationChecked
                                          ? "Active reminder notification (click to uncheck)"
                                          : "Notification unchecked (click to activate)"
                                      }
                                    />
                                    <span className="text-[9px] text-slate-400 font-medium">
                                      {isNotificationChecked ? "Active" : "Unchecked"}
                                    </span>
                                  </div>
                                </td>

                                {/* 6. Status Display */}
                                <td className="py-3 px-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <span
                                      className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                        isPenalized
                                          ? "bg-rose-100 text-rose-800 border border-rose-300"
                                          : r.penalty_status === "PAID"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                          : r.penalty_status === "PENDING"
                                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                                          : r.penalty_status === "CANCELLED"
                                          ? "bg-slate-100 text-slate-700 border border-slate-300"
                                          : isWaived
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                          : "bg-blue-100 text-blue-800 border border-blue-200"
                                      }`}
                                    >
                                      {isPenalized ? "PENALIZED" : r.penalty_status || "PENDING"}
                                    </span>

                                    {/* Admin Quick Status Changer */}
                                    {isManager && !isWaived && (
                                      <select
                                        value={r.penalty_status || "PENDING"}
                                        onChange={async (e) => {
                                          const newStatus = e.target.value;
                                          const res = await updatePenaltyStatus(r.id, newStatus);
                                          if (res.success) {
                                            showNotification("success", `Status updated to ${newStatus}. Notification automatically updated.`);
                                          } else {
                                            showNotification("error", res.error || "Failed to update penalty status");
                                          }
                                        }}
                                        className="text-[10px] py-0.5 px-1.5 rounded border border-slate-200 bg-white text-slate-700 font-semibold focus:outline-none cursor-pointer"
                                        title="Change penalty status"
                                      >
                                        <option value="PENDING">Pending</option>
                                        <option value="PENALIZED">Penalized</option>
                                        <option value="PAID">Paid</option>
                                        <option value="CANCELLED">Cancelled</option>
                                      </select>
                                    )}

                                    {isWaived && r.penalty_waived_reason && (
                                      <div className="text-[10px] text-emerald-700 max-w-[150px] truncate" title={r.penalty_waived_reason}>
                                        {r.penalty_waived_reason}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* 7. Actions */}
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setDetailRecord(r)}
                                      className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                                      title="View Details"
                                    >
                                      <FileText size={14} />
                                    </button>

                                    {isManager && (
                                      <>
                                        {!isWaived ? (
                                          <button
                                            type="button"
                                            onClick={() => openWaiveModal(r)}
                                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                          >
                                            <ShieldCheck size={12} /> Pardon
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleReinstate(r)}
                                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                            title="Reinstate Late Penalty"
                                          >
                                            <RotateCcw size={12} /> Reinstate
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
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

            {/* Bottom summary note */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500">
              <span>
                Showing <strong>{filteredRecords.length}</strong> of <strong>{latePenalties.length}</strong> late records
              </span>
              <span className="text-slate-400">
                Punctuality policies are evaluated automatically based on official company rules.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PENALTY POLICY & RULES CONFIGURATION (RESPONSIVE PAGE)            */}
      {/* ========================================================================= */}
      {activeView === "policy" && (
        <div className="space-y-4 sm:space-y-6">
          {/* Header & Subtitle */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-700">
                <Sliders size={20} />
                <h3 className="text-base sm:text-lg font-bold text-slate-900">Late Penalty Policy & Rules</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Configure company-wide arrival grace periods, fixed incident fines, and per-hour wage deduction formulas.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleResetPolicyDefaults}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("records")}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Clock size={13} />
                <span>View Records</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSavePolicy} className="space-y-4 sm:space-y-6">
            {/* Form Cards Grid - Responsive from mobile to desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Late Arrival Grace Period (Minutes) */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-blue-900 text-xs sm:text-sm block">
                      Late Arrival Grace Period (Minutes)
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-bold">
                      {graceMinutes} Mins
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700/90 mt-1">
                    Employees checking in within this period after shift start are marked "Present" without salary penalty.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGraceMinutes(Math.max(0, (parseInt(graceMinutes, 10) || 0) - 5).toString())}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={graceMinutes}
                      onChange={(e) => setGraceMinutes(e.target.value)}
                      className="w-24 sm:w-28 text-center px-3 py-2 rounded-xl border border-gray-300 font-mono font-bold bg-white text-sm focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setGraceMinutes(Math.min(60, (parseInt(graceMinutes, 10) || 0) + 5).toString())}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="font-bold text-slate-700 text-xs">Minutes</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
                    {["5", "10", "15", "20", "30"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setGraceMinutes(m)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                          graceMinutes === m
                            ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Allowed Minor Lates per Month */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 text-xs sm:text-sm block">
                      Allowed Minor Lates per Month
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold">
                      {allowedLates} Incidents
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Number of late check-ins tolerated per month before attendance score penalty applies.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAllowedLates(Math.max(0, (parseInt(allowedLates, 10) || 0) - 1).toString())}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={allowedLates}
                      onChange={(e) => setAllowedLates(e.target.value)}
                      className="w-24 sm:w-28 text-center px-3 py-2 rounded-xl border border-gray-300 font-mono font-bold bg-white text-sm focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setAllowedLates(Math.min(10, (parseInt(allowedLates, 10) || 0) + 1).toString())}
                      className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold active:scale-95 transition"
                    >
                      <Plus size={14} />
                    </button>
                    <span className="font-bold text-slate-700 text-xs">Incidents</span>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
                    {["0", "1", "2", "3", "5"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAllowedLates(n)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                          allowedLates === n
                            ? "bg-slate-800 text-white border-slate-800 shadow-2xs"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. Fixed Incident Penalty */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-amber-900 text-xs sm:text-sm block">
                      Fixed Incident Penalty
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-bold">
                      ETB {fixedPenalty} Base
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1">
                    Base fine per late punch exceeding arrival grace period.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-800 font-mono">ETB</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={fixedPenalty}
                      onChange={(e) => setFixedPenalty(e.target.value)}
                      className="w-28 px-3 py-2 rounded-xl border border-gray-300 font-mono font-bold bg-white text-sm focus:border-amber-600 focus:outline-none"
                    />
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
                    {["15", "25", "50", "100"].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFixedPenalty(amt)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                          fixedPenalty === amt
                            ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                            : "bg-amber-50/60 text-amber-800 border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {amt} ETB
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Hourly Rate Multiplier */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-purple-200 shadow-xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-purple-900 text-xs sm:text-sm block">
                      Hourly Rate Multiplier
                    </label>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-50 text-purple-800 rounded-md font-bold">
                      {hourlyMultiplier}x Rate
                    </span>
                  </div>
                  <p className="text-[11px] text-purple-700 mt-1">
                    Per late hour deduction fraction applied to employee hourly pay.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="2.0"
                      value={hourlyMultiplier}
                      onChange={(e) => setHourlyMultiplier(e.target.value)}
                      className="w-24 sm:w-28 px-3 py-2 rounded-xl border border-gray-300 font-mono font-bold bg-white text-sm focus:border-purple-600 focus:outline-none"
                    />
                    <span className="font-bold text-slate-700 text-xs">x Hourly Pay</span>
                  </div>

                  {/* Presets */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium">Presets:</span>
                    {["0.25", "0.5", "0.75", "1.0", "1.5"].map((mult) => (
                      <button
                        key={mult}
                        type="button"
                        onClick={() => setHourlyMultiplier(mult)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition ${
                          hourlyMultiplier === mult
                            ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                            : "bg-purple-50/60 text-purple-800 border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Policy Simulator & Calculation Preview */}
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-2 text-slate-800">
                <Calculator size={18} className="text-blue-600" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                  Interactive Live Penalty Calculator & Simulator
                </h4>
              </div>
              <p className="text-xs text-slate-500">
                Test how these parameters calculate salary deduction for an employee based on arrival delay.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Simulator Inputs */}
                <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                      <span>Simulated Delay:</span>
                      <span className="font-mono text-rose-600">{simDelayMinutes} Minutes</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={simDelayMinutes}
                      onChange={(e) => setSimDelayMinutes(Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>0m (On time)</span>
                      <span>{graceMinutes}m Grace</span>
                      <span>120m</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Employee Hourly Rate:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono font-bold">ETB</span>
                      <input
                        type="number"
                        min="20"
                        max="200"
                        value={simHourlyRate}
                        onChange={(e) => setSimHourlyRate(Number(e.target.value))}
                        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-lg font-mono font-bold"
                      />
                      <span className="text-xs text-slate-500">/ hour</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Output Card */}
                <div
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    simCalculation.isWithinGrace
                      ? "bg-emerald-50/70 border-emerald-200"
                      : "bg-rose-50/70 border-rose-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Calculated Outcome
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        simCalculation.isWithinGrace
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {simCalculation.status}
                    </span>
                  </div>

                  <div className="my-2 space-y-1 text-xs">
                    {simCalculation.isWithinGrace ? (
                      <p className="text-emerald-800 font-medium">
                        Delay is within the <strong>{graceMinutes}-minute grace period</strong>. Marked as{" "}
                        <strong className="text-emerald-700">Present</strong> with zero payroll deduction.
                      </p>
                    ) : (
                      <div className="space-y-1 text-rose-900 font-mono text-[11px]">
                        <div className="flex justify-between">
                          <span>Base Fine:</span>
                          <span>ETB {simCalculation.fixedPenalty.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>
                            Time Deduction ({simDelayMinutes}m @ {simHourlyRate} ETB/hr × {hourlyMultiplier}x):
                          </span>
                          <span>ETB {simCalculation.hourlyDeduction.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-rose-200 pt-1 text-xs text-rose-700">
                          <span>Total Incident Fine:</span>
                          <span>ETB {simCalculation.totalPenalty.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">Net Deduction:</span>
                    <span
                      className={`font-mono font-black text-lg ${
                        simCalculation.isWithinGrace ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      ETB {simCalculation.totalPenalty.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky/Responsive Action Footer */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveView("records")}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition text-center"
              >
                Cancel / Return to Records
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={policySaving}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {policySaving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving Policies...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Save Policy Settings</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: WAIVE / PARDON LATE PENALTY DIALOG (FULLY RESPONSIVE)             */}
      {/* ========================================================================= */}
      {waiveRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl border border-gray-100 my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck size={20} />
                <h3 className="text-base font-bold text-slate-800">Pardon & Waive Late Penalty</h3>
              </div>
              <button
                type="button"
                onClick={() => setWaiveRecord(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 border border-slate-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Employee:</span>
                  <span className="font-bold text-slate-900">{waiveRecord.employee_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date & Session:</span>
                  <span className="font-medium text-slate-800">
                    {gregorianToEthiopianDate(waiveRecord.date).formattedAm} · {waiveRecord.session} Session
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delay:</span>
                  <span className="font-mono font-bold text-rose-600">{waiveRecord.late_minutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Deduction to Waive:</span>
                  <span className="font-mono font-black text-rose-600">ETB {waiveRecord.penalty_amount.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Quick Excuse Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickWaiveReasons.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setWaiveReason(r)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border text-left transition ${
                        waiveReason === r
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Waiver Explanation / Audit Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  placeholder="Explain why this penalty is excused..."
                  rows={3}
                  className="w-full p-2.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-600 transition"
                  required
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 shrink-0 bg-slate-50/70 rounded-b-2xl flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={() => setWaiveRecord(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 rounded-xl transition text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWaive}
                disabled={waiveLoading || !waiveReason.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {waiveLoading ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} /> Confirm Pardon
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: MANUAL RECORD ENTRY MODAL (FULLY RESPONSIVE)                     */}
      {/* ========================================================================= */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl border border-gray-100 my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-blue-600">
                <PlusCircle size={20} />
                <h3 className="text-base font-bold text-slate-800">Record Manual Late Penalty</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitManualPenalty} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-3.5 text-xs overflow-y-auto flex-1 custom-scrollbar">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Select Employee <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value ? Number(e.target.value) : "")}
                    className="w-full p-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
                    required
                  >
                    <option value="">-- Choose Employee --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.role || "Staff"} · {emp.phone_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Date (YYYY-MM-DD) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      placeholder="YYYY-MM-DD"
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono focus:outline-none focus:border-blue-600"
                      required
                    />
                    <div className="text-[10px] text-blue-600 font-semibold mt-1">
                      የኢትዮጵያ ቀን: {gregorianToEthiopianDate(manualDate).formattedAm}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Work Shift Session</label>
                    <select
                      value={manualSession}
                      onChange={(e) => handleManualSessionChange(e.target.value as any)}
                      className="w-full p-2 border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-blue-600"
                    >
                      <option value="Morning">Morning Shift (02:00 - 06:00)</option>
                      <option value="Afternoon">Afternoon Shift (07:00 - 11:00)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Actual Check-in Time</label>
                    <input
                      type="text"
                      value={manualCheckIn}
                      onChange={(e) => handleManualCheckInChange(e.target.value)}
                      placeholder="e.g. 02:35:00 or 08:35:00"
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono focus:outline-none focus:border-blue-600"
                    />
                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                      ሰዓት: {formatToEthiopianTime(manualCheckIn, manualSession).dualText}
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Late Duration (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={manualLateMinutes}
                      onChange={(e) => setManualLateMinutes(Number(e.target.value))}
                      className="w-full p-2 border border-gray-200 rounded-xl font-mono focus:outline-none focus:border-blue-600 font-bold text-rose-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Penalty Deduction Amount (ETB)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-bold font-mono">ETB</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={manualPenaltyAmount}
                      onChange={(e) => setManualPenaltyAmount(Number(e.target.value))}
                      className="flex-1 p-2 border border-gray-200 rounded-xl font-mono font-black text-rose-600 focus:outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reason / Incident Notes</label>
                  <input
                    type="text"
                    value={manualReason}
                    onChange={(e) => setManualReason(e.target.value)}
                    placeholder="e.g., Unexcused tardiness, missed morning roll call"
                    className="w-full p-2 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-gray-100 shrink-0 bg-slate-50/70 rounded-b-2xl flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 rounded-xl transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  {manualLoading ? "Saving..." : "Save Late Penalty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DETAIL RECORD MODAL (FULLY RESPONSIVE)                            */}
      {/* ========================================================================= */}
      {detailRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100vh-2rem)] flex flex-col shadow-2xl border border-gray-100 my-auto">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 text-slate-800">
                <FileText size={20} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">Attendance & Lateness Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-2.5 text-xs divide-y divide-gray-100 overflow-y-auto flex-1 custom-scrollbar">
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Employee:</span>
                <span className="font-bold text-slate-900">{detailRecord.employee_name}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-mono text-slate-800">
                  {gregorianToEthiopianDate(detailRecord.date).formattedAm} ({detailRecord.date})
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Session:</span>
                <span className="font-bold text-slate-800">{detailRecord.session}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Scheduled Start:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {detailRecord.scheduled_start_time
                    ? formatToEthiopianTime(detailRecord.scheduled_start_time, detailRecord.session).dualText
                    : (detailRecord.session === "Morning" ? "02:00 ጠዋት" : "07:00 ከሰዓት")}
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Actual Check-In:</span>
                <span className="font-mono font-bold text-rose-600">
                  {detailRecord.check_in_time
                    ? formatToEthiopianTime(detailRecord.check_in_time, detailRecord.session).dualText
                    : "--:--"}
                </span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Delay / Lateness:</span>
                <span className="font-mono font-black text-rose-600">{detailRecord.late_minutes} minutes</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Penalty Status:</span>
                <span className="font-bold text-slate-800">{detailRecord.penalty_status}</span>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-gray-500">Penalty Amount:</span>
                <span className="font-mono font-black text-rose-600">ETB {detailRecord.penalty_amount.toFixed(2)}</span>
              </div>
              {detailRecord.verification_method && (
                <div className="pt-2 flex justify-between items-center">
                  <span className="text-gray-500">Verification:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px]">
                    {detailRecord.verification_method}
                  </span>
                </div>
              )}
              {detailRecord.penalty_waived_reason && (
                <div className="pt-2">
                  <span className="text-gray-500 block mb-0.5">Waiver Justification:</span>
                  <p className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 font-medium text-[11px]">
                    {detailRecord.penalty_waived_reason}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 shrink-0 bg-slate-50/70 rounded-b-2xl flex justify-end">
              <button
                type="button"
                onClick={() => setDetailRecord(null)}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
