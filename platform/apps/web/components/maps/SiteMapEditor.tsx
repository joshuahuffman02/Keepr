"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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
};

type ShapeDraft = {
  id: string;
  name?: string | null;
  geometry: any;
  centroid?: any;
  metadata?: any;
  isNew?: boolean;
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

export function SiteMapEditor({
  campgroundId,
  mapData,
  baseImageUrl,
  sites,
  isLoading,
  onSaved,
  className
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
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scale = Math.min(rect.width / viewBox.width, rect.height / viewBox.height);
    const contentWidth = viewBox.width * scale;
    const contentHeight = viewBox.height * scale;
    const offsetX = (rect.width - contentWidth) / 2;
    const offsetY = (rect.height - contentHeight) / 2;
    let x = (event.clientX - rect.left - offsetX) / scale + viewBox.minX;
    let y = (event.clientY - rect.top - offsetY) / scale + viewBox.minY;
    x = clampValue(x, viewBox.minX, viewBox.minX + viewBox.width);
    y = clampValue(y, viewBox.minY, viewBox.minY + viewBox.height);
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

  const handleCanvasPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    if (dragIndex !== null) return;
    const anchor = draftPoints.length ? draftPoints[draftPoints.length - 1] : null;
    const point = getSvgPoint(event, anchor);
    if (!point) return;
    setDraftPoints((prev) => [...prev, point]);
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
    setIsDrawing(true);
    setDrawTargetId(targetId ?? null);
    setDraftPoints([]);
    setHoverPoint(null);
    setEditingPoints(null);
    setDragIndex(null);
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

  const handleFinish = () => {
    if (draftPoints.length < 3) {
      toast({ title: "Add at least 3 points", description: "Polygons need three or more points.", variant: "destructive" });
      return;
    }
    const geometry = {
      type: "Polygon",
      coordinates: [draftPoints.map((p) => [p.x, p.y])]
    };
    const centroid = centroidFromPoints(draftPoints);
    const targetId = drawTargetId ?? createDraftId();
    const baseShape = mergedShapes.get(targetId);
    const isNew = baseShape?.isNew ?? !existingShapes.find((shape) => shape.id === targetId);
    const name = baseShape?.name ?? (isNew ? `Shape ${nextShapeIndex}` : null);

    setDraftShapes((prev) => ({
      ...prev,
      [targetId]: {
        id: targetId,
        name,
        geometry,
        centroid,
        metadata: baseShape?.metadata,
        isNew
      }
    }));
    setSelectedShapeId(targetId);
    setIsDrawing(false);
    setDraftPoints([]);
    setHoverPoint(null);
    setDrawTargetId(null);
  };

  const handleUndo = () => {
    setDraftPoints((prev) => prev.slice(0, -1));
  };

  const handleClearDraft = () => {
    setDraftPoints([]);
    setHoverPoint(null);
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
    if (dragIndex === null || !editingPoints) return;
    event.preventDefault();
    commitEditing(editingPoints);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "Escape") {
        if (isDrawing) {
          setIsDrawing(false);
          setDraftPoints([]);
          setHoverPoint(null);
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
  }, [dragIndex, handleFinish, handleUndo, isDrawing]);

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
      toast({ title: "Shapes saved", description: "Shape library updated." });
      setDraftShapes({});
      if (hasNewShapes) {
        setSelectedShapeId("");
      }
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
      toast({ title: "Assigned", description: `${selectedShapeLabel} mapped to ${selectedSiteLabel}.` });
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
      <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500", className)}>
        Loading map editor...
      </div>
    );
  }

  if (!baseImageUrl) {
    return (
      <div className={cn("rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500", className)}>
        Upload a map image to enable polygon drawing.
      </div>
    );
  }

  const containerClasses = cn(
    isFullscreen
      ? "fixed inset-0 z-50 bg-white p-4 shadow-2xl"
      : "rounded-xl border border-slate-200 bg-white p-4",
    className
  );

  return (
    <div className={containerClasses}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">Site map editor</div>
          <p className="text-xs text-slate-500">
            Draw polygons first, then assign them to sites. Drag points to fine-tune placement.
          </p>
          <p className="text-[11px] text-slate-400">Enter: finish | Esc: cancel | Shift: lock 45-degree angles.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsFullscreen((prev) => !prev)}>
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleStartDraw(null)} disabled={isDrawing}>
            Draw new shape
          </Button>
          <Button size="sm" variant="outline" onClick={handleRedrawSelected} disabled={!selectedShapeId || isDrawing}>
            Redraw selected
          </Button>
          <Button size="sm" variant="outline" onClick={handleUndo} disabled={!isDrawing || draftPoints.length === 0}>
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={handleClearDraft} disabled={!isDrawing || draftPoints.length === 0}>
            Clear
          </Button>
          <Button size="sm" onClick={handleFinish} disabled={!isDrawing}>
            Finish
          </Button>
          <Button size="sm" variant={snapToGrid ? "default" : "outline"} onClick={() => setSnapToGrid((prev) => !prev)}>
            Snap {snapToGrid ? "On" : "Off"}
          </Button>
          <Input
            type="number"
            min={1}
            max={200}
            value={gridSize}
            onChange={(e) => setGridSize(clampGrid(Number(e.target.value) || 1))}
            className="h-8 w-20"
            disabled={!snapToGrid}
          />
          {isDrawing && <Badge variant="secondary">{draftPoints.length} pts</Badge>}
        </div>
      </div>

      <div
        className={cn(
          "mt-4 grid gap-4 lg:grid-cols-[320px,1fr]",
          isFullscreen && "h-[calc(100vh-180px)]"
        )}
      >
        <div className={cn("space-y-4", isFullscreen && "h-full overflow-auto pr-1")}>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Shapes</div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{assignedShapeCount} assigned</Badge>
                <Badge variant="outline">{unassignedShapeCount} free</Badge>
              </div>
            </div>
            <Input
              placeholder="Search shapes"
              value={shapeSearch}
              onChange={(e) => setShapeSearch(e.target.value)}
              className="mt-2"
            />
            <div className="mt-2 max-h-[240px] space-y-1 overflow-auto pr-1">
              {filteredShapes.map((shape) => {
                const assignedSiteId = assignedSiteByShape.get(shape.id);
                const assignedLabel = assignedSiteId ? siteLabelById.get(assignedSiteId) ?? assignedSiteId : "Unassigned";
                const isActive = selectedShapeId === shape.id;
                const isDraft = Boolean(draftShapes[shape.id]);
                const label = shapeLabelById.get(shape.id) ?? shape.id;
                return (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => setSelectedShapeId(shape.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      isActive ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{label}</span>
                      <span className="text-xs text-slate-500">
                        {assignedSiteId ? `Assigned to ${assignedLabel}` : "Unassigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {isDraft && <Badge variant="secondary">Draft</Badge>}
                      <Badge variant={assignedSiteId ? "default" : "secondary"}>{assignedSiteId ? "Assigned" : "Free"}</Badge>
                    </div>
                  </button>
                );
              })}
              {!filteredShapes.length && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                  No matching shapes.
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleDuplicateShape} disabled={!selectedGeometry || assigning}>
                Duplicate
              </Button>
              <Button size="sm" variant="outline" onClick={handleDeleteShape} disabled={!selectedShapeId || assigning}>
                Delete
              </Button>
              <Button size="sm" onClick={handleSaveShapes} disabled={savingShapes || !hasPendingShapes}>
                {savingShapes ? "Saving..." : "Save shapes"}
              </Button>
              {hasPendingShapes && <Badge variant="secondary">{pendingShapeCount} pending</Badge>}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Site assignments</div>
              <Badge variant="secondary">
                {assignedSiteIds.size}/{sites.length} mapped
              </Badge>
            </div>
            <Input
              placeholder="Search sites"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2"
            />
            <div className="mt-2 max-h-[280px] space-y-1 overflow-auto pr-1">
              {filteredSites.map((site) => {
                const isMapped = assignedSiteIds.has(site.id);
                const isActive = selectedSiteId === site.id;
                const assignedShapeId = assignedShapeBySite.get(site.id);
                const shapeLabel = assignedShapeId ? shapeLabelById.get(assignedShapeId) ?? assignedShapeId : null;
                const label = site.siteNumber || site.mapLabel || site.name || site.id;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => setSelectedSiteId(site.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition",
                      isActive ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-emerald-300"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800">{label}</span>
                      <span className="text-xs text-slate-500">
                        {shapeLabel ? `Shape: ${shapeLabel}` : site.name ?? "No shape assigned"}
                      </span>
                    </div>
                    <Badge variant={isMapped ? "default" : "secondary"}>{isMapped ? "Mapped" : "Unmapped"}</Badge>
                  </button>
                );
              })}
              {!filteredSites.length && (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                  No matching sites.
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleAssignShape}
                disabled={!selectedSiteId || !selectedShapeId || assigning}
              >
                {assigning ? "Working..." : "Assign selected"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnassignSite}
                disabled={!selectedSiteId || !selectedSiteAssignedShapeId || assigning}
              >
                Unassign
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Select a shape and site to assign. Shapes can only be used once.
            </p>
          </div>
        </div>

        <div className={cn("rounded-xl border border-slate-200 bg-slate-50 p-2", isFullscreen && "h-full")}>
          <svg
            ref={svgRef}
            viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
            className={cn(isFullscreen ? "h-full w-full" : "h-[620px] w-full")}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => setHoverPoint(null)}
            onPointerDown={handleCanvasPointerDown}
            role="img"
            aria-label="Site map editor canvas"
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

            {shapeList
              .filter((shape) => shape.id !== selectedShapeId)
              .map((shape) => {
                const points = geometryToPoints(shape.geometry);
                if (points.length < 2) return null;
                const assignedSiteId = assignedSiteByShape.get(shape.id);
                const isAssigned = Boolean(assignedSiteId);
                const isDraft = Boolean(draftShapes[shape.id]);
                return (
                  <path
                    key={shape.id}
                    d={pointsToPath(points, true)}
                    fill={isAssigned ? "rgba(14,165,233,0.16)" : "rgba(148,163,184,0.12)"}
                    stroke={isAssigned ? "#0ea5e9" : "#94a3b8"}
                    strokeWidth={isAssigned ? 1.6 : 1.2}
                    strokeDasharray={isAssigned ? undefined : "4 3"}
                    opacity={isDraft ? 0.95 : 0.8}
                  />
                );
              })}

            {activePoints.length >= 3 && (
              <path d={pointsToPath(activePoints, true)} fill="rgba(16,185,129,0.16)" stroke="#10b981" strokeWidth={2.4} />
            )}

            {draftPolygon && (
              <path d={draftPolygon} fill="rgba(59,130,246,0.2)" stroke="#2563eb" strokeWidth={2.2} />
            )}
            {draftLine && (
              <path d={draftLine} fill="none" stroke="#2563eb" strokeDasharray="4 3" strokeWidth={1.6} />
            )}
            {draftPoints.map((point, idx) => (
              <circle key={`${point.x}-${point.y}-${idx}`} cx={point.x} cy={point.y} r={3.2} fill="#2563eb" />
            ))}
            {!isDrawing &&
              activePoints.map((point, idx) => (
                <circle
                  key={`handle-${point.x}-${point.y}-${idx}`}
                  cx={point.x}
                  cy={point.y}
                  r={4}
                  fill="#10b981"
                  stroke="#0f766e"
                  strokeWidth={1}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (!activePoints.length) return;
                    setEditingPoints([...activePoints]);
                    setDragIndex(idx);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                />
              ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
