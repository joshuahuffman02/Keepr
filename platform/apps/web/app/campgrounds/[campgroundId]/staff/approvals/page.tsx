"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Shift = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  userId: string;
  role?: string | null;
  status?: string;
};

export default function ApprovalsQueue({ params }: { params: { campgroundId: string } }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const res = await fetch(
        `/api/staff/shifts?campgroundId=${params.campgroundId}&startDate=${lastWeek.toISOString()}&endDate=${now.toISOString()}&status=submitted`
      );
      if (!res.ok) throw new Error("Failed to load");
      setShifts(await res.json());
    } catch (err) {
      setError("Could not load submitted shifts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (shiftId: string, status: "approve" | "reject") => {
    await fetch(`/api/staff/shifts/${shiftId}/${status}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId: "manager-placeholder" })
    });
    await load();
  };

  const submittedCount = useMemo(() => shifts.length, [shifts]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Staff</p>
            <h1 className="text-2xl font-bold text-slate-900">Timesheet approvals</h1>
            <p className="text-slate-600 text-sm">Review submitted shifts and approve for payroll.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/campgrounds/${params.campgroundId}/staff/timeclock`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Time clock →
            </Link>
            <Link href={`/campgrounds/${params.campgroundId}/staff-scheduling`} className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Scheduling →
            </Link>
      </div>
        </div>

        {error && (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Submitted shifts</CardTitle>
                <CardDescription>Approve or reject shifts submitted by staff.</CardDescription>
              </div>
              <Badge variant="secondary" className="text-[11px]">
                {submittedCount} pending
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {shifts.map((shift) => (
              <div key={shift.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {shift.role || "Shift"} · {shift.userId}
                  </div>
                  <div className="text-xs text-slate-600">
                    {shift.shiftDate?.slice(0, 10)} · {new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} -{" "}
                    {new Date(shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                  onClick={() => decide(shift.id, "approve")}
                  data-testid={`approve-${shift.id}`}
                >
                  Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  onClick={() => decide(shift.id, "reject")}
                  data-testid={`reject-${shift.id}`}
                >
                  Reject
                  </Button>
              </div>
            </div>
          ))}
          {!loading && !shifts.length && (
              <div className="px-4 py-4 text-sm text-slate-500" data-testid="approvals-empty">
              No submissions waiting.
            </div>
          )}
            {loading && (
              <div className="px-4 py-4 text-sm text-slate-500">Loading…</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
