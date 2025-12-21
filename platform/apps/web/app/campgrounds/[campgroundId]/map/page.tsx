"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CampgroundMapUpload } from "@/components/campgrounds/CampgroundMapUpload";
import { SiteMapCanvas } from "@/components/maps/SiteMapCanvas";
import { SiteMapEditor } from "@/components/maps/SiteMapEditor";

export default function CampgroundMapPage() {
  const params = useParams();
  const campgroundId = params?.campgroundId as string;

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rigLength, setRigLength] = useState("");
  const [rigWidth, setRigWidth] = useState("");
  const [rigHeight, setRigHeight] = useState("");
  const [needsAda, setNeedsAda] = useState(false);
  const [amenitiesInput, setAmenitiesInput] = useState("");
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });

  const mapQuery = useQuery({
    queryKey: ["campground-map", campgroundId, startDate, endDate],
    queryFn: () =>
      apiClient.getCampgroundMap(campgroundId, {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }),
    enabled: !!campgroundId
  });

  const sitesQuery = useQuery({
    queryKey: ["campground-sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  const previewMutation = useMutation({
    mutationFn: (payload: any) => apiClient.previewAssignments(campgroundId, payload)
  });

  const mapBaseImageUrl = useMemo(() => {
    const layers = mapQuery.data?.config?.layers as any;
    if (!layers || typeof layers !== "object") return null;
    if (typeof layers.baseImageUrl === "string") return layers.baseImageUrl;
    if (typeof layers.baseImage?.url === "string") return layers.baseImage.url;
    if (typeof layers.background?.url === "string") return layers.background.url;
    if (typeof layers.image === "string") return layers.image;
    return null;
  }, [mapQuery.data?.config?.layers]);

  const mapSites = mapQuery.data?.sites ?? [];
  const adaCount = useMemo(() => mapSites.filter((s) => s.ada).length, [mapSites]);
  const conflictSites = useMemo(() => mapSites.filter((s) => (s.conflicts?.length ?? 0) > 0).length, [mapSites]);
  const siteLabelById = useMemo(() => {
    const map = new Map<string, string>();
    mapSites.forEach((s) => {
      map.set(s.siteId, s.label || s.name || s.siteNumber || s.siteId);
    });
    return map;
  }, [mapSites]);

  const handlePreviewEligibility = () => {
    if (!campgroundId) return;
    if (!startDate || !endDate) {
      setPreviewMessage("Select start and end dates to preview eligibility.");
      return;
    }
    setPreviewMessage(null);
    const requiredAmenities = amenitiesInput
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    previewMutation.mutate({
      startDate,
      endDate,
      rig: {
        length: rigLength ? Number(rigLength) : undefined,
        width: rigWidth ? Number(rigWidth) : undefined,
        height: rigHeight ? Number(rigHeight) : undefined
      },
      needsADA: needsAda,
      requiredAmenities,
      partySize: undefined
    });
  };

  const campgroundName = campgroundQuery.data?.name ?? "Campground";

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundName, href: `/campgrounds/${campgroundId}` },
            { label: "Site Map" }
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Site map & assignments</h1>
            <p className="text-sm text-slate-600">
              Upload the map, draw site boundaries, and preview eligibility with conflicts.
            </p>
          </div>
        </div>

        <Card className="p-6 space-y-6">
          <div className="grid gap-6">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="start-date">Arrival date</Label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-date">Departure date</Label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label>Rig size (ft/in)</Label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Length"
                    value={rigLength}
                    onChange={(e) => setRigLength(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Width"
                    value={rigWidth}
                    onChange={(e) => setRigWidth(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Height"
                    value={rigHeight}
                    onChange={(e) => setRigHeight(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="needs-ada" checked={needsAda} onCheckedChange={setNeedsAda} />
                <Label htmlFor="needs-ada">ADA required</Label>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amenities">Required amenities (comma separated)</Label>
                <input
                  id="amenities"
                  type="text"
                  placeholder="power,sewer,water"
                  value={amenitiesInput}
                  onChange={(e) => setAmenitiesInput(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handlePreviewEligibility} disabled={previewMutation.isPending}>
                  {previewMutation.isPending ? "Checking..." : "Preview eligibility"}
                </Button>
                {previewMessage && <span className="text-sm text-amber-700">{previewMessage}</span>}
              </div>
              <div className="text-sm text-slate-700">
                {mapQuery.isLoading && <p>Loading map...</p>}
                {mapQuery.isError && <p className="text-red-600">Failed to load map.</p>}
                {mapQuery.data && (
                  <div className="space-y-1">
                    <p>
                      Sites loaded: <strong>{mapSites.length}</strong>{" "}
                      {adaCount ? `• ADA: ${adaCount}` : ""}{" "}
                      {conflictSites ? `• Conflicts: ${conflictSites}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {mapSites.slice(0, 12).map((s) => (
                        <Badge key={s.siteId} variant={s.ada ? "default" : "secondary"}>
                          {s.label || s.name}
                        </Badge>
                      ))}
                      {mapSites.length > 12 && <span className="text-xs text-slate-500">+ more</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">Site map preview</div>
                <p className="text-xs text-slate-500">
                  Upload a base map image and review layout geometry + conflicts.
                </p>
              </div>
              <CampgroundMapUpload
                campgroundId={campgroundId}
                initialUrl={mapBaseImageUrl}
                onUploaded={() => mapQuery.refetch()}
              />
              <SiteMapCanvas
                map={mapQuery.data}
                isLoading={mapQuery.isLoading}
                showLabels
                height={640}
              />
              {mapQuery.isError && (
                <p className="text-xs text-rose-600">Failed to load map preview.</p>
              )}
            </div>
          </div>

          <SiteMapEditor
            campgroundId={campgroundId}
            mapData={mapQuery.data}
            baseImageUrl={mapBaseImageUrl}
            sites={sitesQuery.data ?? []}
            isLoading={mapQuery.isLoading || sitesQuery.isLoading}
            onSaved={() => mapQuery.refetch()}
            className="w-full"
            autoFullscreen
          />

          <div className="grid gap-2">
            <Label>Eligibility preview</Label>
            {previewMutation.isPending && <p className="text-sm text-slate-600">Checking...</p>}
            {!previewMutation.data && !previewMutation.isPending && (
              <p className="text-sm text-slate-600">Set dates and run preview to see eligible sites.</p>
            )}
            {previewMutation.data && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-700">
                    Eligible ({previewMutation.data.eligible.length})
                  </p>
                  <div className="space-y-1 max-h-48 overflow-auto pr-1">
                    {previewMutation.data.eligible.map((row) => (
                      <div key={row.siteId} className="rounded border border-green-100 bg-green-50 px-3 py-2">
                        <div className="flex items-center justify-between text-sm font-medium text-green-800">
                          <span>{siteLabelById.get(row.siteId) ?? row.siteId}</span>
                          <span>{row.reasons?.length ? "With notes" : "Clear"}</span>
                        </div>
                        {row.conflicts?.length ? (
                          <p className="text-xs text-amber-700">
                            Conflicts present: {row.conflicts.map((c) => c.type).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-700">
                    Ineligible ({previewMutation.data.ineligible.length})
                  </p>
                  <div className="space-y-1 max-h-48 overflow-auto pr-1">
                    {previewMutation.data.ineligible.map((row) => (
                      <div key={row.siteId} className="rounded border border-red-100 bg-red-50 px-3 py-2">
                        <div className="flex items-center justify-between text-sm font-medium text-red-800">
                          <span>{siteLabelById.get(row.siteId) ?? row.siteId}</span>
                          <span>{row.reasons.join(", ")}</span>
                        </div>
                        {row.conflicts?.length ? (
                          <p className="text-xs text-amber-700">
                            Conflicts: {row.conflicts.map((c) => c.type).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
