"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cn } from "@/lib/utils";
import {
  Tent,
  MapPin,
  Search,
  Filter,
  X,
  Star,
  Navigation,
  Loader2,
  Trees,
  Waves,
  Mountain,
  Sun,
  ChevronRight,
  Locate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Dynamic import for maplibre-gl
let maplibregl: any = null;
let MapLibreMap: any = null;
let NavigationControl: any = null;
let Marker: any = null;
let Popup: any = null;

const loadMapLibre = async () => {
  if (!maplibregl) {
    const mapLibreModule = await import("maplibre-gl");
    await import("maplibre-gl/dist/maplibre-gl.css");
    maplibregl = mapLibreModule.default;
    MapLibreMap = mapLibreModule.Map;
    NavigationControl = mapLibreModule.NavigationControl;
    Marker = mapLibreModule.Marker;
    Popup = mapLibreModule.Popup;
  }
  return { maplibregl, MapLibreMap, NavigationControl, Marker, Popup };
};

// Free tile style - OpenFreeMap (no API key needed)
const FREE_MAP_STYLE = {
  version: 8,
  name: "OpenFreeMap Positron",
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export type SearchableCampground = {
  id: string;
  name: string;
  slug?: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  rating?: number;
  reviewCount?: number;
  priceFrom?: number;
  imageUrl?: string;
  amenities?: string[];
  siteTypes?: string[];
  isOpen?: boolean;
};

export interface CampgroundSearchMapProps {
  campgrounds: SearchableCampground[];
  onSelectCampground?: (campground: SearchableCampground) => void;
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
  showSearch?: boolean;
  showFilters?: boolean;
  showUserLocation?: boolean;
  height?: string | number;
  className?: string;
}

const AMENITY_ICONS: Record<string, any> = {
  lake: Waves,
  river: Waves,
  beach: Waves,
  mountain: Mountain,
  forest: Trees,
  sunny: Sun,
};

// Cluster colors based on count
function getClusterColor(count: number): string {
  if (count < 10) return "#10b981"; // emerald-500
  if (count < 50) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

// HTML escape function to prevent XSS in map popups
const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;")
     .replace(/'/g, "&#039;");

export function CampgroundSearchMap({
  campgrounds,
  onSelectCampground,
  onBoundsChange,
  initialCenter = [-98.5795, 39.8283], // US center
  initialZoom = 4,
  showSearch = true,
  showFilters = true,
  showUserLocation = true,
  height = "600px",
  className,
}: CampgroundSearchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const popupRef = useRef<any>(null);

  const [isMapReady, setIsMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampground, setSelectedCampground] = useState<SearchableCampground | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [visibleCampgrounds, setVisibleCampgrounds] = useState<SearchableCampground[]>([]);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  // Filter campgrounds
  const filteredCampgrounds = useMemo(() => {
    let result = campgrounds;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.city?.toLowerCase().includes(query) ||
          c.state?.toLowerCase().includes(query)
      );
    }

    if (activeFilters.length > 0) {
      result = result.filter((c) =>
        activeFilters.some((filter) => c.amenities?.includes(filter) || c.siteTypes?.includes(filter))
      );
    }

    return result;
  }, [campgrounds, searchQuery, activeFilters]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let isMounted = true;

    loadMapLibre().then(({ MapLibreMap: MapClass, NavigationControl: NavControl }) => {
      if (!isMounted || !containerRef.current) return;

      try {
        const map = new MapClass({
          container: containerRef.current,
          style: FREE_MAP_STYLE as any,
          center: initialCenter,
          zoom: initialZoom,
          attributionControl: true,
        });

        map.addControl(new NavControl(), "top-right");

        map.on("error", (e: any) => {
          console.error("MapLibre error:", e);
        });

        map.on("load", () => {
          if (isMounted) {
            setIsMapReady(true);
            mapRef.current = map;
          }
        });

        map.on("moveend", () => {
          if (onBoundsChange) {
            const bounds = map.getBounds();
            onBoundsChange({
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest(),
            });
          }

          // Update visible campgrounds
          const bounds = map.getBounds();
          const visible = filteredCampgrounds.filter(
            (c) =>
              c.latitude >= bounds.getSouth() &&
              c.latitude <= bounds.getNorth() &&
              c.longitude >= bounds.getWest() &&
              c.longitude <= bounds.getEast()
          );
          setVisibleCampgrounds(visible);
        });
      } catch (err) {
        console.error("Failed to initialize map:", err);
      }
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when campgrounds change
  useEffect(() => {
    if (!mapRef.current || !isMapReady) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Create clusters manually (simple grid-based clustering)
    const zoom = mapRef.current.getZoom();
    const shouldCluster = zoom < 10;

    if (shouldCluster) {
      // Simple grid clustering
      const gridSize = 2; // degrees
      const clusters = new Map<string, { lat: number; lng: number; campgrounds: SearchableCampground[] }>();

      filteredCampgrounds.forEach((c) => {
        const gridX = Math.floor(c.longitude / gridSize);
        const gridY = Math.floor(c.latitude / gridSize);
        const key = `${gridX},${gridY}`;

        if (!clusters.has(key)) {
          clusters.set(key, { lat: 0, lng: 0, campgrounds: [] });
        }
        const cluster = clusters.get(key)!;
        cluster.campgrounds.push(c);
        cluster.lat += c.latitude;
        cluster.lng += c.longitude;
      });

      clusters.forEach((cluster) => {
        const count = cluster.campgrounds.length;
        const avgLat = cluster.lat / count;
        const avgLng = cluster.lng / count;

        const el = document.createElement("div");
        el.className = "flex items-center justify-center rounded-full shadow-lg cursor-pointer transition-transform hover:scale-110";
        el.style.width = count > 50 ? "48px" : count > 10 ? "40px" : "32px";
        el.style.height = count > 50 ? "48px" : count > 10 ? "40px" : "32px";
        el.style.backgroundColor = getClusterColor(count);
        el.style.color = "white";
        el.style.fontWeight = "bold";
        el.style.fontSize = count > 50 ? "14px" : "12px";
        el.style.border = "2px solid white";
        el.textContent = count > 99 ? "99+" : String(count);

        el.addEventListener("click", () => {
          mapRef.current?.flyTo({
            center: [avgLng, avgLat],
            zoom: mapRef.current.getZoom() + 2,
          });
        });

        const marker = new Marker({ element: el })
          .setLngLat([avgLng, avgLat])
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    } else {
      // Individual markers
      filteredCampgrounds.forEach((campground) => {
        const el = document.createElement("button");
        const isSelected = selectedCampground?.id === campground.id;

        el.className = cn(
          "flex items-center justify-center rounded-full shadow-lg transition-all cursor-pointer",
          "hover:scale-125 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        );
        el.style.width = isSelected ? "40px" : "32px";
        el.style.height = isSelected ? "40px" : "32px";
        el.style.backgroundColor = isSelected ? "#059669" : "#10b981";
        el.style.border = isSelected ? "3px solid white" : "2px solid white";
        el.style.zIndex = isSelected ? "10" : "1";

        const iconHtml = renderToStaticMarkup(
          <Tent size={isSelected ? 20 : 16} color="white" strokeWidth={2.5} />
        );
        el.innerHTML = iconHtml;

        el.addEventListener("click", () => {
          setSelectedCampground(campground);
          onSelectCampground?.(campground);

          // Show popup
          if (popupRef.current) {
            popupRef.current.remove();
          }

          const popupContent = `
            <div class="p-3 min-w-[200px]">
              <h3 class="font-bold text-foreground">${escapeHtml(campground.name)}</h3>
              ${campground.city && campground.state ? `<p class="text-sm text-muted-foreground">${escapeHtml(campground.city)}, ${escapeHtml(campground.state)}</p>` : ""}
              ${campground.rating ? `<div class="flex items-center gap-1 mt-1"><span class="text-amber-500">&#9733;</span><span class="text-sm font-medium">${campground.rating.toFixed(1)}</span><span class="text-xs text-muted-foreground">(${campground.reviewCount || 0})</span></div>` : ""}
              ${campground.priceFrom ? `<p class="text-sm font-medium text-emerald-600 mt-1">From $${campground.priceFrom}/night</p>` : ""}
            </div>
          `;

          popupRef.current = new maplibregl.Popup({ offset: 25, closeButton: true })
            .setLngLat([campground.longitude, campground.latitude])
            .setHTML(popupContent)
            .addTo(mapRef.current);
        });

        const marker = new Marker({ element: el })
          .setLngLat([campground.longitude, campground.latitude])
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    }

    // Trigger initial visible campgrounds update
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      const visible = filteredCampgrounds.filter(
        (c) =>
          c.latitude >= bounds.getSouth() &&
          c.latitude <= bounds.getNorth() &&
          c.longitude >= bounds.getWest() &&
          c.longitude <= bounds.getEast()
      );
      setVisibleCampgrounds(visible);
    }
  }, [filteredCampgrounds, isMapReady, selectedCampground, onSelectCampground]);

  // Get user location
  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([longitude, latitude]);
        setIsLocating(false);

        if (mapRef.current) {
          // Add user marker
          const el = document.createElement("div");
          el.className = "w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse";

          new Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(mapRef.current);

          mapRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 10,
          });
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLocating(false);
      }
    );
  }, []);

  // Search handler with geocoding
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !mapRef.current) return;

    // Use Nominatim (free OSM geocoder)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=us`
      );
      const results = await response.json();

      if (results.length > 0) {
        const { lat, lon } = results[0];
        mapRef.current.flyTo({
          center: [parseFloat(lon), parseFloat(lat)],
          zoom: 10,
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
  }, [searchQuery]);

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  return (
    <div className={cn("relative", className)} style={{ height: heightStyle }}>
      {/* Map container */}
      <div ref={containerRef} className="absolute inset-0 rounded-xl overflow-hidden" />

      {/* Loading overlay */}
      {!isMapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-xl">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading map...</span>
          </div>
        </div>
      )}

      {/* Search bar */}
      {showSearch && (
        <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
          <div className="flex-1 flex gap-2 bg-card rounded-lg shadow-lg p-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search campgrounds, cities, or states..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <Button size="sm" onClick={handleSearch}>
              Search
            </Button>
          </div>

          {showUserLocation && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleLocateUser}
              disabled={isLocating}
              className="bg-card shadow-lg"
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Locate className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="absolute top-20 left-4 z-10">
          <div className="flex flex-wrap gap-2 bg-card/90 backdrop-blur-sm rounded-lg shadow-lg p-2">
            {["rv", "tent", "cabin", "glamping", "lake", "mountain", "forest"].map((filter) => (
              <Badge
                key={filter}
                variant={activeFilters.includes(filter) ? "default" : "outline"}
                className={cn(
                  "cursor-pointer capitalize transition-colors",
                  activeFilters.includes(filter)
                    ? "bg-emerald-500 hover:bg-emerald-600"
                    : "hover:bg-muted"
                )}
                onClick={() => toggleFilter(filter)}
              >
                {filter}
              </Badge>
            ))}
            {activeFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setActiveFilters([])}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="absolute bottom-4 left-4 z-10">
        <div className="bg-card/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2">
          <p className="text-sm font-medium text-foreground">
            <span className="text-emerald-600">{visibleCampgrounds.length}</span> campgrounds in view
          </p>
        </div>
      </div>

      {/* Selected campground card */}
      {selectedCampground && (
        <div className="absolute bottom-4 right-4 z-10 w-80">
          <div className="bg-card rounded-xl shadow-xl overflow-hidden">
            {selectedCampground.imageUrl && (
              <div className="h-32 bg-muted">
                <img
                  src={selectedCampground.imageUrl}
                  alt={selectedCampground.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-foreground">{selectedCampground.name}</h3>
                  {selectedCampground.city && selectedCampground.state && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCampground.city}, {selectedCampground.state}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedCampground(null)}
                  className="p-1 hover:bg-muted rounded"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {selectedCampground.rating && (
                <div className="flex items-center gap-1 mt-2">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{selectedCampground.rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({selectedCampground.reviewCount || 0} reviews)
                  </span>
                </div>
              )}

              {selectedCampground.amenities && selectedCampground.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedCampground.amenities.slice(0, 4).map((amenity) => (
                    <Badge key={amenity} variant="secondary" className="text-xs capitalize">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                {selectedCampground.priceFrom && (
                  <p className="text-lg font-bold text-emerald-600">
                    ${selectedCampground.priceFrom}
                    <span className="text-sm font-normal text-muted-foreground">/night</span>
                  </p>
                )}
                <Button size="sm" className="gap-1">
                  View Details
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CampgroundSearchMap;
