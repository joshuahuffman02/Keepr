"use client";

import { useState, useEffect } from "react";
import {
  Target,
  TrendingUp,
  DollarSign,
  Users,
  Star,
  Calendar,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Goal {
  id: string;
  name: string;
  description: string | null;
  metric: string;
  target: number;
  current: number;
  unit: "currency" | "percentage" | "number" | "score";
  period: string;
  category: "revenue" | "bookings" | "guests" | "satisfaction";
  status: "on_track" | "at_risk" | "behind" | "achieved";
  progress: number;
  daysRemaining: number;
  trend: "up" | "down" | "flat";
  dueDate: string;
  createdAt: string;
}

interface CreateGoalForm {
  name: string;
  description: string;
  metric: string;
  target: string;
  unit: "currency" | "percentage" | "number" | "score";
  period: string;
  category: "revenue" | "bookings" | "guests" | "satisfaction";
  dueDate: string;
}

const metricOptions: Array<{
  value: string;
  unit: CreateGoalForm["unit"];
  category: CreateGoalForm["category"];
}> = [
  { value: "Total Revenue", unit: "currency", category: "revenue" },
  { value: "Average Daily Rate", unit: "currency", category: "revenue" },
  { value: "NPS Score", unit: "score", category: "satisfaction" },
  { value: "Total Reservations", unit: "number", category: "bookings" },
  { value: "Cancellation Rate", unit: "percentage", category: "bookings" },
  { value: "Repeat Guest Rate", unit: "percentage", category: "guests" },
  { value: "Occupancy Rate", unit: "percentage", category: "bookings" },
  { value: "RevPAN", unit: "currency", category: "revenue" },
];

const periodOptions = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "2025", "H1 2025", "H2 2025"];

function formatValue(value: number, unit: string): string {
  switch (unit) {
    case "currency":
      if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
      return `$${value.toFixed(2)}`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "number":
      return value.toLocaleString();
    case "score":
      return value.toString();
    default:
      return value.toString();
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "achieved":
      return <CheckCircle className="h-5 w-5 text-green-400" />;
    case "on_track":
      return <TrendingUp className="h-5 w-5 text-green-400" />;
    case "at_risk":
      return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    case "behind":
      return <XCircle className="h-5 w-5 text-red-400" />;
    default:
      return <Target className="h-5 w-5 text-muted-foreground" />;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "achieved":
    case "on_track":
      return "text-green-400";
    case "at_risk":
      return "text-amber-400";
    case "behind":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    achieved: "bg-green-500/20 text-green-400",
    on_track: "bg-green-500/20 text-green-400",
    at_risk: "bg-amber-500/20 text-amber-400",
    behind: "bg-red-500/20 text-red-400",
  };
  const labels: Record<string, string> = {
    achieved: "Achieved",
    on_track: "On Track",
    at_risk: "At Risk",
    behind: "Behind",
  };
  return <Badge className={colors[status]}>{labels[status]}</Badge>;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "revenue":
      return <DollarSign className="h-4 w-4 text-green-400" />;
    case "bookings":
      return <Calendar className="h-4 w-4 text-blue-400" />;
    case "guests":
      return <Users className="h-4 w-4 text-purple-400" />;
    case "satisfaction":
      return <Star className="h-4 w-4 text-amber-400" />;
    default:
      return <Target className="h-4 w-4 text-muted-foreground" />;
  }
}

function ProgressBar({
  current,
  target,
  status,
}: {
  current: number;
  target: number;
  status: string;
}) {
  const percentage = Math.min((current / target) * 100, 100);
  const color =
    status === "achieved" || status === "on_track"
      ? "bg-green-500"
      : status === "at_risk"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function CreateGoalModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateGoalForm) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<CreateGoalForm>({
    name: "",
    description: "",
    metric: "Total Revenue",
    target: "",
    unit: "currency",
    period: "Q1 2025",
    category: "revenue",
    dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  const handleMetricChange = (metric: string) => {
    const option = metricOptions.find((m) => m.value === metric);
    if (option) {
      setForm({
        ...form,
        metric,
        unit: option.unit,
        category: option.category,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-muted rounded-lg p-6 w-full max-w-lg mx-4 border border-border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Create New Goal</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Goal Name
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Q1 Revenue Target"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Describe this goal..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Metric</label>
              <select
                value={form.metric}
                onChange={(e) => handleMetricChange(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {metricOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.value}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Target Value
              </label>
              <input
                type="number"
                required
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={form.unit === "currency" ? "1000000" : "50"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Period</label>
              <select
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {periodOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Due Date
              </label>
              <input
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-lg">
              {getCategoryIcon(form.category)}
              <span className="text-sm text-muted-foreground capitalize">{form.category}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Unit: <span className="text-muted-foreground">{form.unit}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-muted hover:bg-muted text-foreground rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Goal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchGoals = async () => {
    try {
      const res = await fetch("/api/admin/platform-analytics/goals");
      if (!res.ok) {
        throw new Error("Failed to fetch goals");
      }
      const data = await res.json();
      setGoals(data);
      setIsUsingMockData(false);
    } catch (err) {
      console.error("Error fetching goals:", err);
      // Fall back to demo data if API fails
      setGoals([
        {
          id: "demo-1",
          name: "Q1 2025 Revenue Target",
          description: "Achieve $1M in revenue for Q1 2025",
          metric: "Total Revenue",
          target: 1000000,
          current: 0,
          unit: "currency",
          period: "Q1 2025",
          category: "revenue",
          status: "on_track",
          progress: 0,
          daysRemaining: 90,
          trend: "flat",
          dueDate: "2025-03-31",
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsUsingMockData(true);
      setError("Unable to connect to API. Showing demo data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreateGoal = async (data: CreateGoalForm) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/platform-analytics/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          description: data.description || undefined,
          metric: data.metric,
          target: parseFloat(data.target),
          unit: data.unit,
          period: data.period,
          category: data.category,
          dueDate: data.dueDate,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create goal");
      }

      await fetchGoals();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error creating goal:", err);
      alert("Failed to create goal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteGoal = async () => {
    if (!deleteConfirmId) return;

    try {
      const res = await fetch(`/api/admin/platform-analytics/goals/${deleteConfirmId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete goal");
      }

      await fetchGoals();
    } catch (err) {
      console.error("Error deleting goal:", err);
      alert("Failed to delete goal. Please try again.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const filteredGoals =
    filter === "all" ? goals : goals.filter((g) => g.status === filter || g.category === filter);

  const statusCounts = {
    achieved: goals.filter((g) => g.status === "achieved").length,
    on_track: goals.filter((g) => g.status === "on_track").length,
    at_risk: goals.filter((g) => g.status === "at_risk").length,
    behind: goals.filter((g) => g.status === "behind").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Goal Tracking</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Track progress toward platform objectives</p>
          {error && <p className="text-amber-400 text-sm mt-1">{error}</p>}
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Goal
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all ${filter === "on_track" ? "ring-2 ring-green-500" : ""} bg-green-500/10 border-green-500/30`}
          onClick={() => setFilter(filter === "on_track" ? "all" : "on_track")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-400">{statusCounts.on_track}</p>
                <p className="text-sm text-muted-foreground">On Track</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === "at_risk" ? "ring-2 ring-amber-500" : ""} bg-amber-500/10 border-amber-500/30`}
          onClick={() => setFilter(filter === "at_risk" ? "all" : "at_risk")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-400">{statusCounts.at_risk}</p>
                <p className="text-sm text-muted-foreground">At Risk</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === "behind" ? "ring-2 ring-red-500" : ""} bg-red-500/10 border-red-500/30`}
          onClick={() => setFilter(filter === "behind" ? "all" : "behind")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-400">{statusCounts.behind}</p>
                <p className="text-sm text-muted-foreground">Behind</p>
              </div>
              <XCircle className="h-8 w-8 text-red-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${filter === "achieved" ? "ring-2 ring-blue-500" : ""} bg-blue-500/10 border-blue-500/30`}
          onClick={() => setFilter(filter === "achieved" ? "all" : "achieved")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-400">{statusCounts.achieved}</p>
                <p className="text-sm text-muted-foreground">Achieved</p>
              </div>
              <Target className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.length === 0 ? (
          <Card className="bg-muted/50 border-border">
            <CardContent className="p-8 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No goals yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first goal to start tracking platform objectives.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Goal
              </button>
            </CardContent>
          </Card>
        ) : (
          filteredGoals.map((goal) => {
            const dueDate = new Date(goal.dueDate);
            const daysRemaining = Math.ceil(
              (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
            );

            return (
              <Card key={goal.id} className="bg-muted/50 border-border">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        {getCategoryIcon(goal.category)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{goal.name}</h3>
                          {getStatusBadge(goal.status)}
                        </div>
                        {goal.description && (
                          <p className="text-sm text-muted-foreground">{goal.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {goal.period} • Due {dueDate.toLocaleDateString()} ({daysRemaining} days
                          remaining)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(goal.id)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className={`font-medium ${getStatusColor(goal.status)}`}>
                        {formatValue(goal.current, goal.unit)} /{" "}
                        {formatValue(goal.target, goal.unit)}
                      </span>
                    </div>
                    <ProgressBar current={goal.current} target={goal.target} status={goal.status} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{goal.progress.toFixed(1)}% complete</span>
                      <span>
                        {goal.unit === "percentage"
                          ? `${(goal.target - goal.current).toFixed(1)}% to go`
                          : goal.unit === "currency"
                            ? `$${((goal.target - goal.current) / 1000).toFixed(0)}K to go`
                            : goal.unit === "score"
                              ? `${goal.target - goal.current} points to go`
                              : `${(goal.target - goal.current).toLocaleString()} to go`}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Quick Add Goals Suggestions */}
      <Card className="bg-muted/50 border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground">Suggested Goals</CardTitle>
          <p className="text-sm text-muted-foreground">Based on common industry objectives</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setIsModalOpen(true)}
              className="p-4 bg-muted/50 rounded-lg border border-border hover:border-blue-500/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="font-medium text-foreground">Revenue Stretch Goal</span>
              </div>
              <p className="text-xs text-muted-foreground">Increase Q1 2025 revenue by 20% YoY</p>
            </div>
            <div
              onClick={() => setIsModalOpen(true)}
              className="p-4 bg-muted/50 rounded-lg border border-border hover:border-blue-500/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="font-medium text-foreground">NPS Improvement</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Get 3 struggling campgrounds above NPS 30
              </p>
            </div>
            <div
              onClick={() => setIsModalOpen(true)}
              className="p-4 bg-muted/50 rounded-lg border border-border hover:border-blue-500/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-400" />
                <span className="font-medium text-foreground">Guest Retention</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Increase first-to-repeat conversion by 15%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Goal Modal */}
      <CreateGoalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateGoal}
        isSubmitting={isSubmitting}
      />

      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent className="bg-muted border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Goal</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete this goal? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGoal} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
