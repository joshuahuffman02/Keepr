"use client";

import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import { FormField } from "../../../../components/ui/form-field";
import { Label } from "../../../../components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../../../components/ui/select";
import { apiClient } from "../../../../lib/api-client";
import { Plus, Pencil, Trash2, Calendar, TrendingUp, Sun, Gift, BarChart3 } from "lucide-react";
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
import { HelpTooltip, HelpTooltipContent, HelpTooltipSection, HelpTooltipList } from "../../../../components/help/HelpTooltip";
import { PageOnboardingHint } from "../../../../components/help/OnboardingHint";

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

// Form data type
type FormData = {
  name: string;
  type: "season" | "weekend" | "holiday" | "event" | "demand";
  priority: number;
  stackMode: "additive" | "max" | "override";
  adjustmentType: "percent" | "flat";
  adjustmentValue: string;
  siteClassId?: string;
  dowMask?: number[];
  startDate?: string;
  endDate?: string;
  minRateCap?: string;
  maxRateCap?: string;
  active: boolean;
};

// Custom validation function
function validateFormData(data: FormData): { field: string; message: string } | null {
  // Validate name
  if (!data.name || !data.name.trim()) {
    return { field: "name", message: "Name is required" };
  }
  if (data.name.length > 100) {
    return { field: "name", message: "Name must be less than 100 characters" };
  }

  // Validate priority
  if (data.priority < 0 || data.priority > 999) {
    return { field: "priority", message: "Priority must be between 0 and 999" };
  }

  // Validate adjustment value is not zero
  const adjustmentNum = parseFloat(data.adjustmentValue);
  if (!data.adjustmentValue || isNaN(adjustmentNum) || adjustmentNum === 0) {
    return { field: "adjustmentValue", message: "Adjustment value is required and cannot be zero" };
  }

  // Validate min rate cap is a valid number
  if (data.minRateCap) {
    const min = parseFloat(data.minRateCap);
    if (isNaN(min) || min < 0) {
      return { field: "minRateCap", message: "Min rate cap must be a valid positive number" };
    }
  }

  // Validate max rate cap is a valid number
  if (data.maxRateCap) {
    const max = parseFloat(data.maxRateCap);
    if (isNaN(max) || max < 0) {
      return { field: "maxRateCap", message: "Max rate cap must be a valid positive number" };
    }
  }

  // Validate end date is after start date
  if (data.startDate && data.endDate) {
    if (new Date(data.endDate) < new Date(data.startDate)) {
      return { field: "endDate", message: "End date must be after start date" };
    }
  }

  // Validate max rate cap >= min rate cap
  if (data.minRateCap && data.maxRateCap) {
    const min = parseFloat(data.minRateCap);
    const max = parseFloat(data.maxRateCap);
    if (max < min) {
      return { field: "maxRateCap", message: "Max rate cap must be greater than or equal to min rate cap" };
    }
  }

  return null;
}

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
const EMPTY_SELECT_VALUE = "__empty";

export default function PricingRulesV2Page() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleV2 | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
    setValue,
    control,
  } = useForm<FormData>({
    defaultValues: defaultFormData,
    mode: "onChange",
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
      apiClient.updatePricingRuleV2(id, data, campgroundId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules-v2", campgroundId] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePricingRuleV2(id, campgroundId!),
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
    // Run custom cross-field validation
    const validationError = validateFormData(data);
    if (validationError) {
      alert(validationError.message);
      return;
    }

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

  const confirmDeleteRule = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteMutation.mutateAsync(deleteConfirmId);
    } finally {
      setDeleteConfirmId(null);
    }
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
      <div className="text-center py-12 text-muted-foreground">
        Please select a campground first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dynamic Pricing Rules</h1>
            <p className="text-muted-foreground">
              Configure advanced pricing adjustments for seasons, weekends, holidays, events, and demand.
            </p>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>

        <PageOnboardingHint
          id="pricing-rules-intro"
          title="Dynamic Pricing Made Easy"
          content={
            <div>
              <p className="mb-2">
                Use pricing rules to automatically adjust rates based on demand, seasons, and special events.
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Rules run in priority order (lower numbers first)</li>
                <li>Choose how rules stack: add together, use highest, or override</li>
                <li>Set minimum and maximum rate caps to prevent extreme prices</li>
                <li>Enable/disable rules without deleting them</li>
              </ul>
            </div>
          }
        />

        {rulesQuery.isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : rulesQuery.data?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No pricing rules yet</h3>
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
                  className={`border rounded-lg p-4 ${rule.active ? "bg-card" : "bg-muted opacity-60"}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${rule.active ? "bg-status-success/15 text-status-success" : "bg-muted text-muted-foreground"}`}>
                        <TypeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">{rule.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            Priority {rule.priority}
                          </span>
                          {!rule.active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{formatAdjustment(rule)}</span>
                          {" • "}
                          {ruleTypeLabels[rule.type]?.label}
                          {" • "}
                          {stackModeLabels[rule.stackMode]}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
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
                        onClick={() => setDeleteConfirmId(rule.id)}
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
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">
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
                  <Label className="block text-sm font-medium text-foreground mb-1">Type</Label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ruleTypeLabels).map(([key, val]) => (
                            <SelectItem key={key} value={key}>
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-foreground">Priority</label>
                    <HelpTooltip
                      title="Priority Order"
                      content={
                        <HelpTooltipContent>
                          <HelpTooltipSection>
                            Rules are evaluated in priority order, with lower numbers running first.
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Example">
                            A rule with priority 1 runs before priority 10. If both apply to the same date, the stacking mode determines the final price.
                          </HelpTooltipSection>
                          <HelpTooltipSection title="Tip">
                            Use priorities like 10, 20, 30 to leave room for future rules.
                          </HelpTooltipSection>
                        </HelpTooltipContent>
                      }
                      side="top"
                      maxWidth={320}
                    />
                  </div>
                  <FormField
                    type="number"
                    min="0"
                    error={errors.priority?.message}
                    showSuccess
                    {...register("priority", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="block text-sm font-medium text-foreground">Stacking Mode</label>
                  <HelpTooltip
                    title="How Rules Combine"
                    content={
                      <HelpTooltipContent>
                        <HelpTooltipSection>
                          When multiple rules apply to the same date, the stacking mode controls how they combine:
                        </HelpTooltipSection>
                        <HelpTooltipSection title="Additive">
                          Add this adjustment to the base rate plus any other additive rules. Great for combining seasonal and weekend pricing.
                        </HelpTooltipSection>
                        <HelpTooltipSection title="Max">
                          Use the highest adjustment among all rules. Prevents over-discounting or over-pricing.
                        </HelpTooltipSection>
                        <HelpTooltipSection title="Override">
                          Ignore all other rules and use only this adjustment. Perfect for special events with fixed pricing.
                        </HelpTooltipSection>
                      </HelpTooltipContent>
                    }
                    side="right"
                    maxWidth={360}
                  />
                </div>
                <Controller
                  name="stackMode"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(stackModeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium text-foreground mb-1">Adjustment Type</Label>
                  <Controller
                    name="adjustmentType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percentage (%)</SelectItem>
                          <SelectItem value="flat">Flat ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
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
                <Label className="block text-sm font-medium text-foreground mb-1">Site Class</Label>
                <Controller
                  name="siteClassId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || EMPTY_SELECT_VALUE}
                      onValueChange={(value) => field.onChange(value === EMPTY_SELECT_VALUE ? "" : value)}
                    >
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>All Site Classes</SelectItem>
                        {siteClassesQuery.data?.map((sc: SiteClass) => (
                          <SelectItem key={sc.id} value={sc.id}>
                            {sc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {formData.type === "weekend" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Days of Week</label>
                  <div className="flex gap-2">
                    {daysOfWeek.map((day, idx) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDow(idx)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          (formData.dowMask || []).includes(idx)
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground hover:bg-muted"
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
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-foreground">Min Rate Cap ($)</label>
                    <HelpTooltip
                      title="Minimum Rate"
                      content={
                        <div className="space-y-2">
                          <p>Set a floor price to prevent rates from going too low, even with discounts.</p>
                          <p className="text-xs text-muted-foreground">Example: If your base rate is $50 and you have a -30% discount, a $40 minimum cap ensures the price never goes below $40.</p>
                        </div>
                      }
                      side="top"
                      maxWidth={300}
                    />
                  </div>
                  <FormField
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 25.00"
                    error={errors.minRateCap?.message}
                    showSuccess
                    {...register("minRateCap")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-foreground">Max Rate Cap ($)</label>
                    <HelpTooltip
                      title="Maximum Rate"
                      content={
                        <div className="space-y-2">
                          <p>Set a ceiling price to prevent rates from going too high, even with markups.</p>
                          <p className="text-xs text-muted-foreground">Example: If your base rate is $50 and you have a +50% markup, a $70 maximum cap ensures the price never exceeds $70.</p>
                        </div>
                      }
                      side="top"
                      maxWidth={300}
                    />
                  </div>
                  <FormField
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 150.00"
                    error={errors.maxRateCap?.message}
                    showSuccess
                    {...register("maxRateCap")}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="active"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                    />
                  )}
                />
                <Label htmlFor="active" className="text-sm text-foreground">Active</Label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={(!isDirty && !editingRule) || createMutation.isPending || updateMutation.isPending}
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

      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pricing Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pricing rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRule}
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
