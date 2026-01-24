"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import {
  Communication,
  CommunicationPlaybook,
  CommunicationPlaybookJob,
  Reservation,
} from "@keepr/shared";
import { cn } from "@/lib/utils";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { ReservationHeader } from "@/components/reservations/ReservationHeader";
import { GuestCard } from "@/components/reservations/GuestCard";
import { StayDetails } from "@/components/reservations/StayDetails";
import { FinancialSummary } from "@/components/reservations/FinancialSummary";
import { ReservationTimeline } from "@/components/reservations/ReservationTimeline";
import { MessagesPanel } from "@/components/reservations/MessagesPanel";
import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  GitBranch,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  PlusCircle,
  RotateCcw,
  StickyNote,
  PhoneCall,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeletons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckInCelebrationDialog } from "@/components/reservations/CheckInCelebrationDialog";

type CommTypeFilter = "all" | "email" | "sms" | "automation";
type CommDirectionFilter = "all" | "outbound" | "inbound";
type CommStatusFilter =
  | "all"
  | "sent"
  | "delivered"
  | "pending"
  | "failed"
  | "bounce"
  | "complaint";
type ComposeType = "email" | "sms" | "note" | "call";
type ComposeDirection = "inbound" | "outbound";
type GroupRole = "primary" | "member";
type CommunicationsPage = Awaited<ReturnType<typeof apiClient.listCommunications>>;
type ReservationWithGroup = Reservation & {
  groupId?: string | null;
  groupRole?: GroupRole | null;
};
type GroupSummary = Awaited<ReturnType<typeof apiClient.getGroups>>[number];
type TimelineCommunication = {
  kind: "communication";
  id: string;
  date?: string | null;
  type: Communication["type"];
  direction: Communication["direction"];
  subject?: string | null;
  body?: string | null;
  status?: string | null;
  provider?: string | null;
  toAddress?: string | null;
  fromAddress?: string | null;
};
type TimelinePlaybook = {
  kind: "playbook";
  id: string;
  date?: string | null;
  status?: string | null;
  name: string;
  attempts?: number | null;
  lastError?: string | null;
};
type TimelineItem = TimelineCommunication | TimelinePlaybook;

const commTypeFilters: CommTypeFilter[] = ["all", "email", "sms", "automation"];
const commDirectionFilters: CommDirectionFilter[] = ["all", "outbound", "inbound"];
const commStatusFilters: CommStatusFilter[] = [
  "all",
  "sent",
  "delivered",
  "pending",
  "failed",
  "bounce",
  "complaint",
];
const composeTypes: ComposeType[] = ["email", "sms", "note", "call"];
const composeDirections: ComposeDirection[] = ["inbound", "outbound"];
const groupRoles: GroupRole[] = ["primary", "member"];

const isCommTypeFilter = (value: string): value is CommTypeFilter =>
  commTypeFilters.some((filter) => filter === value);
const isCommDirectionFilter = (value: string): value is CommDirectionFilter =>
  commDirectionFilters.some((filter) => filter === value);
const isCommStatusFilter = (value: string): value is CommStatusFilter =>
  commStatusFilters.some((filter) => filter === value);
const isComposeType = (value: string): value is ComposeType =>
  composeTypes.some((filter) => filter === value);
const isComposeDirection = (value: string): value is ComposeDirection =>
  composeDirections.some((filter) => filter === value);
const isGroupRole = (value: string): value is GroupRole =>
  groupRoles.some((filter) => filter === value);
const resolveGroupRole = (value: string | null | undefined): GroupRole =>
  value && isGroupRole(value) ? value : "member";

export default function ReservationDetailPage() {
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [reservation, setReservation] = useState<ReservationWithGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [commTypeFilter, setCommTypeFilter] = useState<CommTypeFilter>("all");
  const [commDirectionFilter, setCommDirectionFilter] = useState<CommDirectionFilter>("all");
  const [commStatusFilter, setCommStatusFilter] = useState<CommStatusFilter>("all");
  const [composeType, setComposeType] = useState<ComposeType>("email");
  const [composeDirection, setComposeDirection] = useState<ComposeDirection>("outbound");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeFrom, setComposeFrom] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupRole, setGroupRole] = useState<GroupRole>("member");
  const [showCheckInCelebration, setShowCheckInCelebration] = useState(false);
  const reservationId = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (reservationId) {
      loadReservation(reservationId);
    }
  }, [reservationId]);

  const loadReservation = async (id: string) => {
    try {
      const data: ReservationWithGroup = await apiClient.getReservation(id);
      setReservation(data);
      setSelectedGroupId(data.groupId ?? "");
      setGroupRole(resolveGroupRole(data.groupRole));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load reservation details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const campgroundQuery = useQuery({
    queryKey: ["campground", reservation?.campgroundId],
    queryFn: () => apiClient.getCampground(reservation!.campgroundId),
    enabled: !!reservation?.campgroundId,
  });
  const SLA_MINUTES =
    campgroundQuery.data?.slaMinutes ?? Number(process.env.NEXT_PUBLIC_SLA_MINUTES || 30);

  const commsQuery = useInfiniteQuery<
    CommunicationsPage,
    Error,
    InfiniteData<CommunicationsPage, string | undefined>,
    ["communications", "reservation", string, CommTypeFilter, CommDirectionFilter],
    string | undefined
  >({
    queryKey: ["communications", "reservation", reservationId, commTypeFilter, commDirectionFilter],
    queryFn: ({ pageParam }) =>
      apiClient.listCommunications({
        campgroundId: reservation?.campgroundId || "",
        reservationId,
        limit: 20,
        type: commTypeFilter === "email" || commTypeFilter === "sms" ? commTypeFilter : undefined,
        direction: commDirectionFilter === "all" ? undefined : commDirectionFilter,
        cursor: pageParam,
      }),
    enabled: !!reservationId && !!reservation?.campgroundId,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const commItems = commsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const groupsQuery = useQuery<GroupSummary[]>({
    queryKey: ["groups", reservation?.campgroundId],
    queryFn: () => apiClient.getGroups(reservation!.campgroundId),
    enabled: !!reservation?.campgroundId,
  });
  const overdueCount = commItems.filter((c) => {
    const createdDate = c.createdAt ? new Date(c.createdAt) : null;
    const minutesSince = createdDate ? (Date.now() - createdDate.getTime()) / 60000 : 0;
    const isInboundPending =
      c.direction === "inbound" &&
      !(c.status || "").startsWith("delivered") &&
      (c.status || "") !== "sent" &&
      (c.status || "") !== "failed";
    return isInboundPending && minutesSince > SLA_MINUTES;
  }).length;

  const playbookJobsQuery = useQuery<CommunicationPlaybookJob[]>({
    queryKey: ["communications", "playbook-jobs", reservation?.campgroundId],
    queryFn: () => apiClient.listPlaybookJobs(reservation!.campgroundId),
    enabled: !!reservation?.campgroundId,
  });

  const playbooksQuery = useQuery<CommunicationPlaybook[]>({
    queryKey: ["communications", "playbooks", reservation?.campgroundId],
    queryFn: () => apiClient.listPlaybooks(reservation!.campgroundId),
    enabled: !!reservation?.campgroundId,
  });

  const playbookNameById = useMemo(() => {
    const map: Record<string, string> = {};
    (playbooksQuery.data || []).forEach((playbook) => {
      map[playbook.id] = playbook.type || "Playbook";
    });
    return map;
  }, [playbooksQuery.data]);

  const statusTone = (status?: string | null) => {
    const normalized = (status || "").toLowerCase();
    if (
      normalized.includes("complaint") ||
      normalized.includes("bounce") ||
      normalized.includes("fail")
    ) {
      return "bg-status-error/15 text-status-error border border-status-error/30";
    }
    if (normalized.startsWith("delivered") || normalized === "sent" || normalized === "received") {
      return "bg-status-success/15 text-status-success border border-status-success/30";
    }
    if (normalized.includes("pending") || normalized.includes("processing")) {
      return "bg-status-warning/15 text-status-warning border border-status-warning/30";
    }
    return "bg-muted text-muted-foreground border border-border";
  };

  const timelineItems = useMemo(() => {
    const normalizedStatus = commStatusFilter.toLowerCase();
    const comms: TimelineItem[] = commItems
      .filter((c) => ["email", "sms"].includes(c.type))
      .filter((c) =>
        commTypeFilter === "all" || commTypeFilter === "automation"
          ? true
          : c.type === commTypeFilter,
      )
      .filter((c) =>
        commStatusFilter === "all"
          ? true
          : (c.status || "").toLowerCase().includes(normalizedStatus),
      )
      .map((c) => ({
        kind: "communication",
        id: c.id,
        date: c.createdAt,
        type: c.type,
        direction: c.direction,
        subject: c.subject,
        body: c.preview || c.body,
        status: c.status,
        provider: c.provider,
        toAddress: c.toAddress,
        fromAddress: c.fromAddress,
      }));

    const jobs: TimelineItem[] = (playbookJobsQuery.data || [])
      .filter((job) => {
        const matchesReservation = reservation?.id ? job.reservationId === reservation.id : false;
        const matchesGuest = reservation?.guestId ? job.guestId === reservation.guestId : false;
        return matchesReservation || matchesGuest;
      })
      .filter((job) =>
        commStatusFilter === "all"
          ? true
          : (job.status || "").toLowerCase().includes(normalizedStatus),
      )
      .filter((job) => commTypeFilter === "all" || commTypeFilter === "automation")
      .map((job) => ({
        kind: "playbook",
        id: job.id,
        date: job.updatedAt || job.scheduledAt || job.createdAt,
        status: job.status,
        name: playbookNameById[job.playbookId] || "Playbook step",
        attempts: job.attempts,
        lastError: job.lastError,
      }));

    return [...comms, ...jobs].sort(
      (a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime(),
    );
  }, [
    commItems,
    commStatusFilter,
    commTypeFilter,
    playbookJobsQuery.data,
    playbookNameById,
    reservation?.guestId,
    reservation?.id,
  ]);

  const retryPlaybookMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiClient.retryPlaybookJob(jobId, reservation?.campgroundId);
    },
    onSuccess: () => {
      playbookJobsQuery.refetch();
      toast({ title: "Retry queued" });
    },
    onError: () => {
      toast({ title: "Retry failed", variant: "destructive" });
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (payload: { groupId: string | null; role?: "primary" | "member" | null }) => {
      if (!reservation) throw new Error("No reservation");
      return apiClient.updateReservationGroup(reservation.id, payload);
    },
    onSuccess: (updated) => {
      setReservation(updated);
      setSelectedGroupId(updated.groupId ?? "");
      setGroupRole(resolveGroupRole(updated.groupRole));
      groupsQuery.refetch();
      toast({ title: "Saved", description: "Group assignment updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update group", variant: "destructive" });
    },
  });

  useEffect(() => {
    setSelectedGroupId(reservation?.groupId ?? "");
    setGroupRole(resolveGroupRole(reservation?.groupRole));
  }, [reservation?.groupId, reservation?.groupRole]);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupRole("member");
    }
  }, [selectedGroupId]);

  const handleCheckIn = async () => {
    if (!reservation) return;
    setProcessing(true);
    try {
      const updated = await apiClient.checkInReservation(reservation.id);
      setReservation(updated);
      setShowCheckInCelebration(true);
    } catch (error) {
      toast({ title: "Error", description: "Failed to check in guest", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!reservation) return;

    if ((reservation.balanceAmount ?? 0) > 0) {
      toast({
        title: "Cannot Check Out",
        description: `Balance of $${((reservation.balanceAmount ?? 0) / 100).toFixed(2)} must be paid first.`,
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const updated = await apiClient.checkOutReservation(reservation.id);
      setReservation(updated);
      toast({ title: "Success", description: "Guest checked out successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to check out guest", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!reservation) return;
    setProcessing(true);
    try {
      const updated = await apiClient.cancelReservation(reservation.id);
      setReservation(updated);
      toast({ title: "Success", description: "Reservation cancelled" });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel reservation",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <PageSkeleton />
      </DashboardShell>
    );
  }

  if (!reservation) {
    return (
      <DashboardShell>
        <div className="p-8 text-center text-muted-foreground">Reservation not found</div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell className="bg-muted/40">
      <div className="flex flex-col h-full overflow-hidden">
        <ReservationHeader
          reservation={reservation}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onCancel={handleCancel}
          isProcessing={processing}
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {reservation.guest && <GuestCard guest={reservation.guest} />}
              {reservation.site && (
                <StayDetails reservation={reservation} site={reservation.site} />
              )}
              <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">Group assignment</h2>
                  <Badge
                    variant={reservation.groupId ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {reservation.groupId
                      ? `Group #${reservation.groupId.slice(0, 8)}`
                      : "Not assigned"}
                  </Badge>
                </div>

                {groupsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading groups...
                  </div>
                ) : groupsQuery.isError ? (
                  <div className="text-sm text-status-error" role="alert">
                    Unable to load groups.
                  </div>
                ) : groupsQuery.data?.length === 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded border border-dashed border-border bg-muted px-3 py-2">
                      <div className="text-sm text-muted-foreground">
                        No groups for this campground yet.
                      </div>
                      <Link
                        href="/groups"
                        className="text-sm font-medium text-action-primary hover:text-action-primary-hover"
                      >
                        Go to Groups
                      </Link>
                    </div>
                    {reservation.groupId && (
                      <div className="flex">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedGroupId("");
                            setGroupRole("member");
                            updateGroupMutation.mutate({ groupId: null, role: null });
                          }}
                          disabled={updateGroupMutation.isPending}
                        >
                          Remove from group
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="group-select">
                        Group
                      </Label>
                      <Select
                        value={selectedGroupId}
                        onValueChange={(value) => setSelectedGroupId(value)}
                        disabled={updateGroupMutation.isPending}
                      >
                        <SelectTrigger id="group-select" className="h-10 bg-background">
                          <SelectValue placeholder="Not assigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Not assigned</SelectItem>
                          {groupsQuery.data?.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {`Group #${g.id.slice(0, 8)} • ${g.reservationCount} reservation${g.reservationCount === 1 ? "" : "s"}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="group-role-primary">
                        Role
                      </Label>
                      <RadioGroup
                        value={groupRole}
                        onValueChange={(value) => {
                          if (isGroupRole(value)) {
                            setGroupRole(value);
                          }
                        }}
                        className="flex items-center gap-4 text-sm text-foreground"
                        aria-label="Group role"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            id="group-role-primary"
                            value="primary"
                            disabled={!selectedGroupId || updateGroupMutation.isPending}
                          />
                          <Label htmlFor="group-role-primary">Primary</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            id="group-role-member"
                            value="member"
                            disabled={!selectedGroupId || updateGroupMutation.isPending}
                          />
                          <Label htmlFor="group-role-member">Member</Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        Primary is treated as the main contact for shared communications.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() =>
                          updateGroupMutation.mutate({
                            groupId: selectedGroupId || null,
                            role: selectedGroupId ? groupRole : null,
                          })
                        }
                        disabled={updateGroupMutation.isPending}
                      >
                        {updateGroupMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      {selectedGroupId && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedGroupId("");
                            setGroupRole("member");
                            updateGroupMutation.mutate({ groupId: null, role: null });
                          }}
                          disabled={updateGroupMutation.isPending}
                        >
                          Remove from group
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <ReservationTimeline reservation={reservation} />
              <MessagesPanel reservationId={reservation.id} guestId={reservation.guestId} />
              <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">Communications</h2>
                    {overdueCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-status-warning/15 text-status-warning border border-status-warning/30">
                        {overdueCount} need reply
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">Last 20</span>
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="comm-type-filter">
                      Type
                    </Label>
                    <Select
                      value={commTypeFilter}
                      onValueChange={(value) => {
                        if (isCommTypeFilter(value)) {
                          setCommTypeFilter(value);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="comm-type-filter"
                        className="h-9 bg-background"
                        aria-label="Communication type"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="automation">Automation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="comm-status-filter">
                      Status (stub)
                    </Label>
                    <Select
                      value={commStatusFilter}
                      onValueChange={(value) => {
                        if (isCommStatusFilter(value)) {
                          setCommStatusFilter(value);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="comm-status-filter"
                        className="h-9 bg-background"
                        aria-label="Communication status"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="bounce">Bounced</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="comm-direction-filter">
                      Direction
                    </Label>
                    <Select
                      value={commDirectionFilter}
                      onValueChange={(value) => {
                        if (isCommDirectionFilter(value)) {
                          setCommDirectionFilter(value);
                        }
                      }}
                    >
                      <SelectTrigger
                        id="comm-direction-filter"
                        className="h-9 bg-background"
                        aria-label="Communication direction"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="outbound">Outbound</SelectItem>
                        <SelectItem value="inbound">Inbound</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Collapsible Log Communication Form */}
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground py-2 border-t border-border mt-2">
                    <PlusCircle className="h-4 w-4" />
                    <span>Log Communication</span>
                  </summary>
                  <div className="mt-3 p-3 bg-muted rounded-lg border border-border space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor="compose-type">
                          Type
                        </Label>
                        <Select
                          value={composeType}
                          onValueChange={(value) => {
                            if (isComposeType(value)) {
                              setComposeType(value);
                            }
                          }}
                        >
                          <SelectTrigger
                            id="compose-type"
                            className="h-9 bg-background"
                            aria-label="Compose type"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="note">Note</SelectItem>
                            <SelectItem value="call">Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor="compose-direction">
                          Direction
                        </Label>
                        <Select
                          value={composeDirection}
                          onValueChange={(value) => {
                            if (isComposeDirection(value)) {
                              setComposeDirection(value);
                            }
                          }}
                        >
                          <SelectTrigger
                            id="compose-direction"
                            className="h-9 bg-background"
                            aria-label="Compose direction"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="inbound">Inbound</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="compose-subject">
                        Subject (optional)
                      </Label>
                      <Input
                        id="compose-subject"
                        value={composeSubject}
                        onChange={(e) => setComposeSubject(e.target.value)}
                        placeholder="Subject"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="compose-body">
                        Body
                      </Label>
                      <Textarea
                        id="compose-body"
                        className="min-h-[80px] bg-background"
                        value={composeBody}
                        onChange={(e) => setComposeBody(e.target.value)}
                        placeholder="Log the message content"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor="compose-to">
                          To
                        </Label>
                        <Input
                          id="compose-to"
                          value={composeTo}
                          onChange={(e) => setComposeTo(e.target.value)}
                          placeholder="email or phone"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs" htmlFor="compose-from">
                          From
                        </Label>
                        <Input
                          id="compose-from"
                          value={composeFrom}
                          onChange={(e) => setComposeFrom(e.target.value)}
                          placeholder="email or phone"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!reservation?.campgroundId) return;
                        if (!composeBody.trim()) {
                          return toast({ title: "Body required", variant: "destructive" });
                        }
                        await apiClient.createCommunication({
                          campgroundId: reservation.campgroundId,
                          reservationId: reservation.id,
                          guestId: reservation.guestId,
                          type: composeType,
                          direction: composeDirection,
                          subject: composeSubject || undefined,
                          body: composeBody,
                          toAddress: composeTo || undefined,
                          fromAddress: composeFrom || undefined,
                        });
                        setComposeBody("");
                        setComposeSubject("");
                        setComposeTo("");
                        setComposeFrom("");
                        commsQuery.refetch();
                        toast({ title: "Logged" });
                      }}
                      disabled={!reservation?.campgroundId}
                    >
                      Log communication
                    </Button>
                  </div>
                </details>

                <div className="space-y-2 max-h-96 overflow-auto pr-1">
                  {!timelineItems.length && (
                    <div className="text-sm text-muted-foreground">No communications yet.</div>
                  )}
                  <div className="relative pl-3 border-l border-border space-y-4">
                    {timelineItems.map((item) => {
                      const createdDate = item.date ? new Date(item.date) : null;
                      const getCommIcon = (entry: TimelineItem) => {
                        if (entry.kind === "playbook") return GitBranch;
                        switch (entry.type) {
                          case "sms":
                            return Phone;
                          case "note":
                            return StickyNote;
                          case "call":
                            return PhoneCall;
                          default:
                            return Mail;
                        }
                      };
                      const Icon = getCommIcon(item);
                      return (
                        <div key={`${item.kind}-${item.id}`} className="relative pl-4">
                          <span className="absolute -left-[9px] top-2 h-4 w-4 rounded-full bg-card border border-border flex items-center justify-center">
                            <Icon className="h-3 w-3 text-muted-foreground" />
                          </span>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {createdDate
                                  ? formatDistanceToNow(createdDate, { addSuffix: true })
                                  : ""}
                              </span>
                              {item.kind === "communication" && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    item.direction === "outbound"
                                      ? "bg-status-info/15 text-status-info border border-status-info/30"
                                      : "bg-status-success/15 text-status-success border border-status-success/30"
                                  }`}
                                >
                                  {item.direction}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize",
                                  statusTone(item.status),
                                )}
                              >
                                {item.status || "sent"}
                              </span>
                              {item.kind === "playbook" &&
                                (item.status || "").toLowerCase() === "failed" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => retryPlaybookMutation.mutate(item.id)}
                                    disabled={retryPlaybookMutation.isPending}
                                    className="h-7"
                                  >
                                    <RotateCcw className="h-3 w-3 mr-1" />
                                    Retry
                                  </Button>
                                )}
                            </div>
                          </div>
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-semibold">
                                {item.kind === "playbook" ? "Playbook" : item.type}
                              </Badge>
                              {item.kind === "playbook" && (
                                <span className="text-xs text-muted-foreground">{item.name}</span>
                              )}
                              {item.kind === "communication" && item.subject && (
                                <span className="text-sm font-medium text-foreground">
                                  {item.subject}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-foreground line-clamp-2">
                              {item.kind === "playbook"
                                ? item.lastError
                                  ? `Attempts: ${item.attempts ?? 0} • Last error: ${item.lastError}`
                                  : `Attempts: ${item.attempts ?? 0}`
                                : item.body}
                            </div>
                            {item.kind === "communication" && (
                              <div className="text-xs text-muted-foreground">
                                {item.provider ? `Provider: ${item.provider}` : ""}
                                {item.toAddress ? ` • To: ${item.toAddress}` : ""}
                                {item.fromAddress ? ` • From: ${item.fromAddress}` : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {commsQuery.hasNextPage && (
                    <div className="pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => commsQuery.fetchNextPage()}
                        disabled={commsQuery.isFetchingNextPage}
                      >
                        {commsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Finance & Actions */}
            <div className="space-y-6">
              <FinancialSummary reservation={reservation} />
              {/* Add Notes/Tags component here later */}
            </div>
          </div>
        </div>
      </div>

      {/* Check-in celebration dialog */}
      <CheckInCelebrationDialog
        open={showCheckInCelebration}
        onClose={() => setShowCheckInCelebration(false)}
        guestName={
          reservation.guest
            ? `${reservation.guest.primaryFirstName || ""} ${reservation.guest.primaryLastName || ""}`.trim() ||
              "Guest"
            : "Guest"
        }
        siteName={reservation.site?.name || "Site"}
        arrivalDate={reservation.arrivalDate}
        departureDate={reservation.departureDate}
      />
    </DashboardShell>
  );
}
