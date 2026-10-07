import React, { useState } from "react";
import { 
  X, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  User as UserIcon,
  ShieldCheck,
  Zap,
  Building,
  HelpCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import { SalaryPayment } from "../types.js";

interface SalaryPaymentConfirmationModalProps {
  salary: SalaryPayment | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentDetails: {
    payment_method: string;
    payment_reference: string;
    payment_date: string;
    notes?: string;
  }) => Promise<void>;
  isProcessing: boolean;
}

export const SalaryPaymentConfirmationModal: React.FC<SalaryPaymentConfirmationModalProps> = ({
  salary,
  isOpen,
  onClose,
  onConfirm,
  isProcessing
}) => {
  if (!isOpen || !salary) return null;

  const isNetMode = salary.calculation_method === "NET";
  const isAlreadyPaid = salary.payment_status === "PAID";

  const todayStr = new Date().toISOString().split("T")[0];
  const [paymentMethod, setPaymentMethod] = useState<string>("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState<string>(
    salary.payment_reference || `PAY-${salary.period_start?.replace(/-/g, "") || todayStr.replace(/-/g, "")}-${salary.user_id.toString().padStart(4, "0")}`
  );
  const [paymentDate, setPaymentDate] = useState<string>(salary.payment_date || todayStr);
  const [notes, setNotes] = useState<string>(salary.notes || "");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    try {
      await onConfirm({
        payment_method: paymentMethod,
        payment_reference: paymentReference,
        payment_date: paymentDate,
        notes: notes.trim() || undefined
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process payment disbursement.");
    }
  };

  const finalAmount = salary.final_payable_amount ?? salary.net_salary ?? 0;
  const grossOrBase = isNetMode ? (salary.basic_salary ?? salary.regular_pay ?? 0) : salary.gross_salary;
  const overtimePay = salary.overtime_pay ?? 0;
  const penaltyDeduction = salary.penalty_amount ?? salary.late_penalty_deduction ?? 0;
  const taxDeduction = salary.income_tax ?? 0;
  const pensionDeduction = salary.pension_employee ?? 0;
  const otherDeduction = (salary.custom_deduction ?? 0) + (salary.absent_deduction ?? 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isAlreadyPaid ? "Re-Process Salary Payment" : "Confirm Salary Payment"}
              </h3>
              <p className="text-xs text-slate-500">
                Official payment authorization and payroll ledger posting
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isAlreadyPaid && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-amber-600" />
              <span>
                <strong>Notice:</strong> This employee's salary for this period is already marked as <strong>PAID</strong>. Re-processing will update the payment details and refresh ledger records.
              </span>
            </div>
          )}

          {/* Employee & Period Summary Header Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                {salary.full_name?.charAt(0).toUpperCase() || "E"}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>{salary.full_name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-white border border-slate-200 text-slate-600">
                    ID #{salary.user_id}
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                  <span>{salary.department || "Operations"}</span>
                  <span>•</span>
                  <span>{salary.phone_number}</span>
                </div>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Salary Period</div>
              <div className="font-bold text-slate-800 text-xs mt-0.5">
                {salary.period_label || `${salary.period_start || todayStr} to ${salary.period_end || todayStr}`}
              </div>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  isNetMode 
                    ? "bg-purple-100 text-purple-800 border border-purple-200" 
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}>
                  Based on {isNetMode ? "Net Salary" : "Gross Salary"}
                </span>
              </div>
            </div>
          </div>

          {/* Itemized Calculation Summary Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2 font-bold text-slate-700 text-[11px] uppercase tracking-wider border-b border-slate-200 flex justify-between items-center">
              <span>Payroll Component Breakdown</span>
              <span className="text-[10px] font-normal text-slate-500">Method: {salary.calculation_method || "GROSS"}</span>
            </div>
            
            <div className="divide-y divide-slate-100 bg-white">
              {/* Gross / Base Salary */}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-600">
                  {isNetMode ? "Net Base Salary" : "Gross Salary (Base + Allowances)"}
                </span>
                <span className="font-mono font-bold text-slate-900">
                  ETB {grossOrBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Overtime (Addition) */}
              <div className="px-4 py-2.5 flex items-center justify-between bg-amber-50/40">
                <div className="flex items-center gap-1.5 text-amber-900 font-medium">
                  <Zap size={13} className="text-amber-600" />
                  <span>Overtime Pay ({salary.overtime_hours?.toFixed(1) || "0.0"} hrs)</span>
                </div>
                <span className="font-mono font-bold text-amber-700">
                  +ETB {overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Penalties (Deduction) */}
              <div className="px-4 py-2.5 flex items-center justify-between bg-rose-50/30">
                <div className="flex items-center gap-1.5 text-rose-900 font-medium">
                  <ShieldCheck size={13} className="text-rose-600" />
                  <span>Late & Absence Penalties</span>
                </div>
                <span className="font-mono font-bold text-rose-600">
                  -ETB {penaltyDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Taxes */}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Income Tax (Ethiopian Proclamation)</span>
                {isNetMode ? (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Not applicable — Net Salary calculation
                  </span>
                ) : (
                  <span className="font-mono font-bold text-rose-600">
                    -ETB {taxDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {/* Pension (7% Employee) */}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <span className="text-slate-600">Employee Pension Contribution (7%)</span>
                {isNetMode ? (
                  <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    Not applicable — Net Salary calculation
                  </span>
                ) : (
                  <span className="font-mono font-bold text-rose-600">
                    -ETB {pensionDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {/* Other Deductions */}
              {otherDeduction > 0 && (
                <div className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-slate-600">Other Non-Tax Deductions (Advances/Absences)</span>
                  <span className="font-mono font-bold text-rose-600">
                    -ETB {otherDeduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Final Payable Amount (Total) */}
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="font-bold text-sm tracking-wide">Final Payable Amount:</span>
                <span className="font-mono font-black text-lg text-emerald-400">
                  ETB {finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Disbursement Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="BANK_TRANSFER">Bank Transfer (CBE / Awash / Dashen)</option>
                <option value="TELEBIRR">Telebirr Electronic Transfer</option>
                <option value="CASH">Cash Disbursement</option>
                <option value="CHEQUE">Company Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Disbursement Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Payment Reference / Txn Number</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. CBE-TXN-20260930-1042"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Optional Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. September 2026 payroll disbursement approved by Finance"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{isProcessing ? "Processing Disbursement..." : "Confirm Payment"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
