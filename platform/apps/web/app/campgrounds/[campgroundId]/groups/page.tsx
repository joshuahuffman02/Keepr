"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { apiClient } from "../../../../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { format } from "date-fns";
import {
  Users,
  Plus,
  ChevronRight,
  Calendar,
  DollarSign,
  MessageSquare,
  Lock,
  Unlock,
  Trash2,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";

function formatDate(d?: string | Date | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? "—" : format(date, "MMM d, yyyy");
}

export default function GroupsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const campgroundId = params.campgroundId as string;

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newBlock, setNewBlock] = useState({
    siteIds: [] as string[],
    windowStart: "",
    windowEnd: "",
    reason: "group_hold",
  });
  const [newGroup, setNewGroup] = useState({
    name: "",
    sharedPayment: false,
    sharedComm: true,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ["groups", campgroundId],
    queryFn: () => apiClient.getGroups(campgroundId),
    enabled: !!campgroundId,
  });

  const selectedGroupQuery = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: () => apiClient.getGroup(selectedGroupId!),
    enabled: !!selectedGroupId,
  });

  const blocksQuery = useQuery({
    queryKey: ["blocks", campgroundId],
    queryFn: () => apiClient.listBlocks(campgroundId),
    enabled: !!campgroundId,
  });

  const releaseBlockMutation = useMutation({
    mutationFn: (blockId: string) => apiClient.releaseBlock(blockId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks", campgroundId] });
    },
  });

  const createBlockMutation = useMutation({
    mutationFn: (payload: {
      tenantId: string;
      sites: string[];
      windowStart: string;
      windowEnd: string;
      reason: string;
      lockId: string;
      createdBy: string;
    }) => apiClient.createBlock(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocks", campgroundId] });
      setShowBlockModal(false);
      setNewBlock({ siteIds: [], windowStart: "", windowEnd: "", reason: "group_hold" });
    },
  });

  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
    enabled: !!campgroundId,
  });
  const sites = sitesQuery.data || [];

  const createGroupMutation = useMutation({
    mutationFn: (payload: {
      sharedPayment?: boolean;
      sharedComm?: boolean;
    }) => apiClient.createGroup(campgroundId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", campgroundId] });
      setShowGroupModal(false);
      setNewGroup({ name: "", sharedPayment: false, sharedComm: true });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiClient.deleteGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", campgroundId] });
      setSelectedGroupId(null);
    },
  });

  const groups = groupsQuery.data || [];
  const blocks = blocksQuery.data || [];
  const selectedGroup = selectedGroupQuery.data;

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: `Campground ${campgroundId}`, href: `/campgrounds/${campgroundId}` },
            { label: "Groups & Blocks" },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Groups & Blocks</h1>
            <p className="text-sm text-slate-500">
              Manage group bookings and inventory blocks
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowBlockModal(true)}>
              <Lock className="h-4 w-4 mr-1" />
              New Block
            </Button>
            <Button size="sm" onClick={() => setShowGroupModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Group
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Groups List */}
          <div className="md:col-span-1 space-y-3">
            <h2 className="font-semibold text-slate-700">Groups</h2>
            {groupsQuery.isLoading ? (
              <div className="text-sm text-slate-500">Loading...</div>
            ) : groups.length === 0 ? (
              <Card className="p-4 text-center text-sm text-slate-500">
                No groups yet. Create one to link reservations.
              </Card>
            ) : (
              groups.map((group: any) => (
                <Card
                  key={group.id}
                  className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${selectedGroupId === group.id ? "ring-2 ring-blue-500" : ""
                    }`}
                  onClick={() => setSelectedGroupId(group.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-sm">
                        Group {group.id.slice(-6)}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">
                      {group.reservationCount || 0} reservations
                    </Badge>
                    {group.sharedPayment && (
                      <Badge variant="outline" className="text-emerald-700 border-emerald-200">
                        <DollarSign className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    )}
                    {group.sharedComm && (
                      <Badge variant="outline" className="text-blue-700 border-blue-200">
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Group Detail */}
          <div className="md:col-span-2">
            {selectedGroupId && selectedGroup ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Group Details
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteGroupMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500">Group ID</div>
                      <div className="font-mono text-xs">{selectedGroup.id}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Settings</div>
                      <div className="flex gap-2 mt-1">
                        <Badge variant={selectedGroup.sharedPayment ? "default" : "secondary"}>
                          {selectedGroup.sharedPayment ? "Shared Payment" : "Separate Payment"}
                        </Badge>
                        <Badge variant={selectedGroup.sharedComm ? "default" : "secondary"}>
                          {selectedGroup.sharedComm ? "Shared Comms" : "Separate Comms"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-500 mb-2">Linked Reservations</div>
                    {selectedGroup.reservations?.length === 0 ? (
                      <div className="text-sm text-slate-500">No reservations linked.</div>
                    ) : (
                      <div className="space-y-2">
                        {selectedGroup.reservations?.map((res: any) => (
                          <div
                            key={res.id}
                            className="flex items-center justify-between p-2 border border-slate-200 rounded text-sm"
                          >
                            <div>
                              <div className="font-medium">
                                {res.guest?.firstName} {res.guest?.lastName}
                              </div>
                              <div className="text-xs text-slate-500">
                                {res.site?.name} #{res.site?.siteNumber} •{" "}
                                {formatDate(res.arrivalDate)} → {formatDate(res.departureDate)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  res.groupRole === "primary"
                                    ? "bg-blue-50 text-blue-700"
                                    : ""
                                }
                              >
                                {res.groupRole || "member"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  res.status === "confirmed"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : res.status === "cancelled"
                                      ? "bg-rose-50 text-rose-700"
                                      : ""
                                }
                              >
                                {res.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-8 text-center text-slate-500">
                Select a group to view details
              </Card>
            )}
          </div>
        </div>

        {/* Inventory Blocks Section */}
        <div className="mt-8">
          <h2 className="font-semibold text-slate-700 mb-3">Inventory Blocks</h2>
          {blocksQuery.isLoading ? (
            <div className="text-sm text-slate-500">Loading blocks...</div>
          ) : blocks.length === 0 ? (
            <Card className="p-4 text-center text-sm text-slate-500">
              No inventory blocks. Create one to hold sites for groups or maintenance.
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-3">
              {blocks.map((block: any) => (
                <Card key={block.blockId} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {block.state === "active" ? (
                        <Lock className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Unlock className="h-4 w-4 text-slate-400" />
                      )}
                      <span className="font-medium text-sm">{block.reason}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        block.state === "active"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-50 text-slate-600"
                      }
                    >
                      {block.state}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(block.windowStart)} → {formatDate(block.windowEnd)}
                    </div>
                    <div>
                      {Array.isArray(block.sites) ? block.sites.length : 0} site(s) blocked
                    </div>
                  </div>
                  {block.state === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 w-full"
                      onClick={() => releaseBlockMutation.mutate(block.blockId)}
                      disabled={releaseBlockMutation.isPending}
                    >
                      <Unlock className="h-3 w-3 mr-1" />
                      Release Block
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Create Block Modal */}
        {showBlockModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Create Inventory Block
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowBlockModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Sites</label>
                  <div className="mt-1 max-h-40 overflow-auto border border-slate-200 rounded p-2 space-y-1">
                    {sites.map((site: any) => (
                      <label key={site.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newBlock.siteIds.includes(site.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewBlock({
                                ...newBlock,
                                siteIds: [...newBlock.siteIds, site.id],
                              });
                            } else {
                              setNewBlock({
                                ...newBlock,
                                siteIds: newBlock.siteIds.filter((id) => id !== site.id),
                              });
                            }
                          }}
                          className="rounded border-slate-300"
                        />
                        {site.name} #{site.siteNumber}
                      </label>
                    ))}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {newBlock.siteIds.length} site(s) selected
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Start Date</label>
                    <input
                      type="date"
                      value={newBlock.windowStart}
                      onChange={(e) =>
                        setNewBlock({ ...newBlock, windowStart: e.target.value })
                      }
                      className="w-full mt-1 border border-slate-200 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">End Date</label>
                    <input
                      type="date"
                      value={newBlock.windowEnd}
                      onChange={(e) =>
                        setNewBlock({ ...newBlock, windowEnd: e.target.value })
                      }
                      className="w-full mt-1 border border-slate-200 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Reason</label>
                  <select
                    value={newBlock.reason}
                    onChange={(e) => setNewBlock({ ...newBlock, reason: e.target.value })}
                    className="w-full mt-1 border border-slate-200 rounded px-3 py-2"
                  >
                    <option value="group_hold">Group Hold</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowBlockModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={
                      newBlock.siteIds.length === 0 ||
                      !newBlock.windowStart ||
                      !newBlock.windowEnd ||
                      createBlockMutation.isPending
                    }
                    onClick={() =>
                      createBlockMutation.mutate({
                        tenantId: campgroundId,
                        sites: newBlock.siteIds,
                        windowStart: newBlock.windowStart,
                        windowEnd: newBlock.windowEnd,
                        reason: newBlock.reason,
                        lockId: crypto.randomUUID(),
                        createdBy: "staff",
                      })
                    }
                  >
                    {createBlockMutation.isPending ? "Creating..." : "Create Block"}
                  </Button>
                </div>

                {createBlockMutation.isError && (
                  <div className="text-sm text-rose-600 bg-rose-50 p-2 rounded">
                    Failed to create block. Sites may have conflicts.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create Group Modal */}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Create Group Booking
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowGroupModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-500">
                  Create a group to link multiple reservations together. You can link existing
                  reservations after the group is created.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border border-slate-200 rounded">
                    <div>
                      <div className="font-medium text-sm">Shared Payment</div>
                      <div className="text-xs text-slate-500">
                        One guest pays for all reservations in the group
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={newGroup.sharedPayment}
                      onChange={(e) =>
                        setNewGroup({ ...newGroup, sharedPayment: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border border-slate-200 rounded">
                    <div>
                      <div className="font-medium text-sm">Shared Communications</div>
                      <div className="text-xs text-slate-500">
                        Send group-wide emails and updates
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={newGroup.sharedComm}
                      onChange={(e) =>
                        setNewGroup({ ...newGroup, sharedComm: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowGroupModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={createGroupMutation.isPending}
                    onClick={() =>
                      createGroupMutation.mutate({
                        sharedPayment: newGroup.sharedPayment,
                        sharedComm: newGroup.sharedComm,
                      })
                    }
                  >
                    {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                  </Button>
                </div>

                {createGroupMutation.isError && (
                  <div className="text-sm text-rose-600 bg-rose-50 p-2 rounded">
                    Failed to create group. Please try again.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delete Group Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Group</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this group? Reservations will be unlinked from the group.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (selectedGroupId) {
                    deleteGroupMutation.mutate(selectedGroupId);
                  }
                  setShowDeleteConfirm(false);
                }}
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
