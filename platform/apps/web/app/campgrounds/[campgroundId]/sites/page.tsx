"use client";

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
import { ChevronDown, ChevronUp, Search, X, MoreHorizontal, Pencil, Trash2, Copy } from "lucide-react";
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

  // Toggle site selection for bulk operations
  const toggleSiteSelection = (siteId: string) => {
    setSelectedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  // Select/deselect all visible sites
  const toggleSelectAll = () => {
    if (selectedSites.size === filteredSites.length) {
      setSelectedSites(new Set());
    } else {
      setSelectedSites(new Set(filteredSites.map((s) => s.id)));
    }
  };

  // Handle delete with confirmation
  const handleDelete = (siteId: string, siteName: string) => {
    if (window.confirm(`Are you sure you want to delete "${siteName}"? This action cannot be undone.`)) {
      deleteSite.mutate(siteId);
    }
  };

  // Quick update with undo capability
  const quickUpdateSite = useMutation({
    mutationFn: (payload: { id: string; data: Partial<ReturnType<typeof mapFormToPayload>>; previousData?: Partial<ReturnType<typeof mapFormToPayload>>; description?: string }) =>
      apiClient.updateSite(payload.id, payload.data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
      const { id, previousData, description } = variables;

      // If we have previous data, show undo toast
      if (previousData) {
        toast({
          title: "Site updated",
          description: description || "Changes saved.",
          action: (
            <ToastAction altText="Undo" onClick={() => {
              apiClient.updateSite(id, previousData).then(() => {
                queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
                toast({ title: "Undone", description: "Change reverted." });
              });
            }}>
              Undo
            </ToastAction>
          ),
        });
      } else {
        toast({ title: "Site updated", description: "Changes saved successfully." });
      }
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
        {filteredSites.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={selectedSites.size === filteredSites.length && filteredSites.length > 0}
              onChange={toggleSelectAll}
              className="rounded border-slate-300"
            />
            <span>Select all ({filteredSites.length} sites)</span>
          </div>
        )}

        <div className="grid gap-3">
          {filteredSites.map((site) => {
            const cls =
              classesQuery.data?.find((c) => c.id === (site as any).siteClassId) ||
              (site as any).siteClass ||
              null;
            const isEditing = editingId === site.id;
            const isSelected = selectedSites.has(site.id);
            const isInactive = site.isActive === false;
            return (
              <div key={site.id} className={`card p-4 ${isInactive ? "opacity-60 bg-slate-50" : ""}`}>
                <div className="flex items-start gap-3">
                  {/* Checkbox for bulk selection */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSiteSelection(site.id)}
                    className="mt-1 rounded border-slate-300"
                  />

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-slate-900">{site.name}</span>
                          <span className="text-sm text-slate-400">#{site.siteNumber}</span>
                          {isInactive && (
                            <span className="px-2 py-0.5 text-xs rounded bg-slate-200 text-slate-600">Inactive</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">Type:</span> {site.siteType.toUpperCase()}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">Guests:</span> {site.maxOccupancy} max
                          </span>
                          {site.rigMaxLength && (
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400">Rig:</span> {site.rigMaxLength}ft max
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">Hookups:</span>
                            {site.hookupsPower || site.hookupsWater || site.hookupsSewer ? (
                              <>
                                {site.hookupsPower && <span>Power{site.powerAmps ? ` (${site.powerAmps}A)` : ""}</span>}
                                {site.hookupsPower && site.hookupsWater && ", "}
                                {site.hookupsWater && "Water"}
                                {(site.hookupsPower || site.hookupsWater) && site.hookupsSewer && ", "}
                                {site.hookupsSewer && "Sewer"}
                              </>
                            ) : (
                              "None"
                            )}
                          </span>
                          <span>{site.petFriendly ? "🐕 Pets OK" : "No pets"}</span>
                          {site.accessible && <span>♿ Accessible</span>}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {/* Inline Class Dropdown with Undo */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Class:</span>
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
                            className="text-sm border border-slate-200 rounded px-2 py-1 min-w-[140px]"
                            disabled={quickUpdateSite.isPending}
                          >
                            <option value="">No class</option>
                            {classesQuery.data?.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} (${(c.defaultRate / 100).toFixed(2)})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Active/Inactive Toggle with Undo */}
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
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            site.isActive !== false
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                          disabled={quickUpdateSite.isPending}
                        >
                          {site.isActive !== false ? "Active" : "Inactive"}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/campgrounds/${campgroundId}/sites/${site.id}`)}
                      >
                        View details
                      </Button>
                      {!isEditing && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(site.id);
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
                          }}
                        >
                          Edit all
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(site.id, site.name)}
                        disabled={deleteSite.isPending}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
                {isEditing && editForm && (
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                        placeholder="Rig max length (optional)"
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
                      <div className="flex flex-wrap gap-3">
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
                      <input
                        type="number"
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Min nights"
                        value={editForm.minNights}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                      />
                      <input
                        type="number"
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Max nights"
                        value={editForm.maxNights}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                      />
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Photos (comma-separated URLs)</label>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                          <div className="text-xs text-slate-500 mb-2">Upload photo:</div>
                          <ImageUpload
                            onChange={(url) => {
                              if (!url) return;
                              const current = editForm.photos ? editForm.photos.split(",").map(p => p.trim()).filter(Boolean) : [];
                              setEditForm(s => (s ? { ...s, photos: [...current, url].join(", ") } : s));
                            }}
                            placeholder="Upload site photo"
                          />
                        </div>
                        <textarea
                          className="rounded-md border border-slate-200 px-3 py-2 w-full text-xs"
                          placeholder="https://img1.jpg, https://img2.jpg"
                          value={editForm.photos}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, photos: e.target.value } : s))}
                        />
                        {editForm.photos &&
                          editForm.photos.split(",").map((p) => p.trim()).filter(Boolean).length > 0 && (
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {editForm.photos
                                .split(",")
                                .map((p) => p.trim())
                                .filter(Boolean)
                                .map((url) => (
                                  <div key={url} className="text-[10px] truncate rounded border border-slate-200 bg-slate-50 p-1">
                                    {url}
                                  </div>
                                ))}
                            </div>
                          )}
                      </div>
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
                        placeholder="Tags (comma-separated)"
                        value={editForm.tags}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, tags: e.target.value } : s))}
                      />
                      <textarea
                        className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
                        placeholder="Description"
                        value={editForm.description}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, description: e.target.value } : s))}
                      />
                    </div>
                    <div className="flex items-center gap-3">
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
                      {updateSite.isError && <span className="text-sm text-red-600">Failed to update</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!isLoading && !data?.length && <div className="text-slate-600">No sites yet.</div>}
        </div>
      </div>
    </DashboardShell>
  );
}
