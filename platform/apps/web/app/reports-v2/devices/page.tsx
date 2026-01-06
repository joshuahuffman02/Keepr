"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportSection, ReportStatGrid } from "@/components/reports-v2/ReportPanels";
import { ReportsV2Shell } from "@/components/reports-v2/ReportsV2Shell";
import { ReportsV2PageHeader } from "@/components/reports-v2/ReportsV2PageHeader";
import { listSavedReports, type SavedReport } from "@/components/reports/savedReports";
import { Smartphone, Monitor, Tablet } from "lucide-react";

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

export default function ReportsV2DevicesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [days, setDays] = useState("30");
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(stored);
    setSavedReports(listSavedReports(stored));
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

  const totals = useMemo(() => {
    const sessions = data?.devices?.reduce((sum, d) => sum + d.sessions, 0) || 0;
    const bookings = data?.devices?.reduce((sum, d) => sum + d.bookings, 0) || 0;
    const conversion = sessions > 0 ? ((bookings / sessions) * 100).toFixed(1) : "0";
    return { sessions, bookings, conversion };
  }, [data]);

  return (
    <DashboardShell>
      <div className="space-y-5">
        <Breadcrumbs items={[{ label: "Reports v2", href: "/reports-v2" }, { label: "Devices" }]} />
        <ReportsV2Shell activeTab={null} activeSubTab={null} activeShortcut="devices" pinnedReports={savedReports.filter((r) => r.pinned)}>
          <ReportsV2PageHeader
            title="Device analytics"
            description="Understand how guests reach your booking flow across devices."
            actions={
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger className="w-36" aria-label="Time range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            }
          />

          {!campgroundId && (
            <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm text-status-warning">
              Select a campground from the sidebar to load device analytics.
            </div>
          )}

          {campgroundId && (
            <>
              <ReportStatGrid
                stats={[
                  { label: "Total sessions", value: totals.sessions.toLocaleString(), helper: `Last ${days} days` },
                  { label: "Bookings", value: totals.bookings.toLocaleString() },
                  { label: "Conversion", value: `${totals.conversion}%` },
                  { label: "Device types", value: `${data?.devices?.length || 0}` }
                ]}
              />

              <ReportSection
                title="Device mix"
                description="Sessions and bookings split by device type."
              >
                {isLoading && <div className="text-sm text-muted-foreground">Loading device analytics...</div>}
                {error && <div className="text-sm text-status-error">Unable to load device analytics.</div>}
                {!isLoading && !error && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {(data?.devices || []).map((device) => {
                      const Icon = device.deviceType === "mobile" ? Smartphone : device.deviceType === "tablet" ? Tablet : Monitor;
                      const share = totals.sessions > 0 ? ((device.sessions / totals.sessions) * 100).toFixed(1) : "0";
                      return (
                        <div key={device.deviceType} className="rounded-2xl border border-border bg-card px-4 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                              <div className="text-sm font-semibold text-foreground capitalize">{device.deviceType || "Unknown"}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{share}% of sessions</div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-muted-foreground">Sessions</div>
                              <div className="text-lg font-semibold text-foreground">{device.sessions}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Bookings</div>
                              <div className="text-lg font-semibold text-foreground">{device.bookings}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Conversion</div>
                              <div className="text-lg font-semibold text-foreground">{(device.conversionRate * 100).toFixed(1)}%</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ReportSection>
            </>
          )}
        </ReportsV2Shell>
      </div>
    </DashboardShell>
  );
}
