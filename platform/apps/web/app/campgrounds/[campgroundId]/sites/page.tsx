"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiClient } from "../../../../lib/api-client";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "../../../../components/ui/button";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { ImageUpload } from "../../../../components/ui/image-upload";
import { useToast } from "../../../../components/ui/use-toast";
import { ToastAction } from "../../../../components/ui/toast";
import { ConfirmDialog } from "../../../../components/ui/confirm-dialog";
import { Card, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Label } from "../../../../components/ui/label";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Textarea } from "../../../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Zap,
  Droplet,
  Waves,
  Trees,
  Tent,
  Home,
  Users,
  Sparkles,
  Plus,
  CheckCircle2,
  Loader2,
  Filter,
  PawPrint,
  Accessibility,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Input } from "../../../../components/ui/input";
import { cn } from "../../../../lib/utils";
import {
  SPRING_CONFIG,
  staggerContainer,
  staggerChild,
} from "../../../../lib/animations";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

// Site type configuration with icons
const siteTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  rv: { icon: <Home className="h-4 w-4" />, label: "RV", color: "bg-status-info/15 text-status-info" },
  tent: { icon: <Tent className="h-4 w-4" />, label: "Tent", color: "bg-status-success/15 text-status-success" },
  cabin: { icon: <Home className="h-4 w-4" />, label: "Cabin", color: "bg-status-warning/15 text-status-warning" },
  group: { icon: <Users className="h-4 w-4" />, label: "Group", color: "bg-status-info/15 text-status-info" },
  glamping: { icon: <Sparkles className="h-4 w-4" />, label: "Glamping", color: "bg-status-warning/15 text-status-warning" },
};

// Standard power amp options for RV sites
const POWER_AMP_OPTIONS = [15, 20, 30, 50, 100] as const;

type Site = {
  id: string;
  name: string;
  siteNumber: string;
  siteType: "rv" | "tent" | "cabin" | "group" | "glamping";
  siteClassId?: string | null;
  maxOccupancy?: number;
  rigMaxLength?: number | null;
  hookupsPower?: boolean;
  hookupsWater?: boolean;
  hookupsSewer?: boolean;
  powerAmps?: number[];
  petFriendly?: boolean;
  accessible?: boolean;
  minNights?: number | null;
  maxNights?: number | null;
  photos?: string[];
  description?: string;
  tags?: string[];
  isActive?: boolean;
  zone?: string | null;
};

type SiteFormState = {
  name: string;
  siteNumber: string;
  siteType: string;
  maxOccupancy: number;
  rigMaxLength: number | "";
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  powerAmps: number[];
  petFriendly: boolean;
  accessible: boolean;
  minNights: number | "";
  maxNights: number | "";
  photos: string;
  description: string;
  tags: string;
  siteClassId: string;
  isActive: boolean;
};

const defaultSiteForm: SiteFormState = {
  name: "",
  siteNumber: "",
  siteType: "rv",
  maxOccupancy: 4,
  rigMaxLength: "",
  hookupsPower: false,
  hookupsWater: false,
  hookupsSewer: false,
  powerAmps: [],
  petFriendly: true,
  accessible: false,
  minNights: "",
  maxNights: "",
  photos: "",
  description: "",
  tags: "",
  siteClassId: "",
  isActive: true
};

export default function SitesPage() {
  const params = useParams();
  const router = useRouter();
  const campgroundId = params?.campgroundId as string;
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });
  const classesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<SiteFormState>(defaultSiteForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteFormState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("__all__");
  const [filterClass, setFilterClass] = useState("__all__");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  // Sorting state
  const [sortBy, setSortBy] = useState<"name" | "siteNumber" | "type" | "class" | "rate" | "status">("siteNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Bulk selection state
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Track last click for shift+click range selection
  const lastClickedIndex = useRef<number | null>(null);

  // Keyboard shortcuts (Cmd+S to save, Escape to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+S to save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (editingId && editForm) {
          // Save the edit form
          updateSite.mutate({
            id: editingId,
            data: mapFormToPayload(editForm, { clearEmptyAsNull: true })
          });
        } else if (showCreateForm && formState.name && formState.siteNumber) {
          // Save the create form
          createSite.mutate();
        }
      }
      // Escape to cancel
      if (e.key === "Escape") {
        if (editingId) {
          setEditingId(null);
          setEditForm(null);
        } else if (showCreateForm) {
          setShowCreateForm(false);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingId, editForm, showCreateForm, formState]);

  const mapFormToPayload = (state: SiteFormState, opts?: { clearEmptyAsNull?: boolean }) => {
    const parseOptionalNumber = (value: number | "" | undefined | null) => {
      if (value === "" || value === null || value === undefined) {
        return opts?.clearEmptyAsNull ? null : undefined;
      }
      return Number(value);
    };
    const siteClassId = state.siteClassId ? state.siteClassId : opts?.clearEmptyAsNull ? null : undefined;
    return {
      name: state.name,
      siteNumber: state.siteNumber,
      siteType: state.siteType as "rv" | "tent" | "cabin" | "group" | "glamping",
      maxOccupancy: Number(state.maxOccupancy),
      rigMaxLength: parseOptionalNumber(state.rigMaxLength),
      hookupsPower: state.hookupsPower,
      hookupsWater: state.hookupsWater,
      hookupsSewer: state.hookupsSewer,
      powerAmps: state.powerAmps.length > 0 ? state.powerAmps : [],
      petFriendly: state.petFriendly,
      accessible: state.accessible,
      minNights: parseOptionalNumber(state.minNights),
      maxNights: parseOptionalNumber(state.maxNights),
      photos: state.photos ? state.photos.split(",").map((p) => p.trim()) : opts?.clearEmptyAsNull ? [] : [],
      description: state.description || undefined,
      tags: state.tags ? state.tags.split(",").map((t) => t.trim()) : opts?.clearEmptyAsNull ? [] : [],
      siteClassId,
      isActive: state.isActive
    };
  };

  // Filtered sites based on search and filters
  const filteredSites = useMemo(() => {
    if (!data) return [];

    // Filter first
    const filtered = data.filter((site) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!site.name.toLowerCase().includes(query) &&
            !site.siteNumber.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Type filter
      if (filterType && filterType !== "__all__" && site.siteType !== filterType) return false;
      // Class filter
      if (filterClass && filterClass !== "__all__" && site.siteClassId !== filterClass) return false;
      // Active filter
      if (filterActive === "active" && !site.isActive) return false;
      if (filterActive === "inactive" && site.isActive !== false) return false;
      return true;
    });

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "siteNumber":
          // Natural sort for site numbers (e.g., "A1", "A2", "A10" instead of "A1", "A10", "A2")
          comparison = a.siteNumber.localeCompare(b.siteNumber, undefined, { numeric: true, sensitivity: "base" });
          break;
        case "type":
          comparison = (a.siteType || "").localeCompare(b.siteType || "");
          break;
        case "class": {
          const classA = classesQuery.data?.find(c => c.id === a.siteClassId)?.name || "";
          const classB = classesQuery.data?.find(c => c.id === b.siteClassId)?.name || "";
          comparison = classA.localeCompare(classB);
          break;
        }
        case "rate": {
          const rateA = classesQuery.data?.find(c => c.id === a.siteClassId)?.defaultRate || 0;
          const rateB = classesQuery.data?.find(c => c.id === b.siteClassId)?.defaultRate || 0;
          comparison = rateA - rateB;
          break;
        }
        case "status": {
          const statusA = a.isActive !== false ? 1 : 0;
          const statusB = b.isActive !== false ? 1 : 0;
          comparison = statusA - statusB;
          break;
        }
        default:
          break;
      }
      return sortDir === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [data, searchQuery, filterType, filterClass, filterActive, sortBy, sortDir, classesQuery.data]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterClass, filterActive]);

  // Paginated sites for display
  const totalPages = Math.ceil(filteredSites.length / itemsPerPage);
  const paginatedSites = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSites.slice(start, start + itemsPerPage);
  }, [filteredSites, currentPage, itemsPerPage]);

  // Toggle site selection for bulk operations (supports shift+click for range)
  const toggleSiteSelection = (siteId: string, index: number, event?: React.MouseEvent) => {
    // Calculate the actual index in paginatedSites for range selection
    const pageOffset = (currentPage - 1) * itemsPerPage;
    const actualIndex = pageOffset + index;

    // Shift+click for range selection
    if (event?.shiftKey && lastClickedIndex.current !== null) {
      const start = Math.min(lastClickedIndex.current, actualIndex);
      const end = Math.max(lastClickedIndex.current, actualIndex);
      const rangeIds = filteredSites.slice(start, end + 1).map(s => s.id);

      setSelectedSites((prev) => {
        const next = new Set(prev);
        rangeIds.forEach(id => next.add(id));
        return next;
      });
    } else {
      // Normal click - toggle single selection
      setSelectedSites((prev) => {
        const next = new Set(prev);
        if (next.has(siteId)) {
          next.delete(siteId);
        } else {
          next.add(siteId);
        }
        return next;
      });
    }

    lastClickedIndex.current = actualIndex;
  };

  // Select/deselect all visible sites on current page
  const toggleSelectAll = () => {
    const pageIds = paginatedSites.map((s) => s.id);
    const allPageSelected = pageIds.every((id) => selectedSites.has(id));

    if (allPageSelected) {
      // Deselect all on current page
      setSelectedSites((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedSites((prev) => new Set([...prev, ...pageIds]));
    }
  };

  // Quick update with undo capability and optimistic updates
  const quickUpdateSite = useMutation({
    mutationFn: (payload: { id: string; data: Partial<ReturnType<typeof mapFormToPayload>>; previousData?: Partial<ReturnType<typeof mapFormToPayload>>; description?: string }) =>
      apiClient.updateSite(payload.id, payload.data),
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["sites", campgroundId] });

      // Snapshot the previous value
      const previousSites = queryClient.getQueryData(["sites", campgroundId]);

      // Optimistically update the cache
      queryClient.setQueryData(["sites", campgroundId], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((site) =>
          site.id === variables.id ? { ...site, ...variables.data } : site
        );
      });

      return { previousSites };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousSites) {
        queryClient.setQueryData(["sites", campgroundId], context.previousSites);
      }
      toast({ title: "Error", description: "Failed to update site." });
    },
    onSuccess: (_data, variables) => {
      const { id, previousData, description } = variables;

      // Show undo toast if we have previous data
      if (previousData) {
        toast({
          title: "Site updated",
          description: description || "Changes saved.",
          action: (
            <ToastAction altText="Undo" onClick={() => {
              // Optimistically revert
              queryClient.setQueryData(["sites", campgroundId], (old: any[] | undefined) => {
                if (!old) return old;
                return old.map((site) =>
                  site.id === id ? { ...site, ...previousData } : site
                );
              });
              // Then sync with server
              apiClient.updateSite(id, previousData).then(() => {
                queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
                toast({ title: "Undone", description: "Change reverted." });
              });
            }}>
              Undo
            </ToastAction>
          ),
        });
      }
    },
    onSettled: () => {
      // Sync with server after mutation settles
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
    }
  });

  // Bulk update mutation
  const bulkUpdateSites = useMutation({
    mutationFn: async (payload: { siteIds: string[]; data: Partial<ReturnType<typeof mapFormToPayload>> }) => {
      await Promise.all(payload.siteIds.map((id) => apiClient.updateSite(id, payload.data)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
      setSelectedSites(new Set());
      toast({ title: "Bulk update complete", description: `${selectedSites.size} sites updated.` });
    }
  });

  const createSite = useMutation({
    mutationFn: () =>
      apiClient.createSite(campgroundId, mapFormToPayload(formState)),
    onSuccess: () => {
      setFormState(defaultSiteForm);
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
      toast({ title: "Site created", description: "New site has been added." });
    }
  });
  const updateSite = useMutation({
    mutationFn: (payload: { id: string; data: ReturnType<typeof mapFormToPayload> }) => apiClient.updateSite(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
      setEditingId(null);
      setEditForm(null);
      toast({ title: "Site updated", description: "Changes have been saved." });
    }
  });
  const deleteSite = useMutation({
    mutationFn: (id: string) => apiClient.deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
      toast({ title: "Site deleted", description: "Site has been removed." });
    }
  });

  // Stats calculations
  const totalSites = data?.length || 0;
  const activeSites = data?.filter(s => s.isActive !== false).length || 0;
  const sitesWithHookups = data?.filter(s => s.hookupsPower || s.hookupsWater || s.hookupsSewer).length || 0;

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading sites...</p>
          </motion.div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundQuery.data?.name || campgroundId },
            { label: "Sites" }
          ]}
        />

        {/* Header */}
        <motion.div
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-status-success/15 flex items-center justify-center">
                <Trees className="h-5 w-5 text-status-success" />
              </div>
              Sites
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your campground sites, hookups, and amenities
            </p>
          </div>
          {!showCreateForm && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="gap-2 bg-status-success text-white hover:bg-status-success/90"
            >
              <Plus className="h-4 w-4" />
              Add Site
            </Button>
          )}
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{totalSites}</div>
                  <div className="text-sm text-muted-foreground">Total Sites</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Trees className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{activeSites}</div>
                  <div className="text-sm text-muted-foreground">Active Sites</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-status-success/15 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-status-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/80 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold text-foreground">{sitesWithHookups}</div>
                  <div className="text-sm text-muted-foreground">With Hookups</div>
                </div>
                <div className="h-12 w-12 rounded-full bg-status-warning/15 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-status-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {error && <p role="alert" className="text-red-500">Error loading sites</p>}

        {/* Search and Filter Bar */}
        {data && data.length > 0 && (
          <motion.div
            variants={staggerChild}
            transition={SPRING_CONFIG}
            className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border"
          >
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border"
                aria-label="Search sites"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] bg-background border-border" aria-label="Filter by site type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {Object.entries(siteTypeConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {config.icon}
                      {config.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-[160px] bg-background border-border" aria-label="Filter by site class">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All classes</SelectItem>
                {classesQuery.data?.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActive} onValueChange={(v) => setFilterActive(v as "all" | "active" | "inactive")}>
              <SelectTrigger className="w-[130px] bg-background border-border" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>

            {/* Sorting */}
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[130px] bg-background border-border" aria-label="Sort by">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="siteNumber">Site #</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="class">Class</SelectItem>
                  <SelectItem value="rate">Rate</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                className="h-9 w-9 p-0"
                aria-label="Toggle sort direction"
                aria-pressed={sortDir === "desc"}
              >
                {sortDir === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </Button>
            </div>

            {(searchQuery || filterType !== "__all__" || filterClass !== "__all__" || filterActive !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("__all__");
                  setFilterClass("__all__");
                  setFilterActive("all");
                }}
                className="gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </motion.div>
        )}

        {/* Filter Results Summary */}
        {filteredSites.length !== (data?.length || 0) && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredSites.length} of {data?.length} sites
          </p>
        )}

        {/* Bulk Selection Bar */}
        <AnimatePresence>
          {selectedSites.size > 0 && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={SPRING_CONFIG}
              className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-200"
            >
              <span className="text-sm font-medium text-emerald-800">
                {selectedSites.size} site{selectedSites.size > 1 ? "s" : ""} selected
              </span>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value) {
                    bulkUpdateSites.mutate({
                      siteIds: Array.from(selectedSites),
                      data: { siteClassId: value === "remove" ? null : value }
                    });
                  }
                }}
                disabled={bulkUpdateSites.isPending}
              >
                <SelectTrigger className="w-[150px] bg-background border-emerald-300" aria-label="Change class for selected sites">
                  <SelectValue placeholder="Change class..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remove">Remove class</SelectItem>
                  {classesQuery.data?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 hover:bg-emerald-100"
                onClick={() => {
                  bulkUpdateSites.mutate({
                    siteIds: Array.from(selectedSites),
                    data: { isActive: true }
                  });
                }}
                disabled={bulkUpdateSites.isPending}
              >
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-300 hover:bg-emerald-100"
                onClick={() => {
                  bulkUpdateSites.mutate({
                    siteIds: Array.from(selectedSites),
                    data: { isActive: false }
                  });
                }}
                disabled={bulkUpdateSites.isPending}
              >
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedSites(new Set())}
              >
                Clear selection
              </Button>
              {bulkUpdateSites.isPending && <span className="text-sm text-muted-foreground">Updating...</span>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Site Form - Collapsible */}
        <AnimatePresence>
          {showCreateForm && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={SPRING_CONFIG}
          >
          <Card className="border-border bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add New Site</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormState(defaultSiteForm);
                }}
                aria-label="Close add site form"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Essential fields - always visible */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                placeholder="Name *"
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
                className="bg-background border-border"
                aria-label="Site name"
              />
              <Input
                placeholder="Site number *"
                value={formState.siteNumber}
                onChange={(e) => setFormState((s) => ({ ...s, siteNumber: e.target.value }))}
                className="bg-background border-border"
                aria-label="Site number"
              />
              <Select
                value={formState.siteType}
                onValueChange={(value) => setFormState((s) => ({ ...s, siteType: value }))}
              >
                <SelectTrigger className="bg-background border-border" aria-label="Site type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(siteTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formState.siteClassId || "none"}
                onValueChange={(value) => {
                  const classId = value === "none" ? "" : value;
                  const selectedClass = classesQuery.data?.find(c => c.id === classId);

                  if (selectedClass) {
                    // Auto-fill from class defaults
                    setFormState((s) => ({
                      ...s,
                      siteClassId: classId,
                      siteType: selectedClass.siteType || s.siteType,
                      maxOccupancy: selectedClass.maxOccupancy || s.maxOccupancy,
                      rigMaxLength: selectedClass.rigMaxLength ?? s.rigMaxLength,
                      hookupsPower: selectedClass.hookupsPower ?? s.hookupsPower,
                      hookupsWater: selectedClass.hookupsWater ?? s.hookupsWater,
                      hookupsSewer: selectedClass.hookupsSewer ?? s.hookupsSewer,
                      petFriendly: selectedClass.petFriendly ?? s.petFriendly,
                      accessible: selectedClass.accessible ?? s.accessible,
                      minNights: selectedClass.minNights ?? s.minNights,
                      maxNights: selectedClass.maxNights ?? s.maxNights,
                    }));
                  } else {
                    setFormState((s) => ({ ...s, siteClassId: classId }));
                  }
                }}
              >
                <SelectTrigger className="bg-background border-border" aria-label="Site class">
                  <SelectValue placeholder="Select class (inherits settings)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No class</SelectItem>
                  {classesQuery.data?.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} (${(cls.defaultRate / 100).toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced options - collapsible */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={showAdvanced}
                aria-controls="site-advanced-panel"
                id="site-advanced-toggle"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAdvanced ? "Hide" : "Show"} advanced options
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    id="site-advanced-panel"
                    role="region"
                    aria-labelledby="site-advanced-toggle"
                    initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    transition={SPRING_CONFIG}
                    className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden"
                  >
                    <Input
                      type="number"
                      min="1"
                      placeholder="Max occupancy"
                      value={formState.maxOccupancy}
                      onChange={(e) => setFormState((s) => ({ ...s, maxOccupancy: Number(e.target.value) }))}
                      className="bg-background border-border"
                      aria-label="Max occupancy"
                    />
                    <Input
                      type="number"
                      placeholder="Rig max length (ft)"
                      value={formState.rigMaxLength}
                      onChange={(e) => setFormState((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="bg-background border-border"
                      aria-label="Rig max length"
                    />
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <span className="text-xs font-semibold text-muted-foreground">Hookups:</span>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={formState.hookupsPower}
                          onCheckedChange={(checked) => setFormState((s) => ({ ...s, hookupsPower: Boolean(checked) }))}
                          aria-label="Power hookups"
                        />
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Power
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={formState.hookupsWater}
                          onCheckedChange={(checked) => setFormState((s) => ({ ...s, hookupsWater: Boolean(checked) }))}
                          aria-label="Water hookups"
                        />
                        <Droplet className="h-3.5 w-3.5 text-blue-500" />
                        Water
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={formState.hookupsSewer}
                          onCheckedChange={(checked) => setFormState((s) => ({ ...s, hookupsSewer: Boolean(checked) }))}
                          aria-label="Sewer hookups"
                        />
                        <Waves className="h-3.5 w-3.5 text-muted-foreground" />
                        Sewer
                      </label>
                      {formState.hookupsPower && (
                        <div className="flex items-center gap-1 ml-2">
                          {POWER_AMP_OPTIONS.map((amp) => (
                            <button
                              key={amp}
                              type="button"
                              onClick={() => {
                                setFormState((s) => ({
                                  ...s,
                                  powerAmps: s.powerAmps.includes(amp)
                                    ? s.powerAmps.filter((a) => a !== amp)
                                    : [...s.powerAmps, amp].sort((a, b) => a - b)
                                }));
                              }}
                              className={cn(
                                "px-2 py-1 text-xs rounded-md border transition-all",
                                formState.powerAmps.includes(amp)
                                  ? "border-amber-500 bg-status-warning/15 text-status-warning"
                                  : "border-border bg-background text-muted-foreground hover:border-amber-300"
                              )}
                              aria-pressed={formState.powerAmps.includes(amp)}
                            >
                              {amp}A
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <span className="text-xs font-semibold text-muted-foreground">Features:</span>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={formState.petFriendly}
                          onCheckedChange={(checked) => setFormState((s) => ({ ...s, petFriendly: Boolean(checked) }))}
                          aria-label="Pet friendly"
                        />
                        <PawPrint className="h-3.5 w-3.5 text-amber-600" />
                        Pet friendly
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <Checkbox
                          checked={formState.accessible}
                          onCheckedChange={(checked) => setFormState((s) => ({ ...s, accessible: Boolean(checked) }))}
                          aria-label="Accessible"
                        />
                        <Accessibility className="h-3.5 w-3.5 text-blue-600" />
                        Accessible
                      </label>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Min nights"
                      value={formState.minNights}
                      onChange={(e) => setFormState((s) => ({ ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="bg-background border-border"
                      aria-label="Minimum nights"
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Max nights"
                      value={formState.maxNights}
                      onChange={(e) => setFormState((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="bg-background border-border"
                      aria-label="Maximum nights"
                    />
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold">Photos</Label>
                      <div className="bg-muted p-2 rounded-lg border border-border mb-2">
                        <ImageUpload
                          onChange={(url) => {
                            if (!url) return;
                            const current = formState.photos ? formState.photos.split(",").map(p => p.trim()).filter(Boolean) : [];
                            setFormState(s => ({ ...s, photos: [...current, url].join(", ") }));
                          }}
                          placeholder="Upload site photo"
                        />
                      </div>
                      <Textarea
                        className="text-xs"
                        placeholder="Or enter URLs: https://img1.jpg, https://img2.jpg"
                        value={formState.photos}
                        onChange={(e) => setFormState((s) => ({ ...s, photos: e.target.value }))}
                        aria-label="Photo URLs"
                      />
                    </div>
                    <Input
                      placeholder="Tags (comma-separated)"
                      value={formState.tags}
                      onChange={(e) => setFormState((s) => ({ ...s, tags: e.target.value }))}
                      className="bg-background border-border"
                      aria-label="Tags"
                    />
                    <Textarea
                      placeholder="Description"
                      value={formState.description}
                      onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                      aria-label="Site description"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                disabled={createSite.isPending || !formState.name || !formState.siteNumber}
                onClick={() => createSite.mutate()}
                className="bg-status-success text-white hover:bg-status-success/90"
              >
                {createSite.isPending ? "Saving..." : "Create Site"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormState(defaultSiteForm);
                }}
              >
                Cancel
              </Button>
              {createSite.isError && (
                <span role="alert" className="text-sm text-red-600">
                  Failed to save site
                </span>
              )}
            </div>
            </CardContent>
          </Card>
          </motion.div>
          )}
        </AnimatePresence>
        {/* Select All checkbox when there are sites */}
        {paginatedSites.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={paginatedSites.length > 0 && paginatedSites.every((s) => selectedSites.has(s.id))}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all sites on page"
            />
            <span>
              Select page ({paginatedSites.length} of {filteredSites.length} sites)
              {selectedSites.size > 0 && ` · ${selectedSites.size} selected`}
            </span>
          </div>
        )}

        {/* Table Layout */}
        <motion.div
          variants={staggerChild}
          transition={SPRING_CONFIG}
        >
          <Card className="border-border bg-card/80 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedSites.length > 0 && paginatedSites.every((s) => selectedSites.has(s.id))}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all sites on page"
                  />
                </TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="hidden md:table-cell">Rate</TableHead>
                <TableHead className="hidden lg:table-cell">Hookups</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSites.map((site, index) => {
                const typedSite = site as Site;
                const cls = classesQuery.data?.find((c) => c.id === typedSite.siteClassId) || null;
                const isEditing = editingId === site.id;
                const isSelected = selectedSites.has(site.id);
                const isInactive = site.isActive === false;

                // Inherit hookups from class if site doesn't have its own
                const siteHasOwnHookups = site.hookupsPower || site.hookupsWater || site.hookupsSewer;
                const effectivePower = site.hookupsPower ?? cls?.hookupsPower ?? false;
                const effectiveWater = site.hookupsWater ?? cls?.hookupsWater ?? false;
                const effectiveSewer = site.hookupsSewer ?? cls?.hookupsSewer ?? false;
                const hasHookups = effectivePower || effectiveWater || effectiveSewer;
                const isInheritedHookups = !siteHasOwnHookups && cls && (cls.hookupsPower || cls.hookupsWater || cls.hookupsSewer);

                return (
                  <React.Fragment key={site.id}>
                    <TableRow className={cn(
                      "transition-colors",
                      isInactive && "opacity-50 bg-muted/50",
                      isSelected && "bg-emerald-50",
                      "hover:bg-muted/50"
                    )}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => toggleSiteSelection(site.id, index, e)}
                          aria-label={`Select ${site.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            onClick={() => router.push(`/campgrounds/${campgroundId}/sites/${site.id}`)}
                            className="font-medium text-foreground hover:text-emerald-600 text-left transition-colors"
                          >
                            {site.name}
                          </button>
                          <span className="text-xs text-muted-foreground">#{site.siteNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {siteTypeConfig[site.siteType] ? (
                          <Badge variant="secondary" className={cn("gap-1", siteTypeConfig[site.siteType].color)}>
                            {siteTypeConfig[site.siteType].icon}
                            {siteTypeConfig[site.siteType].label}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{site.siteType}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={typedSite.siteClassId ?? "none"}
                          onValueChange={(value) => {
                            const newClassId = value === "none" ? null : value;
                            const prevClassId = typedSite.siteClassId ?? null;
                            const newClassName = classesQuery.data?.find(c => c.id === newClassId)?.name || "No class";
                            quickUpdateSite.mutate({
                              id: site.id,
                              data: { siteClassId: newClassId },
                              previousData: { siteClassId: prevClassId },
                              description: `Class changed to ${newClassName}`
                            });
                          }}
                          disabled={quickUpdateSite.isPending}
                        >
                          <SelectTrigger
                            className="h-8 w-[110px] text-xs bg-background border-border"
                            aria-label={`Select class for ${site.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {classesQuery.data?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {cls ? (
                          <span className="text-sm font-medium text-emerald-700">${(cls.defaultRate / 100).toFixed(0)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            isInheritedHookups && "opacity-70"
                          )}
                          title={isInheritedHookups
                            ? `Inherited from ${cls?.name}: Power: ${effectivePower ? 'Yes' : 'No'}, Water: ${effectiveWater ? 'Yes' : 'No'}, Sewer: ${effectiveSewer ? 'Yes' : 'No'}`
                            : `Power: ${effectivePower ? 'Yes' : 'No'}, Water: ${effectiveWater ? 'Yes' : 'No'}, Sewer: ${effectiveSewer ? 'Yes' : 'No'}`
                          }
                        >
                          {hasHookups ? (
                            <>
                              {effectivePower && (
                                <span className={cn(
                                  "inline-flex items-center gap-0.5",
                                  isInheritedHookups ? "text-amber-500/70" : "text-amber-600"
                                )}>
                                  <Zap className="h-3.5 w-3.5" />
                                  {(() => {
                                    const amps = (site.powerAmps && site.powerAmps.length > 0) ? site.powerAmps : (cls?.electricAmps ?? []);
                                    return amps.length > 0 ? <span className="text-xs">{amps.join("/")}A</span> : null;
                                  })()}
                                </span>
                              )}
                              {effectiveWater && (
                                <Droplet className={cn(
                                  "h-3.5 w-3.5",
                                  isInheritedHookups ? "text-blue-400/70" : "text-blue-500"
                                )} />
                              )}
                              {effectiveSewer && (
                                <Waves className={cn(
                                  "h-3.5 w-3.5",
                                  isInheritedHookups ? "text-muted-foreground/70" : "text-muted-foreground"
                                )} />
                              )}
                              {isInheritedHookups && (
                                <span className="text-[10px] text-muted-foreground ml-1" title="Inherited from class">↖</span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => {
                            const newStatus = !site.isActive;
                            quickUpdateSite.mutate({
                              id: site.id,
                              data: { isActive: newStatus },
                              previousData: { isActive: site.isActive },
                              description: newStatus ? `${site.name} activated` : `${site.name} deactivated`
                            });
                          }}
                          className={cn(
                            "group flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium rounded-full transition-all",
                            site.isActive !== false
                              ? "bg-status-success/15 text-status-success hover:bg-status-success/25"
                              : "bg-status-error/15 text-status-error hover:bg-status-error/25"
                          )}
                          disabled={quickUpdateSite.isPending}
                          title={site.isActive !== false ? "Click to deactivate" : "Click to activate"}
                          aria-pressed={site.isActive !== false}
                        >
                          <span className={cn(
                            "w-2 h-2 rounded-full transition-colors",
                            site.isActive !== false ? "bg-status-success" : "bg-status-error"
                          )} />
                          {site.isActive !== false ? "Active" : "Inactive"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingId(isEditing ? null : site.id);
                              if (!isEditing) {
                                // Use effective values (site overrides or class defaults)
                                setEditForm({
                                  name: site.name,
                                  siteNumber: site.siteNumber,
                                  siteType: site.siteType || cls?.siteType || "rv",
                                  maxOccupancy: site.maxOccupancy || cls?.maxOccupancy || 4,
                                  rigMaxLength: site.rigMaxLength ?? cls?.rigMaxLength ?? "",
                                  hookupsPower: site.hookupsPower ?? cls?.hookupsPower ?? false,
                                  hookupsWater: site.hookupsWater ?? cls?.hookupsWater ?? false,
                                  hookupsSewer: site.hookupsSewer ?? cls?.hookupsSewer ?? false,
                                  powerAmps: Array.isArray(site.powerAmps) ? site.powerAmps : (site.powerAmps ? [site.powerAmps] : (cls?.electricAmps ?? [])),
                                  petFriendly: site.petFriendly ?? cls?.petFriendly ?? false,
                                  accessible: site.accessible ?? cls?.accessible ?? false,
                                  minNights: site.minNights ?? cls?.minNights ?? "",
                                  maxNights: site.maxNights ?? cls?.maxNights ?? "",
                                  photos: site.photos?.join(", ") ?? "",
                                  description: site.description ?? "",
                                  tags: site.tags?.join(", ") ?? "",
                                  siteClassId: site.siteClassId ?? "",
                                  isActive: site.isActive !== false
                                });
                              } else {
                                setEditForm(null);
                              }
                            }}
                            title="Edit"
                            aria-label={`Edit ${site.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={deleteSite.isPending}
                                title="Delete"
                                aria-label={`Delete ${site.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                            title={`Delete "${site.name}"?`}
                            description="This action cannot be undone. All reservations and history for this site will be preserved."
                            confirmLabel="Delete"
                            variant="destructive"
                            onConfirm={() => deleteSite.mutate(site.id)}
                            isPending={deleteSite.isPending}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Expandable edit row */}
                    {isEditing && editForm && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/50 p-0">
                          <motion.div
                            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                            transition={SPRING_CONFIG}
                            className="p-4 border-t border-b border-border space-y-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <Input
                                placeholder="Name"
                                value={editForm.name}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, name: e.target.value } : s))}
                                className="bg-background border-border"
                                aria-label="Site name"
                              />
                              <Input
                                placeholder="Site number"
                                value={editForm.siteNumber}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, siteNumber: e.target.value } : s))}
                                className="bg-background border-border"
                                aria-label="Site number"
                              />
                              <Select
                                value={editForm.siteType}
                                onValueChange={(value) => setEditForm((s) => (s ? { ...s, siteType: value } : s))}
                              >
                                <SelectTrigger className="bg-background border-border" aria-label="Site type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(siteTypeConfig).map(([key, config]) => (
                                    <SelectItem key={key} value={key}>
                                      <span className="flex items-center gap-2">
                                        {config.icon}
                                        {config.label}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={editForm.siteClassId || "none"}
                                onValueChange={(value) => {
                                  const classId = value === "none" ? "" : value;
                                  const selectedClass = classesQuery.data?.find(c => c.id === classId);

                                  if (selectedClass) {
                                    // Auto-fill from class defaults when changing class
                                    setEditForm((s) => s ? {
                                      ...s,
                                      siteClassId: classId,
                                      siteType: selectedClass.siteType || s.siteType,
                                      maxOccupancy: selectedClass.maxOccupancy || s.maxOccupancy,
                                      rigMaxLength: selectedClass.rigMaxLength ?? s.rigMaxLength,
                                      hookupsPower: selectedClass.hookupsPower ?? s.hookupsPower,
                                      hookupsWater: selectedClass.hookupsWater ?? s.hookupsWater,
                                      hookupsSewer: selectedClass.hookupsSewer ?? s.hookupsSewer,
                                      petFriendly: selectedClass.petFriendly ?? s.petFriendly,
                                      accessible: selectedClass.accessible ?? s.accessible,
                                      minNights: selectedClass.minNights ?? s.minNights,
                                      maxNights: selectedClass.maxNights ?? s.maxNights,
                                    } : s);
                                  } else {
                                    setEditForm((s) => s ? { ...s, siteClassId: classId } : s);
                                  }
                                }}
                              >
                                <SelectTrigger className="bg-background border-border" aria-label="Site class">
                                  <SelectValue placeholder="Select class (inherits settings)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No class</SelectItem>
                                  {classesQuery.data?.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                      {c.name} (${(c.defaultRate / 100).toFixed(2)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <Input
                                type="number"
                                placeholder="Max occupancy"
                                value={editForm.maxOccupancy}
                                onChange={(e) =>
                                  setEditForm((s) => (s ? { ...s, maxOccupancy: e.target.value === "" ? 0 : Number(e.target.value) } : s))
                                }
                                className="bg-background border-border"
                                aria-label="Max occupancy"
                              />
                              <Input
                                type="number"
                                placeholder="Rig max length (ft)"
                                value={editForm.rigMaxLength}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                                className="bg-background border-border"
                                aria-label="Rig max length"
                              />
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground mr-1">Power:</span>
                                {POWER_AMP_OPTIONS.map((amp) => (
                                  <button
                                    key={amp}
                                    type="button"
                                    onClick={() => {
                                      setEditForm((s) => s ? {
                                        ...s,
                                        powerAmps: s.powerAmps.includes(amp)
                                          ? s.powerAmps.filter((a) => a !== amp)
                                          : [...s.powerAmps, amp].sort((a, b) => a - b)
                                      } : s);
                                    }}
                                    className={cn(
                                      "px-2 py-1 text-xs rounded-md border transition-all",
                                      editForm.powerAmps.includes(amp)
                                        ? "border-amber-500 bg-status-warning/15 text-status-warning"
                                        : "border-border bg-background text-muted-foreground hover:border-amber-300"
                                    )}
                                    aria-pressed={editForm.powerAmps.includes(amp)}
                                  >
                                    {amp}A
                                  </button>
                                ))}
                              </div>
                              <Input
                                type="number"
                                placeholder="Min nights"
                                value={editForm.minNights}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                                className="bg-background border-border"
                                aria-label="Minimum nights"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="text-xs font-semibold text-muted-foreground">Hookups:</span>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={editForm.hookupsPower}
                                  onCheckedChange={(checked) => setEditForm((s) => (s ? { ...s, hookupsPower: Boolean(checked) } : s))}
                                  aria-label="Power hookups"
                                />
                                <Zap className="h-3.5 w-3.5 text-amber-500" />
                                Power
                              </label>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={editForm.hookupsWater}
                                  onCheckedChange={(checked) => setEditForm((s) => (s ? { ...s, hookupsWater: Boolean(checked) } : s))}
                                  aria-label="Water hookups"
                                />
                                <Droplet className="h-3.5 w-3.5 text-blue-500" />
                                Water
                              </label>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={editForm.hookupsSewer}
                                  onCheckedChange={(checked) => setEditForm((s) => (s ? { ...s, hookupsSewer: Boolean(checked) } : s))}
                                  aria-label="Sewer hookups"
                                />
                                <Waves className="h-3.5 w-3.5 text-muted-foreground" />
                                Sewer
                              </label>
                              <span className="text-xs font-semibold text-muted-foreground ml-4">Features:</span>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={editForm.petFriendly}
                                  onCheckedChange={(checked) => setEditForm((s) => (s ? { ...s, petFriendly: Boolean(checked) } : s))}
                                  aria-label="Pet friendly"
                                />
                                <PawPrint className="h-3.5 w-3.5 text-amber-600" />
                                Pet friendly
                              </label>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <Checkbox
                                  checked={editForm.accessible}
                                  onCheckedChange={(checked) => setEditForm((s) => (s ? { ...s, accessible: Boolean(checked) } : s))}
                                  aria-label="Accessible"
                                />
                                <Accessibility className="h-3.5 w-3.5 text-blue-600" />
                                Accessible
                              </label>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t border-border">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!editForm) return;
                                  updateSite.mutate({ id: site.id, data: mapFormToPayload(editForm, { clearEmptyAsNull: true }) });
                                }}
                                disabled={updateSite.isPending}
                                className="bg-status-success text-white hover:bg-status-success/90"
                              >
                                {updateSite.isPending ? "Saving..." : "Save changes"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditForm(null);
                                }}
                                disabled={updateSite.isPending}
                              >
                                Cancel
                              </Button>
                              <span className="text-xs text-muted-foreground">Cmd+S to save, Escape to cancel</span>
                              {updateSite.isError && (
                                <span role="alert" className="text-sm text-red-600">
                                  Failed to update
                                </span>
                              )}
                            </div>
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredSites.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      transition={SPRING_CONFIG}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="h-20 w-20 rounded-full bg-status-success/15 flex items-center justify-center">
                        <Trees className="h-10 w-10 text-status-success" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-semibold text-foreground">
                          {data?.length === 0 ? "No sites yet" : "No sites match your filters"}
                        </p>
                        <p className="text-sm max-w-md mx-auto">
                          {data?.length === 0
                            ? "Sites are the bookable units at your campground. Add your first site to start accepting reservations."
                            : "Try adjusting your search or filter criteria to find what you're looking for."}
                        </p>
                      </div>
                      {data?.length === 0 && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={() => setShowCreateForm(true)}
                            className="gap-2 bg-status-success text-white hover:bg-status-success/90"
                          >
                            <Plus className="h-4 w-4" />
                            Add Your First Site
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </Card>
        </motion.div>

        {/* Pagination Controls */}
        {filteredSites.length > itemsPerPage && (
          <motion.div
            variants={staggerChild}
            transition={SPRING_CONFIG}
            className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-muted/30 rounded-xl border border-border"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-8 bg-background border-border" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span>per page</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
                aria-label="First page"
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
                aria-label="Last page"
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredSites.length)} of {filteredSites.length}
            </div>
          </motion.div>
        )}
      </motion.div>
    </DashboardShell>
  );
}
