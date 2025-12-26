"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Square,
  Circle,
  Triangle,
  RectangleHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  Copy,
  Save,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeft,
  Grid3X3,
  MousePointer2,
  Link2,
  Unlink,
  Keyboard,
  X,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Loader2,
  PartyPopper,
  Move,
  RotateCw
} from "lucide-react";

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type EditorSite = {
  id: string;
  name?: string | null;
  siteNumber?: string | null;
  mapLabel?: string | null;
};

type SiteMapData = {
  config?: any | null;
  sites?: Array<{ siteId: string; shapeId?: string | null; geometry?: any; centroid?: any; label?: string | null; rotation?: number | null }>;
  shapes?: Array<{ id: string; name?: string | null; geometry?: any; centroid?: any; metadata?: any; assignedSiteId?: string | null }>;
};

type SiteMapEditorProps = {
  campgroundId: string;
  mapData?: SiteMapData | null;
  baseImageUrl?: string | null;
  sites: EditorSite[];
  isLoading?: boolean;
  onSaved?: () => void;
  className?: string;
  autoFullscreen?: boolean;
};

type ShapeDraft = {
  id: string;
  name?: string | null;
  geometry: any;
  centroid?: any;
  metadata?: any;
  isNew?: boolean;
};

type PresetShape = "rectangle" | "square" | "circle" | "triangle" | "freeform";

type DragMode = "vertex" | "move" | "rotate" | "resize";

// Check if point is inside polygon using ray casting
const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

// Get bounding box of points
const getBoundingBox = (points: Point[]): { min: Point; max: Point; center: Point } => {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const max = { x: Math.max(...xs), y: Math.max(...ys) };
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
  return { min, max, center };
};

// Rotate points around a center
const rotatePoints = (points: Point[], center: Point, angleDelta: number): Point[] => {
  const cos = Math.cos(angleDelta);
  const sin = Math.sin(angleDelta);
  return points.map(p => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  });
};

// Scale points from a center
const scalePoints = (points: Point[], center: Point, scaleX: number, scaleY: number): Point[] => {
  return points.map(p => ({
    x: center.x + (p.x - center.x) * scaleX,
    y: center.y + (p.y - center.y) * scaleY
  }));
};

// Translate all points by delta
const translatePoints = (points: Point[], delta: Point): Point[] => {
  return points.map(p => ({
    x: p.x + delta.x,
    y: p.y + delta.y
  }));
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

const isNumber = (value: any) => Number.isFinite(Number(value));

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

const extractRect = (geometry: any) => {
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

const geometryToPoints = (geometry: any): Point[] => {
  const rect = extractRect(geometry);
  if (rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ];
  }
  return extractPoints(geometry);
};

const pointsToPath = (points: Point[], close = true) => {
  if (!points.length) return "";
  const parts = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`);
  return close ? `${parts.join(" ")} Z` : parts.join(" ");
};

const cloneGeometry = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const centroidFromPoints = (points: Point[]): Point | null => {
  if (points.length < 3) {
    if (points.length === 1) return points[0];
    if (points.length === 2) return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    return null;
  }
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    area += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }
  if (area === 0) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / points.length, y: sum.y / points.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), y: cy / (6 * area) };
};

const getBoundsFromConfig = (bounds: any): Bounds | null => {
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

const roundPoint = (value: number) => Math.round(value * 100) / 100;
const clampGrid = (value: number) => Math.min(200, Math.max(1, value));
const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const snapToAngle = (point: Point, anchor: Point): Point => {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  if (dx === 0 && dy === 0) return point;
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const distance = Math.hypot(dx, dy);
  return {
    x: anchor.x + Math.cos(snapped) * distance,
    y: anchor.y + Math.sin(snapped) * distance
  };
};

// Generate preset shape points
const generatePresetPoints = (
  type: PresetShape,
  center: Point,
  size: number = 60
): Point[] => {
  const half = size / 2;
  switch (type) {
    case "square":
      return [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half }
      ];
    case "rectangle":
      const width = size * 1.5;
      const height = size * 0.75;
      return [
        { x: center.x - width / 2, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y + height / 2 },
        { x: center.x - width / 2, y: center.y + height / 2 }
      ];
    case "circle":
      // Approximate circle with 16 points
      const points: Point[] = [];
      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({
          x: center.x + Math.cos(angle) * half,
          y: center.y + Math.sin(angle) * half
        });
      }
      return points;
    case "triangle":
      const triHeight = size * 0.866; // equilateral triangle height
      return [
        { x: center.x, y: center.y - triHeight / 2 },
        { x: center.x + half, y: center.y + triHeight / 2 },
        { x: center.x - half, y: center.y + triHeight / 2 }
      ];
    default:
      return [];
  }
};

// Celebration component
const SuccessCelebration = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="bg-emerald-500 text-white rounded-full p-6 shadow-2xl"
      >
        <PartyPopper className="h-12 w-12" />
      </motion.div>
    </motion.div>
  );
};

// Keyboard shortcuts help dialog
const KeyboardShortcutsHelp = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  if (!open) return null;

  const shortcuts = [
    { key: "Click", desc: "Add point to polygon" },
    { key: "Enter", desc: "Finish current shape" },
    { key: "Escape", desc: "Cancel drawing / Exit fullscreen" },
    { key: "Backspace", desc: "Undo last point" },
    { key: "Shift + Click", desc: "Snap to 45° angles" },
    { key: "1-4", desc: "Quick select preset shape" },
    { key: "S", desc: "Toggle snap to grid" },
    { key: "F", desc: "Toggle fullscreen" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="shortcuts-title" className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close shortcuts"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono text-slate-700 dark:text-slate-300">
                {s.key}
              </kbd>
              <span className="text-sm text-slate-600 dark:text-slate-400">{s.desc}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export function SiteMapEditor({
  campgroundId,
  mapData,
  baseImageUrl,
  sites,
  isLoading,
  onSaved,
  className,
  autoFullscreen
}: SiteMapEditorProps) {
  const { toast } = useToast();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [selectedShapeId, setSelectedShapeId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [shapeSearch, setShapeSearch] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawTargetId, setDrawTargetId] = useState<string | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point[]>([]);
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null);
  const [savingShapes, setSavingShapes] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [draftShapes, setDraftShapes] = useState<Record<string, ShapeDraft>>({});
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [editingPoints, setEditingPoints] = useState<Point[] | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [initialPoints, setInitialPoints] = useState<Point[] | null>(null);
  const [resizeCorner, setResizeCorner] = useState<number | null>(null); // 0=TL, 1=TR, 2=BR, 3=BL
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPanels, setShowPanels] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetShape>("freeform");
  const [showCelebration, setShowCelebration] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  // Announce to screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(""), 1000);
  }, []);

  const triggerCelebration = useCallback(() => {
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 1500);
  }, []);

  useEffect(() => {
    if (!baseImageUrl) {
      setImageSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImageSize({
        width: img.naturalWidth || img.width || 1000,
        height: img.naturalHeight || img.height || 1000
      });
    };
    img.onerror = () => setImageSize(null);
    img.src = baseImageUrl;
  }, [baseImageUrl]);

  useEffect(() => {
    if (!selectedSiteId) return;
    setIsDrawing(false);
    setDraftPoints([]);
    setHoverPoint(null);
    setEditingPoints(null);
    setDragIndex(null);
    setDrawTargetId(null);
  }, [selectedSiteId]);

  useEffect(() => {
    if (!selectedShapeId) return;
    setIsDrawing(false);
    setDraftPoints([]);
    setHoverPoint(null);
    setEditingPoints(null);
    setDragIndex(null);
    setDrawTargetId(null);
  }, [selectedShapeId]);

  useEffect(() => {
    if (!isDrawing) return;
    setIsFullscreen(true);
  }, [isDrawing]);

  useEffect(() => {
    if (!autoFullscreen) return;
    setIsFullscreen(true);
  }, [autoFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setShowPanels(true);
      return;
    }
    setShowPanels(false);
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isFullscreen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isFullscreen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isFullscreen]);

  const assignedShapeBySite = useMemo(() => {
    const map = new Map<string, string>();
    (mapData?.sites ?? []).forEach((site) => {
      if (site.shapeId) {
        map.set(site.siteId, site.shapeId);
      }
    });
    return map;
  }, [mapData?.sites]);

  useEffect(() => {
    if (!selectedSiteId) return;
    const shapeId = assignedShapeBySite.get(selectedSiteId);
    if (shapeId) {
      setSelectedShapeId(shapeId);
    }
  }, [assignedShapeBySite, selectedSiteId]);

  const assignedSiteIds = useMemo(() => new Set(assignedShapeBySite.keys()), [assignedShapeBySite]);

  const assignedSiteByShape = useMemo(() => {
    const map = new Map<string, string>();
    (mapData?.shapes ?? []).forEach((shape) => {
      if (shape.assignedSiteId) {
        map.set(shape.id, shape.assignedSiteId);
      }
    });
    (mapData?.sites ?? []).forEach((site) => {
      if (site.shapeId) {
        map.set(site.shapeId, site.siteId);
      }
    });
    return map;
  }, [mapData?.shapes, mapData?.sites]);

  const existingShapes = useMemo(() => mapData?.shapes ?? [], [mapData?.shapes]);

  const mergedShapes = useMemo(() => {
    const map = new Map<string, ShapeDraft>();
    existingShapes.forEach((shape) => {
      map.set(shape.id, {
        id: shape.id,
        name: shape.name ?? null,
        geometry: shape.geometry,
        centroid: shape.centroid,
        metadata: shape.metadata,
        isNew: false
      });
    });
    Object.values(draftShapes).forEach((draft) => {
      map.set(draft.id, draft);
    });
    return map;
  }, [existingShapes, draftShapes]);

  const shapeList = useMemo(() => Array.from(mergedShapes.values()), [mergedShapes]);

  const siteLabelById = useMemo(() => {
    const map = new Map<string, string>();
    sites.forEach((site) => {
      const label = site.siteNumber || site.mapLabel || site.name || site.id;
      map.set(site.id, label);
    });
    return map;
  }, [sites]);

  const shapeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    shapeList.forEach((shape) => {
      map.set(shape.id, shape.name || `Shape ${shape.id.slice(0, 6)}`);
    });
    return map;
  }, [shapeList]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId]
  );

  const selectedSiteAssignedShapeId = useMemo(
    () => (selectedSiteId ? assignedShapeBySite.get(selectedSiteId) : undefined),
    [assignedShapeBySite, selectedSiteId]
  );

  const selectedShapeAssignedSiteId = useMemo(
    () => (selectedShapeId ? assignedSiteByShape.get(selectedShapeId) : undefined),
    [assignedSiteByShape, selectedShapeId]
  );

  const pendingShapeCount = useMemo(() => Object.keys(draftShapes).length, [draftShapes]);
  const hasPendingShapes = pendingShapeCount > 0;

  const assignedShapeCount = useMemo(
    () => shapeList.filter((shape) => assignedSiteByShape.has(shape.id)).length,
    [assignedSiteByShape, shapeList]
  );

  const unassignedShapeCount = shapeList.length - assignedShapeCount;

  const filteredSites = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((site) => {
      const label = `${site.siteNumber ?? ""} ${site.name ?? ""} ${site.mapLabel ?? ""}`.toLowerCase();
      return label.includes(term);
    });
  }, [search, sites]);

  const filteredShapes = useMemo(() => {
    const term = shapeSearch.trim().toLowerCase();
    if (!term) return shapeList;
    return shapeList.filter((shape) => {
      const assignedSiteId = assignedSiteByShape.get(shape.id);
      const siteLabel = assignedSiteId ? siteLabelById.get(assignedSiteId) ?? "" : "";
      const label = `${shape.name ?? ""} ${shape.id} ${siteLabel}`.toLowerCase();
      return label.includes(term);
    });
  }, [assignedSiteByShape, shapeList, shapeSearch, siteLabelById]);

  const viewBox = useMemo(() => {
    if (imageSize) {
      return { minX: 0, minY: 0, width: imageSize.width, height: imageSize.height };
    }
    const configBounds = getBoundsFromConfig(mapData?.config?.bounds);
    if (configBounds) {
      return {
        minX: configBounds.minX,
        minY: configBounds.minY,
        width: configBounds.maxX - configBounds.minX,
        height: configBounds.maxY - configBounds.minY
      };
    }
    const points = Array.from(mergedShapes.values()).flatMap((layout) => geometryToPoints(layout.geometry));
    if (points.length) {
      const minX = Math.min(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxX = Math.max(...points.map((p) => p.x));
      const maxY = Math.max(...points.map((p) => p.y));
      const width = maxX - minX || 100;
      const height = maxY - minY || 100;
      const pad = Math.max(width, height) * 0.04;
      return { minX: minX - pad, minY: minY - pad, width: width + pad * 2, height: height + pad * 2 };
    }
    return { minX: 0, minY: 0, width: 1000, height: 600 };
  }, [imageSize, mapData?.config?.bounds, mergedShapes]);

  const selectedShape = selectedShapeId ? mergedShapes.get(selectedShapeId) : undefined;
  const selectedGeometry = selectedShape?.geometry;
  const selectedPoints = selectedGeometry ? geometryToPoints(selectedGeometry) : [];
  const activePoints = editingPoints ?? selectedPoints;

  const draftLine = useMemo(() => {
    if (!isDrawing || draftPoints.length === 0) return "";
    const points = hoverPoint ? [...draftPoints, hoverPoint] : draftPoints;
    return pointsToPath(points, false);
  }, [draftPoints, hoverPoint, isDrawing]);

  const draftPolygon = useMemo(() => {
    if (!isDrawing || draftPoints.length < 3) return "";
    return pointsToPath(draftPoints, true);
  }, [draftPoints, isDrawing]);

  const getSvgPoint = (event: React.PointerEvent<SVGSVGElement>, anchor?: Point | null) => {
    const svg = svgRef.current;
    if (!svg) return null;
    let rawPoint: Point | null = null;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const cursor = svg.createSVGPoint();
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      const svgPoint = cursor.matrixTransform(ctm.inverse());
      rawPoint = { x: svgPoint.x, y: svgPoint.y };
    } else {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
      const contentWidth = viewBox.width * scale;
      const contentHeight = viewBox.height * scale;
      const offsetX = (rect.width - contentWidth) / 2;
      const offsetY = (rect.height - contentHeight) / 2;
      rawPoint = {
        x: (event.clientX - rect.left - offsetX) / scale + viewBox.minX,
        y: (event.clientY - rect.top - offsetY) / scale + viewBox.minY
      };
    }
    if (!rawPoint) return null;
    let x = clampValue(rawPoint.x, viewBox.minX, viewBox.minX + viewBox.width);
    let y = clampValue(rawPoint.y, viewBox.minY, viewBox.minY + viewBox.height);
    let point = { x, y };
    if (event.shiftKey && anchor) {
      point = snapToAngle(point, anchor);
    }
    if (snapToGrid) {
      const size = clampGrid(gridSize);
      point = {
        x: Math.round(point.x / size) * size,
        y: Math.round(point.y / size) * size
      };
    }
    return { x: roundPoint(point.x), y: roundPoint(point.y) };
  };

  const handleCanvasClick = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = getSvgPoint(event);
    if (!point) return;

    // If using preset shapes, place the shape immediately
    if (selectedPreset !== "freeform" && !isDrawing) {
      const size = Math.min(viewBox.width, viewBox.height) * 0.08;
      const presetPoints = generatePresetPoints(selectedPreset, point, size);
      createShapeFromPoints(presetPoints);
      announce(`${selectedPreset} shape placed`);
      return;
    }

    // Freeform drawing mode
    if (!isDrawing) return;
    if (dragIndex !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const anchor = draftPoints.length ? draftPoints[draftPoints.length - 1] : null;
    const snapPoint = getSvgPoint(event, anchor);
    if (!snapPoint) return;
    setDraftPoints((prev) => [...prev, snapPoint]);
    announce(`Point ${draftPoints.length + 1} added`);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (dragIndex !== null && editingPoints) {
      const point = getSvgPoint(event);
      if (!point) return;
      setEditingPoints((prev) => {
        if (!prev) return prev;
        const next = [...prev];
        next[dragIndex] = point;
        return next;
      });
      return;
    }
    if (!isDrawing) return;
    const anchor = draftPoints.length ? draftPoints[draftPoints.length - 1] : null;
    const point = getSvgPoint(event, anchor);
    setHoverPoint(point);
  };

  const handleStartDraw = (targetId?: string | null) => {
    setSelectedPreset("freeform");
    setIsDrawing(true);
    setDrawTargetId(targetId ?? null);
    setDraftPoints([]);
    setHoverPoint(null);
    setEditingPoints(null);
    setDragIndex(null);
    announce("Freeform drawing mode. Click to add points, Enter to finish.");
  };

  const handleRedrawSelected = () => {
    if (!selectedShapeId) {
      toast({ title: "Select a shape first", description: "Choose a shape to redraw.", variant: "destructive" });
      return;
    }
    handleStartDraw(selectedShapeId);
  };

  const createDraftId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextShapeIndex = useMemo(() => {
    const draftCount = Object.values(draftShapes).filter((shape) => shape.isNew).length;
    return existingShapes.length + draftCount + 1;
  }, [draftShapes, existingShapes.length]);

  const createShapeFromPoints = (points: Point[], targetId?: string | null) => {
    if (points.length < 3) {
      toast({ title: "Add at least 3 points", description: "Polygons need three or more points.", variant: "destructive" });
      return;
    }
    const geometry = {
      type: "Polygon",
      coordinates: [points.map((p) => [p.x, p.y])]
    };
    const centroid = centroidFromPoints(points);
    const shapeId = targetId ?? drawTargetId ?? createDraftId();
    const baseShape = mergedShapes.get(shapeId);
    const isNew = baseShape?.isNew ?? !existingShapes.find((shape) => shape.id === shapeId);
    const name = baseShape?.name ?? (isNew ? `Shape ${nextShapeIndex}` : null);

    setDraftShapes((prev) => ({
      ...prev,
      [shapeId]: {
        id: shapeId,
        name,
        geometry,
        centroid,
        metadata: baseShape?.metadata,
        isNew
      }
    }));
    setSelectedShapeId(shapeId);
    setIsDrawing(false);
    setDraftPoints([]);
    setHoverPoint(null);
    setDrawTargetId(null);

    // Celebrate first shape
    if (existingShapes.length === 0 && Object.keys(draftShapes).length === 0) {
      triggerCelebration();
    }

    toast({ title: "Shape created!", description: "Don't forget to save and assign it to a site." });
  };

  const handleFinish = () => {
    createShapeFromPoints(draftPoints);
    announce("Shape finished");
  };

  const handleUndo = () => {
    setDraftPoints((prev) => prev.slice(0, -1));
    announce(`Point removed. ${draftPoints.length - 1} points remaining`);
  };

  const handleClearDraft = () => {
    setDraftPoints([]);
    setHoverPoint(null);
    announce("Drawing cleared");
  };

  const handleDuplicateShape = () => {
    if (!selectedGeometry) {
      toast({ title: "No shape selected", description: "Select a shape to duplicate.", variant: "destructive" });
      return;
    }
    const draftId = createDraftId();
    const centroid = centroidFromPoints(geometryToPoints(selectedGeometry)) ?? undefined;
    const baseName = selectedShape?.name ?? "Shape";
    setDraftShapes((prev) => ({
      ...prev,
      [draftId]: {
        id: draftId,
        name: `${baseName} copy`,
        geometry: cloneGeometry(selectedGeometry),
        centroid,
        metadata: selectedShape?.metadata,
        isNew: true
      }
    }));
    setSelectedShapeId(draftId);
    toast({ title: "Shape duplicated", description: "Assign the new shape to a site when ready." });
    announce("Shape duplicated");
  };

  const commitEditing = (points: Point[]) => {
    if (!selectedShapeId || points.length < 3) return;
    const geometry = {
      type: "Polygon",
      coordinates: [points.map((p) => [p.x, p.y])]
    };
    const centroid = centroidFromPoints(points);
    const baseShape = mergedShapes.get(selectedShapeId);
    if (!baseShape) return;
    setDraftShapes((prev) => ({
      ...prev,
      [selectedShapeId]: {
        id: baseShape.id,
        name: baseShape.name ?? null,
        geometry,
        centroid,
        metadata: baseShape.metadata,
        isNew: baseShape.isNew
      }
    }));
    setEditingPoints(null);
    setDragIndex(null);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (dragIndex === null || !editingPoints) return;
    event.preventDefault();
    commitEditing(editingPoints);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // Quick preset selection with number keys
      if (event.key === "1") {
        setSelectedPreset("rectangle");
        setIsDrawing(false);
        announce("Rectangle preset selected. Click to place.");
        return;
      }
      if (event.key === "2") {
        setSelectedPreset("square");
        setIsDrawing(false);
        announce("Square preset selected. Click to place.");
        return;
      }
      if (event.key === "3") {
        setSelectedPreset("circle");
        setIsDrawing(false);
        announce("Circle preset selected. Click to place.");
        return;
      }
      if (event.key === "4") {
        setSelectedPreset("triangle");
        setIsDrawing(false);
        announce("Triangle preset selected. Click to place.");
        return;
      }

      // Toggle snap
      if (event.key === "s" || event.key === "S") {
        setSnapToGrid(prev => !prev);
        announce(snapToGrid ? "Snap disabled" : "Snap enabled");
        return;
      }

      // Toggle fullscreen
      if (event.key === "f" || event.key === "F") {
        setIsFullscreen(prev => !prev);
        return;
      }

      // Show shortcuts
      if (event.key === "?") {
        setShowShortcuts(true);
        return;
      }

      if (event.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (isDrawing) {
          setIsDrawing(false);
          setDraftPoints([]);
          setHoverPoint(null);
          setSelectedPreset("freeform");
          announce("Drawing cancelled");
        }
        if (dragIndex !== null) {
          setEditingPoints(null);
          setDragIndex(null);
        }
        return;
      }
      if (!isDrawing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        handleFinish();
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [announce, dragIndex, handleFinish, handleUndo, isDrawing, showShortcuts, snapToGrid]);

  const handleSaveShapes = async () => {
    if (!campgroundId) return;
    const entries = Object.values(draftShapes);
    if (!entries.length) {
      toast({ title: "No shapes to save", description: "Draw a shape before saving." });
      return;
    }
    const hasNewShapes = entries.some((shape) => shape.isNew);
    setSavingShapes(true);
    try {
      const shapesPayload = entries.map((shape) => ({
        id: shape.isNew ? undefined : shape.id,
        name: shape.name ?? null,
        geometry: shape.geometry,
        centroid: shape.centroid,
        metadata: shape.metadata
      }));

      await apiClient.upsertCampgroundMapShapes(campgroundId, {
        shapes: shapesPayload
      });
      toast({ title: "Shapes saved!", description: `${entries.length} shape${entries.length > 1 ? 's' : ''} saved successfully.` });
      setDraftShapes({});
      if (hasNewShapes) {
        setSelectedShapeId("");
      }
      announce("Shapes saved");
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save map";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSavingShapes(false);
    }
  };

  const handleAssignShape = async () => {
    if (!campgroundId) return;
    if (!selectedSiteId || !selectedShapeId) {
      toast({ title: "Select a site and shape", description: "Choose both before assigning.", variant: "destructive" });
      return;
    }
    if (selectedShape?.isNew || draftShapes[selectedShapeId]?.isNew) {
      toast({ title: "Save the shape first", description: "New shapes must be saved before assigning." });
      return;
    }
    if (draftShapes[selectedShapeId]) {
      toast({ title: "Save edits first", description: "Save shape edits before assigning so geometry is current." });
      return;
    }

    const currentShapeForSite = selectedSiteAssignedShapeId;
    const currentSiteForShape = selectedShapeAssignedSiteId;
    const selectedSiteLabel = siteLabelById.get(selectedSiteId) ?? selectedSiteId;
    const selectedShapeLabel = shapeLabelById.get(selectedShapeId) ?? selectedShapeId;

    if (currentSiteForShape && currentSiteForShape !== selectedSiteId) {
      const assignedLabel = siteLabelById.get(currentSiteForShape) ?? currentSiteForShape;
      const ok = window.confirm(`"${selectedShapeLabel}" is already assigned to ${assignedLabel}. Reassign it to ${selectedSiteLabel}?`);
      if (!ok) return;
    }

    if (currentShapeForSite && currentShapeForSite !== selectedShapeId) {
      const ok = window.confirm(`"${selectedSiteLabel}" already has a shape. Replace it with "${selectedShapeLabel}"?`);
      if (!ok) return;
    }

    setAssigning(true);
    try {
      if (currentSiteForShape && currentSiteForShape !== selectedSiteId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, currentSiteForShape);
      }
      if (currentShapeForSite && currentShapeForSite !== selectedShapeId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, selectedSiteId);
      }

      const label = selectedSite?.mapLabel ?? selectedSite?.siteNumber ?? selectedSite?.name ?? null;
      await apiClient.upsertCampgroundMapAssignments(campgroundId, {
        assignments: [{ siteId: selectedSiteId, shapeId: selectedShapeId, label }]
      });
      toast({ title: "Assigned!", description: `${selectedShapeLabel} mapped to ${selectedSiteLabel}.` });
      announce(`Shape assigned to ${selectedSiteLabel}`);
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assignment failed";
      toast({ title: "Assignment failed", description: message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignSite = async () => {
    if (!campgroundId) return;
    if (!selectedSiteId) {
      toast({ title: "Select a site", description: "Choose a site to unassign.", variant: "destructive" });
      return;
    }
    if (!selectedSiteAssignedShapeId) {
      toast({ title: "No assignment found", description: "That site is already unassigned." });
      return;
    }
    setAssigning(true);
    try {
      await apiClient.unassignCampgroundMapSite(campgroundId, selectedSiteId);
      toast({ title: "Site unassigned", description: "Shape removed from this site." });
      announce("Site unassigned");
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unassign failed";
      toast({ title: "Unassign failed", description: message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteShape = async () => {
    if (!campgroundId) return;
    if (!selectedShapeId) {
      toast({ title: "Select a shape", description: "Choose a shape to delete.", variant: "destructive" });
      return;
    }
    const draftShape = draftShapes[selectedShapeId];
    const isDraftOnly = draftShape?.isNew && !existingShapes.find((shape) => shape.id === selectedShapeId);
    if (isDraftOnly) {
      setDraftShapes((prev) => {
        const next = { ...prev };
        delete next[selectedShapeId];
        return next;
      });
      setSelectedShapeId("");
      toast({ title: "Draft removed", description: "Unsaved shape discarded." });
      announce("Draft removed");
      return;
    }

    const shapeLabel = shapeLabelById.get(selectedShapeId) ?? selectedShapeId;
    const assignedSiteId = selectedShapeAssignedSiteId;
    const assignedLabel = assignedSiteId ? siteLabelById.get(assignedSiteId) ?? assignedSiteId : null;
    const confirmMessage = assignedLabel
      ? `Delete "${shapeLabel}"? It is assigned to ${assignedLabel} and will be unassigned.`
      : `Delete "${shapeLabel}"?`;
    if (!window.confirm(confirmMessage)) return;

    setAssigning(true);
    try {
      if (assignedSiteId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, assignedSiteId);
      }
      await apiClient.deleteCampgroundMapShape(campgroundId, selectedShapeId);
      setDraftShapes((prev) => {
        const next = { ...prev };
        delete next[selectedShapeId];
        return next;
      });
      setSelectedShapeId("");
      toast({ title: "Shape deleted", description: "Shape removed from the library." });
      announce("Shape deleted");
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-8 text-center", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading map editor...</p>
      </div>
    );
  }

  if (!baseImageUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-8 text-center", className)}
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="font-semibold text-slate-800 mb-2">Ready to map your campground?</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Upload a map image above to get started. You'll be able to draw site boundaries and assign them to your sites.
        </p>
      </motion.div>
    );
  }

  const containerClasses = cn(
    isFullscreen
      ? "fixed inset-0 z-50 bg-white dark:bg-slate-950 p-4 shadow-2xl"
      : "rounded-xl border border-slate-200 bg-white dark:bg-slate-950 p-4",
    className
  );

  const presetButtons: { type: PresetShape; icon: typeof Square; label: string; key: string }[] = [
    { type: "rectangle", icon: RectangleHorizontal, label: "Rectangle", key: "1" },
    { type: "square", icon: Square, label: "Square", key: "2" },
    { type: "circle", icon: Circle, label: "Circle", key: "3" },
    { type: "triangle", icon: Triangle, label: "Triangle", key: "4" },
  ];

  return (
    <TooltipProvider>
      <div className={containerClasses}>
        {/* Screen reader announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {announcement}
        </div>

        {/* Celebration overlay */}
        <AnimatePresence>
          <SuccessCelebration show={showCelebration} />
        </AnimatePresence>

        {/* Keyboard shortcuts dialog */}
        <AnimatePresence>
          <KeyboardShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-base font-semibold text-slate-800 dark:text-white">Site Map Editor</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isDrawing
                ? "Click to add points, Enter to finish, Esc to cancel"
                : selectedPreset !== "freeform"
                ? `Click on the map to place a ${selectedPreset}`
                : "Select a preset shape or draw freeform polygons"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowShortcuts(true)}
                  aria-label="Show keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
            </Tooltip>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="transition-transform active:scale-95"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1.5" /> : <Maximize2 className="h-4 w-4 mr-1.5" />}
              {isFullscreen ? "Exit" : "Fullscreen"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPanels((prev) => !prev)}
              className="transition-transform active:scale-95"
            >
              {showPanels ? <PanelLeftClose className="h-4 w-4 mr-1.5" /> : <PanelLeft className="h-4 w-4 mr-1.5" />}
              {showPanels ? "Hide" : "Show"} Panels
            </Button>
          </div>
        </div>

        {/* Preset Shape Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-2">Quick Shapes:</span>
          {presetButtons.map(({ type, icon: Icon, label, key }) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant={selectedPreset === type ? "default" : "outline"}
                  onClick={() => {
                    setSelectedPreset(type);
                    setIsDrawing(false);
                    announce(`${label} preset selected. Click to place.`);
                  }}
                  className={cn(
                    "transition-all",
                    selectedPreset === type
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md scale-105"
                      : "hover:border-emerald-300"
                  )}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Press {key} for quick access</TooltipContent>
            </Tooltip>
          ))}

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isDrawing ? "default" : "outline"}
                onClick={() => handleStartDraw(null)}
                disabled={isDrawing}
                className={cn(
                  "transition-all",
                  isDrawing && "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Freeform
              </Button>
            </TooltipTrigger>
            <TooltipContent>Draw custom polygon shapes</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={snapToGrid ? "default" : "outline"}
                onClick={() => setSnapToGrid((prev) => !prev)}
                className="transition-transform active:scale-95"
              >
                <Grid3X3 className="h-4 w-4 mr-1.5" />
                Snap {snapToGrid ? "On" : "Off"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Press S to toggle</TooltipContent>
          </Tooltip>

          {snapToGrid && (
            <Input
              type="number"
              min={1}
              max={200}
              value={gridSize}
              onChange={(e) => setGridSize(clampGrid(Number(e.target.value) || 1))}
              className="h-8 w-16 text-center"
              aria-label="Grid size"
            />
          )}

          {isDrawing && (
            <>
              <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2" />
              <Button size="sm" variant="outline" onClick={handleUndo} disabled={draftPoints.length === 0}>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Undo
              </Button>
              <Button size="sm" onClick={handleFinish} disabled={draftPoints.length < 3} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Finish ({draftPoints.length} pts)
              </Button>
            </>
          )}
        </div>

        <div
          className={cn(
            "grid gap-4",
            showPanels ? "lg:grid-cols-[320px,1fr]" : "grid-cols-1",
            isFullscreen && "h-[calc(100vh-200px)]"
          )}
        >
          {showPanels && (
          <div className={cn("space-y-4", isFullscreen && "h-full overflow-auto pr-1")}>
            {/* Shapes Panel */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Shapes</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{assignedShapeCount} assigned</Badge>
                  <Badge variant="outline" className="text-xs">{unassignedShapeCount} free</Badge>
                </div>
              </div>
              <Input
                placeholder="Search shapes..."
                value={shapeSearch}
                onChange={(e) => setShapeSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-[200px] space-y-1 overflow-auto pr-1">
                {filteredShapes.map((shape) => {
                  const assignedSiteId = assignedSiteByShape.get(shape.id);
                  const assignedLabel = assignedSiteId ? siteLabelById.get(assignedSiteId) ?? assignedSiteId : "Unassigned";
                  const isActive = selectedShapeId === shape.id;
                  const isDraft = Boolean(draftShapes[shape.id]);
                  const label = shapeLabelById.get(shape.id) ?? shape.id;
                  return (
                    <motion.button
                      key={shape.id}
                      type="button"
                      onClick={() => setSelectedShapeId(shape.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all",
                        isActive
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800 dark:text-white">{label}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {assignedSiteId ? `→ ${assignedLabel}` : "Unassigned"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isDraft && <Badge variant="secondary" className="text-[10px]">Draft</Badge>}
                      </div>
                    </motion.button>
                  );
                })}
                {!filteredShapes.length && (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400">No shapes yet</p>
                    <p className="text-xs text-slate-400 mt-1">Use the toolbar above to create shapes</p>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleDuplicateShape} disabled={!selectedGeometry || assigning}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Duplicate shape</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleDeleteShape} disabled={!selectedShapeId || assigning}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete shape</TooltipContent>
                </Tooltip>
                <Button
                  size="sm"
                  onClick={handleSaveShapes}
                  disabled={savingShapes || !hasPendingShapes}
                  className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white transition-transform active:scale-95"
                >
                  {savingShapes ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Save {hasPendingShapes && `(${pendingShapeCount})`}
                </Button>
              </div>
            </motion.div>

            {/* Sites Panel */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Site Assignments</div>
                <Badge variant="secondary" className="text-xs">
                  {assignedSiteIds.size}/{sites.length} mapped
                </Badge>
              </div>
              <Input
                placeholder="Search sites..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-2"
              />
              <div className="max-h-[240px] space-y-1 overflow-auto pr-1">
                {filteredSites.map((site) => {
                  const isMapped = assignedSiteIds.has(site.id);
                  const isActive = selectedSiteId === site.id;
                  const assignedShapeId = assignedShapeBySite.get(site.id);
                  const shapeLabel = assignedShapeId ? shapeLabelById.get(assignedShapeId) ?? assignedShapeId : null;
                  const label = site.siteNumber || site.mapLabel || site.name || site.id;
                  return (
                    <motion.button
                      key={site.id}
                      type="button"
                      onClick={() => setSelectedSiteId(site.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all",
                        isActive
                          ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:border-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800 dark:text-white">{label}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {shapeLabel ? `← ${shapeLabel}` : "No shape assigned"}
                        </span>
                      </div>
                      <Badge
                        variant={isMapped ? "default" : "secondary"}
                        className={cn(
                          "text-[10px]",
                          isMapped && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                        )}
                      >
                        {isMapped ? "Mapped" : "Unmapped"}
                      </Badge>
                    </motion.button>
                  );
                })}
                {!filteredSites.length && (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                    No matching sites
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  size="sm"
                  onClick={handleAssignShape}
                  disabled={!selectedSiteId || !selectedShapeId || assigning}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white transition-transform active:scale-95"
                >
                  {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
                  Assign
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnassignSite}
                  disabled={!selectedSiteId || !selectedSiteAssignedShapeId || assigning}
                >
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  Unassign
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                Select a shape and site, then click Assign to link them.
              </p>
            </motion.div>
          </div>
          )}

          {/* Canvas */}
          <div className={cn("rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2", isFullscreen && "h-full")}>
            <svg
              ref={svgRef}
              viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
              className={cn(
                isFullscreen ? "h-full w-full" : "h-[620px] w-full",
                isDrawing && "cursor-crosshair",
                selectedPreset !== "freeform" && !isDrawing && "cursor-copy"
              )}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={() => setHoverPoint(null)}
              onPointerDown={handleCanvasClick}
              role="img"
              aria-label="Site map editor canvas. Use preset shapes or draw freeform polygons to map your sites."
              preserveAspectRatio="xMidYMid meet"
            >
              <image
                href={baseImageUrl}
                x={viewBox.minX}
                y={viewBox.minY}
                width={viewBox.width}
                height={viewBox.height}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.95}
                pointerEvents="none"
              />

              {/* All shapes except selected */}
              {shapeList
                .filter((shape) => shape.id !== selectedShapeId)
                .map((shape) => {
                  const points = geometryToPoints(shape.geometry);
                  if (points.length < 2) return null;
                  const assignedSiteId = assignedSiteByShape.get(shape.id);
                  const isAssigned = Boolean(assignedSiteId);
                  const isDraft = Boolean(draftShapes[shape.id]);
                  const siteLabel = assignedSiteId ? siteLabelById.get(assignedSiteId) : null;
                  const centroid = centroidFromPoints(points);
                  return (
                    <g key={shape.id}>
                      <path
                        d={pointsToPath(points, true)}
                        fill={isAssigned ? "rgba(16,185,129,0.2)" : "rgba(148,163,184,0.15)"}
                        stroke={isAssigned ? "#10b981" : "#94a3b8"}
                        strokeWidth={isAssigned ? 2 : 1.5}
                        strokeDasharray={isAssigned ? undefined : "4 3"}
                        opacity={isDraft ? 0.95 : 0.85}
                        className="transition-all duration-150"
                      />
                      {/* Show site label on assigned shapes */}
                      {siteLabel && centroid && (
                        <text
                          x={centroid.x}
                          y={centroid.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-emerald-800 dark:fill-emerald-300 text-[12px] font-semibold pointer-events-none"
                          style={{ textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
                        >
                          {siteLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Selected shape */}
              {activePoints.length >= 3 && (
                <path
                  d={pointsToPath(activePoints, true)}
                  fill="rgba(59,130,246,0.25)"
                  stroke="#2563eb"
                  strokeWidth={3}
                  className="drop-shadow-sm"
                />
              )}

              {/* Draft polygon being drawn */}
              {draftPolygon && (
                <path d={draftPolygon} fill="rgba(59,130,246,0.2)" stroke="#2563eb" strokeWidth={2.5} />
              )}
              {draftLine && (
                <path d={draftLine} fill="none" stroke="#2563eb" strokeDasharray="4 3" strokeWidth={2} />
              )}
              {draftPoints.map((point, idx) => (
                <circle
                  key={`draft-${point.x}-${point.y}-${idx}`}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill="#2563eb"
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}

              {/* Editable handles for selected shape */}
              {!isDrawing &&
                activePoints.map((point, idx) => (
                  <circle
                    key={`handle-${point.x}-${point.y}-${idx}`}
                    cx={point.x}
                    cy={point.y}
                    r={6}
                    fill="#2563eb"
                    stroke="#fff"
                    strokeWidth={2}
                    className="cursor-move"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (!activePoints.length) return;
                      setEditingPoints([...activePoints]);
                      setDragIndex(idx);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                  />
                ))}

              {/* Hover preview for preset placement */}
              {hoverPoint && selectedPreset !== "freeform" && !isDrawing && (
                <g opacity={0.5}>
                  {(() => {
                    const size = Math.min(viewBox.width, viewBox.height) * 0.08;
                    const previewPoints = generatePresetPoints(selectedPreset, hoverPoint, size);
                    return (
                      <path
                        d={pointsToPath(previewPoints, true)}
                        fill="rgba(16,185,129,0.2)"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="4 2"
                      />
                    );
                  })()}
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
