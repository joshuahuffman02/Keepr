"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../../components/breadcrumbs";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

export default function SiteClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campgroundId = params.campgroundId as string;
  const classId = params.classId as string;

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizonIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const classQuery = useQuery({
    queryKey: ["site-class", classId],
    queryFn: () => apiClient.getSiteClass(classId),
    enabled: !!classId
  });

  const sitesQuery = useQuery({
    queryKey: ["campground-sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  const statusQuery = useQuery({
    queryKey: ["site-class-status", classId, todayIso, horizonIso],
    queryFn: () =>
      apiClient.getSitesWithStatus(campgroundId, {
        arrivalDate: todayIso,
        departureDate: horizonIso
      }),
    enabled: !!campgroundId && !!classId
  });

  const reservationsQuery = useQuery({
    queryKey: ["campground-reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId
  });

  const pricingRulesQuery = useQuery({
    queryKey: ["pricing-rules", campgroundId],
    queryFn: () => apiClient.getPricingRules(campgroundId),
    enabled: !!campgroundId
  });

  const auditLogsQuery = useQuery({
    queryKey: ["audit-logs", campgroundId],
    queryFn: () => apiClient.getAuditLogs(campgroundId, { limit: 50 }),
    enabled: !!campgroundId
  });

  const classActivity = useMemo(() => {
    const logs = auditLogsQuery.data || [];
    return logs.filter((log: any) => log.entityId === classId).slice(0, 6);
  }, [auditLogsQuery.data, classId]);

  if (classQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="flex h-80 items-center justify-center text-slate-600">Loading class…</div>
      </DashboardShell>
    );
  }

  const siteClass = classQuery.data;

  if (!siteClass) {
    return (
      <DashboardShell>
        <div className="flex h-80 flex-col items-center justify-center gap-4 text-slate-600">
          <div>Site class not found</div>
          <Button onClick={() => router.push(`/campgrounds/${campgroundId}/classes`)}>Back to classes</Button>
        </div>
      </DashboardShell>
    );
  }

  const sitesInClass = (sitesQuery.data || []).filter((s) => s.siteClassId === classId);
  const statusBySite = Object.fromEntries((statusQuery.data || []).map((s) => [s.id, s]));
  const photoList = (siteClass.photos || []).filter(Boolean);

  const upcomingReservations = (reservationsQuery.data || [])
    .filter((res: any) => {
      const resClassId =
        res.siteClassId || res.site?.siteClassId || res.site?.siteClass?.id || res.site?.siteClass?.siteClassId;
      return resClassId === classId && new Date(res.departureDate) >= new Date();
    })
    .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())
    .slice(0, 6);

  const classPricingRules = (pricingRulesQuery.data || []).filter(
    (rule: any) => !rule.siteClassId || rule.siteClassId === classId
  );

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Site Classes", href: `/campgrounds/${campgroundId}/classes` },
            { label: siteClass.name }
          ]}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{siteClass.name}</h1>
              <div className="text-sm text-slate-500">{siteClass.siteType} • Max {siteClass.maxOccupancy}</div>
            </div>
          </div>
          <Badge variant={siteClass.isActive ? "default" : "outline"}>{siteClass.isActive ? "Active" : "Inactive"}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {photoList.length === 0 && <div className="text-xs text-slate-500">No photos for this class.</div>}
              {photoList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photoList.map((url) => (
                    <div key={url} className="relative h-24 w-full overflow-hidden rounded border border-slate-200 bg-slate-50">
                      <img src={url} alt="Class photo" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500">Default rate</div>
                <div className="font-medium">${((siteClass.defaultRate ?? 0) / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Rig max length</div>
                <div className="font-medium">{siteClass.rigMaxLength ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Min nights</div>
                <div className="font-medium">{siteClass.minNights ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Max nights</div>
                <div className="font-medium">{siteClass.maxNights ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pet friendly</div>
                <div className="font-medium">{siteClass.petFriendly ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Accessible</div>
                <div className="font-medium">{siteClass.accessible ? "Yes" : "No"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Policy version</span>
                <span className="font-medium">{siteClass.policyVersion || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>GL Code</span>
                <span className="font-medium">{(siteClass as any).glCode || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Client account</span>
                <span className="font-medium">{(siteClass as any).clientAccount || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sites in this class</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {sitesQuery.isLoading && <div className="text-xs text-slate-500">Loading sites…</div>}
              {sitesQuery.isError && <div className="text-xs text-red-500">Failed to load sites</div>}
              {statusQuery.isError && <div className="text-xs text-red-500">Failed to load availability</div>}
              {sitesInClass.length === 0 && !sitesQuery.isLoading && (
                <div className="text-xs text-slate-500">No sites assigned to this class.</div>
              )}
              {sitesInClass.map((s) => {
                const status = statusBySite[s.id];
                return (
                  <div key={s.id} className="rounded border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {s.name || `Site #${s.siteNumber}`}
                      </div>
                      {status ? (
                        <Badge variant={status.status === "available" ? "outline" : "default"} className="capitalize">
                          {status.status}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </div>
                    {status?.statusDetail && <div className="text-xs text-slate-500">{status.statusDetail}</div>}
                    <div className="text-xs text-slate-500">
                      Window: {todayIso} → {horizonIso}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming reservations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reservationsQuery.isLoading && <div className="text-xs text-slate-500">Loading reservations…</div>}
              {reservationsQuery.isError && <div className="text-xs text-red-500">Failed to load reservations</div>}
              {upcomingReservations.length === 0 && !reservationsQuery.isLoading && (
                <div className="text-xs text-slate-500">No upcoming stays for this class.</div>
              )}
              {upcomingReservations.map((res) => (
                <div key={res.id} className="rounded border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      {res.guest ? `${res.guest.primaryFirstName} ${res.guest.primaryLastName}` : "Guest"}
                    </div>
                    <Badge variant="outline" className="capitalize">{res.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="text-xs text-slate-500">
                    {res.arrivalDate} → {res.departureDate}
                  </div>
                  {res.site && <div className="text-xs text-slate-500">Site: {res.site.name || `#${res.site.siteNumber}`}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pricing rules affecting this class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pricingRulesQuery.isLoading && <div className="text-xs text-slate-500">Loading pricing rules…</div>}
            {pricingRulesQuery.isError && <div className="text-xs text-red-500">Failed to load pricing rules</div>}
            {classPricingRules.length === 0 && !pricingRulesQuery.isLoading && (
              <div className="text-xs text-slate-500">No class-specific rules. Defaults apply.</div>
            )}
            {classPricingRules.slice(0, 6).map((rule) => (
              <div key={rule.id} className="rounded border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{rule.label || rule.ruleType}</span>
                  <Badge variant={rule.isActive ? "outline" : "secondary"} className="capitalize">
                    {rule.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600">
                  {rule.ruleType === "flat" && rule.flatAdjust != null && `Flat ${rule.flatAdjust / 100 >= 0 ? "+" : "-"}$${Math.abs(rule.flatAdjust / 100).toFixed(2)}`}
                  {rule.ruleType === "percent" && rule.percentAdjust != null && `${rule.percentAdjust}% adjustment`}
                  {rule.ruleType === "seasonal" && `Seasonal ${rule.startDate} → ${rule.endDate || "open"}`}
                  {rule.ruleType === "dow" && rule.dayOfWeek != null && `Day ${rule.dayOfWeek} adjust`}
                </div>
                {(rule.startDate || rule.endDate) && (
                  <div className="text-xs text-slate-500">
                    Window: {rule.startDate || "any"} → {rule.endDate || "open"}
                  </div>
                )}
                {rule.minNights && (
                  <div className="text-xs text-slate-500">Min nights: {rule.minNights}</div>
                )}
              </div>
            ))}
            {classPricingRules.length > 6 && (
              <div className="text-xs text-slate-500">+ {classPricingRules.length - 6} more rules apply.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {auditLogsQuery.isLoading && <div className="text-xs text-slate-500">Loading…</div>}
            {auditLogsQuery.isError && <div className="text-xs text-red-500">Failed to load activity</div>}
            {classActivity.length === 0 && !auditLogsQuery.isLoading && (
              <div className="text-xs text-slate-500">No recent changes to this class.</div>
            )}
            {classActivity.map((log: any) => (
              <div key={log.id} className="rounded border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
                {log.actor?.email && <div className="text-xs text-slate-500">By {log.actor.email}</div>}
                {log.after && <div className="text-xs text-slate-500 line-clamp-2">Updated</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

