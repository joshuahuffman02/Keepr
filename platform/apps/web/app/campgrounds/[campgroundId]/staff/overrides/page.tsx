"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Override = {
  id: string;
  type: string;
  status: string;
  reason?: string | null;
  targetEntity?: string | null;
  targetId?: string | null;
};

export default function OverridesPage({ params }: { params: { campgroundId: string } }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState({
    userId: "",
    type: "comp",
    reason: "",
    targetEntity: "pos_ticket",
    targetId: ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/staff/overrides?campgroundId=${params.campgroundId}`);
    if (res.ok) {
      setOverrides(await res.json());
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setStatus(null);
    const res = await fetch("/api/staff/overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campgroundId: params.campgroundId,
        ...form
      })
    });
    if (res.ok) {
      setStatus("Override requested");
      setForm({ ...form, reason: "", targetId: "" });
      await load();
    } else {
      setStatus("Could not submit override");
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Staff</p>
            <h1 className="text-2xl font-bold text-slate-900">Overrides</h1>
            <p className="text-slate-600 text-sm">Request manager approval for comps, voids, and discounts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/campgrounds/${params.campgroundId}/staff/timeclock`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Time clock →
            </Link>
            <Link href={`/campgrounds/${params.campgroundId}/staff/approvals`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Approvals →
            </Link>
          </div>
      </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Request an override</CardTitle>
            <CardDescription>Send to a manager for review and approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
                <span className="text-sm text-slate-700 font-medium">Requester (user id)</span>
                <Input
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: e.target.value })}
              placeholder="staff-user-id"
            />
                <p className="text-xs text-slate-500">We’ll attach this to the audit log.</p>
          </label>
          <label className="space-y-1">
                <span className="text-sm text-slate-700 font-medium">Type</span>
                <Select
              value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
            >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comp">Comp</SelectItem>
                    <SelectItem value="void">Void</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                  </SelectContent>
                </Select>
          </label>
        </div>

        <label className="space-y-1">
              <span className="text-sm text-slate-700 font-medium">Reason</span>
              <Input
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="Why is this override needed?"
          />
              <p className="text-xs text-slate-500">Add guest context, receipts, or incident references.</p>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
                <span className="text-sm text-slate-700 font-medium">Target entity</span>
                <Input
              value={form.targetEntity}
              onChange={(e) => setForm({ ...form, targetEntity: e.target.value })}
                  placeholder="pos_ticket, reservation, invoice"
            />
          </label>
          <label className="space-y-1">
                <span className="text-sm text-slate-700 font-medium">Target ID</span>
                <Input
              value={form.targetId}
              onChange={(e) => setForm({ ...form, targetId: e.target.value })}
              placeholder="ticket or reservation id"
            />
          </label>
        </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={submit} data-testid="override-submit">
                Submit override
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setForm({ userId: "", type: "comp", reason: "", targetEntity: "pos_ticket", targetId: "" });
                  setStatus(null);
                }}
              >
                Reset
              </Button>
      </div>

            {status && <div className="text-sm text-slate-600">{status}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Recent requests</CardTitle>
                <CardDescription>Track status of submitted overrides.</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {overrides.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y">
          {overrides.map((o) => (
            <div key={o.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                  <div className="font-medium capitalize text-slate-900">{o.type}</div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs uppercase tracking-wide text-slate-600">
                  {o.status}
                </span>
              </div>
                <div className="text-xs text-slate-600">
                {o.reason || "No reason provided"} · {o.targetEntity || "n/a"} {o.targetId || ""}
              </div>
            </div>
          ))}
            {!loading && !overrides.length && <div className="px-4 py-4 text-sm text-slate-500">No requests yet.</div>}
            {loading && <div className="px-4 py-4 text-sm text-slate-500">Loading…</div>}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
