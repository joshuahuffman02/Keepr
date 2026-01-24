"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { resolvePoints, RawPoint } from "./heatmap-utils";

type GeoJSONFeature = {
  type: "Feature";
  properties: {
    weight: number;
    normalized: number;
    label: string;
  };
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
};

type GeoJSONFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

type GeoJSONSource = {
  setData: (data: GeoJSONFeatureCollection) => void;
};

type MapLibreGl = typeof import("maplibre-gl");
type MapLibreMap = InstanceType<MapLibreGl["Map"]>;

// Dynamic import for maplibre-gl to reduce initial bundle size
let maplibregl: MapLibreGl | null = null;

const loadMapLibre = async (): Promise<MapLibreGl> => {
  if (maplibregl) return maplibregl;
  const mapLibreModule = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");
  maplibregl = mapLibreModule;
  return mapLibreModule;
};

type HeatmapCardProps = {
  title: string;
  subtitle?: string;
  points: RawPoint[];
  center: { latitude: number; longitude: number };
  maxValue?: number;
  isLoading?: boolean;
};

export function HeatmapCard({
  title,
  subtitle,
  points,
  center,
  maxValue,
  isLoading,
}: HeatmapCardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isMapLibreLoaded, setIsMapLibreLoaded] = useState(false);

  useEffect(() => {
    loadMapLibre().then(() => setIsMapLibreLoaded(true));
  }, []);

  const resolvedPoints = useMemo(() => resolvePoints(points, center), [points, center]);
  const data = useMemo<GeoJSONFeatureCollection>(() => {
    const max = maxValue ?? Math.max(...resolvedPoints.map((p) => p.value), 1);
    return {
      type: "FeatureCollection",
      features: resolvedPoints.map((p) => ({
        type: "Feature",
        properties: {
          weight: p.value,
          normalized: max > 0 ? p.value / max : 0,
          label: p.label || p.id,
        },
        geometry: {
          type: "Point",
          coordinates: [p.longitude, p.latitude],
        },
      })),
    };
  }, [resolvedPoints, maxValue]);

  useEffect(() => {
    if (
      !isMapLibreLoaded ||
      typeof window === "undefined" ||
      !containerRef.current ||
      mapRef.current ||
      !maplibregl
    )
      return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [center.longitude, center.latitude],
      zoom: 14,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;
  }, [isMapLibreLoaded, center]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const existingSource = map.getSource("heatmap");
    const hasSetData = (value: unknown): value is GeoJSONSource =>
      typeof value === "object" && value !== null && "setData" in value;
    if (existingSource && hasSetData(existingSource)) {
      existingSource.setData(data);
    } else {
      map.addSource("heatmap", {
        type: "geojson",
        data,
      });
      map.addLayer({
        id: "heatmap-layer",
        type: "heatmap",
        source: "heatmap",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, maxValue ?? 1, 1],
          "heatmap-intensity": 1.1,
          "heatmap-radius": 28,
          "heatmap-opacity": 0.8,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(15, 118, 110, 0)",
            0.2,
            "rgba(16, 185, 129, 0.35)",
            0.4,
            "rgba(5, 150, 105, 0.55)",
            0.6,
            "rgba(59, 130, 246, 0.65)",
            0.8,
            "rgba(37, 99, 235, 0.8)",
            1,
            "rgba(30, 64, 175, 0.9)",
          ],
        },
      });
      map.addLayer({
        id: "heatmap-points",
        type: "circle",
        source: "heatmap",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "normalized"], 0, 3, 1, 14],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "normalized"],
            0,
            "#a7f3d0",
            0.5,
            "#34d399",
            1,
            "#0f766e",
          ],
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 0.6,
          "circle-opacity": 0.85,
        },
      });
    }
  }, [data, maxValue]);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Hotspots</span>
          <div className="flex h-3 w-16 overflow-hidden rounded-full">
            <div className="flex-1 bg-status-info" />
          </div>
        </div>
      </div>
      <div className="relative h-[360px] w-full overflow-hidden rounded-lg border border-border bg-muted">
        <div ref={containerRef} className="absolute inset-0" />
        {(isLoading || !isMapLibreLoaded) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 text-sm text-muted-foreground">
            {!isMapLibreLoaded ? "Loading map library…" : "Loading heatmap…"}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        Higher density indicates higher utilization/revenue. Circles show top individual sites.
      </div>
    </div>
  );
}
