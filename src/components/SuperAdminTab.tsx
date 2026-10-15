import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  ShieldAlert,
  ShieldCheck,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit2,
  UserCheck,
  UserX,
  Lock,
  Globe,
  MapPin,
  Wifi,
  Eye,
  Key,
  Layers,
  Calendar,
  Check,
  X,
  Play
} from "lucide-react";
import { useAppStore } from "../store";
import { Workspace, AuditLog } from "../types";

export const SuperAdminTab: React.FC = () => {
  const {
    user,
    workspaces,
    currentWorkspaceId,
    superAdminStats,
    adminUsers,
    auditLogs,
    auditLogsLoading,
    fetchWorkspaces,
    createWorkspace,
    updateWorkspace,
    deactivateWorkspace,
    setCurrentWorkspaceId,
    fetchSuperAdminStats,
    fetchAdminUsers,
    createAdminUser,
    updateAdminUser,
    toggleAdminStatus,
    assignAdminWorkspace,
    fetchAdminWorkspaces,
    updateAdminWorkspaces,
    fetchAuditLogs,
    runSecurityTests
  } = useAppStore();

  const [activeSection, setActiveSection] = useState<"workspaces" | "admins" | "audit" | "security">("workspaces");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isNewWsModalOpen, setIsNewWsModalOpen] = useState(false);
  const [isEditWsModalOpen, setIsEditWsModalOpen] = useState(false);
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);

  const [isNewAdminModalOpen, setIsNewAdminModalOpen] = useState(false);
  const [isEditAdminModalOpen, setIsEditAdminModalOpen] = useState(false);
  const [isAssignWsModalOpen, setIsAssignWsModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any | null>(null);
  const [adminAssignedWsIds, setAdminAssignedWsIds] = useState<number[]>([]);

  // Workspace form
  const [wsName, setWsName] = useState("");
  const [wsDescription, setWsDescription] = useState("");
  const [wsOfficeName, setWsOfficeName] = useState("");
  const [wsLatitude, setWsLatitude] = useState("9.0227");
  const [wsLongitude, setWsLongitude] = useState("38.7460");
  const [wsWifiSsid, setWsWifiSsid] = useState("Office_WiFi");

  // Admin form
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminRole, setAdminRole] = useState("AdminCreator");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminWsId, setAdminWsId] = useState<number>(1);
  const [adminHourlyRate, setAdminHourlyRate] = useState("150.0");
  const [adminMonthlySalary, setAdminMonthlySalary] = useState("0");

  // Audit filter state
  const [auditWsFilter, setAuditWsFilter] = useState<string>("all");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("ALL");
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<string>("ALL");
  const [auditSearch, setAuditSearch] = useState<string>("");

  // Security test state
  const [testRunning, setTestRunning] = useState(false);
  const [testSummary, setTestSummary] = useState<any | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSuperAdminStats(),
      fetchWorkspaces(),
      fetchAdminUsers(),
      fetchAuditLogs()
    ]);
    setLoading(false);
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) {
      showError("Workspace name is required.");
      return;
    }
    const res = await createWorkspace({
      name: wsName.trim(),
      description: wsDescription.trim(),
      office_name: wsOfficeName.trim() || wsName.trim(),
      latitude: parseFloat(wsLatitude) || 9.0227,
      longitude: parseFloat(wsLongitude) || 38.7460,
      wifi_ssid: wsWifiSsid.trim() || "Office_WiFi"
    });
    if (res.success) {
      showSuccess(`Workspace "${wsName}" created successfully!`);
      setIsNewWsModalOpen(false);
      setWsName("");
      setWsDescription("");
      setWsOfficeName("");
      loadAllData();
    } else {
      showError(res.error || "Failed to create workspace.");
    }
  };

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWs) return;
    const res = await updateWorkspace(selectedWs.id, {
      name: wsName.trim(),
      description: wsDescription.trim()
    });
    if (res.success) {
      showSuccess(`Workspace #${selectedWs.id} updated!`);
      setIsEditWsModalOpen(false);
      setSelectedWs(null);
      loadAllData();
    } else {
      showError(res.error || "Failed to update workspace.");
    }
  };

  const handleDeactivateWs = async (ws: Workspace) => {
    if (ws.id === 1) {
      showError("Headquarters workspace (#1) cannot be deactivated.");
      return;
    }
    if (!window.confirm(`Are you sure you want to deactivate workspace "${ws.name}"?`)) return;
    const res = await deactivateWorkspace(ws.id);
    if (res.success) {
      showSuccess(`Workspace "${ws.name}" deactivated.`);
      loadAllData();
    } else {
      showError(res.error || "Failed to deactivate workspace.");
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminFullName.trim() || !adminPhone.trim() || !adminPassword.trim()) {
      showError("Full name, phone number, and password are required.");
      return;
    }
    const res = await createAdminUser({
      full_name: adminFullName.trim(),
      phone_number: adminPhone.trim(),
      role: adminRole,
      password: adminPassword.trim(),
      workspace_id: adminWsId,
      hourly_rate: parseFloat(adminHourlyRate) || 150.0,
      monthly_base_salary: parseFloat(adminMonthlySalary) || 0
    });
    if (res.success) {
      showSuccess(`Administrator "${adminFullName}" provisioned successfully!`);
      setIsNewAdminModalOpen(false);
      setAdminFullName("");
      setAdminPhone("");
      setAdminPassword("");
      loadAllData();
    } else {
      showError(res.error || "Failed to create administrator.");
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;
    const res = await updateAdminUser(selectedAdmin.id, {
      full_name: adminFullName.trim(),
      phone_number: adminPhone.trim(),
      role: adminRole,
      workspace_id: adminWsId,
      hourly_rate: parseFloat(adminHourlyRate) || 150.0,
      monthly_base_salary: parseFloat(adminMonthlySalary) || 0,
      password: adminPassword.trim() || undefined
    });
    if (res.success) {
      showSuccess(`Administrator #${selectedAdmin.id} updated.`);
      setIsEditAdminModalOpen(false);
      setSelectedAdmin(null);
      setAdminPassword("");
      loadAllData();
    } else {
      showError(res.error || "Failed to update administrator.");
    }
  };

  const handleToggleAdminStatus = async (admin: any) => {
    const newStatus = admin.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const promptReason = prompt(`Enter reason for ${newStatus === "SUSPENDED" ? "suspending" : "reactivating"} ${admin.full_name}:`);
    if (promptReason === null) return;
    const res = await toggleAdminStatus(admin.id, newStatus, promptReason);
    if (res.success) {
      showSuccess(`Administrator ${admin.full_name} status updated to ${newStatus}.`);
      loadAllData();
    } else {
      showError(res.error || "Failed to update status.");
    }
  };

  const handleOpenAssignWs = async (admin: any) => {
    setSelectedAdmin(admin);
    const assignedIds = await fetchAdminWorkspaces(admin.id);
    setAdminAssignedWsIds(assignedIds);
    setIsAssignWsModalOpen(true);
  };

  const handleSaveAssignWs = async () => {
    if (!selectedAdmin) return;
    const primaryId = adminAssignedWsIds.length > 0 ? adminAssignedWsIds[0] : selectedAdmin.workspace_id;
    const res = await updateAdminWorkspaces(selectedAdmin.id, adminAssignedWsIds, primaryId);
    if (res.success) {
      showSuccess(`Workspace assignments updated for ${selectedAdmin.full_name}.`);
      setIsAssignWsModalOpen(false);
      setSelectedAdmin(null);
      loadAllData();
    } else {
      showError(res.error || "Failed to update assignments.");
    }
  };

  const handleRunSecurityTests = async () => {
    setTestRunning(true);
    const res = await runSecurityTests();
    setTestRunning(false);
    if (res.success) {
      setTestSummary(res.summary);
      showSuccess(`Automated Security Test Suite completed: ${res.summary?.passed}/${res.summary?.total} checks passed!`);
      fetchAuditLogs();
    } else {
      showError(res.error || "Security test execution failed.");
    }
  };

  const handleAuditFilterSubmit = () => {
    fetchAuditLogs({
      workspaceId: auditWsFilter === "all" ? "all" : parseInt(auditWsFilter, 10),
      action: auditActionFilter,
      outcome: auditOutcomeFilter,
      search: auditSearch
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase">
                Global Super Administrator Console
              </span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Building2 className="text-indigo-400" size={24} />
              Multi-Workspace & Role Administration
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Centralized authority for workspace provisioning, administrator assignments, strict data isolation auditing, and system security controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunSecurityTests}
              disabled={testRunning}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Run Automated Security Isolation Verification Suite"
            >
              <Play size={14} className={testRunning ? "animate-spin" : ""} />
              {testRunning ? "Running Security Tests..." : "Run Security Tests"}
            </button>
            <button
              onClick={loadAllData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shadow-sm cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-indigo-400" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Key Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Workspaces</span>
            <div className="text-xl font-black text-white mt-0.5">{superAdminStats?.totalWorkspaces ?? workspaces.length}</div>
            <span className="text-[10px] text-emerald-400 font-semibold">Active & Isolated</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Administrators</span>
            <div className="text-xl font-black text-white mt-0.5">{superAdminStats?.totalAdmins ?? adminUsers.length}</div>
            <span className="text-[10px] text-indigo-300 font-semibold">Scoped Roles</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Staff</span>
            <div className="text-xl font-black text-white mt-0.5">{superAdminStats?.totalEmployees ?? 0}</div>
            <span className="text-[10px] text-slate-400 font-semibold">All Workspaces</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Today Shifts</span>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{superAdminStats?.todayCheckins ?? 0}</div>
            <span className="text-[10px] text-slate-400 font-semibold">Real-Time</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Tasks</span>
            <div className="text-xl font-black text-amber-400 mt-0.5">
              {(superAdminStats?.pendingRequests ?? 0) + (superAdminStats?.pendingCorrections ?? 0)}
            </div>
            <span className="text-[10px] text-amber-300 font-semibold">Leaves & Corrections</span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Security Denials</span>
            <div className="text-xl font-black text-rose-400 mt-0.5">{superAdminStats?.securityAlertsCount ?? 0}</div>
            <span className="text-[10px] text-rose-300 font-semibold">Blocked IDOR</span>
          </div>
        </div>

        {/* Global Workspace Inspector Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-indigo-400" />
            <span className="text-xs font-bold text-slate-300">Active Workspace Inspection Scope:</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={currentWorkspaceId === null || currentWorkspaceId === "all" ? "all" : String(currentWorkspaceId)}
              onChange={(e) => {
                const val = e.target.value;
                setCurrentWorkspaceId(val === "all" ? "all" : parseInt(val, 10));
              }}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">🏢 All Workspaces (Global View)</option>
              {workspaces.map((ws) => (
                <option key={ws.id} value={String(ws.id)}>
                  📍 Workspace #{ws.id}: {ws.name} ({ws.employee_count ?? 0} staff)
                </option>
              ))}
            </select>
            {currentWorkspaceId && currentWorkspaceId !== "all" && (
              <button
                onClick={() => setCurrentWorkspaceId("all")}
                className="text-[11px] font-bold text-indigo-300 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
              >
                Reset to Global
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3.5 text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3.5 text-xs font-bold flex items-center gap-2 shadow-sm animate-fade-in">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section Navigation Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveSection("workspaces")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            activeSection === "workspaces"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Building2 size={16} />
          Workspaces ({workspaces.length})
        </button>
        <button
          onClick={() => setActiveSection("admins")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            activeSection === "admins"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Users size={16} />
          Administrators ({adminUsers.length})
        </button>
        <button
          onClick={() => setActiveSection("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            activeSection === "audit"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <ShieldAlert size={16} />
          Audit Logs & Security ({auditLogs.length})
        </button>
        <button
          onClick={() => setActiveSection("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
            activeSection === "security"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <ShieldCheck size={16} />
          Security Verification Suite
        </button>
      </div>

      {/* SECTION 1: WORKSPACES MANAGEMENT */}
      {activeSection === "workspaces" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Provisioned Workspaces</h3>
              <p className="text-xs text-gray-500">Each workspace maintains strict independent data isolation across staff, shifts, and payroll.</p>
            </div>
            <button
              onClick={() => {
                setWsName("");
                setWsDescription("");
                setWsOfficeName("");
                setWsLatitude("9.0227");
                setWsLongitude("38.7460");
                setWsWifiSsid("Office_WiFi");
                setIsNewWsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer"
            >
              <Plus size={15} />
              Create New Workspace
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs transition hover:shadow-md flex flex-col justify-between ${
                  currentWorkspaceId === ws.id ? "border-indigo-500 ring-2 ring-indigo-100" : "border-gray-200"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                        #{ws.id}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">{ws.name}</h4>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {ws.id}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ws.status === "ACTIVE" || !ws.status ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ws.status || "ACTIVE"}
                    </span>
                  </div>

                  {ws.description && (
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2">{ws.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 my-3 py-2.5 px-3 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold">Employees</span>
                      <span className="font-bold text-slate-800">{ws.employee_count ?? 0} staff</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-semibold">Admins Assigned</span>
                      <span className="font-bold text-slate-800">{ws.admin_count ?? 0} admins</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-2">
                  <button
                    onClick={() => {
                      setCurrentWorkspaceId(ws.id);
                      showSuccess(`Switched active inspection context to Workspace "${ws.name}".`);
                    }}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                      currentWorkspaceId === ws.id
                        ? "bg-indigo-600 text-white"
                        : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
                    }`}
                  >
                    {currentWorkspaceId === ws.id ? "Inspecting" : "Inspect Workspace"}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedWs(ws);
                        setWsName(ws.name);
                        setWsDescription(ws.description || "");
                        setIsEditWsModalOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                      title="Edit Workspace"
                    >
                      <Edit2 size={15} />
                    </button>
                    {ws.id !== 1 && ws.status !== "INACTIVE" && (
                      <button
                        onClick={() => handleDeactivateWs(ws)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Deactivate Workspace"
                      >
                        <XCircle size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: ADMINISTRATORS MANAGEMENT */}
      {activeSection === "admins" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Workspace Administrators</h3>
              <p className="text-xs text-gray-500">SuperAdmin grants and revokes administrator roles, controls credentials, and assigns authorized workspaces.</p>
            </div>
            <button
              onClick={() => {
                setAdminFullName("");
                setAdminPhone("");
                setAdminRole("AdminCreator");
                setAdminPassword("");
                setAdminWsId(workspaces[0]?.id || 1);
                setAdminHourlyRate("150.0");
                setAdminMonthlySalary("0");
                setIsNewAdminModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer"
            >
              <Plus size={15} />
              Create Administrator
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Primary Workspace</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Compensation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {adminUsers.map((admin) => (
                    <tr key={admin.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{admin.full_name}</div>
                        <div className="text-gray-400 font-mono text-[11px]">{admin.phone_number}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            admin.role === "SuperAdmin"
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-200 font-black"
                              : admin.role === "AdminCreator"
                              ? "bg-blue-100 text-blue-800"
                              : admin.role === "AdminManager"
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {admin.role === "SuperAdmin"
                            ? "Global SuperAdmin"
                            : admin.role === "AdminCreator"
                            ? "Workspace Admin (Normal)"
                            : admin.role === "AdminManager"
                            ? "Workspace Admin (Second)"
                            : admin.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <Building2 size={13} className="text-gray-400" />
                          <span>{admin.workspace_name || `Workspace #${admin.workspace_id || 1}`}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            admin.status === "ACTIVE" || !admin.status
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {admin.status || "ACTIVE"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {admin.hourly_rate ? `${admin.hourly_rate} ETB/hr` : "Standard"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenAssignWs(admin)}
                            className="px-2 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Assign Workspaces"
                          >
                            Workspaces
                          </button>
                          <button
                            onClick={() => {
                              setSelectedAdmin(admin);
                              setAdminFullName(admin.full_name);
                              setAdminPhone(admin.phone_number);
                              setAdminRole(admin.role);
                              setAdminWsId(admin.workspace_id || 1);
                              setAdminHourlyRate(String(admin.hourly_rate || 150));
                              setAdminMonthlySalary(String(admin.monthly_base_salary || 0));
                              setAdminPassword("");
                              setIsEditAdminModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                            title="Edit Administrator"
                          >
                            <Edit2 size={14} />
                          </button>
                          {admin.id !== user?.id && admin.role !== "SuperAdmin" && (
                            <button
                              onClick={() => handleToggleAdminStatus(admin)}
                              className={`p-1.5 rounded-lg transition cursor-pointer ${
                                admin.status === "ACTIVE" || !admin.status
                                  ? "text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                                  : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={admin.status === "ACTIVE" ? "Suspend Access" : "Reactivate Access"}
                            >
                              {admin.status === "ACTIVE" ? <UserX size={14} /> : <UserCheck size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: AUDIT LOGS & SECURITY CONSOLE */}
      {activeSection === "audit" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800">Security Audit Trail</h3>
                <p className="text-xs text-gray-500">Tamper-proof event logs recording access attempts, credential changes, and blocked IDOR violations.</p>
              </div>
              <button
                onClick={handleAuditFilterSubmit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
              >
                <RefreshCw size={13} className={auditLogsLoading ? "animate-spin" : ""} />
                Apply Filters
              </button>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-100">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Workspace Scope</label>
                <select
                  value={auditWsFilter}
                  onChange={(e) => setAuditWsFilter(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-gray-200 text-xs rounded-xl px-2.5 py-1.5 font-semibold text-slate-700"
                >
                  <option value="all">All Workspaces (Global)</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={String(ws.id)}>
                      Workspace #{ws.id}: {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Action Type</label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-gray-200 text-xs rounded-xl px-2.5 py-1.5 font-semibold text-slate-700"
                >
                  <option value="ALL">All Actions</option>
                  <option value="CROSS_WORKSPACE_IDOR_BLOCKED">CROSS_WORKSPACE_IDOR_BLOCKED</option>
                  <option value="UNAUTHORIZED_PERMISSION_ATTEMPT">UNAUTHORIZED_PERMISSION_ATTEMPT</option>
                  <option value="SUPERADMIN_ACCESS_DENIED">SUPERADMIN_ACCESS_DENIED</option>
                  <option value="WORKSPACE_CREATED">WORKSPACE_CREATED</option>
                  <option value="WORKSPACE_UPDATED">WORKSPACE_UPDATED</option>
                  <option value="ADMIN_CREATED">ADMIN_CREATED</option>
                  <option value="ADMIN_UPDATED">ADMIN_UPDATED</option>
                  <option value="ADMIN_SUSPENDED">ADMIN_SUSPENDED</option>
                  <option value="ADMIN_WORKSPACES_UPDATED">ADMIN_WORKSPACES_UPDATED</option>
                  <option value="SECURITY_TEST_SUITE_EXECUTED">SECURITY_TEST_SUITE_EXECUTED</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Outcome</label>
                <select
                  value={auditOutcomeFilter}
                  onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-gray-200 text-xs rounded-xl px-2.5 py-1.5 font-semibold text-slate-700"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="DENIED">DENIED (Security Blocks)</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Search Logs</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuditFilterSubmit()}
                    placeholder="Search details or actor..."
                    className="w-full bg-slate-50 border border-gray-200 text-xs rounded-xl pl-8 pr-2.5 py-1.5 text-slate-800"
                  />
                  <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Workspace</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Outcome</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-400 text-xs">
                        No audit events match the specified criteria.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "Just now"}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-800 whitespace-nowrap">
                          {log.workspace_name || `#${log.workspace_id || 1}`}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{log.actor_name || "System"}</span>
                          {log.actor_role && (
                            <span className="block text-[10px] text-gray-400">{log.actor_role}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-indigo-700 whitespace-nowrap">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              log.outcome === "DENIED"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : log.outcome === "SUCCESS"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {log.outcome || "SUCCESS"}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-md truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] text-gray-400 whitespace-nowrap">
                          {log.ip_address || "127.0.0.1"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: SECURITY VERIFICATION SUITE */}
      {activeSection === "security" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-600" />
                  Automated RBAC & Multi-Workspace Isolation Verification Suite
                </h3>
                <p className="text-xs text-gray-500 max-w-2xl mt-0.5">
                  Provisions ephemeral sandbox workspaces and accounts to prove strict isolation, prevent cross-workspace tampering, verify payroll protection, and confirm audit logging.
                </p>
              </div>

              <button
                onClick={handleRunSecurityTests}
                disabled={testRunning}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Play size={15} className={testRunning ? "animate-spin" : ""} />
                {testRunning ? "Executing Tests..." : "Run All Security Tests"}
              </button>
            </div>

            {testSummary ? (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div
                  className={`p-4 rounded-xl flex items-center justify-between border ${
                    testSummary.allPassed ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-rose-50 border-rose-200 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {testSummary.allPassed ? (
                      <CheckCircle size={28} className="text-emerald-600" />
                    ) : (
                      <AlertTriangle size={28} className="text-rose-600" />
                    )}
                    <div>
                      <h4 className="font-extrabold text-sm">
                        {testSummary.allPassed ? "All Security Tests Passed Successfully!" : "Some Security Tests Failed"}
                      </h4>
                      <p className="text-xs opacity-90">
                        {testSummary.passed} of {testSummary.total} checks passed. Executed at {new Date(testSummary.executedAt).toLocaleTimeString()}.
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-black font-mono">
                    {Math.round((testSummary.passed / testSummary.total) * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {testSummary.results.map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border bg-slate-50/60 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-500 text-[10px] bg-gray-200 px-1.5 py-0.2 rounded">
                            {t.id}
                          </span>
                          <span className="font-bold text-slate-900">{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase">{t.category}</span>
                        </div>
                        <p className="text-gray-500 text-[11px]">{t.description}</p>
                        <p className={`font-mono text-[11px] font-bold mt-1 ${t.passed ? "text-emerald-700" : "text-rose-700"}`}>
                          {t.details}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400 font-mono">{t.durationMs}ms</span>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                            t.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {t.passed ? <Check size={12} /> : <X size={12} />}
                          {t.passed ? "PASSED" : "FAILED"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-gray-300 text-gray-500 space-y-2">
                <ShieldAlert size={32} className="mx-auto text-indigo-400" />
                <p className="text-xs font-semibold">Security test suite has not been run yet in this session.</p>
                <p className="text-[11px] text-gray-400">Click &quot;Run All Security Tests&quot; above to execute automated verification across all 12+ security parameters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE WORKSPACE */}
      {isNewWsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Building2 size={18} className="text-indigo-600" />
                Create New Workspace
              </h3>
              <button onClick={() => setIsNewWsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWorkspace} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Workspace Name *</label>
                <input
                  type="text"
                  required
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="e.g. Hawassa Branch Office"
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Office Display Name</label>
                <input
                  type="text"
                  value={wsOfficeName}
                  onChange={(e) => setWsOfficeName(e.target.value)}
                  placeholder="e.g. Nabi Tech Hawassa"
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Office Latitude</label>
                  <input
                    type="text"
                    value={wsLatitude}
                    onChange={(e) => setWsLatitude(e.target.value)}
                    placeholder="9.0227"
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Office Longitude</label>
                  <input
                    type="text"
                    value={wsLongitude}
                    onChange={(e) => setWsLongitude(e.target.value)}
                    placeholder="38.7460"
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Office Wi-Fi SSID</label>
                <input
                  type="text"
                  value={wsWifiSsid}
                  onChange={(e) => setWsWifiSsid(e.target.value)}
                  placeholder="e.g. Hawassa_HQ_WiFi"
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Description</label>
                <textarea
                  value={wsDescription}
                  onChange={(e) => setWsDescription(e.target.value)}
                  rows={2}
                  placeholder="Operational notes, branch location..."
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewWsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT WORKSPACE */}
      {isEditWsModalOpen && selectedWs && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                Edit Workspace #{selectedWs.id}
              </h3>
              <button onClick={() => setIsEditWsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateWorkspace} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Workspace Name *</label>
                <input
                  type="text"
                  required
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Description</label>
                <textarea
                  value={wsDescription}
                  onChange={(e) => setWsDescription(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditWsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE ADMINISTRATOR */}
      {isNewAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                Create Administrator
              </h3>
              <button onClick={() => setIsNewAdminModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. Abebe Bikila"
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Phone Number (Login ID) *</label>
                <input
                  type="text"
                  required
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="e.g. 0911223344"
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Administrative Role *</label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-semibold"
                  >
                    <option value="AdminCreator">Normal Admin (AdminCreator)</option>
                    <option value="AdminManager">Second Admin (AdminManager)</option>
                    <option value="HR">HR Specialist</option>
                    <option value="Accountant">Accountant / Finance</option>
                    <option value="SuperAdmin">Global Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Assigned Workspace *</label>
                  <select
                    value={adminWsId}
                    onChange={(e) => setAdminWsId(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-semibold"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        #{ws.id}: {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Hourly Rate (ETB)</label>
                  <input
                    type="number"
                    value={adminHourlyRate}
                    onChange={(e) => setAdminHourlyRate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Base Monthly Salary (ETB)</label>
                  <input
                    type="number"
                    value={adminMonthlySalary}
                    onChange={(e) => setAdminMonthlySalary(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewAdminModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ADMINISTRATOR */}
      {isEditAdminModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-600" />
                Edit Administrator #{selectedAdmin.id}
              </h3>
              <button onClick={() => setIsEditAdminModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Role *</label>
                  <select
                    value={adminRole}
                    onChange={(e) => setAdminRole(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-semibold"
                  >
                    <option value="AdminCreator">Normal Admin (AdminCreator)</option>
                    <option value="AdminManager">Second Admin (AdminManager)</option>
                    <option value="HR">HR Specialist</option>
                    <option value="Accountant">Accountant / Finance</option>
                    <option value="SuperAdmin">Global Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Primary Workspace</label>
                  <select
                    value={adminWsId}
                    onChange={(e) => setAdminWsId(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 border border-gray-200 rounded-xl font-semibold"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        #{ws.id}: {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Change Password (leave empty to keep current)</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="New password (optional)"
                  className="w-full p-2.5 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditAdminModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN MULTI-WORKSPACES */}
      {isAssignWsModalOpen && selectedAdmin && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers size={18} className="text-indigo-600" />
                Assign Workspaces: {selectedAdmin.full_name}
              </h3>
              <button onClick={() => setIsAssignWsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Select all workspaces this administrator is explicitly authorized to access and manage:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {workspaces.map((ws) => {
                const isChecked = adminAssignedWsIds.includes(ws.id);
                return (
                  <label
                    key={ws.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      isChecked ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold" : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setAdminAssignedWsIds(adminAssignedWsIds.filter((id) => id !== ws.id));
                          } else {
                            setAdminAssignedWsIds([...adminAssignedWsIds, ws.id]);
                          }
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div>
                        <span className="text-xs font-bold block">{ws.name}</span>
                        <span className="text-[10px] text-gray-400">ID #{ws.id}</span>
                      </div>
                    </div>
                    {adminAssignedWsIds[0] === ws.id && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 font-extrabold uppercase">
                        Primary
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAssignWsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAssignWs}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
              >
                Save Assignments
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
