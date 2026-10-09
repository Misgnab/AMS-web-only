import React, { useState, useEffect, useMemo } from "react";
import {
 AlertTriangle,
 Clock,
 CheckCircle2,
 XCircle,
 Shield,
 FileText,
 User,
 Calendar,
 Lock,
 Unlock,
 Search,
 Filter,
 RefreshCw,
 Info,
 Check,
 ChevronRight,
 History,
 AlertOctagon,
 ArrowRight,
 Sparkles,
 X,
 Send,
 ThumbsDown,
 FileCheck,
 AlertCircle,
 DollarSign,
 ChevronLeft,
 LayoutGrid,
 List,
 SlidersHorizontal,
 ArrowLeft
} from "lucide-react";
import { useAppStore } from "../store.js";
import { AttendanceRecord, AttendanceCorrection, AuditLogRecord } from "../types.js";
import { formatToEthiopianTime } from "../utils/ethiopianTime.js";

export interface MissingCheckoutManagementProps {
 isModal?: boolean;
 onClose?: () => void;
 initialRecordId?: number | null;
 initialTab?: "requests" | "unclosed" | "payroll" | "audit" | "my-unclosed" | "my-requests" | null;
}

export const MissingCheckoutManagement: React.FC<MissingCheckoutManagementProps> = ({
 isModal = false,
 onClose,
 initialRecordId = null,
 initialTab = null
}) => {
 const {
 user,
 siteSettings,
 missingCheckouts,
 attendanceCorrections,
 attendanceAuditLogs,
 payrollPreflight,
 attendanceStatus,
 fetchMissingCheckouts,
 correctMissingCheckout,
 fetchAttendanceCorrections,
 requestAttendanceCorrection,
 approveAttendanceCorrection,
 rejectAttendanceCorrection,
 fetchPayrollPreflightCheck,
 fetchAttendanceAuditLogs,
 fetchAttendanceStatus
 } = useAppStore();

 const isAdmin = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"].includes(user?.role || "");

 // Tab State
 const [activeTab, setActiveTab] = useState<string>(() => {
 if (initialTab) return initialTab;
 if (isAdmin) return "requests";
 return "my-unclosed";
 });

 // Mobile layout switch for split-views (Records list vs Form)
 const [mobileDetailView, setMobileDetailView] = useState<"list" | "detail">("list");
 const [auditViewMode, setAuditViewMode] = useState<"cards" | "table">("cards");

 // Search & Filters
 const [searchTerm, setSearchTerm] = useState("");
 const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
 const [isRefreshing, setIsRefreshing] = useState(false);
 const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

 // Admin Direct Correction Form State
 const [selectedUnclosedRecord, setSelectedUnclosedRecord] = useState<AttendanceRecord | null>(null);
 const [directCheckOutTime, setDirectCheckOutTime] = useState("17:30:00");
 const [directCheckInTime, setDirectCheckInTime] = useState("");
 const [directStatus, setDirectStatus] = useState<"Present" | "Late" | "Authorized" | "Permission">("Present");
 const [directReason, setDirectReason] = useState("");
 const [directCustomHours, setDirectCustomHours] = useState("");
 const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);

 // Admin Request Review State
 const [selectedCorrectionForReview, setSelectedCorrectionForReview] = useState<AttendanceCorrection | null>(null);
 const [approvedCheckOutTime, setApprovedCheckOutTime] = useState("");
 const [adminReviewNotes, setAdminReviewNotes] = useState("");
 const [rejectionReasonInput, setRejectionReasonInput] = useState("");
 const [isReviewingAction, setIsReviewingAction] = useState(false);
 const [reviewActionType, setReviewActionType] = useState<"approve" | "reject" | null>(null);

 // Employee Request Submission Form State
 const [selectedMyUnclosedRecord, setSelectedMyUnclosedRecord] = useState<AttendanceRecord | null>(null);
 const [empRequestedCheckOut, setEmpRequestedCheckOut] = useState("17:30:00");
 const [empReasonCode, setEmpReasonCode] = useState("FORGOT_CHECKOUT");
 const [empReasonText, setEmpReasonText] = useState("");
 const [isSubmittingEmpRequest, setIsSubmittingEmpRequest] = useState(false);

 // Payroll Preflight State
 const [preflightMonth, setPreflightMonth] = useState<number>(new Date().getMonth() + 1);
 const [preflightYear, setPreflightYear] = useState<number>(new Date().getFullYear());
 const [isLoadingPreflight, setIsLoadingPreflight] = useState(false);

 // Initial Load / Refresh
 useEffect(() => {
 handleRefreshAll();
 if (initialTab) {
 setActiveTab(initialTab);
 } else {
 setActiveTab(isAdmin ? "requests" : "my-unclosed");
 }
 }, [initialTab, isAdmin]);

 // Handle Initial Record Selection
 useEffect(() => {
 if (initialRecordId && missingCheckouts.length > 0) {
 const found = missingCheckouts.find(r => r.id === initialRecordId);
 if (found) {
 if (isAdmin) {
 setActiveTab("unclosed");
 handleSelectUnclosedRecord(found);
 } else {
 setActiveTab("my-unclosed");
 handleSelectMyUnclosedRecord(found);
 }
 }
 }
 }, [initialRecordId, missingCheckouts, isAdmin]);

 const handleRefreshAll = async () => {
 setIsRefreshing(true);
 try {
 const promises: Promise<any>[] = [
 fetchMissingCheckouts(),
 fetchAttendanceCorrections(),
 fetchAttendanceStatus()
 ];
 if (isAdmin) {
 promises.push(fetchAttendanceAuditLogs());
 promises.push(fetchPayrollPreflightCheck(preflightMonth, preflightYear));
 }
 await Promise.all(promises);
 } catch (err) {
 console.error("Error refreshing attendance resolution data:", err);
 } finally {
 setIsRefreshing(false);
 }
 };

 // Time Normalization & Work Hour Computation for Morning & Afternoon
 const computeShiftWorkedHours = (inTimeStr: string, outTimeStr: string, session?: string): number => {
 if (!inTimeStr || !outTimeStr) return 0;
 let [ih, im] = inTimeStr.split(":").map(Number);
 let [oh, om] = outTimeStr.split(":").map(Number);
 ih = ih || 0;
 im = im || 0;
 oh = oh || 0;
 om = om || 0;

 // Session-aware Ethiopian vs Gregorian normalization
 if (session === "Morning") {
 // Ethiopian morning is ~2:30 (8:30) to 6:30 (12:30). If entered as Gregorian 12-14:
 if (ih <= 6 && oh >= 12 && oh <= 14) {
 oh -= 6;
 } else if (ih >= 8 && oh <= 7) {
 oh += 6;
 }
 } else if (session === "Afternoon") {
 // Ethiopian afternoon is ~7:30 (1:30) to 11:30 (5:30). If entered as Gregorian 13-23:
 if (ih <= 12 && oh >= 13 && oh <= 23) {
 oh -= 6;
 } else if (ih >= 13 && oh <= 12) {
 oh += 6;
 }
 }

 let diff = (oh * 60 + om) - (ih * 60 + im);
 if (diff < 0) diff += 24 * 60;
 return Math.max(0, parseFloat((diff / 60).toFixed(2)));
 };

 const getSettingDefaultIn = (session: string, isGreg: boolean) => {
   const timeStr = session === "Morning" 
     ? (siteSettings?.morning_start_time || siteSettings?.work_start_time || "08:30") 
     : (siteSettings?.afternoon_start_time || "13:30");
   if (isGreg) return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
   const eth = formatToEthiopianTime(timeStr);
   return `${String(eth.ethHour).padStart(2, "0")}:${eth.minute}:00`;
 };

 const getSettingDefaultOut = (session: string, isGreg: boolean) => {
   const timeStr = session === "Morning" 
     ? (siteSettings?.morning_end_time || "12:30") 
     : (siteSettings?.afternoon_end_time || siteSettings?.work_end_time || "17:30");
   if (isGreg) return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
   const eth = formatToEthiopianTime(timeStr);
   return `${String(eth.ethHour).padStart(2, "0")}:${eth.minute}:00`;
 };

 const handleSelectUnclosedRecord = (record: AttendanceRecord) => {
 setSelectedUnclosedRecord(record);
 setMobileDetailView("detail");
 setFeedback(null);
 const isGreg = (record.check_in_time || "").startsWith("08") || (record.check_in_time || "").startsWith("13");
 setDirectCheckInTime(record.check_in_time || getSettingDefaultIn(record.session, isGreg));
 setDirectCheckOutTime(getSettingDefaultOut(record.session, isGreg));
 setDirectStatus("Present");
 setDirectReason("");
 setDirectCustomHours("");
 };

 const handleSelectMyUnclosedRecord = (record: AttendanceRecord) => {
 setSelectedMyUnclosedRecord(record);
 setMobileDetailView("detail");
 setFeedback(null);
 const isGreg = (record.check_in_time || "").startsWith("08") || (record.check_in_time || "").startsWith("13");
 setEmpRequestedCheckOut(getSettingDefaultOut(record.session, isGreg));
 setEmpReasonCode("FORGOT_CHECKOUT");
 setEmpReasonText("");
 };

 const handleSelectCorrectionForReview = (correction: AttendanceCorrection, action: "approve" | "reject") => {
 setSelectedCorrectionForReview(correction);
 setReviewActionType(action);
 const isGreg = (correction.original_check_in || correction.requested_check_in || "").startsWith("08") || (correction.original_check_in || "").startsWith("13");
 setApprovedCheckOutTime(correction.requested_check_out || getSettingDefaultOut(correction.session, isGreg));
 setAdminReviewNotes("");
 setRejectionReasonInput("");
 setFeedback(null);
 };

 const computeDirectCalculatedHours = (): number => {
  if (directCustomHours && !isNaN(parseFloat(directCustomHours))) {
    return parseFloat(parseFloat(directCustomHours).toFixed(2));
  }
  const sess = selectedUnclosedRecord?.session || "Morning";
  const inTime = directCheckInTime || getSettingDefaultIn(sess, false);
  const outTime = directCheckOutTime || getSettingDefaultOut(sess, false);
  return computeShiftWorkedHours(inTime, outTime, sess);
 };

 const computeEmpCalculatedHours = (): number => {
  if (!selectedMyUnclosedRecord) return 4.0;
  const sess = selectedMyUnclosedRecord.session || "Morning";
  const inTime = selectedMyUnclosedRecord.check_in_time || getSettingDefaultIn(sess, false);
  const outTime = empRequestedCheckOut || getSettingDefaultOut(sess, false);
  return computeShiftWorkedHours(inTime, outTime, sess);
 };

 const handleDirectSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedUnclosedRecord) return;

 if (!directCheckOutTime.trim()) {
 setFeedback({ type: "error", message: "Please specify an approved check-out time." });
 return;
 }

 if (!directReason.trim() || directReason.trim().length < 5) {
 setFeedback({ type: "error", message: "Please provide a detailed administrative justification (minimum 5 characters)." });
 return;
 }

 setIsSubmittingDirect(true);
 setFeedback(null);

 const calculatedHrs = computeDirectCalculatedHours();

 const res = await correctMissingCheckout(selectedUnclosedRecord.id, {
 check_out_time: directCheckOutTime,
 check_in_time: directCheckInTime || selectedUnclosedRecord.check_in_time || undefined,
 status: directStatus,
 reason: directReason.trim(),
 total_hours: calculatedHrs
 });

 setIsSubmittingDirect(false);

 if (res.success) {
 setFeedback({
 type: "success",
 message: res.message || "Record successfully corrected and employee lock released!"
 });
 setTimeout(() => {
 setSelectedUnclosedRecord(null);
 setMobileDetailView("list");
 }, 1500);
 handleRefreshAll();
 } else {
 setFeedback({
 type: "error",
 message: res.error || "Failed to correct attendance record."
 });
 }
 };

 const handleAdminApproveRequest = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedCorrectionForReview) return;

 setIsReviewingAction(true);
 setFeedback(null);

 const res = await approveAttendanceCorrection(selectedCorrectionForReview.id, {
 approved_check_out: approvedCheckOutTime.trim() || selectedCorrectionForReview.requested_check_out,
 notes: adminReviewNotes.trim() || undefined
 });

 setIsReviewingAction(false);

 if (res.success) {
 setFeedback({
 type: "success",
 message: res.message || "Correction request approved and employee check-in lock released!"
 });
 setSelectedCorrectionForReview(null);
 setReviewActionType(null);
 handleRefreshAll();
 } else {
 setFeedback({
 type: "error",
 message: res.error || "Failed to approve correction."
 });
 }
 };

 const handleAdminRejectRequest = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedCorrectionForReview) return;

 if (!rejectionReasonInput.trim()) {
 setFeedback({ type: "error", message: "A rejection reason is required for administrative audit logs." });
 return;
 }

 setIsReviewingAction(true);
 setFeedback(null);

 const res = await rejectAttendanceCorrection(selectedCorrectionForReview.id, rejectionReasonInput.trim());

 setIsReviewingAction(false);

 if (res.success) {
 setFeedback({
 type: "success",
 message: res.message || "Correction request rejected."
 });
 setSelectedCorrectionForReview(null);
 setReviewActionType(null);
 handleRefreshAll();
 } else {
 setFeedback({
 type: "error",
 message: res.error || "Failed to reject correction."
 });
 }
 };

 const handleEmpRequestSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedMyUnclosedRecord) return;

 if (!empRequestedCheckOut.trim()) {
 setFeedback({ type: "error", message: "Please enter your departure / check-out time." });
 return;
 }

 if (!empReasonText.trim() || empReasonText.trim().length < 5) {
 setFeedback({ type: "error", message: "Please provide a clear explanation for your supervisor (minimum 5 characters)." });
 return;
 }

 setIsSubmittingEmpRequest(true);
 setFeedback(null);

 const res = await requestAttendanceCorrection({
 attendance_id: selectedMyUnclosedRecord.id,
 date: selectedMyUnclosedRecord.date,
 session: selectedMyUnclosedRecord.session,
 requested_check_in: selectedMyUnclosedRecord.check_in_time || undefined,
 requested_check_out: empRequestedCheckOut.trim(),
 reason: empReasonText.trim(),
 reason_code: empReasonCode
 });

 setIsSubmittingEmpRequest(false);

 if (res.success) {
 setFeedback({
 type: "success",
 message: res.message || "Correction request submitted! An administrator will review your departure time."
 });
 setSelectedMyUnclosedRecord(null);
 setMobileDetailView("list");
 handleRefreshAll();
 setTimeout(() => {
 setActiveTab("my-requests");
 }, 1200);
 } else {
 setFeedback({
 type: "error",
 message: res.error || "Failed to submit correction request."
 });
 }
 };

 const handleRunPayrollPreflight = async () => {
 setIsLoadingPreflight(true);
 await fetchPayrollPreflightCheck(preflightMonth, preflightYear);
 setIsLoadingPreflight(false);
 };

 // Filtered staff correction requests
 const pendingRequestsCount = attendanceCorrections.filter(c => c.status === "PENDING").length;

 const filteredCorrections = useMemo(() => {
 return attendanceCorrections.filter(c => {
 if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
 if (!searchTerm.trim()) return true;
 const term = searchTerm.toLowerCase();
 return (
 (c.full_name && c.full_name.toLowerCase().includes(term)) ||
 (c.phone_number && c.phone_number.includes(term)) ||
 (c.date && c.date.includes(term)) ||
 (c.reason && c.reason.toLowerCase().includes(term)) ||
 (c.reason_code && c.reason_code.toLowerCase().includes(term))
 );
 });
 }, [attendanceCorrections, statusFilter, searchTerm]);

 // Filtered unclosed shifts for admin
 const filteredUnclosed = useMemo(() => {
 return missingCheckouts.filter(r => {
 if (!searchTerm.trim()) return true;
 const term = searchTerm.toLowerCase();
 return (
 (r.full_name && r.full_name.toLowerCase().includes(term)) ||
 (r.phone_number && r.phone_number.includes(term)) ||
 (r.date && r.date.includes(term)) ||
 (r.session && r.session.toLowerCase().includes(term))
 );
 });
 }, [missingCheckouts, searchTerm]);

 // Employee unclosed shifts
 const employeeUnclosedRecords = useMemo(() => {
 return attendanceStatus?.missingRecords && attendanceStatus.missingRecords.length > 0
 ? attendanceStatus.missingRecords
 : missingCheckouts.filter(r => r.user_id === user?.id);
 }, [attendanceStatus, missingCheckouts, user?.id]);

 // Employee's own requests
 const myRequests = useMemo(() => {
 return attendanceCorrections.filter(c => c.user_id === user?.id || (c as any).employee_id === user?.id);
 }, [attendanceCorrections, user?.id]);

 // Main Container content
 const content = (
 <div className={`w-full flex flex-col ${isModal ? "h-full max-h-[92vh] overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-200 " : "space-y-6"}`}>
 
 {/* Header Bar */}
 <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0 ${isModal ? "rounded-t-2xl" : "rounded-2xl shadow-xs border"}`}>
 <div className="flex items-center gap-3.5">
 <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
 <Clock className="w-5 h-5" />
 </div>
 <div className="min-w-0">
 <div className="flex items-center gap-2.5 flex-wrap">
 <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight">
 {isAdmin ? "Attendance Resolution & Missing Check-Outs" : "Shift Check-Out & Attendance Correction"}
 </h2>
 {isAdmin ? (
 <div className="flex items-center gap-1.5 flex-wrap">
 {pendingRequestsCount > 0 && (
 <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
 {pendingRequestsCount} Pending Review
 </span>
 )}
 {missingCheckouts.length > 0 && (
 <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
 {missingCheckouts.length} Unclosed
 </span>
 )}
 </div>
 ) : (
 employeeUnclosedRecords.length > 0 && (
 <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 whitespace-nowrap">
 <Lock className="w-3 h-3" /> Check-In Locked
 </span>
 )
 )}
 </div>
 <p className="text-xs text-slate-500 truncate mt-0.5">
 {isAdmin 
 ? "Review correction requests, resolve unclosed morning/afternoon shifts, and verify payroll calculation integrity."
 : "Resolve missing check-outs from past shifts to release your attendance lock."}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
 <button
 onClick={handleRefreshAll}
 disabled={isRefreshing}
 className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer border border-transparent hover:border-slate-200 "
 title="Refresh records"
 aria-label="Refresh attendance records"
 >
 <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-600" : ""}`} />
 </button>
 {isModal && onClose && (
 <button
 onClick={onClose}
 className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
 aria-label="Close modal"
 >
 <X className="w-5 h-5" />
 </button>
 )}
 </div>
 </div>

 {/* Global Feedback Banner */}
 {feedback && (
 <div
 className={`px-4 sm:px-6 py-2.5 border-b text-xs flex items-center justify-between shrink-0 ${
 feedback.type === "success"
 ? "bg-emerald-50 border-emerald-200 text-emerald-800 "
 : "bg-rose-50 border-rose-200 text-rose-800 "
 }`}
 >
 <div className="flex items-center gap-2">
 {feedback.type === "success" ? (
 <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
 ) : (
 <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
 )}
 <span className="font-medium">{feedback.message}</span>
 </div>
 <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100 p-1">
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 )}

 {/* Responsive Horizontal Tabs Bar */}
 <div className={`flex items-center px-3 sm:px-6 border-b border-slate-200 bg-white shrink-0 overflow-x-auto no-scrollbar scroll-smooth gap-1 sm:gap-2 ${!isModal ? "rounded-xl border shadow-xs" : ""}`}>
 {isAdmin ? (
 <>
 <button
 onClick={() => { setActiveTab("requests"); setSelectedCorrectionForReview(null); }}
 className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
 activeTab === "requests"
 ? "border-blue-600 text-blue-600 font-bold"
 : "border-transparent text-slate-600 hover:text-slate-900 "
 }`}
 >
 <FileCheck className="w-4 h-4 shrink-0" />
 <span>Staff Requests</span>
 {pendingRequestsCount > 0 && (
 <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-amber-500 text-white">
 {pendingRequestsCount}
 </span>
 )}
 </button>

 <button
 onClick={() => { setActiveTab("unclosed"); setSelectedUnclosedRecord(null); setMobileDetailView("list"); }}
 className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
 activeTab === "unclosed"
 ? "border-blue-600 text-blue-600 font-bold"
 : "border-transparent text-slate-600 hover:text-slate-900 "
 }`}
 >
 <Clock className="w-4 h-4 shrink-0" />
 <span>Unclosed Shifts</span>
 {missingCheckouts.length > 0 && (
 <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200 ">
 {missingCheckouts.length}
 </span>
 )}
 </button>

 <button
 onClick={() => setActiveTab("payroll")}
 className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
 activeTab === "payroll"
 ? "border-blue-600 text-blue-600 font-bold"
 : "border-transparent text-slate-600 hover:text-slate-900 "
 }`}
 >
 <DollarSign className="w-4 h-4 shrink-0" />
 <span>Payroll Pre-Flight</span>
 {payrollPreflight && !payrollPreflight.canProcessPayroll && (
 <span className="w-2 h-2 rounded-full bg-rose-500" />
 )}
 </button>

 <button
 onClick={() => setActiveTab("audit")}
 className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
 activeTab === "audit"
 ? "border-blue-600 text-blue-600 font-bold"
 : "border-transparent text-slate-600 hover:text-slate-900 "
 }`}
 >
 <Shield className="w-4 h-4 shrink-0" />
 <span>Audit Trail</span>
 </button>
 </>
 ) : (
 <>
 <button
 onClick={() => { setActiveTab("my-unclosed"); setMobileDetailView("list"); }}
 className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
 activeTab === "my-unclosed"
 ? "border-blue-600 text-blue-600 font-bold"
 : "border-transparent text-slate-600 hover:text-slate-900 "
 }`}
 >
 <Lock className="w-4 h-4 text-rose-500 shrink-0" />
 <span>My Unclosed Shifts</span>
 {employeeUnclosedRecords.length > 0 && (
 <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-600 text-white">
 {employeeUnclosedRecords.length}
 </span>
 )}
 </button>

 <button
 onClick={() => setActiveTab("my-requests")}
 className={`py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
 activeTab === "my-requests"
 ? "border-blue-600 text-blue-600 font-bold"
 : "border-transparent text-slate-600 hover:text-slate-900 "
 }`}
 >
 <History className="w-4 h-4 shrink-0" />
 <span>My Submitted Requests</span>
 {myRequests.length > 0 && (
 <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200 ">
 {myRequests.length}
 </span>
 )}
 </button>
 </>
 )}
 </div>

 {/* Main Tab Content Body with Smooth Scrolling */}
 <div className={`p-3 sm:p-5 md:p-6 space-y-4 md:space-y-6 ${isModal ? "flex-1 overflow-y-auto" : ""}`}>

 {/* =========================================================================
 ADMIN TAB 1: STAFF CORRECTION REQUESTS
 ========================================================================= */}
 {isAdmin && activeTab === "requests" && (
 <div className="space-y-4">
 {/* Filter / Search Responsive Toolbar */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search staff, date, reason..."
 className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 "
 />
 </div>

 {/* Status Filter Segmented Control */}
 <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
 {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((st) => (
 <button
 key={st}
 onClick={() => setStatusFilter(st)}
 className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap min-h-[36px] cursor-pointer ${
 statusFilter === st
 ? "bg-slate-900 text-white shadow-xs"
 : "bg-slate-100 text-slate-600 hover:bg-slate-200 "
 }`}
 >
 {st === "ALL" ? "All" : st.charAt(0) + st.slice(1).toLowerCase()}
 </button>
 ))}
 </div>
 </div>

 {/* Admin Review / Action Panel */}
 {selectedCorrectionForReview && (
 <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm space-y-3.5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-blue-600 " />
 <h4 className="text-xs sm:text-sm font-bold text-slate-900 uppercase tracking-wider">
 {reviewActionType === "approve" ? "Review & Approve Checkout Request" : "Reject Attendance Request"}
 </h4>
 </div>
 <button
 onClick={() => { setSelectedCorrectionForReview(null); setReviewActionType(null); }}
 className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Details Summary Card */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
 <div>
 <span className="text-slate-400 block text-[10px] uppercase font-semibold">Staff Member</span>
 <span className="font-bold text-slate-900 text-xs sm:text-sm">
 {selectedCorrectionForReview.full_name || `User #${selectedCorrectionForReview.user_id || (selectedCorrectionForReview as any).employee_id}`}
 </span>
 {selectedCorrectionForReview.phone_number && (
 <span className="block text-[11px] text-slate-500 font-mono">{selectedCorrectionForReview.phone_number}</span>
 )}
 </div>
 <div>
 <span className="text-slate-400 block text-[10px] uppercase font-semibold">Shift Details</span>
 <span className="font-semibold text-slate-700 ">
 {selectedCorrectionForReview.date} • {selectedCorrectionForReview.session}
 </span>
 <span className="block text-[11px] text-slate-500">
 In: <strong className="font-mono">{selectedCorrectionForReview.original_check_in || selectedCorrectionForReview.requested_check_in || "N/A"}</strong>
 </span>
 </div>
 <div>
 <span className="text-slate-400 block text-[10px] uppercase font-semibold">Staff Reason</span>
 <span className="text-slate-700 italic block line-clamp-2">
 "{selectedCorrectionForReview.reason}"
 </span>
 </div>
 </div>

 {reviewActionType === "approve" ? (
 <form onSubmit={handleAdminApproveRequest} className="space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Approved Check-Out Time <span className="text-rose-500">*</span>
 </label>
 <input
 type="text"
 required
 value={approvedCheckOutTime}
 onChange={(e) => setApprovedCheckOutTime(e.target.value)}
 placeholder="17:30:00"
 className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
 />
 {/* Quick Presets for Session */}
 <div className="flex gap-1.5 mt-2 flex-wrap">
 {selectedCorrectionForReview.session === "Morning" ? (
 <>
 <button
 type="button"
 onClick={() => setApprovedCheckOutTime("06:30:00")}
 className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition cursor-pointer"
 >
 06:30 (12:30 PM - Morning End)
 </button>
 <button
 type="button"
 onClick={() => setApprovedCheckOutTime("07:00:00")}
 className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition cursor-pointer"
 >
 07:00 (+30m)
 </button>
 </>
 ) : (
 <>
 <button
 type="button"
 onClick={() => setApprovedCheckOutTime("11:30:00")}
 className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition cursor-pointer"
 >
 11:30 (05:30 PM - Afternoon End)
 </button>
 <button
 type="button"
 onClick={() => setApprovedCheckOutTime("12:00:00")}
 className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition cursor-pointer"
 >
 12:00 (06:00 PM)
 </button>
 <button
 type="button"
 onClick={() => setApprovedCheckOutTime("13:00:00")}
 className="px-2 py-1 text-[11px] bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 transition cursor-pointer"
 >
 13:00 (+1.5h OT)
 </button>
 </>
 )}
 </div>
 </div>

 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Verification / Audit Notes (Optional)
 </label>
 <input
 type="text"
 value={adminReviewNotes}
 onChange={(e) => setAdminReviewNotes(e.target.value)}
 placeholder="e.g. Verified with Site Supervisor. Shift complete."
 className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
 />
 </div>
 </div>

 <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={() => setSelectedCorrectionForReview(null)}
 className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-center"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isReviewingAction}
 className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 transition cursor-pointer"
 >
 {isReviewingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
 <span>Approve & Release Lock</span>
 </button>
 </div>
 </form>
 ) : (
 <form onSubmit={handleAdminRejectRequest} className="space-y-3">
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Mandatory Rejection Justification <span className="text-rose-500">*</span>
 </label>
 <textarea
 rows={2}
 required
 value={rejectionReasonInput}
 onChange={(e) => setRejectionReasonInput(e.target.value)}
 placeholder="e.g. Staff was absent during second half of shift or failed to provide verification."
 className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-rose-500"
 />
 </div>

 <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
 <button
 type="button"
 onClick={() => setSelectedCorrectionForReview(null)}
 className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-center"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={isReviewingAction}
 className="px-5 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 transition cursor-pointer"
 >
 {isReviewingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
 <span>Confirm Rejection</span>
 </button>
 </div>
 </form>
 )}
 </div>
 )}

 {/* Staff Requests List (Touch-Friendly Responsive Cards) */}
 {filteredCorrections.length === 0 ? (
 <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 ">
 <FileCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
 <p className="text-xs font-medium text-slate-600 ">
 No attendance correction requests found matching your filter.
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {filteredCorrections.map((corr) => (
 <div
 key={corr.id}
 className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
 >
 <div className="space-y-2 flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-bold text-sm text-slate-900 truncate">
 {corr.full_name || `User #${corr.user_id || (corr as any).employee_id}`}
 </span>
 {corr.role && (
 <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600 ">
 {corr.role}
 </span>
 )}
 <span
 className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
 corr.status === "PENDING"
 ? "bg-amber-50 text-amber-800 border border-amber-200 "
 : corr.status === "APPROVED"
 ? "bg-emerald-50 text-emerald-800 border border-emerald-200 "
 : "bg-rose-50 text-rose-800 border border-rose-200 "
 }`}
 >
 {corr.status}
 </span>
 {corr.reason_code && (
 <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-700 border border-slate-200 ">
 {corr.reason_code}
 </span>
 )}
 </div>

 {/* Timestamps & Session Details */}
 <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 text-xs text-slate-500 ">
 <span>📅 <strong>{corr.date}</strong> ({corr.session})</span>
 <span>⏰ In: <strong className="font-mono text-slate-700 ">{corr.original_check_in || corr.requested_check_in || "N/A"}</strong></span>
 <span>🚪 Req Out: <strong className="font-mono text-slate-900 font-semibold">{corr.requested_check_out}</strong></span>
 {corr.status === "APPROVED" && corr.approved_check_out && (
 <span>✅ Approved: <strong className="font-mono text-emerald-700 font-semibold">{corr.approved_check_out}</strong></span>
 )}
 </div>

 <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 ">
 <span className="font-semibold text-slate-500 ">Explanation:</span> "{corr.reason}"
 </p>

 {corr.status === "REJECTED" && corr.rejection_reason && (
 <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 ">
 <span className="font-semibold">Rejection Reason:</span> "{corr.rejection_reason}"
 </p>
 )}
 </div>

 {/* Actions for Pending Requests */}
 {corr.status === "PENDING" && (
 <div className="flex items-center gap-2 pt-2 md:pt-0 shrink-0 w-full sm:w-auto">
 <button
 onClick={() => handleSelectCorrectionForReview(corr, "reject")}
 className="flex-1 sm:flex-none px-3.5 py-2.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
 >
 <ThumbsDown className="w-3.5 h-3.5" />
 <span>Reject</span>
 </button>
 <button
 onClick={() => handleSelectCorrectionForReview(corr, "approve")}
 className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
 >
 <Check className="w-3.5 h-3.5" />
 <span>Review & Approve</span>
 </button>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {/* =========================================================================
 ADMIN TAB 2: UNCLOSED SHIFTS (DIRECT ADMINISTRATIVE RESOLUTION)
 ========================================================================= */}
 {isAdmin && activeTab === "unclosed" && (
 <div className="space-y-4">
 <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
 <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
 <span>
 Directly adjust or enter check-out times for staff members who forgot to scan out on past shifts. Submitting immediately unlocks their attendance check-in.
 </span>
 </div>

 {/* Mobile View Toggle Bar when record selected */}
 <div className="flex lg:hidden items-center justify-between pb-1">
 {selectedUnclosedRecord ? (
 <button
 onClick={() => setMobileDetailView("list")}
 className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 cursor-pointer"
 >
 <ArrowLeft className="w-3.5 h-3.5" />
 <span>Back to Unclosed Shifts List</span>
 </button>
 ) : (
 <span className="text-xs font-semibold text-slate-500">
 Showing {filteredUnclosed.length} Unclosed Shift{filteredUnclosed.length === 1 ? "" : "s"}
 </span>
 )}

 {selectedUnclosedRecord && (
 <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
 <button
 onClick={() => setMobileDetailView("list")}
 className={`px-2.5 py-1 rounded-md font-semibold ${mobileDetailView === "list" ? "bg-white shadow-xs text-slate-900 " : "text-slate-500"}`}
 >
 List ({filteredUnclosed.length})
 </button>
 <button
 onClick={() => setMobileDetailView("detail")}
 className={`px-2.5 py-1 rounded-md font-semibold ${mobileDetailView === "detail" ? "bg-white shadow-xs text-slate-900 " : "text-slate-500"}`}
 >
 Edit Form
 </button>
 </div>
 )}
 </div>

 {/* Two-Pane Responsive Layout */}
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
 
 {/* Left Column: List of Records */}
 <div className={`lg:col-span-6 space-y-3 ${mobileDetailView === "detail" && selectedUnclosedRecord ? "hidden lg:block" : "block"}`}>
 <div className="relative">
 <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search unclosed shifts..."
 className="w-full pl-9 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
 />
 </div>

 {filteredUnclosed.length === 0 ? (
 <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 ">
 <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
 <p className="text-xs text-slate-500 ">
 No unclosed shifts found. All past attendance records are closed!
 </p>
 </div>
 ) : (
 <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
 {filteredUnclosed.map((rec) => {
 const isSelected = selectedUnclosedRecord?.id === rec.id;
 return (
 <div
 key={rec.id}
 onClick={() => handleSelectUnclosedRecord(rec)}
 className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
 isSelected
 ? "bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500/20"
 : "bg-white border-slate-200 hover:border-slate-300 "
 }`}
 >
 <div className="flex items-center justify-between mb-1.5">
 <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
 {rec.full_name || `Staff #${rec.user_id}`}
 </span>
 <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
 Missing Checkout
 </span>
 </div>
 <div className="flex items-center gap-3 text-xs text-slate-500 ">
 <span>📅 {rec.date} ({rec.session})</span>
 <span>⏰ In: <strong className="font-mono text-slate-700 ">{rec.check_in_time || "N/A"}</strong></span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 {/* Right Column: Direct Override Form */}
 <div className={`lg:col-span-6 ${mobileDetailView === "list" && !selectedUnclosedRecord ? "hidden lg:block" : "block"}`}>
 {selectedUnclosedRecord ? (
 <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
 <div className="flex items-center justify-between border-b border-slate-100 pb-3">
 <div>
 <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
 <Unlock className="w-4 h-4 text-blue-600 " />
 <span>Direct Checkout Override & Unlock</span>
 </h4>
 <p className="text-xs text-slate-500 mt-0.5">
 Resolving shift for <strong>{selectedUnclosedRecord.full_name}</strong> on {selectedUnclosedRecord.date}.
 </p>
 </div>
 <button
 onClick={() => { setSelectedUnclosedRecord(null); setMobileDetailView("list"); }}
 className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <form onSubmit={handleDirectSubmit} className="space-y-4">
 {/* Responsive Inputs: Stack on phones, 2 columns on tablets/desktop */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Check-In Time
 </label>
 <input
 type="text"
 value={directCheckInTime}
 onChange={(e) => setDirectCheckInTime(e.target.value)}
 placeholder="02:30:00"
 className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
 />
 </div>

 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Approved Check-Out Time <span className="text-rose-500">*</span>
 </label>
 <input
 type="text"
 required
 value={directCheckOutTime}
 onChange={(e) => setDirectCheckOutTime(e.target.value)}
 placeholder="11:30:00"
 className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
 />
 </div>
 </div>

 {/* Quick Presets for Ethiopian & Gregorian End-of-Shift */}
 <div>
 <span className="text-[10px] text-slate-400 font-semibold block mb-1.5 uppercase">
 Standard Presets:
 </span>
 <div className="flex items-center gap-1.5 flex-wrap">
 {selectedUnclosedRecord.session === "Morning" ? (
 <>
 <button
 type="button"
 onClick={() => setDirectCheckOutTime("06:00:00")}
 className="px-2.5 py-1.5 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
 >
 06:00 (Morning End)
 </button>
 <button
 type="button"
 onClick={() => setDirectCheckOutTime("07:00:00")}
 className="px-2.5 py-1.5 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
 >
 07:00 (Extended)
 </button>
 </>
 ) : (
 <>
 <button
 type="button"
 onClick={() => setDirectCheckOutTime("11:00:00")}
 className="px-2.5 py-1.5 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
 >
 11:00 (Afternoon End)
 </button>
 <button
 type="button"
 onClick={() => setDirectCheckOutTime("11:30:00")}
 className="px-2.5 py-1.5 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
 >
 11:30 (Extended)
 </button>
 <button
 type="button"
 onClick={() => setDirectCheckOutTime("12:00:00")}
 className="px-2.5 py-1.5 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
 >
 12:00 (Evening Cutoff)
 </button>
 <button
 type="button"
 onClick={() => setDirectCheckOutTime("13:00:00")}
 className="px-2.5 py-1.5 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
 >
 13:00 (07:00 PM - +1.5h Overtime)
 </button>
 </>
 )}
 </div>
 </div>

 {/* Worked Hours Calculation Preview */}
 <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
 <div>
 <span className="text-[10px] uppercase font-semibold text-slate-400 block">
 Calculated Hours for Shift
 </span>
 <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
 {computeDirectCalculatedHours()} hrs
 </span>
 </div>
 {selectedUnclosedRecord.hourly_rate && (
 <div className="text-right">
 <span className="text-[10px] uppercase font-semibold text-slate-400 block">
 Rate: {selectedUnclosedRecord.hourly_rate} ETB/hr
 </span>
 <span className="text-xs sm:text-sm font-bold text-emerald-600 font-mono">
 ≈ {(Math.round((computeDirectCalculatedHours() * selectedUnclosedRecord.hourly_rate + Number.EPSILON) * 100) / 100).toFixed(2)} ETB
 </span>
 </div>
 )}
 </div>

 {/* Status Selection */}
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Attendance Status
 </label>
 <select
 value={directStatus}
 onChange={(e) => setDirectStatus(e.target.value as any)}
 className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
 >
 <option value="Present">Present (Full Day / Completed)</option>
 <option value="Late">Late (Mark as late arrival)</option>
 <option value="Authorized">Authorized Departure</option>
 <option value="Permission">Permission Shift</option>
 </select>
 </div>

 {/* Audit Justification */}
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Administrative Audit Reason <span className="text-rose-500">*</span>
 </label>
 <textarea
 rows={2}
 required
 value={directReason}
 onChange={(e) => setDirectReason(e.target.value)}
 placeholder="e.g. Employee departed at 17:30 as verified by Site Supervisor logbook."
 className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
 />
 </div>

 <button
 type="submit"
 disabled={isSubmittingDirect}
 className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 min-h-[44px] cursor-pointer"
 >
 {isSubmittingDirect ? (
 <>
 <RefreshCw className="w-3.5 h-3.5 animate-spin" />
 <span>Processing Correction...</span>
 </>
 ) : (
 <>
 <Check className="w-4 h-4" />
 <span>Approve & Unlock Employee Attendance</span>
 </>
 )}
 </button>
 </form>
 </div>
 ) : (
 <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 ">
 <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
 <h4 className="text-xs font-bold text-slate-700 ">
 Select an Unclosed Shift
 </h4>
 <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
 Click any unclosed session in the list to review details, set departure time, and unlock check-in.
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* =========================================================================
 ADMIN TAB 3: PAYROLL PRE-FLIGHT CHECK
 ========================================================================= */}
 {isAdmin && activeTab === "payroll" && (
 <div className="space-y-5">
 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
 <div>
 <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
 <DollarSign className="w-4 h-4 text-emerald-600 " />
 <span>Payroll Pre-Flight Attendance Integrity Validation</span>
 </h3>
 <p className="text-xs text-slate-500 mt-0.5">
 Pre-screens records to ensure unclosed shifts don't cause salary discrepancies.
 </p>
 </div>

 <div className="flex items-center gap-2 flex-wrap">
 <select
 value={preflightMonth}
 onChange={(e) => setPreflightMonth(Number(e.target.value))}
 className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 min-h-[38px] focus:ring-2 focus:ring-blue-500"
 >
 {[
 "January", "February", "March", "April", "May", "June",
 "July", "August", "September", "October", "November", "December"
 ].map((m, idx) => (
 <option key={m} value={idx + 1}>{m}</option>
 ))}
 </select>

 <select
 value={preflightYear}
 onChange={(e) => setPreflightYear(Number(e.target.value))}
 className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 min-h-[38px] focus:ring-2 focus:ring-blue-500"
 >
 {[2024, 2025, 2026, 2027].map((y) => (
 <option key={y} value={y}>{y}</option>
 ))}
 </select>

 <button
 onClick={handleRunPayrollPreflight}
 disabled={isLoadingPreflight}
 className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
 >
 <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreflight ? "animate-spin" : ""}`} />
 <span>Run Diagnostic</span>
 </button>
 </div>
 </div>

 {/* Diagnostic Result Banner */}
 {payrollPreflight && (
 <div
 className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start gap-4 ${
 payrollPreflight.canProcessPayroll
 ? "bg-emerald-50/80 border-emerald-200 text-emerald-900 "
 : "bg-rose-50/80 border-rose-200 text-rose-900 "
 }`}
 >
 <div
 className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
 payrollPreflight.canProcessPayroll ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
 }`}
 >
 {payrollPreflight.canProcessPayroll ? (
 <CheckCircle2 className="w-5 h-5" />
 ) : (
 <AlertOctagon className="w-5 h-5" />
 )}
 </div>
 <div className="flex-1 space-y-1">
 <div className="flex items-center gap-2 flex-wrap">
 <h4 className="text-sm sm:text-base font-bold text-slate-900 ">
 {payrollPreflight.canProcessPayroll
 ? "Payroll Integrity Verified - Ready for Disbursement"
 : "Payroll Processing Blocked - Action Required"}
 </h4>
 <span
 className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md ${
 payrollPreflight.canProcessPayroll
 ? "bg-emerald-600 text-white"
 : "bg-rose-600 text-white"
 }`}
 >
 {payrollPreflight.canProcessPayroll ? "VALIDATED" : "BLOCKED"}
 </span>
 </div>
 <p className="text-xs text-slate-600 leading-relaxed">
 {payrollPreflight.canProcessPayroll
 ? `All evaluated staff attendance records (${payrollPreflight.totalEmployeesEvaluated} employees) have verified checkout timestamps and clean work hours.`
 : `Found ${payrollPreflight.blockingIssuesCount} unresolved attendance anomaly(s) across the organization.`}
 </p>
 </div>
 </div>
 )}

 {/* Metrics Grid */}
 {payrollPreflight && (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
 <span className="text-[10px] uppercase font-semibold text-slate-400 block">
 Evaluated Employees
 </span>
 <span className="text-lg sm:text-xl font-bold text-slate-900 font-mono">
 {payrollPreflight.totalEmployeesEvaluated}
 </span>
 </div>

 <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
 <span className="text-[10px] uppercase font-semibold text-slate-400 block">
 Blocking Anomalies
 </span>
 <span
 className={`text-lg sm:text-xl font-bold font-mono ${
 payrollPreflight.blockingIssuesCount > 0
 ? "text-rose-600 "
 : "text-emerald-600 "
 }`}
 >
 {payrollPreflight.blockingIssuesCount}
 </span>
 </div>

 <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
 <span className="text-[10px] uppercase font-semibold text-slate-400 block">
 Unclosed Checkouts
 </span>
 <span
 className={`text-lg sm:text-xl font-bold font-mono ${
 payrollPreflight.missingCheckoutsCount > 0
 ? "text-amber-700 "
 : "text-slate-900 "
 }`}
 >
 {payrollPreflight.missingCheckoutsCount}
 </span>
 </div>

 <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
 <span className="text-[10px] uppercase font-semibold text-slate-400 block">
 Pending Requests
 </span>
 <span
 className={`text-lg sm:text-xl font-bold font-mono ${
 payrollPreflight.pendingCorrectionsCount > 0
 ? "text-blue-600 "
 : "text-slate-900 "
 }`}
 >
 {payrollPreflight.pendingCorrectionsCount}
 </span>
 </div>
 </div>
 )}

 {/* Blocking Items List with 1-Click Resolve */}
 {payrollPreflight && !payrollPreflight.canProcessPayroll && (
 <div className="space-y-3">
 <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
 Records Blocking Payroll
 </h4>

 {payrollPreflight.missingCheckouts && payrollPreflight.missingCheckouts.length > 0 && (
 <div className="space-y-2">
 <span className="text-[11px] font-semibold text-amber-800 block">
 Unclosed Shifts:
 </span>
 {payrollPreflight.missingCheckouts.map((rec) => (
 <div
 key={rec.id}
 className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
 >
 <div className="text-xs">
 <span className="font-bold text-slate-900 ">
 {rec.full_name || `Staff #${rec.user_id}`}
 </span>
 <span className="text-slate-500 ml-2">
 • {rec.date} ({rec.session}) • In: {rec.check_in_time || "N/A"}
 </span>
 </div>
 <button
 onClick={() => {
 setActiveTab("unclosed");
 handleSelectUnclosedRecord(rec);
 }}
 className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg transition flex items-center justify-center gap-1 min-h-[36px] cursor-pointer"
 >
 <span>Resolve Record</span>
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 )}

 {payrollPreflight.pendingCorrections && payrollPreflight.pendingCorrections.length > 0 && (
 <div className="space-y-2 pt-2">
 <span className="text-[11px] font-semibold text-blue-800 block">
 Pending Staff Requests:
 </span>
 {payrollPreflight.pendingCorrections.map((corr) => (
 <div
 key={corr.id}
 className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
 >
 <div className="text-xs">
 <span className="font-bold text-slate-900 ">
 {corr.full_name || `Staff #${corr.user_id || (corr as any).employee_id}`}
 </span>
 <span className="text-slate-500 ml-2">
 • {corr.date} ({corr.session}) • Req: {corr.requested_check_out}
 </span>
 </div>
 <button
 onClick={() => {
 setActiveTab("requests");
 handleSelectCorrectionForReview(corr, "approve");
 }}
 className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center justify-center gap-1 min-h-[36px] cursor-pointer"
 >
 <span>Review & Approve</span>
 <ArrowRight className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>
 )}

 {/* =========================================================================
 ADMIN TAB 4: AUDIT TRAIL (DUAL CARD/TABLE RESPONSIVE VIEW)
 ========================================================================= */}
 {isAdmin && activeTab === "audit" && (
 <div className="space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div>
 <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
 <Shield className="w-4 h-4 text-blue-600 " />
 <span>Tamper-Proof Attendance Audit Trail</span>
 </h3>
 <p className="text-xs text-slate-500 ">
 Immutable record of checkout detections, approvals, adjustments, and rejections.
 </p>
 </div>

 {/* View Switcher for Mobile & Desktop */}
 <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto">
 <button
 onClick={() => setAuditViewMode("cards")}
 className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 cursor-pointer ${auditViewMode === "cards" ? "bg-white shadow-xs text-slate-900 " : "text-slate-500"}`}
 >
 <LayoutGrid className="w-3.5 h-3.5" />
 <span>Cards</span>
 </button>
 <button
 onClick={() => setAuditViewMode("table")}
 className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 cursor-pointer ${auditViewMode === "table" ? "bg-white shadow-xs text-slate-900 " : "text-slate-500"}`}
 >
 <List className="w-3.5 h-3.5" />
 <span>Table</span>
 </button>
 </div>
 </div>

 {attendanceAuditLogs.length === 0 ? (
 <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 ">
 <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
 <p className="text-xs text-slate-500 ">
 No attendance audit records recorded yet.
 </p>
 </div>
 ) : auditViewMode === "cards" ? (
 /* Mobile & Responsive Card Feed */
 <div className="space-y-2.5">
 {attendanceAuditLogs.map((log) => (
 <div
 key={log.id}
 className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2"
 >
 <div className="flex items-center justify-between gap-2 flex-wrap">
 <div className="flex items-center gap-2">
 <span
 className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
 log.action.includes("APPROVED") || log.action.includes("CORRECTED")
 ? "bg-emerald-50 text-emerald-800 border border-emerald-200 "
 : log.action.includes("REJECTED")
 ? "bg-rose-50 text-rose-800 border border-rose-200 "
 : "bg-amber-50 text-amber-800 border border-amber-200 "
 }`}
 >
 {log.action.replace("ATTENDANCE_", "")}
 </span>
 <span className="font-semibold text-xs text-slate-900 ">
 {log.actor_name || "System"} {log.actor_role && `(${log.actor_role})`}
 </span>
 </div>
 <span className="text-[11px] font-mono text-slate-400">
 {log.created_at}
 </span>
 </div>

 <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 ">
 {log.details}
 </p>

 <div className="text-[10px] font-mono text-slate-400">
 IP: {log.ip_address || "127.0.0.1"}
 </div>
 </div>
 ))}
 </div>
 ) : (
 /* Scrollable High-Density Table */
 <div className="border border-slate-200 rounded-xl overflow-x-auto">
 <table className="w-full text-left text-xs min-w-[640px]">
 <thead className="bg-slate-50 sticky top-0 text-slate-700 font-semibold border-b border-slate-200 ">
 <tr>
 <th className="py-2.5 px-4">Timestamp</th>
 <th className="py-2.5 px-4">Action</th>
 <th className="py-2.5 px-4">Actor</th>
 <th className="py-2.5 px-4">Details & Justification</th>
 <th className="py-2.5 px-4">IP</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100 ">
 {attendanceAuditLogs.map((log) => (
 <tr key={log.id} className="hover:bg-slate-50/70 ">
 <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
 {log.created_at}
 </td>
 <td className="py-2.5 px-4 whitespace-nowrap">
 <span
 className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
 log.action.includes("APPROVED") || log.action.includes("CORRECTED")
 ? "bg-emerald-50 text-emerald-800 border border-emerald-200 "
 : log.action.includes("REJECTED")
 ? "bg-rose-50 text-rose-800 border border-rose-200 "
 : "bg-amber-50 text-amber-800 border border-amber-200 "
 }`}
 >
 {log.action.replace("ATTENDANCE_", "")}
 </span>
 </td>
 <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
 {log.actor_name || "System"} {log.actor_role && `(${log.actor_role})`}
 </td>
 <td className="py-2.5 px-4 text-slate-700 max-w-xs sm:max-w-md truncate">
 {log.details}
 </td>
 <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">
 {log.ip_address || "127.0.0.1"}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}

 {/* =========================================================================
 EMPLOYEE TAB 1: MY UNCLOSED SHIFTS & REQUEST SUBMISSION
 ========================================================================= */}
 {!isAdmin && activeTab === "my-unclosed" && (
 <div className="space-y-5">
 {employeeUnclosedRecords.length > 0 ? (
 <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
 <Lock className="w-5 h-5" />
 </div>
 <div>
 <h4 className="text-sm font-bold text-rose-800 ">
 Attendance Check-In Locked
 </h4>
 <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
 You have an unclosed shift from a previous session. To maintain payroll integrity and accurate hours, you cannot check in for subsequent shifts until your departure time is submitted and confirmed.
 </p>
 </div>
 </div>
 ) : (
 <div className="p-8 text-center bg-emerald-50/80 border border-emerald-200 rounded-2xl">
 <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
 <h4 className="text-sm font-bold text-emerald-900 ">
 All Shifts Fully Closed
 </h4>
 <p className="text-xs text-slate-600 mt-1">
 You have no unclosed attendance records. Your check-in is active for your scheduled shifts.
 </p>
 </div>
 )}

 {employeeUnclosedRecords.length > 0 && (
 <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
 {/* Left: Unclosed Records Selection */}
 <div className={`md:col-span-5 space-y-2.5 ${mobileDetailView === "detail" && selectedMyUnclosedRecord ? "hidden md:block" : "block"}`}>
 <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
 Select Unclosed Shift:
 </span>

 {employeeUnclosedRecords.map((rec) => {
 const isSelected = selectedMyUnclosedRecord?.id === rec.id;
 return (
 <div
 key={rec.id}
 onClick={() => handleSelectMyUnclosedRecord(rec)}
 className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
 isSelected
 ? "bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500/20"
 : "bg-white border-slate-200 hover:border-slate-300 "
 }`}
 >
 <div className="flex items-center justify-between mb-1">
 <span className="font-bold text-xs sm:text-sm text-slate-900 ">
 📅 {rec.date} ({rec.session})
 </span>
 <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-600 text-white">
 Unclosed
 </span>
 </div>
 <p className="text-xs text-slate-500 ">
 Check-In: <strong className="font-mono text-slate-700 ">{rec.check_in_time || "N/A"}</strong>
 </p>
 </div>
 );
 })}
 </div>

 {/* Right: Request Submission Form */}
 <div className={`md:col-span-7 ${mobileDetailView === "list" && !selectedMyUnclosedRecord ? "hidden md:block" : "block"}`}>
 {selectedMyUnclosedRecord ? (
 <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
 <div className="flex items-center justify-between border-b border-slate-100 pb-3">
 <div>
 <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
 <Send className="w-4 h-4 text-blue-600 " />
 <span>Request Checkout Correction</span>
 </h4>
 <p className="text-xs text-slate-500 mt-0.5">
 Shift on <strong>{selectedMyUnclosedRecord.date}</strong> ({selectedMyUnclosedRecord.session} session).
 </p>
 </div>
 <button
 onClick={() => { setSelectedMyUnclosedRecord(null); setMobileDetailView("list"); }}
 className="md:hidden text-blue-600 font-semibold text-xs bg-blue-50 px-2.5 py-1 rounded-lg"
 >
 Change Shift
 </button>
 </div>

 <form onSubmit={handleEmpRequestSubmit} className="space-y-4">
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Your Actual Departure Time <span className="text-rose-500">*</span>
 </label>
 <input
 type="text"
 required
 value={empRequestedCheckOut}
 onChange={(e) => setEmpRequestedCheckOut(e.target.value)}
 placeholder="11:30:00"
 className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
 />
 {/* Presets */}
 <div className="flex items-center gap-1.5 mt-2 flex-wrap">
 <span className="text-[10px] text-slate-400 font-semibold uppercase">Presets:</span>
 {selectedMyUnclosedRecord.session === "Morning" ? (
 <>
 <button
 type="button"
 onClick={() => setEmpRequestedCheckOut("06:00:00")}
 className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 cursor-pointer"
 >
 06:00 (Morning End)
 </button>
 <button
 type="button"
 onClick={() => setEmpRequestedCheckOut("07:00:00")}
 className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 cursor-pointer"
 >
 07:00 (Extended)
 </button>
 </>
 ) : (
 <>
 <button
 type="button"
 onClick={() => setEmpRequestedCheckOut("11:00:00")}
 className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 cursor-pointer"
 >
 11:00 (Afternoon End)
 </button>
 <button
 type="button"
 onClick={() => setEmpRequestedCheckOut("11:30:00")}
 className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 cursor-pointer"
 >
 11:30 (Extended)
 </button>
 <button
 type="button"
 onClick={() => setEmpRequestedCheckOut("13:00:00")}
 className="px-2 py-1 text-[11px] font-medium bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 cursor-pointer"
 >
 13:00 (07:00 PM)
 </button>
 </>
 )}
 </div>
 </div>

 {/* Reason Category */}
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Reason Category
 </label>
 <select
 value={empReasonCode}
 onChange={(e) => setEmpReasonCode(e.target.value)}
 className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
 >
 <option value="FORGOT_CHECKOUT">Forgot to scan departure QR code</option>
 <option value="BATTERY_DEPLETED">Phone battery died / phone turned off</option>
 <option value="POWER_NETWORK_OUTAGE">Power or internet outage at work site</option>
 <option value="FIELD_DUTY">Dispatched to external work site or client meeting</option>
 <option value="SYSTEM_GLITCH">Camera or GPS scanner malfunction</option>
 <option value="OTHER">Other operational justification</option>
 </select>
 </div>

 {/* Reason Explanation */}
 <div>
 <label className="block text-[11px] font-semibold text-slate-700 mb-1">
 Detailed Explanation for Administrator <span className="text-rose-500">*</span>
 </label>
 <textarea
 rows={2}
 required
 value={empReasonText}
 onChange={(e) => setEmpReasonText(e.target.value)}
 placeholder="e.g. Completed regular tasks and departed at 5:30 PM, but phone battery depleted."
 className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-blue-500"
 />
 </div>

 {/* Projected Hours */}
 <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
 <span className="text-xs text-slate-600 ">
 Estimated Worked Hours:
 </span>
 <span className="text-sm font-bold text-slate-900 font-mono">
 {computeEmpCalculatedHours()} hrs
 </span>
 </div>

 <button
 type="submit"
 disabled={isSubmittingEmpRequest}
 className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 min-h-[44px] cursor-pointer"
 >
 {isSubmittingEmpRequest ? (
 <>
 <RefreshCw className="w-3.5 h-3.5 animate-spin" />
 <span>Submitting Request...</span>
 </>
 ) : (
 <>
 <Send className="w-4 h-4" />
 <span>Submit Request to Administrator</span>
 </>
 )}
 </button>
 </form>
 </div>
 ) : (
 <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 ">
 <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
 <h4 className="text-xs font-bold text-slate-700 ">
 Select an unclosed shift on the left
 </h4>
 <p className="text-[11px] text-slate-500 mt-1">
 Provide departure time to send a request to your supervisor or HR.
 </p>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 )}

 {/* =========================================================================
 EMPLOYEE TAB 2: MY SUBMITTED REQUESTS
 ========================================================================= */}
 {!isAdmin && activeTab === "my-requests" && (
 <div className="space-y-4">
 <div>
 <h3 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
 <History className="w-4 h-4 text-blue-600 " />
 <span>My Correction Request History</span>
 </h3>
 <p className="text-xs text-slate-500 ">
 Track administrative review and approval of your submitted departure times.
 </p>
 </div>

 {myRequests.length === 0 ? (
 <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 ">
 <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
 <p className="text-xs text-slate-600 ">
 You have not submitted any checkout correction requests yet.
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {myRequests.map((req) => (
 <div
 key={req.id}
 className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2"
 >
 <div className="flex items-center justify-between flex-wrap gap-2">
 <div className="flex items-center gap-2">
 <span className="font-bold text-xs sm:text-sm text-slate-900 ">
 📅 Shift: {req.date} ({req.session})
 </span>
 <span
 className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
 req.status === "PENDING"
 ? "bg-amber-50 text-amber-800 border border-amber-200 "
 : req.status === "APPROVED"
 ? "bg-emerald-50 text-emerald-800 border border-emerald-200 "
 : "bg-rose-50 text-rose-800 border border-rose-200 "
 }`}
 >
 {req.status === "PENDING" ? "Under Review" : req.status}
 </span>
 </div>
 <span className="text-[11px] font-mono text-slate-400">
 {req.created_at || req.requested_at || "Recent"}
 </span>
 </div>

 <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
 <span>
 Requested Departure: <strong className="font-mono text-slate-900 ">{req.requested_check_out}</strong>
 </span>
 {req.status === "APPROVED" && req.approved_check_out && (
 <span>
 Approved Time: <strong className="font-mono text-emerald-700 font-semibold">{req.approved_check_out}</strong>
 </span>
 )}
 {req.reviewer_name && (
 <span>Reviewed By: <strong>{req.reviewer_name}</strong></span>
 )}
 </div>

 <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 ">
 <span className="font-semibold text-slate-500 ">Your Note:</span> "{req.reason}"
 </p>

 {req.status === "REJECTED" && req.rejection_reason && (
 <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 ">
 <span className="font-semibold">Rejection Justification:</span> "{req.rejection_reason}"
 </p>
 )}
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>

 {/* Footer for Modal Mode */}
 {isModal && (
 <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 rounded-b-2xl">
 <div className="flex items-center gap-2 text-xs text-slate-500 ">
 <Shield className="w-4 h-4 text-blue-600 shrink-0" />
 <span className="truncate max-w-[200px] sm:max-w-none">
 Ethiopian Timezone Synchronization • Apex Attendance Security
 </span>
 </div>
 <button
 onClick={onClose}
 className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer min-h-[36px]"
 >
 Close
 </button>
 </div>
 )}
 </div>
 );

 if (isModal) {
 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
 <div className="relative w-full max-w-5xl my-auto">
 {content}
 </div>
 </div>
 );
 }

 return content;
};
