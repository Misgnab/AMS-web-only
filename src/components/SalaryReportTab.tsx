import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Printer, 
  Download, 
  Search, 
  Filter, 
  RotateCcw, 
  DollarSign, 
  CreditCard, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Building,
  User as UserIcon,
  ChevronDown,
  Eye,
  Calendar
} from "lucide-react";
import { SalaryPayment, User } from "../types.js";
import { gregorianToEthiopianDate, getEthiopianDateString } from "../utils/ethiopianTime.js";

interface SalaryReportTabProps {
  salaries: SalaryPayment[];
  employees: User[];
  currentPeriodLabel: string;
  onViewBreakdown: (record: SalaryPayment) => void;
  onViewPayslip: (userId: number) => void;
  currentUser?: User | null;
}

export const SalaryReportTab: React.FC<SalaryReportTabProps> = ({
  salaries,
  employees,
  currentPeriodLabel,
  onViewBreakdown,
  onViewPayslip,
  currentUser
}) => {
  // Filters State
  const [periodPreset, setPeriodPreset] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [employeeSearch, setEmployeeSearch] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("ALL");
  const [calcMethodFilter, setCalcMethodFilter] = useState<string>("ALL");
  const [penaltyStatusFilter, setPenaltyStatusFilter] = useState<string>("ALL");

  // Derive unique departments from employees & salaries
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => { if (e.department) set.add(e.department); });
    salaries.forEach(s => { if (s.department) set.add(s.department); });
    return Array.from(set).sort();
  }, [employees, salaries]);

  // Filtered Salaries
  const filteredSalaries = useMemo(() => {
    return salaries.filter(s => {
      // 1. Employee search
      if (employeeSearch) {
        const q = employeeSearch.toLowerCase();
        const matchesName = s.full_name?.toLowerCase().includes(q);
        const matchesId = s.user_id.toString().includes(q);
        const matchesPhone = s.phone_number?.includes(q);
        if (!matchesName && !matchesId && !matchesPhone) return false;
      }

      // 2. Department
      if (departmentFilter !== "ALL") {
        const dept = s.department || "Operations";
        if (dept.toLowerCase() !== departmentFilter.toLowerCase()) return false;
      }

      // 3. Payment Status
      if (paymentStatusFilter !== "ALL") {
        if (s.payment_status !== paymentStatusFilter) return false;
      }

      // 4. Calculation Method
      if (calcMethodFilter !== "ALL") {
        const method = s.calculation_method || "GROSS";
        if (method !== calcMethodFilter) return false;
      }

      // 5. Penalty Status
      if (penaltyStatusFilter !== "ALL") {
        const hasPenalty = (s.penalty_amount || 0) > 0 || (s.late_count || 0) > 0;
        if (penaltyStatusFilter === "PENALIZED") {
          if (!hasPenalty) return false;
        } else if (penaltyStatusFilter === "PAID") {
          if (!hasPenalty || s.payment_status !== "PAID") return false;
        } else if (penaltyStatusFilter === "PENDING") {
          if (!hasPenalty || s.payment_status === "PAID") return false;
        } else if (penaltyStatusFilter === "CANCELLED" || penaltyStatusFilter === "WAIVED") {
          const waived = s.penalties_breakdown?.some(p => p.status === "WAIVED" || p.status === "CANCELLED");
          if (!waived) return false;
        }
      }

      // 6. Custom Date Range
      if (customStartDate && s.period_start && s.period_start < customStartDate) return false;
      if (customEndDate && s.period_end && s.period_end > customEndDate) return false;

      return true;
    });
  }, [salaries, employeeSearch, departmentFilter, paymentStatusFilter, calcMethodFilter, penaltyStatusFilter, customStartDate, customEndDate]);

  // Dynamic Summary Totals calculated strictly on filtered dataset
  const summaryTotals = useMemo(() => {
    const totalEmployees = filteredSalaries.length;
    const totalGrossSalary = filteredSalaries.reduce((acc, s) => acc + (s.gross_salary || 0), 0);
    const totalOvertime = filteredSalaries.reduce((acc, s) => acc + (s.overtime_pay || 0), 0);
    const totalPenalties = filteredSalaries.reduce((acc, s) => acc + (s.penalty_amount || s.late_penalty_deduction || 0), 0);
    const totalTaxes = filteredSalaries.reduce((acc, s) => acc + (s.income_tax || 0), 0);
    const totalPension = filteredSalaries.reduce((acc, s) => acc + (s.pension_employee || 0), 0);
    const totalDeductions = filteredSalaries.reduce((acc, s) => acc + (s.total_deductions || 0), 0);
    const totalPayable = filteredSalaries.reduce((acc, s) => acc + (s.final_payable_amount ?? s.net_salary ?? 0), 0);
    
    const totalPaid = filteredSalaries
      .filter(s => s.payment_status === "PAID")
      .reduce((acc, s) => acc + (s.final_payable_amount ?? s.net_salary ?? 0), 0);

    const totalUnpaid = filteredSalaries
      .filter(s => s.payment_status !== "PAID")
      .reduce((acc, s) => acc + (s.final_payable_amount ?? s.net_salary ?? 0), 0);

    return {
      totalEmployees,
      totalGrossSalary,
      totalOvertime,
      totalPenalties,
      totalTaxes,
      totalPension,
      totalDeductions,
      totalPayable,
      totalPaid,
      totalUnpaid
    };
  }, [filteredSalaries]);

  const handleResetFilters = () => {
    setPeriodPreset("ALL");
    setCustomStartDate("");
    setCustomEndDate("");
    setEmployeeSearch("");
    setDepartmentFilter("ALL");
    setPaymentStatusFilter("ALL");
    setCalcMethodFilter("ALL");
    setPenaltyStatusFilter("ALL");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Department",
      "Salary Period",
      "Calculation Method",
      "Gross Salary",
      "Basic Salary",
      "Overtime Hours",
      "Overtime Amount",
      "Penalties",
      "Tax",
      "Pension (7%)",
      "Other Deductions",
      "Total Deductions",
      "Final Payable Salary",
      "Payment Status",
      "Payment Date",
      "Processed By"
    ];

    const rows = filteredSalaries.map(s => [
      `"${s.user_id}"`,
      `"${(s.full_name || "").replace(/"/g, '""')}"`,
      `"${(s.department || "Operations").replace(/"/g, '""')}"`,
      `"${(s.period_label || `${s.period_start} to ${s.period_end}`).replace(/"/g, '""')}"`,
      `"${s.calculation_method || "GROSS"}"`,
      (s.gross_salary || 0).toFixed(2),
      (s.basic_salary || s.regular_pay || 0).toFixed(2),
      (s.overtime_hours || 0).toFixed(1),
      (s.overtime_pay || 0).toFixed(2),
      (s.penalty_amount || s.late_penalty_deduction || 0).toFixed(2),
      s.calculation_method === "NET" ? "0.00" : (s.income_tax || 0).toFixed(2),
      s.calculation_method === "NET" ? "0.00" : (s.pension_employee || 0).toFixed(2),
      (s.custom_deduction || 0).toFixed(2),
      (s.total_deductions || 0).toFixed(2),
      (s.final_payable_amount ?? s.net_salary ?? 0).toFixed(2),
      `"${s.payment_status || "UNPAID"}"`,
      `"${s.payment_date || ""}"`,
      `"${(s.processed_by_name || "").replace(/"/g, '""')}"`
    ]);

    // Totals row
    const totalsRow = [
      `"TOTALS"`,
      `"${summaryTotals.totalEmployees} Employees"`,
      `""`,
      `""`,
      `""`,
      summaryTotals.totalGrossSalary.toFixed(2),
      `""`,
      `""`,
      summaryTotals.totalOvertime.toFixed(2),
      summaryTotals.totalPenalties.toFixed(2),
      summaryTotals.totalTaxes.toFixed(2),
      summaryTotals.totalPension.toFixed(2),
      `""`,
      summaryTotals.totalDeductions.toFixed(2),
      summaryTotals.totalPayable.toFixed(2),
      `"Paid: ${summaryTotals.totalPaid.toFixed(2)} | Unpaid: ${summaryTotals.totalUnpaid.toFixed(2)}"`,
      `""`,
      `""`
    ];

    const csvContent = [headers.join(","), ...rows.map(r => r.join(",")), totalsRow.join(",")].join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Salary_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const todayIso = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600 w-6 h-6" />
            Comprehensive Salary & Payroll Report
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Audit-grade payroll ledger with multi-dimensional filtering, tax & pension compliance, and formal export formats
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Download CSV spreadsheet"
          >
            <Download size={14} className="text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Print or Save as PDF"
          >
            <Printer size={14} />
            <span>Export PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header (Visible ONLY when printing) */}
      <div className="hidden print:block mb-6 border-b border-slate-400 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Attendance & Payroll Systems</h1>
            <h2 className="text-base font-bold text-slate-700 mt-1">OFFICIAL PAYROLL & SALARY DISBURSEMENT AUDIT REPORT</h2>
            <div className="text-xs text-slate-500 mt-1">
              Reporting Period: <strong>{currentPeriodLabel}</strong> | Applied Department: <strong>{departmentFilter}</strong> | Mode: <strong>{calcMethodFilter}</strong>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Report Date: <strong>{todayIso}</strong></div>
            <div>Generated By: <strong>{currentUser?.full_name || "Payroll Administrator"}</strong></div>
            <div>Role: <strong>{currentUser?.role || "Finance"}</strong></div>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards (Top of Report) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Employees */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Employees</span>
          <div className="text-xl font-black text-slate-900 mt-1">{summaryTotals.totalEmployees}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Matching active filters</div>
        </div>

        {/* Total Gross Salary */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Gross Salary</span>
          <div className="text-xl font-black text-slate-900 mt-1">
            ETB {summaryTotals.totalGrossSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Base + allowances</div>
        </div>

        {/* Total Overtime */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-xl border border-amber-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Total Overtime</span>
          <div className="text-xl font-black text-amber-900 mt-1">
            ETB {summaryTotals.totalOvertime.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-amber-700/80 mt-0.5">Added across both modes</div>
        </div>

        {/* Total Penalties */}
        <div className="bg-gradient-to-br from-rose-50 to-red-50/50 rounded-xl border border-rose-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">Total Penalties</span>
          <div className="text-xl font-black text-rose-700 mt-1">
            -ETB {summaryTotals.totalPenalties.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-rose-600/80 mt-0.5">Lateness & absences</div>
        </div>

        {/* Total Taxes */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Taxes</span>
          <div className="text-xl font-black text-slate-900 mt-1">
            -ETB {summaryTotals.totalTaxes.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Gross mode only</div>
        </div>

        {/* Total Pension */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pension (7%)</span>
          <div className="text-xl font-black text-slate-900 mt-1">
            -ETB {summaryTotals.totalPension.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Gross mode only</div>
        </div>

        {/* Total Deductions */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Deductions</span>
          <div className="text-xl font-black text-rose-700 mt-1">
            -ETB {summaryTotals.totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tax + Pension + Penalties</div>
        </div>

        {/* Total Payable */}
        <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Net Payable</span>
          <div className="text-xl font-black text-emerald-400 mt-1">
            ETB {summaryTotals.totalPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-300 mt-0.5">Final authorized wages</div>
        </div>

        {/* Total Paid */}
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Total Paid</span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            ETB {summaryTotals.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Disbursed successfully</div>
        </div>

        {/* Total Unpaid */}
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3.5 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Total Unpaid</span>
          <div className="text-xl font-black text-amber-700 mt-1">
            ETB {summaryTotals.totalUnpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Pending disbursement</div>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar (Hidden when printing) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3 print:hidden">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
          <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={13} className="text-blue-600" />
            Report Filtering Controls
          </span>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>Reset Filters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Employee Search */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Search Employee</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search by name, ID or phone..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>

          {/* Calculation Method */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Calculation Method</label>
            <select
              value={calcMethodFilter}
              onChange={(e) => setCalcMethodFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Methods</option>
              <option value="GROSS">Based on Gross Salary</option>
              <option value="NET">Based on Net Salary</option>
            </select>
          </div>

          {/* Penalty Status */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Penalty Filter</label>
            <select
              value={penaltyStatusFilter}
              onChange={(e) => setPenaltyStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Records</option>
              <option value="PENALIZED">With Penalties (Penalized)</option>
              <option value="PAID">Penalty Paid / Disbursed</option>
              <option value="PENDING">Penalty Pending</option>
              <option value="WAIVED">With Waived Penalties</option>
            </select>
          </div>

          {/* Custom Date Filter Range */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Custom Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Custom End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 18-Column Detailed Salary Report Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs print:hidden">
          <div className="font-bold text-slate-800">
            Showing {filteredSalaries.length} of {salaries.length} employee payroll records
          </div>
          <span className="text-slate-400 text-[11px]">
            Scroll horizontally to view all 18 standard audit columns
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs min-w-[1700px]">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 uppercase font-extrabold text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-3 sticky left-0 z-20 bg-slate-100 border-r border-slate-200">1. Emp ID</th>
                <th className="py-3 px-4 sticky left-16 z-20 bg-slate-100 border-r border-slate-200">2. Employee Name</th>
                <th className="py-3 px-3">3. Department</th>
                <th className="py-3 px-3">4. Period</th>
                <th className="py-3 px-3 text-center">5. Method</th>
                <th className="py-3 px-3 text-right">6. Gross Salary</th>
                <th className="py-3 px-3 text-right">7. Basic Salary</th>
                <th className="py-3 px-3 text-right">8. OT Hours</th>
                <th className="py-3 px-3 text-right text-amber-900 bg-amber-50/50">9. OT Amount</th>
                <th className="py-3 px-3 text-right text-rose-900 bg-rose-50/50">10. Penalties</th>
                <th className="py-3 px-3 text-right">11. Tax</th>
                <th className="py-3 px-3 text-right">12. Pension (7%)</th>
                <th className="py-3 px-3 text-right">13. Other Deductions</th>
                <th className="py-3 px-3 text-right text-rose-700">14. Total Deductions</th>
                <th className="py-3 px-4 text-right font-black text-slate-900 bg-emerald-50/50">15. Final Payable</th>
                <th className="py-3 px-3 text-center">16. Payment Status</th>
                <th className="py-3 px-3">17. Payment Date</th>
                <th className="py-3 px-3">18. Processed By</th>
                <th className="py-3 px-3 text-right print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSalaries.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-slate-400">
                    <ShieldCheck size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No payroll records match the selected filter criteria</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click "Reset Filters" to return to all records</p>
                  </td>
                </tr>
              ) : (
                filteredSalaries.map(s => {
                  const isNet = s.calculation_method === "NET";
                  const isPaid = s.payment_status === "PAID";
                  const finalPay = s.final_payable_amount ?? s.net_salary ?? 0;

                  return (
                    <tr key={s.user_id} className="hover:bg-slate-50/70 transition">
                      {/* 1. Emp ID */}
                      <td className="py-3 px-3 font-mono font-bold text-slate-500 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200">
                        #{s.user_id}
                      </td>

                      {/* 2. Employee Name */}
                      <td className="py-3 px-4 font-bold text-slate-900 sticky left-16 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{s.full_name}</span>
                          <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">({s.role || "Staff"})</span>
                        </div>
                      </td>

                      {/* 3. Department */}
                      <td className="py-3 px-3 text-slate-600">
                        {s.department || "Operations"}
                      </td>

                      {/* 4. Salary Period */}
                      <td className="py-3 px-3 text-slate-500 text-[11px] font-mono">
                        {s.period_label || `${s.period_start} to ${s.period_end}`}
                      </td>

                      {/* 5. Calculation Method */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isNet ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {isNet ? "Net" : "Gross"}
                        </span>
                      </td>

                      {/* 6. Gross Salary */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                        {(s.gross_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 7. Basic Salary */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {(s.basic_salary || s.regular_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 8. Overtime Hours */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-amber-900">
                        {(s.overtime_hours || 0).toFixed(1)}h
                      </td>

                      {/* 9. Overtime Amount */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 bg-amber-50/30">
                        +{(s.overtime_pay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 10. Penalties */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 bg-rose-50/30">
                        -{(s.penalty_amount || s.late_penalty_deduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 11. Tax */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {isNet ? (
                          <span className="text-[10px] text-purple-700 font-bold">N/A (Net)</span>
                        ) : (
                          `-${(s.income_tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      </td>

                      {/* 12. Pension */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {isNet ? (
                          <span className="text-[10px] text-purple-700 font-bold">N/A (Net)</span>
                        ) : (
                          `-${(s.pension_employee || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        )}
                      </td>

                      {/* 13. Other Deductions */}
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {(s.custom_deduction || 0) > 0 ? `-${(s.custom_deduction || 0).toFixed(2)}` : "0.00"}
                      </td>

                      {/* 14. Total Deductions */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                        -{(s.total_deductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 15. Final Payable Salary */}
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 bg-emerald-50/50">
                        ETB {finalPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 16. Payment Status */}
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          isPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {isPaid ? "PAID" : "UNPAID"}
                        </span>
                      </td>

                      {/* 17. Payment Date */}
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {s.payment_date || "—"}
                      </td>

                      {/* 18. Processed By */}
                      <td className="py-3 px-3 text-slate-600">
                        {s.processed_by_name || (s.processed_by ? `Admin #${s.processed_by}` : "—")}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right print:hidden">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onViewBreakdown(s)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="View Calculation Breakdown"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onViewPayslip(s.user_id)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            title="View Official Payslip"
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Total Row */}
            {filteredSalaries.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-950">
                  <td colSpan={5} className="py-3 px-4 font-black tracking-wider uppercase sticky left-0 z-20 bg-slate-900">
                    REPORT TOTALS ({summaryTotals.totalEmployees} EMPLOYEES)
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                    ETB {summaryTotals.totalGrossSalary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">—</td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">—</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                    +ETB {summaryTotals.totalOvertime.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-rose-300">
                    -ETB {summaryTotals.totalPenalties.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                    -ETB {summaryTotals.totalTaxes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-200">
                    -ETB {summaryTotals.totalPension.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">—</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-rose-300">
                    -ETB {summaryTotals.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-400 text-sm">
                    ETB {summaryTotals.totalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-300">
                    Paid: ETB {summaryTotals.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td colSpan={3} className="py-3 px-3 text-slate-400 text-[11px] font-normal">
                    Unpaid: ETB {summaryTotals.totalUnpaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Printable Report Footer & Signatures (Visible ONLY when printing) */}
      <div className="hidden print:block mt-12 pt-6 border-t border-slate-400 text-xs">
        <div className="grid grid-cols-3 gap-8">
          <div>
            <div className="font-bold text-slate-800">Prepared By:</div>
            <div className="mt-8 border-b border-slate-600 w-48"></div>
            <div className="text-[11px] text-slate-500 mt-1">Payroll Officer Signature</div>
          </div>
          <div>
            <div className="font-bold text-slate-800">Verified & Audited By:</div>
            <div className="mt-8 border-b border-slate-600 w-48"></div>
            <div className="text-[11px] text-slate-500 mt-1">Finance / Accountant Signature</div>
          </div>
          <div>
            <div className="font-bold text-slate-800">Approved for Disbursement:</div>
            <div className="mt-8 border-b border-slate-600 w-48"></div>
            <div className="text-[11px] text-slate-500 mt-1">Managing Director / General Manager</div>
          </div>
        </div>
      </div>
    </div>
  );
};
