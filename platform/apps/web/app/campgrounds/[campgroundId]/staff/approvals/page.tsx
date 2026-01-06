"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { useWhoami } from "@/hooks/use-whoami";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Inbox,
  Loader2,
  User,
  Calendar,
  Timer,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Shift = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  userId: string;
  role?: string | null;
  status?: string;
  scheduledMinutes?: number | null;
  actualMinutes?: number | null;
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

export default function ApprovalsQueue({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentUserId = whoami?.user?.id;

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
      setError("Could not load submitted shifts. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (shiftId: string, status: "approve" | "reject") => {
    if (!currentUserId) {
      setError("You must be logged in to approve or reject shifts");
      return;
    }

    setProcessing((prev) => new Set([...prev, shiftId]));
    try {
      await fetch(`/api/staff/shifts/${shiftId}/${status}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: currentUserId })
      });
      setSuccessMessage(status === "approve" ? "Shift approved!" : "Shift rejected.");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(shiftId);
        return next;
      });
    }
  };

  const submittedCount = useMemo(() => shifts.length, [shifts]);

  const formatDuration = (minutes?: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
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

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pending Approval</div>
                <div className="text-3xl font-bold text-foreground mt-1">{submittedCount}</div>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                submittedCount > 0 ? "bg-status-warning/15" : "bg-status-success/15"
              )}>
                {submittedCount > 0 ? (
                  <Clock className="w-6 h-6 text-status-warning" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-status-success" />
                )}
              </div>
            </div>
            {submittedCount > 0 && (
              <p className="text-xs text-status-warning mt-2">
                {submittedCount} timesheet{submittedCount !== 1 ? "s" : ""} waiting for review
              </p>
            )}
          </div>

          <div className="bg-status-success/10 rounded-xl border border-status-success/20 p-5">
            <div className="flex items-center gap-2 text-status-success text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Quick Tip
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Review timesheets promptly to ensure accurate payroll processing. Check hours against scheduled times.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Approval Workflow</span>
            </div>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>1. Staff submits timesheet</li>
              <li>2. Manager reviews & approves</li>
              <li>3. Ready for payroll export</li>
            </ul>
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
            <button onClick={load} className="ml-auto text-red-800 underline text-xs font-medium">
              Retry
            </button>
          </motion.div>
        )}

        {/* Shifts List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
        >
          <div className="bg-muted/60 border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Submitted Timesheets</h2>
                <p className="text-sm text-muted-foreground">Approve or reject staff timesheet submissions</p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading timesheets...</span>
              </div>
            ) : shifts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 bg-status-success/15 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-status-success" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  No timesheets waiting for approval. When staff submit their timesheets, they'll appear here.
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {shifts.map((shift, index) => (
                  <motion.div
                    key={shift.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ ...SPRING_CONFIG, delay: index * 0.03 }}
                    className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {shift.role || "Shift"}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(shift.shiftDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                          <span>&middot;</span>
                          <span>
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                        {(shift.scheduledMinutes || shift.actualMinutes) && (
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            {shift.scheduledMinutes && (
                              <span>Scheduled: {formatDuration(shift.scheduledMinutes)}</span>
                            )}
                            {shift.actualMinutes && (
                              <span className="text-status-success font-medium">Actual: {formatDuration(shift.actualMinutes)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:flex-shrink-0">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={processing.has(shift.id)}
                        onClick={() => decide(shift.id, "approve")}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                      >
                        {processing.has(shift.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Approve
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={processing.has(shift.id)}
                        onClick={() => decide(shift.id, "reject")}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 text-sm font-medium disabled:opacity-50 hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}
