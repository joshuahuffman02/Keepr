"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";

type Shift = {
  id: string;
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role?: string | null;
  status?: string;
  scheduledMinutes?: number | null;
  actualMinutes?: number | null;
};

type StaffRole = { id: string; code: string; name: string };

const STATUS_OPTIONS = ["all", "scheduled", "in_progress", "submitted", "approved", "rejected"];

export default function StaffSchedulingPage({ params }: { params: { campgroundId: string } }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [dragShiftId, setDragShiftId] = useState<string | null>(null);
  const [form, setForm] = useState({
    userId: "",
    date: "",
    start: "09:00",
    end: "17:00",
    role: "",
  });

  const [startDay, setStartDay] = useState(() => new Date());

  const windowStart = useMemo(() => startDay, [startDay]);
  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + 21 * 24 * 60 * 60 * 1000),
    [windowStart]
  );

  const groupedByDay = useMemo(() => {
    return shifts.reduce<Record<string, Shift[]>>((acc, shift) => {
      const day = shift.shiftDate?.slice(0, 10);
      if (!day) return acc;
      acc[day] = acc[day] || [];
      acc[day].push(shift);
      return acc;
    }, {});
  }, [shifts]);

  const conflicts = useMemo(() => {
    const map = new Set<string>();
    Object.entries(groupedByDay).forEach(([day, dayShifts]) => {
      // group by user
      const byUser: Record<string, Shift[]> = {};
      dayShifts.forEach((s) => {
        const key = s.userId || "unknown";
        byUser[key] = byUser[key] || [];
        byUser[key].push(s);
      });
      Object.values(byUser).forEach((userShifts) => {
        const sorted = userShifts
          .filter((s) => s.startTime && s.endTime)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        for (let i = 0; i < sorted.length - 1; i++) {
          const currEnd = new Date(sorted[i].endTime!).getTime();
          const nextStart = new Date(sorted[i + 1].startTime!).getTime();
          if (currEnd > nextStart) {
            map.add(sorted[i].id);
            map.add(sorted[i + 1].id);
          }
        }
      });
    });
    return map;
  }, [groupedByDay]);

  const loadRoles = async () => {
    try {
      const res = await fetch(`/api/staff/roles?campgroundId=${params.campgroundId}`);
      if (res.ok) {
        const data = await res.json();
        setRoles(data || []);
        if (!form.role && data?.length) {
          setForm((f) => ({ ...f, role: data[0].name }));
        }
      }
    } catch {
      // ignore role load errors; optional
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/staff/shifts?campgroundId=${params.campgroundId}&startDate=${windowStart.toISOString()}&endDate=${windowEnd.toISOString()}${statusFilter !== "all" ? `&status=${statusFilter}` : ""
        }`
      );
      if (!res.ok) throw new Error("Failed to load shifts");
      const data = await res.json();
      setShifts(data || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load shifts. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  useEffect(() => {
    load();
  }, [statusFilter, windowStart]);

  const createShift = async () => {
    setError(null);
    const res = await fetch(`/api/staff/shifts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campgroundId: params.campgroundId,
        userId: form.userId,
        shiftDate: form.date,
        startTime: form.start,
        endTime: form.end,
        role: form.role,
      }),
    });
    if (!res.ok) {
      setError("Could not save shift. Try again.");
      return;
    }
    await load();
  };

  const submitShift = async (id: string) => {
    await fetch(`/api/staff/shifts/${id}/submit`, { method: "POST" });
    await load();
  };

  const updateShift = async (id: string, payload: Partial<{ shiftDate: string; startTime: string; endTime: string }>) => {
    await fetch(`/api/staff/shifts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    await load();
  };

  const moveShiftByDays = async (shift: Shift, deltaDays: number) => {
    const baseDate = shift.shiftDate?.slice(0, 10);
    if (!baseDate) return;
    const date = new Date(baseDate);
    date.setDate(date.getDate() + deltaDays);
    await updateShift(shift.id, { shiftDate: date.toISOString().slice(0, 10) });
  };

  const moveShiftTime = async (shift: Shift, deltaMinutes: number) => {
    const datePart = shift.shiftDate?.slice(0, 10);
    if (!datePart) return;
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    start.setMinutes(start.getMinutes() + deltaMinutes);
    end.setMinutes(end.getMinutes() + deltaMinutes);
    await updateShift(shift.id, {
      shiftDate: datePart,
      startTime: start.toISOString().slice(11, 16),
      endTime: end.toISOString().slice(11, 16)
    });
  };

  const handleDragStart = (id: string) => setDragShiftId(id);

  const handleDropOnDay = async (day: string) => {
    if (!dragShiftId) return;
    const target = shifts.find((s) => s.id === dragShiftId);
    if (!target || target.shiftDate?.slice(0, 10) === day) {
      setDragShiftId(null);
      return;
    }
    await updateShift(target.id, { shiftDate: day });
    setDragShiftId(null);
  };

  const handleDropOnHour = async (day: string, hour: number) => {
    if (!dragShiftId) return;
    const target = shifts.find((s) => s.id === dragShiftId);
    if (!target) return;
    const mins = durationMinutes(target);
    const start = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`);
    const end = new Date(start.getTime() + mins * 60000);
    await updateShift(target.id, {
      shiftDate: day,
      startTime: start.toISOString().slice(11, 16),
      endTime: end.toISOString().slice(11, 16)
    });
    setDragShiftId(null);
  };

  const duplicateToForm = (shift: Shift) => {
    setForm({
      userId: shift.userId,
      date: shift.shiftDate?.slice(0, 10) ?? "",
      start: shift.startTime?.slice(11, 16) ?? "09:00",
      end: shift.endTime?.slice(11, 16) ?? "17:00",
      role: shift.role ?? ""
    });
  };

  const approveShift = async (id: string) => {
    await fetch(`/api/staff/shifts/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId: "manager-placeholder" })
    });
    await load();
  };

  const rejectShift = async (id: string) => {
    await fetch(`/api/staff/shifts/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approverId: "manager-placeholder" })
    });
    await load();
  };

  const minutesLabel = (scheduled?: number | null, actual?: number | null) => {
    if (actual != null) return `${(actual / 60).toFixed(1)}h actual`;
    if (scheduled != null) return `${(scheduled / 60).toFixed(1)}h scheduled`;
    return "";
  };

  const durationMinutes = (shift: Shift) => {
    const start = shift.startTime ? new Date(shift.startTime).getTime() : null;
    const end = shift.endTime ? new Date(shift.endTime).getTime() : null;
    if (!start || !end) return 0;
    return Math.max(0, Math.round((end - start) / 60000));
  };

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <div data-testid="staff-header" className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Staff Scheduling</h1>
            <p className="text-slate-500">Plan shifts, monitor status, and hand off to approvals/payroll.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href={`/campgrounds/${params.campgroundId}/staff/timeclock`} className="text-teal-700 underline">
              Timeclock
            </Link>
            <Link href={`/campgrounds/${params.campgroundId}/staff/approvals`} className="text-teal-700 underline">
              Approvals
            </Link>
            <Link href={`/campgrounds/${params.campgroundId}/staff/overrides`} className="text-teal-700 underline">
              Overrides
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-3" data-testid="staff-create-card">
            <h2 className="text-lg font-medium">Create Shift</h2>
            <div className="grid gap-3">
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="User ID"
                value={form.userId}
                onChange={(e) => setForm({ ...form, userId: e.target.value })}
              />
              <input
                className="w-full rounded border px-3 py-2"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  className="w-full rounded border px-3 py-2"
                  type="time"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
                <input
                  className="w-full rounded border px-3 py-2"
                  type="time"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                />
              </div>
              <select
                className="w-full rounded border px-3 py-2"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name} ({r.code})
                  </option>
                ))}
                {!roles.length && <option value="">Role (optional)</option>}
              </select>
              <button
                className="mt-2 rounded bg-teal-600 px-4 py-2 text-white"
                onClick={createShift}
                data-testid="assign-staff-button"
              >
                Save Shift
              </button>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3" data-testid="calendar-view">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Upcoming Shifts</h2>
                <p className="text-xs text-slate-500">
                  {windowStart.toDateString()} → {windowEnd.toDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as "list" | "calendar")}
                >
                  <option value="calendar">Calendar</option>
                  <option value="list">List</option>
                </select>
                <select
                  className="rounded border px-2 py-1 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "All statuses" : s.replace("_", " ")}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded border px-3 py-1 text-sm"
                  onClick={load}
                  disabled={loading}
                >
                  Refresh
                </button>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <button
                    className="rounded border px-2 py-1"
                    onClick={() => setStartDay(new Date(windowStart.getTime() - 7 * 24 * 60 * 60 * 1000))}
                  >
                    ◀ Prev week
                  </button>
                  <button
                    className="rounded border px-2 py-1"
                    onClick={() => setStartDay(new Date())}
                  >
                    Today
                  </button>
                  <button
                    className="rounded border px-2 py-1"
                    onClick={() => setStartDay(new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000))}
                  >
                    Next week ▶
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            {loading && (
              <div className="space-y-2 animate-pulse" data-testid="staff-skeleton">
                <div className="h-4 rounded bg-slate-200" />
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="h-4 w-2/3 rounded bg-slate-200" />
              </div>
            )}

            {!loading && viewMode === "list" && (
              <div className="space-y-2" aria-busy={loading}>
                {shifts.map((shift) => (
                  <div key={shift.id} className="rounded border px-3 py-2 space-y-1" data-testid="shift-tile">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{shift.role || "Shift"}</div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize text-slate-700">
                        {shift.status ?? "scheduled"}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {shift.shiftDate?.slice(0, 10)} · {new Date(shift.startTime).toLocaleTimeString()} -{" "}
                      {new Date(shift.endTime).toLocaleTimeString()} · {minutesLabel(shift.scheduledMinutes, shift.actualMinutes)}
                    </div>
                    <div className="flex gap-3 text-xs">
                      {(shift.status === "scheduled" || shift.status === "in_progress") && (
                        <button
                          className="text-teal-700 underline"
                          onClick={() => submitShift(shift.id)}
                        >
                          Submit for approval
                        </button>
                      )}
                      {shift.status === "submitted" && (
                        <>
                          <button className="text-emerald-700 underline" onClick={() => approveShift(shift.id)}>
                            Approve
                          </button>
                          <button className="text-rose-700 underline" onClick={() => rejectShift(shift.id)}>
                            Reject
                          </button>
                        </>
                      )}
                      <button className="text-slate-600 underline" onClick={() => duplicateToForm(shift)}>
                        Prefill form
                      </button>
                    </div>
                  </div>
                ))}
                {!shifts.length && <div className="text-sm text-slate-500" data-testid="staff-empty">No shifts scheduled.</div>}
              </div>
            )}

            {!loading && viewMode === "calendar" && (
              <div className="grid gap-3 md:grid-cols-2" data-testid="staff-calendar">
                {Object.keys(groupedByDay)
                  .sort()
                  .map((day) => (
                    <div
                      key={day}
                      className="rounded border px-3 py-2 space-y-2"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnDay(day);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{day}</div>
                        <span className="text-xs text-slate-500">{groupedByDay[day].length} shift(s)</span>
                      </div>
                      <div className="flex gap-1 text-[11px] text-slate-600 flex-wrap">
                        {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                          <button
                            key={h}
                            className="rounded border px-2 py-1 bg-white hover:bg-slate-50"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropOnHour(day, h);
                            }}
                          >
                            {h}:00
                          </button>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {groupedByDay[day].map((shift) => (
                          <div
                            key={shift.id}
                            className="rounded border px-2 py-2 space-y-1 bg-slate-50"
                            draggable
                            onDragStart={() => handleDragStart(shift.id)}
                            onDragEnd={() => setDragShiftId(null)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{shift.role || "Shift"}</div>
                              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] capitalize text-slate-700 border">
                                {shift.status ?? "scheduled"}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600">
                              {new Date(shift.startTime).toLocaleTimeString()} - {new Date(shift.endTime).toLocaleTimeString()} ·{" "}
                              {minutesLabel(shift.scheduledMinutes, shift.actualMinutes)}
                              {conflicts.has(shift.id) && <span className="ml-2 text-rose-600 font-semibold">Conflict</span>}
                            </div>
                            <div className="flex gap-2 text-[11px]">
                              {(shift.status === "scheduled" || shift.status === "in_progress") && (
                                <button className="text-teal-700 underline" onClick={() => submitShift(shift.id)}>
                                  Submit
                                </button>
                              )}
                              {shift.status === "submitted" && (
                                <>
                                  <button className="text-emerald-700 underline" onClick={() => approveShift(shift.id)}>
                                    Approve
                                  </button>
                                  <button className="text-rose-700 underline" onClick={() => rejectShift(shift.id)}>
                                    Reject
                                  </button>
                                </>
                              )}
                              <button className="text-slate-600 underline" onClick={() => duplicateToForm(shift)}>
                                Prefill
                              </button>
                              <button className="text-slate-600 underline" onClick={() => moveShiftByDays(shift, 1)}>
                                +1 day
                              </button>
                              <button className="text-slate-600 underline" onClick={() => moveShiftByDays(shift, -1)}>
                                -1 day
                              </button>
                              <button className="text-slate-600 underline" onClick={() => moveShiftTime(shift, 60)}>
                                +1h
                              </button>
                              <button className="text-slate-600 underline" onClick={() => moveShiftTime(shift, -60)}>
                                -1h
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                {!Object.keys(groupedByDay).length && (
                  <div className="text-sm text-slate-500" data-testid="staff-empty-calendar">
                    No shifts scheduled in this window.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

