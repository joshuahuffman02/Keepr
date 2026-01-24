"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Caravan, Tent, Home, Users, Sparkles, MapPin, type LucideIcon } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { cn } from "@/lib/utils";

type MapLibreGl = typeof import("maplibre-gl");
type MapLibreMap = InstanceType<MapLibreGl["Map"]>;
type MapLibreMarker = InstanceType<MapLibreGl["Marker"]>;

const toLngLat = (lng: number, lat: number): [number, number] => [lng, lat];

// Dynamic import for maplibre-gl to reduce initial bundle size
let maplibregl: MapLibreGl | null = null;

const loadMapLibre = async (): Promise<MapLibreGl> => {
  if (maplibregl) return maplibregl;
  const mapLibreModule = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");
  maplibregl = mapLibreModule;
  return mapLibreModule;
};

export type MapSite = {
  id: string;
  name: string;
  siteNumber: string;
  status: "available" | "occupied" | "maintenance";
  statusDetail?: string | null;
  siteClassName?: string | null;
  siteType?: string | null;
  maxOccupancy?: number;
  latitude?: number | null;
  longitude?: number | null;
  defaultRate?: number | null;
};

type Center = { latitude?: number | null; longitude?: number | null };

export interface BookingMapProps {
  sites: MapSite[];
  campgroundCenter?: Center;
  selectedSiteId?: string;
  onSelectSite?: (siteId: string) => void;
  isLoading?: boolean;
  height?: number | string;
  variant?: "card" | "immersive";
  className?: string;
}

const STATUS_COLORS: Record<MapSite["status"], string> = {
  available: "#059669",
  occupied: "#f59e0b",
  maintenance: "#ef4444",
};

const SITE_TYPE_ICONS: Record<string, LucideIcon> = {
  rv: Caravan,
  tent: Tent,
  cabin: Home,
  group: Users,
  glamping: Sparkles,
};

export function BookingMap({
  sites,
  campgroundCenter,
  selectedSiteId,
  onSelectSite,
  isLoading,
  height,
  variant = "card",
  className,
}: BookingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isMapLibreLoaded, setIsMapLibreLoaded] = useState(false);
  const heightStyle = {
    height: typeof height === "number" ? `${height}px` : (height ?? "420px"),
  };

  useEffect(() => {
    setIsReady(true);
    loadMapLibre().then(() => setIsMapLibreLoaded(true));
  }, []);

  const fallbackCenter = useMemo<[number, number]>(() => {
    const lat = Number.isFinite(campgroundCenter?.latitude)
      ? Number(campgroundCenter?.latitude)
      : 39.8283; // US centroid
    const lng = Number.isFinite(campgroundCenter?.longitude)
      ? Number(campgroundCenter?.longitude)
      : -98.5795;
    return [lng, lat];
  }, [campgroundCenter]);

  const validSites = useMemo(() => {
    const jitter = 0.0004;
    const [fallbackLng, fallbackLat] = fallbackCenter;
    return sites
      .map((site, idx) => {
        const hasLat = Number.isFinite(site.latitude);
        const hasLng = Number.isFinite(site.longitude);
        const lat = hasLat ? Number(site.latitude) : fallbackLat + jitter * Math.sin(idx);
        const lng = hasLng ? Number(site.longitude) : fallbackLng + jitter * Math.cos(idx);
        return { ...site, latitude: lat, longitude: lng };
      })
      .filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
  }, [sites, fallbackCenter]);

  const mapCenter = useMemo(() => {
    if (validSites.length > 0 && selectedSiteId) {
      const selected = validSites.find((s) => s.id === selectedSiteId);
      if (selected) return toLngLat(Number(selected.longitude), Number(selected.latitude));
    }
    if (validSites.length > 0) {
      // average center
      const avgLat = validSites.reduce((acc, s) => acc + (s.latitude || 0), 0) / validSites.length;
      const avgLng = validSites.reduce((acc, s) => acc + (s.longitude || 0), 0) / validSites.length;
      return toLngLat(avgLng, avgLat);
    }
    return fallbackCenter;
  }, [validSites, fallbackCenter, selectedSiteId]);

  useEffect(() => {
    if (
      !isReady ||
      !isMapLibreLoaded ||
      typeof window === "undefined" ||
      !containerRef.current ||
      mapRef.current ||
      !maplibregl
    )
      return;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://demotiles.maplibre.org/style.json",
        center: mapCenter,
        zoom: validSites.length > 0 ? 16 : 3,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      mapRef.current = map;
    } catch (err) {
      console.error("Failed to initialize map:", err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isReady, isMapLibreLoaded, mapCenter, validSites.length]);

  // Handle center updates
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: mapCenter, zoom: selectedSiteId ? 17 : 16, speed: 0.6 });
  }, [mapCenter, selectedSiteId]);

  // Markers update
  useEffect(() => {
    const mapLibre = maplibregl;
    if (!mapRef.current || !isReady || !isMapLibreLoaded || !mapLibre) return;

    const mapInstance = mapRef.current;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    validSites.forEach((site) => {
      const el = document.createElement("button");
      const isSelected = site.id === selectedSiteId;
      const IconComp = SITE_TYPE_ICONS[site.siteType || ""] || MapPin;

      const iconHtml = renderToStaticMarkup(
        <IconComp size={isSelected ? 20 : 16} color="white" strokeWidth={2.5} />,
      );

      el.className = `group relative flex items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500`;
      el.style.width = isSelected ? "32px" : "24px";
      el.style.height = isSelected ? "32px" : "24px";
      el.style.backgroundColor = isSelected ? "#059669" : STATUS_COLORS[site.status];
      el.style.border = isSelected ? "2px solid white" : "1px solid rgba(255,255,255,0.3)";
      el.style.zIndex = isSelected ? "10" : "1";
      el.innerHTML = iconHtml;
      el.title = `${site.siteNumber} • ${site.status}`;

      if (onSelectSite) {
        el.addEventListener("click", () => onSelectSite(site.id));
      }

      const marker = new mapLibre.Marker({ element: el, anchor: "center" })
        .setLngLat([Number(site.longitude), Number(site.latitude)])
        .addTo(mapInstance);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [validSites, onSelectSite, selectedSiteId, isReady, isMapLibreLoaded]);

  if (!isReady || !isMapLibreLoaded) {
    return (
      <div className={className} style={heightStyle}>
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            Loading map library…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        variant === "immersive"
          ? "border-none"
          : "rounded-xl border border-border bg-muted shadow-inner",
        className,
      )}
      style={heightStyle}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70 backdrop-blur-[2px] text-sm font-medium text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            Loading immersive map…
          </div>
        </div>
      )}

      <div className="absolute left-4 bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-xl bg-card/90 backdrop-blur-md px-4 py-2.5 text-xs shadow-xl border border-white/20">
        <span className="font-bold text-foreground uppercase tracking-wider">Park Map</span>
        <div className="h-4 w-px bg-muted" />
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span
            key={status}
            className="flex items-center gap-1.5 font-medium text-muted-foreground capitalize"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            {status}
          </span>
        ))}
      </div>
    </div>
  );
}

export default BookingMap;
