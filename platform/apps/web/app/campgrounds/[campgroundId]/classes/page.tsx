"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { apiClient } from "../../../../lib/api-client";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";

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
  const [form, setForm] = useState<SiteClassFormState>(defaultClassForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteClassFormState | null>(null);

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
    }
  });
  const updateClass = useMutation({
    mutationFn: (payload: { id: string; data: ReturnType<typeof mapClassFormToPayload> }) =>
      apiClient.updateSiteClass(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] });
      setEditingId(null);
      setEditForm(null);
    }
  });
  const deleteClass = useMutation({
    mutationFn: (id: string) => apiClient.deleteSiteClass(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["site-classes", campgroundId] })
  });

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds" },
            { label: campgroundQuery.data?.name || campgroundId },
            { label: "Site Classes" }
          ]}
        />
        <h2 className="text-xl font-semibold text-slate-900">Site classes</h2>
        <p className="text-sm text-slate-600">Add photos to classes to share gallery images across sites in that class.</p>
        <div className="card p-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Add site class</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Default rate ($)"
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
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Max occupancy"
              value={form.maxOccupancy}
              onChange={(e) => setForm((s) => ({ ...s, maxOccupancy: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Rig max length"
              value={form.rigMaxLength}
              onChange={(e) => setForm((s) => ({ ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            />
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-slate-700">Photos (comma-separated URLs)</label>
              <textarea
                className="rounded-md border border-slate-200 px-3 py-2 w-full"
                placeholder="https://img1.jpg, https://img2.jpg"
                value={form.photos}
                onChange={(e) => setForm((s) => ({ ...s, photos: e.target.value }))}
              />
              {form.photos && form.photos.split(",").map((p) => p.trim()).filter(Boolean).length > 0 && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {form.photos
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
            <div className="flex flex-wrap gap-3 md:col-span-2">
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
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Min nights"
              value={form.minNights}
              onChange={(e) => setForm((s) => ({ ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2"
              placeholder="Max nights"
              value={form.maxNights}
              onChange={(e) => setForm((s) => ({ ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) }))}
            />
            <input
              className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
              placeholder="Photos (comma-separated URLs)"
              value={form.photos}
              onChange={(e) => setForm((s) => ({ ...s, photos: e.target.value }))}
            />
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
          <div className="mt-3">
            <Button disabled={createClass.isPending || !form.name} onClick={() => createClass.mutate()}>
              {createClass.isPending ? "Saving..." : "Save class"}
            </Button>
            {createClass.isError && <span className="ml-3 text-sm text-red-600">Failed to save class</span>}
          </div>
        </div>
        <div className="grid gap-3">
          {classesQuery.data?.map((cls) => {
            const isEditing = editingId === cls.id;
            return (
              <div key={cls.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">{cls.name}</div>
                    <div className="text-sm text-slate-600">
                      {cls.siteType} • Max {cls.maxOccupancy} • ${(cls.defaultRate / 100).toFixed(2)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Min nights {cls.minNights ?? "n/a"} • Max nights {cls.maxNights ?? "n/a"} • Pet {cls.petFriendly ? "yes" : "no"} • Accessible{" "}
                      {cls.accessible ? "yes" : "no"}
                    </div>
                    {cls.description && <div className="text-xs text-slate-500">{cls.description}</div>}
                    {cls.photos && cls.photos.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500">Photos: {cls.photos.length}</div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {cls.photos.map((url) => (
                            <div key={url} className="relative h-20 w-full overflow-hidden rounded border border-slate-200 bg-slate-50">
                              <img src={url} alt="Class photo" className="h-full w-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                <div className="text-right text-xs text-slate-500 space-y-2 min-w-[150px]">
                    {cls.glCode && <div>GL {cls.glCode}</div>}
                    {cls.clientAccount && <div>Acct {cls.clientAccount}</div>}
                    {cls.policyVersion && <div>Policy {cls.policyVersion}</div>}
                    <div className={cls.isActive ? "text-emerald-700 font-semibold" : "text-slate-500"}>{cls.isActive ? "Active" : "Inactive"}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/campgrounds/${campgroundId}/classes/${cls.id}`)}
                  >
                    View details
                  </Button>
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
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
                        }}
                      >
                        Edit
                      </Button>
                    )}
                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteClass.mutate(cls.id)}
                        disabled={deleteClass.isPending}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                {isEditing && editForm && (
                  <div className="border-t border-slate-200 pt-3 mt-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Name"
                        value={editForm.name}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, name: e.target.value } : s))}
                      />
                      <input
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
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Max occupancy"
                        value={editForm.maxOccupancy}
                        onChange={(e) =>
                          setEditForm((s) => (s ? { ...s, maxOccupancy: e.target.value === "" ? "" : Number(e.target.value) } : s))
                        }
                      />
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Rig max length"
                        value={editForm.rigMaxLength}
                        onChange={(e) =>
                          setEditForm((s) => (s ? { ...s, rigMaxLength: e.target.value === "" ? "" : Number(e.target.value) } : s))
                        }
                      />
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2 md:col-span-2"
                        placeholder="Description"
                        value={editForm.description}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, description: e.target.value } : s))}
                      />
                      <div className="flex flex-wrap gap-3 md:col-span-2">
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
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Min nights"
                        value={editForm.minNights}
                        onChange={(e) =>
                          setEditForm((s) => (s ? { ...s, minNights: e.target.value === "" ? "" : Number(e.target.value) } : s))
                        }
                      />
                      <input
                        className="rounded-md border border-slate-200 px-3 py-2"
                        placeholder="Max nights"
                        value={editForm.maxNights}
                        onChange={(e) =>
                          setEditForm((s) => (s ? { ...s, maxNights: e.target.value === "" ? "" : Number(e.target.value) } : s))
                        }
                      />
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-semibold text-slate-700">Photos (comma-separated URLs)</label>
                        <textarea
                          className="rounded-md border border-slate-200 px-3 py-2 w-full"
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
                        placeholder="Policy version (snapshot id)"
                        value={editForm.policyVersion}
                        onChange={(e) => setEditForm((s) => (s ? { ...s, policyVersion: e.target.value } : s))}
                      />
                      <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm((s) => (s ? { ...s, isActive: e.target.checked } : s))}
                        />
                        Active
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
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
                      {updateClass.isError && <span className="text-sm text-red-600">Failed to update</span>}
                      {deleteClass.isError && <span className="text-sm text-red-600">Failed to delete</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!classesQuery.isLoading && !classesQuery.data?.length && (
            <div className="text-slate-600">No site classes yet.</div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
