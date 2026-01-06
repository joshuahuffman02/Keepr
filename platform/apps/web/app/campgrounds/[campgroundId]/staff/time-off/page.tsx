"use client";

import { useEffect, useState, useMemo } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palmtree,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  User,
  Calendar,
  Sparkles,
  FileText,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TimeOffType = "vacation" | "sick" | "personal" | "bereavement" | "jury_duty" | "unpaid" | "other";
type TimeOffStatus = "pending" | "approved" | "rejected" | "cancelled";

type TimeOffRequest = {
  id: string;
  type: TimeOffType;
  status: TimeOffStatus;
  startDate: string;
  endDate: string;
  hoursRequested?: number | null;
  reason?: string | null;
  reviewerNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  reviewer?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  } | null;
};

interface WhoamiUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

const TIME_OFF_TYPES: { value: TimeOffType; label: string; icon: string }[] = [
  { value: "vacation", label: "Vacation", icon: "palmtree" },
  { value: "sick", label: "Sick", icon: "thermometer" },
  { value: "personal", label: "Personal", icon: "home" },
  { value: "bereavement", label: "Bereavement", icon: "heart" },
  { value: "jury_duty", label: "Jury Duty", icon: "scale" },
  { value: "unpaid", label: "Unpaid Leave", icon: "clipboard" },
  { value: "other", label: "Other", icon: "file-text" },
];

const STATUS_STYLES: Record<TimeOffStatus, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: { bg: "bg-status-warning/15", text: "text-status-warning", icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { bg: "bg-status-success/15", text: "text-status-success", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { bg: "bg-status-error/15", text: "text-status-error", icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { bg: "bg-muted", text: "text-muted-foreground", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export default function TimeOffPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"my" | "pending">("my");

  // Form state
  const [formType, setFormType] = useState<TimeOffType>("vacation");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formReason, setFormReason] = useState("");

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/time-off?campgroundId=${params.campgroundId}`);
      if (!res.ok) throw new Error("Failed to load");
      setRequests(await res.json());
    } catch (err) {
      setError("Could not load time-off requests. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [params.campgroundId]);

  const myRequests = useMemo(() => {
    if (!whoami?.user) return [];
    const currentUser = whoami.user as WhoamiUser | undefined;
    return requests.filter((r) => r.user?.id === currentUser?.id);
  }, [requests, whoami?.user]);

  const pendingRequests = useMemo(() => {
    return requests.filter((r) => r.status === "pending");
  }, [requests]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStartDate || !formEndDate) {
      setError("Please select start and end dates");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const currentUser = whoami?.user as WhoamiUser | undefined;
      const res = await fetch("/api/staff/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId: params.campgroundId,
          userId: currentUser?.id,
          type: formType,
          startDate: formStartDate,
          endDate: formEndDate,
          reason: formReason || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");

      setSuccessMessage("Time-off request submitted!");
      setTimeout(() => setSuccessMessage(null), 4000);
      setShowForm(false);
      setFormType("vacation");
      setFormStartDate("");
      setFormEndDate("");
      setFormReason("");
      await loadRequests();
    } catch (err) {
      setError("Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const reviewRequest = async (id: string, status: "approved" | "rejected") => {
    setProcessing((prev) => new Set([...prev, id]));
    try {
      const currentUser = whoami?.user as WhoamiUser | undefined;
      await fetch(`/api/staff/time-off/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewerId: currentUser?.id,
          status,
        }),
      });
      setSuccessMessage(status === "approved" ? "Request approved!" : "Request rejected.");
      setTimeout(() => setSuccessMessage(null), 3000);
      await loadRequests();
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (s.toDateString() === e.toDateString()) {
      return s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
    }
    return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${e.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  };

  const displayList = activeTab === "my" ? myRequests : pendingRequests;

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

        {/* Header with New Request Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Time Off</h1>
              <p className="text-sm text-muted-foreground">Request and manage time off</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(!showForm)}
            aria-expanded={showForm}
            aria-controls="timeoff-form"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            New Request
          </motion.button>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-800 underline text-xs font-medium">
              Dismiss
            </button>
          </motion.div>
        )}

        {/* New Request Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              id="timeoff-form"
              className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
            >
              <div className="bg-purple-50 border-b border-purple-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-foreground">Request Time Off</h2>
                <p className="text-sm text-muted-foreground">Select the type and dates for your time-off request</p>
              </div>

              <form onSubmit={submitRequest} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {TIME_OFF_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormType(type.value)}
                        aria-pressed={formType === type.value}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                          formType === type.value
                            ? "border-purple-500 bg-status-info/10 text-purple-700"
                            : "border-border hover:border-border text-foreground"
                        )}
                      >
                        <span>{type.icon}</span>
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="timeoff-start-date" className="block text-sm font-medium text-foreground mb-2">
                      Start Date
                    </Label>
                    <Input
                      id="timeoff-start-date"
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="timeoff-end-date" className="block text-sm font-medium text-foreground mb-2">
                      End Date
                    </Label>
                    <Input
                      id="timeoff-end-date"
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      min={formStartDate}
                      className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="timeoff-reason" className="block text-sm font-medium text-foreground mb-2">
                    Reason <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="timeoff-reason"
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    placeholder="Brief description..."
                    rows={2}
                    className="w-full border border-border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-600 text-white font-medium disabled:opacity-50 hover:bg-purple-700 transition-colors"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palmtree className="w-4 h-4" />}
                    Submit Request
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground font-medium hover:bg-muted/60 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.15 }}
          className="flex gap-2"
        >
          <button
            onClick={() => setActiveTab("my")}
            aria-pressed={activeTab === "my"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "my"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                : "bg-card border border-border text-muted-foreground hover:bg-muted/60"
            )}
          >
            <User className="w-4 h-4" />
            My Requests
            {myRequests.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-card/20 text-xs">{myRequests.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            aria-pressed={activeTab === "pending"}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
              activeTab === "pending"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                : "bg-card border border-border text-muted-foreground hover:bg-muted/60"
            )}
          >
            <Clock className="w-4 h-4" />
            Pending Review
            {pendingRequests.length > 0 && (
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-xs",
                activeTab === "pending" ? "bg-card/20" : "bg-status-warning/15 text-status-warning"
              )}>
                {pendingRequests.length}
              </span>
            )}
          </button>
        </motion.div>

        {/* Requests List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
          className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
        >
          <div className="bg-muted/60 border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {activeTab === "my" ? "Your Requests" : "Pending Requests"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "my" ? "View your time-off history" : "Review and approve requests"}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading requests...</span>
            </div>
          ) : displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {activeTab === "my" ? "No requests yet" : "All caught up!"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {activeTab === "my"
                  ? "Submit a time-off request using the button above."
                  : "No pending time-off requests to review."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <AnimatePresence mode="popLayout">
                {displayList.map((request, index) => {
                  const typeInfo = TIME_OFF_TYPES.find((t) => t.value === request.type);
                  const statusStyle = STATUS_STYLES[request.status];

                  return (
                    <motion.div
                      key={request.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ ...SPRING_CONFIG, delay: index * 0.03 }}
                      className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between hover:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                          {typeInfo?.icon || "📅"}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            {typeInfo?.label || request.type}
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                              statusStyle.bg,
                              statusStyle.text
                            )}>
                              {statusStyle.icon}
                              {request.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{formatDateRange(request.startDate, request.endDate)}</span>
                            {activeTab === "pending" && request.user && (
                              <>
                                <span>&middot;</span>
                                <span className="text-muted-foreground">
                                  {request.user.firstName || request.user.email.split("@")[0]}
                                </span>
                              </>
                            )}
                          </div>
                          {request.reason && (
                            <div className="text-xs text-muted-foreground mt-1">{request.reason}</div>
                          )}
                        </div>
                      </div>

                      {activeTab === "pending" && request.status === "pending" && (
                        <div className="flex items-center gap-2 md:flex-shrink-0">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={processing.has(request.id)}
                            onClick={() => reviewRequest(request.id, "approved")}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-status-success text-white text-sm font-medium disabled:opacity-50 hover:bg-status-success/90 transition-colors"
                          >
                            {processing.has(request.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Approve
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={processing.has(request.id)}
                            onClick={() => reviewRequest(request.id, "rejected")}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-status-error/30 text-status-error bg-status-error/15 text-sm font-medium disabled:opacity-50 hover:bg-status-error/25 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </motion.button>
                        </div>
                      )}

                      {request.status !== "pending" && request.reviewer && (
                        <div className="text-xs text-muted-foreground text-right">
                          {request.status === "approved" ? "Approved" : "Reviewed"} by{" "}
                          {request.reviewer.firstName || request.reviewer.email.split("@")[0]}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.25 }}
          className="bg-purple-50 rounded-xl border border-purple-200 p-5"
        >
          <div className="flex items-center gap-2 text-purple-700 text-sm font-medium mb-2">
            <Sparkles className="w-4 h-4" />
            Time Off Guidelines
          </div>
          <ul className="text-xs text-purple-800 space-y-1">
            <li>&bull; Submit requests at least 2 weeks in advance when possible</li>
            <li>&bull; Sick time can be requested retroactively</li>
            <li>&bull; Approved time off is automatically reflected in scheduling</li>
          </ul>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}
