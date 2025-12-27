"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { StaffNavigation } from "@/components/staff/StaffNavigation";
import { useWhoami } from "@/hooks/use-whoami";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  User,
  Calendar,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  GripVertical,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Copy,
  Send,
  Loader2,
  Inbox,
  LayoutGrid,
  List,
  Filter,
  X,
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
  scheduledMinutes?: number | null;
  actualMinutes?: number | null;
};

type StaffRole = { id: string; code: string; name: string };
type StaffMember = { id: string; firstName?: string; lastName?: string; email?: string };

const STATUS_OPTIONS = ["all", "scheduled", "in_progress", "submitted", "approved", "rejected"];

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled: { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" },
  submitted: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
  approved: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  rejected: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

export default function StaffSchedulingPage({ params }: { params: { campgroundId: string } }) {
  const { data: whoami } = useWhoami();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [dragShiftId, setDragShiftId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Swap modal state
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [swapRecipientId, setSwapRecipientId] = useState("");
  const [swapNote, setSwapNote] = useState("");
  const [swapSubmitting, setSwapSubmitting] = useState(false);

  const currentUserId = whoami?.user?.id;

  // Staff selector state
  const [staffSearch, setStaffSearch] = useState("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

  const [form, setForm] = useState({
    userId: "",
    date: "",
    start: "09:00",
    end: "17:00",
    role: "",
  });

  // Selected staff display
  const selectedStaff = useMemo(() => staffMembers.find(s => s.id === form.userId), [staffMembers, form.userId]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staffMembers.slice(0, 10);
    const q = staffSearch.toLowerCase();
    return staffMembers.filter(s => {
      const name = `${s.firstName || ""} ${s.lastName || ""}`.toLowerCase();
      return name.includes(q) || (s.email || "").toLowerCase().includes(q);
    }).slice(0, 10);
  }, [staffMembers, staffSearch]);

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
      const [rolesRes, membersRes] = await Promise.all([
        fetch(`/api/staff/roles?campgroundId=${params.campgroundId}`),
        fetch(`/api/campgrounds/${params.campgroundId}/members`).catch(() => null)
      ]);

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data || []);
        if (!form.role && data?.length) {
          setForm((f) => ({ ...f, role: data[0].name }));
        }
      }

      if (membersRes?.ok) {
        const members = await membersRes.json();
        setStaffMembers((members || []).map((m: any) => ({
          id: m.userId || m.id,
          firstName: m.user?.firstName || m.firstName,
          lastName: m.user?.lastName || m.lastName,
          email: m.user?.email || m.email
        })));
      }
    } catch {
      // ignore load errors
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/staff/shifts?campgroundId=${params.campgroundId}&startDate=${windowStart.toISOString()}&endDate=${windowEnd.toISOString()}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`
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

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const createShift = async () => {
    setError(null);
    setSaving(true);
    try {
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
      showSuccess("Shift created successfully!");
      setForm({ ...form, date: "", userId: "" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const submitShift = async (id: string) => {
    setProcessing((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/staff/shifts/${id}/submit`, { method: "POST" });
      showSuccess("Shift submitted for approval");
      await load();
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
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
    setProcessing((prev) => new Set([...prev, shift.id]));
    try {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + deltaDays);
      await updateShift(shift.id, { shiftDate: date.toISOString().slice(0, 10) });
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(shift.id);
        return next;
      });
    }
  };

  const moveShiftTime = async (shift: Shift, deltaMinutes: number) => {
    const datePart = shift.shiftDate?.slice(0, 10);
    if (!datePart) return;
    setProcessing((prev) => new Set([...prev, shift.id]));
    try {
      const start = new Date(shift.startTime);
      const end = new Date(shift.endTime);
      start.setMinutes(start.getMinutes() + deltaMinutes);
      end.setMinutes(end.getMinutes() + deltaMinutes);
      await updateShift(shift.id, {
        shiftDate: datePart,
        startTime: start.toISOString().slice(11, 16),
        endTime: end.toISOString().slice(11, 16)
      });
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(shift.id);
        return next;
      });
    }
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
    showSuccess("Form prefilled from shift");
  };

  const approveShift = async (id: string) => {
    if (!currentUserId) {
      setError("You must be logged in to approve shifts");
      return;
    }

    setProcessing((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/staff/shifts/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: currentUserId })
      });
      showSuccess("Shift approved!");
      await load();
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const rejectShift = async (id: string) => {
    if (!currentUserId) {
      setError("You must be logged in to reject shifts");
      return;
    }

    setProcessing((prev) => new Set([...prev, id]));
    try {
      await fetch(`/api/staff/shifts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approverId: currentUserId })
      });
      showSuccess("Shift rejected");
      await load();
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const requestSwap = async () => {
    if (!swapShift || !swapRecipientId || !currentUserId) return;

    setSwapSubmitting(true);
    try {
      const res = await fetch("/api/staff/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId: params.campgroundId,
          requesterShiftId: swapShift.id,
          requesterId: currentUserId,
          recipientUserId: swapRecipientId,
          note: swapNote || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to request swap");
      showSuccess("Swap request sent!");
      setSwapShift(null);
      setSwapRecipientId("");
      setSwapNote("");
    } catch {
      setError("Could not send swap request. Please try again.");
    } finally {
      setSwapSubmitting(false);
    }
  };

  const openSwapModal = (shift: Shift) => {
    setSwapShift(shift);
    setSwapRecipientId("");
    setSwapNote("");
  };

  const closeSwapModal = () => {
    setSwapShift(null);
    setSwapRecipientId("");
    setSwapNote("");
  };

  // Filter out the current shift owner from swap recipients
  const swapRecipients = useMemo(() => {
    if (!swapShift) return [];
    return staffMembers.filter((s) => s.id !== swapShift.userId);
  }, [staffMembers, swapShift]);

  const formatDuration = (minutes?: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();
  };

  const durationMinutes = (shift: Shift) => {
    const start = shift.startTime ? new Date(shift.startTime).getTime() : null;
    const end = shift.endTime ? new Date(shift.endTime).getTime() : null;
    if (!start || !end) return 0;
    return Math.max(0, Math.round((end - start) / 60000));
  };

  const getStatusStyle = (status?: string) => {
    const s = status ?? "scheduled";
    return STATUS_COLORS[s] || STATUS_COLORS.scheduled;
  };

  const totalShiftsCount = shifts.length;
  const pendingApprovalCount = shifts.filter(s => s.status === "submitted").length;

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

        {/* Swap Request Modal */}
        <AnimatePresence>
          {swapShift && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
              onClick={closeSwapModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                        <ArrowLeftRight className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Request Shift Swap</h3>
                        <p className="text-sm text-slate-600">Find someone to take your shift</p>
                      </div>
                    </div>
                    <button
                      onClick={closeSwapModal}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Shift info */}
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="text-sm font-medium text-slate-500 mb-1">Shift to swap</div>
                    <div className="font-semibold text-slate-900">
                      {new Date(swapShift.shiftDate).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                    </div>
                    <div className="text-sm text-slate-600">
                      {new Date(swapShift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {new Date(swapShift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      {swapShift.role && <span className="ml-2 text-slate-400">({swapShift.role})</span>}
                    </div>
                  </div>

                  {/* Recipient selector */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Ask someone to take it
                    </label>
                    <select
                      value={swapRecipientId}
                      onChange={(e) => setSwapRecipientId(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    >
                      <option value="">Select a team member...</option>
                      {swapRecipients.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Note (optional)
                    </label>
                    <textarea
                      value={swapNote}
                      onChange={(e) => setSwapNote(e.target.value)}
                      placeholder="e.g., I have a doctor's appointment..."
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={closeSwapModal}
                      className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={requestSwap}
                      disabled={!swapRecipientId || swapSubmitting}
                      className={cn(
                        "flex-1 px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2",
                        "bg-violet-600 text-white hover:bg-violet-700",
                        (!swapRecipientId || swapSubmitting) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {swapSubmitting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ArrowLeftRight className="w-5 h-5" />
                      )}
                      Request Swap
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">This Window</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{totalShiftsCount}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-teal-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Total shifts scheduled</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approval</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{pendingApprovalCount}</div>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                pendingApprovalCount > 0 ? "bg-amber-100" : "bg-emerald-100"
              )}>
                {pendingApprovalCount > 0 ? (
                  <Clock className="w-6 h-6 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Awaiting manager review</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Staff Members</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{staffMembers.length}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <User className="w-6 h-6 text-slate-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Available to schedule</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conflicts</div>
                <div className="text-3xl font-bold text-slate-900 mt-1">{conflicts.size}</div>
              </div>
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                conflicts.size > 0 ? "bg-red-100" : "bg-emerald-100"
              )}>
                {conflicts.size > 0 ? (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">{conflicts.size > 0 ? "Overlapping shifts detected" : "No scheduling conflicts"}</p>
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Create Shift Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.15 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b border-teal-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Create Shift</h2>
                  <p className="text-sm text-slate-600">Schedule a new shift for staff</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Staff Member Selector */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Staff Member
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full pl-10 pr-10 rounded-lg border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
                    placeholder="Search staff..."
                    value={form.userId ? `${selectedStaff?.firstName || ""} ${selectedStaff?.lastName || ""}`.trim() || form.userId : staffSearch}
                    onChange={(e) => {
                      setStaffSearch(e.target.value);
                      setForm({ ...form, userId: "" });
                      setShowStaffDropdown(true);
                    }}
                    onFocus={() => setShowStaffDropdown(true)}
                  />
                  {form.userId && (
                    <button
                      type="button"
                      onClick={() => { setForm({ ...form, userId: "" }); setStaffSearch(""); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >×</button>
                  )}
                </div>
                <AnimatePresence>
                  {showStaffDropdown && !form.userId && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                    >
                      {filteredStaff.length > 0 ? filteredStaff.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, userId: s.id });
                            setShowStaffDropdown(false);
                            setStaffSearch("");
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 text-sm border-b last:border-b-0 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{s.firstName} {s.lastName}</div>
                            <div className="text-xs text-slate-500">{s.email}</div>
                          </div>
                        </button>
                      )) : (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          {staffMembers.length === 0 ? "No staff members found. Add members in Settings." : "No matching staff."}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
                <input
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>

              {/* Time Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Time</label>
                <div className="flex gap-2 items-center">
                  <input
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm({ ...form, start: e.target.value })}
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
                    type="time"
                    value={form.end}
                    onChange={(e) => setForm({ ...form, end: e.target.value })}
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
                <select
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition-shadow"
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
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving || !form.userId || !form.date}
                onClick={createShift}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-700 transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                <span>Create Shift</span>
              </motion.button>
            </div>
          </motion.div>

          {/* Calendar/List View */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_CONFIG, delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Shift Schedule</h2>
                    <p className="text-sm text-slate-600">
                      {windowStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — {windowEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* View Toggle */}
                  <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => setViewMode("calendar")}
                      className={cn(
                        "px-3 py-2 flex items-center gap-1.5 text-sm",
                        viewMode === "calendar" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span className="hidden sm:inline">Calendar</span>
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "px-3 py-2 flex items-center gap-1.5 text-sm border-l border-slate-200",
                        viewMode === "list" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <List className="w-4 h-4" />
                      <span className="hidden sm:inline">List</span>
                    </button>
                  </div>

                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <select
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s === "all" ? "All statuses" : s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Refresh */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={load}
                    disabled={loading}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                  </motion.button>

                  {/* Navigation */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setStartDay(new Date(windowStart.getTime() - 7 * 24 * 60 * 60 * 1000))}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setStartDay(new Date())}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setStartDay(new Date(windowStart.getTime() + 7 * 24 * 60 * 60 * 1000))}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : viewMode === "list" ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {shifts.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-16 text-center"
                      >
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Inbox className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">No shifts scheduled</h3>
                        <p className="text-sm text-slate-600 mt-1">Create a shift using the form on the left.</p>
                      </motion.div>
                    ) : (
                      shifts.map((shift, index) => (
                        <motion.div
                          key={shift.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ ...SPRING_CONFIG, delay: index * 0.03 }}
                          className={cn(
                            "rounded-xl border p-4 transition-colors",
                            conflicts.has(shift.id) ? "border-red-300 bg-red-50" : "border-slate-200 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-slate-500" />
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900">{shift.role || "Shift"}</div>
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>{new Date(shift.shiftDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                                  <span>·</span>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>
                                    {new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                  </span>
                                </div>
                                {(shift.scheduledMinutes || shift.actualMinutes) && (
                                  <div className="text-xs text-slate-500 mt-1">
                                    {shift.actualMinutes ? (
                                      <span className="text-emerald-600 font-medium">Actual: {formatDuration(shift.actualMinutes)}</span>
                                    ) : (
                                      <span>Scheduled: {formatDuration(shift.scheduledMinutes)}</span>
                                    )}
                                  </div>
                                )}
                                {conflicts.has(shift.id) && (
                                  <div className="flex items-center gap-1 text-xs text-red-600 font-medium mt-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Scheduling conflict
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                getStatusStyle(shift.status).bg,
                                getStatusStyle(shift.status).text
                              )}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", getStatusStyle(shift.status).dot)} />
                                {(shift.status ?? "scheduled").replace("_", " ")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                            {(shift.status === "scheduled" || shift.status === "in_progress") && (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                disabled={processing.has(shift.id)}
                                onClick={() => submitShift(shift.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 text-xs font-medium hover:bg-teal-200 transition-colors"
                              >
                                {processing.has(shift.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Submit
                              </motion.button>
                            )}
                            {shift.status === "submitted" && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  disabled={processing.has(shift.id)}
                                  onClick={() => approveShift(shift.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-medium hover:bg-emerald-200 transition-colors"
                                >
                                  {processing.has(shift.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  Approve
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  disabled={processing.has(shift.id)}
                                  onClick={() => rejectShift(shift.id)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors"
                                >
                                  Reject
                                </motion.button>
                              </>
                            )}
                            <button
                              onClick={() => duplicateToForm(shift)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Prefill
                            </button>
                            {shift.status === "scheduled" && shift.userId === currentUserId && (
                              <button
                                onClick={() => openSwapModal(shift)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium hover:bg-violet-200 transition-colors"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                                Swap
                              </button>
                            )}
                            <button
                              onClick={() => moveShiftByDays(shift, -1)}
                              disabled={processing.has(shift.id)}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                              -1d
                            </button>
                            <button
                              onClick={() => moveShiftByDays(shift, 1)}
                              disabled={processing.has(shift.id)}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-600 text-xs font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                              +1d
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {Object.keys(groupedByDay).length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="md:col-span-2 flex flex-col items-center justify-center py-16 text-center"
                      >
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Inbox className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">No shifts in this window</h3>
                        <p className="text-sm text-slate-600 mt-1">Create a shift or navigate to a different date range.</p>
                      </motion.div>
                    ) : (
                      Object.keys(groupedByDay)
                        .sort()
                        .map((day, dayIndex) => (
                          <motion.div
                            key={day}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ ...SPRING_CONFIG, delay: dayIndex * 0.05 }}
                            className="rounded-xl border border-slate-200 overflow-hidden"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropOnDay(day);
                            }}
                          >
                            <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-4 py-3 border-b border-slate-200">
                              <div className="flex items-center justify-between">
                                <div className="font-semibold text-slate-900">
                                  {new Date(day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                                </div>
                                <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-full">
                                  {groupedByDay[day].length} shift{groupedByDay[day].length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                                  <button
                                    key={h}
                                    className="rounded px-2 py-0.5 text-[10px] bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
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
                            </div>

                            <div className="p-3 space-y-2">
                              {groupedByDay[day].map((shift, index) => (
                                <motion.div
                                  key={shift.id}
                                  layout
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: index * 0.02 }}
                                  className={cn(
                                    "rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md",
                                    conflicts.has(shift.id) ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
                                  )}
                                  draggable
                                  onDragStart={() => handleDragStart(shift.id)}
                                  onDragEnd={() => setDragShiftId(null)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <GripVertical className="w-4 h-4 text-slate-300" />
                                      <div>
                                        <div className="font-medium text-slate-900 text-sm">{shift.role || "Shift"}</div>
                                        <div className="text-xs text-slate-600">
                                          {new Date(shift.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                        </div>
                                      </div>
                                    </div>
                                    <span className={cn(
                                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                                      getStatusStyle(shift.status).bg,
                                      getStatusStyle(shift.status).text
                                    )}>
                                      <span className={cn("w-1 h-1 rounded-full", getStatusStyle(shift.status).dot)} />
                                      {(shift.status ?? "scheduled").replace("_", " ")}
                                    </span>
                                  </div>

                                  {conflicts.has(shift.id) && (
                                    <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium mt-2">
                                      <AlertCircle className="w-3 h-3" />
                                      Conflict
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100 flex-wrap">
                                    {(shift.status === "scheduled" || shift.status === "in_progress") && (
                                      <button
                                        disabled={processing.has(shift.id)}
                                        onClick={() => submitShift(shift.id)}
                                        className="text-[10px] text-teal-700 font-medium hover:underline disabled:opacity-50"
                                      >
                                        Submit
                                      </button>
                                    )}
                                    {shift.status === "submitted" && (
                                      <>
                                        <button
                                          disabled={processing.has(shift.id)}
                                          onClick={() => approveShift(shift.id)}
                                          className="text-[10px] text-emerald-700 font-medium hover:underline disabled:opacity-50"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          disabled={processing.has(shift.id)}
                                          onClick={() => rejectShift(shift.id)}
                                          className="text-[10px] text-red-700 font-medium hover:underline disabled:opacity-50"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    <button
                                      onClick={() => duplicateToForm(shift)}
                                      className="text-[10px] text-slate-600 font-medium hover:underline"
                                    >
                                      Prefill
                                    </button>
                                    {shift.status === "scheduled" && shift.userId === currentUserId && (
                                      <button
                                        onClick={() => openSwapModal(shift)}
                                        className="text-[10px] text-violet-700 font-medium hover:underline"
                                      >
                                        Swap
                                      </button>
                                    )}
                                    <button
                                      disabled={processing.has(shift.id)}
                                      onClick={() => moveShiftByDays(shift, -1)}
                                      className="text-[10px] text-slate-600 font-medium hover:underline disabled:opacity-50"
                                    >
                                      -1d
                                    </button>
                                    <button
                                      disabled={processing.has(shift.id)}
                                      onClick={() => moveShiftByDays(shift, 1)}
                                      className="text-[10px] text-slate-600 font-medium hover:underline disabled:opacity-50"
                                    >
                                      +1d
                                    </button>
                                    <button
                                      disabled={processing.has(shift.id)}
                                      onClick={() => moveShiftTime(shift, -60)}
                                      className="text-[10px] text-slate-600 font-medium hover:underline disabled:opacity-50"
                                    >
                                      -1h
                                    </button>
                                    <button
                                      disabled={processing.has(shift.id)}
                                      onClick={() => moveShiftTime(shift, 60)}
                                      className="text-[10px] text-slate-600 font-medium hover:underline disabled:opacity-50"
                                    >
                                      +1h
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        ))
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </DashboardShell>
  );
}
