"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Shift = {
  id: string;
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role?: string | null;
  status?: string;
};

export default function TimeclockPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [resolvedCampgroundId, setResolvedCampgroundId] = useState<string | null>(params.campgroundId || null);
  const [shiftId, setShiftId] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);

  useEffect(() => {
    if (resolvedCampgroundId && resolvedCampgroundId !== "undefined") return;
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setResolvedCampgroundId(stored);
  }, [resolvedCampgroundId]);

  useEffect(() => {
    const loadShifts = async () => {
      if (!resolvedCampgroundId || resolvedCampgroundId === "undefined" || !whoami?.user?.id) return;
      setLoadingShifts(true);
      try {
        const now = new Date();
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const res = await fetch(
          `/api/staff/shifts?campgroundId=${resolvedCampgroundId}&startDate=${lastWeek.toISOString()}&endDate=${now.toISOString()}`
        );
        if (res.ok) {
          const data: Shift[] = await res.json();
          const mine = data.filter((s) => s.userId === (whoami.user as any)?.id);
          setShifts(mine);
        }
      } catch (err) {
        console.error("Failed to load shifts", err);
      } finally {
        setLoadingShifts(false);
      }
    };
    loadShifts();
  }, [resolvedCampgroundId, whoami?.user?.id]);

  const call = async (action: "clock-in" | "clock-out") => {
    setStatus(null);
    if (!shiftId) {
      setStatus("Enter a shift ID to record time.");
      return;
    }
    const res = await fetch(`/api/staff/shifts/${shiftId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    });
    if (res.ok) {
      setStatus(action === "clock-in" ? "Clock-in recorded" : "Clock-out recorded");
    } else {
      setStatus("Unable to record. Check the shift ID and try again.");
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Staff</p>
            <h1 className="text-2xl font-bold text-slate-900">Time clock</h1>
            <p className="text-slate-600 text-sm">
              Clock in/out against scheduled shifts for this campground.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={resolvedCampgroundId ? `/campgrounds/${resolvedCampgroundId}/staff-scheduling` : "#"}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              aria-disabled={!resolvedCampgroundId}
            >
              View schedule →
            </Link>
            <Link
              href={resolvedCampgroundId ? `/campgrounds/${resolvedCampgroundId}/staff/approvals` : "#"}
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              aria-disabled={!resolvedCampgroundId}
            >
              Timesheet approvals →
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Record a shift</CardTitle>
                <CardDescription>Use the shift ID from Scheduling to clock in or out.</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {resolvedCampgroundId ? `Campground ${resolvedCampgroundId}` : "Select campground"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!resolvedCampgroundId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Choose a campground first (saved selection is required to load your shifts).
              </div>
            )}
            {whoami?.user?.id && resolvedCampgroundId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Signed in as</div>
                <div>{(whoami as any)?.user?.name || (whoami as any)?.user?.email || (whoami as any)?.user?.id}</div>
              </div>
            )}
            {resolvedCampgroundId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="font-semibold text-slate-900 mb-1">My shifts</div>
                {loadingShifts ? (
                  <div className="text-xs text-slate-500">Loading shifts…</div>
                ) : shifts.length === 0 ? (
                  <div className="text-xs text-slate-500">No recent shifts found for you. You can still enter an ID manually.</div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    <Select value={shiftId} onValueChange={setShiftId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your shift" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {new Date(s.shiftDate).toLocaleDateString()} · {new Date(s.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – {new Date(s.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {s.role || "Shift"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
                <span className="text-sm text-slate-700 font-medium">Shift ID</span>
                <Input
              placeholder="shift_cuid"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              data-testid="timeclock-shift-id"
            />
                <p className="text-xs text-slate-500">
                  Find this in Staff Scheduling under the shift details.
                </p>
          </label>
          <label className="space-y-1">
                <span className="text-sm text-slate-700 font-medium">Note (optional)</span>
                <Input
              placeholder="Front desk"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
                <p className="text-xs text-slate-500">E.g., location or task for this shift.</p>
          </label>
        </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => call("clock-in")} data-testid="timeclock-in">
            Clock In
              </Button>
              <Button variant="outline" onClick={() => call("clock-out")} data-testid="timeclock-out">
            Clock Out
              </Button>
              <Button variant="ghost" onClick={() => { setShiftId(""); setNote(""); setStatus(null); }}>
                Clear
              </Button>
        </div>

        {status && (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm" role="status">
            {status}
          </div>
        )}

            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">Tips</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Shift IDs come from Staff Scheduling. Create shifts there first.</li>
                <li>Clock-ins/outs log to the same shift so approvals see both.</li>
                <li>If you clock out late, add a note so managers have context.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
