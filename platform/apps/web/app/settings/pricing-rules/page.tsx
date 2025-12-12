"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Button } from "../../../components/ui/button";
import { apiClient } from "../../../lib/api-client";
import { Plus, Pencil, Trash2, Calendar, TrendingUp, Sun, Gift, BarChart3 } from "lucide-react";

type PricingRuleV2 = {
  id: string;
  campgroundId: string;
  name: string;
  type: "season" | "weekend" | "holiday" | "event" | "demand";
  priority: number;
  stackMode: "additive" | "max" | "override";
  adjustmentType: "percent" | "flat";
  adjustmentValue: number;
  siteClassId: string | null;
  dowMask: number[] | null;
  startDate: string | null;
  endDate: string | null;
  minRateCap: number | null;
  maxRateCap: number | null;
  active: boolean;
};

type SiteClass = { id: string; name: string };

type FormData = {
  name: string;
  type: "season" | "weekend" | "holiday" | "event" | "demand";
  priority: number;
  stackMode: "additive" | "max" | "override";
  adjustmentType: "percent" | "flat";
  adjustmentValue: string;
  siteClassId: string;
  dowMask: number[];
  startDate: string;
  endDate: string;
  minRateCap: string;
  maxRateCap: string;
  active: boolean;
};

const defaultFormData: FormData = {
  name: "",
  type: "season",
  priority: 10,
  stackMode: "additive",
  adjustmentType: "percent",
  adjustmentValue: "",
  siteClassId: "",
  dowMask: [],
  startDate: "",
  endDate: "",
  minRateCap: "",
  maxRateCap: "",
  active: true,
};

const ruleTypeLabels: Record<string, { label: string; icon: typeof Calendar }> = {
  season: { label: "Seasonal", icon: Sun },
  weekend: { label: "Weekend", icon: Calendar },
  holiday: { label: "Holiday", icon: Gift },
  event: { label: "Event", icon: Calendar },
  demand: { label: "Demand-Based", icon: BarChart3 },
};

const stackModeLabels: Record<string, string> = {
  additive: "Add to other adjustments",
  max: "Use highest adjustment",
  override: "Replace all other adjustments",
};

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PricingRulesV2Page() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleV2 | null>(null);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    const cg = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(cg);
  }, []);

  const rulesQuery = useQuery({
    queryKey: ["pricing-rules-v2", campgroundId],
    queryFn: () => apiClient.getPricingRulesV2(campgroundId!),
    enabled: !!campgroundId,
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId!),
    enabled: !!campgroundId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createPricingRuleV2>[1]) =>
      apiClient.createPricingRuleV2(campgroundId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules-v2", campgroundId] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updatePricingRuleV2>[1] }) =>
      apiClient.updatePricingRuleV2(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules-v2", campgroundId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePricingRuleV2(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules-v2", campgroundId] });
    },
  });

  const openCreateModal = () => {
    setEditingRule(null);
    setFormData(defaultFormData);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: PricingRuleV2) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      type: rule.type,
      priority: rule.priority,
      stackMode: rule.stackMode,
      adjustmentType: rule.adjustmentType,
      adjustmentValue: rule.adjustmentType === "percent"
        ? String(rule.adjustmentValue * 100)
        : String(rule.adjustmentValue / 100),
      siteClassId: rule.siteClassId || "",
      dowMask: rule.dowMask || [],
      startDate: rule.startDate?.split("T")[0] || "",
      endDate: rule.endDate?.split("T")[0] || "",
      minRateCap: rule.minRateCap ? String(rule.minRateCap / 100) : "",
      maxRateCap: rule.maxRateCap ? String(rule.maxRateCap / 100) : "",
      active: rule.active,
    });
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
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
      type: formData.type,
      priority: formData.priority,
      stackMode: formData.stackMode,
      adjustmentType: formData.adjustmentType,
      adjustmentValue: formData.adjustmentType === "percent"
        ? parseFloat(formData.adjustmentValue) / 100
        : parseFloat(formData.adjustmentValue) * 100,
      siteClassId: formData.siteClassId || null,
      dowMask: formData.dowMask.length > 0 ? formData.dowMask : undefined,
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      minRateCap: formData.minRateCap ? parseFloat(formData.minRateCap) * 100 : null,
      maxRateCap: formData.maxRateCap ? parseFloat(formData.maxRateCap) * 100 : null,
      active: formData.active,
    };

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({ id: editingRule.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save");
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this pricing rule?")) return;
    await deleteMutation.mutateAsync(id);
  };

  const toggleDow = (day: number) => {
    setFormData((prev) => ({
      ...prev,
      dowMask: prev.dowMask.includes(day)
        ? prev.dowMask.filter((d) => d !== day)
        : [...prev.dowMask, day].sort(),
    }));
  };

  const formatAdjustment = (rule: PricingRuleV2) => {
    if (rule.adjustmentType === "percent") {
      const pct = rule.adjustmentValue * 100;
      return pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
    }
    const flat = rule.adjustmentValue / 100;
    return flat >= 0 ? `+$${flat.toFixed(2)}` : `-$${Math.abs(flat).toFixed(2)}`;
  };

  const getSiteClassName = (id: string | null) => {
    if (!id) return "All Site Classes";
    const sc = siteClassesQuery.data?.find((c: SiteClass) => c.id === id);
    return sc?.name || id;
  };

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="text-center py-12 text-muted-foreground">
          Please select a campground first.
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dynamic Pricing Rules</h1>
            <p className="text-muted-foreground">
              Configure advanced pricing adjustments for seasons, weekends, holidays, events, and demand.
            </p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>

        {rulesQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : rulesQuery.data?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
            <TrendingUp className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No pricing rules yet</h3>
            <p className="mt-2 text-muted-foreground">
              Create dynamic pricing rules to adjust rates based on seasons, demand, and more.
            </p>
            <Button className="mt-4" onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rulesQuery.data?.sort((a, b) => a.priority - b.priority).map((rule) => {
              const TypeIcon = ruleTypeLabels[rule.type]?.icon || Calendar;
              return (
                <div
                  key={rule.id}
                  className={`border rounded-lg p-4 ${rule.active ? "bg-white" : "bg-slate-50 opacity-60"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${rule.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{rule.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Priority {rule.priority}
                          </span>
                          {!rule.active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-slate-700">{formatAdjustment(rule)}</span>
                          {" • "}
                          {ruleTypeLabels[rule.type]?.label}
                          {" • "}
                          {stackModeLabels[rule.stackMode]}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {getSiteClassName(rule.siteClassId)}
                          {rule.startDate && rule.endDate && (
                            <> • {new Date(rule.startDate).toLocaleDateString()} - {new Date(rule.endDate).toLocaleDateString()}</>
                          )}
                          {rule.dowMask && rule.dowMask.length > 0 && (
                            <> • {rule.dowMask.map((d) => daysOfWeek[d]).join(", ")}</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditModal(rule)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(rule.id)}
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {editingRule ? "Edit Pricing Rule" : "Create Pricing Rule"}
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
                  placeholder="e.g., Summer Peak Season"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as FormData["type"] })}
                  >
                    {Object.entries(ruleTypeLabels).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lower numbers run first. If rules overlap, priority decides which wins (e.g., 1 beats 10).
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Stacking Mode</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={formData.stackMode}
                  onChange={(e) => setFormData({ ...formData, stackMode: e.target.value as FormData["stackMode"] })}
                >
                  {Object.entries(stackModeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adjustment Type</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={formData.adjustmentType}
                    onChange={(e) => setFormData({ ...formData, adjustmentType: e.target.value as "percent" | "flat" })}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Value {formData.adjustmentType === "percent" ? "(%)" : "($)"}
                  </label>
                  <input
                    type="number"
                    step={formData.adjustmentType === "percent" ? "1" : "0.01"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder={formData.adjustmentType === "percent" ? "e.g., 15" : "e.g., 10.00"}
                    value={formData.adjustmentValue}
                    onChange={(e) => setFormData({ ...formData, adjustmentValue: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Class</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={formData.siteClassId}
                  onChange={(e) => setFormData({ ...formData, siteClassId: e.target.value })}
                >
                  <option value="">All Site Classes</option>
                  {siteClassesQuery.data?.map((sc: SiteClass) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              </div>

              {formData.type === "weekend" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Days of Week</label>
                  <div className="flex gap-2">
                    {daysOfWeek.map((day, idx) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDow(idx)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          formData.dowMask.includes(idx)
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(formData.type === "season" || formData.type === "holiday" || formData.type === "event") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Min Rate Cap ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g., 25.00"
                    value={formData.minRateCap}
                    onChange={(e) => setFormData({ ...formData, minRateCap: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Max Rate Cap ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="e.g., 150.00"
                    value={formData.maxRateCap}
                    onChange={(e) => setFormData({ ...formData, maxRateCap: e.target.value })}
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
                {saving ? "Saving..." : editingRule ? "Save Changes" : "Create Rule"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

