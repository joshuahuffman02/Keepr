"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CheckCircle,
  Activity,
  Star,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Building2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/analytics";

// Mock data
const mockExecutiveData = {
  kpis: [
    {
      label: "Total Revenue",
      value: 2847500,
      previousValue: 2456000,
      change: 15.9,
      changeType: "increase",
      format: "currency",
      status: "good",
    },
    {
      label: "Total Reservations",
      value: 8742,
      previousValue: 7890,
      change: 10.8,
      changeType: "increase",
      format: "number",
      status: "good",
    },
    {
      label: "NPS Score",
      value: 42,
      previousValue: 38,
      change: 4,
      changeType: "increase",
      format: "score",
      status: "neutral",
    },
    {
      label: "Avg Booking Value",
      value: 325.75,
      previousValue: 311.28,
      change: 4.6,
      changeType: "increase",
      format: "currency",
      status: "good",
    },
    {
      label: "Active Guests",
      value: 6234,
      format: "number",
      changeType: "neutral",
      status: "neutral",
    },
    {
      label: "Cancellation Rate",
      value: 6.2,
      previousValue: 7.8,
      change: -1.6,
      changeType: "increase",
      format: "percentage",
      status: "good",
    },
  ],
  alerts: [
    {
      id: "1",
      type: "nps",
      severity: "critical",
      message: "Campground has negative NPS score",
      campgroundName: "Needs Attention 1",
      value: -12,
      threshold: 0,
      createdAt: new Date("2024-12-16"),
    },
    {
      id: "2",
      type: "cancellation",
      severity: "warning",
      message: "Campground has high cancellation rate",
      campgroundName: "Needs Attention 2",
      value: 18.5,
      threshold: 15,
      createdAt: new Date("2024-12-15"),
    },
    {
      id: "3",
      type: "nps",
      severity: "warning",
      message: "Campground has low NPS score",
      campgroundName: "Needs Attention 3",
      value: 5,
      threshold: 20,
      createdAt: new Date("2024-12-14"),
    },
  ],
  topPerformers: [
    { campgroundId: "1", campgroundName: "Top Performer 1", metric: "Revenue", value: 425000, rank: 1 },
    { campgroundId: "2", campgroundName: "Top Performer 2", metric: "Revenue", value: 389000, rank: 2 },
    { campgroundId: "3", campgroundName: "Top Performer 3", metric: "Revenue", value: 356000, rank: 3 },
    { campgroundId: "4", campgroundName: "Top Performer 4", metric: "Revenue", value: 312000, rank: 4 },
    { campgroundId: "5", campgroundName: "Top Performer 5", metric: "Revenue", value: 298000, rank: 5 },
  ],
  needsAttention: [
    {
      campgroundId: "9",
      campgroundName: "Needs Attention 1",
      issue: "Negative NPS Score",
      severity: "critical",
      metric: -12,
      recommendation: "Review recent negative feedback and address common complaints",
    },
    {
      campgroundId: "10",
      campgroundName: "Needs Attention 2",
      issue: "High Cancellation Rate",
      severity: "warning",
      metric: 18.5,
      recommendation: "Analyze cancellation reasons and improve booking experience",
    },
    {
      campgroundId: "11",
      campgroundName: "Needs Attention 3",
      issue: "Low NPS Score",
      severity: "warning",
      metric: 5,
      recommendation: "Focus on staff training and facility improvements",
    },
  ],
  recentActivity: [
    { type: "reservation", description: "New reservation - $487.50", campgroundName: "Campground A", timestamp: new Date("2024-12-17T10:30:00"), value: 487.5 },
    { type: "nps_response", description: "NPS Response: 9/10 (Promoter)", campgroundName: "Campground B", timestamp: new Date("2024-12-17T10:15:00"), value: 9 },
    { type: "reservation", description: "New reservation - $325.00", campgroundName: "Campground C", timestamp: new Date("2024-12-17T09:45:00"), value: 325 },
    { type: "nps_response", description: "NPS Response: 4/10 (Detractor)", campgroundName: "Campground D", timestamp: new Date("2024-12-17T09:30:00"), value: 4 },
    { type: "reservation", description: "New reservation - $612.00", campgroundName: "Campground E", timestamp: new Date("2024-12-17T09:00:00"), value: 612 },
    { type: "cancellation", description: "Reservation cancelled - $245.00", campgroundName: "Campground F", timestamp: new Date("2024-12-17T08:30:00"), value: 245 },
  ],
};

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
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

function getStatusColor(status: string): string {
  switch (status) {
    case "good":
      return "text-green-400";
    case "warning":
      return "text-amber-400";
    case "critical":
      return "text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case "good":
      return "bg-green-500/10 border-green-500/30";
    case "warning":
      return "bg-amber-500/10 border-amber-500/30";
    case "critical":
      return "bg-red-500/10 border-red-500/30";
    default:
      return "bg-muted/50 border-border";
  }
}

export default function ExecutiveDashboardPage() {
  const [dateRange, setDateRange] = useState("last_30_days");
  const [data, setData] = useState(mockExecutiveData);
  const [loading, setLoading] = useState(false);
  const [isUsingMockData, setIsUsingMockData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/platform-analytics/executive?range=${dateRange}`);
        if (response.ok) {
          const result = await response.json();
          if (result.kpis?.length > 0) {
            setData(result);
            setIsUsingMockData(false);
          }
        }
      } catch (error) {
        console.error("Failed to fetch executive data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const criticalAlerts = data.alerts.filter((a) => a.severity === "critical");
  const warningAlerts = data.alerts.filter((a) => a.severity === "warning");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Executive Dashboard</h1>
            {isUsingMockData && (
              <Badge className="bg-amber-600/20 text-amber-400 border border-amber-600/50">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Platform-wide performance at a glance</p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <p className="font-medium text-red-400">
                {criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? "s" : ""} Require Attention
              </p>
              <p className="text-sm text-red-300/70">{criticalAlerts[0].message}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {data.kpis.map((kpi, idx) => (
          <Card key={idx} className={`border ${getStatusBgColor(kpi.status)}`}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
              <p className={`text-2xl font-bold ${getStatusColor(kpi.status)}`}>
                {formatValue(kpi.value as number, kpi.format)}
              </p>
              {kpi.change !== undefined && (
                <div className="flex items-center gap-1 mt-2">
                  {kpi.changeType === "increase" ? (
                    <ArrowUpRight className={`h-3 w-3 ${kpi.format === "percentage" && kpi.change < 0 ? "text-green-400" : kpi.change >= 0 ? "text-green-400" : "text-red-400"}`} />
                  ) : kpi.changeType === "decrease" ? (
                    <ArrowDownRight className="h-3 w-3 text-red-400" />
                  ) : (
                    <Minus className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={`text-xs ${kpi.format === "percentage" && kpi.change < 0 ? "text-green-400" : kpi.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {kpi.change > 0 ? "+" : ""}{kpi.change.toFixed(1)}{kpi.format === "score" ? " pts" : "%"}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alerts & Issues */}
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.alerts.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
                <p className="text-muted-foreground">All systems healthy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.severity === "critical"
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-amber-500/10 border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-sm font-medium ${alert.severity === "critical" ? "text-red-400" : "text-amber-400"}`}>
                          {alert.campgroundName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.type === "nps" ? `NPS: ${alert.value}` : `Rate: ${alert.value.toFixed(1)}%`}
                        </p>
                      </div>
                      <Badge className={alert.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}>
                        {alert.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topPerformers.map((p, idx) => (
                <div key={p.campgroundId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? "bg-amber-500 text-black" :
                      idx === 1 ? "bg-muted text-black" :
                      idx === 2 ? "bg-amber-700 text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {p.rank}
                    </span>
                    <span className="text-sm text-white">{p.campgroundName}</span>
                  </div>
                  <span className="text-sm font-medium text-green-400">
                    ${(p.value / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentActivity.slice(0, 6).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={`p-1.5 rounded ${
                    activity.type === "reservation" ? "bg-green-500/20" :
                    activity.type === "nps_response" ? "bg-blue-500/20" :
                    activity.type === "cancellation" ? "bg-red-500/20" :
                    "bg-muted"
                  }`}>
                    {activity.type === "reservation" ? (
                      <DollarSign className="h-3 w-3 text-green-400" />
                    ) : activity.type === "nps_response" ? (
                      <Star className="h-3 w-3 text-blue-400" />
                    ) : activity.type === "cancellation" ? (
                      <XCircle className="h-3 w-3 text-red-400" />
                    ) : (
                      <Zap className="h-3 w-3 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.campgroundName}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Needs Attention */}
      {data.needsAttention.length > 0 && (
        <Card className="bg-muted/50 border-border">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-400" />
              Campgrounds Needing Attention
            </CardTitle>
            <p className="text-sm text-muted-foreground">Prioritized list of properties requiring intervention</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Campground</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Issue</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Metric</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.needsAttention.map((item, idx) => (
                    <tr key={item.campgroundId} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="py-3 px-4">
                        <span className="text-sm text-white">{item.campgroundName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={item.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}>
                          {item.issue}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${item.severity === "critical" ? "text-red-400" : "text-amber-400"}`}>
                          {item.metric}{typeof item.metric === "number" && item.metric > 1 ? "%" : ""}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs text-muted-foreground">{item.recommendation}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <p className="text-xs text-muted-foreground">Total Campgrounds</p>
          <p className="text-2xl font-bold text-white">47</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <p className="text-xs text-muted-foreground">Healthy (NPS 30+)</p>
          <p className="text-2xl font-bold text-green-400">38</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <p className="text-xs text-muted-foreground">At Risk (NPS 0-30)</p>
          <p className="text-2xl font-bold text-amber-400">7</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 border border-border">
          <p className="text-xs text-muted-foreground">Critical (NPS &lt;0)</p>
          <p className="text-2xl font-bold text-red-400">2</p>
        </div>
      </div>
    </div>
  );
}
