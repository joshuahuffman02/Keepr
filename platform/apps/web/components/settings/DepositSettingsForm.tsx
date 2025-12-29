"use client";

import { useMemo, useState } from "react";
import { apiClient } from "../../lib/api-client";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { DepositConfig, DepositRule, DepositTier, DepositSeason, computeDepositDue, parseDepositConfig } from "@campreserv/shared";

type PresetKey = "simple" | "standard" | "enterprise";

interface DepositSettingsFormProps {
  campgroundId: string;
  initialRule: string;
  initialPercentage: number | null;
  initialConfig?: DepositConfig | null;
}

const defaultRuleForPreset = (preset: PresetKey): DepositRule => {
  if (preset === "simple") return { type: "first_night" };
  if (preset === "enterprise") return { type: "percent_total", percent: 50, refundable: true, refundWindowHours: 48 };
  return { type: "percent_total", percent: 50 };
};

const deriveConfig = (
  initialRule: string,
  initialPercentage: number | null,
  initialConfig?: DepositConfig | null
): DepositConfig => {
  if (initialConfig) return { ...initialConfig, version: initialConfig.version ?? 1 };
  const normalized = (initialRule || "none").toLowerCase();
  if (normalized === "percentage") {
    return {
      version: 1,
      defaultRule: { type: "percent_total", percent: initialPercentage ?? 0 },
      lengthTiers: [],
      scopeRules: [],
      seasons: [],
      schedule: []
    };
  }
  if (normalized === "full") return { version: 1, defaultRule: { type: "full" } };
  if (normalized === "half" || normalized === "percentage_50")
    return { version: 1, defaultRule: { type: "percent_total", percent: 50 } };
  if (normalized === "first_night" || normalized === "first_night_fees")
    return { version: 1, defaultRule: { type: normalized as DepositRule["type"] } };
  return { version: 1, defaultRule: { type: "none" } };
};

const summarizeLegacy = (rule: DepositRule) => {
  if (rule.type === "percent_total") return { rule: "percentage" as const, percentage: rule.percent ?? 0 };
  if (rule.type === "full") return { rule: "full" as const, percentage: null };
  if (rule.type === "half") return { rule: "half" as const, percentage: null };
  if (rule.type === "first_night") return { rule: "first_night" as const, percentage: null };
  if (rule.type === "first_night_fees") return { rule: "first_night_fees" as const, percentage: null };
  return { rule: "none" as const, percentage: null };
};

const toUsd = (cents?: number) => (cents ?? 0) / 100;
const fromUsd = (usd: number) => Math.max(0, Math.round(usd * 100));

export function DepositSettingsForm({ campgroundId, initialRule, initialPercentage, initialConfig }: DepositSettingsFormProps) {
  const [preset, setPreset] = useState<PresetKey>("standard");
  const [config, setConfig] = useState<DepositConfig>(() =>
    deriveConfig(initialRule, initialPercentage, parseDepositConfig(initialConfig))
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const previewAmount = useMemo(() => {
    return computeDepositDue({
      total: 200,
      nights: 2,
      depositRule: initialRule,
      depositPercentage: initialPercentage,
      depositConfig: config
    });
  }, [config, initialPercentage, initialRule]);

  const updateDefaultRule = (partial: Partial<DepositRule>) => {
    setConfig((prev) => ({ ...prev, defaultRule: { ...prev.defaultRule, ...partial } }));
  };

  const updateTier = (idx: number, partial: Partial<DepositTier>) => {
    setConfig((prev) => {
      const next = [...(prev.lengthTiers || [])];
      next[idx] = { ...next[idx], ...partial };
      return { ...prev, lengthTiers: next };
    });
  };

  const updateSeason = (idx: number, partial: Partial<DepositSeason>) => {
    setConfig((prev) => {
      const next = [...(prev.seasons || [])];
      next[idx] = { ...next[idx], ...partial };
      return { ...prev, seasons: next };
    });
  };

  const updateScope = (idx: number, partial: any) => {
    setConfig((prev) => {
      const next = [...(prev.scopeRules || [])];
      next[idx] = { ...next[idx], ...partial };
      return { ...prev, scopeRules: next };
    });
  };

  const updateSchedule = (idx: number, partial: any) => {
    setConfig((prev) => {
      const next = [...(prev.schedule || [])];
      next[idx] = { ...next[idx], ...partial };
      return { ...prev, schedule: next };
    });
  };

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    setConfig((prev) => ({
      ...prev,
      defaultRule: defaultRuleForPreset(key),
      lengthTiers: key === "enterprise" ? [{ minNights: 7, rule: { type: "percent_total", percent: 25 } }] : [],
      scopeRules: key === "enterprise" ? [{ label: "OTA", channels: ["ota"], rule: { type: "percent_total", percent: 50 } }] : [],
      seasons: key === "enterprise" ? [{ label: "Peak", startMonthDay: "06-01", endMonthDay: "08-31", rule: { type: "percent_total", percent: 75 } }] : [],
      schedule:
        key === "enterprise"
          ? [
            { dueAt: "booking", amountType: "percent", value: 30 },
            { dueAt: "before_arrival", daysBeforeArrival: 7, amountType: "percent", value: 70 }
          ]
          : []
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const { rule, percentage } = summarizeLegacy(config.defaultRule);
      await apiClient.updateCampgroundDeposit(campgroundId, rule as any, percentage, config);
      setMessage({ type: "success", text: "Deposit settings saved" });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Failed to save settings" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <Label>Presets</Label>
        <div className="flex gap-2">
          {(["simple", "standard", "enterprise"] as PresetKey[]).map((key) => (
            <Button
              key={key}
              type="button"
              variant={preset === key ? "default" : "outline"}
              onClick={() => applyPreset(key)}
            >
              {key === "simple" && "Simple (First night)"}
              {key === "standard" && "Standard (50%)"}
              {key === "enterprise" && "Enterprise (tiers + schedule)"}
            </Button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Start from a preset, then adjust.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="baseRule">Base rule</Label>
          <select
            id="baseRule"
            value={config.defaultRule.type}
            onChange={(e) => updateDefaultRule({ type: e.target.value as DepositRule["type"] })}
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="none">No deposit</option>
            <option value="first_night">First night</option>
            <option value="first_night_fees">First night + fees</option>
            <option value="percent_total">% of total</option>
            <option value="fixed_amount">Fixed amount</option>
            <option value="half">Half (50%)</option>
            <option value="full">Full (100%)</option>
          </select>
          {config.defaultRule.type === "percent_total" && (
            <div className="space-y-1">
              <Label htmlFor="basePct">Percent</Label>
              <Input
                id="basePct"
                type="number"
                min={0}
                max={100}
                value={config.defaultRule.percent ?? 0}
                onChange={(e) => updateDefaultRule({ percent: Number(e.target.value) })}
              />
            </div>
          )}
          {config.defaultRule.type === "fixed_amount" && (
            <div className="space-y-1">
              <Label htmlFor="baseFixed">Fixed amount (USD)</Label>
              <Input
                id="baseFixed"
                type="number"
                min={0}
                value={toUsd(config.defaultRule.fixedCents)}
                onChange={(e) => updateDefaultRule({ fixedCents: fromUsd(Number(e.target.value || 0)) })}
              />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Refundability</Label>
          <div className="flex items-center gap-3">
            <input
              id="refundable"
              type="checkbox"
              checked={config.defaultRule.refundable ?? false}
              onChange={(e) => updateDefaultRule({ refundable: e.target.checked })}
            />
            <label htmlFor="refundable" className="text-sm text-slate-700">
              Allow refunds within a window
            </label>
          </div>
          {config.defaultRule.refundable && (
            <div className="space-y-1">
              <Label htmlFor="refundWindow">Refund window (hours before arrival)</Label>
              <Input
                id="refundWindow"
                type="number"
                min={0}
                value={config.defaultRule.refundWindowHours ?? 0}
                onChange={(e) => updateDefaultRule({ refundWindowHours: Number(e.target.value) })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-slate-200 p-4 bg-slate-50">
        <div className="text-sm text-slate-700">
          Preview: With a $200, 2-night stay, deposit due now would be <span className="font-semibold">${previewAmount.toFixed(2)}</span>.
        </div>
      </div>

      <div className="space-y-2">
        <Button type="button" variant="ghost" onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? "Hide advanced overrides" : "Show advanced overrides"}
        </Button>
        {showAdvanced && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Length of stay tiers</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      lengthTiers: [...(prev.lengthTiers || []), { minNights: 5, rule: { type: "percent_total", percent: 25 } }]
                    }))
                  }
                >
                  Add tier
                </Button>
              </div>
              {(config.lengthTiers || []).length === 0 && <p className="text-xs text-slate-500">No tiers yet.</p>}
              {(config.lengthTiers || []).map((tier, idx) => (
                <div key={idx} className="grid md:grid-cols-4 gap-2 items-end">
                  <div>
                    <Label>Min nights</Label>
                    <Input
                      type="number"
                      min={1}
                      value={tier.minNights ?? ""}
                      onChange={(e) => updateTier(idx, { minNights: Number(e.target.value) || undefined })}
                    />
                  </div>
                  <div>
                    <Label>Max nights</Label>
                    <Input
                      type="number"
                      min={1}
                      value={tier.maxNights ?? ""}
                      onChange={(e) => updateTier(idx, { maxNights: Number(e.target.value) || undefined })}
                    />
                  </div>
                  <div>
                    <Label>Rule</Label>
                    <select
                      value={tier.rule.type}
                      onChange={(e) => updateTier(idx, { rule: { ...tier.rule, type: e.target.value as DepositRule["type"] } })}
                      className="w-full h-10 rounded-md border border-slate-200 px-2 text-sm"
                    >
                      <option value="first_night">First night</option>
                      <option value="percent_total">% of total</option>
                      <option value="fixed_amount">Fixed</option>
                      <option value="half">Half</option>
                      <option value="full">Full</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {tier.rule.type === "percent_total" && (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={tier.rule.percent ?? 0}
                        onChange={(e) => updateTier(idx, { rule: { ...tier.rule, percent: Number(e.target.value) } })}
                      />
                    )}
                    {tier.rule.type === "fixed_amount" && (
                      <Input
                        type="number"
                        min={0}
                        value={toUsd(tier.rule.fixedCents)}
                        onChange={(e) => updateTier(idx, { rule: { ...tier.rule, fixedCents: fromUsd(Number(e.target.value || 0)) } })}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          lengthTiers: (prev.lengthTiers || []).filter((_, i) => i !== idx)
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Season / holiday overrides</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      seasons: [...(prev.seasons || []), { label: "Peak", startMonthDay: "06-01", endMonthDay: "08-31", rule: { type: "percent_total", percent: 75 } }]
                    }))
                  }
                >
                  Add season
                </Button>
              </div>
              {(config.seasons || []).length === 0 && <p className="text-xs text-slate-500">No seasonal overrides.</p>}
              {(config.seasons || []).map((season, idx) => (
                <div key={idx} className="grid md:grid-cols-4 gap-2 items-end">
                  <Input
                    placeholder="Label"
                    value={season.label || ""}
                    onChange={(e) => updateSeason(idx, { label: e.target.value })}
                  />
                  <Input
                    placeholder="Start (MM-DD)"
                    value={season.startMonthDay}
                    onChange={(e) => updateSeason(idx, { startMonthDay: e.target.value })}
                  />
                  <Input
                    placeholder="End (MM-DD)"
                    value={season.endMonthDay}
                    onChange={(e) => updateSeason(idx, { endMonthDay: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <select
                      value={season.rule.type}
                      onChange={(e) => updateSeason(idx, { rule: { ...season.rule, type: e.target.value as DepositRule["type"] } })}
                      className="w-full h-10 rounded-md border border-slate-200 px-2 text-sm"
                    >
                      <option value="percent_total">% of total</option>
                      <option value="first_night">First night</option>
                      <option value="fixed_amount">Fixed</option>
                      <option value="half">Half</option>
                      <option value="full">Full</option>
                    </select>
                    {season.rule.type === "percent_total" && (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={season.rule.percent ?? 0}
                        onChange={(e) => updateSeason(idx, { rule: { ...season.rule, percent: Number(e.target.value) } })}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          seasons: (prev.seasons || []).filter((_, i) => i !== idx)
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Channel / rate plan / site type overrides</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      scopeRules: [...(prev.scopeRules || []), { label: "New override", channels: [], ratePlanIds: [], discountCodes: [], rule: { type: "percent_total", percent: 50 } }]
                    }))
                  }
                >
                  Add override
                </Button>
              </div>
              {(config.scopeRules || []).length === 0 && <p className="text-xs text-slate-500">No overrides.</p>}
              {(config.scopeRules || []).map((scope, idx) => (
                <div key={idx} className="space-y-2 border border-slate-200 rounded-md p-3">
                  <Input
                    placeholder="Label (e.g., OTA, Corporate)"
                    value={scope.label || ""}
                    onChange={(e) => updateScope(idx, { label: e.target.value })}
                  />
                  <div className="grid md:grid-cols-2 gap-2">
                    <Input
                      placeholder="Channels (comma separated, e.g., direct, ota, pos)"
                      value={(scope.channels || []).join(", ")}
                      onChange={(e) => updateScope(idx, { channels: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
                    />
                    <Input
                      placeholder="Rate plans (IDs, comma separated)"
                      value={(scope.ratePlanIds || []).join(", ")}
                      onChange={(e) => updateScope(idx, { ratePlanIds: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
                    />
                    <Input
                      placeholder="Discount codes (comma separated)"
                      value={(scope.discountCodes || []).join(", ")}
                      onChange={(e) => updateScope(idx, { discountCodes: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
                    />
                    <Input
                      placeholder="Site type IDs (comma separated)"
                      value={(scope.siteTypeIds || []).join(", ")}
                      onChange={(e) => updateScope(idx, { siteTypeIds: e.target.value.split(",").map((c) => c.trim()).filter(Boolean) })}
                    />
                  </div>
                  <div className="grid md:grid-cols-3 gap-2 items-end">
                    <select
                      value={scope.rule.type}
                      onChange={(e) => updateScope(idx, { rule: { ...scope.rule, type: e.target.value as DepositRule["type"] } })}
                      className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                    >
                      <option value="percent_total">% of total</option>
                      <option value="first_night">First night</option>
                      <option value="fixed_amount">Fixed</option>
                      <option value="half">Half</option>
                      <option value="full">Full</option>
                    </select>
                    {scope.rule.type === "percent_total" && (
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={scope.rule.percent ?? 0}
                        onChange={(e) => updateScope(idx, { rule: { ...scope.rule, percent: Number(e.target.value) } })}
                      />
                    )}
                    {scope.rule.type === "fixed_amount" && (
                      <Input
                        type="number"
                        min={0}
                        value={toUsd(scope.rule.fixedCents)}
                        onChange={(e) => updateScope(idx, { rule: { ...scope.rule, fixedCents: fromUsd(Number(e.target.value || 0)) } })}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          scopeRules: (prev.scopeRules || []).filter((_, i) => i !== idx)
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Payment schedule</h4>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      schedule: [...(prev.schedule || []), { dueAt: "before_arrival", daysBeforeArrival: 7, amountType: "percent", value: 50 }]
                    }))
                  }
                >
                  Add installment
                </Button>
              </div>
              {(config.schedule || []).length === 0 && (
                <p className="text-xs text-slate-500">Optional: split deposits over time.</p>
              )}
              {(config.schedule || []).map((entry, idx) => (
                <div key={idx} className="grid md:grid-cols-4 gap-2 items-end">
                  <select
                    value={entry.dueAt}
                    onChange={(e) => updateSchedule(idx, { dueAt: e.target.value })}
                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                  >
                    <option value="booking">At booking</option>
                    <option value="before_arrival">Before arrival</option>
                  </select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Days before arrival"
                    value={entry.daysBeforeArrival ?? ""}
                    onChange={(e) => updateSchedule(idx, { daysBeforeArrival: Number(e.target.value) || undefined })}
                    disabled={entry.dueAt === "booking"}
                  />
                  <select
                    value={entry.amountType}
                    onChange={(e) => updateSchedule(idx, { amountType: e.target.value })}
                    className="h-10 rounded-md border border-slate-200 px-2 text-sm"
                  >
                    <option value="percent">% of total</option>
                    <option value="fixed_cents">Fixed</option>
                    <option value="remaining">Remaining balance</option>
                  </select>
                  <div className="flex gap-2">
                    {entry.amountType !== "remaining" && (
                      <Input
                        type="number"
                        min={0}
                        value={entry.value ?? 0}
                        onChange={(e) => updateSchedule(idx, { value: Number(e.target.value) })}
                      />
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          schedule: (prev.schedule || []).filter((_, i) => i !== idx)
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                rows={2}
                value={config.notes || ""}
                onChange={(e) => setConfig((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Internal notes for staff"
              />
            </div>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={isSaving}>
        {isSaving ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
