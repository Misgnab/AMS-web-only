import React, { useState, useMemo } from "react";
import { 
  DollarSign, 
  CreditCard, 
  Clock, 
  Zap, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  TrendingUp, 
  Settings, 
  Edit2, 
  Building, 
  Sliders, 
  Filter, 
  ChevronRight,
  Eye,
  RotateCcw,
  Check,
  Search,
  Users,
  ShieldAlert,
  Send
} from "lucide-react";
import { SalaryPayment, User, EnterprisePayslip } from "../types.js";
import { useAppStore } from "../store.js";
import { SalaryPaymentConfirmationModal } from "./SalaryPaymentConfirmationModal";
import { SalaryBreakdownModal } from "./SalaryBreakdownModal";
import { SalaryReportTab } from "./SalaryReportTab";
import { EmployeePenaltiesModal } from "./EmployeePenaltiesModal";

interface SalaryManagementTabProps {
  salaries: SalaryPayment[];
  employees: User[];
  salaryFilter: string;
  onFilterChange: (newFilter: string) => void;
  onViewPayslip: (userId: number) => void;
  onOpenOvertimeModal: (record: SalaryPayment) => void;
  onOpenCompensationModal: (emp: User) => void;
  loadingPayslipUserId: number | null;
  triggerNotification: (type: "success" | "error" | "info", msg: string) => void;
}

export const SalaryManagementTab: React.FC<SalaryManagementTabProps> = ({
  salaries,
  employees,
  salaryFilter,
  onFilterChange,
  onViewPayslip,
  onOpenOvertimeModal,
  onOpenCompensationModal,
  loadingPayslipUserId,
  triggerNotification
}) => {
  const {
    user: currentUser,
    siteSettings,
    updateDefaultSalaryCalculation,
    updateSalaryCalculationMethod,
    disburseSalary,
    markSalaryUnpaid,
    fetchSalaries,
    fetchPenalties,
    updateHourlyRate
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<"payroll" | "report">("payroll");
  const [selectedBreakdownSalary, setSelectedBreakdownSalary] = useState<SalaryPayment | null>(null);
  const [isBreakdownModalOpen, setIsBreakdownModalOpen] = useState(false);
  const [selectedPenaltiesSalary, setSelectedPenaltiesSalary] = useState<SalaryPayment | null>(null);
  const [isPenaltiesModalOpen, setIsPenaltiesModalOpen] = useState(false);
  const [selectedDisburseSalary, setSelectedDisburseSalary] = useState<SalaryPayment | null>(null);
  const [isDisburseModalOpen, setIsDisburseModalOpen] = useState(false);
  const [isDisbursing, setIsDisbursing] = useState(false);

  // Table filters & search
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "PAID" | "UNPAID">("ALL");
  const [calcMethodFilter, setCalcMethodFilter] = useState<"ALL" | "GROSS" | "NET">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Quick edit hourly rate state
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>("");

  const defaultCalculationMethod = (siteSettings?.default_salary_calculation || "GROSS").toUpperCase() as "GROSS" | "NET";

  // Handle Workspace Default Calculation Method Toggle
  const handleToggleDefaultMethod = async (method: "GROSS" | "NET") => {
    if (method === defaultCalculationMethod) return;
    try {
      const res = await updateDefaultSalaryCalculation(method);
      if (res.success) {
        triggerNotification("success", `Workspace salary calculation mode set to Based on ${method === "NET" ? "Net" : "Gross"} Salary.`);
      } else {
        triggerNotification("error", res.error || "Failed to update calculation method.");
      }
    } catch (e: any) {
      triggerNotification("error", e.message || "Failed to update calculation method.");
    }
  };

  // Handle Single Employee Calculation Method Change
  const handleChangeEmployeeMethod = async (userId: number, method: "GROSS" | "NET") => {
    try {
      const res = await updateSalaryCalculationMethod(userId, method);
      if (res.success) {
        triggerNotification("success", `Updated calculation mode to Based on ${method === "NET" ? "Net" : "Gross"} Salary.`);
      } else {
        triggerNotification("error", res.error || "Failed to update employee method.");
      }
    } catch (e: any) {
      triggerNotification("error", e.message || "Failed to update employee method.");
    }
  };

  // Handle Disbursement Confirmation
  const handleConfirmDisbursement = async (details: {
    payment_method: string;
    payment_reference: string;
    payment_date: string;
    notes?: string;
  }) => {
    if (!selectedDisburseSalary) return;
    setIsDisbursing(true);
    try {
      const res = await disburseSalary({
        user_id: selectedDisburseSalary.user_id,
        filter: salaryFilter,
        startDate: selectedDisburseSalary.period_start,
        endDate: selectedDisburseSalary.period_end,
        payment_method: details.payment_method,
        payment_reference: details.payment_reference,
        payment_date: details.payment_date,
        notes: details.notes
      });

      if (res.success) {
        triggerNotification("success", res.message || `Salary disbursed successfully for ${selectedDisburseSalary.full_name}`);
        setIsDisburseModalOpen(false);
        setSelectedDisburseSalary(null);
        fetchSalaries(salaryFilter);
        fetchPenalties();
      } else {
        triggerNotification("error", res.error || "Failed to process disbursement.");
      }
    } catch (err: any) {
      triggerNotification("error", err.message || "Disbursement processing error");
    } finally {
      setIsDisbursing(false);
    }
  };

  // Handle Mark Unpaid (Revert)
  const handleMarkUnpaid = async (s: SalaryPayment) => {
    if (!window.confirm(`Are you sure you want to revert payment status to UNPAID for ${s.full_name}?`)) {
      return;
    }
    try {
      const res = await markSalaryUnpaid({
        user_id: s.user_id,
        filter: salaryFilter,
        startDate: s.period_start,
        endDate: s.period_end
      });
      if (res.success) {
        triggerNotification("success", `Reverted ${s.full_name}'s payment status to UNPAID.`);
        fetchSalaries(salaryFilter);
        fetchPenalties();
      } else {
        triggerNotification("error", res.error || "Failed to mark salary as unpaid.");
      }
    } catch (e: any) {
      triggerNotification("error", e.message || "Error reverting payment status.");
    }
  };

  // Bulk Disburse All Unpaid Salaries
  const handleDisburseAllUnpaid = async () => {
    const unpaidList = salaries.filter(s => s.payment_status !== "PAID");
    if (unpaidList.length === 0) {
      triggerNotification("info", "All employees on payroll are already marked as PAID.");
      return;
    }

    if (!window.confirm(`Are you sure you want to disburse and mark as PAID all ${unpaidList.length} unpaid employee payrolls?`)) {
      return;
    }

    setIsDisbursing(true);
    try {
      const targetUserIds = unpaidList.map(s => s.user_id);
      const res = await disburseSalary({
        user_ids: targetUserIds,
        filter: salaryFilter,
        startDate: unpaidList[0]?.period_start,
        endDate: unpaidList[0]?.period_end,
        payment_method: "BANK_TRANSFER",
        payment_reference: `BULK-DISB-${Date.now().toString().slice(-6)}`
      });

      if (res.success) {
        triggerNotification("success", `Successfully disbursed payroll for ${unpaidList.length} employee(s). All late penalties marked PENALIZED and notifications cleared.`);
        fetchSalaries(salaryFilter);
        fetchPenalties();
      } else {
        triggerNotification("error", res.error || "Bulk disbursement failed.");
      }
    } catch (e: any) {
      triggerNotification("error", e.message || "Bulk disbursement error.");
    } finally {
      setIsDisbursing(false);
    }
  };

  // Top Summary Metrics (Requirement 5: 10 summary cards)
  const totalEmployees = salaries.length;
  const totalGrossSalary = salaries.reduce((acc, s) => acc + (s.gross_salary || 0), 0);
  const totalOvertime = salaries.reduce((acc, s) => acc + (s.overtime_pay || 0), 0);
  const totalPenalties = salaries.reduce((acc, s) => acc + (s.penalty_amount || s.late_penalty_deduction || 0), 0);
  const totalTaxes = salaries.reduce((acc, s) => acc + (s.income_tax || 0), 0);
  const totalPension = salaries.reduce((acc, s) => acc + (s.pension_employee || 0), 0);
  const totalDeductions = salaries.reduce((acc, s) => acc + (s.total_deductions || 0), 0);
  const totalNetPayable = salaries.reduce((acc, s) => acc + (s.final_payable_amount ?? s.net_salary ?? 0), 0);
  const totalPaid = salaries
    .filter(s => s.payment_status === "PAID")
    .reduce((acc, s) => acc + (s.final_payable_amount ?? s.net_salary ?? 0), 0);
  const totalUnpaid = salaries
    .filter(s => s.payment_status !== "PAID")
    .reduce((acc, s) => acc + (s.final_payable_amount ?? s.net_salary ?? 0), 0);

  const totalOvertimeHours = salaries.reduce((acc, s) => acc + (s.overtime_hours ?? 0), 0);

  // Client-side Filtered Salaries
  const filteredSalaries = useMemo(() => {
    return salaries.filter(s => {
      // 1. Payment status filter
      if (paymentFilter === "PAID" && s.payment_status !== "PAID") return false;
      if (paymentFilter === "UNPAID" && s.payment_status === "PAID") return false;

      // 2. Calculation method filter
      if (calcMethodFilter === "GROSS" && s.calculation_method === "NET") return false;
      if (calcMethodFilter === "NET" && s.calculation_method !== "NET") return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.full_name?.toLowerCase().includes(q);
        const matchId = s.user_id.toString().includes(q);
        const matchPhone = s.phone_number?.includes(q);
        const matchDept = s.department?.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchPhone && !matchDept) return false;
      }

      return true;
    });
  }, [salaries, paymentFilter, calcMethodFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#0F172A] tracking-tight flex items-center gap-2">
            <DollarSign className="text-emerald-600 w-7 h-7" />
            Salary Management & Payroll System
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Enterprise compensation processing with Gross vs. Net calculation selection, overtime, penalties, and comprehensive reports
          </p>
        </div>

        {/* View Switcher: Payroll Processing vs Salary Report */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab("payroll")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "payroll"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard size={14} />
            <span>Payroll Management</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("report")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === "report"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText size={14} />
            <span>Salary Report</span>
          </button>
        </div>
      </div>

      {activeSubTab === "report" ? (
        /* ========================================================================= */
        /* DEDICATED SALARY REPORT TAB                                               */
        /* ========================================================================= */
        <SalaryReportTab
          salaries={salaries}
          employees={employees}
          currentPeriodLabel={salaryFilter}
          onViewBreakdown={(rec) => {
            setSelectedBreakdownSalary(rec);
            setIsBreakdownModalOpen(true);
          }}
          onViewPayslip={onViewPayslip}
          currentUser={currentUser}
        />
      ) : (
        /* ========================================================================= */
        /* PAYROLL PROCESSING DASHBOARD                                              */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Requirement 1: Salary Calculation Method Selection Control */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-blue-600" />
                  Salary Calculation Method
                </span>
                <h3 className="text-base font-bold text-slate-800 mt-0.5">
                  Choose Salary Calculation Basis
                </h3>
              </div>
              <div className="text-xs text-slate-500">
                Workspace Default: <strong className="text-blue-700">Based on {defaultCalculationMethod === "NET" ? "Net" : "Gross"} Salary</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Option A: Based on Gross Salary */}
              <div 
                onClick={() => handleToggleDefaultMethod("GROSS")}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                  defaultCalculationMethod === "GROSS"
                    ? "border-blue-600 bg-blue-50/40 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                  defaultCalculationMethod === "GROSS"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {defaultCalculationMethod === "GROSS" ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-xs" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>Based on Gross Salary</span>
                    {defaultCalculationMethod === "GROSS" && (
                      <span className="px-2 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                        Active Setting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Starts from employee's gross salary. Calculates all applicable <strong>Taxes</strong>, <strong>Pension contributions (7% employee, 11% company)</strong>, <strong>+ Overtime</strong>, and <strong>− Penalties</strong>.
                  </p>
                  <div className="pt-1 text-[11px] font-mono text-blue-700 font-semibold">
                    Gross Salary + Overtime − Penalties − Taxes − Pension − Deductions = Net Payable Salary
                  </div>
                </div>
              </div>

              {/* Option B: Based on Net Salary */}
              <div 
                onClick={() => handleToggleDefaultMethod("NET")}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3.5 ${
                  defaultCalculationMethod === "NET"
                    ? "border-purple-600 bg-purple-50/40 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                  defaultCalculationMethod === "NET"
                    ? "bg-purple-600 border-purple-600 text-white"
                    : "border-slate-300 bg-white"
                }`}>
                  {defaultCalculationMethod === "NET" ? (
                    <Check size={14} strokeWidth={3} />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-xs" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>Based on Net Salary</span>
                    {defaultCalculationMethod === "NET" && (
                      <span className="px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                        Active Setting
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Starts from employee's net salary. <strong>NEVER calculates or deducts taxes or pension</strong>. <strong>+ Overtime</strong> and <strong>− Penalties</strong> are calculated and applied.
                  </p>
                  <div className="pt-1 text-[11px] font-mono text-purple-700 font-semibold">
                    Net Salary + Overtime − Penalties − Other Non-Tax Deductions = Final Payable Salary
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Requirement 5: Professional Salary Management Dashboard Summary Cards (10 Cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* 1. Total Employees */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Employees</span>
              <div className="mt-2 text-2xl font-black text-slate-900 tabular-nums">{totalEmployees}</div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">On Active Payroll</div>
            </div>

            {/* 2. Total Gross Salary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Gross Salary</span>
              <div className="mt-2 text-xl font-black text-slate-900 tabular-nums">
                ETB {totalGrossSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Base + Fixed Allowances</div>
            </div>

            {/* 3. Total Overtime */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Total Overtime</span>
              <div className="mt-2 text-xl font-black text-amber-900 tabular-nums">
                ETB {totalOvertime.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-amber-800 font-medium tabular-nums">{totalOvertimeHours.toFixed(1)} hrs overtime earned</div>
            </div>

            {/* 4. Total Penalties */}
            <div className="bg-gradient-to-br from-rose-50 to-red-50/50 rounded-2xl border border-rose-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total Penalties</span>
              <div className="mt-2 text-xl font-black text-rose-700 tabular-nums">
                -ETB {totalPenalties.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-rose-700 font-medium">Lateness & Absences</div>
            </div>

            {/* 5. Total Taxes */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Taxes</span>
              <div className="mt-2 text-xl font-black text-slate-900 tabular-nums">
                -ETB {totalTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Income Tax (Gross Mode)</div>
            </div>

            {/* 6. Total Pension */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pension (7%)</span>
              <div className="mt-2 text-xl font-black text-slate-900 tabular-nums">
                -ETB {totalPension.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Statutory Employee 7%</div>
            </div>

            {/* 7. Total Deductions */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Deductions</span>
              <div className="mt-2 text-xl font-black text-rose-700 tabular-nums">
                -ETB {totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 font-medium">Penalties + Taxes + Pension</div>
            </div>

            {/* 8. Total Net Payable */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Net Payable</span>
              <div className="mt-2 text-xl font-black text-emerald-400 tabular-nums">
                ETB {totalNetPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-slate-300 font-medium">Total payable wage</div>
            </div>

            {/* 9. Total Paid */}
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Total Paid</span>
              <div className="mt-2 text-xl font-black text-emerald-700 tabular-nums">
                ETB {totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-emerald-600 font-medium">Disbursed successfully</div>
            </div>

            {/* 10. Total Unpaid */}
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Total Unpaid</span>
              <div className="mt-2 text-xl font-black text-amber-700 tabular-nums">
                ETB {totalUnpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-1 text-[11px] text-amber-600 font-medium">Pending disbursement</div>
            </div>
          </div>

          {/* Wage Sheets Table & Payroll Management (Requirements 2, 3, 6) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            {/* Table Header Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Employee Wage Sheets & Overtime Records</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold">
                    {filteredSalaries.length} of {salaries.length} staff
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Overtime additions, penalty deductions, itemized calculations, and payment status tracking
                </p>
              </div>

              {/* Action Buttons: Bulk Disburse + Period Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bulk Disburse All Unpaid Button */}
                {totalUnpaid > 0 && (
                  <button
                    type="button"
                    onClick={handleDisburseAllUnpaid}
                    disabled={isDisbursing}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                    title="Disburse and mark all unpaid salaries as PAID"
                  >
                    <Send size={13} />
                    <span>Disburse All Unpaid ({salaries.filter(s => s.payment_status !== "PAID").length})</span>
                  </button>
                )}

                {/* Period Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {["Daily", "Weekly", "Monthly", "Yearly"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onFilterChange(opt)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        salaryFilter === opt ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Bar: Payment Status Filter, Calculation Method Filter, and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 pb-1 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Payment Status Filter Buttons */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Status:</span>
                  {(["ALL", "PAID", "UNPAID"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPaymentFilter(st)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        paymentFilter === st 
                          ? st === "PAID" 
                            ? "bg-emerald-600 text-white shadow-2xs" 
                            : st === "UNPAID"
                            ? "bg-amber-600 text-white shadow-2xs"
                            : "bg-white text-slate-800 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {st === "ALL" ? "All" : st === "PAID" ? "Paid" : "Unpaid"}
                    </button>
                  ))}
                </div>

                {/* Calculation Method Filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Method:</span>
                  {(["ALL", "GROSS", "NET"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCalcMethodFilter(m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        calcMethodFilter === m 
                          ? m === "GROSS" 
                            ? "bg-blue-600 text-white shadow-2xs" 
                            : m === "NET"
                            ? "bg-purple-600 text-white shadow-2xs"
                            : "bg-white text-slate-800 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {m === "ALL" ? "All Basis" : m === "GROSS" ? "Gross Salary" : "Net Salary"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Input */}
              <div className="relative min-w-[220px]">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff by name or ID..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            {/* Main Table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs text-slate-600 min-w-[1200px]">
                <thead className="bg-slate-100/80 text-slate-500 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5 text-center">Calculation Basis</th>
                    <th className="p-3.5">Base Rate / Salary</th>
                    <th className="p-3.5 text-amber-900 bg-amber-50/40">Overtime Calculations</th>
                    <th className="p-3.5 text-rose-900 bg-rose-50/40">Penalties</th>
                    <th className="p-3.5">Tax & Pension</th>
                    <th className="p-3.5 font-black text-slate-900 bg-emerald-50/50">Final Payable</th>
                    <th className="p-3.5 text-center">Payment Status</th>
                    <th className="p-3.5 text-right">Payroll Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredSalaries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <DollarSign className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="font-bold text-slate-700 text-sm">No employee payroll records match the filter</p>
                        <p className="text-xs text-slate-400 mt-1">Adjust your status, calculation method or search query</p>
                      </td>
                    </tr>
                  ) : (
                    filteredSalaries.map((s) => {
                      const isNet = s.calculation_method === "NET";
                      const isPaid = s.payment_status === "PAID";
                      const finalPay = s.final_payable_amount ?? s.net_salary ?? 0;
                      const otHours = s.overtime_hours ?? 0;
                      const otPay = s.overtime_pay ?? 0;
                      const effectiveRate = s.effective_hourly_rate || s.hourly_rate || 150;
                      const otRate = s.overtime_rate || (otHours > 0 ? otPay / otHours : effectiveRate * 1.5);
                      const penAmount = s.penalty_amount ?? (s.late_penalty_deduction || 0) + (s.absent_deduction || 0);

                      return (
                        <tr key={s.user_id} className="hover:bg-slate-50/70 transition">
                          {/* 1. Employee Info */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {s.full_name?.charAt(0).toUpperCase() || "E"}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{s.full_name}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">#{s.user_id}</span>
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <span>{s.department || "Operations"}</span>
                                  <span>·</span>
                                  <span>{s.phone_number}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Calculation Basis (Requirement 1: Radio Selection) */}
                          <td className="p-3.5 text-center">
                            <div className="inline-flex flex-col items-start gap-1 p-1 bg-slate-50 rounded-lg border border-slate-200">
                              <label 
                                onClick={() => handleChangeEmployeeMethod(s.user_id, "GROSS")}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                              >
                                <input
                                  type="radio"
                                  name={`calc-method-${s.user_id}`}
                                  checked={!isNet}
                                  onChange={() => handleChangeEmployeeMethod(s.user_id, "GROSS")}
                                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span>Based on Gross</span>
                              </label>

                              <label 
                                onClick={() => handleChangeEmployeeMethod(s.user_id, "NET")}
                                className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer hover:text-purple-700"
                              >
                                <input
                                  type="radio"
                                  name={`calc-method-${s.user_id}`}
                                  checked={isNet}
                                  onChange={() => handleChangeEmployeeMethod(s.user_id, "NET")}
                                  className="w-3.5 h-3.5 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                                <span>Based on Net</span>
                              </label>
                            </div>
                          </td>

                          {/* 3. Base Salary & Regular Work */}
                          <td className="p-3.5">
                            <div className="font-bold text-slate-800 tabular-nums">
                              ETB {(s.basic_salary || s.regular_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {(s.regular_hours || 0) % 1 === 0 ? (s.regular_hours || 0).toFixed(1) : Number((s.regular_hours || 0).toFixed(2))} hrs @ ETB {s.hourly_rate?.toFixed(2)}/hr
                            </div>
                          </td>

                          {/* 4. Overtime Calculations (Requirement 2) */}
                          <td className="p-3.5 bg-amber-50/20">
                            <div className="font-black text-amber-900 tabular-nums">
                              +ETB {otPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-amber-800 font-mono mt-0.5">
                              {otHours.toFixed(1)} hrs × ETB {otRate.toFixed(2)}
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                + Addition to Salary
                              </span>
                              {otHours > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onOpenOvertimeModal(s)}
                                  className="text-[10px] text-amber-700 hover:text-amber-900 underline font-bold cursor-pointer"
                                >
                                  Audit
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 5. Penalties (Requirement 3) */}
                          <td className="p-3.5 bg-rose-50/20">
                            <div className="font-black text-rose-600 tabular-nums">
                              {penAmount > 0 ? `-ETB ${penAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "ETB 0.00"}
                            </div>
                            <div className="text-[10px] text-rose-700 mt-0.5">
                              {(s.late_count || 0) > 0 ? `${s.late_count} late (${s.late_minutes || 0}m)` : "No late arrival fine"}
                            </div>
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPenaltiesSalary(s);
                                  setIsPenaltiesModalOpen(true);
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold transition flex items-center gap-1 cursor-pointer w-fit"
                              >
                                <ShieldAlert size={10} />
                                <span>View Penalties ({(s.penalties_breakdown || []).length})</span>
                              </button>
                            </div>
                          </td>

                          {/* 6. Tax & Pension */}
                          <td className="p-3.5">
                            {isNet ? (
                              <div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-bold block w-fit">
                                  N/A (Net Mode)
                                </span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">
                                  Taxes & pension excluded
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-0.5 text-[11px]">
                                <div className="text-slate-700">
                                  Tax: <strong className="font-mono text-rose-600 tabular-nums">-ETB {(s.income_tax || 0).toFixed(0)}</strong>
                                </div>
                                <div className="text-slate-500 text-[10px]">
                                  Pension: <strong className="font-mono text-rose-600 tabular-nums">-ETB {(s.pension_employee || 0).toFixed(0)}</strong>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 7. Final Net Payable */}
                          <td className="p-3.5 bg-emerald-50/50">
                            <div className="text-sm font-black text-slate-900 tabular-nums">
                              ETB {finalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider mt-0.5">
                              {isNet ? "Net + OT − Pen" : "Gross + OT − Pen − Tax"}
                            </div>
                          </td>

                          {/* 8. Payment Status (Requirement 6) */}
                          <td className="p-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              isPaid 
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}>
                              {isPaid ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              <span>{isPaid ? "PAID" : "UNPAID"}</span>
                            </span>
                            {isPaid && s.payment_date && (
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                {s.payment_date}
                              </div>
                            )}
                          </td>

                          {/* 9. Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* View Details / Breakdown */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBreakdownSalary(s);
                                  setIsBreakdownModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                                title="View calculation breakdown"
                              >
                                <Eye size={12} />
                                <span>Breakdown</span>
                              </button>

                              {/* Official Payslip */}
                              <button
                                type="button"
                                onClick={() => onViewPayslip(s.user_id)}
                                disabled={loadingPayslipUserId === s.user_id}
                                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                                title="View itemized official payslip"
                              >
                                {loadingPayslipUserId === s.user_id ? (
                                  <RefreshCw size={11} className="animate-spin" />
                                ) : (
                                  <FileText size={11} />
                                )}
                                <span>Payslip</span>
                              </button>

                              {/* Pay Salary / Revert Workflow (Requirement 6) */}
                              {!isPaid ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedDisburseSalary(s);
                                    setIsDisburseModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                                  title="Pay salary with confirmation dialog"
                                >
                                  <CreditCard size={11} />
                                  <span>Pay Salary</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMarkUnpaid(s)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold text-[10px] transition cursor-pointer"
                                  title="Revert payment status to Unpaid"
                                >
                                  Revert
                                </button>
                              )}

                              {/* Overtime Audit */}
                              {otHours > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onOpenOvertimeModal(s)}
                                  className="p-1 text-amber-700 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                                  title="Audit Overtime records"
                                >
                                  <Zap size={14} />
                                </button>
                              )}

                              {/* Settings / Compensation */}
                              <button
                                type="button"
                                onClick={() => {
                                  const emp = employees.find(e => e.id === s.user_id) || ({
                                    id: s.user_id,
                                    full_name: s.full_name,
                                    phone_number: s.phone_number,
                                    role: s.role || "Employee",
                                    hourly_rate: s.hourly_rate,
                                    monthly_base_salary: s.monthly_base_salary
                                  } as any);
                                  onOpenCompensationModal(emp);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Configure salary, calculation mode and allowances"
                              >
                                <Settings size={14} />
                              </button>
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

      {/* Salary Payment Confirmation Modal (Requirement 6) */}
      <SalaryPaymentConfirmationModal
        salary={selectedDisburseSalary}
        isOpen={isDisburseModalOpen}
        onClose={() => {
          setIsDisburseModalOpen(false);
          setSelectedDisburseSalary(null);
        }}
        onConfirm={handleConfirmDisbursement}
        isProcessing={isDisbursing}
      />

      {/* Salary Mathematical Breakdown Modal */}
      <SalaryBreakdownModal
        salary={selectedBreakdownSalary}
        isOpen={isBreakdownModalOpen}
        onClose={() => {
          setIsBreakdownModalOpen(false);
          setSelectedBreakdownSalary(null);
        }}
        onOpenPayslip={onViewPayslip}
      />

      {/* Itemized Employee Penalties Modal (Requirement 3) */}
      <EmployeePenaltiesModal
        salary={selectedPenaltiesSalary}
        isOpen={isPenaltiesModalOpen}
        onClose={() => {
          setIsPenaltiesModalOpen(false);
          setSelectedPenaltiesSalary(null);
        }}
      />
    </div>
  );
};
