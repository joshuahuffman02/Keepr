"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { registerBackgroundSync, queueOfflineAction } from "@/lib/offline-queue";

type CleaningTask = {
  id: string;
  siteName: string;
  siteId: string;
  taskType: string;
  state: string;
  priority: string;
  checklist: ChecklistItem[];
  notes?: string;
  slaDueAt?: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
};

type SiteStatus = {
  siteId: string;
  siteName: string;
  housekeepingStatus: string;
  zone?: string;
};

type HousekeepingApiClient = {
  getHousekeepingTasks?: () => Promise<unknown[]>;
  getSiteStatuses?: () => Promise<unknown[]>;
};

export default function HousekeepingPwaPage() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [siteStatuses, setSiteStatuses] = useState<SiteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);
  const cacheKey = useMemo(() => "campreserv:pwa:housekeepingCache", []);
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

  const saveCache = (payload: { tasks: CleaningTask[]; siteStatuses: SiteStatus[] }) => {
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
        setSiteStatuses(cached.siteStatuses);
        setLoading(false);
        setUsedCache(true);
        recordTelemetry({
          source: "housekeeping-pwa",
          type: "cache",
          status: "success",
          message: "Loaded housekeeping data from cache (offline)",
          meta: { tasks: cached.tasks.length },
        });
        return;
      }
      try {
        // Fetch housekeeping tasks and site statuses
        const housekeepingClient = apiClient as unknown as HousekeepingApiClient;
        const [tasksData, sitesData] = await Promise.all([
          housekeepingClient.getHousekeepingTasks?.().catch(() => []),
          housekeepingClient.getSiteStatuses?.().catch(() => []),
        ]);

        if (!isMounted) return;

        const formattedTasks = (tasksData || []).map((t: any) => ({
          id: t.id,
          siteName: t.site?.name ?? "Unknown",
          siteId: t.siteId,
          taskType: t.type || "turnover",
          state: t.state || "pending",
          priority: t.priority || "normal",
          checklist: Array.isArray(t.checklist) ? t.checklist.map((item: any, idx: number) => ({
            id: item.id || `item-${idx}`,
            label: item.label || item.name || `Item ${idx + 1}`,
            completed: item.completed || false,
          })) : [],
          notes: t.notes,
          slaDueAt: t.slaDueAt,
        }));

        const formattedStatuses = (sitesData || []).map((s: any) => ({
          siteId: s.id,
          siteName: s.name,
          housekeepingStatus: s.housekeepingStatus || "vacant_clean",
          zone: s.zone,
        }));

        setTasks(formattedTasks);
        setSiteStatuses(formattedStatuses);
        saveCache({ tasks: formattedTasks, siteStatuses: formattedStatuses });
        setUsedCache(false);
        recordTelemetry({
          source: "housekeeping-pwa",
          type: "sync",
          status: "success",
          message: "Housekeeping data refreshed online",
          meta: { tasks: formattedTasks.length },
        });
        void registerBackgroundSync();
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message || "Failed to load");
        if (cached) {
          setTasks(cached.tasks);
          setSiteStatuses(cached.siteStatuses);
          setUsedCache(true);
          recordTelemetry({
            source: "housekeeping-pwa",
            type: "cache",
            status: "pending",
            message: "Using cached housekeeping data after load failure",
            meta: { error: e?.message },
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleChecklistToggle = async (taskId: string, itemId: string, completed: boolean) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              checklist: task.checklist.map((item) =>
                item.id === itemId ? { ...item, completed } : item
              ),
            }
          : task
      )
    );

    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) =>
        prev
          ? {
              ...prev,
              checklist: prev.checklist.map((item) =>
                item.id === itemId ? { ...item, completed } : item
              ),
            }
          : null
      );
    }

    // Queue the update
    await queueOfflineAction({
      type: "housekeeping:checklistItem",
      payload: { taskId, itemId, completed },
      endpoint: `/api/housekeeping/tasks/${taskId}/checklist/${itemId}`,
      method: "PATCH",
    });

    recordTelemetry({
      source: "housekeeping-pwa",
      type: "sync",
      status: navigator.onLine ? "success" : "pending",
      message: `Checklist item ${completed ? "completed" : "uncompleted"}`,
      meta: { taskId, itemId },
    });
  };

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, state: "done" } : t))
    );
    setSelectedTask(null);

    // Queue the update
    await queueOfflineAction({
      type: "housekeeping:completeTask",
      payload: { taskId },
      endpoint: `/api/tasks/${taskId}`,
      method: "PATCH",
      body: { state: "done" },
    });

    recordTelemetry({
      source: "housekeeping-pwa",
      type: "sync",
      status: navigator.onLine ? "success" : "pending",
      message: "Task marked complete",
      meta: { taskId },
    });
  };

  const handleStartTask = async (taskId: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, state: "in_progress" } : t))
    );

    // Queue the update
    await queueOfflineAction({
      type: "housekeeping:startTask",
      payload: { taskId },
      endpoint: `/api/tasks/${taskId}`,
      method: "PATCH",
      body: { state: "in_progress" },
    });

    recordTelemetry({
      source: "housekeeping-pwa",
      type: "sync",
      status: navigator.onLine ? "success" : "pending",
      message: "Task started",
      meta: { taskId },
    });
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { text: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
      pending: { text: "Pending", variant: "secondary" },
      in_progress: { text: "In Progress", variant: "default" },
      done: { text: "Done", variant: "outline" },
      vacant_dirty: { text: "Dirty", variant: "destructive" },
      cleaning_in_progress: { text: "Cleaning", variant: "default" },
      pending_inspection: { text: "Inspect", variant: "secondary" },
      inspection_failed: { text: "Failed", variant: "destructive" },
      vacant_clean: { text: "Clean", variant: "outline" },
      vacant_inspected: { text: "Ready", variant: "outline" },
      occupied: { text: "Occupied", variant: "default" },
      out_of_order: { text: "OOO", variant: "destructive" },
    };
    const cfg = map[status] ?? { text: status, variant: "outline" };
    return <Badge variant={cfg.variant}>{cfg.text}</Badge>;
  };

  const taskTypeBadge = (type: string) => {
    const map: Record<string, { text: string; color: string }> = {
      turnover: { text: "Turnover", color: "bg-blue-500" },
      deep_clean: { text: "Deep Clean", color: "bg-purple-500" },
      touch_up: { text: "Touch Up", color: "bg-green-500" },
      inspection: { text: "Inspection", color: "bg-yellow-500" },
      vip_prep: { text: "VIP", color: "bg-red-500" },
    };
    const cfg = map[type] ?? { text: type, color: "bg-slate-500" };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${cfg.color}`}>
        {cfg.text}
      </span>
    );
  };

  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const activeTasks = tasks.filter((t) => t.state !== "done");
  const completedTasks = tasks.filter((t) => t.state === "done");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-4 space-y-4">
      <header className="pwa-card p-4 flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-400">Staff PWA</div>
          <h1 className="text-xl font-semibold text-slate-50">Housekeeping</h1>
          <p className="text-slate-400 text-sm">Manage cleaning tasks and inspections.</p>
        </div>
        <div className="flex items-center gap-2">
          {offline && <Badge variant="outline">Offline</Badge>}
          {usedCache && <Badge variant="secondary">Cached</Badge>}
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
            <Link href="/pwa/staff">Back</Link>
          </Button>
        </div>
      </header>

      {error && (
        <div className="pwa-card p-3 text-sm text-red-100 border-red-500">{error}</div>
      )}

      {selectedTask ? (
        <div className="pwa-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">{selectedTask.siteName}</div>
              <div className="flex items-center gap-2 mt-1">
                {taskTypeBadge(selectedTask.taskType)}
                {statusBadge(selectedTask.state)}
                {selectedTask.priority === "high" && (
                  <Badge variant="destructive">High Priority</Badge>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedTask(null)}>
              Close
            </Button>
          </div>

          {selectedTask.notes && (
            <div className="text-sm text-slate-400 bg-slate-800 p-3 rounded">
              {selectedTask.notes}
            </div>
          )}

          {selectedTask.slaDueAt && (
            <div className="text-sm text-slate-400">
              Due: {new Date(selectedTask.slaDueAt).toLocaleTimeString()}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm font-medium text-slate-300">Checklist</div>
            {selectedTask.checklist.length === 0 ? (
              <div className="text-sm text-slate-500">No checklist items</div>
            ) : (
              selectedTask.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer hover:bg-slate-800"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) =>
                      handleChecklistToggle(selectedTask.id, item.id, !!checked)
                    }
                  />
                  <span className={item.completed ? "line-through text-slate-500" : ""}>
                    {item.label}
                  </span>
                </label>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {selectedTask.state === "pending" && (
              <Button onClick={() => handleStartTask(selectedTask.id)}>Start Cleaning</Button>
            )}
            {selectedTask.state === "in_progress" && (
              <Button onClick={() => handleCompleteTask(selectedTask.id)}>
                Mark Complete
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="pwa-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Tasks</div>
                <h2 className="text-lg font-semibold text-slate-50">Active</h2>
              </div>
              <Badge variant="outline">{activeTasks.length}</Badge>
            </div>
            {loading ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : activeTasks.length === 0 ? (
              <div className="text-sm text-slate-400">No active tasks.</div>
            ) : (
              <div className="space-y-2">
                {activeTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 cursor-pointer hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{t.siteName}</div>
                      {statusBadge(t.state)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {taskTypeBadge(t.taskType)}
                      {t.priority === "high" && (
                        <Badge variant="destructive" className="text-xs">
                          Priority
                        </Badge>
                      )}
                    </div>
                    {t.checklist.length > 0 && (
                      <div className="text-xs text-slate-500 mt-1">
                        {t.checklist.filter((i) => i.completed).length}/{t.checklist.length}{" "}
                        items done
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pwa-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Status</div>
                <h2 className="text-lg font-semibold text-slate-50">Site Overview</h2>
              </div>
              <Badge variant="outline">{siteStatuses.length}</Badge>
            </div>
            {loading ? (
              <div className="text-sm text-slate-400">Loading...</div>
            ) : siteStatuses.length === 0 ? (
              <div className="text-sm text-slate-400">No sites found.</div>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {siteStatuses
                  .filter((s) => s.housekeepingStatus !== "occupied")
                  .slice(0, 15)
                  .map((s) => (
                    <div
                      key={s.siteId}
                      className="flex items-center justify-between p-2 rounded border border-slate-800 bg-slate-900/50"
                    >
                      <div>
                        <div className="text-sm font-medium">{s.siteName}</div>
                        {s.zone && (
                          <div className="text-xs text-slate-500">{s.zone}</div>
                        )}
                      </div>
                      {statusBadge(s.housekeepingStatus)}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && !selectedTask && (
        <div className="pwa-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400">Completed</div>
              <h2 className="text-lg font-semibold text-slate-50">Done Today</h2>
            </div>
            <Badge variant="outline">{completedTasks.length}</Badge>
          </div>
          <div className="space-y-1">
            {completedTasks.slice(0, 5).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between p-2 rounded border border-slate-800 bg-slate-900/30"
              >
                <div className="text-sm text-slate-400">{t.siteName}</div>
                {taskTypeBadge(t.taskType)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
