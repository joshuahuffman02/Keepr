"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  RotateCw,
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
  config?: unknown | null;
  sites?: Array<{
    siteId: string;
    shapeId?: string | null;
    geometry?: unknown;
    centroid?: unknown;
    label?: string | null;
    rotation?: number | null;
  }>;
  shapes?: Array<{
    id: string;
    name?: string | null;
    geometry?: unknown;
    centroid?: unknown;
    metadata?: unknown;
    assignedSiteId?: string | null;
  }>;
};

type SiteMapEditorProps = {
  campgroundId: string;
  mapData?: SiteMapData | null;
  baseImageUrl?: string | null;
  sites: EditorSite[];
  isLoading?: boolean;
  onSaved?: () => void;
  className?: string;
};

type ShapeDraft = {
  id: string;
  name?: string | null;
  geometry: unknown;
  centroid?: unknown;
  metadata?: unknown;
  isNew?: boolean;
};

type PresetShape = "rectangle" | "square" | "circle" | "triangle" | "freeform";

type DragMode = "vertex" | "move" | "rotate" | "resize";

// Check if point is inside polygon using ray casting
const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    if (yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

// Get bounding box of points
const getBoundingBox = (points: Point[]): { min: Point; max: Point; center: Point } => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const min = { x: Math.min(...xs), y: Math.min(...ys) };
  const max = { x: Math.max(...xs), y: Math.max(...ys) };
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2 };
  return { min, max, center };
};

// Rotate points around a center
const rotatePoints = (points: Point[], center: Point, angleDelta: number): Point[] => {
  const cos = Math.cos(angleDelta);
  const sin = Math.sin(angleDelta);
  return points.map((p) => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  });
};

// Scale points from a center
const scalePoints = (points: Point[], center: Point, scaleX: number, scaleY: number): Point[] => {
  return points.map((p) => ({
    x: center.x + (p.x - center.x) * scaleX,
    y: center.y + (p.y - center.y) * scaleY,
  }));
};

// Translate all points by delta
const translatePoints = (points: Point[], delta: Point): Point[] => {
  return points.map((p) => ({
    x: p.x + delta.x,
    y: p.y + delta.y,
  }));
};

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown) => Number.isFinite(Number(value));

const normalizePoint = (value: unknown): Point | null => {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2 && isNumber(value[0]) && isNumber(value[1])) {
    return { x: Number(value[0]), y: Number(value[1]) };
  }
  if (isRecord(value)) {
    const x = value.x ?? value.lng ?? value.longitude;
    const y = value.y ?? value.lat ?? value.latitude;
    if (isNumber(x) && isNumber(y)) {
      return { x: Number(x), y: Number(y) };
    }
  }
  return null;
};

const isPoint = (value: Point | null): value is Point => value !== null;

const extractPoints = (geometry: unknown): Point[] => {
  if (!geometry) return [];
  if (Array.isArray(geometry)) {
    return geometry.map(normalizePoint).filter(isPoint);
  }
  if (isRecord(geometry)) {
    const type = geometry.type;
    const coordinates = geometry.coordinates;
    if (type === "Polygon" && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
      return coordinates[0].map(normalizePoint).filter(isPoint);
    }
    if (
      type === "MultiPolygon" &&
      Array.isArray(coordinates) &&
      Array.isArray(coordinates[0]) &&
      Array.isArray(coordinates[0][0])
    ) {
      return coordinates[0][0].map(normalizePoint).filter(isPoint);
    }
    if (type === "LineString" && Array.isArray(coordinates)) {
      return coordinates.map(normalizePoint).filter(isPoint);
    }
    const points = geometry.points;
    if (Array.isArray(points)) {
      return points.map(normalizePoint).filter(isPoint);
    }
    const coords = geometry.coords;
    if (Array.isArray(coords)) {
      return coords.map(normalizePoint).filter(isPoint);
    }
  }
  return [];
};

const extractRect = (geometry: unknown) => {
  if (!isRecord(geometry)) return null;
  const x = geometry.x ?? geometry.left ?? geometry.minX;
  const y = geometry.y ?? geometry.top ?? geometry.minY;
  const width =
    geometry.width ??
    (isNumber(geometry.right) && isNumber(x) ? Number(geometry.right) - Number(x) : null);
  const height =
    geometry.height ??
    (isNumber(geometry.bottom) && isNumber(y) ? Number(geometry.bottom) - Number(y) : null);
  if (isNumber(x) && isNumber(y) && isNumber(width) && isNumber(height)) {
    return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
  }
  return null;
};

const geometryToPoints = (geometry: unknown): Point[] => {
  const rect = extractRect(geometry);
  if (rect) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height },
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
    if (points.length === 2)
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
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

const getBoundsFromConfig = (bounds: unknown): Bounds | null => {
  if (!bounds) return null;
  if (Array.isArray(bounds) && bounds.length >= 4 && bounds.every(isNumber)) {
    return {
      minX: Number(bounds[0]),
      minY: Number(bounds[1]),
      maxX: Number(bounds[2]),
      maxY: Number(bounds[3]),
    };
  }
  if (!isRecord(bounds)) return null;
  const minX = bounds.minX ?? bounds.left ?? bounds.x;
  const minY = bounds.minY ?? bounds.top ?? bounds.y;
  const maxX =
    bounds.maxX ??
    bounds.right ??
    (isNumber(bounds.width) && isNumber(bounds.x) ? Number(bounds.x) + Number(bounds.width) : null);
  const maxY =
    bounds.maxY ??
    bounds.bottom ??
    (isNumber(bounds.height) && isNumber(bounds.y)
      ? Number(bounds.y) + Number(bounds.height)
      : null);
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
    y: anchor.y + Math.sin(snapped) * distance,
  };
};

// Generate preset shape points
const generatePresetPoints = (type: PresetShape, center: Point, size: number = 60): Point[] => {
  const half = size / 2;
  switch (type) {
    case "square":
      return [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half },
      ];
    case "rectangle":
      const width = size * 1.5;
      const height = size * 0.75;
      return [
        { x: center.x - width / 2, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y + height / 2 },
        { x: center.x - width / 2, y: center.y + height / 2 },
      ];
    case "circle":
      // Approximate circle with 16 points
      const points: Point[] = [];
      const segments = 16;
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push({
          x: center.x + Math.cos(angle) * half,
          y: center.y + Math.sin(angle) * half,
        });
      }
      return points;
    case "triangle":
      const triHeight = size * 0.866; // equilateral triangle height
      return [
        { x: center.x, y: center.y - triHeight / 2 },
        { x: center.x + half, y: center.y + triHeight / 2 },
        { x: center.x - half, y: center.y + triHeight / 2 },
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
        className="bg-status-success text-status-success-foreground rounded-full p-6 shadow-2xl"
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
    { key: "Escape", desc: "Cancel drawing / editing" },
    { key: "Backspace", desc: "Undo last point" },
    { key: "Shift + Click", desc: "Snap to 45° angles" },
    { key: "1-4", desc: "Quick select preset shape" },
    { key: "S", desc: "Toggle snap to grid" },
    { key: "F", desc: "Toggle fullscreen" },
    { key: "Drag shape", desc: "Move entire shape" },
    { key: "Drag ↻", desc: "Rotate shape" },
    { key: "Drag corners", desc: "Resize shape" },
    { key: "Drag vertices", desc: "Adjust individual points" },
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
        className="bg-card rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="shortcuts-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="shortcuts-title"
            className="text-lg font-semibold text-foreground flex items-center gap-2"
          >
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close shortcuts"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <kbd className="px-2 py-1 bg-muted rounded text-sm font-mono text-foreground">
                {s.key}
              </kbd>
              <span className="text-sm text-muted-foreground">{s.desc}</span>
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
  const [quickAssignShapeId, setQuickAssignShapeId] = useState<string | null>(null);
  const [quickAssignPosition, setQuickAssignPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [quickAssignSearch, setQuickAssignSearch] = useState("");

  // Confirmation dialog states
  const [reassignConfirm, setReassignConfirm] = useState<{
    shapeId: string;
    siteId: string;
    shapeLabel: string;
    oldSiteLabel: string;
    newSiteLabel: string;
  } | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState<{
    shapeId: string;
    siteId: string;
    shapeLabel: string;
    siteLabel: string;
  } | null>(null);
  const [quickReplaceConfirm, setQuickReplaceConfirm] = useState<{
    shapeId: string;
    siteId: string;
    shapeLabel: string;
    siteLabel: string;
  } | null>(null);
  const [deleteShapeConfirm, setDeleteShapeConfirm] = useState<{
    shapeId: string;
    shapeLabel: string;
    assignedSiteLabel: string | null;
  } | null>(null);

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
        height: img.naturalHeight || img.height || 1000,
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

  // Note: Removed auto-fullscreen on drawing - it was confusing users
  // Users can manually toggle fullscreen with F key or button if needed

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
        isNew: false,
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
    [sites, selectedSiteId],
  );

  const selectedSiteAssignedShapeId = useMemo(
    () => (selectedSiteId ? assignedShapeBySite.get(selectedSiteId) : undefined),
    [assignedShapeBySite, selectedSiteId],
  );

  const selectedShapeAssignedSiteId = useMemo(
    () => (selectedShapeId ? assignedSiteByShape.get(selectedShapeId) : undefined),
    [assignedSiteByShape, selectedShapeId],
  );

  const pendingShapeCount = useMemo(() => Object.keys(draftShapes).length, [draftShapes]);
  const hasPendingShapes = pendingShapeCount > 0;

  const assignedShapeCount = useMemo(
    () => shapeList.filter((shape) => assignedSiteByShape.has(shape.id)).length,
    [assignedSiteByShape, shapeList],
  );

  const unassignedShapeCount = shapeList.length - assignedShapeCount;

  const filteredSites = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((site) => {
      const label =
        `${site.siteNumber ?? ""} ${site.name ?? ""} ${site.mapLabel ?? ""}`.toLowerCase();
      return label.includes(term);
    });
  }, [search, sites]);

  const filteredShapes = useMemo(() => {
    const term = shapeSearch.trim().toLowerCase();
    if (!term) return shapeList;
    return shapeList.filter((shape) => {
      const assignedSiteId = assignedSiteByShape.get(shape.id);
      const siteLabel = assignedSiteId ? (siteLabelById.get(assignedSiteId) ?? "") : "";
      const label = `${shape.name ?? ""} ${shape.id} ${siteLabel}`.toLowerCase();
      return label.includes(term);
    });
  }, [assignedSiteByShape, shapeList, shapeSearch, siteLabelById]);

  const viewBox = useMemo(() => {
    if (imageSize) {
      return { minX: 0, minY: 0, width: imageSize.width, height: imageSize.height };
    }
    const config = isRecord(mapData?.config) ? mapData?.config : undefined;
    const configBounds = getBoundsFromConfig(config?.bounds);
    if (configBounds) {
      return {
        minX: configBounds.minX,
        minY: configBounds.minY,
        width: configBounds.maxX - configBounds.minX,
        height: configBounds.maxY - configBounds.minY,
      };
    }
    const points = Array.from(mergedShapes.values()).flatMap((layout) =>
      geometryToPoints(layout.geometry),
    );
    if (points.length) {
      const minX = Math.min(...points.map((p) => p.x));
      const minY = Math.min(...points.map((p) => p.y));
      const maxX = Math.max(...points.map((p) => p.x));
      const maxY = Math.max(...points.map((p) => p.y));
      const width = maxX - minX || 100;
      const height = maxY - minY || 100;
      const pad = Math.max(width, height) * 0.04;
      return {
        minX: minX - pad,
        minY: minY - pad,
        width: width + pad * 2,
        height: height + pad * 2,
      };
    }
    return { minX: 0, minY: 0, width: 1000, height: 600 };
  }, [imageSize, mapData?.config, mergedShapes]);

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

  const getSvgPoint = (event: React.PointerEvent<SVGElement>, anchor?: Point | null) => {
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
        y: (event.clientY - rect.top - offsetY) / scale + viewBox.minY,
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
        y: Math.round(point.y / size) * size,
      };
    }
    return { x: roundPoint(point.x), y: roundPoint(point.y) };
  };

  const handleCanvasClick = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = getSvgPoint(event);
    if (!point) return;

    // Close quick-assign popup if open
    if (quickAssignShapeId) {
      closeQuickAssign();
    }

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
    const point = getSvgPoint(event);
    if (!point) return;

    // Handle different drag modes
    if (dragMode && initialPoints && dragStart) {
      if (dragMode === "vertex" && dragIndex !== null) {
        // Dragging a single vertex
        setEditingPoints((prev) => {
          if (!prev) return prev;
          const next = [...prev];
          next[dragIndex] = point;
          return next;
        });
      } else if (dragMode === "move") {
        // Moving the whole shape
        const delta = { x: point.x - dragStart.x, y: point.y - dragStart.y };
        setEditingPoints(translatePoints(initialPoints, delta));
      } else if (dragMode === "rotate") {
        // Rotating around center
        const center = centroidFromPoints(initialPoints) ?? getBoundingBox(initialPoints).center;
        const startAngle = Math.atan2(dragStart.y - center.y, dragStart.x - center.x);
        const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);
        const angleDelta = currentAngle - startAngle;
        setEditingPoints(rotatePoints(initialPoints, center, angleDelta));
      } else if (dragMode === "resize" && resizeCorner !== null) {
        // Scaling from opposite corner
        const bbox = getBoundingBox(initialPoints);
        const corners = [
          { x: bbox.min.x, y: bbox.min.y }, // TL - 0
          { x: bbox.max.x, y: bbox.min.y }, // TR - 1
          { x: bbox.max.x, y: bbox.max.y }, // BR - 2
          { x: bbox.min.x, y: bbox.max.y }, // BL - 3
        ];
        const anchor = corners[(resizeCorner + 2) % 4]; // Opposite corner
        const originalWidth = bbox.max.x - bbox.min.x;
        const originalHeight = bbox.max.y - bbox.min.y;

        const newWidth = Math.abs(point.x - anchor.x);
        const newHeight = Math.abs(point.y - anchor.y);

        const scaleX = originalWidth > 0 ? newWidth / originalWidth : 1;
        const scaleY = originalHeight > 0 ? newHeight / originalHeight : 1;

        // Scale from anchor point
        const scaled = initialPoints.map((p) => ({
          x:
            anchor.x +
            (p.x - anchor.x) *
              scaleX *
              (point.x < anchor.x ? -1 : 1) *
              (resizeCorner === 0 || resizeCorner === 3 ? -1 : 1),
          y:
            anchor.y +
            (p.y - anchor.y) *
              scaleY *
              (point.y < anchor.y ? -1 : 1) *
              (resizeCorner === 0 || resizeCorner === 1 ? -1 : 1),
        }));
        setEditingPoints(scaled);
      }
      return;
    }

    // Set hover point for preview
    if (!isDrawing) {
      setHoverPoint(point);
      return;
    }

    const anchor = draftPoints.length ? draftPoints[draftPoints.length - 1] : null;
    const snapPoint = getSvgPoint(event, anchor);
    setHoverPoint(snapPoint);
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
      toast({
        title: "Select a shape first",
        description: "Choose a shape to redraw.",
        variant: "destructive",
      });
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
      toast({
        title: "Add at least 3 points",
        description: "Polygons need three or more points.",
        variant: "destructive",
      });
      return;
    }
    const geometry = {
      type: "Polygon",
      coordinates: [points.map((p) => [p.x, p.y])],
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
        isNew,
      },
    }));
    setSelectedShapeId(shapeId);
    setIsDrawing(false);
    setDraftPoints([]);
    setHoverPoint(null);
    setDrawTargetId(null);
    setSelectedPreset("freeform"); // Reset preset so user can now edit the shape

    // Celebrate first shape
    if (existingShapes.length === 0 && Object.keys(draftShapes).length === 0) {
      triggerCelebration();
    }

    toast({
      title: "Shape created!",
      description: "Don't forget to save and assign it to a site.",
    });
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
      toast({
        title: "No shape selected",
        description: "Select a shape to duplicate.",
        variant: "destructive",
      });
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
        isNew: true,
      },
    }));
    setSelectedShapeId(draftId);
    toast({ title: "Shape duplicated", description: "Assign the new shape to a site when ready." });
    announce("Shape duplicated");
  };

  const commitEditing = (points: Point[]) => {
    if (!selectedShapeId || points.length < 3) return;
    const geometry = {
      type: "Polygon",
      coordinates: [points.map((p) => [p.x, p.y])],
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
        isNew: baseShape.isNew,
      },
    }));
    setEditingPoints(null);
    setDragIndex(null);
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!dragMode || !editingPoints) return;
    event.preventDefault();
    commitEditing(editingPoints);
    // Clear all drag state
    setDragMode(null);
    setDragStart(null);
    setInitialPoints(null);
    setResizeCorner(null);
  };

  // Close the quick-assign popup
  const closeQuickAssign = useCallback(() => {
    setQuickAssignShapeId(null);
    setQuickAssignPosition(null);
    setQuickAssignSearch("");
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
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
        setSnapToGrid((prev) => !prev);
        announce(snapToGrid ? "Snap disabled" : "Snap enabled");
        return;
      }

      // Toggle fullscreen
      if (event.key === "f" || event.key === "F") {
        setIsFullscreen((prev) => !prev);
        return;
      }

      // Show shortcuts
      if (event.key === "?") {
        setShowShortcuts(true);
        return;
      }

      if (event.key === "Escape") {
        if (quickAssignShapeId) {
          closeQuickAssign();
          return;
        }
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
        if (dragMode !== null) {
          setEditingPoints(null);
          setDragIndex(null);
          setDragMode(null);
          setDragStart(null);
          setInitialPoints(null);
          setResizeCorner(null);
          announce("Edit cancelled");
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
  }, [
    announce,
    dragIndex,
    handleFinish,
    handleUndo,
    isDrawing,
    showShortcuts,
    snapToGrid,
    quickAssignShapeId,
    closeQuickAssign,
  ]);

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
        metadata: shape.metadata,
      }));

      await apiClient.upsertCampgroundMapShapes(campgroundId, {
        shapes: shapesPayload,
      });
      toast({
        title: "Shapes saved!",
        description: `${entries.length} shape${entries.length > 1 ? "s" : ""} saved successfully.`,
      });
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

  const executeAssignment = async (
    siteId: string,
    shapeId: string,
    needsReassign: boolean,
    needsReplace: boolean,
  ) => {
    if (!campgroundId) return;
    const siteLabel = siteLabelById.get(siteId) ?? siteId;
    const shapeLabel = shapeLabelById.get(shapeId) ?? shapeId;
    const currentSiteForShape = assignedSiteByShape.get(shapeId);
    const currentShapeForSite = assignedShapeBySite.get(siteId);

    setAssigning(true);
    try {
      if (needsReassign && currentSiteForShape && currentSiteForShape !== siteId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, currentSiteForShape);
      }
      if (needsReplace && currentShapeForSite && currentShapeForSite !== shapeId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, siteId);
      }

      const site = sites.find((s) => s.id === siteId);
      const label = site?.mapLabel ?? site?.siteNumber ?? site?.name ?? null;
      await apiClient.upsertCampgroundMapAssignments(campgroundId, {
        assignments: [{ siteId, shapeId, label }],
      });
      toast({ title: "Assigned!", description: `${shapeLabel} mapped to ${siteLabel}.` });
      announce(`Shape assigned to ${siteLabel}`);
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assignment failed";
      toast({ title: "Assignment failed", description: message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignShape = async () => {
    if (!campgroundId) return;
    if (!selectedSiteId || !selectedShapeId) {
      toast({
        title: "Select a site and shape",
        description: "Choose both before assigning.",
        variant: "destructive",
      });
      return;
    }
    if (selectedShape?.isNew || draftShapes[selectedShapeId]?.isNew) {
      toast({
        title: "Save the shape first",
        description: "New shapes must be saved before assigning.",
      });
      return;
    }
    if (draftShapes[selectedShapeId]) {
      toast({
        title: "Save edits first",
        description: "Save shape edits before assigning so geometry is current.",
      });
      return;
    }

    const currentShapeForSite = selectedSiteAssignedShapeId;
    const currentSiteForShape = selectedShapeAssignedSiteId;
    const selectedSiteLabel = siteLabelById.get(selectedSiteId) ?? selectedSiteId;
    const selectedShapeLabel = shapeLabelById.get(selectedShapeId) ?? selectedShapeId;

    // Check if we need confirmations
    const needsReassign = !!(currentSiteForShape && currentSiteForShape !== selectedSiteId);
    const needsReplace = !!(currentShapeForSite && currentShapeForSite !== selectedShapeId);

    if (needsReassign) {
      const oldSiteLabel = siteLabelById.get(currentSiteForShape) ?? currentSiteForShape;
      setReassignConfirm({
        shapeId: selectedShapeId,
        siteId: selectedSiteId,
        shapeLabel: selectedShapeLabel,
        oldSiteLabel,
        newSiteLabel: selectedSiteLabel,
      });
      return;
    }

    if (needsReplace) {
      setReplaceConfirm({
        shapeId: selectedShapeId,
        siteId: selectedSiteId,
        shapeLabel: selectedShapeLabel,
        siteLabel: selectedSiteLabel,
      });
      return;
    }

    // No confirmations needed, proceed directly
    await executeAssignment(selectedSiteId, selectedShapeId, false, false);
  };

  const handleReassignConfirmed = async () => {
    if (!reassignConfirm) return;
    const { shapeId, siteId, shapeLabel, newSiteLabel } = reassignConfirm;
    setReassignConfirm(null);

    // Check if we also need replace confirmation
    const currentShapeForSite = assignedShapeBySite.get(siteId);
    if (currentShapeForSite && currentShapeForSite !== shapeId) {
      setReplaceConfirm({
        shapeId,
        siteId,
        shapeLabel,
        siteLabel: newSiteLabel,
      });
      return;
    }

    // No replace needed, proceed with assignment
    await executeAssignment(siteId, shapeId, true, false);
  };

  const handleReplaceConfirmed = async () => {
    if (!replaceConfirm) return;
    const { shapeId, siteId } = replaceConfirm;
    const currentSiteForShape = assignedSiteByShape.get(shapeId);
    const needsReassign = !!(currentSiteForShape && currentSiteForShape !== siteId);
    setReplaceConfirm(null);

    await executeAssignment(siteId, shapeId, needsReassign, true);
  };

  const handleUnassignSite = async () => {
    if (!campgroundId) return;
    if (!selectedSiteId) {
      toast({
        title: "Select a site",
        description: "Choose a site to unassign.",
        variant: "destructive",
      });
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

  const handleShapeClick = (shapeId: string, event: React.PointerEvent<SVGPathElement>) => {
    // Select the shape
    setSelectedShapeId(shapeId);

    // Check if shape is unassigned - if so, show quick assign popup
    const isAssigned = assignedSiteByShape.has(shapeId);
    const isDraft = draftShapes[shapeId]?.isNew;

    if (!isAssigned && !isDraft) {
      // Get click position for popup
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        setQuickAssignPosition({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
        setQuickAssignShapeId(shapeId);
        setQuickAssignSearch("");
      }
    } else {
      setQuickAssignShapeId(null);
      setQuickAssignPosition(null);
    }
  };

  const handleQuickAssign = async (siteId: string) => {
    if (!campgroundId || !quickAssignShapeId) return;

    const shapeId = quickAssignShapeId;
    const shape = mergedShapes.get(shapeId);

    if (shape?.isNew || draftShapes[shapeId]?.isNew) {
      toast({
        title: "Save the shape first",
        description: "New shapes must be saved before assigning.",
      });
      return;
    }
    if (draftShapes[shapeId]) {
      toast({
        title: "Save edits first",
        description: "Save shape edits before assigning so geometry is current.",
      });
      return;
    }

    const currentShapeForSite = assignedShapeBySite.get(siteId);
    const siteLabel = siteLabelById.get(siteId) ?? siteId;
    const shapeLabel = shapeLabelById.get(shapeId) ?? shapeId;

    if (currentShapeForSite && currentShapeForSite !== shapeId) {
      setQuickReplaceConfirm({
        shapeId,
        siteId,
        shapeLabel,
        siteLabel,
      });
      return;
    }

    // No confirmation needed, proceed directly
    await executeQuickAssign(siteId, shapeId, false);
  };

  const executeQuickAssign = async (siteId: string, shapeId: string, needsReplace: boolean) => {
    if (!campgroundId) return;
    const siteLabel = siteLabelById.get(siteId) ?? siteId;
    const shapeLabel = shapeLabelById.get(shapeId) ?? shapeId;
    const currentShapeForSite = assignedShapeBySite.get(siteId);

    setAssigning(true);
    try {
      if (needsReplace && currentShapeForSite && currentShapeForSite !== shapeId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, siteId);
      }

      const site = sites.find((s) => s.id === siteId);
      const label = site?.mapLabel ?? site?.siteNumber ?? site?.name ?? null;
      await apiClient.upsertCampgroundMapAssignments(campgroundId, {
        assignments: [{ siteId, shapeId, label }],
      });
      toast({ title: "Assigned!", description: `${shapeLabel} mapped to ${siteLabel}.` });
      announce(`Shape assigned to ${siteLabel}`);
      setSelectedSiteId(siteId);
      onSaved?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assignment failed";
      toast({ title: "Assignment failed", description: message, variant: "destructive" });
    } finally {
      setAssigning(false);
      setQuickAssignShapeId(null);
      setQuickAssignPosition(null);
    }
  };

  const handleQuickReplaceConfirmed = async () => {
    if (!quickReplaceConfirm) return;
    const { shapeId, siteId } = quickReplaceConfirm;
    setQuickReplaceConfirm(null);
    await executeQuickAssign(siteId, shapeId, true);
  };

  // Filter sites for quick assign popup
  const quickAssignSites = useMemo(() => {
    const term = quickAssignSearch.trim().toLowerCase();
    const filtered = term
      ? sites.filter((site) => {
          const label =
            `${site.siteNumber ?? ""} ${site.name ?? ""} ${site.mapLabel ?? ""}`.toLowerCase();
          return label.includes(term);
        })
      : sites;
    // Show unassigned sites first
    return [...filtered].sort((a, b) => {
      const aAssigned = assignedSiteIds.has(a.id);
      const bAssigned = assignedSiteIds.has(b.id);
      if (aAssigned === bAssigned) return 0;
      return aAssigned ? 1 : -1;
    });
  }, [sites, quickAssignSearch, assignedSiteIds]);

  const handleDeleteShape = async () => {
    if (!campgroundId) return;
    if (!selectedShapeId) {
      toast({
        title: "Select a shape",
        description: "Choose a shape to delete.",
        variant: "destructive",
      });
      return;
    }
    const draftShape = draftShapes[selectedShapeId];
    const isDraftOnly =
      draftShape?.isNew && !existingShapes.find((shape) => shape.id === selectedShapeId);
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
    const assignedLabel = assignedSiteId
      ? (siteLabelById.get(assignedSiteId) ?? assignedSiteId)
      : null;

    setDeleteShapeConfirm({
      shapeId: selectedShapeId,
      shapeLabel,
      assignedSiteLabel: assignedLabel,
    });
  };

  const handleDeleteShapeConfirmed = async () => {
    if (!deleteShapeConfirm || !campgroundId) return;
    const { shapeId } = deleteShapeConfirm;
    const assignedSiteId = assignedSiteByShape.get(shapeId);
    setDeleteShapeConfirm(null);

    setAssigning(true);
    try {
      if (assignedSiteId) {
        await apiClient.unassignCampgroundMapSite(campgroundId, assignedSiteId);
      }
      await apiClient.deleteCampgroundMapShape(campgroundId, shapeId);
      setDraftShapes((prev) => {
        const next = { ...prev };
        delete next[shapeId];
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
      <div className={cn("rounded-xl border border-border bg-muted p-8 text-center", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Loading map editor...</p>
      </div>
    );
  }

  if (!baseImageUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center",
          className,
        )}
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-status-success/15 flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-status-success" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">Ready to map your campground?</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Upload a map image above to get started. You'll be able to draw site boundaries and assign
          them to your sites.
        </p>
      </motion.div>
    );
  }

  const containerClasses = cn(
    isFullscreen
      ? "fixed inset-0 z-50 bg-card p-4 shadow-2xl"
      : "rounded-xl border border-border bg-card p-4",
    className,
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
            <div className="text-base font-semibold text-foreground">Site Map Editor</div>
            <p className="text-sm text-muted-foreground">
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
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 mr-1.5" />
              ) : (
                <Maximize2 className="h-4 w-4 mr-1.5" />
              )}
              {isFullscreen ? "Exit" : "Fullscreen"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPanels((prev) => !prev)}
              className="transition-transform active:scale-95"
            >
              {showPanels ? (
                <PanelLeftClose className="h-4 w-4 mr-1.5" />
              ) : (
                <PanelLeft className="h-4 w-4 mr-1.5" />
              )}
              {showPanels ? "Hide" : "Show"} Panels
            </Button>
          </div>
        </div>

        {/* Preset Shape Toolbar */}
        <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted rounded-lg border border-border">
          <span className="text-xs font-medium text-muted-foreground mr-2">Quick Shapes:</span>
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
                      ? "bg-status-success hover:bg-status-success/90 text-status-success-foreground shadow-md scale-105"
                      : "hover:border-status-success/50",
                  )}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Press {key} for quick access</TooltipContent>
            </Tooltip>
          ))}

          <div className="h-6 w-px bg-muted mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={isDrawing ? "default" : "outline"}
                onClick={() => handleStartDraw(null)}
                disabled={isDrawing}
                className={cn(
                  "transition-all",
                  isDrawing && "bg-status-info hover:bg-status-info/90 text-status-info-foreground",
                )}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Freeform
              </Button>
            </TooltipTrigger>
            <TooltipContent>Draw custom polygon shapes</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-muted mx-2" />

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
              <div className="h-6 w-px bg-muted mx-2" />
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndo}
                disabled={draftPoints.length === 0}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Undo
              </Button>
              <Button
                size="sm"
                onClick={handleFinish}
                disabled={draftPoints.length < 3}
                className="bg-status-success hover:bg-status-success/90 text-status-success-foreground"
              >
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
            isFullscreen && "h-[calc(100vh-200px)]",
          )}
        >
          {showPanels && (
            <div className={cn("space-y-4", isFullscreen && "h-full overflow-auto pr-1")}>
              {/* Shapes Panel */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Shapes
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {assignedShapeCount} assigned
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {unassignedShapeCount} free
                    </Badge>
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
                    const assignedLabel = assignedSiteId
                      ? (siteLabelById.get(assignedSiteId) ?? assignedSiteId)
                      : "Unassigned";
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
                            ? "border-blue-400 bg-blue-50 shadow-sm"
                            : "border-border hover:border-blue-300 hover:bg-muted",
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {assignedSiteId ? `→ ${assignedLabel}` : "Unassigned"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isDraft && (
                            <Badge variant="secondary" className="text-[10px]">
                              Draft
                            </Badge>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                  {!filteredShapes.length && (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center">
                      <p className="text-xs text-muted-foreground">No shapes yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use the toolbar above to create shapes
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDuplicateShape}
                        disabled={!selectedGeometry || assigning}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Duplicate shape</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDeleteShape}
                        disabled={!selectedShapeId || assigning}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete shape</TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    onClick={handleSaveShapes}
                    disabled={savingShapes || !hasPendingShapes}
                    className="ml-auto bg-status-success hover:bg-status-success/90 text-white transition-transform active:scale-95"
                  >
                    {savingShapes ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Save {hasPendingShapes && `(${pendingShapeCount})`}
                  </Button>
                </div>
              </motion.div>

              {/* Sites Panel */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Site Assignments
                  </div>
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
                    const shapeLabel = assignedShapeId
                      ? (shapeLabelById.get(assignedShapeId) ?? assignedShapeId)
                      : null;
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
                            ? "border-emerald-400 bg-emerald-50 shadow-sm"
                            : "border-border hover:border-status-success/50 hover:bg-muted",
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {shapeLabel ? `← ${shapeLabel}` : "No shape assigned"}
                          </span>
                        </div>
                        <Badge
                          variant={isMapped ? "default" : "secondary"}
                          className={cn(
                            "text-[10px]",
                            isMapped && "bg-status-success/15 text-status-success",
                          )}
                        >
                          {isMapped ? "Mapped" : "Unmapped"}
                        </Badge>
                      </motion.button>
                    );
                  })}
                  {!filteredSites.length && (
                    <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground text-center">
                      No matching sites
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-border">
                  <Button
                    size="sm"
                    onClick={handleAssignShape}
                    disabled={!selectedSiteId || !selectedShapeId || assigning}
                    className="bg-status-success hover:bg-status-success/90 text-status-success-foreground transition-transform active:scale-95"
                  >
                    {assigning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    )}
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
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Select a shape and site, then click Assign to link them.
                </p>
              </motion.div>
            </div>
          )}

          {/* Canvas */}
          <div
            className={cn(
              "relative rounded-xl border border-border bg-muted p-2",
              isFullscreen && "h-full",
            )}
          >
            <svg
              ref={svgRef}
              viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
              className={cn(
                isFullscreen ? "h-full w-full" : "h-[620px] w-full",
                isDrawing && "cursor-crosshair",
                selectedPreset !== "freeform" && !isDrawing && "cursor-copy",
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
                        className={cn(
                          "transition-all duration-150",
                          !isDrawing &&
                            "cursor-pointer hover:opacity-100 hover:stroke-blue-500 hover:stroke-[3]",
                        )}
                        style={{ pointerEvents: isDrawing ? "none" : "auto" }}
                        onPointerDown={(e) => {
                          if (isDrawing) return;
                          e.stopPropagation();
                          handleShapeClick(shape.id, e);
                        }}
                      />
                      {/* Show site label on assigned shapes */}
                      {siteLabel && centroid && (
                        <text
                          x={centroid.x}
                          y={centroid.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-status-success text-[12px] font-semibold pointer-events-none"
                          style={{ textShadow: "0 1px 2px rgba(255,255,255,0.8)" }}
                        >
                          {siteLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

              {/* Selected shape - clickable for moving */}
              {activePoints.length >= 3 && !isDrawing && (
                <path
                  d={pointsToPath(activePoints, true)}
                  fill="rgba(59,130,246,0.25)"
                  stroke="#2563eb"
                  strokeWidth={3}
                  className="drop-shadow-sm cursor-move"
                  style={{ cursor: "move" }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    const point = getSvgPoint(event);
                    if (!point || !pointInPolygon(point, activePoints)) return;
                    setEditingPoints([...activePoints]);
                    setInitialPoints([...activePoints]);
                    setDragStart(point);
                    setDragMode("move");
                    event.currentTarget.setPointerCapture(event.pointerId);
                    announce("Drag to move shape");
                  }}
                />
              )}

              {/* Selected shape outline when drawing (non-interactive) */}
              {activePoints.length >= 3 && isDrawing && (
                <path
                  d={pointsToPath(activePoints, true)}
                  fill="rgba(59,130,246,0.15)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  className="pointer-events-none"
                />
              )}

              {/* Draft polygon being drawn */}
              {draftPolygon && (
                <path
                  d={draftPolygon}
                  fill="rgba(59,130,246,0.2)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                />
              )}
              {draftLine && (
                <path
                  d={draftLine}
                  fill="none"
                  stroke="#2563eb"
                  strokeDasharray="4 3"
                  strokeWidth={2}
                />
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

              {/* Transform controls for selected shape */}
              {!isDrawing &&
                activePoints.length >= 3 &&
                (() => {
                  const bbox = getBoundingBox(activePoints);
                  const center = centroidFromPoints(activePoints) ?? bbox.center;
                  const handleSize = Math.min(viewBox.width, viewBox.height) * 0.012;
                  const rotateHandleDistance = handleSize * 4;

                  // Corner positions for resize handles
                  const corners = [
                    { x: bbox.min.x, y: bbox.min.y, cursor: "nwse-resize" }, // TL
                    { x: bbox.max.x, y: bbox.min.y, cursor: "nesw-resize" }, // TR
                    { x: bbox.max.x, y: bbox.max.y, cursor: "nwse-resize" }, // BR
                    { x: bbox.min.x, y: bbox.max.y, cursor: "nesw-resize" }, // BL
                  ];

                  return (
                    <g>
                      {/* Bounding box outline */}
                      <rect
                        x={bbox.min.x}
                        y={bbox.min.y}
                        width={bbox.max.x - bbox.min.x}
                        height={bbox.max.y - bbox.min.y}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={1}
                        strokeDasharray="4 2"
                        className="pointer-events-none"
                      />

                      {/* Rotation handle - above center */}
                      <g>
                        {/* Line from center to rotation handle */}
                        <line
                          x1={center.x}
                          y1={bbox.min.y}
                          x2={center.x}
                          y2={bbox.min.y - rotateHandleDistance}
                          stroke="#94a3b8"
                          strokeWidth={1}
                          strokeDasharray="2 2"
                          className="pointer-events-none"
                        />
                        {/* Rotation handle circle */}
                        <circle
                          cx={center.x}
                          cy={bbox.min.y - rotateHandleDistance}
                          r={handleSize}
                          fill="#f97316"
                          stroke="#fff"
                          strokeWidth={2}
                          className="cursor-grab"
                          style={{ cursor: "grab" }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            const point = getSvgPoint(event);
                            if (!point) return;
                            setEditingPoints([...activePoints]);
                            setInitialPoints([...activePoints]);
                            setDragStart(point);
                            setDragMode("rotate");
                            event.currentTarget.setPointerCapture(event.pointerId);
                            announce("Drag to rotate shape");
                          }}
                        />
                        {/* Rotation icon indicator */}
                        <text
                          x={center.x}
                          y={bbox.min.y - rotateHandleDistance}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-white text-[8px] font-bold pointer-events-none select-none"
                          style={{ fontSize: handleSize * 0.8 }}
                        >
                          ↻
                        </text>
                      </g>

                      {/* Resize handles at corners */}
                      {corners.map((corner, idx) => (
                        <rect
                          key={`resize-${idx}`}
                          x={corner.x - handleSize / 2}
                          y={corner.y - handleSize / 2}
                          width={handleSize}
                          height={handleSize}
                          fill="#8b5cf6"
                          stroke="#fff"
                          strokeWidth={2}
                          rx={2}
                          style={{ cursor: corner.cursor }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            const point = getSvgPoint(event);
                            if (!point) return;
                            setEditingPoints([...activePoints]);
                            setInitialPoints([...activePoints]);
                            setDragStart(point);
                            setDragMode("resize");
                            setResizeCorner(idx);
                            event.currentTarget.setPointerCapture(event.pointerId);
                            announce("Drag to resize shape");
                          }}
                        />
                      ))}

                      {/* Center move handle */}
                      <circle
                        cx={center.x}
                        cy={center.y}
                        r={handleSize * 1.2}
                        fill="#3b82f6"
                        stroke="#fff"
                        strokeWidth={2}
                        className="cursor-move"
                        style={{ cursor: "move" }}
                        onPointerDown={(event) => {
                          event.stopPropagation();
                          const point = getSvgPoint(event);
                          if (!point) return;
                          setEditingPoints([...activePoints]);
                          setInitialPoints([...activePoints]);
                          setDragStart(point);
                          setDragMode("move");
                          event.currentTarget.setPointerCapture(event.pointerId);
                          announce("Drag to move shape");
                        }}
                      />
                      {/* Move icon */}
                      <text
                        x={center.x}
                        y={center.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white text-[8px] font-bold pointer-events-none select-none"
                        style={{ fontSize: handleSize * 0.8 }}
                      >
                        ✥
                      </text>
                    </g>
                  );
                })()}

              {/* Vertex handles for selected shape */}
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
                    className="cursor-crosshair"
                    style={{ cursor: "crosshair" }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (!activePoints.length) return;
                      setEditingPoints([...activePoints]);
                      setInitialPoints([...activePoints]);
                      setDragStart(getSvgPoint(event));
                      setDragIndex(idx);
                      setDragMode("vertex");
                      event.currentTarget.setPointerCapture(event.pointerId);
                      announce("Drag to adjust vertex");
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

            {/* Quick Assign Popup */}
            <AnimatePresence>
              {quickAssignShapeId && quickAssignPosition && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute z-50 bg-card rounded-xl shadow-2xl border border-border p-3 w-64"
                  style={{
                    left: Math.min(
                      quickAssignPosition.x,
                      (svgRef.current?.getBoundingClientRect()?.width ?? 300) - 280,
                    ),
                    top: Math.min(
                      quickAssignPosition.y + 10,
                      (svgRef.current?.getBoundingClientRect()?.height ?? 400) - 300,
                    ),
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-status-success" />
                      Assign to Site
                    </span>
                    <button
                      onClick={closeQuickAssign}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  <Input
                    placeholder="Search sites..."
                    value={quickAssignSearch}
                    onChange={(e) => setQuickAssignSearch(e.target.value)}
                    className="mb-2 h-8 text-sm"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-auto space-y-1">
                    {quickAssignSites.slice(0, 20).map((site) => {
                      const isMapped = assignedSiteIds.has(site.id);
                      const label = site.siteNumber || site.mapLabel || site.name || site.id;
                      return (
                        <button
                          key={site.id}
                          onClick={() => handleQuickAssign(site.id)}
                          disabled={assigning}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-left transition-all",
                            "hover:bg-status-success/10 hover:border-status-success/50",
                            "border border-transparent",
                            isMapped && "opacity-60",
                          )}
                        >
                          <span className="font-medium text-foreground truncate">{label}</span>
                          {isMapped ? (
                            <Badge variant="secondary" className="text-[10px] ml-2 shrink-0">
                              Mapped
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] ml-2 shrink-0 text-status-success border-status-success/50"
                            >
                              Available
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                    {quickAssignSites.length === 0 && (
                      <div className="text-center py-3 text-sm text-muted-foreground">
                        No matching sites
                      </div>
                    )}
                    {quickAssignSites.length > 20 && (
                      <div className="text-center py-2 text-xs text-muted-foreground">
                        +{quickAssignSites.length - 20} more (search to filter)
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Reassign Shape Confirmation Dialog */}
      <AlertDialog
        open={!!reassignConfirm}
        onOpenChange={(open) => !open && setReassignConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign Shape</AlertDialogTitle>
            <AlertDialogDescription>
              "{reassignConfirm?.shapeLabel}" is already assigned to {reassignConfirm?.oldSiteLabel}
              . Do you want to reassign it to {reassignConfirm?.newSiteLabel}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReassignConfirmed}>Reassign Shape</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace Shape Confirmation Dialog */}
      <AlertDialog
        open={!!replaceConfirm}
        onOpenChange={(open) => !open && setReplaceConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Shape</AlertDialogTitle>
            <AlertDialogDescription>
              "{replaceConfirm?.siteLabel}" already has a shape assigned. Do you want to replace it
              with "{replaceConfirm?.shapeLabel}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplaceConfirmed}>Replace Shape</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick Replace Shape Confirmation Dialog */}
      <AlertDialog
        open={!!quickReplaceConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setQuickReplaceConfirm(null);
            setQuickAssignShapeId(null);
            setQuickAssignPosition(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace Shape</AlertDialogTitle>
            <AlertDialogDescription>
              "{quickReplaceConfirm?.siteLabel}" already has a shape. Do you want to replace it with
              "{quickReplaceConfirm?.shapeLabel}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuickReplaceConfirmed}>
              Replace Shape
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Shape Confirmation Dialog */}
      <AlertDialog
        open={!!deleteShapeConfirm}
        onOpenChange={(open) => !open && setDeleteShapeConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shape</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteShapeConfirm?.assignedSiteLabel
                ? `Delete "${deleteShapeConfirm?.shapeLabel}"? It is assigned to ${deleteShapeConfirm?.assignedSiteLabel} and will be unassigned.`
                : `Are you sure you want to delete "${deleteShapeConfirm?.shapeLabel}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShapeConfirmed}
              className="bg-status-error hover:bg-status-error/90"
            >
              Delete Shape
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
