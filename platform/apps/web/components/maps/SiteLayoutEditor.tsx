"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tent,
  Caravan,
  Home,
  Users,
  Sparkles,
  Trees,
  Waves,
  Car,
  Trash2,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Plus,
  Minus,
  Grid3X3,
  Layers,
  MousePointer,
  Square,
  Circle,
  Undo,
  Redo,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Copy,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Types
export type SiteType = "rv" | "tent" | "cabin" | "glamping" | "group";
export type ElementType = "site" | "road" | "building" | "amenity" | "tree" | "water" | "parking";

export interface LayoutSite {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  siteNumber: string;
  siteType: SiteType;
  siteClassId?: string;
  color?: string;
  isLocked?: boolean;
  isHidden?: boolean;
}

export interface LayoutElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  color?: string;
  isLocked?: boolean;
  isHidden?: boolean;
  points?: { x: number; y: number }[]; // For roads/paths
}

export interface LayoutData {
  sites: LayoutSite[];
  elements: LayoutElement[];
  backgroundImage?: string;
  gridSize: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SiteLayoutEditorProps {
  initialData?: Partial<LayoutData>;
  siteClasses?: { id: string; name: string; color: string }[];
  onSave?: (data: LayoutData) => void;
  onSiteClick?: (site: LayoutSite) => void;
  onBackgroundImageChange?: (imageUrl: string) => void;
  backgroundImageUrl?: string | null;
  readOnly?: boolean;
  height?: string | number;
  className?: string;
}

// Constants
const SITE_TYPE_ICONS: Record<SiteType, any> = {
  rv: Caravan,
  tent: Tent,
  cabin: Home,
  glamping: Sparkles,
  group: Users,
};

const SITE_TYPE_COLORS: Record<SiteType, string> = {
  rv: "#3b82f6",
  tent: "#22c55e",
  cabin: "#f59e0b",
  glamping: "#a855f7",
  group: "#ec4899",
};

const ELEMENT_COLORS: Record<ElementType, string> = {
  site: "#10b981",
  road: "#6b7280",
  building: "#8b5cf6",
  amenity: "#06b6d4",
  tree: "#22c55e",
  water: "#0ea5e9",
  parking: "#64748b",
};

const DEFAULT_SITE_SIZE = { width: 60, height: 40 };
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

type Tool = "select" | "site" | "road" | "building" | "tree" | "water" | "parking" | "pan";

export function SiteLayoutEditor({
  initialData,
  siteClasses = [],
  onSave,
  onSiteClick,
  onBackgroundImageChange,
  backgroundImageUrl,
  readOnly = false,
  height = "700px",
  className,
}: SiteLayoutEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);

  // State
  const [sites, setSites] = useState<LayoutSite[]>(initialData?.sites || []);
  const [elements, setElements] = useState<LayoutElement[]>(initialData?.elements || []);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [selectedSiteType, setSelectedSiteType] = useState<SiteType>("rv");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(initialData?.gridSize || 20);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: "site" | "element"; startX: number; startY: number } | null>(null);
  const [history, setHistory] = useState<{ sites: LayoutSite[]; elements: LayoutElement[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showLayers, setShowLayers] = useState(true);
  const [nextSiteNumber, setNextSiteNumber] = useState(1);
  const [showBackgroundImage, setShowBackgroundImage] = useState(true);
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.5);
  const [backgroundScale, setBackgroundScale] = useState(1);
  const [backgroundOffset, setBackgroundOffset] = useState({ x: 0, y: 0 });

  const canvasWidth = initialData?.canvasWidth || 1200;
  const canvasHeight = initialData?.canvasHeight || 800;
  const heightStyle = typeof height === "number" ? `${height}px` : height;

  // Save to history
  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ sites: [...sites], elements: [...elements] });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, sites, elements]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setSites(prev.sites);
      setElements(prev.elements);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setSites(next.sites);
      setElements(next.elements);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  // Convert screen coords to canvas coords
  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - pan.x) / zoom,
        y: (screenY - rect.top - pan.y) / zoom,
      };
    },
    [zoom, pan]
  );

  // Snap to grid
  const snapToGrid = useCallback(
    (value: number) => {
      if (!showGrid) return value;
      return Math.round(value / gridSize) * gridSize;
    },
    [showGrid, gridSize]
  );

  // Find item at position
  const findItemAtPosition = useCallback(
    (x: number, y: number): { id: string; type: "site" | "element" } | null => {
      // Check sites first (on top)
      for (let i = sites.length - 1; i >= 0; i--) {
        const site = sites[i];
        if (site.isHidden) continue;
        if (
          x >= site.x &&
          x <= site.x + site.width &&
          y >= site.y &&
          y <= site.y + site.height
        ) {
          return { id: site.id, type: "site" };
        }
      }
      // Check elements
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.isHidden) continue;
        if (
          x >= el.x &&
          x <= el.x + el.width &&
          y >= el.y &&
          y <= el.y + el.height
        ) {
          return { id: el.id, type: "element" };
        }
      }
      return null;
    },
    [sites, elements]
  );

  // Add new site
  const addSite = useCallback(
    (x: number, y: number) => {
      const newSite: LayoutSite = {
        id: `site-${Date.now()}`,
        x: snapToGrid(x - DEFAULT_SITE_SIZE.width / 2),
        y: snapToGrid(y - DEFAULT_SITE_SIZE.height / 2),
        width: DEFAULT_SITE_SIZE.width,
        height: DEFAULT_SITE_SIZE.height,
        rotation: 0,
        siteNumber: String(nextSiteNumber),
        siteType: selectedSiteType,
        color: SITE_TYPE_COLORS[selectedSiteType],
      };
      setSites((prev) => [...prev, newSite]);
      setNextSiteNumber((n) => n + 1);
      setSelectedIds([newSite.id]);
      saveToHistory();
    },
    [snapToGrid, selectedSiteType, nextSiteNumber, saveToHistory]
  );

  // Delete selected items
  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setSites((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
    setElements((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
    setSelectedIds([]);
    saveToHistory();
  }, [selectedIds, saveToHistory]);

  // Duplicate selected
  const duplicateSelected = useCallback(() => {
    const newSites: LayoutSite[] = [];
    const newElements: LayoutElement[] = [];

    sites
      .filter((s) => selectedIds.includes(s.id))
      .forEach((site) => {
        newSites.push({
          ...site,
          id: `site-${Date.now()}-${Math.random()}`,
          x: site.x + 20,
          y: site.y + 20,
          siteNumber: String(nextSiteNumber + newSites.length),
        });
      });

    elements
      .filter((e) => selectedIds.includes(e.id))
      .forEach((el) => {
        newElements.push({
          ...el,
          id: `element-${Date.now()}-${Math.random()}`,
          x: el.x + 20,
          y: el.y + 20,
        });
      });

    setSites((prev) => [...prev, ...newSites]);
    setElements((prev) => [...prev, ...newElements]);
    setNextSiteNumber((n) => n + newSites.length);
    setSelectedIds([...newSites.map((s) => s.id), ...newElements.map((e) => e.id)]);
    saveToHistory();
  }, [selectedIds, sites, elements, nextSiteNumber, saveToHistory]);

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      if (activeTool === "pan") {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        return;
      }

      if (activeTool === "site") {
        addSite(x, y);
        return;
      }

      if (activeTool === "select") {
        const item = findItemAtPosition(x, y);
        if (item) {
          const isSelected = selectedIds.includes(item.id);
          if (e.shiftKey) {
            setSelectedIds((prev) =>
              isSelected ? prev.filter((id) => id !== item.id) : [...prev, item.id]
            );
          } else if (!isSelected) {
            setSelectedIds([item.id]);
          }

          // Start dragging
          const obj =
            item.type === "site"
              ? sites.find((s) => s.id === item.id)
              : elements.find((e) => e.id === item.id);
          if (obj && !obj.isLocked) {
            setDraggedItem({ ...item, startX: x - obj.x, startY: y - obj.y });
            setIsDragging(true);
          }
        } else {
          setSelectedIds([]);
        }
      }
    },
    [readOnly, screenToCanvas, activeTool, pan, addSite, findItemAtPosition, selectedIds, sites, elements]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;

      if (activeTool === "pan") {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
        return;
      }

      if (draggedItem) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY);
        const newX = snapToGrid(x - draggedItem.startX);
        const newY = snapToGrid(y - draggedItem.startY);

        if (draggedItem.type === "site") {
          setSites((prev) =>
            prev.map((s) =>
              selectedIds.includes(s.id) && !s.isLocked
                ? { ...s, x: s.id === draggedItem.id ? newX : s.x + (newX - (sites.find((ss) => ss.id === draggedItem.id)?.x || 0)), y: s.id === draggedItem.id ? newY : s.y + (newY - (sites.find((ss) => ss.id === draggedItem.id)?.y || 0)) }
                : s
            )
          );
        } else {
          setElements((prev) =>
            prev.map((el) =>
              selectedIds.includes(el.id) && !el.isLocked
                ? { ...el, x: el.id === draggedItem.id ? newX : el.x, y: el.id === draggedItem.id ? newY : el.y }
                : el
            )
          );
        }
      }
    },
    [isDragging, activeTool, dragStart, draggedItem, screenToCanvas, snapToGrid, selectedIds, sites]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && draggedItem) {
      saveToHistory();
    }
    setIsDragging(false);
    setDraggedItem(null);
  }, [isDragging, draggedItem, saveToHistory]);

  // Wheel zoom - only zoom if Ctrl/Cmd is held, otherwise let page scroll
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      // Only zoom if Ctrl (Windows/Linux) or Cmd (Mac) is held
      if (!e.ctrlKey && !e.metaKey) {
        // Let the page scroll normally
        return;
      }
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta)));
    },
    []
  );

  // Load background image
  useEffect(() => {
    if (!backgroundImageUrl) {
      backgroundImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      backgroundImageRef.current = img;
      // Trigger re-render to draw the image
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.dispatchEvent(new Event("redraw"));
      }
    };
    img.onerror = () => {
      console.error("Failed to load background image:", backgroundImageUrl);
      backgroundImageRef.current = null;
    };
    img.src = backgroundImageUrl;
  }, [backgroundImageUrl]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      } else if (e.key === "Escape") {
        setSelectedIds([]);
        setActiveTool("select");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === "v") {
        setActiveTool("select");
      } else if (e.key === "s") {
        setActiveTool("site");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, deleteSelected, undo, redo, duplicateSelected]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transforms
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw background image if available
    if (showBackgroundImage && backgroundImageRef.current) {
      ctx.globalAlpha = backgroundOpacity;
      // Scale image to fit canvas while maintaining aspect ratio, then apply user scale
      const img = backgroundImageRef.current;
      const imgAspect = img.width / img.height;
      const canvasAspect = canvasWidth / canvasHeight;
      let baseWidth = canvasWidth;
      let baseHeight = canvasHeight;

      if (imgAspect > canvasAspect) {
        // Image is wider - fit to width
        baseHeight = canvasWidth / imgAspect;
      } else {
        // Image is taller - fit to height
        baseWidth = canvasHeight * imgAspect;
      }

      // Apply user scale
      const drawWidth = baseWidth * backgroundScale;
      const drawHeight = baseHeight * backgroundScale;

      // Center the scaled image, then apply offset
      const drawX = (canvasWidth - drawWidth) / 2 + backgroundOffset.x;
      const drawY = (canvasHeight - drawHeight) / 2 + backgroundOffset.y;

      ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      ctx.globalAlpha = 1;
    }

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }

    // Draw elements (under sites)
    elements.forEach((el) => {
      if (el.isHidden) return;

      ctx.save();
      ctx.translate(el.x + el.width / 2, el.y + el.height / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);

      ctx.fillStyle = el.color || ELEMENT_COLORS[el.type];
      ctx.globalAlpha = 0.6;
      ctx.fillRect(-el.width / 2, -el.height / 2, el.width, el.height);
      ctx.globalAlpha = 1;

      // Selection outline
      if (selectedIds.includes(el.id)) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.strokeRect(-el.width / 2, -el.height / 2, el.width, el.height);
      }

      ctx.restore();
    });

    // Draw sites
    sites.forEach((site) => {
      if (site.isHidden) return;

      ctx.save();
      ctx.translate(site.x + site.width / 2, site.y + site.height / 2);
      ctx.rotate((site.rotation * Math.PI) / 180);

      // Site background
      ctx.fillStyle = site.color || SITE_TYPE_COLORS[site.siteType];
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-site.width / 2, -site.height / 2, site.width, site.height);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = selectedIds.includes(site.id) ? "#3b82f6" : "#ffffff";
      ctx.lineWidth = selectedIds.includes(site.id) ? 3 : 2;
      ctx.strokeRect(-site.width / 2, -site.height / 2, site.width, site.height);

      // Site number
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(site.siteNumber, 0, 0);

      // Lock icon
      if (site.isLocked) {
        ctx.fillStyle = "#ffffff";
        ctx.fillText("L", site.width / 2 - 10, -site.height / 2 + 10);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [sites, elements, selectedIds, zoom, pan, showGrid, gridSize, canvasWidth, canvasHeight, showBackgroundImage, backgroundOpacity, backgroundScale, backgroundOffset, backgroundImageUrl]);

  // Handle save
  const handleSave = () => {
    const data: LayoutData = {
      sites,
      elements,
      gridSize,
      canvasWidth,
      canvasHeight,
    };
    onSave?.(data);
  };

  // Export as JSON
  const handleExport = () => {
    const data: LayoutData = {
      sites,
      elements,
      gridSize,
      canvasWidth,
      canvasHeight,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "campground-layout.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle background image import
  const handleImportBackgroundImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        onBackgroundImageChange?.(dataUrl);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const selectedSite = sites.find((s) => selectedIds.includes(s.id));

  return (
    <TooltipProvider>
      <div className={cn("flex flex-col bg-muted rounded-xl overflow-hidden border", className)} style={{ height: heightStyle }}>
        {/* Toolbar */}
        {!readOnly && (
          <div className="flex items-center gap-2 p-2 bg-card border-b">
            {/* Tool selection */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "select" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setActiveTool("select")}
                  >
                    <MousePointer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Select (V)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "site" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setActiveTool("site")}
                  >
                    <Tent className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Site (S)</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === "pan" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setActiveTool("pan")}
                  >
                    <Move className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pan</TooltipContent>
              </Tooltip>
            </div>

            {/* Site type selector */}
            {activeTool === "site" && (
              <div className="flex items-center gap-1 border-r pr-2">
                {(Object.keys(SITE_TYPE_ICONS) as SiteType[]).map((type) => {
                  const Icon = SITE_TYPE_ICONS[type];
                  return (
                    <Tooltip key={type}>
                      <TooltipTrigger asChild>
                        <Button
                          variant={selectedSiteType === type ? "default" : "ghost"}
                          size="icon"
                          onClick={() => setSelectedSiteType(type)}
                          style={{
                            backgroundColor: selectedSiteType === type ? SITE_TYPE_COLORS[type] : undefined,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="capitalize">{type}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0}>
                    <Undo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1}>
                    <Redo className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={duplicateSelected} disabled={selectedIds.length === 0}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Duplicate</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={deleteSelected} disabled={selectedIds.length === 0}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>

            {/* View controls */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>

              <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setZoom(1);
                      setPan({ x: 0, y: 0 });
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset View</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showGrid ? "default" : "ghost"} size="icon" onClick={() => setShowGrid(!showGrid)}>
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Grid</TooltipContent>
              </Tooltip>
            </div>

            {/* Background Image Controls */}
            <div className="flex items-center gap-1 border-r pr-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleImportBackgroundImage}>
                    <Upload className="h-4 w-4 mr-1" />
                    Map Image
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import background map image</TooltipContent>
              </Tooltip>

              {backgroundImageUrl && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showBackgroundImage ? "default" : "ghost"}
                        size="icon"
                        onClick={() => setShowBackgroundImage(!showBackgroundImage)}
                      >
                        {showBackgroundImage ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{showBackgroundImage ? "Hide" : "Show"} Background</TooltipContent>
                  </Tooltip>

                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-xs text-muted-foreground">Scale:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={backgroundScale}
                      onChange={(e) => setBackgroundScale(parseFloat(e.target.value))}
                      className="w-16 h-1 accent-emerald-600"
                    />
                    <span className="text-xs text-muted-foreground w-8">{Math.round(backgroundScale * 100)}%</span>
                  </div>

                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-xs text-muted-foreground">Opacity:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={backgroundOpacity}
                      onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
                      className="w-16 h-1 accent-emerald-600"
                    />
                    <span className="text-xs text-muted-foreground w-8">{Math.round(backgroundOpacity * 100)}%</span>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setBackgroundScale(1);
                          setBackgroundOffset({ x: 0, y: 0 });
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset background position</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Export/Save */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Save Layout
              </Button>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas */}
          <div ref={containerRef} className="flex-1 overflow-hidden relative">
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className={cn(
                "cursor-crosshair",
                activeTool === "select" && "cursor-default",
                activeTool === "pan" && (isDragging ? "cursor-grabbing" : "cursor-grab")
              )}
              style={{
                width: canvasWidth * zoom,
                height: canvasHeight * zoom,
                transform: `translate(${pan.x}px, ${pan.y}px)`,
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
            />
          </div>

          {/* Properties panel */}
          {!readOnly && selectedSite && (
            <div className="w-64 bg-card border-l p-4 overflow-y-auto">
              <h3 className="font-bold text-foreground mb-4">Site Properties</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground">Site Number</label>
                  <input
                    type="text"
                    value={selectedSite.siteNumber}
                    onChange={(e) => {
                      setSites((prev) =>
                        prev.map((s) =>
                          s.id === selectedSite.id ? { ...s, siteNumber: e.target.value } : s
                        )
                      );
                    }}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Site Type</label>
                  <Select
                    value={selectedSite.siteType}
                    onValueChange={(value: SiteType) => {
                      setSites((prev) =>
                        prev.map((s) =>
                          s.id === selectedSite.id
                            ? { ...s, siteType: value, color: SITE_TYPE_COLORS[value] }
                            : s
                        )
                      );
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SITE_TYPE_ICONS) as SiteType[]).map((type) => (
                        <SelectItem key={type} value={type} className="capitalize">
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-sm text-muted-foreground">Width</label>
                    <input
                      type="number"
                      value={selectedSite.width}
                      onChange={(e) => {
                        setSites((prev) =>
                          prev.map((s) =>
                            s.id === selectedSite.id ? { ...s, width: parseInt(e.target.value) || 60 } : s
                          )
                        );
                      }}
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Height</label>
                    <input
                      type="number"
                      value={selectedSite.height}
                      onChange={(e) => {
                        setSites((prev) =>
                          prev.map((s) =>
                            s.id === selectedSite.id ? { ...s, height: parseInt(e.target.value) || 40 } : s
                          )
                        );
                      }}
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Rotation</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={selectedSite.rotation}
                    onChange={(e) => {
                      setSites((prev) =>
                        prev.map((s) =>
                          s.id === selectedSite.id ? { ...s, rotation: parseInt(e.target.value) } : s
                        )
                      );
                    }}
                    className="w-full mt-1"
                  />
                  <span className="text-xs text-muted-foreground">{selectedSite.rotation} degrees</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={selectedSite.isLocked ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSites((prev) =>
                        prev.map((s) =>
                          s.id === selectedSite.id ? { ...s, isLocked: !s.isLocked } : s
                        )
                      );
                    }}
                  >
                    {selectedSite.isLocked ? <Lock className="h-4 w-4 mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
                    {selectedSite.isLocked ? "Locked" : "Unlocked"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{sites.length} sites</span>
            <span>{elements.length} elements</span>
            {selectedIds.length > 0 && <span>{selectedIds.length} selected</span>}
          </div>
          <div className="flex items-center gap-4">
            <span>Grid: {gridSize}px</span>
            <span>Canvas: {canvasWidth} x {canvasHeight}</span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default SiteLayoutEditor;
