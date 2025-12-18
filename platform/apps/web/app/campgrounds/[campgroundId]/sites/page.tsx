"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Button } from "../../../../components/ui/button";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { ImageUpload } from "../../../../components/ui/image-upload";
import { useToast } from "../../../../components/ui/use-toast";
import { ToastAction } from "../../../../components/ui/toast";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, MoreHorizontal, Pencil, Trash2, Copy, Zap, Droplet, Waves } from "lucide-react";
import { Input } from "../../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

// Standard power amp options for RV sites
const POWER_AMP_OPTIONS = [
  { value: "", label: "None" },
  { value: "15", label: "15 amp" },
  { value: "20", label: "20 amp" },
  { value: "30", label: "30 amp" },
  { value: "50", label: "50 amp" },
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
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<SiteFormState>(defaultSiteForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteFormState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

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
    return data.filter((site) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!site.name.toLowerCase().includes(query) &&
            !site.siteNumber.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Type filter
      if (filterType && site.siteType !== filterType) return false;
      // Class filter
      if (filterClass && site.siteClassId !== filterClass) return false;
      // Active filter
      if (filterActive === "active" && !site.isActive) return false;
      if (filterActive === "inactive" && site.isActive !== false) return false;
      return true;
    });
  }, [data, searchQuery, filterType, filterClass, filterActive]);

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

  const classesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundQuery.data?.name || campgroundId },
            { label: "Sites" }
          ]}
        />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sites</h2>
            {data && (
              <p className="text-sm text-slate-500">
                {data.length} total sites
                {data.filter(s => s.isActive !== false).length !== data.length &&
                  ` (${data.filter(s => s.isActive !== false).length} active)`}
              </p>
            )}
          </div>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)}>+ Add Site</Button>
          )}
        </div>

        {isLoading && <p className="text-slate-600">Loading...</p>}
        {error && <p className="text-red-600">Error loading sites</p>}

        {/* Search and Filter Bar */}
        {data && data.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="rv">RV</option>
              <option value="tent">Tent</option>
              <option value="cabin">Cabin</option>
              <option value="group">Group</option>
              <option value="glamping">Glamping</option>
            </select>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All classes</option>
              {classesQuery.data?.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
            {(searchQuery || filterType || filterClass || filterActive !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterType("");
                  setFilterClass("");
                  setFilterActive("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {/* Bulk Selection Bar */}
        {selectedSites.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <span className="text-sm font-medium text-emerald-800">
              {selectedSites.size} site{selectedSites.size > 1 ? "s" : ""} selected
            </span>
            <select
              className="rounded-md border border-emerald-200 px-3 py-1.5 text-sm bg-white"
              onChange={(e) => {
                if (e.target.value) {
                  bulkUpdateSites.mutate({
                    siteIds: Array.from(selectedSites),
                    data: { siteClassId: e.target.value || null }
                  });
                  e.target.value = "";
                }
              }}
              disabled={bulkUpdateSites.isPending}
            >
              <option value="">Change class...</option>
              <option value="">Remove class</option>
              {classesQuery.data?.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
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
            {bulkUpdateSites.isPending && <span className="text-sm text-slate-500">Updating...</span>}
          </div>
        )}

        {/* Create Site Form - Collapsible */}
        {showCreateForm && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900">Add New Site</h3>
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
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Name *"
                value={formState.name}
                onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
              />
              <input
                className="rounded-md border border-slate-200 px-3 py-2"
                placeholder="Site number *"
                value={formState.siteNumber}
                onChange={(e) => setFormState((s) => ({ ...s, siteNumber: e.target.value }))}
              />
              <select
                className="rounded-md border border-slate-200 px-3 py-2"
                value={formState.siteType}
                onChange={(e) => setFormState((s) => ({ ...s, siteType: e.target.value }))}
              >
                <option value="rv">RV</option>
                <option value="tent">Tent</option>
                <option value="cabin">Cabin</option>
                <option value="group">Group</option>
                <option value="glamping">Glamping</option>
              </select>
              <select
                className="rounded-md border border-slate-200 px-3 py-2"
                value={formState.siteClassId ?? ""}
                onChange={(e) => setFormState((s) => ({ ...s, siteClassId: e.target.value }))}
              >
                <option value="">Select class (sets pricing)</option>
                {classesQuery.data?.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} (${(cls.defaultRate / 100).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Advanced options - collapsible */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showAdvanced ? "Hide" : "Show"} advanced options
              </button>

              {showAdvanced && (
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="1"
                    className="rounded-md border border-slate-200 px-3 py-2"
                    placeholder="Max occupancy"
                    value={formState.maxOccupancy}
                    onChange={(e) => setFormState((s) => ({ ...s, maxOccupancy: Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    className="rounded-md border border-slate-200 px-3 py-2"
                    placeholder="Rig max length (ft)"
                    value={formState.rigMaxLength}
                    onChange={(e) => setFormState((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
                  />
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <span className="text-xs font-semibold text-slate-600">Hookups:</span>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.hookupsPower}
                        onChange={(e) => setFormState((s) => ({ ...s, hookupsPower: e.target.checked }))}
                      />
                      Power
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.hookupsWater}
                        onChange={(e) => setFormState((s) => ({ ...s, hookupsWater: e.target.checked }))}
                      />
                      Water
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.hookupsSewer}
                        onChange={(e) => setFormState((s) => ({ ...s, hookupsSewer: e.target.checked }))}
                      />
                      Sewer
                    </label>
                    {formState.hookupsPower && (
                      <select
                        className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                        value={formState.powerAmps}
                        onChange={(e) => setFormState((s) => ({ ...s, powerAmps: e.target.value }))}
                      >
                        {POWER_AMP_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 md:col-span-2">
                    <span className="text-xs font-semibold text-slate-600">Features:</span>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.petFriendly}
                        onChange={(e) => setFormState((s) => ({ ...s, petFriendly: e.target.checked }))}
                      />
                      Pet friendly
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.accessible}
                        onChange={(e) => setFormState((s) => ({ ...s, accessible: e.target.checked }))}
                      />
                      Accessible
                    </label>
                  </div>
                  <input
                    type="number"
                    min="1"
                    className="rounded-md border border-slate-200 px-3 py-2"
                    placeholder="Min nights"
                    value={formState.minNights}
                    onChange={(e) => setFormState((s) => ({ ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                  />
                  <input
                    type="number"
                    min="1"
                    className="rounded-md border border-slate-200 px-3 py-2"
                    placeholder="Max nights"
                    value={formState.maxNights}
                    onChange={(e) => setFormState((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                  />
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Photos</label>
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-2">
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
                      className="rounded-md border border-slate-200 px-3 py-2 w-full text-xs"
                      placeholder="Or enter URLs: https://img1.jpg, https://img2.jpg"
                      value={formState.photos}
                      onChange={(e) => setFormState((s) => ({ ...s, photos: e.target.value }))}
                    />
                  </div>
                  <input
                    className="rounded-md border border-slate-200 px-3 py-2"
                    placeholder="Tags (comma-separated)"
                    value={formState.tags}
                    onChange={(e) => setFormState((s) => ({ ...s, tags: e.target.value }))}
                  />
                  <textarea
                    className="rounded-md border border-slate-200 px-3 py-2"
                    placeholder="Description"
                    value={formState.description}
                    onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Button disabled={createSite.isPending || !formState.name || !formState.siteNumber} onClick={() => createSite.mutate()}>
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
          </div>
        )}
        {/* Select All checkbox when there are sites */}
        {paginatedSites.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={paginatedSites.length > 0 && paginatedSites.every((s) => selectedSites.has(s.id))}
              onChange={toggleSelectAll}
              className="rounded border-slate-300"
            />
            <span>
              Select page ({paginatedSites.length} of {filteredSites.length} sites)
              {selectedSites.size > 0 && ` · ${selectedSites.size} selected`}
            </span>
          </div>
        )}

        {/* Table Layout */}
        <div className="card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={paginatedSites.length > 0 && paginatedSites.every((s) => selectedSites.has(s.id))}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
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

                const hasHookups = site.hookupsPower || site.hookupsWater || site.hookupsSewer;

                return (
                  <React.Fragment key={site.id}>
                    <TableRow className={`${isInactive ? "opacity-50 bg-slate-50" : ""} ${isSelected ? "bg-emerald-50" : ""} hover:bg-slate-50`}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => toggleSiteSelection(site.id, index, e)}
                          onChange={() => {}}
                          className="rounded border-slate-300 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            onClick={() => router.push(`/campgrounds/${campgroundId}/sites/${site.id}`)}
                            className="font-medium text-slate-900 hover:text-emerald-600 text-left"
                          >
                            {site.name}
                          </button>
                          <span className="text-xs text-slate-500">#{site.siteNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase">
                          {site.siteType}
                        </span>
                      </TableCell>
                      <TableCell>
                        <select
                          value={(site as any).siteClassId ?? ""}
                          onChange={(e) => {
                            const newClassId = e.target.value || null;
                            const prevClassId = (site as any).siteClassId ?? null;
                            const newClassName = classesQuery.data?.find(c => c.id === newClassId)?.name || "No class";
                            quickUpdateSite.mutate({
                              id: site.id,
                              data: { siteClassId: newClassId },
                              previousData: { siteClassId: prevClassId },
                              description: `Class changed to ${newClassName}`
                            });
                          }}
                          className="text-xs border border-slate-200 rounded px-2 py-1 max-w-[120px]"
                          disabled={quickUpdateSite.isPending}
                        >
                          <option value="">—</option>
                          {classesQuery.data?.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {cls ? (
                          <span className="text-sm font-medium text-emerald-700">${(cls.defaultRate / 100).toFixed(0)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1" title={`Power: ${site.hookupsPower ? 'Yes' : 'No'}, Water: ${site.hookupsWater ? 'Yes' : 'No'}, Sewer: ${site.hookupsSewer ? 'Yes' : 'No'}`}>
                          {hasHookups ? (
                            <>
                              {site.hookupsPower && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600">
                                  <Zap className="h-3.5 w-3.5" />
                                  {site.powerAmps && <span className="text-xs">{site.powerAmps}</span>}
                                </span>
                              )}
                              {site.hookupsWater && <Droplet className="h-3.5 w-3.5 text-blue-500" />}
                              {site.hookupsSewer && <Waves className="h-3.5 w-3.5 text-slate-500" />}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
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
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            site.isActive !== false
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                          disabled={quickUpdateSite.isPending}
                        >
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
                                setEditForm({
                                  name: site.name,
                                  siteNumber: site.siteNumber,
                                  siteType: site.siteType,
                                  maxOccupancy: site.maxOccupancy,
                                  rigMaxLength: site.rigMaxLength ?? "",
                                  hookupsPower: !!site.hookupsPower,
                                  hookupsWater: !!site.hookupsWater,
                                  hookupsSewer: !!site.hookupsSewer,
                                  powerAmps: site.powerAmps?.toString() ?? "",
                                  petFriendly: !!site.petFriendly,
                                  accessible: !!site.accessible,
                                  minNights: site.minNights ?? "",
                                  maxNights: site.maxNights ?? "",
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
                        <TableCell colSpan={8} className="bg-slate-50 p-0">
                          <div className="p-4 border-t border-b border-slate-200 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              <input
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Name"
                                value={editForm.name}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, name: e.target.value } : s))}
                              />
                              <input
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Site number"
                                value={editForm.siteNumber}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, siteNumber: e.target.value } : s))}
                              />
                              <select
                                className="rounded-md border border-slate-200 px-3 py-2"
                                value={editForm.siteType}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, siteType: e.target.value } : s))}
                              >
                                <option value="rv">RV</option>
                                <option value="tent">Tent</option>
                                <option value="cabin">Cabin</option>
                                <option value="group">Group</option>
                                <option value="glamping">Glamping</option>
                              </select>
                              <select
                                className="rounded-md border border-slate-200 px-3 py-2"
                                value={editForm.siteClassId ?? ""}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, siteClassId: e.target.value || "" } : s))}
                              >
                                <option value="">Select class (optional)</option>
                                {classesQuery.data?.map((cls) => (
                                  <option key={cls.id} value={cls.id}>
                                    {cls.name} (${(cls.defaultRate / 100).toFixed(2)})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <input
                                type="number"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Max occupancy"
                                value={editForm.maxOccupancy}
                                onChange={(e) =>
                                  setEditForm((s) => (s ? { ...s, maxOccupancy: e.target.value === "" ? 0 : Number(e.target.value) } : s))
                                }
                              />
                              <input
                                type="number"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Rig max length (ft)"
                                value={editForm.rigMaxLength}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                              />
                              <select
                                className="rounded-md border border-slate-200 px-3 py-2"
                                value={editForm.powerAmps}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, powerAmps: e.target.value } : s))}
                              >
                                <option value="">Power amps</option>
                                {POWER_AMP_OPTIONS.filter(o => o.value).map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              <input
                                type="number"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Min nights"
                                value={editForm.minNights}
                                onChange={(e) => setEditForm((s) => (s ? { ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="text-xs font-semibold text-slate-600">Hookups:</span>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={editForm.hookupsPower}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, hookupsPower: e.target.checked } : s))}
                                />
                                Power
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={editForm.hookupsWater}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, hookupsWater: e.target.checked } : s))}
                                />
                                Water
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={editForm.hookupsSewer}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, hookupsSewer: e.target.checked } : s))}
                                />
                                Sewer
                              </label>
                              <span className="text-xs font-semibold text-slate-600 ml-4">Features:</span>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={editForm.petFriendly}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, petFriendly: e.target.checked } : s))}
                                />
                                Pet friendly
                              </label>
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={editForm.accessible}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, accessible: e.target.checked } : s))}
                                />
                                Accessible
                              </label>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!editForm) return;
                                  updateSite.mutate({ id: site.id, data: mapFormToPayload(editForm, { clearEmptyAsNull: true }) });
                                }}
                                disabled={updateSite.isPending}
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
                              <span className="text-xs text-slate-400">Cmd+S to save, Escape to cancel</span>
                              {updateSite.isError && <span className="text-sm text-red-600">Failed to update</span>}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {filteredSites.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    {data?.length === 0 ? "No sites yet. Click '+ Add Site' to create one." : "No sites match your filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {filteredSites.length > itemsPerPage && (
          <div className="flex items-center justify-between px-2 py-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
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
              <span className="px-3 text-sm text-slate-600">
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
            <div className="text-sm text-slate-500">
              {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredSites.length)} of {filteredSites.length}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
