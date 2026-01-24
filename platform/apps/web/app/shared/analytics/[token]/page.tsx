"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  Truck,
  Baby,
  Dog,
  Lock,
  AlertTriangle,
  Building2,
} from "lucide-react";

interface SharedAnalytics {
  analyticsType: string;
  accessLevel: string;
  dateRange: string;
  name: string | null;
  description: string | null;
  campground: {
    id: string;
    name: string;
    slug: string;
  } | null;
  data: AnalyticsData;
  canDownload: boolean;
}

type ChartDatum = {
  [key: string]: string | number | undefined;
  percentage?: number;
};

type AnalyticsOverview = {
  totalGuests?: number;
  newGuestsThisMonth?: number;
  repeatRate?: number;
  repeatGuests?: number;
  avgStayLength?: number;
};

type AnalyticsGeographic = {
  byCountry?: ChartDatum[];
  byState?: ChartDatum[];
};

type AnalyticsDemographics = {
  rigTypes?: ChartDatum[];
  avgRigLength?: number;
  partyComposition?: { adultsOnly: number; withChildren: number };
  petPercentage?: number;
};

type AnalyticsTravelBehavior = {
  stayReasons?: ChartDatum[];
  bookingSources?: ChartDatum[];
};

type AnalyticsInsight = {
  type?: string;
  title?: string;
  metric?: string;
  description?: string;
};

type AnalyticsData = {
  overview?: AnalyticsOverview;
  geographic?: AnalyticsGeographic;
  demographics?: AnalyticsDemographics;
  travelBehavior?: AnalyticsTravelBehavior;
  insights?: AnalyticsInsight[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const toChartDatum = (value: unknown): ChartDatum | null => {
  if (!isRecord(value)) return null;
  const output: ChartDatum = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === "string" || typeof entry === "number") {
      output[key] = entry;
    }
  });
  return output;
};

const toChartDataArray = (value: unknown): ChartDatum[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.map(toChartDatum).filter((item): item is ChartDatum => item !== null);
};

const toPartyComposition = (
  value: unknown,
): AnalyticsDemographics["partyComposition"] | undefined => {
  if (!isRecord(value)) return undefined;
  const adultsOnly = getNumber(value.adultsOnly);
  const withChildren = getNumber(value.withChildren);
  if (adultsOnly === undefined || withChildren === undefined) return undefined;
  return { adultsOnly, withChildren };
};

const toInsights = (value: unknown): AnalyticsInsight[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.reduce<AnalyticsInsight[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    acc.push({
      type: getString(item.type),
      title: getString(item.title),
      metric: getString(item.metric),
      description: getString(item.description),
    });
    return acc;
  }, []);
};

const toAnalyticsData = (value: unknown): AnalyticsData => {
  if (!isRecord(value)) return {};
  const overview = isRecord(value.overview)
    ? {
        totalGuests: getNumber(value.overview.totalGuests),
        newGuestsThisMonth: getNumber(value.overview.newGuestsThisMonth),
        repeatRate: getNumber(value.overview.repeatRate),
        repeatGuests: getNumber(value.overview.repeatGuests),
        avgStayLength: getNumber(value.overview.avgStayLength),
      }
    : undefined;

  const geographic = isRecord(value.geographic)
    ? {
        byCountry: toChartDataArray(value.geographic.byCountry),
        byState: toChartDataArray(value.geographic.byState),
      }
    : undefined;

  const demographics = isRecord(value.demographics)
    ? {
        rigTypes: toChartDataArray(value.demographics.rigTypes),
        avgRigLength: getNumber(value.demographics.avgRigLength),
        partyComposition: toPartyComposition(value.demographics.partyComposition),
        petPercentage: getNumber(value.demographics.petPercentage),
      }
    : undefined;

  const travelBehavior = isRecord(value.travelBehavior)
    ? {
        stayReasons: toChartDataArray(value.travelBehavior.stayReasons),
        bookingSources: toChartDataArray(value.travelBehavior.bookingSources),
      }
    : undefined;

  return {
    overview,
    geographic,
    demographics,
    travelBehavior,
    insights: toInsights(value.insights),
  };
};

const toCampground = (value: unknown): SharedAnalytics["campground"] => {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const name = getString(value.name);
  const slug = getString(value.slug);
  if (!id || !name || !slug) return null;
  return { id, name, slug };
};

const toSharedAnalytics = (value: unknown): SharedAnalytics | null => {
  if (!isRecord(value)) return null;
  const analyticsType = getString(value.analyticsType);
  const accessLevel = getString(value.accessLevel);
  const dateRange = getString(value.dateRange);
  if (!analyticsType || !accessLevel || !dateRange) return null;
  return {
    analyticsType,
    accessLevel,
    dateRange,
    name: getString(value.name) ?? null,
    description: getString(value.description) ?? null,
    campground: toCampground(value.campground),
    data: toAnalyticsData(value.data),
    canDownload: typeof value.canDownload === "boolean" ? value.canDownload : false,
  };
};

function BarChart({
  data,
  labelKey,
  valueKey,
}: {
  data: ChartDatum[];
  labelKey: string;
  valueKey: string;
}) {
  const values = data.map((item) => {
    const value = item[valueKey];
    return typeof value === "number" ? value : Number(value) || 0;
  });
  const max = Math.max(0, ...values);

  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-24 text-xs text-slate-400 truncate">{item[labelKey] ?? "—"}</div>
          <div className="flex-1 h-6 bg-slate-800 rounded overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded transition-all"
              style={{ width: `${max > 0 ? (Number(item[valueKey]) / max) * 100 : 0}%` }}
            />
          </div>
          <div className="w-16 text-xs text-slate-300 text-right">
            {item.percentage ? `${item.percentage}%` : Number(item[valueKey] ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SharedAnalyticsPage() {
  const params = useParams<{ token?: string }>();
  const token = params.token ?? "";

  const [analytics, setAnalytics] = useState<SharedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchAnalytics = async (pwd?: string) => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const url = new URL(`${apiUrl}/shared/analytics/${token}`);
      if (pwd) {
        url.searchParams.set("password", pwd);
      }

      const res = await fetch(url.toString());

      if (res.status === 400) {
        setRequiresPassword(true);
        setLoading(false);
        return;
      }

      if (res.status === 403) {
        const data = await res.json();
        if (data.message === "Invalid password") {
          setPasswordError("Incorrect password. Please try again.");
          setLoading(false);
          return;
        }
        throw new Error(data.message || "Access denied");
      }

      if (!res.ok) {
        throw new Error("Failed to load shared analytics");
      }

      const data = await res.json();
      const parsed = toSharedAnalytics(data);
      if (!parsed) {
        throw new Error("Invalid analytics payload");
      }
      setAnalytics(parsed);
      setRequiresPassword(false);
    } catch (err) {
      console.error("Failed to fetch shared analytics:", err);
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAnalytics();
    }
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    fetchAnalytics(password);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-4xl p-8">
          <div className="h-8 bg-slate-800 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-slate-900 border-slate-700">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-slate-400" />
            </div>
            <CardTitle className="text-white">Password Required</CardTitle>
            <CardDescription>This shared report is password protected.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-800 border-slate-700"
                />
                {passwordError && <p className="text-sm text-rose-400">{passwordError}</p>}
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700">
                View Report
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <Card className="w-full max-w-md bg-slate-900 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
              <div>
                <h3 className="font-semibold text-rose-200">Unable to Load Report</h3>
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

  const { data } = analytics;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {analytics.campground && (
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/50">
                  <Building2 className="h-3 w-3 mr-1" />
                  {analytics.campground.name}
                </Badge>
              )}
              <Badge variant="outline" className="text-slate-400 border-slate-600">
                {analytics.dateRange === "last_30_days" && "Last 30 Days"}
                {analytics.dateRange === "last_90_days" && "Last 90 Days"}
                {analytics.dateRange === "last_12_months" && "Last 12 Months"}
                {analytics.dateRange === "ytd" && "Year to Date"}
                {analytics.dateRange === "all_time" && "All Time"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {analytics.name || "Guest Analytics Report"}
            </h1>
            {analytics.description && (
              <p className="text-slate-400 mt-1">{analytics.description}</p>
            )}
          </div>
          <div className="text-right text-sm text-slate-500">
            <div>Shared Report</div>
            <div>View Only</div>
          </div>
        </div>

        {/* Overview KPIs */}
        {data.overview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Users className="h-8 w-8 text-emerald-500" />
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/50">
                    Total
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-white">
                    {data.overview.totalGuests?.toLocaleString() || "N/A"}
                  </div>
                  <div className="text-sm text-slate-400">Total Guests</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-white">
                    {data.overview.newGuestsThisMonth?.toLocaleString() || "N/A"}
                  </div>
                  <div className="text-sm text-slate-400">New Guests This Month</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Users className="h-8 w-8 text-amber-500" />
                  <Badge variant="outline" className="text-amber-400 border-amber-400/50">
                    {data.overview.repeatRate || 0}%
                  </Badge>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-white">
                    {data.overview.repeatGuests?.toLocaleString() || "N/A"}
                  </div>
                  <div className="text-sm text-slate-400">Repeat Guests</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Calendar className="h-8 w-8 text-violet-500" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-white">
                    {data.overview.avgStayLength || "N/A"} nights
                  </div>
                  <div className="text-sm text-slate-400">Avg Stay Length</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Geographic */}
          {data.geographic && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-500" />
                  Geographic Origin
                </CardTitle>
                <CardDescription>Where your guests are coming from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.geographic.byCountry && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">By Country</h4>
                    <BarChart
                      data={data.geographic.byCountry}
                      labelKey="country"
                      valueKey="count"
                    />
                  </div>
                )}
                {data.geographic.byState && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">
                      Top States/Provinces
                    </h4>
                    <BarChart
                      data={data.geographic.byState.slice(0, 6)}
                      labelKey="state"
                      valueKey="count"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Demographics */}
          {data.demographics && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-amber-500" />
                  Guest Demographics
                </CardTitle>
                <CardDescription>Equipment types and party composition</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.demographics.rigTypes && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">RV/Equipment Types</h4>
                    <BarChart data={data.demographics.rigTypes} labelKey="type" valueKey="count" />
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                  <div className="text-center">
                    <div className="text-xl font-bold text-white">
                      {data.demographics.avgRigLength || "N/A"}ft
                    </div>
                    <div className="text-xs text-slate-400">Avg RV Length</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white flex items-center justify-center gap-1">
                      <Baby className="h-4 w-4 text-blue-400" />
                      {data.demographics.partyComposition
                        ? (
                            (data.demographics.partyComposition.withChildren /
                              (data.demographics.partyComposition.adultsOnly +
                                data.demographics.partyComposition.withChildren)) *
                            100
                          ).toFixed(0)
                        : "N/A"}
                      %
                    </div>
                    <div className="text-xs text-slate-400">With Children</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-white flex items-center justify-center gap-1">
                      <Dog className="h-4 w-4 text-amber-400" />
                      {data.demographics.petPercentage || "N/A"}%
                    </div>
                    <div className="text-xs text-slate-400">With Pets</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Travel Behavior */}
          {data.travelBehavior && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-violet-500" />
                  Travel Behavior
                </CardTitle>
                <CardDescription>Why and how guests book</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {data.travelBehavior.stayReasons && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Stay Reasons</h4>
                    <BarChart
                      data={data.travelBehavior.stayReasons.slice(0, 5)}
                      labelKey="reason"
                      valueKey="count"
                    />
                  </div>
                )}
                {data.travelBehavior.bookingSources && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-3">Booking Sources</h4>
                    <BarChart
                      data={data.travelBehavior.bookingSources.slice(0, 5)}
                      labelKey="source"
                      valueKey="count"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Insights */}
          {data.insights && data.insights.length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg border ${
                        insight.type === "warning"
                          ? "bg-amber-900/20 border-amber-700/50"
                          : insight.type === "success"
                            ? "bg-emerald-900/20 border-emerald-700/50"
                            : "bg-slate-700/30 border-slate-600/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm text-white">{insight.title}</span>
                        {insight.metric && (
                          <Badge variant="outline" className="text-xs">
                            {insight.metric}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{insight.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 pt-8 border-t border-slate-800">
          <p>
            Powered by <span className="text-emerald-500 font-semibold">CampReserv</span>
          </p>
          <p className="mt-1">
            This is a shared view-only report. Contact the sender for access to full analytics.
          </p>
        </div>
      </div>
    </div>
  );
}
