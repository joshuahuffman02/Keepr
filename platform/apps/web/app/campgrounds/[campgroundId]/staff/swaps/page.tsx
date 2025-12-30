"use client";

import { useEffect, useState, useMemo } from "react";
import { useWhoami } from "@/hooks/use-whoami";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  User,
  Calendar,
  Sparkles,
  Inbox,
  ArrowRight,
  UserCheck,
  Shield,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SwapStatus = "pending_recipient" | "pending_manager" | "approved" | "rejected" | "declined" | "cancelled";

type SwapRequest = {
  id: string;
  status: SwapStatus;
  requesterNote?: string | null;
  recipientNote?: string | null;
  managerNote?: string | null;
  createdAt: string;
  recipientRespondedAt?: string | null;
  managerRespondedAt?: string | null;
  requester?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  recipient?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  manager?: {
    id: string;
    firstName?: string;
    lastName?: string;
  } | null;
  requesterShift?: {
    id: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    role?: string | null;
  };
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

const STATUS_STYLES: Record<SwapStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  pending_recipient: { bg: "bg-status-warning/15", text: "text-status-warning", icon: <Clock className="w-3.5 h-3.5" />, label: "Awaiting Response" },
  pending_manager: { bg: "bg-status-info/15", text: "text-status-info", icon: <Shield className="w-3.5 h-3.5" />, label: "Awaiting Manager" },
  approved: { bg: "bg-status-success/15", text: "text-status-success", icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Approved" },
  rejected: { bg: "bg-status-error/15", text: "text-status-error", icon: <XCircle className="w-3.5 h-3.5" />, label: "Rejected" },
  declined: { bg: "bg-slate-100", text: "text-slate-500", icon: <XCircle className="w-3.5 h-3.5" />, label: "Declined" },
  cancelled: { bg: "bg-slate-100", text: "text-slate-500", icon: <X className="w-3.5 h-3.5" />, label: "Cancelled" },
};

export default function ShiftSwapsPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"all" | "incoming" | "outgoing" | "manager">("all");

  const loadSwaps = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/swaps?campgroundId=${params.campgroundId}`);
      if (!res.ok) throw new Error("Failed to load");
      setSwaps(await res.json());
    } catch {
      setError("Could not load swap requests. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSwaps();
  }, [params.campgroundId]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const userId = whoami?.user?.id;
  const ownershipRoles = whoami?.user?.ownershipRoles ?? [];
  const membership = whoami?.user?.memberships?.find((m: any) => m.campgroundId === params.campgroundId);
  const isManager = ownershipRoles.includes("owner") || ownershipRoles.includes("admin") || membership?.role === "owner" || membership?.role === "admin";

  const filteredSwaps = useMemo(() => {
    if (!userId) return swaps;
    switch (activeTab) {
      case "incoming":
        return swaps.filter((s) => s.recipient?.id === userId);
      case "outgoing":
        return swaps.filter((s) => s.requester?.id === userId);
      case "manager":
        return swaps.filter((s) => s.status === "pending_manager");
      default:
        return swaps;
    }
  }, [swaps, activeTab, userId]);

  const pendingIncoming = useMemo(() => {
    return swaps.filter((s) => s.recipient?.id === userId && s.status === "pending_recipient").length;
  }, [swaps, userId]);

  const pendingManager = useMemo(() => {
    return swaps.filter((s) => s.status === "pending_manager").length;
  }, [swaps]);

  const handleRespond = async (swapId: string, accept: boolean) => {
    if (!userId) return;
    setProcessing((prev) => new Set(prev).add(swapId));
    try {
      const res = await fetch(`/api/staff/swaps/${swapId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: userId, accept }),
      });
      if (!res.ok) throw new Error("Failed to respond");
      setSuccessMessage(accept ? "Swap accepted! Awaiting manager approval." : "Swap declined.");
      await loadSwaps();
    } catch {
      setError("Could not process response. Please try again.");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(swapId);
        return next;
      });
    }
  };

  const handleManagerDecision = async (swapId: string, approve: boolean) => {
    if (!userId) return;
    setProcessing((prev) => new Set(prev).add(swapId));
    try {
      const res = await fetch(`/api/staff/swaps/${swapId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: userId, approve }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      setSuccessMessage(approve ? "Shift swap approved!" : "Shift swap rejected.");
      await loadSwaps();
    } catch {
      setError("Could not process decision. Please try again.");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(swapId);
        return next;
      });
    }
  };

  const handleCancel = async (swapId: string) => {
    if (!userId) return;
    setProcessing((prev) => new Set(prev).add(swapId));
    try {
      const res = await fetch(`/api/staff/swaps/${swapId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: userId }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      setSuccessMessage("Swap request cancelled.");
      await loadSwaps();
    } catch {
      setError("Could not cancel. Please try again.");
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(swapId);
        return next;
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const tabs = [
    { id: "all" as const, label: "All Swaps" },
    { id: "incoming" as const, label: "Incoming", badge: pendingIncoming },
    { id: "outgoing" as const, label: "My Requests" },
    ...(isManager ? [{ id: "manager" as const, label: "Manager Queue", badge: pendingManager }] : []),
  ];

  return (
    <DashboardShell>
      <StaffNavigation campgroundId={params.campgroundId} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <ArrowLeftRight className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Shift Swaps</h1>
              <p className="text-slate-600">Trade shifts with your coworkers</p>
            </div>
          </div>
        </motion.div>

        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-6 p-4 bg-status-success/15 border border-status-success/30 rounded-xl flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5 text-status-success" />
              <span className="text-status-success">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
          >
            {error}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-violet-100 text-violet-700"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {tab.label}
              {tab.badge && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
          </div>
        ) : filteredSwaps.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Inbox className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No swap requests</h3>
            <p className="text-slate-500">
              {activeTab === "incoming"
                ? "No one has requested to swap shifts with you yet"
                : activeTab === "outgoing"
                ? "You haven't requested any shift swaps"
                : activeTab === "manager"
                ? "No swaps awaiting your approval"
                : "No shift swap requests yet"}
            </p>
            <p className="text-sm text-slate-400 mt-2">
              To request a swap, go to the schedule and click on your shift
            </p>
          </motion.div>
        ) : (
          <motion.div layout className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredSwaps.map((swap, idx) => {
                const status = STATUS_STYLES[swap.status];
                const isProcessing = processing.has(swap.id);
                const canRespond = swap.recipient?.id === userId && swap.status === "pending_recipient";
                const canApprove = isManager && swap.status === "pending_manager";
                const canCancel =
                  swap.requester?.id === userId &&
                  (swap.status === "pending_recipient" || swap.status === "pending_manager");

                return (
                  <motion.div
                    key={swap.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ ...SPRING_CONFIG, delay: idx * 0.05 }}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        {/* Requester */}
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                            {swap.requester?.firstName?.[0] || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {swap.requester?.firstName} {swap.requester?.lastName}
                            </p>
                            <p className="text-xs text-slate-500">Requesting swap</p>
                          </div>
                        </div>

                        <ArrowRight className="w-5 h-5 text-slate-400" />

                        {/* Recipient */}
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-semibold">
                            {swap.recipient?.firstName?.[0] || "?"}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {swap.recipient?.firstName} {swap.recipient?.lastName}
                            </p>
                            <p className="text-xs text-slate-500">Would take shift</p>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          status.bg,
                          status.text
                        )}
                      >
                        {status.icon}
                        {status.label}
                      </span>
                    </div>

                    {/* Shift Details */}
                    {swap.requesterShift && (
                      <div className="mb-4 p-3 bg-slate-50 rounded-lg flex items-center gap-4">
                        <Calendar className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">
                            {formatDate(swap.requesterShift.shiftDate)}
                          </p>
                          <p className="text-sm text-slate-600">
                            {formatTime(swap.requesterShift.startTime)} - {formatTime(swap.requesterShift.endTime)}
                            {swap.requesterShift.role && (
                              <span className="ml-2 text-slate-400">({swap.requesterShift.role})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {swap.requesterNote && (
                      <p className="text-sm text-slate-600 mb-4">
                        <span className="font-medium">Note:</span> {swap.requesterNote}
                      </p>
                    )}

                    {/* Actions */}
                    {(canRespond || canApprove || canCancel) && (
                      <div className="flex gap-2 pt-3 border-t border-slate-100">
                        {canRespond && (
                          <>
                            <button
                              onClick={() => handleRespond(swap.id, true)}
                              disabled={isProcessing}
                              className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                "bg-status-success text-white hover:bg-status-success/90",
                                isProcessing && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              Accept Swap
                            </button>
                            <button
                              onClick={() => handleRespond(swap.id, false)}
                              disabled={isProcessing}
                              className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                "bg-slate-100 text-slate-700 hover:bg-slate-200",
                                isProcessing && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <XCircle className="w-4 h-4" />
                              Decline
                            </button>
                          </>
                        )}
                        {canApprove && (
                          <>
                            <button
                              onClick={() => handleManagerDecision(swap.id, true)}
                              disabled={isProcessing}
                              className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                "bg-status-success text-white hover:bg-status-success/90",
                                isProcessing && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                              Approve Swap
                            </button>
                            <button
                              onClick={() => handleManagerDecision(swap.id, false)}
                              disabled={isProcessing}
                              className={cn(
                                "flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                                "bg-status-error/15 text-status-error hover:bg-status-error/25",
                                isProcessing && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </button>
                          </>
                        )}
                        {canCancel && !canRespond && !canApprove && (
                          <button
                            onClick={() => handleCancel(swap.id)}
                            disabled={isProcessing}
                            className={cn(
                              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                              "bg-slate-100 text-slate-700 hover:bg-slate-200",
                              isProcessing && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                            Cancel Request
                          </button>
                        )}
                      </div>
                    )}

                    {/* Manager decision info */}
                    {swap.manager && swap.managerRespondedAt && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-slate-500">
                        <span className="font-medium">{swap.manager.firstName} {swap.manager.lastName}</span>{" "}
                        {swap.status === "approved" ? "approved" : "rejected"} on{" "}
                        {formatDate(swap.managerRespondedAt)}
                        {swap.managerNote && <span className="block italic mt-1">"{swap.managerNote}"</span>}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </DashboardShell>
  );
}
