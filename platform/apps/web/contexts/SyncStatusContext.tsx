"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { loadQueue, saveQueue } from "@/lib/offline-queue";
import { getTelemetry } from "@/lib/sync-telemetry";

export type SyncState = "synced" | "syncing" | "pending" | "offline" | "error";

export interface QueueInfo {
  key: string;
  label: string;
  count: number;
  conflicts: number;
  nextRetry: number | null;
  lastError: string | null;
}

export interface SyncStatusData {
  state: SyncState;
  isOnline: boolean;
  totalPending: number;
  totalConflicts: number;
  lastSyncTime: Date | null;
  isSyncing: boolean;
  queues: QueueInfo[];
  errors: string[];
}

interface SyncStatusContextValue {
  status: SyncStatusData;
  refresh: () => void;
  manualSync: () => Promise<void>;
  clearQueue: (queueKey: string) => void;
  retryConflict: (queueKey: string, itemId: string) => void;
  discardConflict: (queueKey: string, itemId: string) => void;
}

type QueueItem = {
  id?: string;
  conflict?: boolean;
  nextAttemptAt?: number;
  lastError?: string;
};

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

const QUEUE_SOURCES = [
  { key: "campreserv:pwa:queuedMessages", label: "Guest messages" },
  { key: "campreserv:pos:orderQueue", label: "POS orders" },
  { key: "campreserv:kiosk:checkinQueue", label: "Kiosk check-ins" },
  { key: "campreserv:portal:orderQueue", label: "Portal orders" },
  { key: "campreserv:portal:activityQueue", label: "Activity bookings" },
];

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SyncStatusData>({
    state: "synced",
    isOnline: true,
    totalPending: 0,
    totalConflicts: 0,
    lastSyncTime: null,
    isSyncing: false,
    queues: [],
    errors: [],
  });

  const loadQueueData = useCallback((): QueueInfo[] => {
    if (typeof window === "undefined") return [];

    return QUEUE_SOURCES.map(({ key, label }) => {
      try {
        const list = loadQueue<QueueItem>(key);
        const conflicts = list.filter((item) => item.conflict);
        const nextRetry =
          list
            .map((item) => item.nextAttemptAt)
            .filter((value): value is number => typeof value === "number")
            .sort((a: number, b: number) => a - b)[0] ?? null;
        const lastError =
          list
            .map((item) => item.lastError)
            .find((error): error is string => typeof error === "string" && error.length > 0) ??
          null;

        return {
          key,
          label,
          count: list.length,
          conflicts: conflicts.length,
          nextRetry,
          lastError,
        };
      } catch {
        return {
          key,
          label,
          count: 0,
          conflicts: 0,
          nextRetry: null,
          lastError: null,
        };
      }
    });
  }, []);

  const computeState = useCallback(
    (queues: QueueInfo[], isOnline: boolean, isSyncing: boolean): SyncState => {
      const totalPending = queues.reduce((sum, q) => sum + q.count, 0);
      const totalConflicts = queues.reduce((sum, q) => sum + q.conflicts, 0);
      const hasErrors = queues.some((q) => q.lastError);

      if (!isOnline) return "offline";
      if (isSyncing) return "syncing";
      if (totalConflicts > 0) return "error";
      if (totalPending > 0) return "pending";
      return "synced";
    },
    [],
  );

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;

    const isOnline = navigator.onLine;
    const queues = loadQueueData();
    const totalPending = queues.reduce((sum, q) => sum + q.count, 0);
    const totalConflicts = queues.reduce((sum, q) => sum + q.conflicts, 0);
    const errors = queues
      .map((queue) => queue.lastError)
      .filter((error): error is string => typeof error === "string" && error.length > 0);

    // Get last sync time from telemetry
    const telemetry = getTelemetry();
    const lastSuccessfulSync = telemetry.find((e) => e.type === "sync" && e.status === "success");
    const lastSyncTime = lastSuccessfulSync ? new Date(lastSuccessfulSync.createdAt) : null;

    setStatus((prev) => ({
      ...prev,
      state: computeState(queues, isOnline, prev.isSyncing),
      isOnline,
      totalPending,
      totalConflicts,
      lastSyncTime,
      queues,
      errors,
    }));
  }, [loadQueueData, computeState]);

  const manualSync = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      throw new Error("Cannot sync while offline");
    }

    setStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      // Trigger sync via postMessage to service worker or custom event
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SYNC_QUEUES" });
      }

      // Also dispatch custom event for in-page listeners
      window.dispatchEvent(new CustomEvent("campreserv:manual-sync"));

      // Wait a bit for sync to complete
      await new Promise((resolve) => setTimeout(resolve, 1000));

      refresh();
    } finally {
      setStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [refresh]);

  const clearQueue = useCallback(
    (queueKey: string) => {
      saveQueue(queueKey, []);
      refresh();
    },
    [refresh],
  );

  const retryConflict = useCallback(
    (queueKey: string, itemId: string) => {
      const items = loadQueue<QueueItem>(queueKey);
      const updated = items.map((i) =>
        i.id === itemId ? { ...i, conflict: false, nextAttemptAt: Date.now() } : i,
      );
      saveQueue(queueKey, updated);
      refresh();
    },
    [refresh],
  );

  const discardConflict = useCallback(
    (queueKey: string, itemId: string) => {
      const items = loadQueue<QueueItem>(queueKey);
      const updated = items.filter((i) => i.id !== itemId);
      saveQueue(queueKey, updated);
      refresh();
    },
    [refresh],
  );

  // Initial load and periodic refresh
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  // Listen for online/offline events
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      refresh();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false, state: "offline" }));
    };

    const handleManualSync = () => {
      void manualSync();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("campreserv:manual-sync", handleManualSync);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("campreserv:manual-sync", handleManualSync);
    };
  }, [refresh, manualSync]);

  // Listen for service worker messages
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SYNC_COMPLETE" || event.data?.type === "SYNC_QUEUES") {
        refresh();
      }
    };

    navigator.serviceWorker?.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [refresh]);

  return (
    <SyncStatusContext.Provider
      value={{
        status,
        refresh,
        manualSync,
        clearQueue,
        retryConflict,
        discardConflict,
      }}
    >
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error("useSyncStatus must be used within a SyncStatusProvider");
  }
  return context;
}
