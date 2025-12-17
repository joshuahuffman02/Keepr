"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Goal {
  id: string;
  name: string;
  description: string;
  metric: string;
  target: number;
  current: number;
  unit: "currency" | "percentage" | "number" | "score";
  period: string;
  category: "revenue" | "bookings" | "guests" | "satisfaction";
  status: "on_track" | "at_risk" | "behind" | "achieved";
  trend: "up" | "down" | "flat";
  dueDate: Date;
  createdAt: Date;
}

// Mock goals data
const mockGoals: Goal[] = [
  {
    id: "1",
    name: "Q4 Revenue Target",
    description: "Achieve $3M in revenue for Q4 2024",
    metric: "Total Revenue",
    target: 3000000,
    current: 2847500,
    unit: "currency",
    period: "Q4 2024",
    category: "revenue",
    status: "on_track",
    trend: "up",
    dueDate: new Date("2024-12-31"),
    createdAt: new Date("2024-10-01"),
  },
  {
    id: "2",
    name: "NPS Excellence",
    description: "Achieve platform-wide NPS of 50+",
    metric: "NPS Score",
    target: 50,
    current: 42,
    unit: "score",
    period: "2024",
    category: "satisfaction",
    status: "at_risk",
    trend: "up",
    dueDate: new Date("2024-12-31"),
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "3",
    name: "Reduce Cancellations",
    description: "Reduce cancellation rate below 5%",
    metric: "Cancellation Rate",
    target: 5,
    current: 6.2,
    unit: "percentage",
    period: "Q4 2024",
    category: "bookings",
    status: "at_risk",
    trend: "down",
    dueDate: new Date("2024-12-31"),
    createdAt: new Date("2024-10-01"),
  },
  {
    id: "4",
    name: "10K Reservations",
    description: "Reach 10,000 reservations for the year",
    metric: "Total Reservations",
    target: 10000,
    current: 8742,
    unit: "number",
    period: "2024",
    category: "bookings",
    status: "on_track",
    trend: "up",
    dueDate: new Date("2024-12-31"),
    createdAt: new Date("2024-01-01"),
  },
  {
    id: "5",
    name: "Guest Loyalty",
    description: "Achieve 40% repeat guest rate",
    metric: "Repeat Guest Rate",
    target: 40,
    current: 34.5,
    unit: "percentage",
    period: "Q4 2024",
    category: "guests",
    status: "behind",
    trend: "up",
    dueDate: new Date("2024-12-31"),
    createdAt: new Date("2024-10-01"),
  },
  {
    id: "6",
    name: "ADR Growth",
    description: "Increase ADR to $90",
    metric: "Average Daily Rate",
    target: 90,
    current: 85.50,
    unit: "currency",
    period: "Q4 2024",
    category: "revenue",
    status: "on_track",
    trend: "up",
    dueDate: new Date("2024-12-31"),
    createdAt: new Date("2024-10-01"),
  },
];

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
      return <Target className="h-5 w-5 text-slate-400" />;
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
      return "text-slate-400";
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
      return <Target className="h-4 w-4 text-slate-400" />;
  }
}

function ProgressBar({ current, target, status }: { current: number; target: number; status: string }) {
  const percentage = Math.min((current / target) * 100, 100);
  const color =
    status === "achieved" || status === "on_track"
      ? "bg-green-500"
      : status === "at_risk"
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="w-full bg-slate-700 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-500`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState(mockGoals);
  const [filter, setFilter] = useState<string>("all");
  const [isUsingMockData] = useState(true);

  const filteredGoals =
    filter === "all" ? goals : goals.filter((g) => g.status === filter || g.category === filter);

  const statusCounts = {
    achieved: goals.filter((g) => g.status === "achieved").length,
    on_track: goals.filter((g) => g.status === "on_track").length,
    at_risk: goals.filter((g) => g.status === "at_risk").length,
    behind: goals.filter((g) => g.status === "behind").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Goal Tracking</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-slate-400 mt-1">Track progress toward platform objectives</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
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
                <p className="text-sm text-slate-400">On Track</p>
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
                <p className="text-sm text-slate-400">At Risk</p>
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
                <p className="text-sm text-slate-400">Behind</p>
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
                <p className="text-sm text-slate-400">Achieved</p>
              </div>
              <Target className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <div className="space-y-4">
        {filteredGoals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          const daysRemaining = Math.ceil(
            (goal.dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          return (
            <Card key={goal.id} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-slate-700 rounded-lg">
                      {getCategoryIcon(goal.category)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{goal.name}</h3>
                        {getStatusBadge(goal.status)}
                      </div>
                      <p className="text-sm text-slate-400">{goal.description}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {goal.period} • Due {goal.dueDate.toLocaleDateString()} ({daysRemaining} days remaining)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                      <Edit2 className="h-4 w-4 text-slate-400" />
                    </button>
                    <button className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
                      <Trash2 className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Progress</span>
                    <span className={`font-medium ${getStatusColor(goal.status)}`}>
                      {formatValue(goal.current, goal.unit)} / {formatValue(goal.target, goal.unit)}
                    </span>
                  </div>
                  <ProgressBar current={goal.current} target={goal.target} status={goal.status} />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{progress.toFixed(1)}% complete</span>
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
        })}
      </div>

      {/* Quick Add Goals Suggestions */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Suggested Goals</CardTitle>
          <p className="text-sm text-slate-400">Based on your current performance</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="font-medium text-white">Revenue Stretch Goal</span>
              </div>
              <p className="text-xs text-slate-400">Increase Q1 2025 revenue by 20% YoY</p>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-amber-400" />
                <span className="font-medium text-white">NPS Improvement</span>
              </div>
              <p className="text-xs text-slate-400">Get 3 struggling campgrounds above NPS 30</p>
            </div>
            <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-blue-500/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-400" />
                <span className="font-medium text-white">Guest Retention</span>
              </div>
              <p className="text-xs text-slate-400">Increase first-to-repeat conversion by 15%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
