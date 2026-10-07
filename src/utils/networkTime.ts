// Authoritative Network Time Synchronization Service
// Ensures all clocks and time displays throughout the dashboard are synchronized with the backend server

import { useState, useEffect, useCallback } from "react";

interface NetworkTimePayload {
  serverEpochMs: number;
  serverTime: string;
  todayDate: string;
  currentTime: string;
  timezone?: string;
  status?: string;
}

class NetworkTimeManager {
  private static instance: NetworkTimeManager;

  private referenceServerTime: number = 0;
  private referencePerfTime: number = 0;
  private offsetMs: number = 0;
  private rttMs: number = 0;
  private isSynced: boolean = false;
  private syncStatus: "synced" | "syncing" | "offline" = "syncing";
  private lastSyncTime: number | null = null;
  private listeners: Set<() => void> = new Set();
  private syncTimer: any = null;
  private isFetching: boolean = false;

  private constructor() {
    // Initial sync
    if (typeof window !== "undefined") {
      this.syncWithServer();

      // Periodic synchronization every 30 seconds to prevent hardware clock drift
      this.syncTimer = setInterval(() => {
        this.syncWithServer();
      }, 30000);

      // Immediate re-sync when tab regains focus or device wakes up
      window.addEventListener("focus", () => this.syncWithServer());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          this.syncWithServer();
        }
      });

      // Immediate re-sync when network reconnects
      window.addEventListener("online", () => this.syncWithServer());
    }
  }

  public static getInstance(): NetworkTimeManager {
    if (!NetworkTimeManager.instance) {
      NetworkTimeManager.instance = new NetworkTimeManager();
    }
    return NetworkTimeManager.instance;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error("Error in network time subscriber:", e);
      }
    });
  }

  public async syncWithServer(): Promise<boolean> {
    if (this.isFetching) return false;
    this.isFetching = true;

    if (!this.isSynced) {
      this.syncStatus = "syncing";
      this.notify();
    }

    const t0 = performance.now();
    const clientSendEpoch = Date.now();

    try {
      const response = await fetch(`/api/time?_t=${clientSendEpoch}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache"
        }
      });

      const t1 = performance.now();
      const clientReceiveEpoch = Date.now();

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data: NetworkTimePayload = await response.json();

      if (typeof data.serverEpochMs !== "number" || isNaN(data.serverEpochMs)) {
        throw new Error("Invalid server timestamp received");
      }

      // Round-trip latency calculation
      const rtt = Math.max(0, t1 - t0);
      this.rttMs = Math.round(rtt);

      // Estimated server time at response arrival (half RTT transit assumption)
      const estimatedServerNow = data.serverEpochMs + Math.round(rtt / 2);

      // Set authoritative monotonic references
      this.referenceServerTime = estimatedServerNow;
      this.referencePerfTime = t1;
      this.offsetMs = estimatedServerNow - clientReceiveEpoch;
      this.isSynced = true;
      this.syncStatus = "synced";
      this.lastSyncTime = clientReceiveEpoch;

      this.notify();
      return true;
    } catch (err) {
      console.warn("Network time sync warning:", err);
      if (!this.isSynced) {
        this.syncStatus = "offline";
      }
      this.notify();
      return false;
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Passively record a server timestamp received from other API responses (e.g. attendance status)
   */
  public recordServerTimestamp(serverEpochMs: number, estimatedRttMs: number = 20) {
    if (typeof serverEpochMs !== "number" || isNaN(serverEpochMs)) return;
    const clientReceiveEpoch = Date.now();
    const t1 = performance.now();
    const estimatedServerNow = serverEpochMs + Math.round(estimatedRttMs / 2);

    // Update if not synced yet, or if drift exceeds 1.5s
    if (!this.isSynced || Math.abs((this.now().getTime()) - estimatedServerNow) > 1500) {
      this.referenceServerTime = estimatedServerNow;
      this.referencePerfTime = t1;
      this.offsetMs = estimatedServerNow - clientReceiveEpoch;
      this.isSynced = true;
      this.syncStatus = "synced";
      this.lastSyncTime = clientReceiveEpoch;
      this.notify();
    }
  }

  /**
   * Returns current Date object synchronized with the backend server network clock.
   * Uses monotonic performance.now() elapsed calculation so user device clock manipulations
   * cannot skew or distort the time.
   */
  public now(): Date {
    if (!this.isSynced) {
      // Fallback to client device time until first successful network handshake
      return new Date();
    }
    const elapsed = performance.now() - this.referencePerfTime;
    return new Date(this.referenceServerTime + elapsed);
  }

  public getStatus() {
    return {
      isSynced: this.isSynced,
      syncStatus: this.syncStatus,
      offsetMs: this.offsetMs,
      rttMs: this.rttMs,
      lastSyncTime: this.lastSyncTime
    };
  }
}

export const networkTimeManager = NetworkTimeManager.getInstance();

/**
 * Returns a live Date synchronized with the network server.
 */
export function getNetworkDate(): Date {
  return networkTimeManager.now();
}

/**
 * React hook providing the network-provided current time, ticking every second,
 * immune to device clock tampering and synchronized with the backend.
 */
export function useNetworkTime() {
  const [currentTime, setCurrentTime] = useState<Date>(() => networkTimeManager.now());
  const [status, setStatus] = useState(() => networkTimeManager.getStatus());

  useEffect(() => {
    // Subscribe to network sync updates
    const unsubscribe = networkTimeManager.subscribe(() => {
      setStatus(networkTimeManager.getStatus());
      setCurrentTime(networkTimeManager.now());
    });

    // Update clock every second
    const timer = setInterval(() => {
      setCurrentTime(networkTimeManager.now());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const resync = useCallback(() => {
    return networkTimeManager.syncWithServer();
  }, []);

  return {
    currentTime,
    isNetworkSynced: status.isSynced,
    syncStatus: status.syncStatus,
    offsetMs: status.offsetMs,
    rttMs: status.rttMs,
    lastSyncTime: status.lastSyncTime,
    resync
  };
}
