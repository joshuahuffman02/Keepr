"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { apiClient } from "../../../../lib/api-client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "../../../../components/ui/button";
import { ImageUpload } from "../../../../components/ui/image-upload";
import { useToast } from "../../../../components/ui/use-toast";
import { ToastAction } from "../../../../components/ui/toast";
import { ChevronDown, ChevronUp, Pencil, X, Zap, Droplet, Waves, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

type SiteClassFormState = {
  name: string;
  description: string;
  defaultRate: number | "";
  siteType: string;
  maxOccupancy: number | "";
  rigMaxLength: number | "";
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  minNights: number | "";
  maxNights: number | "";
  petFriendly: boolean;
  accessible: boolean;
  photos: string;
  policyVersion: string;
  isActive: boolean;
};

const defaultClassForm: SiteClassFormState = {
  name: "",
  description: "",
  defaultRate: 0,
  siteType: "rv",
  maxOccupancy: 4,
  rigMaxLength: "",
  hookupsPower: false,
  hookupsWater: false,
  hookupsSewer: false,
  minNights: "",
  maxNights: "",
  petFriendly: true,
  accessible: false,
  photos: "",
  policyVersion: "",
  isActive: true
};

export default function SiteClassesPage() {
  const params = useParams();
  const router = useRouter();
  const campgroundId = params?.campgroundId as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId),
    enabled: !!campgroundId
  });
  const classesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });

  // Fetch sites to show counts per class
  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId
  });

  // Count sites per class
  const sitesPerClass = useMemo(() => {
    if (!sitesQuery.data) return {};
    return sitesQuery.data.reduce((acc, site) => {
      const classId = (site as any).siteClassId;
      if (classId) {
        acc[classId] = (acc[classId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }, [sitesQuery.data]);

  const [form, setForm] = useState<SiteClassFormState>(defaultClassForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteClassFormState | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [inlineEditingRate, setInlineEditingRate] = useState<string | null>(null);
  const [inlineRateValue, setInlineRateValue] = useState<string>("");
  const inlineRateInputRef = useRef<HTMLInputElement>(null);

  // Focus inline rate input when it becomes visible
  useEffect(() => {
    if (inlineEditingRate && inlineRateInputRef.current) {
      inlineRateInputRef.current.focus();
      inlineRateInputRef.current.select();
    }
  }, [inlineEditingRate]);

  const mapClassFormToPayload = (state: SiteClassFormState, opts?: { clearEmptyAsNull?: boolean }) => {
    const parseOptionalNumber = (value: number | "" | undefined | null) => {
      if (value === "" || value === undefined || value === null) {
        return opts?.clearEmptyAsNull ? null : undefined;
      }
      return Number(value);
    };
    return {
      name: state.name,
      description: state.description || undefined,
      defaultRate: Math.round(Number(state.defaultRate) * 100),
      siteType: state.siteType as any,
      maxOccupancy: Number(state.maxOccupancy || 0),
      rigMaxLength: parseOptionalNumber(state.rigMaxLength),
      hookupsPower: state.hookupsPower,
      hookupsWater: state.hookupsWater,
      hookupsSewer: state.hookupsSewer,
      tags: [],
      minNights: parseOptionalNumber(state.minNights),
      maxNights: parseOptionalNumber(state.maxNights),
      petFriendly: state.petFriendly,
      accessible: state.accessible,
      photos: state.photos ? state.photos.split(",").map((p) => p.trim()) : opts?.clearEmptyAsNull ? [] : [],
      policyVersion: state.policyVersion ? state.policyVersion : opts?.clearEmptyAsNull ? null : undefined,
      isActive: state.isActive
    };
  };

  const createClass = useMutation({
    mutationFn: () =>
      apiClient.createSiteClass(campgroundId, mapClassFormToPayload(form)),
    onSuccess: () => {
      setForm(defaultClassForm);
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      toast({ title: "Site class created", description: "The new site class has been added." });
    }
  });
  const updateClass = useMutation({
    mutationFn: (payload: { id: string; data: ReturnType<typeof mapClassFormToPayload> }) =>
      apiClient.updateSiteClass(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      setEditingId(null);
      setEditForm(null);
      toast({ title: "Changes saved", description: "Site class has been updated." });
    }
  });
  const updateInlineRate = useMutation({
    mutationFn: (payload: { id: string; rate: number; previousRate: number; className: string }) =>
      apiClient.updateSiteClass(payload.id, { defaultRate: Math.round(payload.rate * 100) }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      setInlineEditingRate(null);
      const { id, previousRate, className } = variables;
      toast({
        title: "Rate updated",
        description: `${className} rate set to $${variables.rate.toFixed(2)}`,
        action: (
          <ToastAction altText="Undo" onClick={() => {
            apiClient.updateSiteClass(id, { defaultRate: Math.round(previousRate * 100) }).then(() => {
              queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
              toast({ title: "Undone", description: `Rate reverted to $${previousRate.toFixed(2)}` });
            });
          }}>
            Undo
          </ToastAction>
        ),
      });
    }
  });
  const deleteClass = useMutation({
    mutationFn: (id: string) => apiClient.deleteSiteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      toast({ title: "Site class deleted", description: "The site class has been removed." });
    }
  });

  const handleInlineRateSave = (classId: string) => {
    const rate = parseFloat(inlineRateValue);
    const cls = classesQuery.data?.find(c => c.id === classId);
    if (!isNaN(rate) && rate >= 0 && cls) {
      updateInlineRate.mutate({
        id: classId,
        rate,
        previousRate: cls.defaultRate / 100,
        className: cls.name
      });
    } else {
      setInlineEditingRate(null);
    }
  };

  const handleDeleteClass = (id: string, name: string) => {
    const siteCount = sitesPerClass[id] || 0;
    const impactMessage = siteCount > 0
      ? `\n\n${siteCount} site${siteCount === 1 ? '' : 's'} will lose ${siteCount === 1 ? 'its' : 'their'} class assignment.`
      : '';
    if (window.confirm(`Are you sure you want to delete "${name}"?${impactMessage}\n\nThis action cannot be undone.`)) {
      deleteClass.mutate(id);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: campgroundQuery.data?.name || campgroundId },
            { label: "Site Classes" }
          ]}
        />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Site Classes</h2>
            {classesQuery.data && (
              <p className="text-sm text-slate-500">
                {classesQuery.data.length} classes
                {classesQuery.data.filter(c => c.isActive !== false).length !== classesQuery.data.length &&
                  ` (${classesQuery.data.filter(c => c.isActive !== false).length} active)`}
              </p>
            )}
          </div>
          {!showCreateForm && (
            <Button onClick={() => setShowCreateForm(true)}>+ Add Class</Button>
          )}
        </div>

        {showCreateForm && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-900">Add site class</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Essential fields - always visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Default rate ($) *"
              value={form.defaultRate}
              onChange={(e) => setForm((s) => ({ ...s, defaultRate: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <select
              className="rounded-md border border-slate-200 px-3 py-2"
              value={form.siteType}
              onChange={(e) => setForm((s) => ({ ...s, siteType: e.target.value }))}
            >
              <option value="rv">RV</option>
              <option value="tent">Tent</option>
              <option value="cabin">Cabin</option>
              <option value="group">Group</option>
              <option value="glamping">Glamping</option>
            </select>
            <input
              type="number"
              min="1"
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Max occupancy"
              value={form.maxOccupancy}
              onChange={(e) => setForm((s) => ({ ...s, maxOccupancy: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
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
                  className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                />
                <input
                  type="number"
                  min="0"
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Rig max length (ft)"
                  value={form.rigMaxLength}
                  onChange={(e) => setForm((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <div />
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <span className="text-xs font-semibold text-slate-600">Hookups:</span>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.hookupsPower}
                      onChange={(e) => setForm((s) => ({ ...s, hookupsPower: e.target.checked }))}
                    />
                    Power
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.hookupsWater}
                      onChange={(e) => setForm((s) => ({ ...s, hookupsWater: e.target.checked }))}
                    />
                    Water
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.hookupsSewer}
                      onChange={(e) => setForm((s) => ({ ...s, hookupsSewer: e.target.checked }))}
                    />
                    Sewer
                  </label>
                </div>
                <div className="flex flex-wrap gap-3 md:col-span-2">
                  <span className="text-xs font-semibold text-slate-600">Features:</span>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.petFriendly}
                      onChange={(e) => setForm((s) => ({ ...s, petFriendly: e.target.checked }))}
                    />
                    Pet friendly
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.accessible}
                      onChange={(e) => setForm((s) => ({ ...s, accessible: e.target.checked }))}
                    />
                    Accessible
                  </label>
                </div>
                <input
                  type="number"
                  min="1"
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Min nights"
                  value={form.minNights}
                  onChange={(e) => setForm((s) => ({ ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <input
                  type="number"
                  min="1"
                  className="rounded-md border border-slate-200 px-3 py-2"
                  placeholder="Max nights"
                  value={form.maxNights}
                  onChange={(e) => setForm((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
                />
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Photos</label>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                    <ImageUpload
                      onChange={(url) => {
                        if (!url) return;
                        const current = form.photos ? form.photos.split(",").map(p => p.trim()).filter(Boolean) : [];
                        setForm(s => ({ ...s, photos: [...current, url].join(", ") }));
                      }}
                      placeholder="Upload class photo"
                    />
                  </div>
                  <textarea
                    className="rounded-md border border-slate-200 px-3 py-2 w-full text-xs"
                    placeholder="Or enter URLs: https://img1.jpg, https://img2.jpg"
                    value={form.photos}
                    onChange={(e) => setForm((s) => ({ ...s, photos: e.target.value }))}
                  />
                  {form.photos && form.photos.split(",").map((p) => p.trim()).filter(Boolean).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {form.photos.split(",").map((p) => p.trim()).filter(Boolean).map((url) => (
                        <div key={url} className="text-[10px] truncate rounded border border-slate-200 bg-slate-50 p-1">
                          {url}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
                  placeholder="Policy version (snapshot id)"
                  value={form.policyVersion}
                  onChange={(e) => setForm((s) => ({ ...s, policyVersion: e.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            )}
          </div>

          <div className="mt-4">
            <Button disabled={createClass.isPending || !form.name} onClick={() => {
              createClass.mutate(undefined, {
                onSuccess: () => setShowCreateForm(false)
              });
            }}>
              {createClass.isPending ? "Saving..." : "Save class"}
            </Button>
            {createClass.isError && <span className="ml-3 text-sm text-red-600">Failed to save class</span>}
          </div>
        </div>
        )}
        {/* Table View */}
        <div className="card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Rate</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Max Guests</TableHead>
                <TableHead className="font-semibold hidden lg:table-cell">Hookups</TableHead>
                <TableHead className="font-semibold hidden md:table-cell">Sites</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classesQuery.data?.map((cls) => {
                const isEditing = editingId === cls.id;
                const isInactive = cls.isActive === false;
                const hasHookups = cls.hookupsPower || cls.hookupsWater || cls.hookupsSewer;
                const siteCount = sitesPerClass[cls.id] || 0;

                return (
                  <React.Fragment key={cls.id}>
                    <TableRow className={`${isInactive ? "opacity-50 bg-slate-50" : ""} hover:bg-slate-50`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            onClick={() => router.push(`/campgrounds/${campgroundId}/classes/${cls.id}`)}
                            className="font-medium text-slate-900 hover:text-emerald-600 text-left"
                          >
                            {cls.name}
                          </button>
                          {cls.description && (
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">{cls.description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                          {cls.siteType}
                        </span>
                      </TableCell>
                      <TableCell>
                        {inlineEditingRate === cls.id ? (
                          <span className="inline-flex items-center">
                            $
                            <input
                              ref={inlineRateInputRef}
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-20 px-1 py-0.5 text-sm border border-emerald-400 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              value={inlineRateValue}
                              onChange={(e) => setInlineRateValue(e.target.value)}
                              onBlur={() => handleInlineRateSave(cls.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineRateSave(cls.id);
                                if (e.key === "Escape") setInlineEditingRate(null);
                              }}
                            />
                            {updateInlineRate.isPending && <span className="ml-1 text-xs text-slate-400">...</span>}
                          </span>
                        ) : (
                          <button
                            className="inline-flex items-center gap-1 px-1 py-0.5 rounded hover:bg-slate-100 transition-colors group font-medium"
                            onClick={() => {
                              setInlineEditingRate(cls.id);
                              setInlineRateValue((cls.defaultRate / 100).toFixed(2));
                            }}
                            title="Click to edit rate"
                          >
                            ${(cls.defaultRate / 100).toFixed(2)}
                            <Pencil className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {cls.maxOccupancy}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1" title={`Power: ${cls.hookupsPower ? 'Yes' : 'No'}, Water: ${cls.hookupsWater ? 'Yes' : 'No'}, Sewer: ${cls.hookupsSewer ? 'Yes' : 'No'}`}>
                          {hasHookups ? (
                            <>
                              {cls.hookupsPower && <Zap className="h-3.5 w-3.5 text-amber-600" />}
                              {cls.hookupsWater && <Droplet className="h-3.5 w-3.5 text-blue-500" />}
                              {cls.hookupsSewer && <Waves className="h-3.5 w-3.5 text-slate-500" />}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {siteCount > 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {siteCount}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cls.isActive !== false
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {cls.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (isEditing) {
                                setEditingId(null);
                                setEditForm(null);
                              } else {
                                setEditingId(cls.id);
                                setEditForm({
                                  name: cls.name,
                                  description: cls.description ?? "",
                                  defaultRate: cls.defaultRate / 100,
                                  siteType: cls.siteType,
                                  maxOccupancy: cls.maxOccupancy,
                                  rigMaxLength: cls.rigMaxLength ?? "",
                                  hookupsPower: !!cls.hookupsPower,
                                  hookupsWater: !!cls.hookupsWater,
                                  hookupsSewer: !!cls.hookupsSewer,
                                  minNights: cls.minNights ?? "",
                                  maxNights: cls.maxNights ?? "",
                                  petFriendly: !!cls.petFriendly,
                                  accessible: !!cls.accessible,
                                  photos: cls.photos?.join(", ") ?? "",
                                  policyVersion: cls.policyVersion ?? "",
                                  isActive: cls.isActive ?? true
                                });
                              }
                            }}
                            className="h-8 w-8 p-0"
                            title={isEditing ? "Cancel" : "Edit"}
                          >
                            {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            disabled={deleteClass.isPending}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                type="number"
                                step="0.01"
                                min="0"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Default rate ($)"
                                value={editForm.defaultRate}
                                onChange={(e) =>
                                  setEditForm((s) => (s ? { ...s, defaultRate: e.target.value === "" ? "" : Number(e.target.value) } : s))
                                }
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
                                  setEditForm((s) => (s ? { ...s, maxOccupancy: e.target.value === "" ? "" : Number(e.target.value) } : s))
                                }
                              />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <input
                                type="number"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Rig max length (ft)"
                                value={editForm.rigMaxLength}
                                onChange={(e) =>
                                  setEditForm((s) => (s ? { ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) } : s))
                                }
                              />
                              <input
                                type="number"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Min nights"
                                value={editForm.minNights}
                                onChange={(e) =>
                                  setEditForm((s) => (s ? { ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) } : s))
                                }
                              />
                              <input
                                type="number"
                                className="rounded-md border border-slate-200 px-3 py-2"
                                placeholder="Max nights"
                                value={editForm.maxNights}
                                onChange={(e) =>
                                  setEditForm((s) => (s ? { ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) } : s))
                                }
                              />
                              <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={editForm.isActive}
                                  onChange={(e) => setEditForm((s) => (s ? { ...s, isActive: e.target.checked } : s))}
                                />
                                Active
                              </label>
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
                            <input
                              className="rounded-md border border-slate-200 px-3 py-2 w-full"
                              placeholder="Description"
                              value={editForm.description}
                              onChange={(e) => setEditForm((s) => (s ? { ...s, description: e.target.value } : s))}
                            />
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (!editForm) return;
                                  updateClass.mutate({ id: cls.id, data: mapClassFormToPayload(editForm, { clearEmptyAsNull: true }) });
                                }}
                                disabled={updateClass.isPending}
                              >
                                {updateClass.isPending ? "Saving..." : "Save changes"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditForm(null);
                                }}
                                disabled={updateClass.isPending}
                              >
                                Cancel
                              </Button>
                              <span className="text-xs text-slate-400">Cmd+S to save, Escape to cancel</span>
                              {updateClass.isError && <span className="text-sm text-red-600">Failed to update</span>}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {classesQuery.data?.length === 0 && !classesQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    No site classes yet. Click &apos;+ Add Class&apos; to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardShell>
  );
}
