"use client";

import { useEffect, useState, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
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
import Link from "next/link";
import { InlineEmpty } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

interface GroupSummary {
  id: string;
  tenantId: string;
  sharedPayment: boolean;
  sharedComm: boolean;
  primaryReservationId: string | null;
  reservationCount: number;
  createdAt: string;
  updatedAt: string;
}

interface GroupDetail {
  id: string;
  tenantId: string;
  sharedPayment: boolean;
  sharedComm: boolean;
  primaryReservationId: string | null;
  createdAt: string;
  updatedAt: string;
  reservations: Array<{
    id: string;
    groupRole: "primary" | "member" | null;
    arrivalDate: string;
    departureDate: string;
    status: string;
    guestId: string;
    siteId: string;
    guest: {
      id: string;
      primaryFirstName: string | null;
      primaryLastName: string | null;
      email: string | null;
    } | null;
    site: {
      id: string;
      name: string;
      siteNumber: string;
    } | null;
  }>;
}

export default function GroupsPage() {
  const [selectedCampground, setSelectedCampground] = useState<{ id: string; name?: string | null } | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Fallback: hydrate selected campground from localStorage (DashboardShell writes campreserv:selectedCampground)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      setSelectedCampground(stored ? { id: stored } : null);
    };
    load();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "campreserv:selectedCampground") load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const loadGroups = useCallback(async () => {
    if (!selectedCampground) return;
    try {
      setLoading(true);
      const data = await apiClient.getGroups(selectedCampground.id);
      setGroups(data);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCampground]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const loadGroupDetail = async (id: string) => {
    try {
      const data = await apiClient.getGroup(id);
      setSelectedGroup(data);
    } catch (err) {
      console.error("Failed to load group:", err);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiClient.deleteGroup(deleteConfirmId);
      setSelectedGroup(null);
      setDeleteConfirmId(null);
      loadGroups();
    } catch (err) {
      console.error("Failed to delete group:", err);
      setDeleteConfirmId(null);
    }
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!selectedCampground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <p className="text-slate-500">Select a campground to view groups</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Group Bookings</h1>
            <p className="text-slate-500 mt-1">Manage linked reservations for families, events, and group stays</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <span>+</span> New Group
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Groups List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">All Groups ({groups.length})</h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
                  </div>
                ) : groups.length === 0 ? (
                  <InlineEmpty className="py-8">
                    No groups created yet. Create a group to link reservations together.
                  </InlineEmpty>
                ) : (
                  groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => loadGroupDetail(group.id)}
                      className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedGroup?.id === group.id ? "bg-indigo-50 border-l-2 border-indigo-500" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900">
                            Group #{group.id.slice(0, 8)}
                          </div>
                          <div className="text-sm text-slate-500">
                            {group.reservationCount} reservation{group.reservationCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {group.sharedPayment && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">Shared Pay</span>
                          )}
                          {group.sharedComm && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Shared Comm</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Group Detail */}
          <div className="lg:col-span-2">
            {selectedGroup ? (
              <div className="bg-white rounded-xl border border-slate-200">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Group #{selectedGroup.id.slice(0, 8)}</h3>
                    <p className="text-sm text-slate-500">Created {formatDate(selectedGroup.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(selectedGroup.id)}
                      className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                    >
                      Delete Group
                    </button>
                  </div>
                </div>

                {/* Settings */}
                <div className="px-6 py-4 border-b border-slate-100 flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGroup.sharedPayment}
                      onChange={async (e) => {
                        await apiClient.updateGroup(selectedGroup.id, { sharedPayment: e.target.checked });
                        loadGroupDetail(selectedGroup.id);
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Shared Payment</span>
                    <span className="text-xs text-slate-400">(One invoice for all)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGroup.sharedComm}
                      onChange={async (e) => {
                        await apiClient.updateGroup(selectedGroup.id, { sharedComm: e.target.checked });
                        loadGroupDetail(selectedGroup.id);
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">Shared Communications</span>
                    <span className="text-xs text-slate-400">(Primary contact only)</span>
                  </label>
                </div>

                {/* Reservations */}
                <div className="p-6">
                  <h4 className="font-medium text-slate-800 mb-4">Linked Reservations</h4>
                  {selectedGroup.reservations.length === 0 ? (
                    <InlineEmpty className="py-8 bg-muted rounded-lg">
                      No reservations linked to this group yet.
                    </InlineEmpty>
                  ) : (
                    <div className="space-y-3">
                      {selectedGroup.reservations.map(res => (
                        <div
                          key={res.id}
                          className={`p-4 rounded-lg border ${
                            res.groupRole === "primary"
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {res.guest?.primaryFirstName} {res.guest?.primaryLastName || "Guest"}
                                </span>
                                {res.groupRole === "primary" && (
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                    Primary
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-500 mt-1">
                                Site {res.site?.siteNumber} • {formatDate(res.arrivalDate)} → {formatDate(res.departureDate)}
                              </div>
                              {res.guest?.email && (
                                <div className="text-xs text-slate-400 mt-1">{res.guest.email}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                res.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                                res.status === "checked_in" ? "bg-blue-100 text-blue-700" :
                                "bg-slate-100 text-slate-600"
                              }`}>
                                {res.status}
                              </span>
                              <Link
                                href={`/reservations/${res.id}`}
                                className="text-indigo-600 hover:text-indigo-700 text-sm"
                              >
                                View →
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center h-[400px]">
                <div className="text-center text-slate-400">
                  <div className="text-4xl mb-3 text-slate-300">Groups</div>
                  <p>Select a group to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Group Modal */}
        {showCreateModal && (
          <CreateGroupModal
            campgroundId={selectedCampground.id}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false);
              loadGroups();
            }}
          />
        )}

        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this group? Reservations will be unlinked but not deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteGroup}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Group
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardShell>
  );
}

function CreateGroupModal({
  campgroundId,
  onClose,
  onCreated,
}: {
  campgroundId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [sharedPayment, setSharedPayment] = useState(false);
  const [sharedComm, setSharedComm] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.createGroup(campgroundId, {
        sharedPayment,
        sharedComm,
      });
      onCreated();
    } catch (err) {
      console.error("Failed to create group:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Create Group</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={sharedPayment}
                onChange={e => setSharedPayment(e.target.checked)}
                className="rounded border-slate-300"
              />
              <div>
                <div className="font-medium text-slate-900">Shared Payment</div>
                <div className="text-sm text-slate-500">Primary guest pays for all reservations</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={sharedComm}
                onChange={e => setSharedComm(e.target.checked)}
                className="rounded border-slate-300"
              />
              <div>
                <div className="font-medium text-slate-900">Shared Communications</div>
                <div className="text-sm text-slate-500">Only primary guest receives emails/texts</div>
              </div>
            </label>
          </div>

          <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
            Tip: After creating, you can link existing reservations to this group from the reservation detail page.
          </p>

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
              disabled={saving}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

