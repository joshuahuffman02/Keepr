"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { apiClient } from "../../../../lib/api-client";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "../../../../components/ui/button";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { ImageUpload } from "../../../../components/ui/image-upload";
import { useToast } from "../../../../components/ui/use-toast";
import { ToastAction } from "../../../../components/ui/toast";
import { Card, CardContent } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Label } from "../../../../components/ui/label";
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
  rv: { icon: <Home className="h-4 w-4" />, label: "RV", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400" },
  tent: { icon: <Tent className="h-4 w-4" />, label: "Tent", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400" },
  cabin: { icon: <Home className="h-4 w-4" />, label: "Cabin", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" },
  group: { icon: <Users className="h-4 w-4" />, label: "Group", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400" },
  glamping: { icon: <Sparkles className="h-4 w-4" />, label: "Glamping", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-400" },
};

// Standard power amp options for RV sites
const POWER_AMP_OPTIONS = [
  { value: "", label: "None" },
  { value: "15", label: "15 amp" },
  { value: "20", label: "20 amp" },
  { value: "30", label: "30 amp" },
  { value: "50", label: "50 amp" },
  { value: "100", label: "100 amp" },
] as const;

type SiteFormState = {
  name: string;
  siteNumber: string;
  siteType: string;
  maxOccupancy: number;
  rigMaxLength: number | "";
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  powerAmps: string;
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
  powerAmps: "",
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
      siteType: state.siteType as any,
      maxOccupancy: Number(state.maxOccupancy),
      rigMaxLength: parseOptionalNumber(state.rigMaxLength),
      hookupsPower: state.hookupsPower,
      hookupsWater: state.hookupsWater,
      hookupsSewer: state.hookupsSewer,
      powerAmps: state.powerAmps ? parseInt(state.powerAmps, 10) : (opts?.clearEmptyAsNull ? null : undefined),
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

  // Handle delete with confirmation
  const handleDelete = (siteId: string, siteName: string) => {
    if (window.confirm(`Are you sure you want to delete "${siteName}"? This action cannot be undone.`)) {
      deleteSite.mutate(siteId);
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
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Trees className="h-5 w-5 text-white" />
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
              className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
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
                <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {error && <p className="text-red-500">Error loading sites</p>}

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
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] bg-background border-border">
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
              <SelectTrigger className="w-[160px] bg-background border-border">
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
              <SelectTrigger className="w-[130px] bg-background border-border">
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
                <SelectTrigger className="w-[130px] bg-background border-border">
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
              className="flex flex-wrap items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/50 rounded-xl border border-emerald-200 dark:border-emerald-800"
            >
              <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
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
                <SelectTrigger className="w-[150px] bg-background border-emerald-300 dark:border-emerald-700">
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
                className="border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
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
                className="border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
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
              />
              <Input
                placeholder="Site number *"
                value={formState.siteNumber}
                onChange={(e) => setFormState((s) => ({ ...s, siteNumber: e.target.value }))}
                className="bg-background border-border"
              />
              <Select
                value={formState.siteType}
                onValueChange={(value) => setFormState((s) => ({ ...s, siteType: value }))}
              >
                <SelectTrigger className="bg-background border-border">
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
                <SelectTrigger className="bg-background border-border">
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
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAdvanced ? "Hide" : "Show"} advanced options
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
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
                    />
                    <Input
                      type="number"
                      placeholder="Rig max length (ft)"
                      value={formState.rigMaxLength}
                      onChange={(e) => setFormState((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="bg-background border-border"
                    />
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <span className="text-xs font-semibold text-muted-foreground">Hookups:</span>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={formState.hookupsPower}
                          onChange={(e) => setFormState((s) => ({ ...s, hookupsPower: e.target.checked }))}
                          className="rounded border-border"
                        />
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Power
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={formState.hookupsWater}
                          onChange={(e) => setFormState((s) => ({ ...s, hookupsWater: e.target.checked }))}
                          className="rounded border-border"
                        />
                        <Droplet className="h-3.5 w-3.5 text-blue-500" />
                        Water
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={formState.hookupsSewer}
                          onChange={(e) => setFormState((s) => ({ ...s, hookupsSewer: e.target.checked }))}
                          className="rounded border-border"
                        />
                        <Waves className="h-3.5 w-3.5 text-slate-500" />
                        Sewer
                      </label>
                      {formState.hookupsPower && (
                        <Select
                          value={formState.powerAmps || "none"}
                          onValueChange={(value) => setFormState((s) => ({ ...s, powerAmps: value === "none" ? "" : value }))}
                        >
                          <SelectTrigger className="w-[100px] h-8 bg-background border-border">
                            <SelectValue placeholder="Amps" />
                          </SelectTrigger>
                          <SelectContent>
                            {POWER_AMP_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value || "none"} value={opt.value || "none"}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 md:col-span-2">
                      <span className="text-xs font-semibold text-muted-foreground">Features:</span>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={formState.petFriendly}
                          onChange={(e) => setFormState((s) => ({ ...s, petFriendly: e.target.checked }))}
                          className="rounded border-border"
                        />
                        <PawPrint className="h-3.5 w-3.5 text-amber-600" />
                        Pet friendly
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={formState.accessible}
                          onChange={(e) => setFormState((s) => ({ ...s, accessible: e.target.checked }))}
                          className="rounded border-border"
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
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Max nights"
                      value={formState.maxNights}
                      onChange={(e) => setFormState((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                      className="bg-background border-border"
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
                      <textarea
                        className="rounded-md border border-border bg-background px-3 py-2 w-full text-xs"
                        placeholder="Or enter URLs: https://img1.jpg, https://img2.jpg"
                        value={formState.photos}
                        onChange={(e) => setFormState((s) => ({ ...s, photos: e.target.value }))}
                      />
                    </div>
                    <Input
                      placeholder="Tags (comma-separated)"
                      value={formState.tags}
                      onChange={(e) => setFormState((s) => ({ ...s, tags: e.target.value }))}
                      className="bg-background border-border"
                    />
                    <textarea
                      className="rounded-md border border-border bg-background px-3 py-2"
                      placeholder="Description"
                      value={formState.description}
                      onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button
                disabled={createSite.isPending || !formState.name || !formState.siteNumber}
                onClick={() => createSite.mutate()}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
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
              {createSite.isError && <span className="text-sm text-red-600">Failed to save site</span>}
            </div>
            </CardContent>
          </Card>
          </motion.div>
          )}
        </AnimatePresence>
        {/* Select All checkbox when there are sites */}
        {paginatedSites.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={paginatedSites.length > 0 && paginatedSites.every((s) => selectedSites.has(s.id))}
              onChange={toggleSelectAll}
              className="rounded border-border"
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
                  <input
                    type="checkbox"
                    checked={paginatedSites.length > 0 && paginatedSites.every((s) => selectedSites.has(s.id))}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
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
                const cls = classesQuery.data?.find((c) => c.id === (site as any).siteClassId) || null;
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
                      isSelected && "bg-emerald-50 dark:bg-emerald-950/30",
                      "hover:bg-muted/50"
                    )}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => toggleSiteSelection(site.id, index, e)}
                          onChange={() => {}}
                          className="rounded border-border cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            onClick={() => router.push(`/campgrounds/${campgroundId}/sites/${site.id}`)}
                            className="font-medium text-foreground hover:text-emerald-600 dark:hover:text-emerald-400 text-left transition-colors"
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
                          value={(site as any).siteClassId ?? "none"}
                          onValueChange={(value) => {
                            const newClassId = value === "none" ? null : value;
                            const prevClassId = (site as any).siteClassId ?? null;
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
                          <SelectTrigger className="h-8 w-[110px] text-xs bg-background border-border">
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
                          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">${(cls.defaultRate / 100).toFixed(0)}</span>
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
                                  isInheritedHookups ? "text-amber-500/70 dark:text-amber-400/70" : "text-amber-600 dark:text-amber-400"
                                )}>
                                  <Zap className="h-3.5 w-3.5" />
                                  {site.powerAmps && <span className="text-xs">{site.powerAmps}</span>}
                                </span>
                              )}
                              {effectiveWater && (
                                <Droplet className={cn(
                                  "h-3.5 w-3.5",
                                  isInheritedHookups ? "text-blue-400/70 dark:text-blue-400/70" : "text-blue-500 dark:text-blue-400"
                                )} />
                              )}
                              {effectiveSewer && (
                                <Waves className={cn(
                                  "h-3.5 w-3.5",
                                  isInheritedHookups ? "text-slate-400/70 dark:text-slate-400/70" : "text-slate-500 dark:text-slate-400"
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
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70"
                              : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900/70"
                          )}
                          disabled={quickUpdateSite.isPending}
                          title={site.isActive !== false ? "Click to deactivate" : "Click to activate"}
                        >
                          <span className={cn(
                            "w-2 h-2 rounded-full transition-colors",
                            site.isActive !== false ? "bg-emerald-500" : "bg-red-500"
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
                                  powerAmps: site.powerAmps?.toString() ?? "",
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
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(site.id, site.name)}
                            disabled={deleteSite.isPending}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                              />
                              <Input
                                placeholder="Site number"
                                value={editForm.siteNumber}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, siteNumber: e.target.value } : s))}
                                className="bg-background border-border"
                              />
                              <Select
                                value={editForm.siteType}
                                onValueChange={(value) => setEditForm((s) => (s ? { ...s, siteType: value } : s))}
                              >
                                <SelectTrigger className="bg-background border-border">
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
                                <SelectTrigger className="bg-background border-border">
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
                              />
                              <Input
                                type="number"
                                placeholder="Rig max length (ft)"
                                value={editForm.rigMaxLength}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                                className="bg-background border-border"
                              />
                              <Select
                                value={editForm.powerAmps || "none"}
                                onValueChange={(value) => setEditForm((s) => (s ? { ...s, powerAmps: value === "none" ? "" : value } : s))}
                              >
                                <SelectTrigger className="bg-background border-border">
                                  <SelectValue placeholder="Power amps" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Power amps</SelectItem>
                                  {POWER_AMP_OPTIONS.filter(o => o.value).map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                placeholder="Min nights"
                                value={editForm.minNights}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                                className="bg-background border-border"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="text-xs font-semibold text-muted-foreground">Hookups:</span>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={editForm.hookupsPower}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, hookupsPower: e.target.checked } : s))}
                                  className="rounded border-border"
                                />
                                <Zap className="h-3.5 w-3.5 text-amber-500" />
                                Power
                              </label>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={editForm.hookupsWater}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, hookupsWater: e.target.checked } : s))}
                                  className="rounded border-border"
                                />
                                <Droplet className="h-3.5 w-3.5 text-blue-500" />
                                Water
                              </label>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={editForm.hookupsSewer}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, hookupsSewer: e.target.checked } : s))}
                                  className="rounded border-border"
                                />
                                <Waves className="h-3.5 w-3.5 text-slate-500" />
                                Sewer
                              </label>
                              <span className="text-xs font-semibold text-muted-foreground ml-4">Features:</span>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={editForm.petFriendly}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, petFriendly: e.target.checked } : s))}
                                  className="rounded border-border"
                                />
                                <PawPrint className="h-3.5 w-3.5 text-amber-600" />
                                Pet friendly
                              </label>
                              <label className="flex items-center gap-2 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={editForm.accessible}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, accessible: e.target.checked } : s))}
                                  className="rounded border-border"
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
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
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
                              {updateSite.isError && <span className="text-sm text-red-600">Failed to update</span>}
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
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <motion.div
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      transition={SPRING_CONFIG}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                        <Trees className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {data?.length === 0 ? "No sites yet" : "No sites match your filters"}
                        </p>
                        <p className="text-sm">
                          {data?.length === 0
                            ? "Click 'Add Site' above to create your first site."
                            : "Try adjusting your search or filter criteria."}
                        </p>
                      </div>
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
                <SelectTrigger className="w-[70px] h-8 bg-background border-border">
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
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
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
