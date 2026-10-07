import React, { useState, useEffect } from "react";
import { 
  X, 
  DollarSign, 
  Briefcase, 
  CreditCard, 
  ShieldCheck, 
  Building, 
  AlertCircle, 
  CheckCircle2, 
  Save,
  Calculator
} from "lucide-react";
import { User, CompensationUpdatePayload } from "../types.js";
import { useAppStore } from "../store.js";

interface EditCompensationModalProps {
  employee: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditCompensationModal: React.FC<EditCompensationModalProps> = ({
  employee,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { updateCompensation } = useAppStore();
  const [formData, setFormData] = useState<CompensationUpdatePayload>({
    hourly_rate: 0,
    monthly_base_salary: 0,
    transport_allowance: 0,
    housing_allowance: 0,
    position_allowance: 0,
    tax_id: "",
    bank_name: "Commercial Bank of Ethiopia (CBE)",
    bank_account_number: "",
    custom_deduction: 0,
    salary_calculation_mode: "GROSS",
    department: "Operations"
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (employee) {
      setFormData({
        hourly_rate: employee.hourly_rate ?? 0,
        monthly_base_salary: employee.monthly_base_salary ?? (employee.hourly_rate ? Number((employee.hourly_rate * 160).toFixed(2)) : 0),
        transport_allowance: employee.transport_allowance ?? 0,
        housing_allowance: employee.housing_allowance ?? 0,
        position_allowance: employee.position_allowance ?? 0,
        tax_id: employee.tax_id ?? "",
        bank_name: employee.bank_name ?? "Commercial Bank of Ethiopia (CBE)",
        bank_account_number: employee.bank_account_number ?? "",
        custom_deduction: employee.custom_deduction ?? 0,
        salary_calculation_mode: (employee.salary_calculation_mode as "GROSS" | "NET") || "GROSS",
        department: employee.department || "Operations"
      });
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleBaseSalaryChange = (val: number) => {
    const hourly = Number((val / 160).toFixed(2));
    setFormData(prev => ({
      ...prev,
      monthly_base_salary: val,
      hourly_rate: hourly
    }));
  };

  const handleHourlyRateChange = (val: number) => {
    const monthly = Number((val * 160).toFixed(2));
    setFormData(prev => ({
      ...prev,
      hourly_rate: val,
      monthly_base_salary: monthly
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await updateCompensation(employee.id, formData);
      if (res.success) {
        setSuccessMsg("Employee compensation package updated successfully!");
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 900);
      } else {
        setErrorMsg(res.error || "Failed to update compensation");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const totalFixedGross = 
    (formData.monthly_base_salary || 0) + 
    (formData.transport_allowance || 0) + 
    (formData.housing_allowance || 0) + 
    (formData.position_allowance || 0);

  return (
    <div id="edit-compensation-backdrop" className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div id="edit-compensation-modal" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Configure Compensation Package</h2>
              <p className="text-xs text-slate-500">{employee.full_name} ({employee.role}) - EMP-{employee.id.toString().padStart(4, "0")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Salary Calculation Method: Gross vs Net Selection */}
          <div className="space-y-3 p-4 bg-slate-50/90 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/80">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                <span>Salary Calculation Method</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Select one calculation basis</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Based on Gross Salary */}
              <div 
                onClick={() => setFormData(prev => ({ ...prev, salary_calculation_mode: "GROSS" }))}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.salary_calculation_mode === "GROSS"
                    ? "border-indigo-600 bg-indigo-50/60 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="salary_calculation_mode"
                    id="calc-mode-gross"
                    checked={formData.salary_calculation_mode === "GROSS"}
                    onChange={() => setFormData(prev => ({ ...prev, salary_calculation_mode: "GROSS" }))}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label htmlFor="calc-mode-gross" className="text-xs font-bold text-slate-900 cursor-pointer block">
                      Based on Gross Salary
                    </label>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Starts from gross salary. Calculates and deducts statutory <strong>Taxes</strong> and <strong>Pension (7%)</strong>, plus overtime and penalties.
                    </p>
                    <div className="mt-2 font-mono text-[10px] text-indigo-900 font-semibold bg-white/90 p-2 rounded-lg border border-indigo-100/80">
                      Gross + Overtime − Penalties − Taxes − Pension − Deductions = <span className="text-indigo-700 font-bold">Net Payable</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Option 2: Based on Net Salary */}
              <div 
                onClick={() => setFormData(prev => ({ ...prev, salary_calculation_mode: "NET" }))}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  formData.salary_calculation_mode === "NET"
                    ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    name="salary_calculation_mode"
                    id="calc-mode-net"
                    checked={formData.salary_calculation_mode === "NET"}
                    onChange={() => setFormData(prev => ({ ...prev, salary_calculation_mode: "NET" }))}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label htmlFor="calc-mode-net" className="text-xs font-bold text-slate-900 cursor-pointer block">
                      Based on Net Salary
                    </label>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Starts directly from net salary. <strong>Do NOT calculate or deduct taxes or pension</strong>. Overtime & penalties are applied.
                    </p>
                    <div className="mt-2 font-mono text-[10px] text-emerald-900 font-semibold bg-white/90 p-2 rounded-lg border border-emerald-100/80">
                      Net + Overtime − Penalties − Other deductions = <span className="text-emerald-700 font-bold">Final Payable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Base Wage Structure */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
              <span>1. Base Wage & Rates</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Base Salary (ETB)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.monthly_base_salary}
                    onChange={(e) => handleBaseSalaryChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-3 pr-12 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold text-slate-800"
                    placeholder="e.g. 15000"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">ETB/mo</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Full month contract wage</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hourly Rate (ETB / hr)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourly_rate}
                    onChange={(e) => handleHourlyRateChange(parseFloat(e.target.value) || 0)}
                    className="w-full pl-3 pr-12 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono font-bold text-slate-800"
                    placeholder="e.g. 93.75"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">ETB/hr</span>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">Auto-synced with monthly (160h base)</span>
              </div>
            </div>
          </div>

          {/* Monthly Allowances */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              <span>2. Monthly Fixed Allowances</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transport Allowance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.transport_allowance}
                    onChange={(e) => setFormData({ ...formData, transport_allowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Housing Allowance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.housing_allowance}
                    onChange={(e) => setFormData({ ...formData, housing_allowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Position / Site Allowance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.position_allowance}
                    onChange={(e) => setFormData({ ...formData, position_allowance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-xl border flex justify-between items-center text-xs ${
              formData.salary_calculation_mode === "NET" 
                ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" 
                : "bg-indigo-50/70 border-indigo-200 text-indigo-950"
            }`}>
              <span className="font-semibold">
                {formData.salary_calculation_mode === "NET" ? "Total Contract Net Base Pay:" : "Total Contract Gross Package:"}
              </span>
              <div className="text-right">
                <span className="font-mono font-black text-sm">
                  {totalFixedGross.toFixed(2)} ETB/mo
                </span>
                <span className="text-[10px] block font-medium opacity-80">
                  {formData.salary_calculation_mode === "NET" ? "(Exempt from tax & pension deductions)" : "(Subject to standard tax & 7% pension)"}
                </span>
              </div>
            </div>
          </div>

          {/* Banking & Statutory Details */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-slate-100">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              <span>3. Banking & Statutory Registration</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bank Name
                </label>
                <select
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="Commercial Bank of Ethiopia (CBE)">Commercial Bank of Ethiopia (CBE)</option>
                  <option value="Telebirr (Ethio Telecom)">Telebirr (Ethio Telecom)</option>
                  <option value="Dashen Bank">Dashen Bank</option>
                  <option value="Awash Bank">Awash Bank</option>
                  <option value="Bank of Abyssinia (BOA)">Bank of Abyssinia (BOA)</option>
                  <option value="Nib International Bank">Nib International Bank</option>
                  <option value="Cooperative Bank of Oromia">Cooperative Bank of Oromia</option>
                  <option value="United Bank (Hibret Bank)">United Bank (Hibret Bank)</option>
                  <option value="Zemen Bank">Zemen Bank</option>
                  <option value="Oromia International Bank">Oromia International Bank</option>
                  <option value="Berhan International Bank">Berhan International Bank</option>
                  <option value="CBE Birr">CBE Birr</option>
                  <option value="Cash / Manual Disbursement">Cash / Manual Disbursement</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Account Number / Phone (Telebirr)
                </label>
                <input
                  type="text"
                  value={formData.bank_account_number}
                  onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="e.g. 1000293848123 or 0911..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tax Identification Number (TIN) / Pension ID
                </label>
                <input
                  type="text"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono"
                  placeholder="e.g. TIN-00492812"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Custom Advance / Recurring Loan Deduction
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.custom_deduction}
                  onChange={(e) => setFormData({ ...formData, custom_deduction: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono text-rose-700"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Tax & pension automatically recomputed on payslips
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Saving Package..." : "Save Compensation Package"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
