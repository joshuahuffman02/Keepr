"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { format } from "date-fns";
import {
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  MapPin,
  Plus,
  Filter,
  X,
} from "lucide-react";

type TaskState = "pending" | "in_progress" | "blocked" | "done" | "failed" | "expired";
type SlaStatus = "on_track" | "at_risk" | "breached";
type TaskType = "turnover" | "inspection" | "other";

function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, h:mma");
}

function SlaStatusBadge({ status }: { status: SlaStatus }) {
  const styles = {
    on_track: "bg-emerald-100 text-emerald-700 border-emerald-200",
    at_risk: "bg-amber-100 text-amber-700 border-amber-200",
    breached: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const icons = {
    on_track: <CheckCircle className="h-3 w-3" />,
    at_risk: <Clock className="h-3 w-3" />,
    breached: <AlertTriangle className="h-3 w-3" />,
  };
  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${styles[status]}`}>
      {icons[status]}
      {status.replace("_", " ")}
    </Badge>
  );
}

function TaskStateDropdown({
  current,
  onChange,
  disabled,
}: {
  current: TaskState;
  onChange: (state: TaskState) => void;
  disabled?: boolean;
}) {
  const states: TaskState[] = ["pending", "in_progress", "blocked", "done", "failed"];
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value as TaskState)}
      disabled={disabled}
      className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
    >
      {states.map((s) => (
        <option key={s} value={s}>
          {s.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}

export default function HousekeepingPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const campgroundId = params.campgroundId as string;

  const [stateFilter, setStateFilter] = useState<TaskState | "all">("all");
  const [slaFilter, setSlaFilter] = useState<SlaStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState<{
    type: TaskType;
    siteId: string;
    priority: string;
    notes: string;
  }>({ type: "turnover", siteId: "", priority: "medium", notes: "" });

  const tasksQuery = useQuery({
    queryKey: ["tasks", campgroundId, stateFilter, slaFilter, typeFilter],
    queryFn: () =>
      apiClient.listTasks(campgroundId, {
        state: stateFilter === "all" ? undefined : stateFilter,
        slaStatus: slaFilter === "all" ? undefined : slaFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      } as any),
    enabled: !!campgroundId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: TaskState }) =>
      apiClient.updateTask(id, { state } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", campgroundId] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: {
      type: string;
      siteId: string;
      priority?: string;
      notes?: string;
      createdBy: string;
    }) => apiClient.createTask(campgroundId, payload as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", campgroundId] });
      setShowCreateModal(false);
      setNewTask({ type: "turnover", siteId: "", priority: "medium", notes: "" });
    },
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId,
  });
  const sites = sitesQuery.data || [];

  const tasks = tasksQuery.data || [];

  const tasksByState = {
    pending: tasks.filter((t: any) => t.state === "pending"),
    in_progress: tasks.filter((t: any) => t.state === "in_progress"),
    blocked: tasks.filter((t: any) => t.state === "blocked"),
    done: tasks.filter((t: any) => t.state === "done"),
  };

  const stats = {
    total: tasks.length,
    onTrack: tasks.filter((t: any) => t.slaStatus === "on_track").length,
    atRisk: tasks.filter((t: any) => t.slaStatus === "at_risk").length,
    breached: tasks.filter((t: any) => t.slaStatus === "breached").length,
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Housekeeping" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Housekeeping Tasks</h1>
            <p className="text-sm text-slate-500">
              Manage turnovers, inspections, and site-ready status
            </p>
          </div>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Tasks</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-emerald-600">{stats.onTrack}</div>
            <div className="text-xs text-slate-500">On Track</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.atRisk}</div>
            <div className="text-xs text-slate-500">At Risk</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-rose-600">{stats.breached}</div>
            <div className="text-xs text-slate-500">Breached</div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as TaskState | "all")}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            <option value="all">All States</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="failed">Failed</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value as SlaStatus | "all")}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            <option value="all">All SLA</option>
            <option value="on_track">On Track</option>
            <option value="at_risk">At Risk</option>
            <option value="breached">Breached</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1"
          >
            <option value="all">All Types</option>
            <option value="turnover">Turnover</option>
            <option value="inspection">Inspection</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Task Board */}
        {tasksQuery.isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No tasks found. Create a new task to get started.
          </div>
        ) : (
          <div className="grid md:grid-cols-4 gap-4">
            {(["pending", "in_progress", "blocked", "done"] as const).map((stateKey) => (
              <div key={stateKey} className="space-y-2">
                <div className="font-medium text-sm text-slate-700 capitalize flex items-center gap-2">
                  {stateKey.replace("_", " ")}
                  <Badge variant="secondary" className="text-xs">
                    {tasksByState[stateKey].length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {tasksByState[stateKey].map((task: any) => (
                    <Card key={task.id} className="p-3 hover:shadow-md transition-shadow">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-sm capitalize">
                              {task.type}
                            </span>
                          </div>
                          <SlaStatusBadge status={task.slaStatus} />
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          Site {task.siteId?.slice(-6) || "—"}
                        </div>

                        {task.assignedToUserId && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <User className="h-3 w-3" />
                            {task.assignedToUserId.slice(-6)}
                          </div>
                        )}

                        {task.slaDueAt && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="h-3 w-3" />
                            Due: {formatDateTime(task.slaDueAt)}
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100">
                          <TaskStateDropdown
                            current={task.state}
                            onChange={(newState) =>
                              updateTaskMutation.mutate({ id: task.id, state: newState })
                            }
                            disabled={updateTaskMutation.isPending}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Task Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Create Task</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowCreateModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <select
                    value={newTask.type}
                    onChange={(e) =>
                      setNewTask({ ...newTask, type: e.target.value as TaskType })
                    }
                    className="w-full mt-1 border border-slate-200 rounded px-3 py-2"
                  >
                    <option value="turnover">Turnover</option>
                    <option value="inspection">Inspection</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Site</label>
                  <select
                    value={newTask.siteId}
                    onChange={(e) =>
                      setNewTask({ ...newTask, siteId: e.target.value })
                    }
                    className="w-full mt-1 border border-slate-200 rounded px-3 py-2"
                  >
                    <option value="">Select a site...</option>
                    {sites.map((site: any) => (
                      <option key={site.id} value={site.id}>
                        {site.name} #{site.siteNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask({ ...newTask, priority: e.target.value })
                    }
                    className="w-full mt-1 border border-slate-200 rounded px-3 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={newTask.notes}
                    onChange={(e) =>
                      setNewTask({ ...newTask, notes: e.target.value })
                    }
                    className="w-full mt-1 border border-slate-200 rounded px-3 py-2"
                    rows={3}
                    placeholder="Optional notes..."
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!newTask.siteId || createTaskMutation.isPending}
                    onClick={() =>
                      createTaskMutation.mutate({
                        type: newTask.type,
                        siteId: newTask.siteId,
                        priority: newTask.priority,
                        notes: newTask.notes || undefined,
                        createdBy: "staff", // TODO: Use actual user ID
                      })
                    }
                  >
                    {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

