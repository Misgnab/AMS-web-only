import React from "react";
import { 
  X, 
  FileText, 
  Printer, 
  Download, 
  Zap, 
  ShieldCheck, 
  DollarSign, 
  Calendar, 
  User as UserIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info
} from "lucide-react";
import { SalaryPayment } from "../types.js";

interface SalaryBreakdownModalProps {
  salary: SalaryPayment | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPayslip?: (userId: number) => void;
}

export const SalaryBreakdownModal: React.FC<SalaryBreakdownModalProps> = ({
  salary,
  isOpen,
  onClose,
  onOpenPayslip
}) => {
  if (!isOpen || !salary) return null;

  const isNetMode = salary.calculation_method === "NET";
  const isPaid = salary.payment_status === "PAID";

  const basicSalary = salary.basic_salary ?? salary.regular_pay ?? 0;
  const allowancesTotal = (salary.transport_allowance || 0) + (salary.housing_allowance || 0) + (salary.position_allowance || 0);
  const grossSalary = salary.gross_salary ?? (basicSalary + allowancesTotal + (salary.overtime_pay || 0));
  const overtimePay = salary.overtime_pay || 0;
  const overtimeHours = salary.overtime_hours || 0;
  const effectiveRate = salary.effective_hourly_rate || salary.hourly_rate || 150;
  const overtimeRate = salary.overtime_rate || (overtimeHours > 0 ? overtimePay / overtimeHours : effectiveRate * 1.5);
  
  const penaltiesAmount = salary.penalty_amount ?? (salary.late_penalty_deduction || 0) + (salary.absent_deduction || 0);
  const taxAmount = salary.income_tax || 0;
  const pensionAmount = salary.pension_employee || 0;
  const otherDeductions = salary.custom_deduction || 0;
  const finalPayable = salary.final_payable_amount ?? salary.net_salary ?? 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Itemized Salary Calculation Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Mathematical audit & statutory deduction verification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
              title="Print Breakdown"
            >
              <Printer size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Metadata Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employee</span>
              <div className="font-bold text-slate-900 text-sm mt-0.5">{salary.full_name}</div>
              <div className="text-slate-500 text-[11px]">{salary.department || "Operations"} · {salary.role || "Staff"}</div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payroll Period</span>
              <div className="font-bold text-slate-800 text-xs mt-0.5">{salary.period_label || `${salary.period_start} to ${salary.period_end}`}</div>
              <div className="text-slate-500 text-[11px]">Period Type: {salary.period_type || "Monthly"}</div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Calculation Mode</span>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  isNetMode 
                    ? "bg-purple-100 text-purple-800 border border-purple-200" 
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}>
                  Based on {isNetMode ? "Net Salary" : "Gross Salary"}
                </span>
              </div>
              <div className="mt-1">
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isPaid ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}>
                  Status: {isPaid ? "PAID" : "UNPAID"}
                </span>
              </div>
            </div>
          </div>

          {/* Mode explanation notification */}
          <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            isNetMode 
              ? "bg-purple-50/80 border-purple-200 text-purple-900"
              : "bg-blue-50/80 border-blue-200 text-blue-900"
          }`}>
            <Info size={16} className={`shrink-0 mt-0.5 ${isNetMode ? "text-purple-600" : "text-blue-600"}`} />
            <div>
              <span className="font-bold">
                {isNetMode ? "Net Salary Calculation Rules Applied:" : "Gross Salary Statutory Calculation Rules Applied:"}
              </span>
              <p className="mt-0.5 text-[11px] leading-relaxed">
                {isNetMode ? (
                  <>
                    In <strong>Net Salary Mode</strong>, calculations start directly from the agreed Net Salary. <strong>Taxes and Pension contributions are NOT calculated or deducted</strong>. Overtime is added as an addition, and penalties/non-tax deductions are applied to arrive at the final payable salary.
                  </>
                ) : (
                  <>
                    In <strong>Gross Salary Mode</strong>, statutory deductions (Ethiopian employment tax brackets and 7% employee pension contribution) are calculated on taxable gross earnings, overtime is added, and penalties are deducted to arrive at the net payable salary.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Mathematical Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Component</th>
                  <th className="py-2.5 px-3 text-center">Operation</th>
                  <th className="py-2.5 px-4 text-right">Amount (ETB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {/* Basic Salary */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    Basic Salary
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {(salary.regular_hours || 0) % 1 === 0 ? (salary.regular_hours || 0).toFixed(1) : Number((salary.regular_hours || 0).toFixed(2))} regular hours @ ETB {effectiveRate.toFixed(2)}/hr
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">Base</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                    {basicSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Allowances */}
                {allowancesTotal > 0 && (
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Allowances
                      <span className="block text-[10px] text-slate-400 font-normal">
                        Transport: ETB {salary.transport_allowance || 0} · Housing: ETB {salary.housing_allowance || 0} · Position: ETB {salary.position_allowance || 0}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">+</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                      +{allowancesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                {/* Gross Salary Line */}
                <tr className="bg-slate-50/80 font-bold text-slate-900 border-y border-slate-200">
                  <td className="py-2.5 px-4">Gross Salary (Base + Allowances)</td>
                  <td className="py-2.5 px-3 text-center text-slate-400 font-mono">=</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-900">
                    {grossSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Overtime (Addition) */}
                <tr className="hover:bg-amber-50/40 bg-amber-50/20">
                  <td className="py-2.5 px-4 font-semibold text-amber-900">
                    <div className="flex items-center gap-1.5">
                      <Zap size={13} className="text-amber-600" />
                      <span>Overtime Pay</span>
                    </div>
                    <span className="block text-[10px] text-amber-700/80 font-normal">
                      {overtimeHours.toFixed(1)} hrs × ETB {overtimeRate.toFixed(2)}/hr effective OT rate
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 text-sm">+</td>
                  <td className="py-2.5 px-4 text-right font-mono font-black text-amber-700">
                    +{overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Penalties (Deduction) */}
                <tr className="hover:bg-rose-50/40 bg-rose-50/20">
                  <td className="py-2.5 px-4 font-semibold text-rose-900">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={13} className="text-rose-600" />
                      <span>Late Arrival & Absence Penalties</span>
                    </div>
                    <span className="block text-[10px] text-rose-700/80 font-normal">
                      {salary.late_count || 0} late session(s) ({salary.late_minutes || 0} mins) + {salary.absent_days || 0} absent day(s)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600 text-sm">−</td>
                  <td className="py-2.5 px-4 text-right font-mono font-black text-rose-600">
                    −{penaltiesAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>

                {/* Taxes */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    Employment Income Tax
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                    {isNetMode ? "—" : "−"}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {isNetMode ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[11px]">
                        Not applicable — Net Salary calculation
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-rose-600">
                        −{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </td>
                </tr>

                {/* Pension */}
                <tr className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    Pension Contribution (7% Employee)
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                    {isNetMode ? "—" : "−"}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {isNetMode ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[11px]">
                        Not applicable — Net Salary calculation
                      </span>
                    ) : (
                      <span className="font-mono font-bold text-rose-600">
                        −{pensionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </td>
                </tr>

                {/* Other Deductions */}
                {otherDeductions > 0 && (
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      Other Applicable Non-Tax Deductions (Loan / Advance)
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">−</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      −{otherDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}

                {/* Final Payable Salary Line */}
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-3 px-4 text-sm tracking-wide">
                    Final Payable Salary
                    <span className="block text-[10px] text-slate-400 font-normal">
                      {isNetMode 
                        ? "Formula: Net Salary + Overtime − Penalties − Other Non-Tax Deductions"
                        : "Formula: Gross Salary + Overtime − Penalties − Taxes − Pension − Other Deductions"}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-emerald-400 text-base">=</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-base sm:text-lg text-emerald-400">
                    ETB {finalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Penalties Details Accordion / Summary (if any) */}
          {salary.penalties_breakdown && salary.penalties_breakdown.length > 0 && (
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2 text-xs">
              <span className="font-bold text-rose-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <ShieldCheck size={14} className="text-rose-600" />
                Itemized Penalties Applied to this Payroll ({salary.penalties_breakdown.length})
              </span>
              <div className="space-y-1.5">
                {salary.penalties_breakdown.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-100 text-[11px]">
                    <div>
                      <span className="font-semibold text-slate-800">{p.reason || p.type}</span>
                      <span className="text-slate-400 block text-[10px]">{p.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-rose-600">−ETB {Number(p.amount || 0).toFixed(2)}</span>
                      <span className="block text-[9px] font-bold text-rose-700 uppercase">{p.status || "PENALIZED"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 print:hidden">
            {onOpenPayslip ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPayslip(salary.user_id);
                }}
                className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={14} />
                <span>View Full Itemized Payslip</span>
              </button>
            ) : <div />}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Close Breakdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
