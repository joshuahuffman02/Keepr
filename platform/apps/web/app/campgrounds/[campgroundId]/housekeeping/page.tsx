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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
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
  Calendar,
  Users,
  Home,
  Settings,
  BarChart3,
  Sparkles,
  ArrowRightLeft,
} from "lucide-react";

type TaskState = "pending" | "in_progress" | "blocked" | "done" | "failed" | "expired";
type SlaStatus = "on_track" | "at_risk" | "breached";
type TaskType = "turnover" | "inspection" | "deep_clean" | "touch_up" | "vip_prep" | "linen_change" | "other";

type ListTasksParams = {
  state?: TaskState;
  slaStatus?: SlaStatus;
  type?: TaskType;
};

type UpdateTaskPayload = {
  state: TaskState;
};

type CreateTaskPayload = {
  type: string;
  siteId: string;
  priority?: string;
  notes?: string;
  createdBy: string;
};

type DailyScheduleData = {
  summary?: {
    checkouts?: number;
    checkins?: number;
    turnovers?: number;
    priorityCount?: number;
    stayoverCount?: number;
  };
  expectedCheckouts?: Array<{ id: string; siteName?: string; guestName?: string; time?: string }>;
  expectedCheckins?: Array<{ id: string; siteName?: string; guestName?: string; time?: string }>;
  expectedTurnovers?: Array<{ id: string; siteName?: string; arrivalTime?: string; departureTime?: string }>;
  stayovers?: Array<{ id: string; siteName?: string; guestName?: string }>;
  prioritySites?: Array<{ id: string; siteName?: string; priority?: string; reason?: string }>;
  priorityUnits?: string[];
};

function formatDateTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, h:mma");
}

function formatTime(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "h:mma");
}

function SlaStatusBadge({ status }: { status: SlaStatus }) {
  const styles = {
    on_track: "bg-status-success/15 text-status-success",
    at_risk: "bg-status-warning/15 text-status-warning",
    breached: "bg-status-error/15 text-status-error",
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

function HousekeepingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    vacant_dirty: "bg-status-error/15 text-status-error",
    cleaning_in_progress: "bg-status-info/15 text-status-info",
    pending_inspection: "bg-status-warning/15 text-status-warning",
    inspection_failed: "bg-status-error/15 text-status-error",
    vacant_clean: "bg-status-success/15 text-status-success",
    vacant_inspected: "bg-status-success/15 text-status-success",
    occupied: "bg-slate-100 text-slate-700 border-slate-200",
    occupied_service: "bg-purple-100 text-purple-700 border-purple-200",
    occupied_dnd: "bg-status-warning/15 text-status-warning",
    out_of_order: "bg-gray-100 text-gray-700 border-gray-200",
  };
  const labels: Record<string, string> = {
    vacant_dirty: "Dirty",
    cleaning_in_progress: "Cleaning",
    pending_inspection: "Inspect",
    inspection_failed: "Failed",
    vacant_clean: "Clean",
    vacant_inspected: "Ready",
    occupied: "Occupied",
    occupied_service: "Service",
    occupied_dnd: "DND",
    out_of_order: "OOO",
  };
  return (
    <Badge variant="outline" className={styles[status] || "bg-slate-100 text-slate-700"}>
      {labels[status] || status}
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

function TaskTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    turnover: "bg-blue-500",
    deep_clean: "bg-purple-500",
    touch_up: "bg-green-500",
    inspection: "bg-yellow-500",
    vip_prep: "bg-red-500",
    linen_change: "bg-cyan-500",
    pet_treatment: "bg-orange-500",
    other: "bg-slate-500",
  };
  const labels: Record<string, string> = {
    turnover: "Turnover",
    deep_clean: "Deep Clean",
    touch_up: "Touch Up",
    inspection: "Inspection",
    vip_prep: "VIP",
    linen_change: "Linens",
    pet_treatment: "Pet",
    other: "Other",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${styles[type] || styles.other}`}>
      {labels[type] || type}
    </span>
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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
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
      } as ListTasksParams),
    enabled: !!campgroundId,
  });

  const housekeepingStatsQuery = useQuery({
    queryKey: ["housekeeping-stats", campgroundId],
    queryFn: () => apiClient.getHousekeepingStatusStats(campgroundId),
    enabled: !!campgroundId,
  });

  const dailyScheduleQuery = useQuery({
    queryKey: ["daily-schedule", campgroundId, selectedDate],
    queryFn: () => apiClient.getDailySchedule(campgroundId, selectedDate),
    enabled: !!campgroundId,
  });

  const staffWorkloadQuery = useQuery({
    queryKey: ["staff-workload", campgroundId, selectedDate],
    queryFn: () => apiClient.getStaffWorkload(campgroundId, selectedDate),
    enabled: !!campgroundId,
  });

  const inspectionStatsQuery = useQuery({
    queryKey: ["inspection-stats", campgroundId],
    queryFn: () => apiClient.getInspectionStats(campgroundId),
    enabled: !!campgroundId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: TaskState }) =>
      apiClient.updateTask(id, { state } as Parameters<typeof apiClient.updateTask>[1]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", campgroundId] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: CreateTaskPayload) => apiClient.createTask(campgroundId, payload as Parameters<typeof apiClient.createTask>[1]),
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
  const dailySchedule = dailyScheduleQuery.data as DailyScheduleData | undefined;
  const staffWorkload = staffWorkloadQuery.data || {};
  const housekeepingStats = housekeepingStatsQuery.data;
  const inspectionStats = inspectionStatsQuery.data;

  const tasksByState = {
    pending: tasks.filter((t: any) => t.state === "pending"),
    in_progress: tasks.filter((t: any) => t.state === "in_progress"),
    blocked: tasks.filter((t: any) => t.state === "blocked"),
    done: tasks.filter((t: any) => t.state === "done"),
  };

  const slaStats = {
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
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Housekeeping" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Housekeeping</h1>
            <p className="text-sm text-slate-500">
              Manage cleaning tasks, inspections, and room readiness
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/campgrounds/${campgroundId}/housekeeping/templates`}>
                <Settings className="h-4 w-4 mr-1" />
                Templates
              </a>
            </Button>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Task
            </Button>
          </div>
        </div>

        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tasks" className="flex items-center gap-1">
              <ClipboardCheck className="h-4 w-4" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Daily Schedule
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-1">
              <Home className="h-4 w-4" />
              Room Status
            </TabsTrigger>
            <TabsTrigger value="workload" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              Staff Workload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card className="p-4">
                <div className="text-2xl font-bold text-slate-900">{slaStats.total}</div>
                <div className="text-xs text-slate-500">Total Tasks</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-emerald-600">{slaStats.onTrack}</div>
                <div className="text-xs text-slate-500">On Track</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-amber-600">{slaStats.atRisk}</div>
                <div className="text-xs text-slate-500">At Risk</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-rose-600">{slaStats.breached}</div>
                <div className="text-xs text-slate-500">Breached</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-blue-600">{inspectionStats?.passRate ?? 0}%</div>
                <div className="text-xs text-slate-500">Inspection Pass Rate</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-purple-600">{inspectionStats?.averageScore ?? 0}</div>
                <div className="text-xs text-slate-500">Avg Inspection Score</div>
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
                <option value="deep_clean">Deep Clean</option>
                <option value="touch_up">Touch Up</option>
                <option value="inspection">Inspection</option>
                <option value="vip_prep">VIP Prep</option>
                <option value="linen_change">Linen Change</option>
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
                              <TaskTypeBadge type={task.type} />
                              <SlaStatusBadge status={task.slaStatus} />
                            </div>

                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3" />
                              {task.site?.name || `Site ${task.siteId?.slice(-6) || "—"}`}
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
                                Due: {formatTime(task.slaDueAt)}
                              </div>
                            )}

                            {task.priority === "high" && (
                              <Badge variant="destructive" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Priority
                              </Badge>
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
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2"
              />
              {dailySchedule && (
                <div className="text-sm text-slate-500">
                  {dailySchedule.summary?.checkouts ?? 0} checkouts | {dailySchedule.summary?.checkins ?? 0} check-ins | {dailySchedule.summary?.turnovers ?? 0} turnovers
                </div>
              )}
            </div>

            {dailyScheduleQuery.isLoading ? (
              <div className="text-center py-12 text-slate-500">Loading schedule...</div>
            ) : !dailySchedule ? (
              <div className="text-center py-12 text-slate-500">No schedule data available.</div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {/* Checkouts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-rose-500" />
                      Checkouts ({dailySchedule.expectedCheckouts?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailySchedule.expectedCheckouts?.slice(0, 10).map((checkout: any) => (
                      <div key={checkout.reservationId} className="p-2 border rounded text-sm">
                        <div className="font-medium">{checkout.siteName}</div>
                        <div className="text-xs text-slate-500">{checkout.guestName}</div>
                      </div>
                    ))}
                    {(dailySchedule.expectedCheckouts?.length ?? 0) === 0 && (
                      <div className="text-sm text-slate-400">No checkouts today</div>
                    )}
                  </CardContent>
                </Card>

                {/* Check-ins */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-emerald-500" />
                      Check-ins ({dailySchedule.expectedCheckins?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailySchedule.expectedCheckins?.slice(0, 10).map((checkin: any) => (
                      <div key={checkin.reservationId} className="p-2 border rounded text-sm">
                        <div className="font-medium flex items-center gap-2">
                          {checkin.siteName}
                          {checkin.isVIP && <Badge variant="destructive" className="text-xs">VIP</Badge>}
                          {checkin.isEarlyArrival && <Badge variant="secondary" className="text-xs">Early</Badge>}
                        </div>
                        <div className="text-xs text-slate-500">{checkin.guestName}</div>
                      </div>
                    ))}
                    {(dailySchedule.expectedCheckins?.length ?? 0) === 0 && (
                      <div className="text-sm text-slate-400">No check-ins today</div>
                    )}
                  </CardContent>
                </Card>

                {/* Priority Units */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Priority ({dailySchedule.summary?.priorityCount ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailySchedule.priorityUnits?.slice(0, 10).map((siteId: string) => (
                      <div key={siteId} className="p-2 border border-amber-200 bg-amber-50 rounded text-sm">
                        <div className="font-medium">{siteId.slice(-8)}</div>
                        <div className="text-xs text-amber-600">VIP / Early Arrival</div>
                      </div>
                    ))}
                    {(dailySchedule.priorityUnits?.length ?? 0) === 0 && (
                      <div className="text-sm text-slate-400">No priority units</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            {/* Room Status Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {housekeepingStats?.byStatus && Object.entries(housekeepingStats.byStatus).map(([status, count]) => (
                <Card key={status} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">{count as number}</div>
                      <div className="text-xs text-slate-500 capitalize">{status.replace(/_/g, " ")}</div>
                    </div>
                    <HousekeepingStatusBadge status={status} />
                  </div>
                </Card>
              ))}
              {!housekeepingStats?.byStatus && (
                <div className="col-span-5 text-center py-8 text-slate-500">
                  Loading room status...
                </div>
              )}
            </div>

            {/* Site List by Status */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {["vacant_dirty", "cleaning_in_progress", "pending_inspection"].map((status) => (
                <Card key={status}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <HousekeepingStatusBadge status={status} />
                      <span className="capitalize">{status.replace(/_/g, " ")}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {sites
                        .filter((s: any) => s.housekeepingStatus === status)
                        .slice(0, 10)
                        .map((site: any) => (
                          <div key={site.id} className="text-sm p-2 border rounded flex justify-between">
                            <span>{site.name}</span>
                            {site.zone && <span className="text-xs text-slate-400">{site.zone}</span>}
                          </div>
                        ))}
                      {sites.filter((s: any) => s.housekeepingStatus === status).length === 0 && (
                        <div className="text-sm text-slate-400">None</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="workload" className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-200 rounded px-3 py-2"
              />
            </div>

            {staffWorkloadQuery.isLoading ? (
              <div className="text-center py-12 text-slate-500">Loading workload...</div>
            ) : Object.keys(staffWorkload).length === 0 ? (
              <div className="text-center py-12 text-slate-500">No workload data available.</div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(staffWorkload).map(([userId, data]: [string, any]) => (
                  <Card key={userId}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {userId === "unassigned" ? "Unassigned" : userId.slice(-8)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-xl font-bold">{data.total}</div>
                          <div className="text-xs text-slate-500">Total</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-emerald-600">{data.completed}</div>
                          <div className="text-xs text-slate-500">Done</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-blue-600">{data.inProgress}</div>
                          <div className="text-xs text-slate-500">Active</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-slate-600">{data.pending}</div>
                          <div className="text-xs text-slate-500">Pending</div>
                        </div>
                      </div>
                      {data.total > 0 && (
                        <div className="mt-3">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${(data.completed / data.total) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 mt-1 text-center">
                            {Math.round((data.completed / data.total) * 100)}% complete
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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
                    <option value="deep_clean">Deep Clean</option>
                    <option value="touch_up">Touch Up</option>
                    <option value="inspection">Inspection</option>
                    <option value="vip_prep">VIP Prep</option>
                    <option value="linen_change">Linen Change</option>
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
                        {site.name} {site.zone ? `(${site.zone})` : ""}
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
                    <option value="high">High (VIP/Rush)</option>
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
                        createdBy: "staff",
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
