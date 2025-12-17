"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Button } from "../../../components/ui/button";
import { FormField } from "../../../components/ui/form-field";
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

// Validation schema
const pricingRuleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  type: z.enum(["season", "weekend", "holiday", "event", "demand"]),
  priority: z.number().min(0, "Priority must be 0 or greater").max(999, "Priority must be less than 1000"),
  stackMode: z.enum(["additive", "max", "override"]),
  adjustmentType: z.enum(["percent", "flat"]),
  adjustmentValue: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num !== 0;
  }, "Adjustment value is required and cannot be zero"),
  siteClassId: z.string().optional(),
  dowMask: z.array(z.number()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minRateCap: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Min rate cap must be a valid positive number"),
  maxRateCap: z.string().optional().refine((val) => {
    if (!val) return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, "Max rate cap must be a valid positive number"),
  active: z.boolean(),
}).refine((data) => {
  // Validate that end date is after start date
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"]
}).refine((data) => {
  // Validate that max rate cap is greater than min rate cap
  if (data.minRateCap && data.maxRateCap) {
    const min = parseFloat(data.minRateCap);
    const max = parseFloat(data.maxRateCap);
    return max >= min;
  }
  return true;
}, {
  message: "Max rate cap must be greater than or equal to min rate cap",
  path: ["maxRateCap"]
});

type FormData = z.infer<typeof pricingRuleSchema>;

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
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(pricingRuleSchema),
    defaultValues: defaultFormData,
    mode: "onChange", // Enable real-time validation
  });

  const formData = watch();

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
    reset(defaultFormData);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: PricingRuleV2) => {
    setEditingRule(rule);
    reset({
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
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    reset(defaultFormData);
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name.trim(),
      type: data.type,
      priority: data.priority,
      stackMode: data.stackMode,
      adjustmentType: data.adjustmentType,
      adjustmentValue: data.adjustmentType === "percent"
        ? parseFloat(data.adjustmentValue) / 100
        : parseFloat(data.adjustmentValue) * 100,
      siteClassId: data.siteClassId || null,
      dowMask: data.dowMask && data.dowMask.length > 0 ? data.dowMask : undefined,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      minRateCap: data.minRateCap ? parseFloat(data.minRateCap) * 100 : null,
      maxRateCap: data.maxRateCap ? parseFloat(data.maxRateCap) * 100 : null,
      active: data.active,
    };

    if (editingRule) {
      await updateMutation.mutateAsync({ id: editingRule.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this pricing rule?")) return;
    await deleteMutation.mutateAsync(id);
  };

  const toggleDow = (day: number) => {
    const current = formData.dowMask || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort();
    setValue("dowMask", updated, { shouldValidate: true });
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

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                label="Name *"
                placeholder="e.g., Summer Peak Season"
                error={errors.name?.message}
                showSuccess
                {...register("name")}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    {...register("type")}
                  >
                    {Object.entries(ruleTypeLabels).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FormField
                    label="Priority"
                    type="number"
                    min="0"
                    error={errors.priority?.message}
                    showSuccess
                    {...register("priority", { valueAsNumber: true })}
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
                  {...register("stackMode")}
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
                    {...register("adjustmentType")}
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat ($)</option>
                  </select>
                </div>
                <FormField
                  label={`Value ${formData.adjustmentType === "percent" ? "(%)" : "($)"}`}
                  type="number"
                  step={formData.adjustmentType === "percent" ? "1" : "0.01"}
                  placeholder={formData.adjustmentType === "percent" ? "e.g., 15" : "e.g., 10.00"}
                  error={errors.adjustmentValue?.message}
                  showSuccess
                  {...register("adjustmentValue")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Site Class</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  {...register("siteClassId")}
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
                          (formData.dowMask || []).includes(idx)
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
                  <FormField
                    label="Start Date"
                    type="date"
                    error={errors.startDate?.message}
                    showSuccess
                    {...register("startDate")}
                  />
                  <FormField
                    label="End Date"
                    type="date"
                    error={errors.endDate?.message}
                    showSuccess
                    {...register("endDate")}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Min Rate Cap ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 25.00"
                  error={errors.minRateCap?.message}
                  showSuccess
                  {...register("minRateCap")}
                />
                <FormField
                  label="Max Rate Cap ($)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g., 150.00"
                  error={errors.maxRateCap?.message}
                  showSuccess
                  {...register("maxRateCap")}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  className="rounded border-slate-300"
                  {...register("active")}
                />
                <label htmlFor="active" className="text-sm text-slate-700">Active</label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isValid || (!isDirty && !editingRule) || createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingRule
                    ? "Save Changes"
                    : "Create Rule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
