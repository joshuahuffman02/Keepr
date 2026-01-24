"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "../../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "../../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../../components/ui/card";
import { Badge } from "../../../../../components/ui/badge";
import { Button } from "../../../../../components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campgroundParam = params.campgroundId;
  const siteParam = params.siteId;
  const campgroundId = typeof campgroundParam === "string" ? campgroundParam : "";
  const siteId = typeof siteParam === "string" ? siteParam : "";

  const todayIso = new Date().toISOString().slice(0, 10);
  const horizonIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const siteQuery = useQuery({
    queryKey: ["site", siteId],
    queryFn: () => apiClient.getSite(siteId),
    enabled: !!siteId,
  });

  const reservationsQuery = useQuery({
    queryKey: ["campground-reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId,
  });

  const statusQuery = useQuery({
    queryKey: ["site-status", siteId, todayIso, horizonIso],
    queryFn: () =>
      apiClient.getSitesWithStatus(campgroundId, {
        arrivalDate: todayIso,
        departureDate: horizonIso,
      }),
    enabled: !!campgroundId && !!siteId,
  });

  const maintenanceQuery = useQuery({
    queryKey: ["maintenance", campgroundId],
    queryFn: () => apiClient.getMaintenanceTickets("open", campgroundId),
    enabled: !!campgroundId,
  });

  const blackoutQuery = useQuery({
    queryKey: ["blackouts", campgroundId],
    queryFn: () => apiClient.getBlackouts(campgroundId),
    enabled: !!campgroundId,
  });

  if (siteQuery.isLoading) {
    return (
      <DashboardShell>
        <div className="flex h-80 items-center justify-center text-muted-foreground">
          Loading site…
        </div>
      </DashboardShell>
    );
  }

  const site = siteQuery.data;

  if (!site) {
    return (
      <DashboardShell>
        <div className="flex h-80 flex-col items-center justify-center gap-4 text-muted-foreground">
          <div>Site not found</div>
          <Button onClick={() => router.push(`/campgrounds/${campgroundId}/sites`)}>
            Back to sites
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const upcomingReservations = (reservationsQuery.data || [])
    .filter((res) => res.siteId === siteId && new Date(res.departureDate) >= new Date())
    .sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime())
    .slice(0, 6);

  const status = statusQuery.data?.find((s) => s.id === siteId);

  const openMaintenance = (maintenanceQuery.data || [])
    .filter((m) => m.siteId === siteId)
    .slice(0, 5);

  const relevantBlackouts = (blackoutQuery.data || [])
    .filter((b) => b.siteId === siteId || b.siteId === null)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  const photoList = (site.photos || []).filter(Boolean);

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Sites", href: `/campgrounds/${campgroundId}/sites` },
            { label: site.name || site.siteNumber },
          ]}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              aria-label="Back to sites"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {site.name || `Site #${site.siteNumber}`}
              </h1>
              <div className="text-sm text-muted-foreground">
                #{site.siteNumber} • {site.siteType}
              </div>
            </div>
          </div>
          <Badge variant={site.isActive ? "default" : "outline"}>
            {site.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Attributes</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Max occupancy</div>
                <div className="font-medium">{site.maxOccupancy}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Rig max length</div>
                <div className="font-medium">{site.rigMaxLength ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Power</div>
                <div className="font-medium">{site.hookupsPower ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Water</div>
                <div className="font-medium">{site.hookupsWater ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Sewer</div>
                <div className="font-medium">{site.hookupsSewer ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Pet friendly</div>
                <div className="font-medium">{site.petFriendly ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Accessible</div>
                <div className="font-medium">{site.accessible ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Min nights</div>
                <div className="font-medium">{site.minNights ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Max nights</div>
                <div className="font-medium">{site.maxNights ?? "—"}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Class & Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Class</span>
                <span className="font-medium">{site.siteClassId || "Unassigned"}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Pricing follows the assigned class and campground rules.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Photos</CardTitle>
            </CardHeader>
            <CardContent>
              {photoList.length === 0 && (
                <div className="text-xs text-muted-foreground">No photos for this site.</div>
              )}
              {photoList.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {photoList.map((url) => (
                    <div
                      key={url}
                      className="relative h-24 w-full overflow-hidden rounded border border-border bg-muted"
                    >
                      <img src={url} alt="Site photo" className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Availability (next 14 days)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {statusQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Checking…</div>
              )}
              {statusQuery.isError && (
                <div className="text-xs text-red-500">Failed to load status</div>
              )}
              {!status && !statusQuery.isLoading && !statusQuery.isError && (
                <div className="text-xs text-muted-foreground">No status data.</div>
              )}
              {status && (
                <div className="rounded border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold capitalize">{status.status}</span>
                    {status.statusDetail && (
                      <span className="text-xs text-muted-foreground">{status.statusDetail}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Window: {todayIso} → {horizonIso}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming reservations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {reservationsQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Loading…</div>
              )}
              {reservationsQuery.isError && (
                <div className="text-xs text-red-500">Failed to load</div>
              )}
              {upcomingReservations.length === 0 && !reservationsQuery.isLoading && (
                <div className="text-xs text-muted-foreground">No upcoming stays on this site.</div>
              )}
              {upcomingReservations.map((res) => (
                <div key={res.id} className="rounded border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {res.guest
                        ? `${res.guest.primaryFirstName} ${res.guest.primaryLastName}`
                        : "Guest"}
                    </span>
                    <Badge variant="outline" className="capitalize">
                      {res.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {res.arrivalDate} → {res.departureDate}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Open maintenance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {maintenanceQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Loading…</div>
              )}
              {maintenanceQuery.isError && (
                <div className="text-xs text-red-500">Failed to load maintenance</div>
              )}
              {openMaintenance.length === 0 && !maintenanceQuery.isLoading && (
                <div className="text-xs text-muted-foreground">No open tickets for this site.</div>
              )}
              {openMaintenance.map((m) => (
                <div key={m.id} className="rounded border border-border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.title}</span>
                    <Badge variant="outline" className="capitalize">
                      {m.priority}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{m.status}</div>
                  {m.dueDate && (
                    <div className="text-xs text-muted-foreground">Due {m.dueDate}</div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blackouts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {blackoutQuery.isLoading && (
                <div className="text-xs text-muted-foreground">Loading…</div>
              )}
              {blackoutQuery.isError && (
                <div className="text-xs text-red-500">Failed to load blackouts</div>
              )}
              {relevantBlackouts.length === 0 && !blackoutQuery.isLoading && (
                <div className="text-xs text-muted-foreground">
                  No blackout dates affecting this site.
                </div>
              )}
              {relevantBlackouts.map((b) => (
                <div key={b.id} className="rounded border border-border px-3 py-2">
                  <div className="font-medium text-foreground">
                    {b.startDate} → {b.endDate}
                  </div>
                  {b.reason && <div className="text-xs text-muted-foreground">{b.reason}</div>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
