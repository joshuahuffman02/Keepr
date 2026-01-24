"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Textarea } from "../../../../components/ui/textarea";
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
type TaskType =
  | "turnover"
  | "inspection"
  | "deep_clean"
  | "touch_up"
  | "vip_prep"
  | "linen_change"
  | "other";
const EMPTY_SELECT_VALUE = "__empty";

const taskStateValues: TaskState[] = [
  "pending",
  "in_progress",
  "blocked",
  "done",
  "failed",
  "expired",
];
const slaStatusValues: SlaStatus[] = ["on_track", "at_risk", "breached"];
const taskTypeValues: TaskType[] = [
  "turnover",
  "inspection",
  "deep_clean",
  "touch_up",
  "vip_prep",
  "linen_change",
  "other",
];

const isTaskState = (value: string): value is TaskState =>
  taskStateValues.some((state) => state === value);

const isSlaStatus = (value: string): value is SlaStatus =>
  slaStatusValues.some((status) => status === value);

const isTaskType = (value: string): value is TaskType =>
  taskTypeValues.some((type) => type === value);

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getSiteZone = (site: SiteRecord): string | undefined => {
  if ("zone" in site) {
    return readString(site.zone);
  }
  return undefined;
};

type CreateTaskPayload = {
  type: TaskType;
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
  expectedCheckins?: Array<{
    id: string;
    siteName?: string;
    guestName?: string;
    time?: string;
    isVIP?: boolean;
    isEarlyArrival?: boolean;
  }>;
  expectedTurnovers?: Array<{
    id: string;
    siteName?: string;
    arrivalTime?: string;
    departureTime?: string;
  }>;
  stayovers?: Array<{ id: string; siteName?: string; guestName?: string }>;
  prioritySites?: Array<{ id: string; siteName?: string; priority?: string; reason?: string }>;
  priorityUnits?: string[];
};

type HousekeepingTasks = Awaited<ReturnType<typeof apiClient.listTasks>>;
type HousekeepingTask = HousekeepingTasks[number];
type StaffWorkload = Awaited<ReturnType<typeof apiClient.getStaffWorkload>>;
type StaffWorkloadEntry = StaffWorkload[string];
type SiteRecord = Awaited<ReturnType<typeof apiClient.getSites>>[number];

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
    occupied: "bg-muted text-foreground border-border",
    occupied_service: "bg-status-info/15 text-status-info border-status-info/30",
    occupied_dnd: "bg-status-warning/15 text-status-warning",
    out_of_order: "bg-muted text-muted-foreground border-border",
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
    <Badge variant="outline" className={styles[status] || "bg-muted text-foreground"}>
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
    <Select
      value={current}
      onValueChange={(value) => {
        if (isTaskState(value)) {
          onChange(value);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger className="h-7 w-[140px] text-xs" aria-label="Task state">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {states.map((s) => (
          <SelectItem key={s} value={s}>
            {s.replace("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TaskTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    turnover: "bg-status-info",
    deep_clean: "bg-status-warning",
    touch_up: "bg-status-success",
    inspection: "bg-status-warning",
    vip_prep: "bg-status-error",
    linen_change: "bg-status-info",
    pet_treatment: "bg-status-warning",
    other: "bg-muted0",
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
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium text-white ${styles[type] || styles.other}`}
    >
      {labels[type] || type}
    </span>
  );
}

export default function HousekeepingPage() {
  const params = useParams<{ campgroundId?: string }>();
  const queryClient = useQueryClient();
  const campgroundId = params.campgroundId ?? "";

  const [stateFilter, setStateFilter] = useState<TaskState | "all">("all");
  const [slaFilter, setSlaFilter] = useState<SlaStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<TaskType | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Initialize with empty string to avoid hydration mismatch, set on mount
  const [selectedDate, setSelectedDate] = useState("");

  // Set initial date on mount to avoid hydration mismatch
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(new Date().toISOString().split("T")[0]);
    }
  }, [selectedDate]);

  const [newTask, setNewTask] = useState<{
    type: TaskType;
    siteId: string;
    priority: string;
    notes: string;
  }>({ type: "turnover", siteId: "", priority: "medium", notes: "" });

  const tasksQuery = useQuery<HousekeepingTasks>({
    queryKey: ["tasks", campgroundId, stateFilter, slaFilter, typeFilter],
    queryFn: () =>
      apiClient.listTasks(campgroundId, {
        state: stateFilter === "all" ? undefined : stateFilter,
        slaStatus: slaFilter === "all" ? undefined : slaFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
      }),
    enabled: !!campgroundId,
  });

  const housekeepingStatsQuery = useQuery<
    Awaited<ReturnType<typeof apiClient.getHousekeepingStatusStats>>
  >({
    queryKey: ["housekeeping-stats", campgroundId],
    queryFn: () => apiClient.getHousekeepingStatusStats(campgroundId),
    enabled: !!campgroundId,
  });

  const dailyScheduleQuery = useQuery<DailyScheduleData>({
    queryKey: ["daily-schedule", campgroundId, selectedDate],
    queryFn: () => apiClient.getDailySchedule(campgroundId, selectedDate),
    enabled: !!campgroundId && !!selectedDate,
  });

  const staffWorkloadQuery = useQuery<StaffWorkload>({
    queryKey: ["staff-workload", campgroundId, selectedDate],
    queryFn: () => apiClient.getStaffWorkload(campgroundId, selectedDate),
    enabled: !!campgroundId && !!selectedDate,
  });

  const inspectionStatsQuery = useQuery<Awaited<ReturnType<typeof apiClient.getInspectionStats>>>({
    queryKey: ["inspection-stats", campgroundId],
    queryFn: () => apiClient.getInspectionStats(campgroundId),
    enabled: !!campgroundId,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, state }: { id: string; state: TaskState }) =>
      apiClient.updateTask(id, { state }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", campgroundId] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (payload: CreateTaskPayload) => apiClient.createTask(campgroundId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", campgroundId] });
      setShowCreateModal(false);
      setNewTask({ type: "turnover", siteId: "", priority: "medium", notes: "" });
    },
  });

  const sitesQuery = useQuery<SiteRecord[]>({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId,
  });
  const sites = sitesQuery.data ?? [];

  const tasks = tasksQuery.data ?? [];
  const dailySchedule = dailyScheduleQuery.data;
  const staffWorkload: StaffWorkload = staffWorkloadQuery.data ?? {};
  const housekeepingStats = housekeepingStatsQuery.data;
  const inspectionStats = inspectionStatsQuery.data;

  const tasksByState: Record<TaskState, HousekeepingTask[]> = {
    pending: [],
    in_progress: [],
    blocked: [],
    done: [],
    failed: [],
    expired: [],
  };
  tasks.forEach((task) => {
    tasksByState[task.state].push(task);
  });

  const slaStats = {
    total: tasks.length,
    onTrack: tasks.filter((task) => task.slaStatus === "on_track").length,
    atRisk: tasks.filter((task) => task.slaStatus === "at_risk").length,
    breached: tasks.filter((task) => task.slaStatus === "breached").length,
  };

  const boardStates: TaskState[] = ["pending", "in_progress", "blocked", "done"];

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
            <h1 className="text-2xl font-bold text-foreground">Housekeeping</h1>
            <p className="text-sm text-muted-foreground">
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
                <div className="text-2xl font-bold text-foreground">{slaStats.total}</div>
                <div className="text-xs text-muted-foreground">Total Tasks</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-status-success">{slaStats.onTrack}</div>
                <div className="text-xs text-muted-foreground">On Track</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-status-warning">{slaStats.atRisk}</div>
                <div className="text-xs text-muted-foreground">At Risk</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-status-error">{slaStats.breached}</div>
                <div className="text-xs text-muted-foreground">Breached</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-status-info">
                  {inspectionStats?.passRate ?? 0}%
                </div>
                <div className="text-xs text-muted-foreground">Inspection Pass Rate</div>
              </Card>
              <Card className="p-4">
                <div className="text-2xl font-bold text-primary">
                  {inspectionStats?.averageScore ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Avg Inspection Score</div>
              </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={stateFilter}
                onValueChange={(value) => {
                  if (value === "all") {
                    setStateFilter("all");
                  } else if (isTaskState(value)) {
                    setStateFilter(value);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[150px] text-sm" aria-label="State filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={slaFilter}
                onValueChange={(value) => {
                  if (value === "all") {
                    setSlaFilter("all");
                  } else if (isSlaStatus(value)) {
                    setSlaFilter(value);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[140px] text-sm" aria-label="SLA filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SLA</SelectItem>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="breached">Breached</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(value) => {
                  if (value === "all") {
                    setTypeFilter("all");
                  } else if (isTaskType(value)) {
                    setTypeFilter(value);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-[150px] text-sm" aria-label="Task type filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="turnover">Turnover</SelectItem>
                  <SelectItem value="deep_clean">Deep Clean</SelectItem>
                  <SelectItem value="touch_up">Touch Up</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="vip_prep">VIP Prep</SelectItem>
                  <SelectItem value="linen_change">Linen Change</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Task Board */}
            {tasksQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No tasks found. Create a new task to get started.
              </div>
            ) : (
              <div className="grid md:grid-cols-4 gap-4">
                {boardStates.map((stateKey) => (
                  <div key={stateKey} className="space-y-2">
                    <div className="font-medium text-sm text-foreground capitalize flex items-center gap-2">
                      {stateKey.replace("_", " ")}
                      <Badge variant="secondary" className="text-xs">
                        {tasksByState[stateKey].length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {tasksByState[stateKey].map((task) => (
                        <Card key={task.id} className="p-3 hover:shadow-md transition-shadow">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <TaskTypeBadge type={task.type} />
                              {task.slaStatus && <SlaStatusBadge status={task.slaStatus} />}
                            </div>

                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {task.site?.name || `Site ${task.siteId?.slice(-6) || "—"}`}
                            </div>

                            {task.assignedToUserId && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {task.assignedToUserId.slice(-6)}
                              </div>
                            )}

                            {task.slaDueAt && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
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

                            <div className="pt-2 border-t border-border">
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
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[160px]"
                aria-label="Schedule date"
              />
              {dailySchedule && (
                <div className="text-sm text-muted-foreground">
                  {dailySchedule.summary?.checkouts ?? 0} checkouts |{" "}
                  {dailySchedule.summary?.checkins ?? 0} check-ins |{" "}
                  {dailySchedule.summary?.turnovers ?? 0} turnovers
                </div>
              )}
            </div>

            {dailyScheduleQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading schedule...</div>
            ) : !dailySchedule ? (
              <div className="text-center py-12 text-muted-foreground">
                No schedule data available.
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {/* Checkouts */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-status-error" />
                      Checkouts ({dailySchedule.expectedCheckouts?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailySchedule.expectedCheckouts?.slice(0, 10).map((checkout) => (
                      <div key={checkout.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{checkout.siteName}</div>
                        <div className="text-xs text-muted-foreground">{checkout.guestName}</div>
                      </div>
                    ))}
                    {(dailySchedule.expectedCheckouts?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">No checkouts today</div>
                    )}
                  </CardContent>
                </Card>

                {/* Check-ins */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4 text-status-success" />
                      Check-ins ({dailySchedule.expectedCheckins?.length ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailySchedule.expectedCheckins?.slice(0, 10).map((checkin) => (
                      <div key={checkin.id} className="p-2 border rounded text-sm">
                        <div className="font-medium flex items-center gap-2">
                          {checkin.siteName}
                          {checkin.isVIP && (
                            <Badge variant="destructive" className="text-xs">
                              VIP
                            </Badge>
                          )}
                          {checkin.isEarlyArrival && (
                            <Badge variant="secondary" className="text-xs">
                              Early
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{checkin.guestName}</div>
                      </div>
                    ))}
                    {(dailySchedule.expectedCheckins?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">No check-ins today</div>
                    )}
                  </CardContent>
                </Card>

                {/* Priority Units */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-status-warning" />
                      Priority ({dailySchedule.summary?.priorityCount ?? 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dailySchedule.priorityUnits?.slice(0, 10).map((siteId: string) => (
                      <div
                        key={siteId}
                        className="p-2 border border-status-warning/20 bg-status-warning/10 rounded text-sm"
                      >
                        <div className="font-medium">{siteId.slice(-8)}</div>
                        <div className="text-xs text-status-warning">VIP / Early Arrival</div>
                      </div>
                    ))}
                    {(dailySchedule.priorityUnits?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">No priority units</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            {/* Room Status Overview */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {housekeepingStats?.byStatus &&
                Object.entries(housekeepingStats.byStatus).map(([status, count]) => (
                  <Card key={status} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{count}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {status.replace(/_/g, " ")}
                        </div>
                      </div>
                      <HousekeepingStatusBadge status={status} />
                    </div>
                  </Card>
                ))}
              {!housekeepingStats?.byStatus && (
                <div className="col-span-5 text-center py-8 text-muted-foreground">
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
                        .filter((site) => site.housekeepingStatus === status)
                        .slice(0, 10)
                        .map((site) => {
                          const zone = getSiteZone(site);
                          return (
                            <div
                              key={site.id}
                              className="text-sm p-2 border rounded flex justify-between"
                            >
                              <span>{site.name}</span>
                              {zone && (
                                <span className="text-xs text-muted-foreground">{zone}</span>
                              )}
                            </div>
                          );
                        })}
                      {sites.filter((site) => site.housekeepingStatus === status).length === 0 && (
                        <div className="text-sm text-muted-foreground">None</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="workload" className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[160px]"
                aria-label="Workload date"
              />
            </div>

            {staffWorkloadQuery.isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading workload...</div>
            ) : Object.keys(staffWorkload).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No workload data available.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(staffWorkload).map(([userId, data]) => (
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
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-status-success">
                            {data.completed}
                          </div>
                          <div className="text-xs text-muted-foreground">Done</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-status-info">
                            {data.inProgress}
                          </div>
                          <div className="text-xs text-muted-foreground">Active</div>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-muted-foreground">
                            {data.pending}
                          </div>
                          <div className="text-xs text-muted-foreground">Pending</div>
                        </div>
                      </div>
                      {data.total > 0 && (
                        <div className="mt-3">
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-status-success"
                              style={{ width: `${(data.completed / data.total) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 text-center">
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
                  aria-label="Close create task dialog"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="task-type" className="text-sm font-medium text-foreground">
                    Type
                  </Label>
                  <Select
                    value={newTask.type}
                    onValueChange={(value) => {
                      if (isTaskType(value)) {
                        setNewTask({ ...newTask, type: value });
                      }
                    }}
                  >
                    <SelectTrigger id="task-type" className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="turnover">Turnover</SelectItem>
                      <SelectItem value="deep_clean">Deep Clean</SelectItem>
                      <SelectItem value="touch_up">Touch Up</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="vip_prep">VIP Prep</SelectItem>
                      <SelectItem value="linen_change">Linen Change</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="task-site" className="text-sm font-medium text-foreground">
                    Site
                  </Label>
                  <Select
                    value={newTask.siteId || EMPTY_SELECT_VALUE}
                    onValueChange={(value) =>
                      setNewTask({ ...newTask, siteId: value === EMPTY_SELECT_VALUE ? "" : value })
                    }
                  >
                    <SelectTrigger id="task-site" className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={EMPTY_SELECT_VALUE}>Select a site...</SelectItem>
                      {sites.map((site) => {
                        const zone = getSiteZone(site);
                        return (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name} {zone ? `(${zone})` : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="task-priority" className="text-sm font-medium text-foreground">
                    Priority
                  </Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                  >
                    <SelectTrigger id="task-priority" className="w-full mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High (VIP/Rush)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="task-notes" className="text-sm font-medium text-foreground">
                    Notes
                  </Label>
                  <Textarea
                    id="task-notes"
                    value={newTask.notes}
                    onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                    className="mt-1"
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
