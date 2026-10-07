import React from "react";
import { 
  X, 
  Clock, 
  Zap, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  ShieldCheck,
  Building,
  User as UserIcon,
  Tag
} from "lucide-react";
import { SalaryPayment, OvertimeBreakdownItem } from "../types.js";

interface EmployeeOvertimeModalProps {
  salaryRecord: SalaryPayment | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPayslip?: () => void;
}

export const EmployeeOvertimeModal: React.FC<EmployeeOvertimeModalProps> = ({
  salaryRecord,
  isOpen,
  onClose,
  onOpenPayslip
}) => {
  if (!isOpen || !salaryRecord) return null;

  const records = salaryRecord.overtime_breakdown || [];
  const normalHours = salaryRecord.regular_overtime_hours ?? 0;
  const restDayHours = salaryRecord.rest_day_overtime_hours ?? 0;
  const holidayHours = salaryRecord.holiday_overtime_hours ?? 0;
  const nightHours = salaryRecord.night_overtime_hours ?? 0;

  const normalPay = salaryRecord.normal_overtime_pay ?? 0;
  const restDayPay = salaryRecord.rest_day_overtime_pay ?? 0;
  const holidayPay = salaryRecord.holiday_overtime_pay ?? 0;
  const nightPay = salaryRecord.night_overtime_pay ?? 0;

  const normalMult = salaryRecord.normal_overtime_multiplier ?? 1.5;
  const restDayMult = salaryRecord.rest_day_overtime_multiplier ?? 2.0;
  const holidayMult = salaryRecord.holiday_overtime_multiplier ?? 2.5;
  const nightMult = salaryRecord.night_overtime_multiplier ?? 1.5;

  const getTypeBadge = (type: string) => {
    if (type.includes("Holiday")) {
      return "bg-rose-100 text-rose-800 border-rose-200";
    }
    if (type.includes("Rest")) {
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    }
    if (type.includes("Night")) {
      return "bg-purple-100 text-purple-800 border-purple-200";
    }
    return "bg-amber-100 text-amber-800 border-amber-200";
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl border border-amber-200/60">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-800">
                  Overtime Compensation Audit
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  {salaryRecord.period_label || "Selected Pay Period"}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span className="font-semibold text-slate-700">{salaryRecord.full_name}</span>
                <span>•</span>
                <span>Role: {salaryRecord.role || "Staff"}</span>
                <span>•</span>
                <span>Base Wage: {salaryRecord.hourly_rate?.toFixed(2)} ETB/hr</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Overtime Category Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Normal OT */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
                <span>Normal OT ({normalMult}x)</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-1 text-lg font-extrabold text-amber-950">
                {normalHours.toFixed(1)} <span className="text-xs font-semibold text-amber-700">hrs</span>
              </div>
              <div className="text-xs font-mono font-bold text-amber-700 mt-0.5">
                +{normalPay.toFixed(2)} ETB
              </div>
            </div>

            {/* Rest Day OT */}
            <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 flex items-center justify-between">
                <span>Rest Day ({restDayMult}x)</span>
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="mt-1 text-lg font-extrabold text-indigo-950">
                {restDayHours.toFixed(1)} <span className="text-xs font-semibold text-indigo-700">hrs</span>
              </div>
              <div className="text-xs font-mono font-bold text-indigo-700 mt-0.5">
                +{restDayPay.toFixed(2)} ETB
              </div>
            </div>

            {/* Holiday OT */}
            <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center justify-between">
                <span>Holiday ({holidayMult}x)</span>
                <Tag className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="mt-1 text-lg font-extrabold text-rose-950">
                {holidayHours.toFixed(1)} <span className="text-xs font-semibold text-rose-700">hrs</span>
              </div>
              <div className="text-xs font-mono font-bold text-rose-700 mt-0.5">
                +{holidayPay.toFixed(2)} ETB
              </div>
            </div>

            {/* Night OT */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-xl p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800 flex items-center justify-between">
                <span>Night Shift ({nightMult}x)</span>
                <Zap className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <div className="mt-1 text-lg font-extrabold text-purple-950">
                {nightHours.toFixed(1)} <span className="text-xs font-semibold text-purple-700">hrs</span>
              </div>
              <div className="text-xs font-mono font-bold text-purple-700 mt-0.5">
                +{nightPay.toFixed(2)} ETB
              </div>
            </div>
          </div>

          {/* Grand Total Overtime Banner */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Cumulative Approved Overtime Earnings
              </div>
              <div className="text-2xl font-black text-amber-400 mt-0.5">
                {salaryRecord.overtime_pay.toFixed(2)} <span className="text-sm font-bold text-slate-300">ETB</span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <div className="text-slate-400 font-medium">Total OT Hours</div>
                <div className="text-base font-bold text-white">{salaryRecord.overtime_hours.toFixed(1)} hrs</div>
              </div>
              <div className="text-right pl-4 border-l border-slate-700">
                <div className="text-slate-400 font-medium">Approved Sessions</div>
                <div className="text-base font-bold text-emerald-400">
                  {salaryRecord.overtime_records_count || records.length} approved
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Overtime Sessions Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Approved Session Records ({records.length})
            </h4>

            {records.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-400 text-xs font-medium">
                No individual approved overtime punch records logged for this employee in the selected period.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Date (Eth)</th>
                        <th className="py-2.5 px-3">Session</th>
                        <th className="py-2.5 px-3">Overtime Category</th>
                        <th className="py-2.5 px-3 text-center">Hours</th>
                        <th className="py-2.5 px-3 text-center">Multiplier</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Earned (ETB)</th>
                        <th className="py-2.5 px-3">Reason / Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {records.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{rec.date}</td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-semibold">
                              {rec.session || "Shift"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTypeBadge(rec.type)}`}>
                              {rec.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-800">{rec.hours.toFixed(1)}h</td>
                          <td className="py-2 px-3 text-center font-bold text-amber-700">
                            {rec.multiplier}x
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{rec.hourlyRate.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                            +{rec.amount.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-slate-500 max-w-[180px] truncate" title={rec.notes || "Approved overtime work"}>
                            {rec.notes || "Approved overtime work"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Compliant with Ethiopian Labor Proclamation Overtime Multipliers.
          </div>
          <div className="flex items-center gap-2">
            {onOpenPayslip && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPayslip();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-4 rounded-xl text-xs transition shadow-sm"
              >
                Open Full Payslip
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-1.5 px-4 rounded-xl text-xs transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
