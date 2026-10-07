import React, { useState } from "react";
import { 
  X, 
  Printer, 
  Download, 
  Building, 
  Calendar, 
  User as UserIcon, 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText,
  DollarSign,
  ShieldCheck,
  Briefcase,
  Zap,
  Tag
} from "lucide-react";
import { EnterprisePayslip } from "../types.js";
import { useAppStore } from "../store.js";

interface EnterprisePayslipModalProps {
  payslip: EnterprisePayslip | null;
  isOpen: boolean;
  onClose: () => void;
  onDisburseSuccess?: () => void;
}

export const EnterprisePayslipModal: React.FC<EnterprisePayslipModalProps> = ({
  payslip,
  isOpen,
  onClose,
  onDisburseSuccess
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "daylogs" | "overtime">("summary");
  const [isDisbursing, setIsDisbursing] = useState(false);
  const [disburseSuccess, setDisburseSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const { disburseSalary, user: currentUser } = useAppStore();

  if (!isOpen || !payslip) return null;

  const isAdminOrHR = ["SuperAdmin", "AdminCreator", "AdminManager", "Accountant", "HR"].includes(currentUser?.role || "");

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payslip, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Payslip_${payslip.employee.fullName.replace(/\s+/g, "_")}_${payslip.period.startDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleMarkPaid = async () => {
    if (!isAdminOrHR) return;
    setIsDisbursing(true);
    setErrorMsg("");
    try {
      const res = await disburseSalary({
        user_id: payslip.employee.id,
        filter: payslip.period.type,
        startDate: payslip.period.startDate,
        endDate: payslip.period.endDate,
        payment_method: "BANK_TRANSFER",
        payment_reference: payslip.referenceNumber
      });
      if (res.success) {
        setDisburseSuccess(true);
        if (onDisburseSuccess) onDisburseSuccess();
      } else {
        setErrorMsg(res.error || "Disbursement failed");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "An unexpected error occurred");
    } finally {
      setIsDisbursing(false);
    }
  };

  return (
    <div id="enterprise-payslip-backdrop" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static">
      <div 
        id="enterprise-payslip-card" 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none"
      >
        {/* Modal Top Header Actions (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Official Enterprise Payslip</h2>
              <p className="text-xs text-slate-500 font-mono">Ref: {payslip.referenceNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/80 p-1 rounded-xl mr-2">
              <button
                id="tab-summary-btn"
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "summary" 
                    ? "bg-white text-slate-800 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Payslip Summary
              </button>
              <button
                id="tab-daylogs-btn"
                type="button"
                onClick={() => setActiveTab("daylogs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "daylogs" 
                    ? "bg-white text-slate-800 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Daily Audit Log ({payslip.dayLogs?.length || 0})
              </button>
              <button
                id="tab-overtime-btn"
                type="button"
                onClick={() => setActiveTab("overtime")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "overtime" 
                    ? "bg-white text-slate-800 shadow-xs" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Overtime Audit ({payslip.earnings.overtimeBreakdown?.length || 0})
              </button>
            </div>

            <button
              id="print-payslip-btn"
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Print
            </button>

            <button
              id="download-payslip-btn"
              type="button"
              onClick={handleDownloadJSON}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              JSON
            </button>

            <button
              id="close-payslip-modal-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 print:hidden">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {disburseSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2 print:hidden">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Payroll disbursement recorded successfully! Marked as PAID.</span>
            </div>
          )}

          {activeTab === "summary" ? (
            <div className="space-y-6 print:space-y-4">
              {/* Corporate Document Header */}
              <div className="border-b-2 border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Building className="w-6 h-6 text-indigo-700" />
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                      {payslip.companyName}
                    </h1>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Branch / Workspace: <span className="font-semibold text-slate-700">{payslip.workspaceName}</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Human Resources & Payroll Financial Statement
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-xs font-bold rounded-md">
                    REF: {payslip.referenceNumber}
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">Pay Period:</span> {payslip.period.ethiopianLabel} ({payslip.period.type})
                  </p>
                  <p className="text-xs text-slate-400">
                    Date Issued: {payslip.generatedDate}
                  </p>
                  <div className="pt-1">
                    {payslip.paymentStatus === "PAID" || disburseSuccess ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PAID & DISBURSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                        <Clock className="w-3.5 h-3.5" /> PENDING DISBURSEMENT
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Employee & Bank Identification Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 pb-1 border-b border-slate-200">
                    <UserIcon className="w-4 h-4 text-indigo-600" />
                    <span>Employee Information</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Full Name:</span>
                    <span className="col-span-2 font-bold text-slate-800">{payslip.employee.fullName}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Employee ID:</span>
                    <span className="col-span-2 font-mono font-medium text-slate-700">EMP-{payslip.employee.id.toString().padStart(4, "0")}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Role / Title:</span>
                    <span className="col-span-2 font-semibold text-slate-700">{payslip.employee.role}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Phone:</span>
                    <span className="col-span-2 text-slate-700 font-mono">{payslip.employee.phoneNumber}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-bold text-slate-800 pb-1 border-b border-slate-200">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>Payment & Banking Details</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Bank Name:</span>
                    <span className="col-span-2 font-semibold text-slate-800">{payslip.employee.bankName}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Account No:</span>
                    <span className="col-span-2 font-mono font-bold text-slate-800">
                      {payslip.employee.bankAccountNumber || "Not Registered"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Tax / TIN No:</span>
                    <span className="col-span-2 font-mono text-slate-700">{payslip.employee.taxId || "N/A"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <span className="text-slate-500">Pay Method:</span>
                    <span className="col-span-2 font-medium text-slate-700">Direct Bank Transfer (ACH / EFT)</span>
                  </div>
                </div>
              </div>

              {/* Attendance & Leave Audit KPI Strip */}
              <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Time Tracking & Leave Verification Summary</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-center">
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[10px] font-medium uppercase">Expected Days</div>
                    <div className="text-base font-bold text-white mt-0.5">{payslip.summary.expectedWorkDays}</div>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[10px] font-medium uppercase">Present Days</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">{payslip.summary.actualPresentDays}</div>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[10px] font-medium uppercase">Approved Leaves</div>
                    <div className="text-base font-bold text-indigo-400 mt-0.5">
                      {payslip.summary.approvedLeaveDays} d ({payslip.summary.totalPaidLeaveHours}h)
                    </div>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[10px] font-medium uppercase">Regular Hours</div>
                    <div className="text-base font-bold text-slate-100 mt-0.5">{payslip.summary.totalRegularHours} hrs</div>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[10px] font-medium uppercase">Total Overtime</div>
                    <div className="text-base font-bold text-amber-400 mt-0.5">{payslip.summary.totalOvertimeHours} hrs</div>
                    <div className="text-[9px] text-amber-300 font-mono font-bold mt-0.5">+{payslip.earnings.overtimeWage.toFixed(2)} ETB</div>
                  </div>
                  <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                    <div className="text-slate-400 text-[10px] font-medium uppercase">Lates / Absents</div>
                    <div className="text-base font-bold text-rose-400 mt-0.5">
                      {payslip.summary.lateCount} lates / {payslip.summary.absentDays} abs
                    </div>
                  </div>
                </div>
              </div>

              {/* Two-Column Itemized Financial Ledger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Earnings & Allowances */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-emerald-50/80 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      A. Earnings & Compensations
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700">Amount (ETB)</span>
                  </div>
                  <div className="p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-700">
                      <span>Basic Regular Work Pay ({payslip.summary.totalRegularHours} hrs):</span>
                      <span className="font-mono font-semibold">{payslip.earnings.basicRegularWage.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700">
                      <span className="flex items-center gap-1">
                        <span>Approved Paid Leave Pay ({payslip.summary.totalPaidLeaveHours} hrs):</span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">+{payslip.earnings.paidLeaveAmount.toFixed(2)}</span>
                    </div>

                    {/* Multi-rate Overtime Calculations */}
                    {payslip.earnings.overtimeWage > 0 && (
                      <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 space-y-1.5">
                        <div className="flex justify-between items-center text-amber-950 font-bold">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            Overtime Wages ({payslip.summary.totalOvertimeHours} hrs total):
                          </span>
                          <span className="font-mono text-amber-700 font-extrabold">+{payslip.earnings.overtimeWage.toFixed(2)}</span>
                        </div>

                        <div className="text-[11px] space-y-1 pt-1 border-t border-amber-200/50 text-slate-600">
                          {(payslip.summary.regularOvertimeHours ?? 0) > 0 && (
                            <div className="flex justify-between items-center">
                              <span>• Normal OT ({payslip.summary.regularOvertimeHours}h @ {payslip.summary.normalOvertimeMultiplier || 1.5}x):</span>
                              <span className="font-mono font-semibold">{(payslip.earnings.normalOtWage ?? 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(payslip.summary.restDayOvertimeHours ?? 0) > 0 && (
                            <div className="flex justify-between items-center text-indigo-800">
                              <span>• Rest Day OT ({payslip.summary.restDayOvertimeHours}h @ {payslip.summary.restDayOvertimeMultiplier || 2.0}x):</span>
                              <span className="font-mono font-bold">{(payslip.earnings.restDayOtWage ?? 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(payslip.summary.holidayOvertimeHours ?? 0) > 0 && (
                            <div className="flex justify-between items-center text-rose-800">
                              <span>• Public Holiday OT ({payslip.summary.holidayOvertimeHours}h @ {payslip.summary.holidayOvertimeMultiplier || 2.5}x):</span>
                              <span className="font-mono font-bold">{(payslip.earnings.holidayOtWage ?? 0).toFixed(2)}</span>
                            </div>
                          )}
                          {(payslip.summary.nightOvertimeHours ?? 0) > 0 && (
                            <div className="flex justify-between items-center text-purple-800">
                              <span>• Night Shift OT ({payslip.summary.nightOvertimeHours}h @ {payslip.summary.nightOvertimeMultiplier || 1.5}x):</span>
                              <span className="font-mono font-bold">{(payslip.earnings.nightOtWage ?? 0).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {payslip.earnings.transportAllowance > 0 && (
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Transport Allowance:</span>
                        <span className="font-mono font-semibold">+{payslip.earnings.transportAllowance.toFixed(2)}</span>
                      </div>
                    )}
                    {payslip.earnings.housingAllowance > 0 && (
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Housing Allowance:</span>
                        <span className="font-mono font-semibold">+{payslip.earnings.housingAllowance.toFixed(2)}</span>
                      </div>
                    )}
                    {payslip.earnings.positionAllowance > 0 && (
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Position / Site Allowance:</span>
                        <span className="font-mono font-semibold">+{payslip.earnings.positionAllowance.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-emerald-50/50 px-4 py-3 border-t border-emerald-100 flex justify-between items-center font-bold text-xs text-emerald-950">
                    <span>TOTAL GROSS EARNINGS:</span>
                    <span className="font-mono text-sm text-emerald-800">{payslip.earnings.grossEarnings.toFixed(2)} ETB</span>
                  </div>
                </div>

                {/* Right: Deductions & Statutory Withholdings */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="bg-rose-50/80 px-4 py-2.5 border-b border-rose-100 flex items-center justify-between">
                    <span className="font-bold text-xs text-rose-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-600" />
                      B. Deductions & Statutory Taxes
                    </span>
                    <span className="text-[11px] font-semibold text-rose-700">Amount (ETB)</span>
                  </div>
                  <div className="p-4 space-y-2.5 text-xs">
                    {payslip.calculationMethod === "NET" ? (
                      <div className="p-3 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-900 space-y-1.5 mb-2">
                        <div className="font-bold text-xs flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                          Net Salary Mode Active:
                        </div>
                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-purple-200/60">
                          <span className="text-slate-600">Income Tax:</span>
                          <span className="font-semibold text-purple-700">Not applicable — Net Salary calculation</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-600">Employee Pension (7%):</span>
                          <span className="font-semibold text-purple-700">Not applicable — Net Salary calculation</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Employee Pension Fund (7% Statutory):</span>
                          <span className="font-mono font-semibold text-rose-600">-{payslip.deductions.employeePension.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-700">
                          <span>Income Tax (Ethiopian Proclamation):</span>
                          <span className="font-mono font-semibold text-rose-600">-{payslip.deductions.incomeTaxWithheld.toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    {payslip.deductions.latePenalty > 0 && (
                      <div className="flex justify-between items-center text-rose-700 bg-rose-50/50 p-1.5 rounded-lg border border-rose-100">
                        <span>Lateness Penalty ({payslip.summary.lateCount} incidents):</span>
                        <span className="font-mono font-bold">-{payslip.deductions.latePenalty.toFixed(2)}</span>
                      </div>
                    )}
                    {payslip.deductions.absenceDeduction > 0 && (
                      <div className="flex justify-between items-center text-rose-700 bg-rose-50/50 p-1.5 rounded-lg border border-rose-100">
                        <span>Unexcused Absence Deduction ({payslip.summary.absentDays} days):</span>
                        <span className="font-mono font-bold">-{payslip.deductions.absenceDeduction.toFixed(2)}</span>
                      </div>
                    )}
                    {payslip.deductions.customLoanAdvance > 0 && (
                      <div className="flex justify-between items-center text-slate-700">
                        <span>Salary Advance / Loan Recovery:</span>
                        <span className="font-mono font-semibold">-{payslip.deductions.customLoanAdvance.toFixed(2)}</span>
                      </div>
                    )}
                    {payslip.deductions.latePenalty === 0 && payslip.deductions.absenceDeduction === 0 && payslip.deductions.customLoanAdvance === 0 && (
                      <div className="text-slate-400 italic text-[11px] py-1">
                        No disciplinary, absence, or advance deductions applied.
                      </div>
                    )}

                    {/* Base + Overtime - Penalty Formula Indicator */}
                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
                      Subtotal: Base ({payslip.earnings.basicRegularWage.toFixed(0)}) + OT (+{payslip.earnings.overtimeWage.toFixed(0)}) − Penalties (−{(payslip.deductions.latePenalty + payslip.deductions.absenceDeduction).toFixed(0)}) = ETB {(payslip.earnings.basicRegularWage + payslip.earnings.overtimeWage - payslip.deductions.latePenalty - payslip.deductions.absenceDeduction).toFixed(2)} before statutory withholdings
                    </div>
                  </div>
                  <div className="bg-rose-50/50 px-4 py-3 border-t border-rose-100 flex justify-between items-center font-bold text-xs text-rose-950">
                    <span>TOTAL DEDUCTIONS:</span>
                    <span className="font-mono text-sm text-rose-800">-{payslip.deductions.totalDeductions.toFixed(2)} ETB</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Callout Box */}
              <div className="bg-linear-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 rounded-2xl shadow-lg border border-indigo-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-wider uppercase text-indigo-300">
                        NET PAYABLE SALARY (Take-Home Pay)
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        payslip.calculationMethod === "NET" ? "bg-purple-500 text-white" : "bg-blue-500 text-white"
                      }`}>
                        Based on {payslip.calculationMethod === "NET" ? "Net Salary" : "Gross Salary"}
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-0.5">
                      {payslip.netPay.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                    </div>
                    <div className="text-[10px] text-indigo-200 mt-1 font-mono">
                      {payslip.calculationMethod === "NET" 
                        ? "Formula: Net Salary + Overtime − Penalties − Other Non-Tax Deductions = Final Payable"
                        : "Formula: Gross Salary + Overtime − Penalties − Taxes − Pension − Deductions = Net Payable"}
                    </div>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 border-indigo-700/60 pt-2 sm:pt-0">
                    <div className="text-[11px] text-indigo-300 uppercase font-medium">Employer Pension (11% Company)</div>
                    <div className="text-sm font-mono font-bold text-slate-200 mt-0.5">
                      {payslip.calculationMethod === "NET" ? "Not applicable (Net Mode)" : `+${payslip.employerContributions.employerPension.toFixed(2)} ETB`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-indigo-700/60 text-xs text-indigo-100 flex items-center gap-2">
                  <span className="font-semibold text-indigo-300">Amount in Words:</span>
                  <span className="italic font-medium">{payslip.netPay.inWords}</span>
                </div>
              </div>

              {/* Official Signatures & Approval Block */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-center text-xs">
                <div className="space-y-8">
                  <span className="text-slate-500 font-medium">Prepared By (Accountant)</span>
                  <div className="border-b border-dashed border-slate-400 pb-1">
                    <span className="text-slate-400 font-serif italic text-[11px]">Authorized Signature</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Date: {payslip.generatedDate}</span>
                </div>

                <div className="space-y-8">
                  <span className="text-slate-500 font-medium">Approved By (HR Manager)</span>
                  <div className="border-b border-dashed border-slate-400 pb-1">
                    <span className="text-slate-400 font-serif italic text-[11px]">Authorized Signature</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">Date: {payslip.generatedDate}</span>
                </div>

                <div className="space-y-8">
                  <span className="text-slate-500 font-medium">Employee Signature</span>
                  <div className="border-b border-dashed border-slate-400 pb-1">
                    <span className="text-slate-400 font-serif italic text-[11px]">Employee Signature & Date</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block">{payslip.employee.fullName}</span>
                </div>
              </div>
            </div>
          ) : activeTab === "daylogs" ? (
            /* Tab 2: Day-by-Day Audit Logs */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Itemized Attendance & Shift Breakdown</h3>
                  <p className="text-xs text-slate-500">Day-by-day record of punches, permissions, overtime, and punctuality</p>
                </div>
                <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                  Total Records: {payslip.dayLogs?.length || 0}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date (Eth)</th>
                      <th className="py-2.5 px-3">Day</th>
                      <th className="py-2.5 px-3">Session</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Punch Times</th>
                      <th className="py-2.5 px-3 text-center">Reg. Hrs</th>
                      <th className="py-2.5 px-3 text-center">OT Hrs</th>
                      <th className="py-2.5 px-3 text-center">Paid Leave</th>
                      <th className="py-2.5 px-3 text-right">Lateness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {payslip.dayLogs?.map((log, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-mono font-medium">{log.date}</td>
                        <td className="py-2 px-3 text-slate-500">{log.dayOfWeek}</td>
                        <td className="py-2 px-3 font-semibold">{log.session}</td>
                        <td className="py-2 px-3">
                          {log.status === "Present" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Present
                            </span>
                          )}
                          {log.status === "Late" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Late ({log.lateMinutes}m)
                            </span>
                          )}
                          {(log.status === "Permission" || log.status === "Approved Leave") && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                              {log.leaveType || "Leave"} (Paid)
                            </span>
                          )}
                          {log.status === "Site Visit" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              Site Visit
                            </span>
                          )}
                          {log.status === "Absent" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              Absent
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600 text-[11px]">
                          {log.checkInTime || "--:--"} - {log.checkOutTime || "--:--"}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                          {log.regularHours > 0 ? `${log.regularHours}h` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-amber-600">
                          {log.overtimeHours > 0 ? `+${log.overtimeHours}h` : "-"}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-emerald-600">
                          {log.paidLeaveHours > 0 ? `+${log.paidLeaveHours}h` : "-"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">
                          {log.lateMinutes > 0 ? (
                            <span className="text-rose-600 font-semibold">{log.lateMinutes} min</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Tab 3: Detailed Overtime Records Audit */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Itemized Approved Overtime Sessions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Compliant with Ethiopian labor overtime rules (Normal 1.5x, Rest Day 2.0x, Public Holiday 2.5x, Night 1.5x)
                  </p>
                </div>
                <div className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-lg">
                  Total OT Pay: {payslip.earnings.overtimeWage.toFixed(2)} ETB
                </div>
              </div>

              {/* Overtime Category Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold text-amber-800 uppercase">Normal OT ({payslip.summary.normalOvertimeMultiplier || 1.5}x)</div>
                  <div className="text-sm font-black text-amber-950 mt-0.5">{payslip.summary.regularOvertimeHours || 0} hrs</div>
                  <div className="text-[10px] font-mono text-amber-700 font-bold">{(payslip.earnings.normalOtWage || 0).toFixed(2)} ETB</div>
                </div>
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold text-indigo-800 uppercase">Rest Day OT ({payslip.summary.restDayOvertimeMultiplier || 2.0}x)</div>
                  <div className="text-sm font-black text-indigo-950 mt-0.5">{payslip.summary.restDayOvertimeHours || 0} hrs</div>
                  <div className="text-[10px] font-mono text-indigo-700 font-bold">{(payslip.earnings.restDayOtWage || 0).toFixed(2)} ETB</div>
                </div>
                <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold text-rose-800 uppercase">Holiday OT ({payslip.summary.holidayOvertimeMultiplier || 2.5}x)</div>
                  <div className="text-sm font-black text-rose-950 mt-0.5">{payslip.summary.holidayOvertimeHours || 0} hrs</div>
                  <div className="text-[10px] font-mono text-rose-700 font-bold">{(payslip.earnings.holidayOtWage || 0).toFixed(2)} ETB</div>
                </div>
                <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] font-bold text-purple-800 uppercase">Night OT ({payslip.summary.nightOvertimeMultiplier || 1.5}x)</div>
                  <div className="text-sm font-black text-purple-950 mt-0.5">{payslip.summary.nightOvertimeHours || 0} hrs</div>
                  <div className="text-[10px] font-mono text-purple-700 font-bold">{(payslip.earnings.nightOtWage || 0).toFixed(2)} ETB</div>
                </div>
              </div>

              {!payslip.earnings.overtimeBreakdown || payslip.earnings.overtimeBreakdown.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
                  No individual overtime shifts recorded for this period.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date (Eth)</th>
                        <th className="py-2.5 px-3">Session</th>
                        <th className="py-2.5 px-3">Overtime Category</th>
                        <th className="py-2.5 px-3 text-center">Hours</th>
                        <th className="py-2.5 px-3 text-center">Multiplier</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Earned Pay</th>
                        <th className="py-2.5 px-3">Job Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {payslip.earnings.overtimeBreakdown.map((ot, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{ot.date}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold">
                              {ot.session || "Shift"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {ot.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800">{ot.hours.toFixed(1)}h</td>
                          <td className="py-2 px-3 text-center font-bold text-amber-700">{ot.multiplier}x</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{ot.hourlyRate.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">+{ot.amount.toFixed(2)} ETB</td>
                          <td className="py-2 px-3 text-slate-500 max-w-[200px] truncate" title={ot.notes || "Approved Overtime"}>
                            {ot.notes || "Approved Overtime"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80 print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Compliant with Ethiopian Labor Law & Proclamation</span>
          </div>

          <div className="flex items-center gap-2">
            {isAdminOrHR && payslip.paymentStatus !== "PAID" && !disburseSuccess && (
              <button
                id="disburse-single-payslip-btn"
                type="button"
                disabled={isDisbursing}
                onClick={handleMarkPaid}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isDisbursing ? "Recording Disbursement..." : "Mark as Paid / Disburse"}
              </button>
            )}

            <button
              id="close-payslip-footer-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
