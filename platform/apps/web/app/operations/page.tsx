"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";

// Types matching the new unified op-tasks schema
type OpTaskCategory = "turnover" | "housekeeping" | "maintenance" | "inspection" | "grounds" | "pool" | "front_desk" | "custom";
type OpTaskState = "pending" | "assigned" | "in_progress" | "blocked" | "completed" | "verified" | "cancelled";
type OpTaskPriority = "low" | "medium" | "high" | "urgent";
type OpSlaStatus = "on_track" | "at_risk" | "breached";

interface OpTask {
  id: string;
  campgroundId: string;
  category: OpTaskCategory;
  title: string;
  description?: string;
  priority: OpTaskPriority;
  state: OpTaskState;
  siteId?: string;
  site?: { id: string; name: string };
  locationDescription?: string;
  reservationId?: string;
  assignedToUserId?: string;
  assignedToUser?: { id: string; firstName: string; lastName: string };
  assignedToTeamId?: string;
  assignedToTeam?: { id: string; name: string; color: string };
  slaDueAt?: string;
  slaStatus?: OpSlaStatus;
  checklist?: ChecklistItem[];
  checklistProgress?: number;
  photos?: string[];
  notes?: string;
  sourceEvent?: string;
  templateId?: string;
  recurrenceRuleId?: string;
  completedAt?: string;
  completedById?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface OpTemplate {
  id: string;
  name: string;
  category: OpTaskCategory;
  description?: string;
  priority: OpTaskPriority;
  slaMinutes?: number;
  checklistTemplate?: { id: string; text: string }[];
  isActive: boolean;
  _count?: { tasks: number };
}

interface OpTeam {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  _count?: { tasks: number; members: number };
}

interface SlaDashboardMetrics {
  current: {
    onTrack: number;
    atRisk: number;
    breached: number;
    total: number;
  };
  today: {
    completed: number;
    onTime: number;
    late: number;
    complianceRate: number;
  };
  week: {
    completed: number;
  };
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  totalPoints: number;
  periodPoints: number;
  rank: number;
  level: number;
  tasksCompleted: number;
  streak: number;
  badges: number;
}

interface StaffProfile {
  userId: string;
  userName: string;
  level: number;
  totalPoints: number;
  weekPoints: number;
  monthPoints: number;
  xpToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  totalTasksCompleted: number;
  slaComplianceRate: number;
  weeklyRank: number | null;
  monthlyRank: number | null;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    tier: string;
    earnedAt: string;
  }>;
  recentActivity: Array<{
    date: string;
    tasksCompleted: number;
    pointsEarned: number;
  }>;
}

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  points: number;
  earnedCount: number;
}

// Visual configuration
const STATE_CONFIG: Record<OpTaskState, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-amber-800", bgColor: "bg-amber-100 border-amber-200" },
  assigned: { label: "Assigned", color: "text-purple-800", bgColor: "bg-purple-100 border-purple-200" },
  in_progress: { label: "In Progress", color: "text-blue-800", bgColor: "bg-blue-100 border-blue-200" },
  blocked: { label: "Blocked", color: "text-red-800", bgColor: "bg-red-100 border-red-200" },
  completed: { label: "Completed", color: "text-emerald-800", bgColor: "bg-emerald-100 border-emerald-200" },
  verified: { label: "Verified", color: "text-teal-800", bgColor: "bg-teal-100 border-teal-200" },
  cancelled: { label: "Cancelled", color: "text-slate-600", bgColor: "bg-slate-100 border-slate-200" },
};

const SLA_CONFIG: Record<OpSlaStatus, { label: string; color: string; icon: string }> = {
  on_track: { label: "On Track", color: "bg-emerald-500", icon: "check" },
  at_risk: { label: "At Risk", color: "bg-amber-500", icon: "alert-triangle" },
  breached: { label: "Breached", color: "bg-red-500", icon: "x" },
};

const CATEGORY_CONFIG: Record<OpTaskCategory, { label: string; icon: string; color: string }> = {
  turnover: { label: "Turnover", icon: "bed", color: "text-purple-600" },
  housekeeping: { label: "Housekeeping", icon: "sparkles", color: "text-blue-600" },
  maintenance: { label: "Maintenance", icon: "wrench", color: "text-orange-600" },
  inspection: { label: "Inspection", icon: "search", color: "text-indigo-600" },
  grounds: { label: "Grounds", icon: "trees", color: "text-green-600" },
  pool: { label: "Pool", icon: "waves", color: "text-cyan-600" },
  front_desk: { label: "Front Desk", icon: "ticket", color: "text-pink-600" },
  custom: { label: "Custom", icon: "clipboard-list", color: "text-slate-600" },
};

const PRIORITY_CONFIG: Record<OpTaskPriority, { label: string; color: string; dot: string }> = {
  low: { label: "Low", color: "text-slate-500", dot: "bg-slate-400" },
  medium: { label: "Medium", color: "text-blue-600", dot: "bg-blue-500" },
  high: { label: "High", color: "text-orange-600", dot: "bg-orange-500" },
  urgent: { label: "Urgent", color: "text-red-600", dot: "bg-red-500" },
};

type TabType = "board" | "sla" | "templates" | "teams" | "leaderboard";

export default function OperationsPage() {
  const [selectedCampgroundId, setSelectedCampgroundId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("board");
  const [tasks, setTasks] = useState<OpTask[]>([]);
  const [templates, setTemplates] = useState<OpTemplate[]>([]);
  const [teams, setTeams] = useState<OpTeam[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SlaDashboardMetrics | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myStats, setMyStats] = useState<StaffProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    state?: OpTaskState;
    category?: OpTaskCategory;
    slaStatus?: OpSlaStatus;
    assignedToTeamId?: string;
  }>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);

  // Sync selected campground from localStorage
  useEffect(() => {
    const readSelected = () => {
      if (typeof window === "undefined") return;
      const stored = localStorage.getItem("campreserv:selectedCampground");
      setSelectedCampgroundId(stored);
    };
    readSelected();
    window.addEventListener("storage", readSelected);
    return () => window.removeEventListener("storage", readSelected);
  }, []);

  // Load data based on active tab
  const loadData = useCallback(async () => {
    if (!selectedCampgroundId) return;
    setLoading(true);

    try {
      // Always load tasks for the board
      const tasksData = await apiClient.getOpTasks(selectedCampgroundId, {
        ...filter,
        excludeCompleted: filter.state ? undefined : true,
      });
      setTasks(tasksData as OpTask[]);

      // Load additional data based on active tab
      if (activeTab === "sla") {
        const metricsData = await apiClient.getSlaDashboard(selectedCampgroundId);
        setSlaMetrics(metricsData as SlaDashboardMetrics);
      }

      if (activeTab === "templates" || showCreateModal) {
        const templatesData = await apiClient.getOpTemplates(selectedCampgroundId);
        setTemplates(templatesData as OpTemplate[]);
      }

      if (activeTab === "teams" || showCreateModal) {
        const teamsData = await apiClient.getOpTeams(selectedCampgroundId);
        setTeams(teamsData as OpTeam[]);
      }

      if (activeTab === "leaderboard") {
        const [leaderboardData, myStatsData, badgesData] = await Promise.all([
          apiClient.getLeaderboard(selectedCampgroundId, { period: 'week', limit: 20 }),
          apiClient.getMyGamificationStats(selectedCampgroundId).catch(() => null),
          apiClient.getBadges(selectedCampgroundId),
        ]);
        setLeaderboard(leaderboardData as LeaderboardEntry[]);
        setMyStats(myStatsData as StaffProfile | null);
        setBadges(badgesData as Badge[]);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCampgroundId, filter, activeTab, showCreateModal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Task state transitions
  const updateTaskState = async (id: string, state: OpTaskState) => {
    if (!selectedCampgroundId) return;
    try {
      await apiClient.updateOpTask(selectedCampgroundId, id, { state });
      loadData();
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  };

  // Group tasks for kanban
  const tasksByState = useMemo(() => ({
    pending: tasks.filter(t => t.state === "pending"),
    assigned: tasks.filter(t => t.state === "assigned"),
    in_progress: tasks.filter(t => t.state === "in_progress"),
    blocked: tasks.filter(t => t.state === "blocked"),
    completed: tasks.filter(t => t.state === "completed" || t.state === "verified"),
  }), [tasks]);

  // Format helpers
  const formatDate = (d?: string) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatTimeRemaining = (dueAt?: string) => {
    if (!dueAt) return null;
    const now = new Date();
    const due = new Date(dueAt);
    const diff = due.getTime() - now.getTime();

    if (diff < 0) {
      const mins = Math.abs(Math.round(diff / 60000));
      if (mins < 60) return `${mins}m overdue`;
      const hours = Math.round(mins / 60);
      return `${hours}h overdue`;
    }

    const mins = Math.round(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hours = Math.round(mins / 60);
    return `${hours}h left`;
  };

  if (!selectedCampgroundId) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Select a campground to view operations</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-4 md:p-6 max-w-[1800px] mx-auto">
        {/* Header - stacks on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Operations</h1>
            <p className="text-slate-500 mt-1 text-sm md:text-base hidden sm:block">Manage tasks, turnovers, maintenance, and team assignments</p>
          </div>
          <div className="flex gap-2">
            {activeTab === "templates" && (
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 md:px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
              >
                <span>+</span> <span className="hidden sm:inline">New</span> Template
              </button>
            )}
            {activeTab === "teams" && (
              <button
                onClick={() => setShowTeamModal(true)}
                className="px-3 md:px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm"
              >
                <span>+</span> <span className="hidden sm:inline">New</span> Team
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 md:px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm min-h-[44px]"
            >
              <span>+</span> <span className="hidden sm:inline">New</span> Task
            </button>
          </div>
        </div>

        {/* Tabs - horizontally scrollable on mobile */}
        <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {[
            { id: "board" as const, label: "Tasks", fullLabel: "Task Board", icon: "" },
            { id: "sla" as const, label: "SLA", fullLabel: "SLA Dashboard", icon: "" },
            { id: "templates" as const, label: "Templates", fullLabel: "Templates & Automation", icon: "" },
            { id: "teams" as const, label: "Teams", fullLabel: "Teams", icon: "" },
            { id: "leaderboard" as const, label: "Ranks", fullLabel: "Leaderboard", icon: "" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="mr-1.5 md:mr-2">{tab.icon}</span>
              <span className="md:hidden">{tab.label}</span>
              <span className="hidden md:inline">{tab.fullLabel}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "board" && (
          <TaskBoardTab
            tasks={tasks}
            tasksByState={tasksByState}
            teams={teams}
            filter={filter}
            setFilter={setFilter}
            loading={loading}
            updateTaskState={updateTaskState}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
        )}

        {activeTab === "sla" && (
          <SlaDashboardTab
            slaMetrics={slaMetrics}
            tasks={tasks}
            loading={loading}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
        )}

        {activeTab === "templates" && (
          <TemplatesTab
            templates={templates}
            campgroundId={selectedCampgroundId}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {activeTab === "teams" && (
          <TeamsTab
            teams={teams}
            campgroundId={selectedCampgroundId}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardTab
            leaderboard={leaderboard}
            myStats={myStats}
            badges={badges}
            campgroundId={selectedCampgroundId}
            loading={loading}
            onRefresh={loadData}
          />
        )}

        {/* Create Task Modal */}
        {showCreateModal && (
          <CreateTaskModal
            campgroundId={selectedCampgroundId}
            templates={templates}
            teams={teams}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              loadData();
            }}
          />
        )}

        {/* Create Template Modal */}
        {showTemplateModal && (
          <CreateTemplateModal
            campgroundId={selectedCampgroundId}
            onClose={() => setShowTemplateModal(false)}
            onCreated={() => {
              setShowTemplateModal(false);
              loadData();
            }}
          />
        )}

        {/* Create Team Modal */}
        {showTeamModal && (
          <CreateTeamModal
            campgroundId={selectedCampgroundId}
            onClose={() => setShowTeamModal(false)}
            onCreated={() => {
              setShowTeamModal(false);
              loadData();
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}

// ============================================================
// TASK BOARD TAB
// ============================================================

function TaskBoardTab({
  tasks,
  tasksByState,
  teams,
  filter,
  setFilter,
  loading,
  updateTaskState,
  formatDate,
  formatTimeRemaining,
}: {
  tasks: OpTask[];
  tasksByState: Record<string, OpTask[]>;
  teams: OpTeam[];
  filter: any;
  setFilter: (f: any) => void;
  loading: boolean;
  updateTaskState: (id: string, state: OpTaskState) => void;
  formatDate: (d?: string) => string;
  formatTimeRemaining: (d?: string) => string | null;
}) {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [mobileStateFilter, setMobileStateFilter] = useState<OpTaskState | 'all'>('all');

  // Stats calculation
  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasksByState.pending?.length || 0,
    inProgress: tasksByState.in_progress?.length || 0,
    breached: tasks.filter(t => t.slaStatus === "breached").length,
    atRisk: tasks.filter(t => t.slaStatus === "at_risk").length,
  }), [tasks, tasksByState]);

  // Filter tasks for mobile list view
  const filteredTasks = useMemo(() => {
    if (mobileStateFilter === 'all') return tasks;
    return tasks.filter(t => t.state === mobileStateFilter);
  }, [tasks, mobileStateFilter]);

  return (
    <>
      {/* Stats Row - 2 cols on mobile, 5 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4 mb-6">
        <StatsCard
          label="Active"
          value={stats.total}
          icon=""
        />
        <StatsCard
          label="Pending"
          value={stats.pending}
          icon=""
          color="text-amber-600"
        />
        <StatsCard
          label="In Progress"
          value={stats.inProgress}
          icon=""
          color="text-blue-600"
        />
        <StatsCard
          label="Breached"
          value={stats.breached}
          icon=""
          color="text-red-600"
          subtext={stats.atRisk > 0 ? `${stats.atRisk} at risk` : undefined}
        />
        <StatsCard
          label="Done Today"
          value={tasks.filter(t =>
            t.state === "completed" &&
            t.completedAt &&
            new Date(t.completedAt).toDateString() === new Date().toDateString()
          ).length}
          icon=""
          color="text-emerald-600"
        />
      </div>

      {/* Filters - scrollable on mobile */}
      <div className="flex flex-wrap gap-2 md:gap-3 mb-4 md:mb-6">
        {/* View mode toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1 mr-auto md:mr-2">
          <button
            onClick={() => setViewMode('board')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors min-h-[36px] ${
              viewMode === 'board' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
            }`}
          >
            <span className="hidden sm:inline">Board</span>
            <span className="sm:hidden">B</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors min-h-[36px] ${
              viewMode === 'list' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
            }`}
          >
            <span className="hidden sm:inline">List</span>
            <span className="sm:hidden">L</span>
          </button>
        </div>

        <select
          value={filter.category ?? ""}
          onChange={e => setFilter((f: any) => ({ ...f, category: e.target.value || undefined }))}
          className="px-2 md:px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-h-[44px]"
        >
          <option value="">All Types</option>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.icon} {config.label}</option>
          ))}
        </select>

        <select
          value={filter.slaStatus ?? ""}
          onChange={e => setFilter((f: any) => ({ ...f, slaStatus: e.target.value || undefined }))}
          className="px-2 md:px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-h-[44px]"
        >
          <option value="">All SLA</option>
          <option value="on_track">On Track</option>
          <option value="at_risk">At Risk</option>
          <option value="breached">Breached</option>
        </select>

        {teams.length > 0 && (
          <select
            value={filter.assignedToTeamId ?? ""}
            onChange={e => setFilter((f: any) => ({ ...f, assignedToTeamId: e.target.value || undefined }))}
            className="px-2 md:px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm min-h-[44px] hidden sm:block"
          >
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        )}

        {Object.keys(filter).length > 0 && (
          <button
            onClick={() => setFilter({})}
            className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm min-h-[44px]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Board View */}
      {loading ? (
        <LoadingSpinner />
      ) : viewMode === 'board' ? (
        <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
          <KanbanColumn
            title="Pending"
            state="pending"
            tasks={tasksByState.pending || []}
            updateTaskState={updateTaskState}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
          <KanbanColumn
            title="Assigned"
            state="assigned"
            tasks={tasksByState.assigned || []}
            updateTaskState={updateTaskState}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
          <KanbanColumn
            title="In Progress"
            state="in_progress"
            tasks={tasksByState.in_progress || []}
            updateTaskState={updateTaskState}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
          <KanbanColumn
            title="Blocked"
            state="blocked"
            tasks={tasksByState.blocked || []}
            updateTaskState={updateTaskState}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
          <KanbanColumn
            title="Completed"
            state="completed"
            tasks={tasksByState.completed || []}
            updateTaskState={updateTaskState}
            formatDate={formatDate}
            formatTimeRemaining={formatTimeRemaining}
          />
        </div>
      ) : (
        /* List View - mobile friendly */
        <div className="space-y-3">
          {/* State filter tabs for list view */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { id: 'all' as const, label: 'All', count: tasks.length },
              { id: 'pending' as const, label: 'Pending', count: tasksByState.pending?.length || 0 },
              { id: 'assigned' as const, label: 'Assigned', count: tasksByState.assigned?.length || 0 },
              { id: 'in_progress' as const, label: 'In Progress', count: tasksByState.in_progress?.length || 0 },
              { id: 'blocked' as const, label: 'Blocked', count: tasksByState.blocked?.length || 0 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setMobileStateFilter(tab.id)}
                className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                  mobileStateFilter === tab.id
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label} <span className="text-xs opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>

          {/* Task list */}
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2 text-slate-300">Tasks</div>
              <p>No tasks to show</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(task => (
                <MobileTaskRow
                  key={task.id}
                  task={task}
                  updateTaskState={updateTaskState}
                  formatTimeRemaining={formatTimeRemaining}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function StatsCard({
  label,
  value,
  icon,
  color = "text-slate-900",
  subtext
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 md:p-4">
      <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
        <span className="text-base md:text-lg">{icon}</span>
        <span className="text-xs md:text-sm text-slate-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 md:gap-2">
        <span className={`text-xl md:text-2xl font-bold ${color}`}>{value}</span>
        {subtext && <span className="text-[10px] md:text-xs text-amber-600">{subtext}</span>}
      </div>
    </div>
  );
}

function KanbanColumn({
  title,
  state,
  tasks,
  updateTaskState,
  formatDate,
  formatTimeRemaining,
}: {
  title: string;
  state: OpTaskState;
  tasks: OpTask[];
  updateTaskState: (id: string, state: OpTaskState) => void;
  formatDate: (d?: string) => string;
  formatTimeRemaining: (d?: string) => string | null;
}) {
  const config = STATE_CONFIG[state];

  return (
    <div className="flex-shrink-0 w-[280px] md:w-[300px] snap-center md:snap-align-none">
      <div className="flex items-center gap-2 mb-3 md:mb-4 px-1">
        <h3 className="font-semibold text-slate-800 text-sm md:text-base">{title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${config.bgColor} ${config.color}`}>
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2 md:space-y-3 min-h-[200px]">
        {tasks.length === 0 ? (
          <div className="text-center py-6 md:py-8 text-slate-400 text-xs md:text-sm border-2 border-dashed border-slate-200 rounded-xl">
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              updateTaskState={updateTaskState}
              formatDate={formatDate}
              formatTimeRemaining={formatTimeRemaining}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  updateTaskState,
  formatDate,
  formatTimeRemaining,
}: {
  task: OpTask;
  updateTaskState: (id: string, state: OpTaskState) => void;
  formatDate: (d?: string) => string;
  formatTimeRemaining: (d?: string) => string | null;
}) {
  const categoryConfig = CATEGORY_CONFIG[task.category];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const slaConfig = task.slaStatus ? SLA_CONFIG[task.slaStatus] : null;
  const timeRemaining = formatTimeRemaining(task.slaDueAt);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" title={categoryConfig.label}>{categoryConfig.icon}</span>
          <span className="font-medium text-slate-900 text-sm line-clamp-1">{task.title}</span>
        </div>
        {slaConfig && (
          <div
            className={`w-5 h-5 rounded-full ${slaConfig.color} flex items-center justify-center text-white text-xs font-bold`}
            title={`SLA: ${slaConfig.label}`}
          >
            {slaConfig.icon}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="space-y-2 text-xs mb-3">
        {/* Location */}
        <div className="flex items-center gap-2 text-slate-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{task.site?.name || task.locationDescription || "-"}</span>
        </div>

        {/* Priority */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${priorityConfig.dot}`} />
          <span className={priorityConfig.color}>{priorityConfig.label} Priority</span>
        </div>

        {/* Due time */}
        {task.slaDueAt && (
          <div className={`flex items-center gap-2 ${
            task.slaStatus === "breached" ? "text-red-600 font-medium" :
            task.slaStatus === "at_risk" ? "text-amber-600" : "text-slate-600"
          }`}>
            <span>Due:</span>
            <span>{timeRemaining}</span>
          </div>
        )}

        {/* Team/Assignee */}
        {(task.assignedToTeam || task.assignedToUser) && (
          <div className="flex items-center gap-2 text-slate-600">
            <span>Assigned:</span>
            <span>
              {task.assignedToUser
                ? `${task.assignedToUser.firstName} ${task.assignedToUser.lastName}`
                : task.assignedToTeam?.name}
            </span>
          </div>
        )}

        {/* Checklist progress */}
        {task.checklist && task.checklist.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${task.checklistProgress || 0}%` }}
              />
            </div>
            <span className="text-slate-500">
              {task.checklist.filter(i => i.completed).length}/{task.checklist.length}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {task.state === "pending" && (
          <button
            onClick={() => updateTaskState(task.id, "in_progress")}
            className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            Start
          </button>
        )}
        {task.state === "assigned" && (
          <button
            onClick={() => updateTaskState(task.id, "in_progress")}
            className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            Start Work
          </button>
        )}
        {task.state === "in_progress" && (
          <>
            <button
              onClick={() => updateTaskState(task.id, "completed")}
              className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
            >
              Complete
            </button>
            <button
              onClick={() => updateTaskState(task.id, "blocked")}
              className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
            >
              Block
            </button>
          </>
        )}
        {task.state === "blocked" && (
          <button
            onClick={() => updateTaskState(task.id, "in_progress")}
            className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            Unblock
          </button>
        )}
        {(task.state === "completed" || task.state === "verified") && (
          <button
            onClick={() => updateTaskState(task.id, "pending")}
            className="flex-1 px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}

// Mobile-optimized task row for list view
function MobileTaskRow({
  task,
  updateTaskState,
  formatTimeRemaining,
}: {
  task: OpTask;
  updateTaskState: (id: string, state: OpTaskState) => void;
  formatTimeRemaining: (d?: string) => string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const categoryConfig = CATEGORY_CONFIG[task.category];
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const slaConfig = task.slaStatus ? SLA_CONFIG[task.slaStatus] : null;
  const timeRemaining = formatTimeRemaining(task.slaDueAt);
  const stateConfig = STATE_CONFIG[task.state];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Main row - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left min-h-[60px]"
      >
        {/* Category icon + SLA indicator */}
        <div className="relative">
          <span className="text-xl">{categoryConfig.icon}</span>
          {slaConfig && (
            <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${slaConfig.color} border-2 border-white`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 truncate text-sm">{task.title}</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${priorityConfig.dot}`} />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className={`px-1.5 py-0.5 rounded ${stateConfig.bgColor} ${stateConfig.color} text-[10px] font-medium`}>
              {stateConfig.label}
            </span>
            {task.site?.name && <span>Site: {task.site.name}</span>}
            {timeRemaining && (
              <span className={task.slaStatus === 'breached' ? 'text-red-600 font-medium' : task.slaStatus === 'at_risk' ? 'text-amber-600' : ''}>
                Due: {timeRemaining}
              </span>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        <span className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
          {/* Description */}
          {task.description && (
            <p className="text-sm text-slate-600">{task.description}</p>
          )}

          {/* Details */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className={`px-2 py-1 rounded-full bg-slate-100 ${priorityConfig.color}`}>
              {priorityConfig.label} Priority
            </span>
            {task.assignedToTeam && (
              <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                Team: {task.assignedToTeam.name}
              </span>
            )}
            {task.assignedToUser && (
              <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                {task.assignedToUser.firstName} {task.assignedToUser.lastName}
              </span>
            )}
          </div>

          {/* Checklist progress */}
          {task.checklist && task.checklist.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${task.checklistProgress || 0}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">
                {task.checklist.filter(i => i.completed).length}/{task.checklist.length}
              </span>
            </div>
          )}

          {/* Actions - large touch targets */}
          <div className="flex gap-2 pt-2">
            {task.state === "pending" && (
              <button
                onClick={(e) => { e.stopPropagation(); updateTaskState(task.id, "in_progress"); }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium active:bg-blue-700 transition-colors min-h-[48px]"
              >
                Start Task
              </button>
            )}
            {task.state === "assigned" && (
              <button
                onClick={(e) => { e.stopPropagation(); updateTaskState(task.id, "in_progress"); }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium active:bg-blue-700 transition-colors min-h-[48px]"
              >
                Start Work
              </button>
            )}
            {task.state === "in_progress" && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); updateTaskState(task.id, "completed"); }}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-medium active:bg-emerald-700 transition-colors min-h-[48px]"
                >
                  Complete
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); updateTaskState(task.id, "blocked"); }}
                  className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium active:bg-red-200 transition-colors min-h-[48px]"
                >
                  Block
                </button>
              </>
            )}
            {task.state === "blocked" && (
              <button
                onClick={(e) => { e.stopPropagation(); updateTaskState(task.id, "in_progress"); }}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium active:bg-blue-700 transition-colors min-h-[48px]"
              >
                Resume
              </button>
            )}
            {(task.state === "completed" || task.state === "verified") && (
              <button
                onClick={(e) => { e.stopPropagation(); updateTaskState(task.id, "pending"); }}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium active:bg-slate-200 transition-colors min-h-[48px]"
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SLA DASHBOARD TAB
// ============================================================

function SlaDashboardTab({
  slaMetrics,
  tasks,
  loading,
  formatDate,
  formatTimeRemaining,
}: {
  slaMetrics: SlaDashboardMetrics | null;
  tasks: OpTask[];
  loading: boolean;
  formatDate: (d?: string) => string;
  formatTimeRemaining: (d?: string) => string | null;
}) {
  const breachedTasks = useMemo(() =>
    tasks.filter(t => t.slaStatus === "breached").sort((a, b) =>
      new Date(a.slaDueAt || 0).getTime() - new Date(b.slaDueAt || 0).getTime()
    ),
    [tasks]
  );

  const atRiskTasks = useMemo(() =>
    tasks.filter(t => t.slaStatus === "at_risk").sort((a, b) =>
      new Date(a.slaDueAt || 0).getTime() - new Date(b.slaDueAt || 0).getTime()
    ),
    [tasks]
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* SLA Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-500 mb-2">Current On Track</div>
          <div className="text-3xl font-bold text-emerald-600">{slaMetrics?.current.onTrack || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-500 mb-2">At Risk</div>
          <div className="text-3xl font-bold text-amber-600">{slaMetrics?.current.atRisk || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-500 mb-2">Breached</div>
          <div className="text-3xl font-bold text-red-600">{slaMetrics?.current.breached || 0}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-sm text-slate-500 mb-2">Today's Compliance</div>
          <div className="text-3xl font-bold text-blue-600">{slaMetrics?.today.complianceRate || 100}%</div>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Today's Performance</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold text-slate-900">{slaMetrics?.today.completed || 0}</div>
            <div className="text-sm text-slate-500">Tasks Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{slaMetrics?.today.onTime || 0}</div>
            <div className="text-sm text-slate-500">On Time</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{slaMetrics?.today.late || 0}</div>
            <div className="text-sm text-slate-500">Late</div>
          </div>
        </div>
      </div>

      {/* Breached Tasks */}
      {breachedTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            SLA Breached ({breachedTasks.length})
          </h3>
          <div className="space-y-3">
            {breachedTasks.map(task => (
              <SlaTaskRow key={task.id} task={task} formatDate={formatDate} formatTimeRemaining={formatTimeRemaining} />
            ))}
          </div>
        </div>
      )}

      {/* At Risk Tasks */}
      {atRiskTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 p-6">
          <h3 className="text-lg font-semibold text-amber-700 mb-4 flex items-center gap-2">
            At Risk ({atRiskTasks.length})
          </h3>
          <div className="space-y-3">
            {atRiskTasks.map(task => (
              <SlaTaskRow key={task.id} task={task} formatDate={formatDate} formatTimeRemaining={formatTimeRemaining} />
            ))}
          </div>
        </div>
      )}

      {breachedTasks.length === 0 && atRiskTasks.length === 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-8 text-center">
          <h3 className="text-lg font-semibold text-emerald-800">All Clear!</h3>
          <p className="text-emerald-600 mt-1">No SLA issues at the moment. Great work!</p>
        </div>
      )}
    </div>
  );
}

function SlaTaskRow({
  task,
  formatDate,
  formatTimeRemaining,
}: {
  task: OpTask;
  formatDate: (d?: string) => string;
  formatTimeRemaining: (d?: string) => string | null;
}) {
  const categoryConfig = CATEGORY_CONFIG[task.category];
  const timeRemaining = formatTimeRemaining(task.slaDueAt);

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-lg">{categoryConfig.icon}</span>
        <div>
          <div className="font-medium text-slate-900">{task.title}</div>
          <div className="text-xs text-slate-500">
            {task.site?.name || task.locationDescription} • {task.assignedToTeam?.name || "Unassigned"}
          </div>
        </div>
      </div>
      <div className={`text-sm font-medium ${
        task.slaStatus === "breached" ? "text-red-600" : "text-amber-600"
      }`}>
        {timeRemaining}
      </div>
    </div>
  );
}

// ============================================================
// TEMPLATES TAB
// ============================================================

function TemplatesTab({
  templates,
  campgroundId,
  loading,
  onRefresh,
}: {
  templates: OpTemplate[];
  campgroundId: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
        <div className="flex items-start gap-3">
          <div>
            <h4 className="font-medium text-blue-900">Task Templates & Automation</h4>
            <p className="text-sm text-blue-700 mt-1">
              Create templates for common tasks, set up recurring schedules, and configure event triggers
              to automatically generate tasks when guests check out, reservations are made, and more.
            </p>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <h3 className="text-lg font-medium text-slate-900">No Templates Yet</h3>
          <p className="text-slate-500 mt-1 mb-4">Create your first template to standardize common tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(template => (
            <TemplateCard key={template.id} template={template} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  onRefresh,
}: {
  template: OpTemplate;
  onRefresh: () => void;
}) {
  const categoryConfig = CATEGORY_CONFIG[template.category];
  const priorityConfig = PRIORITY_CONFIG[template.priority];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{categoryConfig.icon}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${categoryConfig.color} bg-opacity-10`}>
            {categoryConfig.label}
          </span>
        </div>
        {!template.isActive && (
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">Inactive</span>
        )}
      </div>

      <h4 className="font-semibold text-slate-900 mb-1">{template.name}</h4>
      {template.description && (
        <p className="text-sm text-slate-500 line-clamp-2 mb-3">{template.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${priorityConfig.dot}`} />
          {priorityConfig.label}
        </span>
        {template.slaMinutes && (
          <span>{template.slaMinutes}min SLA</span>
        )}
        {template.checklistTemplate && (
          <span>{template.checklistTemplate.length} items</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">
          {template._count?.tasks || 0} tasks created
        </span>
        <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
          Edit
        </button>
      </div>
    </div>
  );
}

// ============================================================
// TEAMS TAB
// ============================================================

function TeamsTab({
  teams,
  campgroundId,
  loading,
  onRefresh,
}: {
  teams: OpTeam[];
  campgroundId: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {teams.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <h3 className="text-lg font-medium text-slate-900">No Teams Yet</h3>
          <p className="text-slate-500 mt-1 mb-4">Create teams to organize your staff and assign tasks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map(team => (
            <TeamCard key={team.id} team={team} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  onRefresh,
}: {
  team: OpTeam;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: team.color }}
        >
          {team.name.charAt(0).toUpperCase()}
        </div>
        {!team.isActive && (
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">Inactive</span>
        )}
      </div>

      <h4 className="font-semibold text-slate-900 mb-3">{team.name}</h4>

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{team._count?.members || 0} members</span>
        <span>{team._count?.tasks || 0} tasks</span>
      </div>

      <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
        <button className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
          Manage
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MODALS
// ============================================================

function CreateTaskModal({
  campgroundId,
  templates,
  teams,
  onClose,
  onCreated,
}: {
  campgroundId: string;
  templates: OpTemplate[];
  teams: OpTeam[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<OpTaskCategory>("housekeeping");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<OpTaskPriority>("medium");
  const [siteId, setSiteId] = useState("");
  const [locationDescription, setLocationDescription] = useState("");
  const [assignedToTeamId, setAssignedToTeamId] = useState("");
  const [slaDueAt, setSlaDueAt] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    async function loadSites() {
      try {
        const data = await apiClient.getSites(campgroundId);
        setSites(data.map((s: any) => ({ id: s.id, name: s.siteNumber || s.name })));
      } catch (err) {
        console.error("Failed to load sites:", err);
      }
    }
    loadSites();
  }, [campgroundId]);

  // Apply template when selected
  useEffect(() => {
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setTitle(template.name);
        setDescription(template.description || "");
        setCategory(template.category);
        setPriority(template.priority);
        if (template.slaMinutes) {
          const dueDate = new Date(Date.now() + template.slaMinutes * 60 * 1000);
          setSlaDueAt(dueDate.toISOString().slice(0, 16));
        }
      }
    }
  }, [templateId, templates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setSaving(true);
    try {
      await apiClient.createOpTask(campgroundId, {
        category,
        title,
        description: description || undefined,
        priority,
        siteId: siteId || undefined,
        locationDescription: locationDescription || undefined,
        assignedToTeamId: assignedToTeamId || undefined,
        slaDueAt: slaDueAt ? new Date(slaDueAt).toISOString() : undefined,
        templateId: templateId || undefined,
      });
      onCreated();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create Task</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Template selector */}
          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Use Template (optional)</label>
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Start from scratch</option>
                {templates.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{CATEGORY_CONFIG[t.category].icon} {t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as OpTaskCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.icon} {config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as OpTaskPriority)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g., Clean cabin after checkout"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              placeholder="Additional details or instructions..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Site</label>
              <select
                value={siteId}
                onChange={e => setSiteId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">No specific site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Or Location</label>
              <input
                type="text"
                value={locationDescription}
                onChange={e => setLocationDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g., Pool area"
                disabled={!!siteId}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Team</label>
              <select
                value={assignedToTeamId}
                onChange={e => setAssignedToTeamId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Unassigned</option>
                {teams.filter(t => t.isActive).map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date/Time</label>
              <input
                type="datetime-local"
                value={slaDueAt}
                onChange={e => setSlaDueAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateTemplateModal({
  campgroundId,
  onClose,
  onCreated,
}: {
  campgroundId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OpTaskCategory>("housekeeping");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<OpTaskPriority>("medium");
  const [slaMinutes, setSlaMinutes] = useState("");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [saving, setSaving] = useState(false);

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, newChecklistItem.trim()]);
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    try {
      await apiClient.createOpTemplate(campgroundId, {
        name,
        category,
        description: description || undefined,
        priority,
        slaMinutes: slaMinutes ? parseInt(slaMinutes) : undefined,
        checklistTemplate: checklistItems.length > 0
          ? checklistItems.map((text, i) => ({ id: `item-${i}`, text }))
          : undefined,
      });
      onCreated();
    } catch (err) {
      console.error("Failed to create template:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create Template</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Template Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g., Cabin Turnover Checklist"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as OpTaskCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.icon} {config.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Default Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as OpTaskPriority)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none"
              placeholder="What is this template for?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SLA (minutes)</label>
            <input
              type="number"
              value={slaMinutes}
              onChange={e => setSlaMinutes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g., 60 for 1 hour"
              min="1"
            />
            <p className="text-xs text-slate-500 mt-1">How long staff has to complete tasks from this template</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Checklist Items</label>
            {checklistItems.length > 0 && (
              <div className="space-y-2 mb-3">
                {checklistItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-slate-700 flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={e => setNewChecklistItem(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="Add checklist item..."
                onKeyPress={e => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Creating..." : "Create Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateTeamModal({
  campgroundId,
  onClose,
  onCreated,
}: {
  campgroundId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");
  const [saving, setSaving] = useState(false);

  const colorOptions = [
    "#10b981", // emerald
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#ef4444", // red
    "#ec4899", // pink
    "#14b8a6", // teal
    "#6366f1", // indigo
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    try {
      await apiClient.createOpTeam(campgroundId, { name, color });
      onCreated();
    } catch (err) {
      console.error("Failed to create team:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Create Team</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Team Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g., Housekeeping, Maintenance"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Team Color</label>
            <div className="flex gap-2">
              {colorOptions.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-transform ${color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// LEADERBOARD TAB
// ============================================================

const TIER_CONFIG: Record<string, { color: string; bg: string }> = {
  bronze: { color: "text-amber-700", bg: "bg-amber-100" },
  silver: { color: "text-slate-500", bg: "bg-slate-100" },
  gold: { color: "text-yellow-600", bg: "bg-yellow-100" },
  platinum: { color: "text-purple-600", bg: "bg-purple-100" },
};

const LEVEL_TITLES = [
  "Rookie",
  "Team Member",
  "Reliable",
  "Skilled",
  "Expert",
  "Senior",
  "Master",
  "Champion",
  "Legend",
  "Superstar",
];

function LeaderboardTab({
  leaderboard,
  myStats,
  badges,
  campgroundId,
  loading,
  onRefresh,
}: {
  leaderboard: LeaderboardEntry[];
  myStats: StaffProfile | null;
  badges: Badge[];
  campgroundId: string;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [period, setPeriod] = useState<'week' | 'month' | 'all_time'>('week');
  const [seeding, setSeeding] = useState(false);

  const seedBadges = async () => {
    setSeeding(true);
    try {
      await apiClient.seedDefaultBadges(campgroundId);
      onRefresh();
    } catch (err) {
      console.error("Failed to seed badges:", err);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  // Show setup state if no badges exist
  if (badges.length === 0) {
    return (
      <div className="text-center py-16">
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Set Up Gamification</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">
          Motivate your team with points, badges, and leaderboards. Track performance and celebrate achievements!
        </p>
        <button
          onClick={seedBadges}
          disabled={seeding}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {seeding ? "Setting up..." : "Initialize Gamification"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My Stats Card */}
      {myStats && (
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-emerald-100 text-sm">Your Stats</p>
              <h3 className="text-2xl font-bold">{myStats.userName || "You"}</h3>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">Level {myStats.level}</div>
              <p className="text-emerald-100 text-sm">{LEVEL_TITLES[myStats.level - 1] || "Superstar"}</p>
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-emerald-100 mb-1">
              <span>{myStats.totalPoints} XP</span>
              <span>{myStats.xpToNextLevel} to next level</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (myStats.totalPoints / (myStats.totalPoints + myStats.xpToNextLevel)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{myStats.totalTasksCompleted}</div>
              <div className="text-sm text-emerald-100">Tasks Done</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{myStats.currentStreak} days</div>
              <div className="text-sm text-emerald-100">Day Streak</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{Math.round(myStats.slaComplianceRate)}%</div>
              <div className="text-sm text-emerald-100">On Time</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{myStats.badges.length}</div>
              <div className="text-sm text-emerald-100">Badges</div>
            </div>
          </div>

          {/* My Badges */}
          {myStats.badges.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-sm text-emerald-100 mb-2">Your Badges</p>
              <div className="flex flex-wrap gap-2">
                {myStats.badges.map(badge => (
                  <span
                    key={badge.id}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${TIER_CONFIG[badge.tier]?.bg || 'bg-slate-100'} ${TIER_CONFIG[badge.tier]?.color || 'text-slate-700'}`}
                    title={badge.name}
                  >
                    <span>{badge.icon}</span>
                    <span>{badge.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            Team Leaderboard
          </h3>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as 'week' | 'month' | 'all_time')}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all_time">All Time</option>
          </select>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p>No activity yet this {period === 'week' ? 'week' : period === 'month' ? 'month' : 'period'}.</p>
            <p className="text-sm mt-1">Complete tasks to appear on the leaderboard!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaderboard.map((entry, index) => (
              <div key={entry.userId} className={`px-6 py-4 flex items-center gap-4 ${index < 3 ? 'bg-amber-50/50' : ''}`}>
                {/* Rank */}
                <div className="w-10 text-center">
                  {index === 0 ? (
                    <span className="text-lg font-bold text-amber-500">#1</span>
                  ) : index === 1 ? (
                    <span className="text-lg font-bold text-slate-400">#2</span>
                  ) : index === 2 ? (
                    <span className="text-lg font-bold text-amber-600">#3</span>
                  ) : (
                    <span className="text-lg font-bold text-slate-400">#{index + 1}</span>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{entry.userName}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      Lvl {entry.level}
                    </span>
                    {entry.streak >= 3 && (
                      <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full">
                        {entry.streak} day streak
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {entry.tasksCompleted} tasks • {entry.badges} badges
                  </div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className="text-xl font-bold text-emerald-600">{entry.periodPoints}</div>
                  <div className="text-xs text-slate-500">pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Badges */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            Available Badges
          </h3>
        </div>
        <div className="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {badges.map(badge => (
            <div
              key={badge.id}
              className={`p-4 rounded-xl border-2 ${badge.earnedCount > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'} text-center`}
            >
              <div className="text-3xl mb-2">{badge.icon}</div>
              <div className="font-medium text-slate-900 text-sm">{badge.name}</div>
              <div className={`text-xs ${TIER_CONFIG[badge.tier]?.color || 'text-slate-500'} capitalize mb-1`}>
                {badge.tier}
              </div>
              <div className="text-xs text-slate-500 mb-2">{badge.description}</div>
              <div className="text-xs text-emerald-600 font-medium">+{badge.points} pts</div>
              {badge.earnedCount > 0 && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                  Earned by {badge.earnedCount} staff
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// UTILITIES
// ============================================================

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );
}
