"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useWhoami } from "@/hooks/use-whoami";

const APPROVER_ROLES = new Set(["owner", "manager", "admin", "finance"]);
const URGENT_AGE_HOURS = 24;

function statusVariant(status: string) {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    case "pending_second":
      return "warning";
    case "pending":
      return "info";
    default:
      return "outline";
  }
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatAmount(amount: number, currency: string) {
  if (!Number.isFinite(amount)) return currency;
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: whoami, isLoading: whoamiLoading } = useWhoami();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [typeFilter, setTypeFilter] = useState("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
    setOrgId(localStorage.getItem("campreserv:selectedOrg"));
  }, []);

  const memberships = whoami?.user?.memberships ?? [];
  const ownershipRoles = whoami?.user?.ownershipRoles ?? [];
  const platformRole = (whoami?.user as any)?.platformRole as string | undefined;
  const scopedMembership = memberships.find((m) => m.campgroundId === campgroundId) || null;
  const scopedRole = scopedMembership?.role ?? null;
  const approverId = whoami?.user?.email || whoami?.user?.id || "";
  const approverName =
    [whoami?.user?.firstName, whoami?.user?.lastName].filter(Boolean).join(" ") ||
    approverId ||
    "Unknown";
  const isApproverRole =
    Boolean(platformRole) ||
    (scopedRole ? APPROVER_ROLES.has(scopedRole) : false) ||
    ownershipRoles.some((role) => APPROVER_ROLES.has(role));
  const scopeAllowed = campgroundId
    ? Boolean(platformRole || memberships.some((m) => m.campgroundId === campgroundId))
    : Boolean(platformRole || ownershipRoles.length > 0 || memberships.length > 0);
  const canAct = Boolean(whoami && approverId && isApproverRole && scopeAllowed);
  const scopeReady = Boolean(campgroundId || orgId);
  const approvalsEnabled = scopeReady && !whoamiLoading && Boolean(whoami) && scopeAllowed;

  const approvalsQuery = useQuery({
    queryKey: ["approvals", campgroundId, orgId],
    queryFn: apiClient.listApprovals,
    enabled: approvalsEnabled
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approver }: { id: string; approver: string }) => apiClient.approveRequest(id, approver),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({ title: "Approved" });
    },
    onError: (err: any) =>
      toast({ title: "Approval failed", description: err?.message ?? "Try again", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, approver, reason }: { id: string; approver: string; reason: string }) =>
      apiClient.rejectRequest(id, approver, reason),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      setRejectionReasons((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast({ title: "Rejected" });
    },
    onError: (err: any) =>
      toast({ title: "Rejection failed", description: err?.message ?? "Try again", variant: "destructive" }),
  });

  const policies = approvalsQuery.data?.policies ?? [];
  const policyMap = useMemo(() => new Map(policies.map((policy) => [policy.id, policy])), [policies]);
  const requests = approvalsQuery.data?.requests ?? [];

  const approverKeys = useMemo(() => {
    return [approverId, whoami?.user?.id, whoami?.user?.email].filter(Boolean) as string[];
  }, [approverId, whoami?.user?.id, whoami?.user?.email]);

  const enrichedRequests = useMemo(() => {
    const now = Date.now();
    const cutoffMs = URGENT_AGE_HOURS * 60 * 60 * 1000;
    return requests.map((req) => {
      const policy = policyMap.get(req.policyId);
      const createdAtMs = Date.parse(req.createdAt);
      const isOpen = req.status === "pending" || req.status === "pending_second";
      const isStale = Number.isFinite(createdAtMs) && now - createdAtMs > cutoffMs;
      const thresholdCents = policy?.thresholdCents;
      const highValue =
        thresholdCents !== null && thresholdCents !== undefined && req.amount * 100 >= thresholdCents;
      const urgent = isOpen && (req.status === "pending_second" || isStale || highValue);
      return { req, policy, createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0, urgent, isOpen };
    });
  }, [requests, policyMap]);

  const summary = useMemo(() => {
    const pending = requests.filter((req) => req.status === "pending").length;
    const pendingSecond = requests.filter((req) => req.status === "pending_second").length;
    const urgent = enrichedRequests.filter((item) => item.urgent).length;
    return { pending, pendingSecond, urgent, total: requests.length };
  }, [requests, enrichedRequests]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    const statusPriority: Record<string, number> = {
      pending_second: 0,
      pending: 1,
      approved: 2,
      rejected: 3
    };

    const result = enrichedRequests.filter(({ req, policy, urgent, isOpen }) => {
      if (statusFilter !== "all") {
        if (statusFilter === "open") {
          if (!isOpen) return false;
        } else if (req.status !== statusFilter) {
          return false;
        }
      }
      if (typeFilter !== "all" && req.type !== typeFilter) return false;
      if (urgentOnly && !urgent) return false;
      if (query) {
        const values = [req.id, req.reason, req.requester, req.type, req.currency, policy?.name]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (!values.some((value) => value.includes(query))) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      const statusDiff = (statusPriority[a.req.status] ?? 99) - (statusPriority[b.req.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return b.createdAtMs - a.createdAtMs;
    });

    return result;
  }, [enrichedRequests, search, statusFilter, typeFilter, urgentOnly]);

  const scopeLabel = campgroundId
    ? scopedMembership?.campground?.name || campgroundId
    : orgId
      ? `Org ${orgId}`
      : "Not set";
  const roleLabel =
    platformRole || scopedRole || (ownershipRoles.length ? ownershipRoles.join(", ") : "unassigned");

  const openCount = summary.pending + summary.pendingSecond;

  const tableMessage = !scopeReady
    ? "Select a campground or organization to view approvals."
    : whoamiLoading
      ? "Checking access..."
      : !whoami
        ? "Sign in to view approvals."
        : !scopeAllowed
          ? "You do not have access to this campground."
          : approvalsQuery.isError
            ? (approvalsQuery.error as any)?.message ?? "Failed to load approvals."
            : approvalsQuery.isLoading
              ? "Loading approvals..."
              : filteredRequests.length === 0
                ? "No approvals match the current filters."
                : null;

  const policiesMessage = !scopeReady
    ? "Select a campground or organization to view policies."
    : whoamiLoading
      ? "Checking access..."
      : !whoami
        ? "Sign in to view policies."
        : !scopeAllowed
          ? "Access required to view policies."
          : approvalsQuery.isLoading
            ? "Loading policies..."
            : policies.length === 0
              ? "No approval policies configured."
              : null;

  return (
    <DashboardShell>
      <Breadcrumbs
        items={[
          { label: "Finance", href: "/finance" },
          { label: "Approvals", href: "/approvals" },
        ]}
      />

      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-600">Dual control for refunds, payouts, and high-value changes.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Badge variant="secondary">Scope: {scopeLabel}</Badge>
          <span>Signed in as {approverName}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Approvals queue</CardTitle>
                <CardDescription>Review requests scoped to the selected campground or organization.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">Open {openCount}</Badge>
                <Badge variant="warning">Needs second {summary.pendingSecond}</Badge>
                <Badge variant="destructive">Urgent {summary.urgent}</Badge>
                <Badge variant="outline">Total {summary.total}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="approvals-search">Search</Label>
                  <Input
                    id="approvals-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Reason, requester, or policy"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending_second">Pending second</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="refund">Refund</SelectItem>
                      <SelectItem value="payout">Payout</SelectItem>
                      <SelectItem value="config_change">Config change</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="approvals-urgent"
                    checked={urgentOnly}
                    onCheckedChange={setUrgentOnly}
                    disabled={!approvalsEnabled}
                  />
                  <Label htmlFor="approvals-urgent">Urgent only</Label>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => approvalsQuery.refetch()}
                  disabled={!approvalsEnabled || approvalsQuery.isFetching}
                >
                  Refresh
                </Button>
              </div>
            </div>

            <div className="text-xs text-slate-500">
              Showing {filteredRequests.length} of {requests.length} requests
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Approvals</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableMessage && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500">
                        {tableMessage}
                      </TableCell>
                    </TableRow>
                  )}
                  {!tableMessage &&
                    filteredRequests.map(({ req, policy, urgent, isOpen }) => {
                      const reason = rejectionReasons[req.id] ?? "";
                      const trimmedReason = reason.trim();
                      const alreadyApproved =
                        approverKeys.length > 0 && req.approvals.some((a) => approverKeys.includes(a.approver));
                      const isMutating = approveMutation.isPending || rejectMutation.isPending;
                      const approveDisabled = !canAct || !isOpen || alreadyApproved || isMutating;
                      const rejectDisabled = approveDisabled || !trimmedReason;
                      let actionHint: string | null = null;

                      if (!canAct) {
                        actionHint = "Manager or admin role required.";
                      } else if (alreadyApproved) {
                        actionHint = "You already approved this request.";
                      } else if (!trimmedReason) {
                        actionHint = "Reason required to reject.";
                      }

                      return (
                        <TableRow key={req.id} className={urgent ? "bg-amber-50/40" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold uppercase">{formatLabel(req.type)}</span>
                              {urgent && <Badge variant="warning">Urgent</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-slate-900">{req.requester || "Unknown"}</div>
                            <div className="text-xs text-slate-500">{formatDateTime(req.createdAt)}</div>
                          </TableCell>
                          <TableCell className="max-w-xs text-sm text-slate-700">{req.reason}</TableCell>
                          <TableCell>{formatAmount(req.amount, req.currency)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(req.status)}>{formatLabel(req.status)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-600">
                              {req.approvals.length}/{req.requiredApprovals} approvals
                            </div>
                            <div className="text-xs text-slate-500">
                              {req.approvals.length
                                ? req.approvals
                                    .map((a) => `${a.approver} (${formatDateTime(a.at)})`)
                                    .join(", ")
                                : "None yet"}
                            </div>
                            {policy && (
                              <div className="text-xs text-slate-500">
                                Policy: {policy.name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => approveMutation.mutate({ id: req.id, approver: approverId })}
                                disabled={approveDisabled}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  rejectMutation.mutate({ id: req.id, approver: approverId, reason: trimmedReason })
                                }
                                disabled={rejectDisabled}
                              >
                                Reject
                              </Button>
                            </div>
                            {isOpen && (
                              <div className="space-y-1">
                                <Input
                                  value={reason}
                                  onChange={(e) =>
                                    setRejectionReasons((prev) => ({ ...prev, [req.id]: e.target.value }))
                                  }
                                  placeholder="Reason required to reject"
                                  disabled={!canAct || isMutating}
                                />
                                {actionHint && <div className="text-xs text-slate-500">{actionHint}</div>}
                              </div>
                            )}
                            {!isOpen && (
                              <div className="text-xs text-slate-500">No actions available.</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policies</CardTitle>
            <CardDescription>Rules that trigger dual control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {policiesMessage && (
              <div className="text-xs text-slate-500">{policiesMessage}</div>
            )}
            {!policiesMessage &&
              policies.map((policy) => (
                <div key={policy.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{policy.name}</div>
                    <Badge variant="secondary">{policy.approversNeeded} approver(s)</Badge>
                  </div>
                  <div className="text-xs text-slate-500 uppercase">{policy.appliesTo.join(", ")}</div>
                  <div className="text-xs text-slate-600">{policy.description}</div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>Approvals require admin or manager roles in scope.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Signed in as</span>
              <span className="text-slate-900">{approverName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Role</span>
              <span className="text-slate-900">{roleLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Scope</span>
              <span className="text-slate-900">{scopeLabel}</span>
            </div>
            <Badge variant={whoamiLoading ? "secondary" : canAct ? "success" : "warning"}>
              {whoamiLoading ? "Checking access" : canAct ? "Can approve requests" : "Approval restricted"}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
