"use client";

import { useEffect, useState } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Sparkles,
  Timer,
  Coffee,
  Play,
  Pause,
  Utensils,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Shift = {
  id: string;
  userId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  role?: string | null;
  status?: string;
  timeEntries?: { id: string; clockInAt: string; clockOutAt?: string | null }[];
};

type BreakType = "paid" | "unpaid" | "meal" | "rest";

type ActiveBreak = {
  id: string;
  type: BreakType;
  startedAt: string;
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

export default function TimeclockPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [resolvedCampgroundId, setResolvedCampgroundId] = useState<string | null>(params.campgroundId || null);
  const [shiftId, setShiftId] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeBreak, setActiveBreak] = useState<ActiveBreak | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [showBreakMenu, setShowBreakMenu] = useState(false);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
      setStatus({ type: "error", message: "Please select or enter a shift ID first." });
      return;
    }

    if (action === "clock-in") setClockingIn(true);
    else setClockingOut(true);

    try {
      const res = await fetch(`/api/staff/shifts/${shiftId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });

      if (res.ok) {
        setStatus({
          type: "success",
          message: action === "clock-in"
            ? "You're clocked in! Have a great shift."
            : "You're clocked out! Great work today."
        });
        // Clear form on success
        setShiftId("");
        setNote("");
      } else {
        setStatus({ type: "error", message: "Unable to record. Please check the shift ID and try again." });
      }
    } catch {
      setStatus({ type: "error", message: "Connection error. Please try again." });
    } finally {
      setClockingIn(false);
      setClockingOut(false);
    }
  };

  // Find the selected shift from the shifts array
  const selectedShift = shifts.find(s => s.id === shiftId);

  // Get the active time entry for the selected shift
  const activeTimeEntry = selectedShift?.timeEntries?.find(
    (e) => e.clockInAt && !e.clockOutAt
  );

  const startBreak = async (type: BreakType) => {
    if (!activeTimeEntry) {
      setStatus({ type: "error", message: "You must be clocked in to take a break." });
      return;
    }

    setBreakLoading(true);
    setShowBreakMenu(false);
    try {
      const res = await fetch(`/api/staff/time-entries/${activeTimeEntry.id}/breaks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveBreak({ id: data.id, type: data.type, startedAt: data.startedAt });
        setStatus({ type: "info", message: `${type.charAt(0).toUpperCase() + type.slice(1)} break started!` });
      } else {
        setStatus({ type: "error", message: "Could not start break. Please try again." });
      }
    } catch {
      setStatus({ type: "error", message: "Connection error. Please try again." });
    } finally {
      setBreakLoading(false);
    }
  };

  const endBreak = async () => {
    if (!activeBreak) return;

    setBreakLoading(true);
    try {
      const res = await fetch(`/api/staff/breaks/${activeBreak.id}/end`, {
        method: "PATCH",
      });

      if (res.ok) {
        setActiveBreak(null);
        setStatus({ type: "success", message: "Break ended. Back to work!" });
      } else {
        setStatus({ type: "error", message: "Could not end break. Please try again." });
      }
    } catch {
      setStatus({ type: "error", message: "Connection error. Please try again." });
    } finally {
      setBreakLoading(false);
    }
  };

  // Check for active break when shift changes
  useEffect(() => {
    const checkActiveBreak = async () => {
      if (!activeTimeEntry) {
        setActiveBreak(null);
        return;
      }

      try {
        const res = await fetch(`/api/staff/time-entries/${activeTimeEntry.id}/active-break`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setActiveBreak({ id: data.id, type: data.type, startedAt: data.startedAt });
          } else {
            setActiveBreak(null);
          }
        }
      } catch {
        // Ignore errors
      }
    };
    checkActiveBreak();
  }, [activeTimeEntry?.id]);

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={SPRING_CONFIG}
      >
        <StaffNavigation campgroundId={params.campgroundId} />

        {/* Status Toast */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={cn(
                "fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg",
                status.type === "success" && "bg-emerald-600 text-white",
                status.type === "error" && "bg-red-600 text-white",
                status.type === "info" && "bg-blue-600 text-white"
              )}
              role="status"
              aria-live="polite"
            >
              {status.type === "success" && <CheckCircle2 className="w-5 h-5" />}
              {status.type === "error" && <AlertCircle className="w-5 h-5" />}
              <span className="font-medium">{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Clock Display */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-8 text-center shadow-xl"
        >
          <div className="text-slate-400 text-sm font-medium mb-2">
            {currentTime.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <div className="text-5xl md:text-7xl font-bold text-white font-mono tracking-tight">
            {currentTime.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          {whoami?.user && (
            <div className="mt-4 flex items-center justify-center gap-2 text-slate-300">
              <User className="w-4 h-4" />
              <span className="text-sm">
                {(whoami as any)?.user?.name || (whoami as any)?.user?.email || "Staff Member"}
              </span>
            </div>
          )}
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Select Shift Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.15 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Select Your Shift</h2>
                  <p className="text-sm text-slate-600">Choose from your scheduled shifts</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {!resolvedCampgroundId ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Please select a campground first.
                </div>
              ) : loadingShifts ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : shifts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Coffee className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-600 text-sm">No shifts found for this week.</p>
                  <p className="text-slate-500 text-xs mt-1">You can still enter a shift ID manually below.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shifts.map((shift) => (
                    <motion.button
                      key={shift.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setShiftId(shift.id)}
                      className={cn(
                        "w-full text-left rounded-lg border-2 p-4 transition-all",
                        shiftId === shift.id
                          ? "border-teal-500 bg-teal-50"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {shift.role || "Shift"}
                          </div>
                          <div className="text-sm text-slate-600">
                            {new Date(shift.shiftDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            {" "}&middot;{" "}
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                            {" - "}
                            {new Date(shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </div>
                        </div>
                        {shiftId === shift.id && (
                          <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Manual Entry */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Or enter shift ID manually
                </label>
                <input
                  type="text"
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  placeholder="shift_cuid..."
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
                />
              </div>
            </div>
          </motion.div>

          {/* Clock Actions Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.2 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Timer className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Record Time</h2>
                  <p className="text-sm text-slate-600">Clock in or out for your shift</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Selected Shift Display */}
              {selectedShift && (
                <div className="rounded-lg bg-teal-50 border border-teal-200 p-4">
                  <div className="text-xs font-semibold text-teal-600 uppercase tracking-wider mb-1">Selected Shift</div>
                  <div className="font-semibold text-slate-900">{selectedShift.role || "Shift"}</div>
                  <div className="text-sm text-slate-600">
                    {new Date(selectedShift.shiftDate).toLocaleDateString()}
                    {" "}&middot;{" "}
                    {new Date(selectedShift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {" - "}
                    {new Date(selectedShift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
              )}

              {/* Note Field */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Add a note <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., Front desk, Pool area..."
                  className="w-full border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
                />
              </div>

              {/* Clock Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!shiftId || clockingIn}
                  onClick={() => call("clock-in")}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  {clockingIn ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <LogIn className="w-5 h-5" />
                  )}
                  <span>Clock In</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!shiftId || clockingOut}
                  onClick={() => call("clock-out")}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-slate-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                >
                  {clockingOut ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : (
                    <LogOut className="w-5 h-5" />
                  )}
                  <span>Clock Out</span>
                </motion.button>
              </div>

              {/* Break Section */}
              {activeTimeEntry && (
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-slate-700">Break</span>
                    </div>
                    {activeBreak && (
                      <span className="text-xs text-amber-600 font-medium">
                        On {activeBreak.type} break since{" "}
                        {new Date(activeBreak.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>

                  {activeBreak ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={endBreak}
                      disabled={breakLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 text-white font-medium disabled:opacity-50 hover:bg-amber-700 transition-all"
                    >
                      {breakLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      End Break
                    </motion.button>
                  ) : (
                    <div className="relative">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowBreakMenu(!showBreakMenu)}
                        disabled={breakLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-amber-200 bg-amber-50 text-amber-700 font-medium disabled:opacity-50 hover:bg-amber-100 transition-all"
                      >
                        {breakLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                        Take a Break
                      </motion.button>

                      <AnimatePresence>
                        {showBreakMenu && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden z-10"
                          >
                            <button
                              onClick={() => startBreak("meal")}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 transition-colors"
                            >
                              <Utensils className="w-4 h-4 text-amber-600" />
                              <div>
                                <div className="font-medium text-slate-900">Meal Break</div>
                                <div className="text-xs text-slate-500">Unpaid lunch/dinner</div>
                              </div>
                            </button>
                            <button
                              onClick={() => startBreak("rest")}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 transition-colors border-t border-slate-100"
                            >
                              <Coffee className="w-4 h-4 text-teal-600" />
                              <div>
                                <div className="font-medium text-slate-900">Rest Break</div>
                                <div className="text-xs text-slate-500">Paid short break</div>
                              </div>
                            </button>
                            <button
                              onClick={() => startBreak("unpaid")}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-slate-50 transition-colors border-t border-slate-100"
                            >
                              <Clock className="w-4 h-4 text-slate-600" />
                              <div>
                                <div className="font-medium text-slate-900">Unpaid Break</div>
                                <div className="text-xs text-slate-500">Other unpaid time</div>
                              </div>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )}

              {/* Tips */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mt-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Quick Tips
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  <li>&bull; Shift IDs are found in Staff Scheduling</li>
                  <li>&bull; Clock-ins and clock-outs are recorded with timestamps</li>
                  <li>&bull; Add notes to explain late arrivals or early departures</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </DashboardShell>
  );
}
