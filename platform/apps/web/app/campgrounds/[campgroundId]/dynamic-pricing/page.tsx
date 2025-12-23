"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";

type Rule = {
  id: string;
  name: string;
  trigger: string;
  adjustmentType: string;
  adjustmentValue: number;
  isActive: boolean;
};

export default function DynamicPricingPage({ params }: { params: { campgroundId: string } }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    trigger: "occupancy_high",
    adjustmentType: "percent",
    adjustmentValue: 10,
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dynamic-pricing/rules?campgroundId=${params.campgroundId}`);
      if (!res.ok) throw new Error("Failed to load rules");
      const data = await res.json();
      setRules(data || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load rules. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createRule = async () => {
    setError(null);
    const res = await fetch(`/api/dynamic-pricing/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campgroundId: params.campgroundId,
        ...form,
        adjustmentValue: Number(form.adjustmentValue),
      }),
    });
    if (!res.ok) {
      setError("Could not save rule. Try again.");
      return;
    }
    await load();
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: "Settings", href: `/campgrounds/${params.campgroundId}` },
            { label: "Dynamic Pricing" }
          ]}
        />
        <div>
          <h1 className="text-2xl font-semibold">Dynamic Pricing</h1>
          <p className="text-slate-500">Configure occupancy and demand-based adjustments.</p>
        </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="text-lg font-medium mb-2">Create Rule</h2>
          <div className="space-y-2">
            <label className="block text-sm font-medium">Name</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <label className="block text-sm font-medium">Trigger</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            >
              <option value="occupancy_high">Occupancy High</option>
              <option value="occupancy_low">Occupancy Low</option>
              <option value="demand_surge">Demand Surge</option>
              <option value="last_minute">Last Minute</option>
              <option value="advance_booking">Advance Booking</option>
              <option value="manual">Manual</option>
            </select>
            <label className="block text-sm font-medium">Adjustment</label>
            <div className="flex gap-2">
              <select
                className="rounded border px-3 py-2"
                value={form.adjustmentType}
                onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}
              >
                <option value="percent">% Percent</option>
                <option value="flat">Flat (cents)</option>
              </select>
              <input
                type="number"
                className="w-24 rounded border px-3 py-2"
                value={form.adjustmentValue}
                onChange={(e) => setForm({ ...form, adjustmentValue: Number(e.target.value) })}
              />
            </div>
            <button
              className="mt-2 rounded bg-emerald-600 px-4 py-2 text-white"
              onClick={createRule}
            >
              Save Rule
            </button>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-medium">Rules</h2>
            {loading && <span className="text-sm text-slate-500">Loading…</span>}
          </div>
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700" role="alert" aria-live="polite">
              {error}
            </div>
          )}
          <div className="space-y-2" aria-busy={loading}>
            {loading && (
              <div className="space-y-2 animate-pulse" data-testid="dynamic-pricing-skeleton">
                <div className="h-4 rounded bg-slate-200" />
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
              </div>
            )}
            {!loading &&
              rules.map((r) => (
                <div key={r.id} className="rounded border px-3 py-2 flex justify-between">
                  <div>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-xs text-slate-500">
                      {r.trigger} · {r.adjustmentType} {r.adjustmentValue}
                    </div>
                  </div>
                  <div className="text-xs text-emerald-700">{r.isActive ? "Active" : "Inactive"}</div>
                </div>
              ))}
            {!loading && !rules.length && <div className="text-sm text-slate-500">No rules yet.</div>}
          </div>
        </div>
      </div>
      </div>
    </DashboardShell>
  );
}

