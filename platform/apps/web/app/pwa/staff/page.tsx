"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { registerBackgroundSync } from "@/lib/offline-queue";

type Task = {
  id: string;
  title: string;
  siteName?: string;
  dueAt?: string;
  status: "open" | "in_progress" | "closed";
};

type Arrival = {
  id: string;
  guest: string;
  site: string;
  arrivalDate: string;
  status: string;
};

type Reservation = Awaited<ReturnType<typeof apiClient.getCampgroundReservations>>[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTaskStatus = (value: unknown): value is Task["status"] =>
  value === "open" || value === "in_progress" || value === "closed";

const toTask = (value: unknown): Task | null => {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const siteName =
    isRecord(value.site) && typeof value.site.name === "string" ? value.site.name : undefined;
  const status = isTaskStatus(value.status) ? value.status : "open";
  return {
    id: value.id,
    title: typeof value.title === "string" && value.title ? value.title : "Task",
    siteName,
    dueAt: typeof value.dueDate === "string" ? value.dueDate : undefined,
    status,
  };
};

const toArrival = (reservation: Reservation): Arrival => {
  const guestFirst = reservation.guest?.primaryFirstName ?? "";
  const guestLast = reservation.guest?.primaryLastName ?? "";
  const guestName = `${guestFirst} ${guestLast}`.trim() || "Guest";
  return {
    id: reservation.id,
    guest: guestName,
    site: reservation.site?.name ?? "Unassigned",
    arrivalDate: reservation.arrivalDate,
    status: reservation.status,
  };
};

export default function StaffPwaPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = useMemo(() => "campreserv:pwa:staffCache", []);
  const [usedCache, setUsedCache] = useState(false);

  const loadCache = () => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const saveCache = (payload: { tasks: Task[]; arrivals: Arrival[] }) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch {
      // noop
    }
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const cached = loadCache();
      if (cached && !navigator.onLine) {
        setTasks(cached.tasks);
        setArrivals(cached.arrivals);
        setLoading(false);
        setUsedCache(true);
        recordTelemetry({
          source: "staff-pwa",
          type: "cache",
          status: "success",
          message: "Loaded arrivals/tasks from cache (offline)",
          meta: { tasks: cached.tasks.length, arrivals: cached.arrivals.length },
        });
        return;
      }
      try {
        // Reuse existing endpoints: maintenance for tasks, reservations for arrivals
        const [maintenance, reservations] = await Promise.all([
          apiClient.getMaintenance().catch(() => []),
          apiClient.getCampgroundReservations().catch(() => []),
        ]);

        if (!isMounted) return;

        const maintenanceTasks = (maintenance ?? [])
          .map(toTask)
          .filter((task): task is Task => task !== null)
          .slice(0, 8);

        const arrivalList = (reservations ?? [])
          .filter(
            (reservation) => reservation.status === "confirmed" || reservation.status === "pending",
          )
          .slice(0, 8)
          .map(toArrival);

        setTasks(maintenanceTasks);
        setArrivals(arrivalList);
        saveCache({
          tasks: maintenanceTasks,
          arrivals: arrivalList,
        });
        setUsedCache(false);
        recordTelemetry({
          source: "staff-pwa",
          type: "sync",
          status: "success",
          message: "Arrivals/tasks refreshed online",
          meta: { tasks: (maintenance ?? []).length, arrivals: (reservations ?? []).length },
        });
        void registerBackgroundSync();
      } catch (e: unknown) {
        if (!isMounted) return;
        const message = e instanceof Error ? e.message : "Failed to load";
        setError(message);
        if (cached) {
          setTasks(cached.tasks);
          setArrivals(cached.arrivals);
          setUsedCache(true);
          recordTelemetry({
            source: "staff-pwa",
            type: "cache",
            status: "pending",
            message: "Using cached arrivals/tasks after load failure",
            meta: { error: message },
          });
        }
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, { text: string; variant: "default" | "secondary" | "outline" }> = {
      open: { text: "Open", variant: "secondary" },
      in_progress: { text: "In Progress", variant: "default" },
      closed: { text: "Done", variant: "outline" },
      confirmed: { text: "Confirmed", variant: "default" },
      pending: { text: "Pending", variant: "secondary" },
    };
    const cfg = map[status] ?? { text: status, variant: "outline" };
    return <Badge variant={cfg.variant}>{cfg.text}</Badge>;
  };

  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-4 space-y-4">
      <header className="pwa-card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-400">Staff PWA</div>
          <h1 className="text-xl font-semibold text-slate-50">Arrivals & Tasks</h1>
          <p className="text-slate-400 text-sm">Fast, offline-friendly view for today’s work.</p>
        </div>
        <div className="flex items-center gap-2">
          {offline && <Badge variant="outline">Offline</Badge>}
          {usedCache && <Badge variant="secondary">Cached</Badge>}
          <Badge
            variant="outline"
            title="Read-only data cached. Edits queue via background sync. Use sync log for queue details."
          >
            Queue health
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link href="/pwa/sync-log">Sync log</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigator.serviceWorker?.controller?.postMessage({ type: "TRIGGER_SYNC" })
            }
          >
            Sync now
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/">Exit</Link>
          </Button>
        </div>
      </header>

      {error && <div className="pwa-card p-3 text-sm text-red-100 border-red-500">{error}</div>}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="pwa-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Arrivals</div>
              <h2 className="text-lg font-semibold text-slate-50">Today & upcoming</h2>
            </div>
            <Badge variant="outline">{arrivals.length}</Badge>
          </div>
          {loading ? (
            <div className="text-sm text-slate-400">Loading...</div>
          ) : arrivals.length === 0 ? (
            <div className="text-sm text-slate-400">No arrivals found.</div>
          ) : (
            <div className="space-y-2">
              {arrivals.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{a.guest}</div>
                    <div className="text-xs text-slate-400">
                      {a.site} • {a.arrivalDate ? new Date(a.arrivalDate).toLocaleDateString() : ""}
                    </div>
                  </div>
                  {statusBadge(a.status)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pwa-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Tasks</div>
              <h2 className="text-lg font-semibold text-slate-50">Open & in progress</h2>
            </div>
            <Badge variant="outline">{tasks.length}</Badge>
          </div>
          {loading ? (
            <div className="text-sm text-slate-400">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-sm text-slate-400">No tasks found.</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{t.title}</div>
                    {statusBadge(t.status)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {t.siteName || "No site"}{" "}
                    {t.dueAt ? `• Due ${new Date(t.dueAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
