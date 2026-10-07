import React from "react";
import { 
  X, 
  ShieldAlert, 
  ShieldCheck, 
  AlertCircle, 
  DollarSign, 
  Calendar, 
  User as UserIcon,
  CheckCircle2,
  Clock,
  Printer
} from "lucide-react";
import { SalaryPayment } from "../types.js";

interface EmployeePenaltiesModalProps {
  salary: SalaryPayment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeePenaltiesModal: React.FC<EmployeePenaltiesModalProps> = ({
  salary,
  isOpen,
  onClose
}) => {
  if (!isOpen || !salary) return null;

  const isNetMode = salary.calculation_method === "NET";
  const penaltiesList = salary.penalties_breakdown || [];
  const basicSalary = salary.basic_salary ?? salary.regular_pay ?? 0;
  const overtimePay = salary.overtime_pay ?? 0;
  const totalPenalties = salary.penalty_amount ?? (salary.late_penalty_deduction || 0) + (salary.absent_deduction || 0);
  const salaryBeforeDeductions = Math.max(0, basicSalary + overtimePay - totalPenalties);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden print:border-none print:shadow-none print:max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Itemized Employee Penalties & Deductions
              </h3>
              <p className="text-xs text-slate-500">
                Audit breakdown of late check-ins, unexcused absences, and incident deductions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              title="Print Audit"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Employee & Period Overview */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee</span>
              <div className="font-bold text-slate-900 text-sm mt-0.5">{salary.full_name}</div>
              <div className="text-slate-500 text-[11px]">{salary.department || "Operations"} · {salary.role || "Staff"}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Calculation Method</span>
              <div className="mt-0.5">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  isNetMode 
                    ? "bg-purple-100 text-purple-800 border border-purple-200" 
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}>
                  Based on {isNetMode ? "Net Salary" : "Gross Salary"}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {isNetMode ? "Taxes & pension excluded" : "Subject to tax & pension rules"}
              </div>
            </div>
            <div className="sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Penalty Deductions</span>
              <div className="font-mono font-black text-rose-600 text-base mt-0.5">
                -ETB {totalPenalties.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Applied to current payroll
              </div>
            </div>
          </div>

          {/* Mathematical Audit Box (Requirement 3) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-900 text-white space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Mathematical Salary Formula (Before Applicable Deductions)
            </div>
            <div className="font-mono text-xs sm:text-sm text-slate-200 leading-relaxed">
              <span className="text-slate-300">Base Salary:</span> <strong>ETB {basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              {" + "}
              <span className="text-amber-400">Overtime:</span> <strong>ETB {overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              {" − "}
              <span className="text-rose-400">Penalties:</span> <strong>ETB {totalPenalties.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              {" = "}
              <span className="text-emerald-400 font-black">
                ETB {salaryBeforeDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                {isNetMode 
                  ? "(= Final Payable Salary, since Net Salary excludes taxes and pensions)"
                  : "(= Salary Before Statutory Deductions: Taxes & 7% Pension will then be deducted per proclamation)"}
              </span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Penalty Type</th>
                  <th className="py-2.5 px-3">Penalty Reason</th>
                  <th className="py-2.5 px-3">Penalty Date</th>
                  <th className="py-2.5 px-3 text-right">Penalty Amount</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Applied to Payroll</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {penaltiesList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      <ShieldCheck className="w-8 h-8 mx-auto text-emerald-500 mb-1 opacity-70" />
                      <p className="font-bold text-slate-700">No penalties recorded for this period</p>
                      <p className="text-[11px] text-slate-400">Employee has clean attendance or all penalties have been waived</p>
                    </td>
                  </tr>
                ) : (
                  penaltiesList.map((p, idx) => {
                    const isWaived = p.status === "WAIVED";
                    const isPenalized = p.status === "PENALIZED" || p.status === "PAID";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                          {p.type === "LATE_ARRIVAL" ? "Late Arrival" : p.type === "UNEXCUSED_ABSENCE" ? "Unexcused Absence" : p.type}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {p.reason || "Lateness deduction"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap">
                          {p.date}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                          {isWaived ? (
                            <span className="text-slate-400 line-through">ETB {Number(p.amount || 0).toFixed(2)}</span>
                          ) : (
                            `-ETB ${Number(p.amount || 0).toFixed(2)}`
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isWaived 
                              ? "bg-emerald-100 text-emerald-800" 
                              : isPenalized 
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {p.status || "PENALIZED"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {p.applied_to_payroll !== false && !isWaived ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 size={12} /> Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 font-medium text-[10px]">
                              No
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Note */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 print:hidden">
            <span className="text-[11px] text-slate-400">
              * Late arrival penalties are derived in accordance with company grace threshold and hourly deduction rules.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
