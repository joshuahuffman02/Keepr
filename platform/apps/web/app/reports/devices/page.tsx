"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { Smartphone, Monitor, Tablet, TrendingUp, Users, ShoppingCart, Percent } from "lucide-react";

type DeviceData = {
  deviceType: string;
  sessions: number;
  bookings: number;
  conversionRate: number;
};

type TrendData = {
  date: string;
  deviceType: string;
  sessions: number;
};

type DeviceReport = {
  period: { days: number; since: string };
  devices: DeviceData[];
  trends: TrendData[];
};

export default function DeviceAnalyticsPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [days, setDays] = useState("30");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    if (stored) setCampgroundId(stored);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["device-analytics", campgroundId, days],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/reports/devices?campgroundId=${campgroundId}&days=${days}`, {
        headers: { "Content-Type": "application/json" }
      });
      if (!res.ok) throw new Error("Failed to fetch device analytics");
      return res.json() as Promise<DeviceReport>;
    },
    enabled: !!campgroundId
  });

  const getDeviceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-8 h-8" />;
      case "desktop":
        return <Monitor className="w-8 h-8" />;
      case "tablet":
        return <Tablet className="w-8 h-8" />;
      default:
        return <Monitor className="w-8 h-8" />;
    }
  };

  const getDeviceColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case "mobile":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "desktop":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "tablet":
        return "bg-purple-50 text-purple-700 border-purple-200";
      default:
        return "bg-muted text-foreground border-border";
    }
  };

  const totalSessions = data?.devices?.reduce((sum, d) => sum + d.sessions, 0) || 0;
  const totalBookings = data?.devices?.reduce((sum, d) => sum + d.bookings, 0) || 0;
  const overallConversion = totalSessions > 0 ? ((totalBookings / totalSessions) * 100).toFixed(1) : "0";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Reports", href: "/reports" },
            { label: "Device Analytics" }
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Device Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Understand how guests access your booking page across devices
            </p>
          </div>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!campgroundId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Select a campground to view device analytics.</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-red-600">Failed to load device analytics</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Sessions</p>
                      <p className="text-2xl font-bold text-foreground">{totalSessions.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <ShoppingCart className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bookings</p>
                      <p className="text-2xl font-bold text-emerald-600">{totalBookings.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Percent className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversion Rate</p>
                      <p className="text-2xl font-bold text-blue-600">{overallConversion}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Device Types</p>
                      <p className="text-2xl font-bold text-purple-600">{data?.devices?.length || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Device Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
                <CardDescription>Sessions and bookings by device type</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.devices && data.devices.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.devices.map((device) => {
                      const percentage = totalSessions > 0 ? ((device.sessions / totalSessions) * 100).toFixed(1) : "0";
                      return (
                        <div
                          key={device.deviceType}
                          className={`rounded-xl border p-6 ${getDeviceColor(device.deviceType)}`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            {getDeviceIcon(device.deviceType)}
                            <span className="text-2xl font-bold">{percentage}%</span>
                          </div>
                          <h3 className="text-lg font-semibold capitalize mb-3">
                            {device.deviceType || "Unknown"}
                          </h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="opacity-70">Sessions</span>
                              <span className="font-semibold">{device.sessions.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="opacity-70">Bookings</span>
                              <span className="font-semibold">{device.bookings.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-current/20">
                              <span className="opacity-70">Conversion</span>
                              <span className="font-bold">{device.conversionRate}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No device data available for this period.</p>
                )}
              </CardContent>
            </Card>

            {/* Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>Recommendations based on your device analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.devices && data.devices.length > 0 && (
                    <>
                      {(() => {
                        const mobile = data.devices.find(d => d.deviceType?.toLowerCase() === "mobile");
                        const desktop = data.devices.find(d => d.deviceType?.toLowerCase() === "desktop");
                        const mobileShare = mobile && totalSessions > 0 ? (mobile.sessions / totalSessions) * 100 : 0;

                        const insights = [];

                        if (mobileShare > 50) {
                          insights.push({
                            type: "info",
                            title: "Mobile-First Audience",
                            description: `${mobileShare.toFixed(0)}% of your visitors are on mobile. Ensure your booking flow is optimized for small screens.`
                          });
                        }

                        if (mobile && desktop && mobile.conversionRate < desktop.conversionRate * 0.7) {
                          insights.push({
                            type: "warning",
                            title: "Mobile Conversion Gap",
                            description: `Mobile converts at ${mobile.conversionRate}% vs desktop at ${desktop.conversionRate}%. Consider simplifying the mobile booking experience.`
                          });
                        }

                        if (desktop && desktop.conversionRate > 40) {
                          insights.push({
                            type: "success",
                            title: "Strong Desktop Performance",
                            description: `Desktop conversion rate of ${desktop.conversionRate}% is excellent. Desktop users are highly engaged.`
                          });
                        }

                        if (insights.length === 0) {
                          insights.push({
                            type: "info",
                            title: "Balanced Device Usage",
                            description: "Your visitors are well-distributed across devices with consistent conversion rates."
                          });
                        }

                        return insights.map((insight, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg p-4 ${
                              insight.type === "warning"
                                ? "bg-amber-50 border border-amber-200"
                                : insight.type === "success"
                                  ? "bg-emerald-50 border border-emerald-200"
                                  : "bg-blue-50 border border-blue-200"
                            }`}
                          >
                            <h4 className={`font-semibold ${
                              insight.type === "warning"
                                ? "text-amber-800"
                                : insight.type === "success"
                                  ? "text-emerald-800"
                                  : "text-blue-800"
                            }`}>
                              {insight.title}
                            </h4>
                            <p className={`text-sm mt-1 ${
                              insight.type === "warning"
                                ? "text-amber-700"
                                : insight.type === "success"
                                  ? "text-emerald-700"
                                  : "text-blue-700"
                            }`}>
                              {insight.description}
                            </p>
                          </div>
                        ));
                      })()}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
