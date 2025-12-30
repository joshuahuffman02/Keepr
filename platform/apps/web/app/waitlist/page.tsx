"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { PageSettingsLink } from "@/components/ui/PageSettingsLink";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WaitlistEntry {
  id: string;
  campgroundId: string;
  guestId: string | null;
  siteId: string | null;
  siteTypeId: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  status: "active" | "offered" | "converted" | "fulfilled" | "expired" | "cancelled";
  type: "regular" | "seasonal";
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  priority: number;
  autoOffer: boolean;
  maxPrice: number | null;
  flexibleDates: boolean;
  flexibleDays: number;
  notifiedCount: number;
  lastNotifiedAt: string | null;
  convertedReservationId: string | null;
  convertedAt: string | null;
  createdAt: string;
  guest?: {
    primaryFirstName: string | null;
    primaryLastName: string | null;
    email: string | null;
  } | null;
  site?: { siteNumber: string } | null;
  siteClass?: { name: string } | null;
}

interface WaitlistStats {
  active: number;
  offered: number;
  converted: number;
  expired: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  offered: "bg-amber-100 text-amber-800 border-amber-200",
  converted: "bg-blue-100 text-blue-800 border-blue-200",
  fulfilled: "bg-blue-100 text-blue-800 border-blue-200",
  expired: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

const PRIORITY_COLORS = [
  { min: 0, max: 30, color: "bg-slate-400", label: "Low" },
  { min: 31, max: 60, color: "bg-amber-400", label: "Medium" },
  { min: 61, max: 80, color: "bg-orange-500", label: "High" },
  { min: 81, max: 100, color: "bg-red-500", label: "Urgent" },
];

export default function WaitlistPage() {
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WaitlistEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const entriesQuery = useQuery({
    queryKey: ["waitlist", campgroundId, typeFilter],
    queryFn: () => apiClient.getWaitlist(campgroundId!, typeFilter === "all" ? undefined : typeFilter),
    enabled: !!campgroundId,
  });

  const statsQuery = useQuery({
    queryKey: ["waitlist-stats", campgroundId],
    queryFn: () => apiClient.getWaitlistStats(campgroundId!),
    enabled: !!campgroundId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteWaitlistEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["waitlist-stats"] });
    },
  });

  const normalizeStatus = (status: WaitlistEntry["status"]) => (status === "fulfilled" ? "converted" : status);
  const entries = ((entriesQuery.data ?? []) as WaitlistEntry[]).filter((e) =>
    statusFilter === "all" || normalizeStatus(e.status) === statusFilter
  );
  const stats = statsQuery.data as WaitlistStats | undefined;

  // Auto-switch from "active" to "all" only once when there are no active entries
  const hasAutoSwitchedRef = React.useRef(false);
  useEffect(() => {
    if (hasAutoSwitchedRef.current) return;
    if (!stats) return;
    if (statusFilter !== "active") return;
    if (stats.active === 0 && stats.total > 0) {
      hasAutoSwitchedRef.current = true;
      setStatusFilter("all");
    }
  }, [stats, statusFilter]);

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getPriorityInfo = (priority: number) => {
    return PRIORITY_COLORS.find(p => priority >= p.min && priority <= p.max) ?? PRIORITY_COLORS[0];
  };

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Select a campground to manage the waitlist</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8" data-testid="waitlist-header">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="waitlist-title">Waitlist Management</h1>
            <p className="text-slate-500 mt-1" data-testid="waitlist-subtitle">Manage guests waiting for availability</p>
          </div>
          <div className="flex items-center gap-3">
            <PageSettingsLink href="/settings/seasonal-rates" label="Rate Settings" />
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
              data-testid="waitlist-add-button"
            >
              <span>+</span> Add to Waitlist
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6" data-testid="waitlist-stats">
            <StatCard data-testid="waitlist-active" label="Active" value={stats.active} color="emerald" onClick={() => setStatusFilter("active")} active={statusFilter === "active"} />
            <StatCard data-testid="waitlist-offered" label="Offered" value={stats.offered} color="amber" onClick={() => setStatusFilter("offered")} active={statusFilter === "offered"} />
            <StatCard data-testid="waitlist-converted" label="Converted" value={stats.converted} color="blue" onClick={() => setStatusFilter("converted")} active={statusFilter === "converted"} />
            <StatCard data-testid="waitlist-expired" label="Expired" value={stats.expired} color="slate" onClick={() => setStatusFilter("expired")} active={statusFilter === "expired"} />
            <StatCard data-testid="waitlist-total" label="Total" value={stats.total} color="violet" onClick={() => setStatusFilter("all")} active={statusFilter === "all"} />
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-6" data-testid="waitlist-filters">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
            data-testid="waitlist-type-filter"
          >
            <option value="all">All Types</option>
            <option value="regular">Regular</option>
            <option value="seasonal">Seasonal</option>
          </select>
        </div>

        {/* Waitlist Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="waitlist-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Guest</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Dates</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Site Preference</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Priority</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Auto-Offer</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Notified</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entriesQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600 mx-auto" />
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400" data-testid="waitlist-empty">
                      No waitlist entries found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry: WaitlistEntry) => {
                    const priorityInfo = getPriorityInfo(entry.priority);
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50" data-testid="waitlist-row">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {entry.guest
                              ? `${entry.guest.primaryFirstName || ""} ${entry.guest.primaryLastName || ""}`.trim() || "Guest"
                              : entry.contactName || "Unknown"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {entry.guest?.email || entry.contactEmail || entry.contactPhone || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-900">{formatDate(entry.arrivalDate)}</div>
                          <div className="text-xs text-slate-500">→ {formatDate(entry.departureDate)}</div>
                          {entry.flexibleDates && (
                            <span className="text-xs text-amber-600">±{entry.flexibleDays} days</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entry.site ? (
                            <span className="text-slate-900">Site {entry.site.siteNumber}</span>
                          ) : entry.siteClass ? (
                            <span className="text-slate-700">{entry.siteClass.name}</span>
                          ) : (
                            <span className="text-slate-400">Any</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${priorityInfo.color}`} />
                            <span className="text-slate-700">{entry.priority}</span>
                            <span className="text-xs text-slate-500">({priorityInfo.label})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLORS[entry.status]}`}>
                            {normalizeStatus(entry.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.autoOffer ? (
                            <span className="text-emerald-600 font-medium">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                          {entry.maxPrice && (
                            <div className="text-xs text-slate-500">Max: ${(entry.maxPrice / 100).toFixed(0)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{entry.notifiedCount}x</div>
                          {entry.lastNotifiedAt && (
                            <div className="text-xs text-slate-500">{formatDate(entry.lastNotifiedAt)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingEntry(entry)}
                              className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs"
                            >
                              Edit
                            </button>
                            {entry.status === "active" && (
                              <button
                                onClick={() => setDeleteConfirmId(entry.id)}
                                className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded text-xs"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create/Edit Modal */}
        {(showCreateModal || editingEntry) && (
          <WaitlistModal
            campgroundId={campgroundId}
            entry={editingEntry}
            onClose={() => {
              setShowCreateModal(false);
              setEditingEntry(null);
            }}
            onSaved={() => {
              setShowCreateModal(false);
              setEditingEntry(null);
              queryClient.invalidateQueries({ queryKey: ["waitlist"] });
              queryClient.invalidateQueries({ queryKey: ["waitlist-stats"] });
            }}
          />
        )}

        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Waitlist</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove this entry from the waitlist?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmId) {
                    deleteMutation.mutate(deleteConfirmId);
                    setDeleteConfirmId(null);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "blue" | "slate" | "violet";
  onClick: () => void;
  active: boolean;
}) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-all ${colors[color]} ${active ? "ring-2 ring-offset-2 ring-slate-400" : "hover:shadow-sm"
        }`}
    >
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </button>
  );
}

function WaitlistModal({
  campgroundId,
  entry,
  onClose,
  onSaved,
}: {
  campgroundId: string;
  entry: WaitlistEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [contactName, setContactName] = useState(entry?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(entry?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(entry?.contactPhone ?? "");
  const [arrivalDate, setArrivalDate] = useState(entry?.arrivalDate?.split("T")[0] ?? "");
  const [departureDate, setDepartureDate] = useState(entry?.departureDate?.split("T")[0] ?? "");
  const [type, setType] = useState<"regular" | "seasonal">(entry?.type ?? "regular");
  const [priority, setPriority] = useState(entry?.priority ?? 50);
  const [autoOffer, setAutoOffer] = useState(entry?.autoOffer ?? false);
  const [maxPrice, setMaxPrice] = useState(entry?.maxPrice ? String(entry.maxPrice / 100) : "");
  const [flexibleDates, setFlexibleDates] = useState(entry?.flexibleDates ?? false);
  const [flexibleDays, setFlexibleDays] = useState(entry?.flexibleDays ?? 0);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        contactName,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        arrivalDate: arrivalDate || undefined,
        departureDate: departureDate || undefined,
        type,
        priority,
        autoOffer,
        maxPrice: maxPrice ? Math.round(parseFloat(maxPrice) * 100) : undefined,
        flexibleDates,
        flexibleDays,
        notes: notes || undefined,
      };

      if (entry) {
        await apiClient.updateWaitlistEntry(entry.id, payload);
      } else {
        await apiClient.createStaffWaitlistEntry({ campgroundId, ...payload });
      }
      onSaved();
    } catch (err) {
      console.error("Failed to save waitlist entry:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {entry ? "Edit Waitlist Entry" : "Add to Waitlist"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name *</label>
              <input
                type="text"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Arrival Date</label>
              <input
                type="date"
                value={arrivalDate}
                onChange={e => setArrivalDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departure Date</label>
              <input
                type="date"
                value={departureDate}
                onChange={e => setDepartureDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("regular")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${type === "regular"
                  ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300"
                  : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
              >
                Regular
              </button>
              <button
                type="button"
                onClick={() => setType("seasonal")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${type === "seasonal"
                  ? "bg-amber-100 text-amber-700 border-2 border-amber-300"
                  : "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
              >
                Seasonal
              </button>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Priority: {priority} ({getPriorityLabel(priority)})
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={priority}
              onChange={e => setPriority(parseInt(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>Low (0)</span>
              <span>Medium (50)</span>
              <span>Urgent (100)</span>
            </div>
          </div>

          {/* Auto-Offer */}
          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={autoOffer}
              onChange={e => setAutoOffer(e.target.checked)}
              className="rounded border-slate-300"
            />
            <div>
              <div className="font-medium text-slate-900">Auto-Offer</div>
              <div className="text-sm text-slate-500">Automatically reserve when a match is found</div>
            </div>
          </label>

          {/* Max Price */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Max Price Willing to Pay ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg"
              placeholder="Leave blank for no limit"
            />
          </div>

          {/* Flexible Dates */}
          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <input
              type="checkbox"
              checked={flexibleDates}
              onChange={e => setFlexibleDates(e.target.checked)}
              className="rounded border-slate-300"
            />
            <div className="flex-1">
              <div className="font-medium text-slate-900">Flexible Dates</div>
              <div className="text-sm text-slate-500">Accept dates within a range</div>
            </div>
            {flexibleDates && (
              <input
                type="number"
                min="0"
                max="14"
                value={flexibleDays}
                onChange={e => setFlexibleDays(parseInt(e.target.value) || 0)}
                className="w-16 px-2 py-1 border border-slate-200 rounded text-center"
              />
            )}
          </label>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none"
              placeholder="Special requests, preferences, etc."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !contactName}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : entry ? "Update" : "Add to Waitlist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getPriorityLabel(priority: number): string {
  if (priority <= 30) return "Low";
  if (priority <= 60) return "Medium";
  if (priority <= 80) return "High";
  return "Urgent";
}
