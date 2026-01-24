"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DayAvailability = {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
};

type AvailabilityOverride = {
  id: string;
  userId: string;
  date: string;
  isAvailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
};

type StaffMember = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 200,
  damping: 20,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AvailabilityPage({ params }: { params: { campgroundId: string } }) {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.setDate(diff));
  });
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ userId: string; date: Date } | null>(null);
  const [saving, setSaving] = useState(false);

  // Override form
  const [overrideAvailable, setOverrideAvailable] = useState(true);
  const [overrideStartTime, setOverrideStartTime] = useState("");
  const [overrideEndTime, setOverrideEndTime] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });
  }, [weekStart]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return end;
  }, [weekStart]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [availRes, overrideRes] = await Promise.all([
        fetch(`/api/staff/availability?campgroundId=${params.campgroundId}`),
        fetch(
          `/api/staff/availability/overrides?campgroundId=${params.campgroundId}&startDate=${weekStart.toISOString()}&endDate=${weekEnd.toISOString()}`,
        ),
      ]);

      if (!availRes.ok || !overrideRes.ok) throw new Error("Failed to load");

      const availData: DayAvailability[] = await availRes.json();
      const overrideData: AvailabilityOverride[] = await overrideRes.json();

      setAvailability(availData);
      setOverrides(overrideData);

      // Extract unique staff members
      const staffMap = new Map<string, StaffMember>();
      availData.forEach((a) => {
        if (a.user) staffMap.set(a.userId, a.user);
      });
      overrideData.forEach((o) => {
        if (o.user) staffMap.set(o.userId, o.user);
      });
      setStaffMembers(Array.from(staffMap.values()));
    } catch (err) {
      setError("Could not load availability data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.campgroundId, weekStart]);

  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    setWeekStart(new Date(now.setDate(diff)));
  };

  const getCellStatus = (userId: string, date: Date) => {
    const dayOfWeek = date.getDay();
    const dateStr = date.toISOString().split("T")[0];

    // Check for override first
    const override = overrides.find((o) => o.userId === userId && o.date.split("T")[0] === dateStr);
    if (override) {
      return {
        available: override.isAvailable,
        startTime: override.startTime,
        endTime: override.endTime,
        isOverride: true,
        reason: override.reason,
      };
    }

    // Fall back to regular availability
    const regular = availability.find((a) => a.userId === userId && a.dayOfWeek === dayOfWeek);
    if (regular) {
      return {
        available: regular.isAvailable,
        startTime: regular.startTime,
        endTime: regular.endTime,
        isOverride: false,
      };
    }

    return { available: false, isOverride: false };
  };

  const handleCellClick = (userId: string, date: Date) => {
    const status = getCellStatus(userId, date);
    setSelectedCell({ userId, date });
    setOverrideAvailable(!status.available); // Toggle availability
    setOverrideStartTime(status.startTime || "09:00");
    setOverrideEndTime(status.endTime || "17:00");
    setOverrideReason("");
  };

  const saveOverride = async () => {
    if (!selectedCell) return;
    setSaving(true);

    try {
      const res = await fetch("/api/staff/availability/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId: params.campgroundId,
          userId: selectedCell.userId,
          date: selectedCell.date.toISOString().split("T")[0],
          isAvailable: overrideAvailable,
          startTime: overrideAvailable ? overrideStartTime : undefined,
          endTime: overrideAvailable ? overrideEndTime : undefined,
          reason: overrideReason || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setSuccessMessage("Availability updated!");
      setTimeout(() => setSuccessMessage(null), 3000);
      setSelectedCell(null);
      await loadData();
    } catch (err) {
      setError("Could not save override. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteOverride = async () => {
    if (!selectedCell) return;
    setSaving(true);

    try {
      const res = await fetch(
        `/api/staff/availability/override?campgroundId=${params.campgroundId}&userId=${selectedCell.userId}&date=${selectedCell.date.toISOString().split("T")[0]}`,
        { method: "DELETE" },
      );

      if (!res.ok) throw new Error("Failed to delete");

      setSuccessMessage("Override removed!");
      setTimeout(() => setSuccessMessage(null), 3000);
      setSelectedCell(null);
      await loadData();
    } catch (err) {
      setError("Could not remove override. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const formatWeekRange = () => {
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${weekStart.toLocaleDateString(undefined, options)} - ${weekEnd.toLocaleDateString(undefined, options)}, ${weekEnd.getFullYear()}`;
  };

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_CONFIG}
      >
        <StaffNavigation campgroundId={params.campgroundId} />

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-lg"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-info/15 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-status-info" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Staff Availability</h1>
              <p className="text-sm text-muted-foreground">View and manage when staff can work</p>
            </div>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToPreviousWeek}
              className="p-2 rounded-lg border border-border hover:bg-muted/60 transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </motion.button>
            <button
              onClick={goToCurrentWeek}
              className="px-4 py-2 rounded-lg bg-muted text-foreground font-medium text-sm hover:bg-muted transition-colors"
            >
              {formatWeekRange()}
            </button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToNextWeek}
              className="p-2 rounded-lg border border-border hover:bg-muted/60 transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-800 underline text-xs font-medium"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Availability Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading availability...</span>
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No staff availability set</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Staff members need to set their availability first.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-48">
                      Staff Member
                    </th>
                    {weekDates.map((date, i) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <th
                          key={i}
                          className={cn(
                            "text-center px-2 py-3 text-xs font-semibold uppercase tracking-wider min-w-[80px]",
                            isToday ? "text-blue-600 bg-blue-50" : "text-muted-foreground",
                          )}
                        >
                          <div>{DAYS[date.getDay()]}</div>
                          <div className={cn("text-sm font-bold", isToday && "text-blue-700")}>
                            {date.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staffMembers.map((staff) => (
                    <tr key={staff.id} className="hover:bg-muted/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="font-medium text-foreground text-sm">
                            {staff.firstName && staff.lastName
                              ? `${staff.firstName} ${staff.lastName}`
                              : staff.firstName || staff.email.split("@")[0]}
                          </div>
                        </div>
                      </td>
                      {weekDates.map((date, i) => {
                        const status = getCellStatus(staff.id, date);
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                          <td
                            key={i}
                            className={cn("px-2 py-2 text-center", isToday && "bg-blue-50/50")}
                          >
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleCellClick(staff.id, date)}
                              className={cn(
                                "w-full px-2 py-2 rounded-lg text-xs font-medium transition-all",
                                status.available
                                  ? status.isOverride
                                    ? "bg-status-success/15 text-status-success ring-2 ring-status-success/30"
                                    : "bg-status-success/10 text-status-success"
                                  : status.isOverride
                                    ? "bg-status-error/15 text-status-error ring-2 ring-status-error/30"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {status.available ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 mx-auto mb-0.5" />
                                  {status.startTime && (
                                    <div className="text-[10px]">
                                      {status.startTime.slice(0, 5)}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <XCircle className="w-3.5 h-3.5 mx-auto" />
                              )}
                            </motion.button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Override Modal */}
        <AnimatePresence>
          {selectedCell && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedCell(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden"
              >
                <div className="bg-status-info/10 border-b border-status-info/20 px-6 py-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Set Availability Override
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedCell.date.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCell(null)}
                    className="p-1 rounded-lg hover:bg-card/50 transition-colors"
                    aria-label="Close override dialog"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {/* Available Toggle */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setOverrideAvailable(true)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 font-medium transition-all",
                        overrideAvailable
                          ? "border-status-success bg-status-success/15 text-status-success"
                          : "border-border text-muted-foreground hover:border-border",
                      )}
                      aria-pressed={overrideAvailable}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Available
                    </button>
                    <button
                      onClick={() => setOverrideAvailable(false)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 font-medium transition-all",
                        !overrideAvailable
                          ? "border-status-error bg-status-error/15 text-status-error"
                          : "border-border text-muted-foreground hover:border-border",
                      )}
                      aria-pressed={!overrideAvailable}
                    >
                      <XCircle className="w-4 h-4" />
                      Unavailable
                    </button>
                  </div>

                  {/* Time Range (if available) */}
                  {overrideAvailable && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label
                          htmlFor="override-start"
                          className="block text-sm font-medium text-foreground mb-2"
                        >
                          Start Time
                        </Label>
                        <Input
                          id="override-start"
                          type="time"
                          value={overrideStartTime}
                          onChange={(e) => setOverrideStartTime(e.target.value)}
                          className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor="override-end"
                          className="block text-sm font-medium text-foreground mb-2"
                        >
                          End Time
                        </Label>
                        <Input
                          id="override-end"
                          type="time"
                          value={overrideEndTime}
                          onChange={(e) => setOverrideEndTime(e.target.value)}
                          className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <Label
                      htmlFor="override-reason"
                      className="block text-sm font-medium text-foreground mb-2"
                    >
                      Reason <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="override-reason"
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g., Doctor's appointment"
                      className="w-full border border-border rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={saveOverride}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Save Override
                    </motion.button>
                    {getCellStatus(selectedCell.userId, selectedCell.date).isOverride && (
                      <button
                        onClick={deleteOverride}
                        disabled={saving}
                        className="px-4 py-2.5 rounded-lg border border-red-200 text-red-700 font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
          className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-status-success/10 border border-status-success/20" />
            <span>Available (regular)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-status-success/15 ring-2 ring-status-success/30" />
            <span>Available (override)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted border border-border" />
            <span>Unavailable (regular)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-status-error/15 ring-2 ring-status-error/30" />
            <span>Unavailable (override)</span>
          </div>
        </motion.div>

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.25 }}
          className="bg-status-info/10 rounded-xl border border-status-info/20 p-5"
        >
          <div className="flex items-center gap-2 text-blue-700 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            Availability Tips
          </div>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>&bull; Click any cell to set a one-time override for that date</li>
            <li>&bull; Overrides are shown with a colored ring around them</li>
            <li>&bull; Regular availability is set by each staff member in their profile</li>
          </ul>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}
