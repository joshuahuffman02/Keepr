"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTelemetry } from "@/lib/sync-telemetry";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { loadQueue as loadQueueGeneric, saveQueue as saveQueueGeneric } from "@/lib/offline-queue";
import { OfflineTelemetryPanel } from "@/components/pwa/OfflineTelemetryPanel";

type TelemetryEntry = ReturnType<typeof getTelemetry>[number];

export default function SyncLogPage() {
  const [entries, setEntries] = useState<TelemetryEntry[]>([]);
  const [queues, setQueues] = useState<{ label: string; count: number }[]>([]);
  const [queueStats, setQueueStats] = useState<
    Array<{ key: string; label: string; count: number; conflicts: number; nextRetry?: number | null; lastError?: string | null }>
  >([]);
  const [flushStatus, setFlushStatus] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<
    { queueKey: string; label: string; item: any }[]
  >([]);

  const queueSources = [
    { key: "campreserv:pwa:queuedMessages", label: "Guest messages" },
    { key: "campreserv:pos:orderQueue", label: "POS orders" },
    { key: "campreserv:kiosk:checkinQueue", label: "Kiosk check-ins" },
    { key: "campreserv:portal:orderQueue", label: "Portal orders" },
    { key: "campreserv:portal:activityQueue", label: "Activity bookings" },
  ];

  const loadQueues = () => {
    if (typeof window === "undefined") return;
    const counts = queueSources.map(({ key, label }) => {
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(parsed) ? parsed.length : 0;
        return { label, count };
      } catch {
        return { label, count: 0 };
      }
    });
    setQueues(counts);

    const conflictItems: { queueKey: string; label: string; item: any }[] = [];
    const stats: { key: string; label: string; count: number; conflicts: number; nextRetry?: number | null; lastError?: string | null }[] = [];
    for (const q of queueSources) {
      try {
        const list = loadQueueGeneric<any>(q.key);
        const conflictsForQueue = list.filter((i: any) => i?.conflict);
        conflictsForQueue.forEach((item: any) => conflictItems.push({ queueKey: q.key, label: q.label, item }));
        const nextRetry =
          list
            .map((i: any) => i?.nextAttemptAt)
            .filter((n: any) => typeof n === "number")
            .sort((a: number, b: number) => a - b)[0] ?? null;
        const lastError = list.map((i: any) => i?.lastError).find((e: any) => e);
        stats.push({
          key: q.key,
          label: q.label,
          count: Array.isArray(list) ? list.length : 0,
          conflicts: conflictsForQueue.length,
          nextRetry,
          lastError: lastError ?? null,
        });
      } catch {
        // ignore
      }
    }
    setConflicts(conflictItems);
    setQueueStats(stats);
  };

  useEffect(() => {
    setEntries(getTelemetry());
    loadQueues();
  }, []);

  const refresh = () => {
    setEntries(getTelemetry());
    loadQueues();
  };

  const clearTelemetry = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("campreserv:syncTelemetry");
    setEntries([]);
  };

  const updateQueueItem = (queueKey: string, itemId: string, updater: (item: any) => any | null) => {
    const list = loadQueueGeneric<any>(queueKey);
    const updated = list
      .map((i) => (i.id === itemId ? updater(i) : i))
      .filter(Boolean);
    saveQueueGeneric(queueKey, updated);
    loadQueues();
  };

  const retryConflict = (queueKey: string, itemId: string) => {
    updateQueueItem(queueKey, itemId, (i) => ({ ...i, conflict: false, nextAttemptAt: Date.now() }));
    recordTelemetry({ source: "sync-log", type: "conflict", status: "pending", message: "Retry requested", meta: { queueKey, itemId } });
  };

  const discardConflict = (queueKey: string, itemId: string) => {
    updateQueueItem(queueKey, itemId, () => null);
    recordTelemetry({ source: "sync-log", type: "conflict", status: "success", message: "Discarded conflicted item", meta: { queueKey, itemId } });
  };

  const flushQueues = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) {
      setFlushStatus("Offline — reconnect to flush");
      return;
    }
    setFlushStatus("Flushing…");
    try {
      // Guest message queue
      try {
        const raw = localStorage.getItem("campreserv:pwa:queuedMessages");
        const items = raw ? JSON.parse(raw) : [];
        const remaining: any[] = [];
        for (const item of items) {
          try {
            await apiClient.sendReservationMessage(item.reservationId, item.content, "guest", item.guestId);
            recordTelemetry({ source: "guest-pwa", type: "sync", status: "success", message: "Manual flush message", meta: { reservationId: item.reservationId } });
          } catch (err: any) {
            remaining.push(item);
            recordTelemetry({ source: "guest-pwa", type: "error", status: "failed", message: "Flush message failed", meta: { error: err?.message } });
          }
        }
        localStorage.setItem("campreserv:pwa:queuedMessages", JSON.stringify(remaining));
      } catch {
        /* ignore */
      }

      // POS orders
      try {
        const raw = localStorage.getItem("campreserv:pos:orderQueue");
        const items = raw ? JSON.parse(raw) : [];
        const remaining: any[] = [];
        for (const item of items) {
          try {
            await apiClient.createStoreOrder(item.campgroundId, item.payload);
            recordTelemetry({ source: "pos", type: "sync", status: "success", message: "Manual flush POS order", meta: { paymentMethod: item.payload?.paymentMethod } });
          } catch (err: any) {
            remaining.push(item);
            recordTelemetry({ source: "pos", type: "error", status: "failed", message: "Flush POS order failed", meta: { error: err?.message } });
          }
        }
        localStorage.setItem("campreserv:pos:orderQueue", JSON.stringify(remaining));
      } catch {
        /* ignore */
      }

      // Kiosk check-ins
      try {
        const raw = localStorage.getItem("campreserv:kiosk:checkinQueue");
        const items = raw ? JSON.parse(raw) : [];
        const remaining: any[] = [];
        for (const item of items) {
          try {
            const deviceToken = localStorage.getItem("campreserv:kioskDeviceToken") || undefined;
            await apiClient.kioskCheckIn(item.reservationId, item.upsellTotal, deviceToken);
            recordTelemetry({ source: "kiosk", type: "sync", status: "success", message: "Manual flush check-in", meta: { reservationId: item.reservationId } });
          } catch (err: any) {
            remaining.push(item);
            recordTelemetry({ source: "kiosk", type: "error", status: "failed", message: "Flush check-in failed", meta: { error: err?.message } });
          }
        }
        localStorage.setItem("campreserv:kiosk:checkinQueue", JSON.stringify(remaining));
      } catch {
        /* ignore */
      }

      // Portal store orders
      try {
        const raw = localStorage.getItem("campreserv:portal:orderQueue");
        const items = raw ? JSON.parse(raw) : [];
        const remaining: any[] = [];
        for (const item of items) {
          try {
            await apiClient.createStoreOrder(item.campgroundId, item.payload);
            recordTelemetry({ source: "portal-store", type: "sync", status: "success", message: "Manual flush portal order", meta: { paymentMethod: item.payload?.paymentMethod } });
          } catch (err: any) {
            remaining.push(item);
            recordTelemetry({ source: "portal-store", type: "error", status: "failed", message: "Flush portal order failed", meta: { error: err?.message } });
          }
        }
        localStorage.setItem("campreserv:portal:orderQueue", JSON.stringify(remaining));
      } catch {
        /* ignore */
      }

      // Portal activity bookings
      try {
        const raw = localStorage.getItem("campreserv:portal:activityQueue");
        const items = raw ? JSON.parse(raw) : [];
        const remaining: any[] = [];
        for (const item of items) {
          try {
            await apiClient.bookActivity(item.sessionId, item.payload);
            recordTelemetry({ source: "portal-activities", type: "sync", status: "success", message: "Manual flush activity booking", meta: { sessionId: item.sessionId } });
          } catch (err: any) {
            remaining.push(item);
            recordTelemetry({ source: "portal-activities", type: "error", status: "failed", message: "Flush activity booking failed", meta: { error: err?.message } });
          }
        }
        localStorage.setItem("campreserv:portal:activityQueue", JSON.stringify(remaining));
      } catch {
        /* ignore */
      }

      setFlushStatus("Flush complete");
    } catch (err: any) {
      setFlushStatus("Flush failed");
      recordTelemetry({ source: "sync-log", type: "error", status: "failed", message: "Manual flush failed", meta: { error: err?.message } });
    } finally {
      refresh();
      setTimeout(() => setFlushStatus(null), 3000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-4 space-y-4">
      <header className="pwa-card p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">PWA</div>
          <h1 className="text-xl font-semibold text-slate-50">Sync Log</h1>
          <p className="text-slate-400 text-sm">Local telemetry for offline queues, cache reads, and retries.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/pwa/guest">Guest</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/pwa/staff">Staff</Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={flushQueues} disabled={!!flushStatus && flushStatus.startsWith("Flushing")}>
            {flushStatus?.startsWith("Flushing") ? "Flushing…" : "Flush queues now"}
          </Button>
          <Button variant="outline" size="sm" onClick={clearTelemetry}>
            Clear log
          </Button>
        </div>
      </header>

      <OfflineTelemetryPanel variant="dark" />

      {flushStatus && (
        <div className="pwa-card p-3 text-sm text-slate-50 border border-slate-800 bg-slate-900/70">
          {flushStatus}
        </div>
      )}

      {conflicts.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="text-slate-50">Conflicts to resolve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {conflicts.map(({ queueKey, label, item }) => (
              <div key={item.id} className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{label}</div>
                  <Badge variant="secondary">conflict</Badge>
                </div>
                <div className="text-xs text-slate-200 break-words">
                  {item.lastError || "Conflict detected"}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => retryConflict(queueKey, item.id)}>
                    Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => discardConflict(queueKey, item.id)}>
                    Discard
                  </Button>
                  <span className="text-[11px] text-slate-400">id: {item.id.slice(0, 8)}…</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {queues.length > 0 && (
        <div className="pwa-card p-4 flex flex-wrap gap-3">
          {queues.map((q) => (
            <Badge key={q.label} variant={q.count > 0 ? "secondary" : "outline"}>
              {q.label}: {q.count}
            </Badge>
          ))}
        </div>
      )}

      {queueStats.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="text-slate-50">Queue health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {queueStats.map((q) => (
              <div key={q.key} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{q.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={q.count > 0 ? "secondary" : "outline"}>{q.count} queued</Badge>
                    {q.conflicts > 0 && <Badge variant="destructive">{q.conflicts} conflicts</Badge>}
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap gap-3">
                  <span>Next retry: {q.nextRetry ? new Date(q.nextRetry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>
                  <span>Last error: {q.lastError || "—"}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {entries.length === 0 ? (
        <div className="pwa-card p-4 text-sm text-slate-300">No telemetry recorded yet.</div>
      ) : (
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="text-slate-50">Recent events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{e.source}</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {e.type}
                    </Badge>
                    <Badge variant={e.status === "failed" ? "destructive" : e.status === "pending" ? "secondary" : e.status === "conflict" ? "secondary" : "outline"}>
                      {e.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-slate-100">{e.message}</div>
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>{new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  {e.meta && <span className="truncate max-w-[60%]">{JSON.stringify(e.meta)}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
