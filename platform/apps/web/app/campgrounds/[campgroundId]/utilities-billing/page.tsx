"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";

type MeterConfig = {
  billingMode?: string;
  billTo?: string;
  multiplier?: number;
  autoEmail?: boolean;
  ratePlanId?: string | null;
  active?: boolean;
  serialNumber?: string | null;
};

type ReadDraft = { readingValue: string; readAt: string; note?: string; billNow?: boolean };

type SiteClassDraft = {
  meteredEnabled?: boolean;
  meteredType?: string;
  meteredBillingMode?: string;
  meteredBillTo?: string;
  meteredMultiplier?: number;
  meteredRatePlanId?: string;
  meteredAutoEmail?: boolean;
};

type RatePlan = {
  id: string;
  campgroundId: string;
  type: string;
  pricingMode: string;
  baseRateCents: number;
  tiers?: any;
  demandFeeCents?: number | null;
  minimumCents?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

const BILLING_MODES = [
  { value: "cycle", label: "Billing cycles" },
  { value: "per_reading", label: "Bill on each reading" },
  { value: "annual", label: "Annual true-up" },
  { value: "manual", label: "Manual" }
];

export default function UtilitiesBillingPage() {
  const params = useParams();
  const campgroundId = params?.campgroundId as string;
  const qc = useQueryClient();
  const [configDrafts, setConfigDrafts] = useState<Record<string, MeterConfig>>({});
  const [readDrafts, setReadDrafts] = useState<Record<string, ReadDraft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [classDraft, setClassDraft] = useState<SiteClassDraft>({});

  const metersQuery = useQuery({
    queryKey: ["utility-meters", campgroundId],
    queryFn: () => apiClient.listUtilityMeters(campgroundId),
    enabled: !!campgroundId
  });

  const siteClassesQuery = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
    enabled: !!campgroundId
  });

  const ratePlansQuery = useQuery({
    queryKey: ["utility-rate-plans", campgroundId],
    queryFn: () => apiClient.listUtilityRatePlans(campgroundId),
    enabled: !!campgroundId
  });

  const lastReadsQuery = useQuery({
    queryKey: ["utility-meter-reads-latest", campgroundId, metersQuery.data?.map((m) => m.id).join(",")],
    queryFn: async () => {
      const meters = metersQuery.data ?? [];
      const pairs = await Promise.all(
        meters.map(async (m) => {
          const reads = await apiClient.listUtilityMeterReads(m.id);
          const last = reads[reads.length - 1];
          return { meterId: m.id, last };
        })
      );
      const map = new Map<string, any>();
      pairs.forEach((p) => map.set(p.meterId, p.last));
      return map;
    },
    enabled: !!campgroundId && (metersQuery.data?.length ?? 0) > 0
  });

  const updateMeterMutation = useMutation({
    mutationFn: ({ meterId, config }: { meterId: string; config: MeterConfig }) => apiClient.updateUtilityMeter(meterId, config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters", campgroundId] });
      setMessage("Meter updated.");
    },
    onError: (err: any) => setMessage(err?.message || "Failed to update meter")
  });

  const billMeterMutation = useMutation({
    mutationFn: (meterId: string) => apiClient.billUtilityMeter(meterId),
    onSuccess: () => setMessage("Invoice created from latest reading."),
    onError: (err: any) => setMessage(err?.message || "Failed to bill meter")
  });

  const addReadMutation = useMutation({
    mutationFn: ({ meterId, draft }: { meterId: string; draft: ReadDraft }) =>
      apiClient.addUtilityMeterRead(meterId, {
        readingValue: Number(draft.readingValue),
        readAt: draft.readAt || new Date().toISOString(),
        note: draft.note || undefined
      }),
    onSuccess: () => {
      setMessage("Reading saved.");
      qc.invalidateQueries({ queryKey: ["utility-meter-reads-latest", campgroundId] });
    },
    onError: (err: any) => setMessage(err?.message || "Failed to save reading")
  });

  const saveSiteClassMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: SiteClassDraft }) => apiClient.updateSiteClass(id, draft),
    onSuccess: () => setMessage("Site class metering defaults saved."),
    onError: (err: any) => setMessage(err?.message || "Failed to save site class")
  });

  const seedMetersMutation = useMutation({
    mutationFn: (siteClassId: string) => apiClient.seedMetersForSiteClass(siteClassId),
    onSuccess: (res) => {
      setMessage(`Created ${res.created} meters (of ${res.totalSites} sites).`);
      qc.invalidateQueries({ queryKey: ["utility-meters", campgroundId] });
    },
    onError: (err: any) => setMessage(err?.message || "Failed to seed meters")
  });

  const meters = metersQuery.data ?? [];
  const siteClasses = siteClassesQuery.data ?? [];
  const ratePlans = (ratePlansQuery.data as RatePlan[] | undefined) ?? [];

  const ratePlansByType = useMemo(() => {
    const map = new Map<string, RatePlan[]>();
    ratePlans.forEach((p) => {
      const arr = map.get(p.type) || [];
      arr.push(p);
      map.set(p.type, arr);
    });
    return map;
  }, [ratePlans]);

  const filteredMeters = useMemo(() => {
    return meters.filter((m) => {
      const typeOk = filterType === "all" || m.type === filterType;
      const searchOk =
        !search ||
        m.siteId.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase());
      return typeOk && searchOk;
    });
  }, [meters, filterType, search]);

  const applyDraft = (meterId: string, draft: MeterConfig) => {
    setConfigDrafts((prev) => ({ ...prev, [meterId]: { ...(prev[meterId] || {}), ...draft } }));
  };

  const applyReadDraft = (meterId: string, draft: Partial<ReadDraft>) => {
    setReadDrafts((prev) => ({
      ...prev,
      [meterId]: {
        ...(prev[meterId] || {
          readingValue: "",
          readAt: new Date().toISOString().slice(0, 16),
          billNow: undefined
        }),
        ...draft
      }
    }));
  };

  const handleUpdate = (meterId: string) => {
    const draft = configDrafts[meterId] || {};
    updateMeterMutation.mutate({ meterId, config: draft });
  };

  const handleAddRead = async (meterId: string) => {
    const draft = readDrafts[meterId];
    if (!draft?.readingValue) {
      setMessage("Enter a reading value first.");
      return;
    }
    try {
      await addReadMutation.mutateAsync({ meterId, draft });
      const meter = meters.find((m) => m.id === meterId);
      const billingMode = draft.billNow !== undefined ? (draft.billNow ? "per_reading" : meter?.billingMode) : meter?.billingMode;
      if (billingMode === "per_reading" || draft.billNow) {
        billMeterMutation.mutate(meterId);
      }
    } catch {
      // message set in mutation
    }
  };

  const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString() : "—");

  const computePreview = (opts: {
    meterType: string;
    planId?: string | null;
    lastValue?: number;
    newValue?: number;
    multiplier?: number;
  }) => {
    const plan = ratePlans.find((p) => p.id === opts.planId) || ratePlans.find((p) => p.type === opts.meterType);
    if (!plan || opts.lastValue === undefined || opts.newValue === undefined || isNaN(opts.newValue)) return null;
    const usage = Math.max(0, opts.newValue - opts.lastValue);
    const billedUsage = usage * (Number(opts.multiplier ?? 1) || 1);
    const amount = (billedUsage * plan.baseRateCents) / 100;
    return { usage, billedUsage, amount, rate: plan.baseRateCents / 100 };
  };

  const totalByType = useMemo(() => {
    const map: Record<string, number> = {};
    meters.forEach((m) => {
      map[m.type] = (map[m.type] || 0) + 1;
    });
    return map;
  }, [meters]);

  const selectClass = (id: string) => {
    setSelectedClassId(id);
    const sc = siteClasses.find((s: any) => s.id === id);
    if (sc) {
      setClassDraft({
        meteredEnabled: sc.meteredEnabled ?? false,
        meteredType: sc.meteredType ?? (sc.hookupsPower ? "power" : sc.hookupsWater ? "water" : undefined),
        meteredBillingMode: sc.meteredBillingMode ?? "cycle",
        meteredBillTo: sc.meteredBillTo ?? "reservation",
        meteredMultiplier: sc.meteredMultiplier ?? 1,
        meteredRatePlanId: sc.meteredRatePlanId ?? undefined,
        meteredAutoEmail: sc.meteredAutoEmail ?? false
      });
    } else {
      setClassDraft({});
    }
  };

  const handleSaveClass = () => {
    if (!selectedClassId) return;
    saveSiteClassMutation.mutate({ id: selectedClassId, draft: classDraft });
  };

  const handleSeedMeters = () => {
    if (!selectedClassId) return;
    seedMetersMutation.mutate(selectedClassId);
  };

  return (
    <DashboardShell>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Utilities & Billing</h1>
            <p className="text-sm text-slate-600">
              Metered sites, billing cadence, and quick billing from the latest reads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded border border-slate-200 px-2 py-1 bg-white">
              Total meters: <strong>{meters.length}</strong>
            </span>
            <span className="rounded border border-slate-200 px-2 py-1 bg-white">
              With recent reads: <strong>{lastReadsQuery.data ? lastReadsQuery.data.size : 0}</strong>
            </span>
            <span className="rounded border border-slate-200 px-2 py-1 bg-white">
              Power: <strong>{totalByType.power ?? 0}</strong> · Water: <strong>{totalByType.water ?? 0}</strong> · Sewer:{" "}
              <strong>{totalByType.sewer ?? 0}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                metersQuery.refetch();
                lastReadsQuery.refetch();
              }}
              disabled={metersQuery.isFetching || lastReadsQuery.isFetching}
            >
              Reload list
            </Button>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Site class defaults & auto meters</h2>
              <p className="text-sm text-slate-600">
                Mark a site class as metered, set defaults, and auto-create meters for its sites.
              </p>
            </div>
            {siteClassesQuery.isFetching && <span className="text-xs text-slate-500">Refreshing…</span>}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Site class</Label>
              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={selectedClassId}
                onChange={(e) => selectClass(e.target.value)}
              >
                <option value="">Select a site class</option>
                {siteClasses.map((sc: any) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Meter type</Label>
              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={classDraft.meteredType ?? ""}
                onChange={(e) => setClassDraft((d) => ({ ...d, meteredType: e.target.value }))}
                disabled={!selectedClassId}
              >
                <option value="">Choose</option>
                <option value="power">Power</option>
                <option value="water">Water</option>
                <option value="sewer">Sewer</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={classDraft.meteredEnabled ?? false}
                onCheckedChange={(val) => setClassDraft((d) => ({ ...d, meteredEnabled: val }))}
                disabled={!selectedClassId}
              />
              <Label className="text-sm">Metered sites</Label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Billing mode</Label>
              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={classDraft.meteredBillingMode ?? "cycle"}
                onChange={(e) => setClassDraft((d) => ({ ...d, meteredBillingMode: e.target.value }))}
                disabled={!selectedClassId}
              >
                {BILLING_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Bill to</Label>
              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={classDraft.meteredBillTo ?? "reservation"}
                onChange={(e) => setClassDraft((d) => ({ ...d, meteredBillTo: e.target.value }))}
                disabled={!selectedClassId}
              >
                <option value="reservation">Reservation</option>
                <option value="guest">Guest</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Usage multiplier</Label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={classDraft.meteredMultiplier ?? 1}
                onChange={(e) => setClassDraft((d) => ({ ...d, meteredMultiplier: Number(e.target.value) }))}
                disabled={!selectedClassId}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Rate plan</Label>
              <select
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                value={classDraft.meteredRatePlanId ?? ""}
                onChange={(e) => setClassDraft((d) => ({ ...d, meteredRatePlanId: e.target.value || undefined }))}
                disabled={!selectedClassId}
              >
                <option value="">No plan</option>
                {(classDraft.meteredType ? ratePlansByType.get(classDraft.meteredType) : ratePlans).map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.type} @ {(rp.baseRateCents / 100).toFixed(2)} (from {new Date(rp.effectiveFrom).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={classDraft.meteredAutoEmail ?? false}
                onCheckedChange={(val) => setClassDraft((d) => ({ ...d, meteredAutoEmail: val }))}
                disabled={!selectedClassId}
              />
              <Label className="text-sm">Auto-email invoices</Label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveClass} disabled={!selectedClassId || saveSiteClassMutation.isPending}>
                {saveSiteClassMutation.isPending ? "Saving..." : "Save defaults"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSeedMeters}
                disabled={!selectedClassId || seedMetersMutation.isPending}
              >
                {seedMetersMutation.isPending ? "Seeding..." : "Create meters for this class"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col text-sm">
              <Label className="text-xs text-slate-600">Meter type</Label>
              <select
                className="rounded border border-slate-200 px-3 py-2 text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All</option>
                <option value="power">Power</option>
                <option value="water">Water</option>
                <option value="sewer">Sewer</option>
              </select>
            </div>
            <div className="flex flex-col text-sm">
              <Label className="text-xs text-slate-600">Search site or meter</Label>
              <input
                className="rounded border border-slate-200 px-3 py-2 text-sm"
                placeholder="e.g. SITE-12 or meter id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {metersQuery.isFetching && <span className="text-xs text-slate-500">Refreshing…</span>}
          </div>
        </Card>

        {message && <div className="rounded border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">{message}</div>}

        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-13 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-600">
            <div className="col-span-2">Site / Meter</div>
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Billing mode</div>
            <div className="col-span-1">Bill to</div>
            <div className="col-span-1 text-right">Multiplier</div>
            <div className="col-span-1">Rate plan</div>
            <div className="col-span-1">Last read</div>
            <div className="col-span-1">Preview</div>
            <div className="col-span-2">New read</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <div className="divide-y">
            {filteredMeters.map((m) => {
              const draft = configDrafts[m.id] || {};
              const readDraft =
                readDrafts[m.id] || {
                  readingValue: "",
                  readAt: new Date().toISOString().slice(0, 16),
                  billNow: m.billingMode === "per_reading"
                };
              const billingMode = draft.billingMode ?? m.billingMode ?? "cycle";
              const billTo = draft.billTo ?? m.billTo ?? "reservation";
              const multiplier = draft.multiplier ?? (m.multiplier as unknown as number) ?? 1;
              const autoEmail = draft.autoEmail ?? m.autoEmail ?? false;
              const active = draft.active ?? m.active ?? true;
              const last = lastReadsQuery.data?.get(m.id);
              const lastValue = last ? Number(last.readingValue).toFixed(2) : "—";
              const lastDate = last ? formatDate(last.readAt) : "—";

              return (
                <div key={m.id} className="grid grid-cols-13 px-4 py-3 text-sm items-center">
                  <div className="col-span-2">
                    <div className="font-semibold text-slate-900">{m.siteId}</div>
                    <div className="text-xs text-slate-500 truncate">{m.id}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Switch
                        checked={active}
                        onCheckedChange={(val) => applyDraft(m.id, { active: val })}
                        aria-label="Active meter"
                      />
                      <span>Active</span>
                    </div>
                  </div>

                  <div className="col-span-1 capitalize text-slate-700">{m.type}</div>

                  <div className="col-span-2">
                    <select
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      value={billingMode}
                      onChange={(e) => applyDraft(m.id, { billingMode: e.target.value })}
                    >
                      {BILLING_MODES.map((mode) => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <Switch
                        checked={autoEmail}
                        onCheckedChange={(val) => applyDraft(m.id, { autoEmail: val })}
                        aria-label="Auto email"
                      />
                      <span>Auto-email invoice</span>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <select
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      value={billTo}
                      onChange={(e) => applyDraft(m.id, { billTo: e.target.value })}
                    >
                      <option value="reservation">Reservation</option>
                      <option value="guest">Guest</option>
                    </select>
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded border border-slate-200 px-2 py-1 text-right text-sm"
                      value={multiplier}
                      onChange={(e) => applyDraft(m.id, { multiplier: Number(e.target.value) })}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">x usage</div>
                  </div>

                  <div className="col-span-1">
                    <select
                      className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                      value={draft.ratePlanId ?? m.ratePlanId ?? ""}
                      onChange={(e) => applyDraft(m.id, { ratePlanId: e.target.value || null })}
                    >
                      <option value="">No plan</option>
                      {(ratePlansByType.get(m.type) || ratePlans).map((rp) => (
                        <option key={rp.id} value={rp.id}>
                          {(rp.baseRateCents / 100).toFixed(2)} · {rp.type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-1 text-sm text-slate-700">
                    <div className="font-medium">{lastValue}</div>
                    <div className="text-xs text-slate-500">{lastDate}</div>
                  </div>

                  <div className="col-span-1 text-xs text-slate-600">
                    {(() => {
                      const lastVal = last ? Number(last.readingValue) : undefined;
                      const newVal = parseFloat(readDraft.readingValue || "NaN");
                      const preview = computePreview({
                        meterType: m.type,
                        planId: draft.ratePlanId ?? m.ratePlanId,
                        lastValue: lastVal,
                        newValue: newVal,
                        multiplier
                      });
                      if (!preview) return "Preview: —";
                      return (
                        <>
                          <div className="font-semibold text-slate-800">
                            Δ {preview.usage.toFixed(2)} → ${preview.amount.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {preview.billedUsage.toFixed(2)} units @ ${preview.rate.toFixed(2)}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="col-span-2">
                    <div className="flex flex-col gap-1">
                      <input
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Reading value"
                        value={readDraft.readingValue}
                        onChange={(e) => applyReadDraft(m.id, { readingValue: e.target.value })}
                      />
                      <input
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        type="datetime-local"
                        value={readDraft.readAt}
                        onChange={(e) => applyReadDraft(m.id, { readAt: e.target.value })}
                      />
                      <input
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                        placeholder="Note (optional)"
                        value={readDraft.note ?? ""}
                        onChange={(e) => applyReadDraft(m.id, { note: e.target.value })}
                      />
                      <div className="text-[11px] text-slate-500">
                        {(() => {
                          const lastVal = last ? Number(last.readingValue) : undefined;
                          const newVal = parseFloat(readDraft.readingValue || "NaN");
                          const planId = draft.ratePlanId ?? m.ratePlanId;
                          const plan = ratePlans.find((p) => p.id === planId);
                          if (!plan || !lastVal || isNaN(newVal)) return "Preview: —";
                          const usage = Math.max(0, newVal - lastVal);
                          const billedUsage = usage * (Number(multiplier) || 1);
                          const amount = (billedUsage * plan.baseRateCents) / 100;
                          return `Preview: ${billedUsage.toFixed(2)} units · $${amount.toFixed(2)}`;
                        })()}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Switch
                          checked={readDraft.billNow ?? m.billingMode === "per_reading"}
                          onCheckedChange={(val) => applyReadDraft(m.id, { billNow: val })}
                          aria-label="Bill immediately"
                        />
                        <span>Bill immediately after saving</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleAddRead(m.id)} disabled={addReadMutation.isPending}>
                          Save read
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            applyReadDraft(m.id, { readingValue: "", note: "" });
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-1 flex flex-col gap-2 items-end">
                    <Button size="sm" onClick={() => handleUpdate(m.id)} disabled={updateMeterMutation.isPending}>
                      Save config
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => billMeterMutation.mutate(m.id)}
                      disabled={billMeterMutation.isPending}
                    >
                      Bill latest
                    </Button>
                  </div>
                </div>
              );
            })}

            {filteredMeters.length === 0 && !metersQuery.isLoading && (
              <div className="px-4 py-6 text-sm text-slate-600">No meters match your filters.</div>
            )}
            {metersQuery.isLoading && <div className="px-4 py-6 text-sm text-slate-600">Loading meters...</div>}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
