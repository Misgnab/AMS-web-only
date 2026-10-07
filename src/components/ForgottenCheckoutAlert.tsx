import React from "react";
import { AlertTriangle, Clock, LogOut, ArrowRight, Lock, CheckCircle2, FileCheck } from "lucide-react";
import { useAppStore } from "../store.js";

interface ForgottenCheckoutAlertProps {
  onOpenCheckOut: () => void;
  onOpenMissingModal: (tab?: "requests" | "unclosed" | "payroll" | "audit" | "my-unclosed" | "my-requests") => void;
}

export const ForgottenCheckoutAlert: React.FC<ForgottenCheckoutAlertProps> = ({
  onOpenCheckOut,
  onOpenMissingModal
}) => {
  const { user, attendanceStatus, missingCheckouts, attendanceCorrections } = useAppStore();
  const isAdmin = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "HR"].includes(user?.role || "");

  const pendingRequestsCount = attendanceCorrections.filter(c => c.status === "PENDING").length;
  const unclosedCount = missingCheckouts.length;

  // If Admin, show admin pending queue banner if there are records or requests
  if (isAdmin && (unclosedCount > 0 || pendingRequestsCount > 0)) {
    return (
      <div 
        id="admin-missing-checkout-banner"
        className="mb-6 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Attendance Anomalies Requiring Action
              </h4>
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                Action Required
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-0.5 flex-wrap">
              {pendingRequestsCount > 0 && (
                <span className="font-semibold text-amber-800 dark:text-amber-300">
                  ⚡ {pendingRequestsCount} Staff Correction Request{pendingRequestsCount === 1 ? "" : "s"}
                </span>
              )}
              {unclosedCount > 0 && (
                <span>
                  ⏰ {unclosedCount} Unclosed Shift{unclosedCount === 1 ? "" : "s"}
                </span>
              )}
              <span className="text-[11px] text-slate-500">
                Staff check-ins remain paused until departure times are verified.
              </span>
            </div>
          </div>
        </div>

        <button
          id="admin-review-missing-checkouts-btn"
          onClick={() => onOpenMissingModal(pendingRequestsCount > 0 ? "requests" : "unclosed")}
          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
        >
          <FileCheck className="w-4 h-4" />
          <span>{pendingRequestsCount > 0 ? "Review Staff Requests" : "Resolve Unclosed Shifts"}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Employee Rules
  // Rule 2: Open Check-In from a Previous Day (Missing Checkout Lock)
  if (attendanceStatus?.hasMissingCheckout) {
    const missing = attendanceStatus.missingRecords[0];
    const pendingRequest = attendanceCorrections.find(
      c => (c.user_id === user?.id || (c as any).employee_id === user?.id) && c.status === "PENDING"
    );

    if (pendingRequest) {
      return (
        <div 
          id="employee-correction-pending-banner"
          className="mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/60 flex items-start justify-between gap-4 flex-wrap"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                  Correction Request Under Review
                </h4>
                <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                  Pending Admin Approval
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 max-w-xl">
                Your request to record departure time (<strong>{pendingRequest.requested_check_out}</strong>) for shift on <strong>{pendingRequest.date}</strong> has been submitted. Your attendance check-in lock will automatically release as soon as an administrator approves your request.
              </p>
            </div>
          </div>

          <button
            id="employee-view-pending-request-btn"
            onClick={() => onOpenMissingModal("my-requests")}
            className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
          >
            View Request Status
          </button>
        </div>
      );
    }

    return (
      <div 
        id="employee-missing-checkout-locked-alert"
        className="mb-6 p-4 rounded-2xl bg-rose-50/80 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/60 flex items-start justify-between gap-4 flex-wrap"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                Attendance Check-In Locked: Missing Check-Out
              </h4>
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-rose-600 text-white">
                Correction Required
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 max-w-xl">
              {missing?.session === "Morning" ? (
                <>
                  You checked in for today's <strong>Morning</strong> session at <strong>{missing?.check_in_time || "N/A"}</strong>, but did not record a check-out before the Morning window ended at <strong>06:30 (12:30 PM)</strong>. Check-in for the Afternoon session is strictly locked until your departure time is submitted and approved by an administrator.
                </>
              ) : missing?.session === "Afternoon" ? (
                <>
                  You checked in for the <strong>Afternoon</strong> session at <strong>{missing?.check_in_time || "N/A"}</strong>, but did not record a check-out before the session concluded at <strong>12:00 (06:00 PM)</strong>. New check-ins are locked until your departure time is reviewed and approved by an administrator.
                </>
              ) : (
                <>
                  You have an unclosed attendance record from <strong>{missing?.date || "a previous date"}</strong> (<strong>{missing?.session || "shift"}</strong> session, Checked in: <strong>{missing?.check_in_time || "N/A"}</strong>). New check-ins are locked until your departure time is submitted and approved.
                </>
              )}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Click below to enter your departure time and submit for administrative review.
            </p>
          </div>
        </div>

        <button
          id="employee-view-missing-status-btn"
          onClick={() => onOpenMissingModal("my-unclosed")}
          className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition shrink-0 flex items-center gap-1.5 cursor-pointer"
        >
          <span>Submit Correction Request</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Rule 1: Open Check-In Today (Already Checked In -> Offer Check Out)
  if (attendanceStatus?.hasOpenToday && attendanceStatus.openTodayRecord) {
    const openRecord = attendanceStatus.openTodayRecord;
    return (
      <div 
        id="employee-already-checked-in-alert"
        className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/30 flex items-center justify-between gap-4 flex-wrap"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                You are currently checked in for the {openRecord.session} session
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
                Session Active
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Checked in at <strong>{openRecord.check_in_time}</strong> today. When your shift ends, remember to scan the Office QR code to record your check-out.
            </p>
          </div>
        </div>

        <button
          id="active-session-checkout-now-btn"
          onClick={onOpenCheckOut}
          className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-xl shadow-md flex items-center gap-1.5 transition shrink-0 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Check Out Now</span>
        </button>
      </div>
    );
  }

  return null;
};
