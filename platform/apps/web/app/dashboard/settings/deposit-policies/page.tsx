"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../../components/ui/button";
import { apiClient } from "../../../../lib/api-client";
import { Plus, Pencil, Trash2, Banknote, Clock, Percent, DollarSign } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";

type DepositPolicy = {
  id: string;
  campgroundId: string;
  name: string;
  strategy: "first_night" | "percent" | "fixed";
  value: number;
  applyTo: "lodging_only" | "lodging_and_fees";
  dueTiming: "at_booking" | "before_arrival";
  dueHoursBeforeArrival: number | null;
  minCap: number | null;
  maxCap: number | null;
  siteClassId: string | null;
  active: boolean;
  version: number;
};

type SiteClass = { id: string; name: string };

type FormData = {
  name: string;
  strategy: "first_night" | "percent" | "fixed";
  value: string;
  applyTo: "lodging_only" | "lodging_and_fees";
  dueTiming: "at_booking" | "before_arrival";
  dueHoursBeforeArrival: string;
  minCap: string;
  maxCap: string;
  siteClassId: string;
  active: boolean;
};

const defaultFormData: FormData = {
  name: "",
  strategy: "first_night",
  value: "",
  applyTo: "lodging_only",
  dueTiming: "at_booking",
  dueHoursBeforeArrival: "24",
  minCap: "",
  maxCap: "",
  siteClassId: "",
  active: true,
};

const strategyLabels: Record<string, { label: string; icon: typeof DollarSign; description: string }> = {
  first_night: { label: "First Night", icon: Clock, description: "Charge the first night's rate as deposit" },
  percent: { label: "Percentage", icon: Percent, description: "Charge a percentage of the total" },
  fixed: { label: "Fixed Amount", icon: DollarSign, description: "Charge a fixed dollar amount" },
};

const applyToLabels: Record<string, string> = {
  lodging_only: "Lodging only",
  lodging_and_fees: "Lodging + fees",
};

const dueTimingLabels: Record<string, string> = {
  at_booking: "At booking",
  before_arrival: "Before arrival",
};

export default function DepositPoliciesPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DepositPolicy | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const cg = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(cg);
  }, []);

  const policiesQuery = useQuery({
    queryKey: ["deposit-policies", campgroundId],
    queryFn: () => apiClient.getDepositPolicies(campgroundId!),
    enabled: !!campgroundId,
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId!),
    enabled: !!campgroundId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createDepositPolicy>[1]) =>
      apiClient.createDepositPolicy(campgroundId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-policies", campgroundId] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updateDepositPolicy>[1] }) =>
      apiClient.updateDepositPolicy(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-policies", campgroundId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteDepositPolicy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deposit-policies", campgroundId] });
    },
  });

  const openCreateModal = () => {
    setEditingPolicy(null);
    setFormData(defaultFormData);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (policy: DepositPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      strategy: policy.strategy,
      value: policy.strategy === "percent"
        ? String(policy.value)
        : String(policy.value / 100),
      applyTo: policy.applyTo,
      dueTiming: policy.dueTiming,
      dueHoursBeforeArrival: policy.dueHoursBeforeArrival ? String(policy.dueHoursBeforeArrival) : "24",
      minCap: policy.minCap ? String(policy.minCap / 100) : "",
      maxCap: policy.maxCap ? String(policy.maxCap / 100) : "",
      siteClassId: policy.siteClassId || "",
      active: policy.active,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingPolicy(null);
    setFormData(defaultFormData);
    setError(null);
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: formData.name.trim(),
      strategy: formData.strategy,
      value: formData.strategy === "percent"
        ? parseFloat(formData.value)
        : parseFloat(formData.value) * 100,
      applyTo: formData.applyTo,
      dueTiming: formData.dueTiming,
      dueHoursBeforeArrival: formData.dueTiming === "before_arrival"
        ? parseInt(formData.dueHoursBeforeArrival)
        : null,
      minCap: formData.minCap ? parseFloat(formData.minCap) * 100 : null,
      maxCap: formData.maxCap ? parseFloat(formData.maxCap) * 100 : null,
      siteClassId: formData.siteClassId || null,
      active: formData.active,
    };

    try {
      if (editingPolicy) {
        await updateMutation.mutateAsync({ id: editingPolicy.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save");
      setSaving(false);
    }
  };

  const confirmDeletePolicy = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirmId);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const formatValue = (policy: DepositPolicy) => {
    switch (policy.strategy) {
      case "first_night":
        return "First Night";
      case "percent":
        return `${policy.value}%`;
      case "fixed":
        return `$${(policy.value / 100).toFixed(2)}`;
    }
  };

  const getSiteClassName = (id: string | null) => {
    if (!id) return "All Site Classes";
    const sc = siteClassesQuery.data?.find((c: SiteClass) => c.id === id);
    return sc?.name || id;
  };

  if (!campgroundId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please select a campground first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Deposit Policies</h1>
            <p className="text-muted-foreground">
              Configure deposit requirements for reservations.
            </p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </div>

        {policiesQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : policiesQuery.data?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
            <Banknote className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No deposit policies yet</h3>
            <p className="mt-2 text-muted-foreground">
              Create policies to require deposits at booking or before arrival.
            </p>
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Policy
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {policiesQuery.data?.map((policy) => {
              const StrategyIcon = strategyLabels[policy.strategy]?.icon || DollarSign;
              return (
                <div
                  key={policy.id}
                  className={`border rounded-lg p-4 ${policy.active ? "bg-white" : "bg-slate-50 opacity-60"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${policy.active ? "bg-status-info/15 text-status-info" : "bg-slate-200 text-slate-500"}`}>
                        <StrategyIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{policy.name}</h3>
                          {!policy.active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-slate-700">{formatValue(policy)}</span>
                          {" • "}
                          {applyToLabels[policy.applyTo]}
                          {" • "}
                          {dueTimingLabels[policy.dueTiming]}
                          {policy.dueTiming === "before_arrival" && policy.dueHoursBeforeArrival && (
                            <> ({policy.dueHoursBeforeArrival}h before)</>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getSiteClassName(policy.siteClassId)}
                          {policy.minCap && <> • Min: ${(policy.minCap / 100).toFixed(2)}</>}
                          {policy.maxCap && <> • Max: ${(policy.maxCap / 100).toFixed(2)}</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(policy)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(policy.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingPolicy ? "Edit Deposit Policy" : "Create Deposit Policy"}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g., Standard Deposit"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(strategyLabels).map(([key, val]) => {
                    const Icon = val.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, strategy: key as FormData["strategy"] })}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          formData.strategy === key
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="h-5 w-5 mb-1" />
                        <div className="text-sm font-medium">{val.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.strategy !== "first_night" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {formData.strategy === "percent" ? "Percentage (%)" : "Amount ($)"}
                  </label>
                  <input
                    type="number"
                    step={formData.strategy === "percent" ? "1" : "0.01"}
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder={formData.strategy === "percent" ? "e.g., 50" : "e.g., 100.00"}
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apply To</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={formData.applyTo}
                    onChange={(e) => setFormData({ ...formData, applyTo: e.target.value as FormData["applyTo"] })}
                  >
                    {Object.entries(applyToLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Timing</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={formData.dueTiming}
                    onChange={(e) => setFormData({ ...formData, dueTiming: e.target.value as FormData["dueTiming"] })}
                  >
                    {Object.entries(dueTimingLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.dueTiming === "before_arrival" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hours Before Arrival</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={formData.dueHoursBeforeArrival}
                    onChange={(e) => setFormData({ ...formData, dueHoursBeforeArrival: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Class</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={formData.siteClassId}
                  onChange={(e) => setFormData({ ...formData, siteClassId: e.target.value })}
                >
                  <option value="">All Site Classes (campground default)</option>
                  {siteClassesQuery.data?.map((sc: SiteClass) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Cap ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g., 25.00"
                    value={formData.minCap}
                    onChange={(e) => setFormData({ ...formData, minCap: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Cap ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g., 500.00"
                    value={formData.maxCap}
                    onChange={(e) => setFormData({ ...formData, maxCap: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="active" className="text-sm text-slate-700">Active</label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={closeModal} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : editingPolicy ? "Save Changes" : "Create Policy"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deposit Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this deposit policy? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePolicy}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

