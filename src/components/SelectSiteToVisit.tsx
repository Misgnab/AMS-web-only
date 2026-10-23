import React, { useState, useEffect, useMemo } from "react";
import { useAppStore } from "../store.js";
import { SiteSummaryItem } from "../types.js";
import {
  Building2,
  Users,
  MapPin,
  Clock,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Calendar,
  Phone,
  FileCheck,
  CheckCircle2,
  XCircle,
  Eye,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Briefcase
} from "lucide-react";

interface SelectSiteToVisitProps {
  onSiteSelected?: (siteId: number) => void;
  onNavigateToTab?: (tab: string) => void;
}

export const SelectSiteToVisit: React.FC<SelectSiteToVisitProps> = ({
  onSiteSelected,
  onNavigateToTab
}) => {
  const {
    user,
    sitesSummary,
    sitesLoading,
    sitesError,
    visitingWorkspace,
    visitingWorkspaceId,
    fetchSitesSummary,
    visitSite,
    leaveSite
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "SUSPENDED">("ALL");
  const [sortBy, setSortBy] = useState<"name" | "employees" | "activity">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [visitingLoadingId, setVisitingLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchSitesSummary();
  }, [fetchSitesSummary]);

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy, sortDirection]);

  // Security gate: strictly require SuperAdmin
  if (user?.role !== "SuperAdmin") {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-lg mx-auto my-12 space-y-4">
        <ShieldAlert size={44} className="text-rose-600 mx-auto" />
        <h2 className="text-xl font-bold text-rose-950">Restricted Super Admin Control</h2>
        <p className="text-sm text-rose-700 leading-relaxed">
          Access to multi-site traversal and global workspace supervisory environments is exclusively reserved for authenticated Super Administrators.
        </p>
      </div>
    );
  }

  // Filtered & Sorted sites list
  const filteredSites = useMemo(() => {
    return sitesSummary.filter((site) => {
      // Status filter
      if (statusFilter !== "ALL" && site.status !== statusFilter) {
        return false;
      }

      // Search filter (by name or numeric ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = site.name.toLowerCase().includes(q);
        const matchesId = String(site.id) === q || `site #${site.id}`.toLowerCase().includes(q);
        const matchesOffice = (site.office_name || "").toLowerCase().includes(q);
        const matchesAdmin = (site.admin_name || "").toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesOffice && !matchesAdmin) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDirection === "asc" ? cmp : -cmp;
      }
      if (sortBy === "employees") {
        const diff = (a.employee_count || 0) - (b.employee_count || 0);
        return sortDirection === "asc" ? diff : -diff;
      }
      if (sortBy === "activity") {
        const timeA = new Date(a.last_activity || 0).getTime();
        const timeB = new Date(b.last_activity || 0).getTime();
        return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });
  }, [sitesSummary, searchQuery, statusFilter, sortBy, sortDirection]);

  // Pagination calculation
  const totalSites = filteredSites.length;
  const totalPages = Math.ceil(totalSites / pageSize) || 1;
  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSites.slice(start, start + pageSize);
  }, [filteredSites, currentPage, pageSize]);

  // Telemetry Aggregates
  const totalActiveSites = useMemo(() => {
    return sitesSummary.filter((s) => s.status === "ACTIVE").length;
  }, [sitesSummary]);

  const totalWorkforce = useMemo(() => {
    return sitesSummary.reduce((acc, s) => acc + (s.employee_count || 0), 0);
  }, [sitesSummary]);

  const totalTodayCheckIns = useMemo(() => {
    return sitesSummary.reduce((acc, s) => acc + (s.today_attendance_count || 0), 0);
  }, [sitesSummary]);

  const handleVisitSite = async (site: SiteSummaryItem) => {
    setActionError(null);
    setActionSuccess(null);
    setVisitingLoadingId(site.id);

    const res = await visitSite(site.id);
    setVisitingLoadingId(null);

    if (res.success) {
      setActionSuccess(`Now visiting site: ${site.name}. Switched active administrative context.`);
      if (onSiteSelected) {
        onSiteSelected(site.id);
      }
      if (onNavigateToTab) {
        onNavigateToTab("dashboard");
      }
    } else {
      setActionError(res.error || "Failed to enter site environment.");
    }
  };

  const handleLeaveCurrentSite = async () => {
    setActionError(null);
    setActionSuccess(null);
    const res = await leaveSite();
    if (res.success) {
      setActionSuccess("Exited site visit mode. Returned to global Super Admin view.");
      if (onNavigateToTab) {
        onNavigateToTab("select_site");
      }
    } else {
      setActionError(res.error || "Failed to exit site visit mode.");
    }
  };

  const formatActivityTime = (dateStr?: string | null) => {
    if (!dateStr) return "No recorded activity";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Active Visiting Context Banner */}
      {visitingWorkspace && (
        <div className="bg-slate-900 border-2 border-amber-500/80 rounded-2xl p-4 sm:p-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Eye size={20} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <span>Active Administrative Session</span>
                <span className="text-slate-500">·</span>
                <span>Context Scoped</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                SUPER ADMIN — VISITING: {visitingWorkspace.name}
                <span className="text-xs font-semibold text-slate-400">
                  (Site #{visitingWorkspace.id})
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab("dashboard")}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Site Dashboard</span>
                <ArrowRight size={14} />
              </button>
            )}
            <button
              onClick={handleLeaveCurrentSite}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <LogOut size={14} />
              <span>Exit Site Mode</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Header & Overview KPIs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Super Administrator</span>
              <span aria-hidden="true">·</span>
              <span>Workspace Directory</span>
              <span aria-hidden="true">·</span>
              <span>Real-Time Telemetry</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Select Site to Visit
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Select any registered construction site or branch workspace to supervise daily attendance, manage workforce payroll, review live shifts, and configure site policies under global administrative authority.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={() => {
                fetchSitesSummary();
                setActionSuccess("Refreshed sites directory.");
                setTimeout(() => setActionSuccess(null), 3000);
              }}
              disabled={sitesLoading}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-200 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={sitesLoading ? "animate-spin text-indigo-600" : ""} />
              <span>Refresh Directory</span>
            </button>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total Sites</span>
              <Building2 size={16} className="text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {sitesSummary.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Registered construction workspaces
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Active Workspaces</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {totalActiveSites}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
              Operational & supervised
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Total Workforce</span>
              <Users size={16} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {totalWorkforce}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Employees across all sites
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Today's Check-Ins</span>
              <Clock size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {totalTodayCheckIns}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-0.5">
              Live attendance records
            </div>
          </div>
        </div>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <XCircle size={16} />
          </button>
        </div>
      )}

      {sitesError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertCircle size={18} className="text-rose-600 shrink-0" />
          <span>Failed to load sites: {sitesError}</span>
        </div>
      )}

      {/* Filters, Search & Sort Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by site name, ID, location, or administrator..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Interactive Status Segmented Filter Controls */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                statusFilter === "ALL"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({sitesSummary.length})
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                statusFilter === "ACTIVE"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({totalActiveSites})
            </button>
            <button
              onClick={() => setStatusFilter("INACTIVE")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                statusFilter === "INACTIVE"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Inactive
            </button>
            <button
              onClick={() => setStatusFilter("SUSPENDED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                statusFilter === "SUSPENDED"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Suspended
            </button>
          </div>
        </div>

        {/* Secondary Bar: Sorting & Result Count */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span>Showing {filteredSites.length} site{filteredSites.length === 1 ? "" : "s"}</span>
            {searchQuery && (
              <span>matching &ldquo;{searchQuery}&rdquo;</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Sort by:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (sortBy === "name") {
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("name");
                    setSortDirection("asc");
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortBy === "name"
                    ? "bg-slate-200 text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
              </button>
              <button
                onClick={() => {
                  if (sortBy === "employees") {
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("employees");
                    setSortDirection("desc");
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortBy === "employees"
                    ? "bg-slate-200 text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Employees {sortBy === "employees" && (sortDirection === "asc" ? "↑" : "↓")}
              </button>
              <button
                onClick={() => {
                  if (sortBy === "activity") {
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("activity");
                    setSortDirection("desc");
                  }
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  sortBy === "activity"
                    ? "bg-slate-200 text-slate-900 font-bold"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Recent Activity {sortBy === "activity" && (sortDirection === "asc" ? "↑" : "↓")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {sitesLoading && sitesSummary.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-5 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-16" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 bg-slate-100 rounded w-3/4" />
                <div className="h-3.5 bg-slate-100 rounded w-1/2" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="h-4 bg-slate-200 rounded w-24" />
                <div className="h-8 bg-slate-200 rounded-xl w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!sitesLoading && filteredSites.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-3 shadow-xs">
          <Building2 size={40} className="text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No Construction Sites Found</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {searchQuery || statusFilter !== "ALL"
              ? "No registered sites matched your filter criteria. Try adjusting your query or resetting status filters."
              : "No workspaces have been provisioned yet. Use the Super Admin Governance Center to create your first site."}
          </p>
          {(searchQuery || statusFilter !== "ALL") && (
            <div className="pt-2">
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {paginatedSites.map((site) => {
          const isCurrentlyVisiting = visitingWorkspaceId === site.id;
          const isVisitingThis = visitingLoadingId === site.id;

          return (
            <div
              key={site.id}
              className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                isCurrentlyVisiting
                  ? "border-amber-400 ring-2 ring-amber-400/30 shadow-md"
                  : "border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-md"
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header: Name, ID & Status dot */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <span>Site ID #{site.id}</span>
                      {site.code && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-slate-700 uppercase">{site.code}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate" title={site.name}>
                      {site.name}
                    </h3>
                  </div>

                  {/* Clean unboxed status indicator with subtle dot */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        site.status === "ACTIVE"
                          ? "bg-emerald-500"
                          : site.status === "SUSPENDED"
                          ? "bg-rose-500"
                          : "bg-slate-400"
                      }`}
                    />
                    <span
                      className={
                        site.status === "ACTIVE"
                          ? "text-emerald-700"
                          : site.status === "SUSPENDED"
                          ? "text-rose-700"
                          : "text-slate-600"
                      }
                    >
                      {site.status === "ACTIVE" ? "Active" : site.status === "SUSPENDED" ? "Suspended" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Location & Geofence */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1" title={site.office_name || "Office Location"}>
                      {site.office_name || "Main Office Site"}
                      {site.latitude && site.longitude ? ` (${Number(site.latitude).toFixed(3)}°N, ${Number(site.longitude).toFixed(3)}°E)` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Briefcase size={14} className="text-slate-400 shrink-0" />
                    <span>Admin: <strong className="text-slate-700 font-semibold">{site.admin_name}</strong> ({site.admin_role})</span>
                  </div>
                </div>

                {/* Metrics Breakdown Strip */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium">Workforce</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Users size={13} className="text-indigo-500" />
                      <span>{site.employee_count} registered</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[11px] text-slate-500 font-medium">Today's Attendance</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                      <Clock size={13} className="text-amber-500" />
                      <span>{site.today_attendance_count} present</span>
                    </div>
                  </div>
                </div>

                {/* Pending Requests & Last Activity */}
                <div className="space-y-1 text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center justify-between">
                    <span>Pending Requests:</span>
                    <span className={`font-semibold ${site.pending_requests_count > 0 ? "text-amber-600 font-bold" : "text-slate-600"}`}>
                      {site.pending_requests_count > 0
                        ? `${site.pending_requests_count} pending approvals`
                        : "All cleared"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Last Activity:</span>
                    <span className="text-slate-600 font-medium">
                      {formatActivityTime(site.last_activity)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer: Action Button */}
              <div className="p-4 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-3">
                {isCurrentlyVisiting ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Currently Visiting</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 font-medium">
                    {site.status === "ACTIVE" ? "Ready for supervision" : "Site is inactive"}
                  </div>
                )}

                <button
                  onClick={() => handleVisitSite(site)}
                  disabled={isVisitingThis}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 ${
                    isCurrentlyVisiting
                      ? "bg-amber-600 hover:bg-amber-700 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  {isVisitingThis ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Entering...</span>
                    </>
                  ) : isCurrentlyVisiting ? (
                    <>
                      <span>Re-enter Site</span>
                      <ArrowRight size={13} />
                    </>
                  ) : (
                    <>
                      <span>Visit Site</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">
            Page <strong className="text-slate-800">{currentPage}</strong> of <strong className="text-slate-800">{totalPages}</strong> ({totalSites} sites total)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition cursor-pointer ${
                  currentPage === page
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
