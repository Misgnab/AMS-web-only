import { useEffect, useRef, useState, useCallback } from "react";
import { useAppStore } from "../store.js";

export type RealtimeConnectionStatus = "CONNECTED" | "CONNECTING" | "RECONNECTING" | "OFFLINE";

export interface RealtimeSyncState {
  status: RealtimeConnectionStatus;
  lastEventTime: Date | null;
  lastEventType: string | null;
  eventCount: number;
  isRefreshing: boolean;
  isOnline: boolean;
  triggerManualRefresh: () => void;
}

/**
 * Enterprise Real-Time Synchronization & Liveness Service
 * 
 * Features:
 * 1. Sub-second live data sync via Server-Sent Events (SSE)
 * 2. Active filter preservation (won't reset admin's selected dashboard or salary filters)
 * 3. Zombie connection watchdog (auto-recovers from silent cloud/proxy stream drops)
 * 4. Tab visibility & focus awareness (instantly catches up when user returns to app)
 * 5. Network online/offline auto-reconnection with exponential backoff
 * 6. Safety fallback polling interval (ensures 100% liveness even under restrictive firewalls)
 */
export function useRealtimeSync(): RealtimeSyncState {
  const { token } = useAppStore();
  const [status, setStatus] = useState<RealtimeConnectionStatus>("CONNECTING");
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [lastEventType, setLastEventType] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const debounceTimersRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  const lastHeartbeatRef = useRef<number>(Date.now());
  const lastSyncTimeRef = useRef<number>(Date.now());

  // Debounced fetch helper to prevent spamming endpoints on rapid multi-events
  const debounceFetch = useCallback((key: string, fetchFn: () => void, delayMs = 150) => {
    if (debounceTimersRef.current[key]) {
      clearTimeout(debounceTimersRef.current[key]);
    }
    debounceTimersRef.current[key] = setTimeout(() => {
      fetchFn();
      delete debounceTimersRef.current[key];
    }, delayMs);
  }, []);

  // Universal state refresh that honors current dashboard & salary filters
  const refreshAllData = useCallback(() => {
    const store = useAppStore.getState();
    const role = store.user?.role || "";
    const isAdmin = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"].includes(role);

    lastSyncTimeRef.current = Date.now();

    // Common operational metrics for all users
    store.fetchWorkCalendar();
    store.fetchHolidays();
    store.fetchSiteSettings();
    store.fetchTodayAttendance();
    store.fetchAttendanceHistory();
    store.fetchAttendanceStatus();
    store.fetchScores();
    store.fetchMissingCheckouts();
    store.fetchAttendanceCorrections();
    store.fetchWorkCalendarStatus();
    store.fetchQRCode();

    // Admin & Management specific metrics
    if (isAdmin) {
      const activeDash = store.activeDashboardFilter || "Today";
      const activeSal = store.activeSalaryFilter || "Monthly";
      store.fetchDashboard(activeDash);
      store.fetchSalaries(activeSal);
      store.fetchAttendanceRequests();
      store.fetchPermissions();
      store.fetchAttendanceAuditLogs();
      store.fetchOvertimeStats();
      store.fetchOvertimeRecords();
      store.fetchPenalties();
      store.fetchEmployees();
      store.fetchPayrollPreflightCheck();
      store.fetchDisbursementHistory();
      store.fetchDatabaseStatus();
    } else {
      const activeSal = store.activeSalaryFilter || "Monthly";
      store.fetchMySalary(activeSal);
      store.fetchPermissions();
      store.fetchAttendanceRequests();
    }
  }, []);

  const handleServerEventData = useCallback((data: any) => {
    const eventType = data.type || "DATA_UPDATED";
    
    lastHeartbeatRef.current = Date.now();
    lastSyncTimeRef.current = Date.now();
    setLastEventTime(new Date());
    setLastEventType(eventType);
    setEventCount(prev => prev + 1);

    const store = useAppStore.getState();
    const role = store.user?.role || "";
    const isAdmin = ["SuperAdmin", "AdminCreator", "AdminManager", "Bootstrap", "Accountant", "HR"].includes(role);
    const activeDash = store.activeDashboardFilter || "Today";
    const activeSal = store.activeSalaryFilter || "Monthly";

    switch (eventType) {
      case "ATTENDANCE_CHANGED":
        debounceFetch("attendance", () => {
          store.fetchTodayAttendance();
          store.fetchAttendanceHistory();
          store.fetchAttendanceStatus();
          store.fetchScores();
          store.fetchMissingCheckouts();
          store.fetchAttendanceCorrections();
          store.fetchWorkCalendarStatus();
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchSalaries(activeSal);
            store.fetchAttendanceAuditLogs();
            store.fetchPenalties();
            store.fetchPayrollPreflightCheck();
          } else {
            store.fetchMySalary(activeSal);
          }
        }, 120);
        break;

      case "OVERTIME_CHANGED":
        debounceFetch("overtime", () => {
          store.fetchOvertimeStats();
          store.fetchOvertimeRecords();
          store.fetchTodayAttendance();
          store.fetchAttendanceHistory();
          store.fetchSalaries(activeSal);
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchPayrollPreflightCheck();
          } else {
            store.fetchMySalary(activeSal);
          }
        }, 120);
        break;

      case "SALARY_CHANGED":
        debounceFetch("salary", () => {
          store.fetchSalaries(activeSal);
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchDisbursementHistory();
            store.fetchPayrollPreflightCheck();
          } else {
            store.fetchMySalary(activeSal);
          }
        }, 120);
        break;

      case "ATTENDANCE_CORRECTED":
      case "ATTENDANCE_CORRECTION_REQUESTED":
      case "ATTENDANCE_CORRECTION_REJECTED":
        debounceFetch("correction", () => {
          store.fetchAttendanceCorrections();
          store.fetchMissingCheckouts();
          store.fetchAttendanceStatus();
          store.fetchTodayAttendance();
          store.fetchAttendanceHistory();
          store.fetchScores();
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchSalaries(activeSal);
            store.fetchAttendanceAuditLogs();
            store.fetchPayrollPreflightCheck();
          } else {
            store.fetchMySalary(activeSal);
          }
        }, 100);
        break;

      case "PERMISSION_CHANGED":
      case "PERMISSION_REQUESTED":
        debounceFetch("permissions", () => {
          store.fetchPermissions();
          store.fetchAttendanceRequests();
          store.fetchTodayAttendance();
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchSalaries(activeSal);
          }
        }, 120);
        break;

      case "CALENDAR_CHANGED":
        debounceFetch("calendar", () => {
          store.fetchWorkCalendar();
          store.fetchHolidays();
          store.fetchWorkCalendarStatus();
          store.fetchTodayAttendance();
          store.fetchAttendanceStatus();
          store.fetchAttendanceHistory();
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchSalaries(activeSal);
            store.fetchOvertimeStats();
            store.fetchOvertimeRecords();
          } else {
            store.fetchMySalary(activeSal);
          }
        }, 80);
        break;

      case "EMPLOYEES_CHANGED":
        debounceFetch("employees", () => {
          store.fetchEmployees();
          store.fetchProfile();
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchSalaries(activeSal);
          }
        }, 80);
        break;

      case "SETTINGS_CHANGED":
        debounceFetch("settings", () => {
          store.fetchSiteSettings();
          store.fetchWorkCalendar();
          store.fetchWorkCalendarStatus();
          store.fetchTodayAttendance();
          if (isAdmin) {
            store.fetchDashboard(activeDash);
            store.fetchSalaries(activeSal);
            store.fetchOvertimeStats();
          } else {
            store.fetchMySalary(activeSal);
          }
        }, 80);
        break;

      case "QR_CHANGED":
        debounceFetch("qr", () => {
          store.fetchQRCode();
        }, 50);
        break;

      case "DATABASE_CHANGED":
        debounceFetch("database", () => {
          store.fetchDatabaseStatus();
        }, 80);
        break;

      case "PENALTIES_CHANGED":
      case "PENALTY_CHANGED":
        debounceFetch("penalties", () => {
          store.fetchPenalties();
          store.fetchAttendanceHistory();
          store.fetchSalaries(activeSal);
        }, 100);
        break;

      case "CONNECTED":
        setStatus("CONNECTED");
        break;

      default:
        debounceFetch("general", refreshAllData, 250);
        break;
    }
  }, [debounceFetch, refreshAllData]);

  const connectSSE = useCallback(() => {
    if (!token) {
      setStatus("OFFLINE");
      return;
    }

    if (!navigator.onLine) {
      setStatus("OFFLINE");
      return;
    }

    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }

    setStatus(retryCountRef.current > 0 ? "RECONNECTING" : "CONNECTING");

    try {
      const url = `/api/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus("CONNECTED");
        retryCountRef.current = 0;
        lastHeartbeatRef.current = Date.now();
      };

      // Handle standard message events
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerEventData(data);
        } catch (err) {
          console.warn("Real-time SSE parse warning:", err);
        }
      };

      // Handle custom 'connected' welcome event
      es.addEventListener("connected", (event: any) => {
        setStatus("CONNECTED");
        lastHeartbeatRef.current = Date.now();
        try {
          const data = JSON.parse(event.data);
          handleServerEventData(data);
        } catch {}
      });

      // Handle custom 'ping' heartbeat event from server
      es.addEventListener("ping", () => {
        lastHeartbeatRef.current = Date.now();
      });

      es.onerror = () => {
        try {
          es.close();
        } catch {}
        eventSourceRef.current = null;
        
        if (!navigator.onLine) {
          setStatus("OFFLINE");
          return;
        }

        setStatus("RECONNECTING");

        // Exponential backoff reconnect: min 1.5s, max 12s
        retryCountRef.current += 1;
        const delay = Math.min(12000, 1500 * Math.pow(1.4, Math.min(retryCountRef.current, 5)));

        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, delay);
      };
    } catch (err) {
      console.warn("Failed to initialize SSE connection:", err);
      setStatus("OFFLINE");
    }
  }, [token, handleServerEventData]);

  // Main lifecycle: Setup SSE connection & tear down on token change
  useEffect(() => {
    if (token) {
      connectSSE();
    } else {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus("OFFLINE");
    }

    return () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      Object.values(debounceTimersRef.current).forEach(clearTimeout);
    };
  }, [token, connectSSE]);

  // Online / Offline window events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (token) {
        setStatus("CONNECTING");
        connectSSE();
        refreshAllData();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus("OFFLINE");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [token, connectSSE, refreshAllData]);

  // Tab Visibility & Window Focus Awareness:
  // When a user switches back to this tab, check connection health and refresh if stale
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        if (!token) return;

        // Check if EventSource is dead or disconnected
        if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
          connectSSE();
        }

        // If more than 15 seconds have passed since the last event, perform a background catch-up
        if (Date.now() - lastSyncTimeRef.current > 15000) {
          refreshAllData();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [token, connectSSE, refreshAllData]);

  // Watchdog & Safety Fallback Interval:
  // 1. Detects zombie/stalled SSE streams (no ping/message in >45s while online)
  // 2. Periodic safety refresh every 60s (guarantees unbroken liveness on all networks)
  useEffect(() => {
    if (!token) return;

    const watchdogTimer = setInterval(() => {
      const now = Date.now();

      // Check for zombie connection
      if (status === "CONNECTED" && navigator.onLine) {
        if (now - lastHeartbeatRef.current > 45000) {
          console.warn("[RealtimeSync] Zombie SSE stream detected (no heartbeat in 45s). Reconnecting...");
          connectSSE();
        }
      } else if (status === "OFFLINE" && navigator.onLine) {
        connectSSE();
      }

      // Safety refresh every 60 seconds
      if (now - lastSyncTimeRef.current >= 60000) {
        refreshAllData();
      }
    }, 15000);

    return () => clearInterval(watchdogTimer);
  }, [token, status, connectSSE, refreshAllData]);

  // Manual trigger with visual refresh indicator
  const triggerManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    refreshAllData();
    setLastEventTime(new Date());
    setLastEventType("MANUAL_REFRESH");
    
    // Check/reconnect SSE if disconnected
    if (eventSourceRef.current?.readyState !== EventSource.OPEN) {
      connectSSE();
    }

    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, [refreshAllData, connectSSE]);

  return {
    status,
    lastEventTime,
    lastEventType,
    eventCount,
    isRefreshing,
    isOnline,
    triggerManualRefresh
  };
}
