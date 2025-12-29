"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CampgroundMapUpload } from "@/components/campgrounds/CampgroundMapUpload";
import { SiteMapEditor } from "@/components/maps/SiteMapEditor";

export default function CampgroundMapPage() {
  const params = useParams();
  const campgroundId = params?.campgroundId as string;

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });

  const mapQuery = useQuery({
    queryKey: ["campground-map", campgroundId],
    queryFn: () => apiClient.getCampgroundMap(campgroundId, {}),
    enabled: !!campgroundId
  });

  const sitesQuery = useQuery({
    queryKey: ["campground-sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  interface MapLayers {
    baseImageUrl?: string;
    baseImage?: { url?: string };
    background?: { url?: string };
    image?: string;
  }

  const mapBaseImageUrl = useMemo(() => {
    const layers = mapQuery.data?.config?.layers as MapLayers | undefined;
    if (!layers || typeof layers !== "object") return null;
    if (typeof layers.baseImageUrl === "string") return layers.baseImageUrl;
    if (typeof layers.baseImage?.url === "string") return layers.baseImage.url;
    if (typeof layers.background?.url === "string") return layers.background.url;
    if (typeof layers.image === "string") return layers.image;
    return null;
  }, [mapQuery.data?.config?.layers]);

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
            <h1 className="text-2xl font-bold text-slate-900">Site Map</h1>
            <p className="text-sm text-slate-600">
              Upload a map image, draw site boundaries, and assign them to your sites.
            </p>
          </div>
        </div>

        {/* Map Upload */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Map Image</h2>
            <p className="text-xs text-slate-500">
              Upload a satellite image, hand-drawn map, or site plan of your campground.
            </p>
          </div>
          <CampgroundMapUpload
            campgroundId={campgroundId}
            initialUrl={mapBaseImageUrl}
            onUploaded={() => mapQuery.refetch()}
          />
        </div>

        {/* Map Editor */}
        <SiteMapEditor
          campgroundId={campgroundId}
          mapData={mapQuery.data}
          baseImageUrl={mapBaseImageUrl}
          sites={sitesQuery.data ?? []}
          isLoading={mapQuery.isLoading || sitesQuery.isLoading}
          onSaved={() => mapQuery.refetch()}
        />
      </div>
    </DashboardShell>
  );
}
