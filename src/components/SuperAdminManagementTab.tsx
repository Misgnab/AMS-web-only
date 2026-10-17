import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../store.js";
import { WorkspaceItem, WorkspaceAdminUser, SuperAdminAuditLog } from "../types.js";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Clock,
  RefreshCw,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  Lock,
  Search,
  Filter,
  Eye,
  FileText,
  Key,
  Globe,
  Briefcase,
  ChevronRight,
  Database,
  Layers,
  ArrowRight
} from "lucide-react";

export const SuperAdminManagementTab: React.FC = () => {
  const {
    user,
    superAdminOverview,
    superAdminWorkspaces,
    superAdminAdmins,
    superAdminAuditLogs,
    superAdminSecurityEvents,
    superAdminLoading,
    fetchSuperAdminOverview,
    fetchSuperAdminWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    fetchSuperAdminAdmins,
    createWorkspaceAdmin,
    updateWorkspaceAdmin,
    toggleAdminStatus,
    fetchSuperAdminAuditLogs,
    fetchSuperAdminSecurityEvents
  } = useAppStore();

  const [activeSubTab, setActiveSubTab] = useState<"workspaces" | "admins" | "audit" | "security">("workspaces");

  // Notifications / Feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals state
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceItem | null>(null);
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    code: "",
    description: "",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE"
  });

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<WorkspaceAdminUser | null>(null);
  const [adminForm, setAdminForm] = useState({
    full_name: "",
    phone_number: "",
    role: "AdminCreator" as "SuperAdmin" | "AdminCreator" | "AdminManager" | "HR" | "Accountant",
    workspace_id: 1,
    department: "Operations",
    password: "",
    status: "ACTIVE" as "ACTIVE" | "SUSPENDED"
  });

  // Audit filter state
  const [auditFilterWs, setAuditFilterWs] = useState<string>("all");
  const [auditFilterAction, setAuditFilterAction] = useState<string>("");
  const [auditFilterOutcome, setAuditFilterOutcome] = useState<string>("");
  const [auditSearch, setAuditSearch] = useState<string>("");
  const [selectedAuditLog, setSelectedAuditLog] = useState<SuperAdminAuditLog | null>(null);

  // Admin filter state
  const [adminFilterWs, setAdminFilterWs] = useState<string>("all");
  const [adminFilterRole, setAdminFilterRole] = useState<string>("all");
  const [adminSearch, setAdminSearch] = useState<string>("");

  useEffect(() => {
    fetchSuperAdminOverview();
    fetchSuperAdminWorkspaces();
    fetchSuperAdminAdmins();
    fetchSuperAdminAuditLogs();
    fetchSuperAdminSecurityEvents();
  }, []);

  const triggerSuccess = (msg: string) => {
    setActionSuccess(msg);
    setActionError(null);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const triggerError = (msg: string) => {
    setActionError(msg);
    setActionSuccess(null);
    setTimeout(() => setActionError(null), 7000);
  };

  // Open Workspace Modal
  const openCreateWorkspace = () => {
    setEditingWorkspace(null);
    setWorkspaceForm({ name: "", code: "", description: "", status: "ACTIVE" });
    setIsWorkspaceModalOpen(true);
  };

  const openEditWorkspace = (ws: WorkspaceItem) => {
    setEditingWorkspace(ws);
    setWorkspaceForm({
      name: ws.name,
      code: ws.code || "",
      description: ws.description || "",
      status: ws.status || "ACTIVE"
    });
    setIsWorkspaceModalOpen(true);
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceForm.name.trim()) {
      triggerError("Workspace name is required.");
      return;
    }

    setIsSubmitting(true);
    if (editingWorkspace) {
      const res = await updateWorkspace(editingWorkspace.id, workspaceForm);
      setIsSubmitting(false);
      if (res.success) {
        setIsWorkspaceModalOpen(false);
        triggerSuccess(`Workspace '${workspaceForm.name}' updated successfully.`);
      } else {
        triggerError(res.error || "Failed to update workspace.");
      }
    } else {
      const res = await createWorkspace(workspaceForm);
      setIsSubmitting(false);
      if (res.success) {
        setIsWorkspaceModalOpen(false);
        triggerSuccess(`New workspace '${workspaceForm.name}' created successfully.`);
      } else {
        triggerError(res.error || "Failed to create workspace.");
      }
    }
  };

  const handleDeleteWorkspace = async (ws: WorkspaceItem) => {
    if (ws.id === 1) {
      triggerError("Headquarters workspace (ID 1) cannot be deleted.");
      return;
    }
    const confirmPrompt = window.confirm(
      `Are you sure you want to deactivate or remove workspace '${ws.name}'? All data will remain protected.`
    );
    if (!confirmPrompt) return;

    setIsSubmitting(true);
    const res = await deleteWorkspace(ws.id);
    setIsSubmitting(false);
    if (res.success) {
      triggerSuccess(res.message || `Workspace '${ws.name}' removed.`);
    } else {
      triggerError(res.error || "Could not delete workspace.");
    }
  };

  // Open Admin Modal
  const openCreateAdmin = () => {
    setEditingAdmin(null);
    setAdminForm({
      full_name: "",
      phone_number: "",
      role: "AdminCreator",
      workspace_id: superAdminWorkspaces[0]?.id || 1,
      department: "Management",
      password: "",
      status: "ACTIVE"
    });
    setIsAdminModalOpen(true);
  };

  const openEditAdmin = (adm: WorkspaceAdminUser) => {
    setEditingAdmin(adm);
    setAdminForm({
      full_name: adm.full_name,
      phone_number: adm.phone_number,
      role: adm.role as any,
      workspace_id: adm.workspace_id || 1,
      department: adm.department || "Management",
      password: "",
      status: adm.status || "ACTIVE"
    });
    setIsAdminModalOpen(true);
  };

  const handleSaveAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.full_name.trim() || !adminForm.phone_number.trim()) {
      triggerError("Full name and phone number are required.");
      return;
    }
    if (!editingAdmin && !adminForm.password.trim()) {
      triggerError("Password is required when creating a new administrator.");
      return;
    }

    setIsSubmitting(true);
    if (editingAdmin) {
      const res = await updateWorkspaceAdmin(editingAdmin.id, {
        full_name: adminForm.full_name,
        phone_number: adminForm.phone_number,
        role: adminForm.role,
        workspace_id: adminForm.workspace_id,
        department: adminForm.department,
        password: adminForm.password.trim() ? adminForm.password.trim() : undefined,
        status: adminForm.status
      });
      setIsSubmitting(false);
      if (res.success) {
        setIsAdminModalOpen(false);
        triggerSuccess(`Administrator '${adminForm.full_name}' updated successfully.`);
      } else {
        triggerError(res.error || "Failed to update administrator.");
      }
    } else {
      const res = await createWorkspaceAdmin({
        full_name: adminForm.full_name,
        phone_number: adminForm.phone_number,
        role: adminForm.role,
        workspace_id: adminForm.workspace_id,
        department: adminForm.department,
        password: adminForm.password
      });
      setIsSubmitting(false);
      if (res.success) {
        setIsAdminModalOpen(false);
        triggerSuccess(`New administrator '${adminForm.full_name}' created successfully.`);
      } else {
        triggerError(res.error || "Failed to create administrator.");
      }
    }
  };

  const handleToggleAdminStatus = async (adm: WorkspaceAdminUser) => {
    if (adm.id === user?.id) {
      triggerError("You cannot suspend your own Super Administrator account.");
      return;
    }
    const newStatus = adm.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const confirmAction = window.confirm(
      `Are you sure you want to change status of ${adm.full_name} (${adm.role}) to ${newStatus}?`
    );
    if (!confirmAction) return;

    setIsSubmitting(true);
    const res = await toggleAdminStatus(adm.id, newStatus);
    setIsSubmitting(false);
    if (res.success) {
      triggerSuccess(`Administrator '${adm.full_name}' is now ${newStatus}.`);
    } else {
      triggerError(res.error || "Failed to update administrator status.");
    }
  };

  const handleApplyAuditFilters = () => {
    fetchSuperAdminAuditLogs({
      workspace_id: auditFilterWs,
      action: auditFilterAction || undefined,
      outcome: auditFilterOutcome || undefined,
      search: auditSearch || undefined
    });
  };

  const filteredAdmins = useMemo(() => {
    return superAdminAdmins.filter((adm) => {
      if (adminFilterWs !== "all" && String(adm.workspace_id) !== adminFilterWs) return false;
      if (adminFilterRole !== "all" && adm.role !== adminFilterRole) return false;
      if (adminSearch.trim()) {
        const query = adminSearch.toLowerCase();
        const matchesName = adm.full_name.toLowerCase().includes(query);
        const matchesPhone = adm.phone_number.includes(query);
        const matchesDept = (adm.department || "").toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesDept) return false;
      }
      return true;
    });
  }, [superAdminAdmins, adminFilterWs, adminFilterRole, adminSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/60 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 rounded-full text-xs font-black tracking-widest uppercase flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-400" />
                Super Admin Governance Center
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-full text-[11px] font-bold">
                Global RBAC Active
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Multi-Workspace & Role Management
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Centralized administrative authority: provision isolated workspaces, authorize administrators, audit security operations, and review system-wide telemetry with strict data protection.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={() => {
                fetchSuperAdminOverview();
                fetchSuperAdminWorkspaces();
                fetchSuperAdminAdmins();
                fetchSuperAdminAuditLogs();
                fetchSuperAdminSecurityEvents();
                triggerSuccess("Refreshed all system telemetry.");
              }}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw size={14} className={superAdminLoading ? "animate-spin text-indigo-400" : ""} />
              <span>Refresh Metrics</span>
            </button>
            <button
              onClick={openCreateWorkspace}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-900/30 cursor-pointer"
            >
              <Plus size={15} />
              <span>New Workspace</span>
            </button>
          </div>
        </div>

        {/* Global KPI Cards */}
        {superAdminOverview && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-indigo-900/40 text-slate-200">
            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Workspaces</span>
                <Building2 size={16} className="text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {superAdminOverview.totalWorkspaces}
              </div>
              <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                {superAdminOverview.activeWorkspaces} Active ({superAdminOverview.inactiveWorkspaces} Inactive)
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Workspace Admins</span>
                <Users size={16} className="text-blue-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {superAdminOverview.totalAdmins}
              </div>
              <div className="text-[11px] text-emerald-400 font-bold mt-0.5">
                {superAdminOverview.activeAdmins} Active ({superAdminOverview.suspendedAdmins} Suspended)
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total Workforce</span>
                <UserCheck size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {superAdminOverview.totalEmployees}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                Across all sites
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Today's Attendance</span>
                <Clock size={16} className="text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {superAdminOverview.todayAttendanceAcrossWorkspaces}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                Live check-ins
              </div>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Security Events</span>
                <ShieldAlert size={16} className="text-rose-400" />
              </div>
              <div className="text-2xl font-black text-white mt-1">
                {superAdminOverview.securityEventsCount}
              </div>
              <div className="text-[11px] text-rose-300 font-bold mt-0.5">
                Audited & Logged
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Banners */}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            <span className="text-sm font-bold">{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <XCircle size={18} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-600 shrink-0" />
            <span className="text-sm font-bold">{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">
            <XCircle size={18} />
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3">
        <button
          onClick={() => setActiveSubTab("workspaces")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeSubTab === "workspaces"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Building2 size={16} />
          <span>Workspaces ({superAdminWorkspaces.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("admins")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeSubTab === "admins"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Users size={16} />
          <span>Administrators & RBAC ({superAdminAdmins.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeSubTab === "audit"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <FileText size={16} />
          <span>Global Audit Log</span>
        </button>

        <button
          onClick={() => setActiveSubTab("security")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeSubTab === "security"
              ? "bg-indigo-600 text-white shadow-sm"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <ShieldAlert size={16} />
          <span>Security Events & Logins</span>
          {superAdminSecurityEvents.length > 0 && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-black ${
              activeSubTab === "security" ? "bg-white text-indigo-700" : "bg-rose-500 text-white"
            }`}>
              {superAdminSecurityEvents.length}
            </span>
          )}
        </button>
      </div>

      {/* ==================================================================== */}
      {/* SUB-TAB 1: WORKSPACES CENTRAL */}
      {/* ==================================================================== */}
      {activeSubTab === "workspaces" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-800">Provisioned Workspaces Directory</h3>
              <p className="text-xs text-slate-500">Each workspace is strictly isolated: independent attendance rules, work calendar, and payroll policies.</p>
            </div>
            <button
              onClick={openCreateWorkspace}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>Provision New Workspace</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {superAdminWorkspaces.map((ws) => (
              <div
                key={ws.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition hover:shadow-md ${
                  ws.status === "INACTIVE" ? "border-gray-200 opacity-75 bg-gray-50/60" : "border-gray-200"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${
                        ws.status === "INACTIVE"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-indigo-100 text-indigo-700"
                      }`}>
                        {ws.code || ws.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base leading-tight">{ws.name}</h4>
                        <span className="text-[11px] text-slate-400 font-mono">Workspace ID: #{ws.id}</span>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      ws.status === "INACTIVE"
                        ? "bg-gray-100 text-gray-600 border border-gray-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      {ws.status || "ACTIVE"}
                    </span>
                  </div>

                  {ws.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {ws.description}
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
                    <div className="bg-slate-50 rounded-xl p-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Admins</div>
                      <div className="text-sm font-black text-slate-800">{ws.admin_count ?? 0}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Staff</div>
                      <div className="text-sm font-black text-slate-800">{ws.employee_count ?? 0}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Today</div>
                      <div className="text-sm font-black text-indigo-600">{ws.today_attendance_count ?? 0}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Created {new Date(ws.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditWorkspace(ws)}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    {ws.id !== 1 && (
                      <button
                        onClick={() => handleDeleteWorkspace(ws)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        title={ws.status === "ACTIVE" ? "Deactivate Workspace" : "Delete Workspace"}
                      >
                        {ws.status === "ACTIVE" ? "Deactivate" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUB-TAB 2: ADMINISTRATORS DIRECTORY & ASSIGNMENTS */}
      {/* ==================================================================== */}
      {activeSubTab === "admins" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-800">Workspace Administrators Directory</h3>
              <p className="text-xs text-slate-500">Configure administrator accounts, assign them to authorized workspaces, and suspend or reactivate access.</p>
            </div>
            <button
              onClick={openCreateAdmin}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Plus size={14} />
              <span>Create Administrator</span>
            </button>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search admin name, phone, dept..."
                  value={adminSearch}
                  onChange={(e) => setAdminSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <select
                value={adminFilterWs}
                onChange={(e) => setAdminFilterWs(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Workspaces</option>
                {superAdminWorkspaces.map((ws) => (
                  <option key={ws.id} value={String(ws.id)}>
                    {ws.name} (#{ws.id})
                  </option>
                ))}
              </select>

              <select
                value={adminFilterRole}
                onChange={(e) => setAdminFilterRole(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="all">All Administrative Roles</option>
                <option value="SuperAdmin">SuperAdmin (Global Master)</option>
                <option value="AdminCreator">AdminCreator (Primary Workspace Admin)</option>
                <option value="AdminManager">AdminManager (Secondary Admin)</option>
                <option value="HR">HR Officer</option>
                <option value="Accountant">Accountant / Finance</option>
              </select>
            </div>

            <div className="text-xs font-bold text-slate-500">
              Showing {filteredAdmins.length} of {superAdminAdmins.length} admins
            </div>
          </div>

          {/* Admins Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Administrator</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Authorized Workspace</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAdmins.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No administrators matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredAdmins.map((adm) => (
                      <tr key={adm.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center shrink-0 text-xs">
                              {adm.full_name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{adm.full_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{adm.phone_number}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            adm.role === "SuperAdmin"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : adm.role === "AdminCreator"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : adm.role === "AdminManager"
                              ? "bg-teal-100 text-teal-800 border border-teal-200"
                              : "bg-slate-100 text-slate-700"
                          }`}>
                            {adm.role === "SuperAdmin" ? "Super Admin (Global)" : adm.role === "AdminCreator" ? "Workspace Creator" : adm.role === "AdminManager" ? "Managing Admin" : adm.role}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          {adm.role === "SuperAdmin" ? (
                            <span className="font-bold text-purple-700 flex items-center gap-1">
                              <Globe size={13} /> Global (All Workspaces)
                            </span>
                          ) : (
                            <span className="font-bold text-slate-800">
                              {adm.workspace_name || `Workspace #${adm.workspace_id}`}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-slate-600 font-medium">
                          {adm.department || "Operations"}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            adm.status === "SUSPENDED" || adm.is_active === 0
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          }`}>
                            {adm.status === "SUSPENDED" || adm.is_active === 0 ? "Suspended" : "Active"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditAdmin(adm)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                            {adm.id !== user?.id && (
                              <button
                                onClick={() => handleToggleAdminStatus(adm)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                  adm.status === "ACTIVE"
                                    ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                    : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                                }`}
                              >
                                {adm.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                              </button>
                            )}
                          </div>
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

      {/* ==================================================================== */}
      {/* SUB-TAB 3: GLOBAL ACTIVITY & AUDIT STREAM */}
      {/* ==================================================================== */}
      {activeSubTab === "audit" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-800">Immutable System Audit Trail</h3>
              <p className="text-xs text-slate-500">Every sensitive action, administrative adjustment, attendance correction, and security event is permanently logged with actor ID and context.</p>
            </div>
            <button
              onClick={handleApplyAuditFilters}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw size={13} />
              <span>Refresh Audit Log</span>
            </button>
          </div>

          {/* Audit Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Workspace</label>
              <select
                value={auditFilterWs}
                onChange={(e) => setAuditFilterWs(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="all">All Workspaces (Global)</option>
                {superAdminWorkspaces.map((ws) => (
                  <option key={ws.id} value={String(ws.id)}>
                    {ws.name} (#{ws.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Action Type</label>
              <select
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="">All Actions</option>
                <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                <option value="SUSPENDED_LOGIN_ATTEMPT">SUSPENDED_LOGIN_ATTEMPT</option>
                <option value="ADMIN_CREATED">ADMIN_CREATED</option>
                <option value="ADMIN_STATUS_CHANGED">ADMIN_STATUS_CHANGED</option>
                <option value="ADMIN_UPDATED">ADMIN_UPDATED</option>
                <option value="WORKSPACE_CREATED">WORKSPACE_CREATED</option>
                <option value="WORKSPACE_UPDATED">WORKSPACE_UPDATED</option>
                <option value="ATTENDANCE_CHECKOUT_CORRECTED">ATTENDANCE_CHECKOUT_CORRECTED</option>
                <option value="PENALTY_WAIVED">PENALTY_WAIVED</option>
                <option value="OVERTIME_APPROVED">OVERTIME_APPROVED</option>
                <option value="UNAUTHORIZED_CROSS_WORKSPACE_ATTEMPT">UNAUTHORIZED_CROSS_WORKSPACE_ATTEMPT</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Outcome</label>
              <select
                value={auditFilterOutcome}
                onChange={(e) => setAuditFilterOutcome(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-hidden"
              >
                <option value="">All Outcomes</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="DENIED">DENIED (Security Rejection)</option>
                <option value="FAILURE">FAILURE (Invalid credentials)</option>
                <option value="SUSPICIOUS">SUSPICIOUS (Rate limit)</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search Keywords</label>
                <input
                  type="text"
                  placeholder="Actor, IP, details..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden"
                />
              </div>
              <button
                onClick={handleApplyAuditFilters}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer"
              >
                Filter
              </button>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Workspace</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {superAdminAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No audit records matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    superAdminAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 text-slate-500 font-mono whitespace-nowrap text-[11px]">
                          {new Date(log.created_at).toLocaleString()}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.workspace_name ? (
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[10px] font-bold">
                              {log.workspace_name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Global / System</span>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{log.actor_name || "System"}</div>
                          <div className="text-[10px] text-slate-400">{log.actor_role || "Service"}</div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                            log.action.includes("FAILED") || log.action.includes("DENIED") || log.action.includes("UNAUTHORIZED")
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : log.action.includes("STATUS") || log.action.includes("WAIVED")
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}>
                            {log.action}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.outcome === "DENIED" || log.outcome === "FAILURE"
                              ? "bg-rose-100 text-rose-800"
                              : log.outcome === "SUSPICIOUS"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {log.outcome || "SUCCESS"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={log.details || ""}>
                          {log.details || "No details"}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedAuditLog(log)}
                            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                            title="Inspect complete payload"
                          >
                            <Eye size={14} />
                          </button>
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

      {/* ==================================================================== */}
      {/* SUB-TAB 4: SECURITY EVENTS & FAILED LOGINS */}
      {/* ==================================================================== */}
      {activeSubTab === "security" && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-rose-900/10 via-amber-900/10 to-transparent p-5 rounded-2xl border border-rose-200 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Security Telemetry & Access Anomalies</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Investigate failed login attempts, unauthorized cross-workspace manipulation, privilege escalations, and rate limit blocks. Suspicious origins are flagged for immediate action.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-gray-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Security Event</th>
                    <th className="px-4 py-3">Target / Actor</th>
                    <th className="px-4 py-3">Client IP Address</th>
                    <th className="px-4 py-3">Incident Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {superAdminSecurityEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No security anomalies recorded. System is operating normally.
                      </td>
                    </tr>
                  ) : (
                    superAdminSecurityEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-rose-50/30 transition">
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(evt.created_at).toLocaleString()}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                            {evt.action}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-800">{evt.actor_name}</div>
                          <div className="text-[10px] text-slate-400">{evt.actor_role}</div>
                        </td>

                        <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                          {evt.ip_address || "127.0.0.1"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {evt.details}
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

      {/* ==================================================================== */}
      {/* MODAL: CREATE / EDIT WORKSPACE */}
      {/* ==================================================================== */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 size={16} />
                </div>
                <h3 className="font-black text-slate-900 text-lg">
                  {editingWorkspace ? `Edit Workspace #${editingWorkspace.id}` : "Provision New Workspace"}
                </h3>
              </div>
              <button
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Workspace / Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Construction Site B"
                  value={workspaceForm.name}
                  onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Short Code (2-6 letters)
                  </label>
                  <input
                    type="text"
                    maxLength={8}
                    placeholder="e.g. SITE-B"
                    value={workspaceForm.code}
                    onChange={(e) => setWorkspaceForm({ ...workspaceForm, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={workspaceForm.status}
                    onChange={(e) => setWorkspaceForm({ ...workspaceForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="INACTIVE">INACTIVE (Suspended)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Location Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief note about the project or branch site..."
                  value={workspaceForm.description}
                  onChange={(e) => setWorkspaceForm({ ...workspaceForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  <span>{editingWorkspace ? "Save Changes" : "Create Workspace"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CREATE / EDIT ADMINISTRATOR */}
      {/* ==================================================================== */}
      {isAdminModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Users size={16} />
                </div>
                <h3 className="font-black text-slate-900 text-lg">
                  {editingAdmin ? `Edit Administrator: ${editingAdmin.full_name}` : "Create Administrator Account"}
                </h3>
              </div>
              <button
                onClick={() => setIsAdminModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAdmin} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Abebe Kebede"
                    value={adminForm.full_name}
                    onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number (Login) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0911223344"
                    value={adminForm.phone_number}
                    onChange={(e) => setAdminForm({ ...adminForm, phone_number: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Administrative Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adminForm.role}
                    onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden cursor-pointer"
                  >
                    <option value="AdminCreator">AdminCreator (Primary Workspace Admin)</option>
                    <option value="AdminManager">AdminManager (Secondary Admin)</option>
                    <option value="HR">HR Officer</option>
                    <option value="Accountant">Accountant</option>
                    <option value="SuperAdmin">SuperAdmin (Global Master Privileges)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Workspace <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={adminForm.workspace_id}
                    onChange={(e) => setAdminForm({ ...adminForm, workspace_id: parseInt(e.target.value, 10) })}
                    disabled={adminForm.role === "SuperAdmin"}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden cursor-pointer disabled:opacity-50"
                  >
                    {superAdminWorkspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name} (#{ws.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Operations, HR, Management"
                    value={adminForm.department}
                    onChange={(e) => setAdminForm({ ...adminForm, department: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingAdmin ? "Reset Password (Optional)" : "Password *"}
                  </label>
                  <input
                    type="password"
                    placeholder={editingAdmin ? "Leave empty to preserve" : "Strong password"}
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {editingAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Access Status
                  </label>
                  <select
                    value={adminForm.status}
                    onChange={(e) => setAdminForm({ ...adminForm, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized Access)</option>
                    <option value="SUSPENDED">SUSPENDED (Access Blocked)</option>
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  <span>{editingAdmin ? "Save Changes" : "Create Administrator"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: INSPECT AUDIT LOG PAYLOAD */}
      {/* ==================================================================== */}
      {selectedAuditLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Audit Event Inspector #{selectedAuditLog.id}</h3>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Action</span>
                  <span className="font-mono font-bold text-slate-800">{selectedAuditLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Outcome</span>
                  <span className="font-bold text-slate-800">{selectedAuditLog.outcome || "SUCCESS"}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Actor</span>
                  <span className="text-slate-800 font-medium">{selectedAuditLog.actor_name} ({selectedAuditLog.actor_role})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">IP Origin</span>
                  <span className="font-mono text-slate-800">{selectedAuditLog.ip_address || "127.0.0.1"}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1">Details</span>
                <p className="bg-slate-50 p-3 rounded-xl text-slate-700 leading-relaxed font-mono text-[11px]">
                  {selectedAuditLog.details}
                </p>
              </div>

              {selectedAuditLog.before_value && (
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1">Previous State</span>
                  <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto text-[10px] font-mono max-h-32">
                    {selectedAuditLog.before_value}
                  </pre>
                </div>
              )}

              {selectedAuditLog.after_value && (
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase mb-1">Updated State</span>
                  <pre className="bg-slate-900 text-slate-200 p-3 rounded-xl overflow-x-auto text-[10px] font-mono max-h-32">
                    {selectedAuditLog.after_value}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 text-right">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
