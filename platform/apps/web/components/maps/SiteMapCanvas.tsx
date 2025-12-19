"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type MapConfig = {
  bounds?: any;
  defaultCenter?: any;
  defaultZoom?: number | null;
  layers?: any;
  legend?: any;
};

type MapSite = {
  siteId: string;
  name?: string | null;
  siteNumber?: string | null;
  geometry?: any;
  centroid?: any;
  label?: string | null;
  rotation?: number | null;
  status?: string | null;
  conflicts?: Array<{ type?: string }>;
};

type SiteMapData = {
  config?: MapConfig | null;
  sites: MapSite[];
};

type SiteMapCanvasProps = {
  map?: SiteMapData | null;
  selectedSiteId?: string;
  onSelectSite?: (siteId: string) => void;
  showLabels?: boolean;
  isLoading?: boolean;
  className?: string;
};

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };
type Shape =
  | { kind: "polygon"; points: Point[] }
  | { kind: "rect"; rect: Rect }
  | { kind: "point"; point: Point };

const STATUS_THEME: Record<string, { fill: string; stroke: string; text: string }> = {
  available: { fill: "#ecfdf5", stroke: "#10b981", text: "#047857" },
  occupied: { fill: "#fffbeb", stroke: "#f59e0b", text: "#b45309" },
  maintenance: { fill: "#fee2e2", stroke: "#ef4444", text: "#b91c1c" },
  default: { fill: "#f1f5f9", stroke: "#94a3b8", text: "#475569" }
};

const asNumber = (value: any) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return Number.NaN;
};

const isNumber = (value: any) => Number.isFinite(asNumber(value));

const normalizePoint = (value: any): Point | null => {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2 && isNumber(value[0]) && isNumber(value[1])) {
    return { x: Number(value[0]), y: Number(value[1]) };
  }
  if (typeof value === "object") {
    const x = value.x ?? value.lng ?? value.longitude;
    const y = value.y ?? value.lat ?? value.latitude;
    if (isNumber(x) && isNumber(y)) {
      return { x: Number(x), y: Number(y) };
    }
  }
  return null;
};

const extractPoints = (geometry: any): Point[] => {
  if (!geometry) return [];
  if (Array.isArray(geometry)) {
    return geometry.map(normalizePoint).filter(Boolean) as Point[];
  }
  if (geometry.type === "Polygon" && Array.isArray(geometry.coordinates?.[0])) {
    return geometry.coordinates[0].map(normalizePoint).filter(Boolean) as Point[];
  }
  if (geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates?.[0]?.[0])) {
    return geometry.coordinates[0][0].map(normalizePoint).filter(Boolean) as Point[];
  }
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.map(normalizePoint).filter(Boolean) as Point[];
  }
  if (Array.isArray(geometry.points)) {
    return geometry.points.map(normalizePoint).filter(Boolean) as Point[];
  }
  if (Array.isArray(geometry.coords)) {
    return geometry.coords.map(normalizePoint).filter(Boolean) as Point[];
  }
  return [];
};

const extractRect = (geometry: any): Rect | null => {
  if (!geometry || typeof geometry !== "object") return null;
  const x = geometry.x ?? geometry.left ?? geometry.minX;
  const y = geometry.y ?? geometry.top ?? geometry.minY;
  const width = geometry.width ?? (isNumber(geometry.right) && isNumber(x) ? Number(geometry.right) - Number(x) : null);
  const height = geometry.height ?? (isNumber(geometry.bottom) && isNumber(y) ? Number(geometry.bottom) - Number(y) : null);
  if (isNumber(x) && isNumber(y) && isNumber(width) && isNumber(height)) {
    return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
  }
  return null;
};

const extractCentroid = (centroid: any, fallback?: Shape): Point | null => {
  const direct = normalizePoint(centroid);
  if (direct) return direct;
  if (!fallback) return null;
  if (fallback.kind === "point") return fallback.point;
  if (fallback.kind === "rect") {
    return { x: fallback.rect.x + fallback.rect.width / 2, y: fallback.rect.y + fallback.rect.height / 2 };
  }
  if (fallback.kind === "polygon" && fallback.points.length) {
    const sum = fallback.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / fallback.points.length, y: sum.y / fallback.points.length };
  }
  return null;
};

const shapeToPath = (points: Point[]) =>
  points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

const getBoundsFromConfig = (bounds: any): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  if (!bounds) return null;
  if (Array.isArray(bounds) && bounds.length >= 4 && bounds.every(isNumber)) {
    return { minX: Number(bounds[0]), minY: Number(bounds[1]), maxX: Number(bounds[2]), maxY: Number(bounds[3]) };
  }
  const minX = bounds.minX ?? bounds.left ?? bounds.x;
  const minY = bounds.minY ?? bounds.top ?? bounds.y;
  const maxX = bounds.maxX ?? bounds.right ?? (isNumber(bounds.width) && isNumber(bounds.x) ? Number(bounds.x) + Number(bounds.width) : null);
  const maxY = bounds.maxY ?? bounds.bottom ?? (isNumber(bounds.height) && isNumber(bounds.y) ? Number(bounds.y) + Number(bounds.height) : null);
  if (isNumber(minX) && isNumber(minY) && isNumber(maxX) && isNumber(maxY)) {
    return { minX: Number(minX), minY: Number(minY), maxX: Number(maxX), maxY: Number(maxY) };
  }
  return null;
};

const getBaseImageUrl = (layers: any) => {
  if (!layers || typeof layers !== "object") return null;
  if (typeof layers.baseImageUrl === "string") return layers.baseImageUrl;
  if (typeof layers.baseImage?.url === "string") return layers.baseImage.url;
  if (typeof layers.background?.url === "string") return layers.background.url;
  if (typeof layers.image === "string") return layers.image;
  return null;
};

export function SiteMapCanvas({
  map,
  selectedSiteId,
  onSelectSite,
  showLabels = true,
  isLoading,
  className
}: SiteMapCanvasProps) {
  const { shapes, bounds, baseImageUrl } = useMemo(() => {
    const sites = map?.sites ?? [];
    const rawBounds = getBoundsFromConfig(map?.config?.bounds);
    const shapeEntries = sites.map((site) => {
      const rect = extractRect(site.geometry);
      const points = rect ? [] : extractPoints(site.geometry);
      const shape: Shape | null = rect
        ? { kind: "rect", rect }
        : points.length > 1
          ? { kind: "polygon", points }
          : points.length === 1
            ? { kind: "point", point: points[0] }
            : null;
      const centroid = extractCentroid(site.centroid, shape ?? undefined);
      return { site, shape, centroid };
    });

    const computed = shapeEntries.reduce(
      (acc, entry) => {
        if (entry.shape?.kind === "rect") {
          const rect = entry.shape.rect;
          acc.minX = Math.min(acc.minX, rect.x);
          acc.minY = Math.min(acc.minY, rect.y);
          acc.maxX = Math.max(acc.maxX, rect.x + rect.width);
          acc.maxY = Math.max(acc.maxY, rect.y + rect.height);
        } else if (entry.shape?.kind === "polygon") {
          entry.shape.points.forEach((pt) => {
            acc.minX = Math.min(acc.minX, pt.x);
            acc.minY = Math.min(acc.minY, pt.y);
            acc.maxX = Math.max(acc.maxX, pt.x);
            acc.maxY = Math.max(acc.maxY, pt.y);
          });
        } else if (entry.centroid) {
          acc.minX = Math.min(acc.minX, entry.centroid.x);
          acc.minY = Math.min(acc.minY, entry.centroid.y);
          acc.maxX = Math.max(acc.maxX, entry.centroid.x);
          acc.maxY = Math.max(acc.maxY, entry.centroid.y);
        }
        return acc;
      },
      { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
    );

    const resolvedBounds = rawBounds ?? (Number.isFinite(computed.minX) ? computed : null);
    const baseImage = getBaseImageUrl(map?.config?.layers);
    return { shapes: shapeEntries, bounds: resolvedBounds, baseImageUrl: baseImage };
  }, [map]);

  if (isLoading) {
    return (
      <div className={cn("h-[420px] w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100", className)} />
    );
  }

  if (!map) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500", className)}>
        Map data unavailable.
      </div>
    );
  }

  const hasShapes = shapes.some((entry) => entry.shape);
  if (!hasShapes && !baseImageUrl) {
    return (
      <div className={cn("rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500", className)}>
        Upload a map or add site layout geometry to preview the park map.
      </div>
    );
  }

  const viewBox = (() => {
    const fallback = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const resolved = bounds ?? fallback;
    const width = resolved.maxX - resolved.minX || 100;
    const height = resolved.maxY - resolved.minY || 100;
    const pad = Math.max(width, height) * 0.05;
    return {
      minX: resolved.minX - pad,
      minY: resolved.minY - pad,
      width: width + pad * 2,
      height: height + pad * 2
    };
  })();

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-3", className)}>
      <svg
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        className="h-[420px] w-full"
        role="img"
        aria-label="Campground site map"
      >
        {baseImageUrl && (
          <image
            href={baseImageUrl}
            x={viewBox.minX}
            y={viewBox.minY}
            width={viewBox.width}
            height={viewBox.height}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.95}
          />
        )}

        {shapes.map(({ site, shape, centroid }) => {
          if (!shape) return null;
          const rawStatus = site.status ?? "available";
          const statusKey = rawStatus in STATUS_THEME ? rawStatus : "default";
          const theme = STATUS_THEME[statusKey];
          const isSelected = selectedSiteId === site.siteId;
          const hasConflicts = (site.conflicts?.length ?? 0) > 0;
          const label = site.label || site.siteNumber || site.name || site.siteId;
          const labelPos = centroid ?? extractCentroid(undefined, shape);

          const commonProps = {
            fill: theme.fill,
            stroke: theme.stroke,
            strokeWidth: isSelected ? 2.4 : 1.4,
            strokeDasharray: hasConflicts ? "4 2" : undefined,
            onClick: onSelectSite ? () => onSelectSite(site.siteId) : undefined,
            style: onSelectSite ? { cursor: "pointer" } : undefined
          };

          return (
            <g key={site.siteId}>
              {shape.kind === "rect" && (
                <rect
                  x={shape.rect.x}
                  y={shape.rect.y}
                  width={shape.rect.width}
                  height={shape.rect.height}
                  rx={2}
                  {...commonProps}
                >
                  <title>{`${label} • ${rawStatus}`}</title>
                </rect>
              )}
              {shape.kind === "polygon" && (
                <path d={shapeToPath(shape.points)} {...commonProps}>
                  <title>{`${label} • ${rawStatus}`}</title>
                </path>
              )}
              {shape.kind === "point" && (
                <circle cx={shape.point.x} cy={shape.point.y} r={3.5} {...commonProps}>
                  <title>{`${label} • ${rawStatus}`}</title>
                </circle>
              )}
              {showLabels && labelPos && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={theme.text}
                  fontSize="6"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {Object.entries(STATUS_THEME)
          .filter(([key]) => key !== "default")
          .map(([key, theme]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.stroke }} />
              {key}
            </span>
          ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-slate-400 border-dashed" />
          conflicts
        </span>
      </div>
    </div>
  );
}
