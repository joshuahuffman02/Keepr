"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";

type UtilityMeter = Awaited<ReturnType<typeof apiClient.listUtilityMeters>>[number];
type UtilityMeterRead = Awaited<ReturnType<typeof apiClient.listUtilityMeterReads>>[number];
type UtilityRatePlan = Awaited<ReturnType<typeof apiClient.listUtilityRatePlans>>[number];
type SiteClass = Awaited<ReturnType<typeof apiClient.getSiteClasses>>[number];

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

const BILLING_MODES = [
  { value: "cycle", label: "Billing cycles" },
  { value: "per_reading", label: "Bill on each reading" },
  { value: "annual", label: "Annual true-up" },
  { value: "manual", label: "Manual" },
];
const EMPTY_SELECT_VALUE = "__empty";

const getErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : "Unknown error";

export default function UtilitiesBillingPage() {
  const params = useParams<{ campgroundId?: string }>();
  const campgroundId = params?.campgroundId;
  const requireCampgroundId = () => {
    if (!campgroundId) {
      throw new Error("Campground is required");
    }
    return campgroundId;
  };
  const qc = useQueryClient();
  const [configDrafts, setConfigDrafts] = useState<Record<string, MeterConfig>>({});
  const [readDrafts, setReadDrafts] = useState<Record<string, ReadDraft>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [classDraft, setClassDraft] = useState<SiteClassDraft>({});

  const metersQuery = useQuery<UtilityMeter[]>({
    queryKey: ["utility-meters", campgroundId],
    queryFn: () => apiClient.listUtilityMeters(requireCampgroundId()),
    enabled: !!campgroundId,
  });

  const siteClassesQuery = useQuery<SiteClass[]>({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(requireCampgroundId()),
    enabled: !!campgroundId,
  });

  const ratePlansQuery = useQuery<UtilityRatePlan[]>({
    queryKey: ["utility-rate-plans", campgroundId],
    queryFn: () => apiClient.listUtilityRatePlans(requireCampgroundId()),
    enabled: !!campgroundId,
  });

  const lastReadsQuery = useQuery<Map<string, UtilityMeterRead | undefined>>({
    queryKey: [
      "utility-meter-reads-latest",
      campgroundId,
      metersQuery.data?.map((m) => m.id).join(","),
    ],
    queryFn: async () => {
      const meters = metersQuery.data ?? [];
      const pairs = await Promise.all(
        meters.map(async (m) => {
          const reads = await apiClient.listUtilityMeterReads(m.id, undefined, campgroundId);
          const last = reads[reads.length - 1];
          return { meterId: m.id, last };
        }),
      );
      const map = new Map<string, UtilityMeterRead | undefined>();
      pairs.forEach((p) => map.set(p.meterId, p.last));
      return map;
    },
    enabled: !!campgroundId && (metersQuery.data?.length ?? 0) > 0,
  });

  const updateMeterMutation = useMutation({
    mutationFn: ({ meterId, config }: { meterId: string; config: MeterConfig }) =>
      apiClient.updateUtilityMeter(meterId, config, requireCampgroundId()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-meters", campgroundId] });
      setMessage("Meter updated.");
    },
    onError: (error) => setMessage(getErrorMessage(error) || "Failed to update meter"),
  });

  const billMeterMutation = useMutation({
    mutationFn: (meterId: string) => apiClient.billUtilityMeter(meterId, requireCampgroundId()),
    onSuccess: () => setMessage("Invoice created from latest reading."),
    onError: (error) => setMessage(getErrorMessage(error) || "Failed to bill meter"),
  });

  const addReadMutation = useMutation({
    mutationFn: ({ meterId, draft }: { meterId: string; draft: ReadDraft }) =>
      apiClient.addUtilityMeterRead(
        meterId,
        {
          readingValue: Number(draft.readingValue),
          readAt: draft.readAt || new Date().toISOString(),
          note: draft.note || undefined,
        },
        requireCampgroundId(),
      ),
    onSuccess: () => {
      setMessage("Reading saved.");
      qc.invalidateQueries({ queryKey: ["utility-meter-reads-latest", campgroundId] });
    },
    onError: (error) => setMessage(getErrorMessage(error) || "Failed to save reading"),
  });

  const saveSiteClassMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: SiteClassDraft }) =>
      apiClient.updateSiteClass(id, draft, requireCampgroundId()),
    onSuccess: () => setMessage("Site class metering defaults saved."),
    onError: (error) => setMessage(getErrorMessage(error) || "Failed to save site class"),
  });

  const seedMetersMutation = useMutation({
    mutationFn: (siteClassId: string) =>
      apiClient.seedMetersForSiteClass(siteClassId, requireCampgroundId()),
    onSuccess: (res) => {
      setMessage(`Created ${res.created} meters (of ${res.totalSites} sites).`);
      qc.invalidateQueries({ queryKey: ["utility-meters", campgroundId] });
    },
    onError: (error) => setMessage(getErrorMessage(error) || "Failed to seed meters"),
  });

  const meters = metersQuery.data ?? [];
  const siteClasses = siteClassesQuery.data ?? [];
  const ratePlans = ratePlansQuery.data ?? [];

  const ratePlansByType = useMemo(() => {
    const map = new Map<string, UtilityRatePlan[]>();
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
          billNow: undefined,
        }),
        ...draft,
      },
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
      const billingMode =
        draft.billNow !== undefined
          ? draft.billNow
            ? "per_reading"
            : meter?.billingMode
          : meter?.billingMode;
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
    const plan =
      ratePlans.find((p) => p.id === opts.planId) ||
      ratePlans.find((p) => p.type === opts.meterType);
    if (
      !plan ||
      opts.lastValue === undefined ||
      opts.newValue === undefined ||
      isNaN(opts.newValue)
    )
      return null;
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
    const sc = siteClasses.find((siteClass) => siteClass.id === id);
    if (sc) {
      setClassDraft({
        meteredEnabled: sc.meteredEnabled ?? false,
        meteredType:
          sc.meteredType ?? (sc.hookupsPower ? "power" : sc.hookupsWater ? "water" : undefined),
        meteredBillingMode: sc.meteredBillingMode ?? "cycle",
        meteredBillTo: sc.meteredBillTo ?? "reservation",
        meteredMultiplier: sc.meteredMultiplier ?? 1,
        meteredRatePlanId: sc.meteredRatePlanId ?? undefined,
        meteredAutoEmail: sc.meteredAutoEmail ?? false,
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
            <h1 className="text-2xl font-bold text-foreground">Utilities & Billing</h1>
            <p className="text-sm text-muted-foreground">
              Metered sites, billing cadence, and quick billing from the latest reads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded border border-border px-2 py-1 bg-card">
              Total meters: <strong>{meters.length}</strong>
            </span>
            <span className="rounded border border-border px-2 py-1 bg-card">
              With recent reads:{" "}
              <strong>{lastReadsQuery.data ? lastReadsQuery.data.size : 0}</strong>
            </span>
            <span className="rounded border border-border px-2 py-1 bg-card">
              Power: <strong>{totalByType.power ?? 0}</strong> · Water:{" "}
              <strong>{totalByType.water ?? 0}</strong> · Sewer:{" "}
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
              <h2 className="text-lg font-semibold text-foreground">
                Site class defaults & auto meters
              </h2>
              <p className="text-sm text-muted-foreground">
                Mark a site class as metered, set defaults, and auto-create meters for its sites.
              </p>
            </div>
            {siteClassesQuery.isFetching && (
              <span className="text-xs text-muted-foreground">Refreshing…</span>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Site class</Label>
              <Select
                value={selectedClassId || EMPTY_SELECT_VALUE}
                onValueChange={(value) => selectClass(value === EMPTY_SELECT_VALUE ? "" : value)}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Select a site class</SelectItem>
                  {siteClasses.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {sc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Meter type</Label>
              <Select
                value={classDraft.meteredType || EMPTY_SELECT_VALUE}
                onValueChange={(value) =>
                  setClassDraft((d) => ({
                    ...d,
                    meteredType: value === EMPTY_SELECT_VALUE ? "" : value,
                  }))
                }
                disabled={!selectedClassId}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>Choose</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="sewer">Sewer</SelectItem>
                </SelectContent>
              </Select>
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
              <Label className="text-xs text-muted-foreground">Billing mode</Label>
              <Select
                value={classDraft.meteredBillingMode ?? "cycle"}
                onValueChange={(value) =>
                  setClassDraft((d) => ({ ...d, meteredBillingMode: value }))
                }
                disabled={!selectedClassId}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Bill to</Label>
              <Select
                value={classDraft.meteredBillTo ?? "reservation"}
                onValueChange={(value) => setClassDraft((d) => ({ ...d, meteredBillTo: value }))}
                disabled={!selectedClassId}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reservation">Reservation</SelectItem>
                  <SelectItem value="guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Usage multiplier</Label>
              <Input
                type="number"
                step="0.01"
                className="w-full text-sm"
                value={classDraft.meteredMultiplier ?? 1}
                onChange={(e) =>
                  setClassDraft((d) => ({ ...d, meteredMultiplier: Number(e.target.value) }))
                }
                disabled={!selectedClassId}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Rate plan</Label>
              <Select
                value={classDraft.meteredRatePlanId || EMPTY_SELECT_VALUE}
                onValueChange={(value) =>
                  setClassDraft((d) => ({
                    ...d,
                    meteredRatePlanId: value === EMPTY_SELECT_VALUE ? undefined : value,
                  }))
                }
                disabled={!selectedClassId}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={EMPTY_SELECT_VALUE}>No plan</SelectItem>
                  {(classDraft.meteredType
                    ? (ratePlansByType.get(classDraft.meteredType) ?? [])
                    : (ratePlans ?? [])
                  ).map((rp) => (
                    <SelectItem key={rp.id} value={rp.id}>
                      {rp.type} @ {(rp.baseRateCents / 100).toFixed(2)} (from{" "}
                      {new Date(rp.effectiveFrom).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Button
                size="sm"
                onClick={handleSaveClass}
                disabled={!selectedClassId || saveSiteClassMutation.isPending}
              >
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
              <Label className="text-xs text-muted-foreground">Meter type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                  <SelectItem value="water">Water</SelectItem>
                  <SelectItem value="sewer">Sewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col text-sm">
              <Label className="text-xs text-muted-foreground">Search site or meter</Label>
              <Input
                placeholder="e.g. SITE-12 or meter id"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[220px] text-sm"
                aria-label="Search site or meter"
              />
            </div>
            {metersQuery.isFetching && (
              <span className="text-xs text-muted-foreground">Refreshing…</span>
            )}
          </div>
        </Card>

        {message && (
          <div className="rounded border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
            {message}
          </div>
        )}

        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-13 bg-muted px-4 py-3 text-xs font-semibold uppercase text-muted-foreground">
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
              const readDraft = readDrafts[m.id] || {
                readingValue: "",
                readAt: new Date().toISOString().slice(0, 16),
                billNow: m.billingMode === "per_reading",
              };
              const billingMode = draft.billingMode ?? m.billingMode ?? "cycle";
              const billTo = draft.billTo ?? m.billTo ?? "reservation";
              const meterMultiplier = typeof m.multiplier === "number" ? m.multiplier : undefined;
              const multiplier = draft.multiplier ?? meterMultiplier ?? 1;
              const autoEmail = draft.autoEmail ?? m.autoEmail ?? false;
              const active = draft.active ?? m.active ?? true;
              const last = lastReadsQuery.data?.get(m.id);
              const lastValue = last ? Number(last.readingValue).toFixed(2) : "—";
              const lastDate = last ? formatDate(last.readAt) : "—";

              return (
                <div key={m.id} className="grid grid-cols-13 px-4 py-3 text-sm items-center">
                  <div className="col-span-2">
                    <div className="font-semibold text-foreground">{m.siteId}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.id}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={active}
                        onCheckedChange={(val) => applyDraft(m.id, { active: val })}
                        aria-label="Active meter"
                      />
                      <span>Active</span>
                    </div>
                  </div>

                  <div className="col-span-1 capitalize text-foreground">{m.type}</div>

                  <div className="col-span-2">
                    <Select
                      value={billingMode}
                      onValueChange={(value) => applyDraft(m.id, { billingMode: value })}
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BILLING_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch
                        checked={autoEmail}
                        onCheckedChange={(val) => applyDraft(m.id, { autoEmail: val })}
                        aria-label="Auto email"
                      />
                      <span>Auto-email invoice</span>
                    </div>
                  </div>

                  <div className="col-span-1">
                    <Select
                      value={billTo}
                      onValueChange={(value) => applyDraft(m.id, { billTo: value })}
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reservation">Reservation</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-1">
                    <Input
                      type="number"
                      step="0.01"
                      className="w-full h-8 text-right text-sm"
                      value={multiplier}
                      onChange={(e) => applyDraft(m.id, { multiplier: Number(e.target.value) })}
                    />
                    <div className="text-[11px] text-muted-foreground mt-1">x usage</div>
                  </div>

                  <div className="col-span-1">
                    <Select
                      value={draft.ratePlanId ?? m.ratePlanId ?? EMPTY_SELECT_VALUE}
                      onValueChange={(value) =>
                        applyDraft(m.id, {
                          ratePlanId: value === EMPTY_SELECT_VALUE ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_SELECT_VALUE}>No plan</SelectItem>
                        {(ratePlansByType.get(m.type) || ratePlans).map((rp) => (
                          <SelectItem key={rp.id} value={rp.id}>
                            {(rp.baseRateCents / 100).toFixed(2)} · {rp.type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-1 text-sm text-foreground">
                    <div className="font-medium">{lastValue}</div>
                    <div className="text-xs text-muted-foreground">{lastDate}</div>
                  </div>

                  <div className="col-span-1 text-xs text-muted-foreground">
                    {(() => {
                      const lastVal = last ? Number(last.readingValue) : undefined;
                      const newVal = parseFloat(readDraft.readingValue || "NaN");
                      const preview = computePreview({
                        meterType: m.type,
                        planId: draft.ratePlanId ?? m.ratePlanId,
                        lastValue: lastVal,
                        newValue: newVal,
                        multiplier,
                      });
                      if (!preview) return "Preview: —";
                      return (
                        <>
                          <div className="font-semibold text-foreground">
                            Δ {preview.usage.toFixed(2)} → ${preview.amount.toFixed(2)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {preview.billedUsage.toFixed(2)} units @ ${preview.rate.toFixed(2)}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  <div className="col-span-2">
                    <div className="flex flex-col gap-1">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Reading value"
                        value={readDraft.readingValue}
                        onChange={(e) => applyReadDraft(m.id, { readingValue: e.target.value })}
                        aria-label="Reading value"
                      />
                      <Input
                        className="h-8 text-sm"
                        type="datetime-local"
                        value={readDraft.readAt}
                        onChange={(e) => applyReadDraft(m.id, { readAt: e.target.value })}
                        aria-label="Read at"
                      />
                      <Input
                        className="h-8 text-sm"
                        placeholder="Note (optional)"
                        value={readDraft.note ?? ""}
                        onChange={(e) => applyReadDraft(m.id, { note: e.target.value })}
                        aria-label="Note"
                      />
                      <div className="text-[11px] text-muted-foreground">
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={readDraft.billNow ?? m.billingMode === "per_reading"}
                          onCheckedChange={(val) => applyReadDraft(m.id, { billNow: val })}
                          aria-label="Bill immediately"
                        />
                        <span>Bill immediately after saving</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddRead(m.id)}
                          disabled={addReadMutation.isPending}
                        >
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
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(m.id)}
                      disabled={updateMeterMutation.isPending}
                    >
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
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No meters match your filters.
              </div>
            )}
            {metersQuery.isLoading && (
              <div className="px-4 py-6 text-sm text-muted-foreground">Loading meters...</div>
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
