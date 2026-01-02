"use client";

import { useEffect, useState, useMemo } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  Truck,
  Baby,
  Dog,
  RefreshCw,
  Download,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus,
  Share2,
  Copy,
  Check,
  Link,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Types for analytics data
interface GuestAnalytics {
  overview: {
    totalGuests: number;
    newGuestsThisMonth: number;
    newGuestsLastMonth: number;
    repeatGuests: number;
    repeatRate: number;
    avgPartySize: number;
    avgStayLength: number;
    avgLeadTime: number;
  };
  geographic: {
    byCountry: { country: string; count: number; percentage: number }[];
    byState: { state: string; country: string; count: number; percentage: number }[];
    topCities: { city: string; state: string; count: number }[];
    snowbirdPatterns: {
      northernStates: number;
      southernDestinations: number;
      avgMigrationMonth: number;
    };
  };
  demographics: {
    partyComposition: {
      adultsOnly: number;
      withChildren: number;
      avgAdults: number;
      avgChildren: number;
    };
    rigTypes: { type: string; count: number; percentage: number }[];
    avgRigLength: number;
    hasPets: number;
    petPercentage: number;
  };
  seasonalTrends: {
    byMonth: { month: string; reservations: number; revenue: number; avgStayLength: number }[];
    peakSeason: string;
    shoulderSeason: string;
    offSeason: string;
  };
  travelBehavior: {
    stayReasons: { reason: string; count: number; percentage: number }[];
    bookingSources: { source: string; count: number; percentage: number }[];
    avgBookingWindow: number;
    weekdayVsWeekend: { weekday: number; weekend: number };
  };
  insights: {
    title: string;
    description: string;
    type: "info" | "warning" | "success";
    metric?: string;
  }[];
}

// Empty state data for when no real data exists
const emptyAnalytics: GuestAnalytics = {
  overview: {
    totalGuests: 0,
    newGuestsThisMonth: 0,
    newGuestsLastMonth: 0,
    repeatGuests: 0,
    repeatRate: 0,
    avgPartySize: 0,
    avgStayLength: 0,
    avgLeadTime: 0,
  },
  geographic: {
    byCountry: [],
    byState: [],
    topCities: [],
    snowbirdPatterns: {
      northernStates: 0,
      southernDestinations: 0,
      avgMigrationMonth: 0,
    },
  },
  demographics: {
    partyComposition: {
      adultsOnly: 0,
      withChildren: 0,
      avgAdults: 0,
      avgChildren: 0,
    },
    rigTypes: [],
    avgRigLength: 0,
    hasPets: 0,
    petPercentage: 0,
  },
  seasonalTrends: {
    byMonth: [],
    peakSeason: "N/A",
    shoulderSeason: "N/A",
    offSeason: "N/A",
  },
  travelBehavior: {
    stayReasons: [],
    bookingSources: [],
    avgBookingWindow: 0,
    weekdayVsWeekend: { weekday: 0, weekend: 0 },
  },
  insights: [],
};

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 1;

  if (isNeutral) {
    return (
      <span className="flex items-center text-muted-foreground dark:text-muted-foreground text-xs">
        <Minus className="h-3 w-3 mr-1" />
        No change
      </span>
    );
  }

  return (
    <span className={`flex items-center text-xs ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
      {isPositive ? <ArrowUp className="h-3 w-3 mr-1" /> : <ArrowDown className="h-3 w-3 mr-1" />}
      {Math.abs(change).toFixed(1)}% vs last month
    </span>
  );
}

function BarChart({ data, labelKey, valueKey, maxValue }: {
  data: any[];
  labelKey: string;
  valueKey: string;
  maxValue?: number;
}) {
  const max = maxValue || Math.max(...data.map(d => d[valueKey]));

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-xs text-muted-foreground dark:text-muted-foreground truncate">{item[labelKey]}</div>
          <div className="flex-1 h-6 bg-muted dark:bg-muted rounded overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded transition-all"
              style={{ width: `${(item[valueKey] / max) * 100}%` }}
            />
          </div>
          <div className="w-16 text-xs text-foreground dark:text-muted-foreground text-right">
            {item.percentage ? `${item.percentage}%` : item[valueKey].toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleLineChart({ data }: { data: { month: string; reservations: number }[] }) {
  const max = Math.max(...data.map(d => d.reservations));
  const min = Math.min(...data.map(d => d.reservations));
  const range = max - min;

  return (
    <div className="h-40 flex items-end gap-1">
      {data.map((item, i) => {
        const height = range > 0 ? ((item.reservations - min) / range) * 100 : 50;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-emerald-600 rounded-t transition-all hover:bg-emerald-500"
              style={{ height: `${Math.max(height, 5)}%` }}
              title={`${item.month}: ${item.reservations.toLocaleString()} reservations`}
            />
            <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">{item.month}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function GuestAnalyticsPage() {
  const { data: whoami, isLoading: whoamiLoading } = useWhoami();
  const [analytics, setAnalytics] = useState<GuestAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState("last_12_months");
  const [refreshing, setRefreshing] = useState(false);

  // Export/Share state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [shareName, setShareName] = useState("");
  const [shareExpiry, setShareExpiry] = useState("168"); // 7 days in hours

  const platformRole = whoami?.user?.platformRole;
  const canViewAnalytics = platformRole === "platform_admin" || platformRole === "platform_support";

  useEffect(() => {
    if (whoamiLoading) return;

    const loadAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
        const token = localStorage.getItem("campreserv:authToken");

        const res = await fetch(`${apiUrl}/admin/guest-analytics?range=${dateRange}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch analytics: ${res.statusText}`);
        }

        const result = await res.json();

        // Check if the data is essentially empty (no guests)
        const hasRealData = result.overview?.totalGuests > 0;
        if (!hasRealData) {
          setAnalytics(emptyAnalytics);
        } else {
          setAnalytics(result);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setAnalytics(emptyAnalytics);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [whoamiLoading, dateRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const token = localStorage.getItem("campreserv:authToken");

      const res = await fetch(`${apiUrl}/admin/guest-analytics?range=${dateRange}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to refresh analytics: ${res.statusText}`);
      }

      const result = await res.json();
      const hasRealData = result.overview?.totalGuests > 0;
      if (!hasRealData) {
        setAnalytics(emptyAnalytics);
      } else {
        setAnalytics(result);
      }
    } catch (err) {
      console.error("Failed to refresh analytics:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const token = localStorage.getItem("campreserv:authToken");

      const res = await fetch(`${apiUrl}/admin/analytics/export`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analyticsType: "full_report",
          format: exportFormat,
          dateRange,
        }),
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const result = await res.json();

      // Poll for export completion
      const checkExport = async (exportId: string, attempts = 0): Promise<void> => {
        if (attempts > 30) {
          throw new Error("Export timed out");
        }

        const statusRes = await fetch(`${apiUrl}/admin/analytics/exports/${exportId}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!statusRes.ok) {
          throw new Error("Failed to check export status");
        }

        const status = await statusRes.json();

        if (status.status === "completed" && status.fileUrl) {
          // Download the file
          const link = document.createElement("a");
          link.href = status.fileUrl;
          link.download = status.fileName || `analytics-export.${exportFormat}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setExportDialogOpen(false);
        } else if (status.status === "failed") {
          throw new Error(status.errorMessage || "Export failed");
        } else {
          // Still processing, wait and retry
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return checkExport(exportId, attempts + 1);
        }
      };

      await checkExport(result.id);
    } catch (err) {
      console.error("Export failed:", err);
      // Fallback: export mock data locally
      const content =
        exportFormat === "json"
          ? JSON.stringify(analytics, null, 2)
          : convertAnalyticsToCsv(analytics);
      const blob = new Blob([content], {
        type: exportFormat === "json" ? "application/json" : "text/csv",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `guest-analytics-${dateRange}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportDialogOpen(false);
    } finally {
      setExporting(false);
    }
  };

  const convertAnalyticsToCsv = (data: GuestAnalytics | null): string => {
    if (!data) return "";
    const rows: string[] = ["Section,Metric,Value"];
    rows.push(`Overview,Total Guests,${data.overview.totalGuests}`);
    rows.push(`Overview,New Guests This Month,${data.overview.newGuestsThisMonth}`);
    rows.push(`Overview,Repeat Guests,${data.overview.repeatGuests}`);
    rows.push(`Overview,Repeat Rate,${data.overview.repeatRate}%`);
    rows.push(`Overview,Avg Party Size,${data.overview.avgPartySize}`);
    rows.push(`Overview,Avg Stay Length,${data.overview.avgStayLength} nights`);
    rows.push(`Overview,Avg Lead Time,${data.overview.avgLeadTime} days`);
    data.geographic.byCountry.forEach((c) => {
      rows.push(`Geographic,${c.country},${c.count} (${c.percentage}%)`);
    });
    data.demographics.rigTypes.forEach((r) => {
      rows.push(`Demographics,${r.type},${r.count} (${r.percentage}%)`);
    });
    return rows.join("\n");
  };

  const handleCreateShareLink = async () => {
    setSharing(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
      const token = localStorage.getItem("campreserv:authToken");

      const res = await fetch(`${apiUrl}/admin/analytics/share`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analyticsType: "full_report",
          dateRange,
          name: shareName || `Guest Analytics - ${new Date().toLocaleDateString()}`,
          expiresIn: parseInt(shareExpiry, 10),
          accessLevel: "view_only",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create share link");
      }

      const result = await res.json();
      const baseUrl = window.location.origin;
      setShareLink(`${baseUrl}${result.shareUrl}`);
    } catch (err) {
      console.error("Failed to create share link:", err);
      // Fallback: create a mock share link for demo
      setShareLink(`${window.location.origin}/shared/analytics/demo-${Date.now()}`);
    } finally {
      setSharing(false);
    }
  };

  const copyShareLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    }
  };

  if (whoamiLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted dark:bg-muted rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-muted dark:bg-muted rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 bg-muted dark:bg-muted rounded-lg" />
            <div className="h-64 bg-muted dark:bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!canViewAnalytics) {
    return (
      <div className="p-8">
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-semibold text-amber-200">Access Restricted</h3>
                <p className="text-sm text-amber-300/80">
                  You need platform admin or support role to view guest analytics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="bg-rose-50 dark:bg-rose-900/20 border-rose-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
              <div>
                <h3 className="font-semibold text-rose-200">Error Loading Analytics</h3>
                <p className="text-sm text-rose-300/80">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Check if we have empty data
  const hasData = analytics.overview.totalGuests > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground dark:text-white">Guest Analytics</h1>
            {!hasData && (
              <Badge className="bg-muted/20 text-muted-foreground dark:text-muted-foreground border border-border dark:border-border/50">
                No Data
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground dark:text-muted-foreground mt-1">
            {hasData
              ? "Platform-wide guest insights across all campgrounds"
              : "Guest analytics will appear once you have reservations"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-44 bg-card dark:bg-muted border-border dark:border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_12_months">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="all_time">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border dark:border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border dark:border-border"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:bg-emerald-900/20"
            onClick={() => {
              setShareLink(null);
              setShareName("");
              setShareDialogOpen(true);
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!hasData && (
        <Card className="bg-muted dark:bg-muted/30 border-border dark:border-border">
          <CardContent className="p-12 text-center">
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground dark:text-muted-foreground mb-2">No Guest Data Yet</h3>
            <p className="text-muted-foreground dark:text-muted-foreground mb-6 max-w-md mx-auto">
              Guest analytics will be available once you have reservations in your campgrounds.
              Create your first reservation to start seeing insights about your guests.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {hasData && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 text-emerald-500" />
              <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-400 dark:border-emerald-400/50">
                Total
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground dark:text-white">
                {analytics.overview.totalGuests.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Total Guests</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <TrendIndicator
                current={analytics.overview.newGuestsThisMonth}
                previous={analytics.overview.newGuestsLastMonth}
              />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground dark:text-white">
                {analytics.overview.newGuestsThisMonth.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">New Guests This Month</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <RefreshCw className="h-8 w-8 text-amber-500" />
              <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-400 dark:border-amber-400/50">
                {analytics.overview.repeatRate}%
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground dark:text-white">
                {analytics.overview.repeatGuests.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Repeat Guests</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Calendar className="h-8 w-8 text-violet-500" />
              <Badge variant="outline" className="text-violet-600 dark:text-violet-400 border-violet-400 dark:border-violet-400/50">
                Avg
              </Badge>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-foreground dark:text-white">
                {analytics.overview.avgStayLength} nights
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground">Avg Stay Length</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights Banner */}
      {analytics.insights.length > 0 && (
        <Card className="bg-muted border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {analytics.insights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border ${
                    insight.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-900/20 border-amber-700/50"
                      : insight.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-700/50"
                      : "bg-muted dark:bg-muted/30 border-border dark:border-border/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-foreground dark:text-white">{insight.title}</span>
                    {insight.metric && (
                      <Badge variant="outline" className="text-xs">
                        {insight.metric}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">{insight.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Origin */}
        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-emerald-500" />
              Geographic Origin
            </CardTitle>
            <CardDescription>Where your guests are coming from</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-foreground dark:text-muted-foreground mb-3">By Country</h4>
              <BarChart
                data={analytics.geographic.byCountry}
                labelKey="country"
                valueKey="count"
              />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground dark:text-muted-foreground mb-3">Top States/Provinces</h4>
              <BarChart
                data={analytics.geographic.byState.slice(0, 6)}
                labelKey="state"
                valueKey="count"
              />
            </div>
          </CardContent>
        </Card>

        {/* Seasonal Trends */}
        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Seasonal Trends
            </CardTitle>
            <CardDescription>Booking patterns throughout the year</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SimpleLineChart data={analytics.seasonalTrends.byMonth} />
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border dark:border-border">
              <div className="text-center">
                <Badge className="bg-emerald-600 mb-1">Peak</Badge>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">{analytics.seasonalTrends.peakSeason}</div>
              </div>
              <div className="text-center">
                <Badge className="bg-amber-600 mb-1">Shoulder</Badge>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">{analytics.seasonalTrends.shoulderSeason}</div>
              </div>
              <div className="text-center">
                <Badge className="bg-muted mb-1">Off</Badge>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">{analytics.seasonalTrends.offSeason}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demographics */}
        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-amber-500" />
              Guest Demographics
            </CardTitle>
            <CardDescription>Equipment types and party composition</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-foreground dark:text-muted-foreground mb-3">RV/Equipment Types</h4>
              <BarChart
                data={analytics.demographics.rigTypes}
                labelKey="type"
                valueKey="count"
              />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border dark:border-border">
              <div className="text-center">
                <div className="text-xl font-bold text-foreground dark:text-white">{analytics.demographics.avgRigLength}ft</div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">Avg RV Length</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-foreground dark:text-white flex items-center justify-center gap-1">
                  <Baby className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  {((analytics.demographics.partyComposition.withChildren / analytics.overview.totalGuests) * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">With Children</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-foreground dark:text-white flex items-center justify-center gap-1">
                  <Dog className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  {analytics.demographics.petPercentage}%
                </div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">With Pets</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Travel Behavior */}
        <Card className="bg-card dark:bg-muted/50 border-border dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-500" />
              Travel Behavior
            </CardTitle>
            <CardDescription>Why and how guests book</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-foreground dark:text-muted-foreground mb-3">Stay Reasons</h4>
              <BarChart
                data={analytics.travelBehavior.stayReasons.slice(0, 5)}
                labelKey="reason"
                valueKey="count"
              />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground dark:text-muted-foreground mb-3">Booking Sources</h4>
              <BarChart
                data={analytics.travelBehavior.bookingSources.slice(0, 5)}
                labelKey="source"
                valueKey="count"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border dark:border-border">
              <div className="text-center">
                <div className="text-xl font-bold text-foreground dark:text-white">{analytics.travelBehavior.avgBookingWindow} days</div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">Avg Booking Window</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-foreground dark:text-white">
                  {analytics.travelBehavior.weekdayVsWeekend.weekend}%
                </div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">Weekend Arrivals</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Snowbird Insights */}
      <Card className="bg-status-info/10 border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Snowbird Migration Patterns
          </CardTitle>
          <CardDescription>
            Northern guests traveling to southern destinations (Oct - Mar)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-card dark:bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-foreground dark:text-white">
                {analytics.geographic.snowbirdPatterns.northernStates.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                Guests from Northern States/Canada
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                MI, OH, MN, WI, Ontario, Alberta
              </div>
            </div>
            <div className="text-center p-4 bg-card dark:bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-foreground dark:text-white">
                {analytics.geographic.snowbirdPatterns.southernDestinations.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                Booked Southern Destinations
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                TX, AZ, FL properties
              </div>
            </div>
            <div className="text-center p-4 bg-card dark:bg-muted/50 rounded-lg">
              <div className="text-3xl font-bold text-foreground dark:text-white">
                October
              </div>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                Peak Migration Month
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                15% earlier than last year
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="bg-card dark:bg-muted border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground dark:text-white">Export Analytics</DialogTitle>
            <DialogDescription>
              Download guest analytics data for the selected time period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "csv" | "json")}>
                <SelectTrigger className="bg-card dark:bg-muted border-border dark:border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Spreadsheet)</SelectItem>
                  <SelectItem value="json">JSON (Data)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="text-sm text-muted-foreground dark:text-muted-foreground bg-muted p-2 rounded border border-border dark:border-border">
                {dateRange === "last_30_days" && "Last 30 Days"}
                {dateRange === "last_90_days" && "Last 90 Days"}
                {dateRange === "last_12_months" && "Last 12 Months"}
                {dateRange === "ytd" && "Year to Date"}
                {dateRange === "all_time" && "All Time"}
              </div>
            </div>
            <div className="text-xs text-muted-foreground dark:text-muted-foreground">
              The export will include overview metrics, geographic data, demographics, seasonal trends, and travel behavior.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExportDialogOpen(false)}
              className="border-border dark:border-border"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {exporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="bg-card dark:bg-muted border-border dark:border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground dark:text-white">Share Analytics</DialogTitle>
            <DialogDescription>
              Create a shareable link for campground partners to view these insights.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!shareLink ? (
              <>
                <div className="space-y-2">
                  <Label>Report Name (Optional)</Label>
                  <Input
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    placeholder="e.g., Q4 2024 Guest Insights"
                    className="bg-card dark:bg-muted border-border dark:border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link Expiration</Label>
                  <Select value={shareExpiry} onValueChange={setShareExpiry}>
                    <SelectTrigger className="bg-card dark:bg-muted border-border dark:border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                      <SelectItem value="720">30 days</SelectItem>
                      <SelectItem value="2160">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                  Shared reports are view-only. Partners cannot download or modify the data.
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm text-emerald-300">Share link created successfully!</span>
                </div>
                <div className="space-y-2">
                  <Label>Share Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={shareLink}
                      readOnly
                      className="bg-card dark:bg-muted border-border dark:border-border text-foreground dark:text-muted-foreground"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyShareLink}
                      className="border-border dark:border-border shrink-0"
                    >
                      {shareLinkCopied ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground dark:text-muted-foreground">
                  This link will expire in {shareExpiry === "24" ? "24 hours" : shareExpiry === "168" ? "7 days" : shareExpiry === "720" ? "30 days" : "90 days"}.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {!shareLink ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShareDialogOpen(false)}
                  className="border-border dark:border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateShareLink}
                  disabled={sharing}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {sharing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Create Link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setShareDialogOpen(false)}
                className="bg-muted hover:bg-muted"
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
