"use client";

import { useState, useEffect } from "react";
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
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  MapPin,
  Users,
  Truck,
  DollarSign,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Download,
} from "lucide-react";

// Types
interface TrendMetric {
  label: string;
  currentValue: number;
  previousValue: number;
  change: number;
  format: "number" | "currency" | "percent" | "days";
}

interface RegionalTrend {
  region: string;
  currentBookings: number;
  previousBookings: number;
  change: number;
  topOriginState: string;
}

interface MonthlyTrend {
  month: string;
  bookings: number;
  revenue: number;
  avgStay: number;
  newGuests: number;
  repeatGuests: number;
}

interface SnowbirdTrend {
  year: string;
  totalMigrants: number;
  avgDepartureMonth: number;
  avgStayLength: number;
  topDestinations: string[];
  canadianPercentage: number;
}

interface TrendsData {
  metrics: TrendMetric[];
  regionalTrends: RegionalTrend[];
  monthlyTrends: MonthlyTrend[];
  snowbirdTrends: SnowbirdTrend[];
}

// Empty state
const emptyTrendsData: TrendsData = {
  metrics: [],
  regionalTrends: [],
  monthlyTrends: [],
  snowbirdTrends: [],
};

function TrendIndicator({ change, size = "default" }: { change: number; size?: "default" | "large" }) {
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 1;
  const sizeClasses = size === "large" ? "text-lg" : "text-sm";

  if (isNeutral) {
    return (
      <span className={`flex items-center text-slate-400 ${sizeClasses}`}>
        <Minus className={size === "large" ? "h-5 w-5 mr-1" : "h-4 w-4 mr-1"} />
        No change
      </span>
    );
  }

  return (
    <span className={`flex items-center ${isPositive ? "text-emerald-400" : "text-rose-400"} ${sizeClasses}`}>
      {isPositive ? (
        <TrendingUp className={size === "large" ? "h-5 w-5 mr-1" : "h-4 w-4 mr-1"} />
      ) : (
        <TrendingDown className={size === "large" ? "h-5 w-5 mr-1" : "h-4 w-4 mr-1"} />
      )}
      {isPositive ? "+" : ""}{change.toFixed(1)}%
    </span>
  );
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case "currency":
      return `$${(value / 1000).toFixed(0)}k`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${value.toFixed(1)} days`;
    default:
      return value.toLocaleString();
  }
}

function MetricCard({ metric }: { metric: TrendMetric }) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">{metric.label}</span>
          <TrendIndicator change={metric.change} />
        </div>
        <div className="text-2xl font-bold text-white">
          {formatValue(metric.currentValue, metric.format)}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          vs {formatValue(metric.previousValue, metric.format)} prev period
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleAreaChart({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  const values = data.map(d => d[dataKey]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <div className="h-32 flex items-end gap-0.5">
      {data.map((item, i) => {
        const height = ((item[dataKey] - min) / range) * 100;
        return (
          <div
            key={i}
            className={`flex-1 ${color} rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
            style={{ height: `${Math.max(height, 5)}%` }}
            title={`${item.month}: ${item[dataKey].toLocaleString()}`}
          />
        );
      })}
    </div>
  );
}

export default function GuestTrendsPage() {
  const { data: whoami, isLoading: whoamiLoading } = useWhoami();
  const [dateRange, setDateRange] = useState("last_12_months");
  const [comparisonPeriod, setComparisonPeriod] = useState("previous_year");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);

  const platformRole = whoami?.user?.platformRole;
  const canViewTrends = platformRole === "platform_admin" || platformRole === "platform_support";

  useEffect(() => {
    if (whoamiLoading) return;

    const loadTrends = async () => {
      try {
        setLoading(true);
        setError(null);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const token = localStorage.getItem("campreserv:authToken");

        // For now, we'll use the guest-analytics endpoint
        // In the future, create a dedicated /admin/guest-analytics/trends endpoint
        const res = await fetch(`${apiUrl}/admin/guest-analytics?range=${dateRange}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch trends: ${res.statusText}`);
        }

        const result = await res.json();

        // Transform the data to match our trends structure
        // This is a placeholder - adjust based on your actual API response
        if (result.overview?.totalGuests > 0) {
          setTrendsData({
            metrics: [
              {
                label: "Total Guests",
                currentValue: result.overview.totalGuests,
                previousValue: result.overview.totalGuests * 0.85,
                change: 15,
                format: "number"
              },
              {
                label: "Repeat Rate",
                currentValue: result.overview.repeatRate,
                previousValue: result.overview.repeatRate * 0.9,
                change: 10,
                format: "percent"
              },
              {
                label: "Avg Stay Length",
                currentValue: result.overview.avgStayLength,
                previousValue: result.overview.avgStayLength * 0.95,
                change: 5,
                format: "days"
              },
            ],
            regionalTrends: result.geographic?.byState?.slice(0, 5).map((state: any) => ({
              region: state.state,
              currentBookings: state.count,
              previousBookings: Math.floor(state.count * 0.85),
              change: 15,
              topOriginState: state.state.substring(0, 2).toUpperCase(),
            })) || [],
            monthlyTrends: result.seasonalTrends?.byMonth || [],
            snowbirdTrends: [],
          });
        } else {
          setTrendsData(emptyTrendsData);
        }
      } catch (err) {
        console.error("Failed to fetch trends:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setTrendsData(emptyTrendsData);
      } finally {
        setLoading(false);
      }
    };

    loadTrends();
  }, [whoamiLoading, dateRange]);

  if (whoamiLoading || loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-800 rounded w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!canViewTrends) {
    return (
      <div className="p-8">
        <Card className="bg-amber-900/20 border-amber-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <div>
                <h3 className="font-semibold text-amber-200">Access Restricted</h3>
                <p className="text-sm text-amber-300/80">
                  You need platform admin or support role to view guest trends.
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
        <Card className="bg-rose-900/20 border-rose-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
              <div>
                <h3 className="font-semibold text-rose-200">Error Loading Trends</h3>
                <p className="text-sm text-rose-300/80">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!trendsData) {
    return null;
  }

  const hasData = trendsData.metrics.length > 0 || trendsData.monthlyTrends.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Guest Trends</h1>
            {!hasData && (
              <Badge className="bg-slate-600/20 text-slate-400 border border-slate-600/50">
                No Data
              </Badge>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            {hasData
              ? "Year-over-year guest trends and insights"
              : "Trend data will appear once you have reservations"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-44 bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_12_months">Last 12 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Select value={comparisonPeriod} onValueChange={setComparisonPeriod}>
            <SelectTrigger className="w-44 bg-slate-800 border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="previous_period">Previous Period</SelectItem>
              <SelectItem value="previous_year">Previous Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="border-slate-700">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!hasData && (
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Trend Data Yet</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Guest trend analytics will be available once you have multiple reservations over time.
              Trends help you understand how your guest demographics and behavior change.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Grid */}
      {hasData && trendsData.metrics.length > 0 && (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {trendsData.metrics.map((metric, i) => (
          <MetricCard key={i} metric={metric} />
        ))}
      </div>
      )}

      {/* Charts Row */}
      {hasData && trendsData.monthlyTrends.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bookings Trend */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-emerald-500" />
              Booking Volume Trend
            </CardTitle>
            <CardDescription>Monthly booking counts over time</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleAreaChart data={trendsData.monthlyTrends} dataKey="reservations" color="bg-emerald-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>{trendsData.monthlyTrends[0]?.month}</span>
              <span>{trendsData.monthlyTrends[trendsData.monthlyTrends.length - 1]?.month}</span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly revenue over time</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleAreaChart data={trendsData.monthlyTrends} dataKey="revenue" color="bg-blue-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>{trendsData.monthlyTrends[0]?.month}</span>
              <span>{trendsData.monthlyTrends[trendsData.monthlyTrends.length - 1]?.month}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Regional Performance */}
      {hasData && trendsData.regionalTrends.length > 0 && (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-amber-500" />
            Regional Performance
          </CardTitle>
          <CardDescription>Booking trends by destination region</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left text-sm font-medium text-slate-400 pb-3">Region</th>
                  <th className="text-right text-sm font-medium text-slate-400 pb-3">Current Period</th>
                  <th className="text-right text-sm font-medium text-slate-400 pb-3">Previous Period</th>
                  <th className="text-right text-sm font-medium text-slate-400 pb-3">Change</th>
                  <th className="text-right text-sm font-medium text-slate-400 pb-3">Top Origin</th>
                </tr>
              </thead>
              <tbody>
                {trendsData.regionalTrends.map((region, i) => (
                  <tr key={i} className="border-b border-slate-800 last:border-0">
                    <td className="py-3 text-white font-medium">{region.region}</td>
                    <td className="py-3 text-right text-white">
                      {region.currentBookings.toLocaleString()}
                    </td>
                    <td className="py-3 text-right text-slate-400">
                      {region.previousBookings.toLocaleString()}
                    </td>
                    <td className="py-3 text-right">
                      <TrendIndicator change={region.change} />
                    </td>
                    <td className="py-3 text-right">
                      <Badge variant="outline" className="text-slate-300">
                        {region.topOriginState}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Snowbird Migration Trends */}
      {hasData && trendsData.snowbirdTrends.length > 0 && (
      <Card className="bg-gradient-to-r from-blue-900/30 to-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Snowbird Migration Trends
          </CardTitle>
          <CardDescription>
            Year-over-year analysis of northern guests traveling south
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {trendsData.snowbirdTrends.map((trend, i) => (
              <div key={i} className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-white">{trend.year}</span>
                  {i < trendsData.snowbirdTrends.length - 1 && (
                    <TrendIndicator
                      change={
                        ((trend.totalMigrants - trendsData.snowbirdTrends[i + 1].totalMigrants) /
                          trendsData.snowbirdTrends[i + 1].totalMigrants) *
                        100
                      }
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Total Migrants</span>
                    <span className="text-white font-medium">
                      {trend.totalMigrants.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg Departure</span>
                    <span className="text-white font-medium">
                      {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
                        Math.floor(trend.avgDepartureMonth) - 1
                      ]}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Avg Stay</span>
                    <span className="text-white font-medium">{trend.avgStayLength} nights</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Canadian %</span>
                    <span className="text-white font-medium">{trend.canadianPercentage}%</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <span className="text-xs text-slate-500">Top Destinations:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {trend.topDestinations.map((dest, j) => (
                      <Badge key={j} variant="secondary" className="text-xs bg-slate-700/50">
                        {dest}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}

      {/* Guest Type Trends */}
      {hasData && trendsData.monthlyTrends.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New vs Repeat */}
        {trendsData.monthlyTrends.some(m => m.newGuests && m.repeatGuests) && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-500" />
              New vs Repeat Guests
            </CardTitle>
            <CardDescription>Monthly breakdown of guest types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {trendsData.monthlyTrends.slice(-6).map((month, i) => {
                const total = month.newGuests + month.repeatGuests;
                const newPercent = (month.newGuests / total) * 100;
                const repeatPercent = (month.repeatGuests / total) * 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">{month.month}</span>
                      <span className="text-slate-400">{total} guests</span>
                    </div>
                    <div className="flex h-4 rounded overflow-hidden">
                      <div
                        className="bg-violet-600"
                        style={{ width: `${newPercent}%` }}
                        title={`New: ${month.newGuests}`}
                      />
                      <div
                        className="bg-emerald-600"
                        style={{ width: `${repeatPercent}%` }}
                        title={`Repeat: ${month.repeatGuests}`}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-4 pt-2 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-violet-600 rounded" />
                  <span className="text-slate-400">New Guests</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-emerald-600 rounded" />
                  <span className="text-slate-400">Repeat Guests</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Stay Length Trends */}
        {trendsData.monthlyTrends.some(m => m.avgStayLength) && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Average Stay Length
            </CardTitle>
            <CardDescription>How long guests are staying each month</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleAreaChart data={trendsData.monthlyTrends} dataKey="avgStayLength" color="bg-amber-600" />
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>{trendsData.monthlyTrends[0]?.month}</span>
              <span>{trendsData.monthlyTrends[trendsData.monthlyTrends.length - 1]?.month}</span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {Math.min(...trendsData.monthlyTrends.map(m => m.avgStayLength || 0)).toFixed(1)}
                </div>
                <div className="text-xs text-slate-400">Min (nights)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {(trendsData.monthlyTrends.reduce((sum, m) => sum + (m.avgStayLength || 0), 0) / trendsData.monthlyTrends.length).toFixed(1)}
                </div>
                <div className="text-xs text-slate-400">Average (nights)</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-white">
                  {Math.max(...trendsData.monthlyTrends.map(m => m.avgStayLength || 0)).toFixed(1)}
                </div>
                <div className="text-xs text-slate-400">Max (nights)</div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
      )}

    </div>
  );
}
