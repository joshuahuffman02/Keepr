"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../../lib/api-client";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { ImageUpload } from "../../../../components/ui/image-upload";

type SiteFormState = {
  name: string;
  siteNumber: string;
  siteType: string;
  maxOccupancy: number;
  rigMaxLength: number | "";
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  powerAmps: number | "";
  petFriendly: boolean;
  accessible: boolean;
  minNights: number | "";
  maxNights: number | "";
  photos: string;
  description: string;
  tags: string;
  siteClassId: string;
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
  siteClassId: ""
};

export default function SitesPage() {
  const params = useParams();
  const router = useRouter();
  const campgroundId = params?.campgroundId as string;
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
      powerAmps: parseOptionalNumber(state.powerAmps),
      petFriendly: state.petFriendly,
      accessible: state.accessible,
      minNights: parseOptionalNumber(state.minNights),
      maxNights: parseOptionalNumber(state.maxNights),
      photos: state.photos ? state.photos.split(",").map((p) => p.trim()) : opts?.clearEmptyAsNull ? [] : [],
      description: state.description || undefined,
      tags: state.tags ? state.tags.split(",").map((t) => t.trim()) : opts?.clearEmptyAsNull ? [] : [],
      siteClassId,
      isActive: true
    };
  };

  const createSite = useMutation({
    mutationFn: () =>
      apiClient.createSite(campgroundId, mapFormToPayload(formState)),
    onSuccess: () => {
      setFormState(defaultSiteForm);
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
    }
  });
  const updateSite = useMutation({
    mutationFn: (payload: { id: string; data: ReturnType<typeof mapFormToPayload> }) => apiClient.updateSite(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] });
      setEditingId(null);
      setEditForm(null);
    }
  });
  const deleteSite = useMutation({
    mutationFn: (id: string) => apiClient.deleteSite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sites", campgroundId] })
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
        <h2 className="text-xl font-semibold text-slate-900">Sites</h2>
        {isLoading && <p className="text-slate-600">Loading…</p>}
        {error && <p className="text-red-600">Error loading sites</p>}
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Add site</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Name"
              value={formState.name}
              onChange={(e) => setFormState((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Site number"
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
            <input
              type="number"
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Max occupancy"
              value={formState.maxOccupancy}
              onChange={(e) => setFormState((s) => ({ ...s, maxOccupancy: Number(e.target.value) }))}
            />
            <input
              type="number"
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Rig max length (optional)"
              value={formState.rigMaxLength}
              onChange={(e) => setFormState((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <input
              type="number"
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Power amps"
              value={formState.powerAmps}
              onChange={(e) => setFormState((s) => ({ ...s, powerAmps: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <select
              className="rounded-md border border-slate-200 px-3 py-2"
              value={formState.siteClassId ?? ""}
              onChange={(e) => setFormState((s) => ({ ...s, siteClassId: e.target.value }))}
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
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Min nights"
              value={formState.minNights}
              onChange={(e) => setFormState((s) => ({ ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <input
              type="number"
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Max nights"
              value={formState.maxNights}
              onChange={(e) => setFormState((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700">Photos (comma-separated URLs)</label>
              <div className="bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                <div className="text-xs text-slate-500 mb-2">Upload photo:</div>
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
                placeholder="https://img1.jpg, https://img2.jpg"
                value={formState.photos}
                onChange={(e) => setFormState((s) => ({ ...s, photos: e.target.value }))}
              />
              {formState.photos && formState.photos.split(",").map((p) => p.trim()).filter(Boolean).length > 0 && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {formState.photos
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
              value={formState.tags}
              onChange={(e) => setFormState((s) => ({ ...s, tags: e.target.value }))}
            />
            <textarea
              className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
              placeholder="Description"
              value={formState.description}
              onChange={(e) => setFormState((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          <div className="mt-3">
            <Button disabled={createSite.isPending || !formState.name || !formState.siteNumber} onClick={() => createSite.mutate()}>
              {createSite.isPending ? "Saving..." : "Save site"}
            </Button>
            {createSite.isError && <span className="ml-3 text-sm text-red-600">Failed to save site</span>}
          </div>
        </div>
        <div className="grid gap-3">
          {data?.map((site) => {
            const cls =
              classesQuery.data?.find((c) => c.id === (site as any).siteClassId) ||
              (site as any).siteClass ||
              null;
            const isEditing = editingId === site.id;
            return (
              <div key={site.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{site.name}</div>
                    <div className="text-sm text-slate-600">
                      #{site.siteNumber} • {site.siteType} • Max {site.maxOccupancy} guests
                    </div>
                    <div className="text-xs text-slate-500">
                      Power: {site.hookupsPower ? "yes" : "no"} · Water: {site.hookupsWater ? "yes" : "no"} · Sewer:{" "}
                      {site.hookupsSewer ? "yes" : "no"}
                    </div>
                    <div className="text-xs text-slate-500">
                      Pet friendly: {site.petFriendly ? "yes" : "no"} · Accessible: {site.accessible ? "yes" : "no"}
                    </div>
                    {(site.tags?.length || site.photos?.length) && (
                      <div className="text-xs text-slate-500">
                        {site.tags?.length ? `Tags: ${site.tags.join(", ")}` : ""} {site.photos?.length ? `Photos: ${site.photos.length}` : ""}
                      </div>
                    )}
                    {cls && (
                      <div className="text-xs text-slate-600 mt-1">
                        Class: {cls.name} • Default ${((cls.defaultRate ?? 0) / 100).toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
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
                            powerAmps: site.powerAmps ?? "",
                            petFriendly: !!site.petFriendly,
                            accessible: !!site.accessible,
                            minNights: site.minNights ?? "",
                            maxNights: site.maxNights ?? "",
                            photos: site.photos?.join(", ") ?? "",
                            description: site.description ?? "",
                            tags: site.tags?.join(", ") ?? "",
                            siteClassId: site.siteClassId ?? ""
                          });
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => deleteSite.mutate(site.id)} disabled={deleteSite.isPending}>
                      Delete
                    </Button>
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
                      <input
                        type="number"
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Power amps"
                        value={editForm.powerAmps}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, powerAmps: e.target.value === "" ? "" : Number(e.target.value) } : s))}
                      />
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
