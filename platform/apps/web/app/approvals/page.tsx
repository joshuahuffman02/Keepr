"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, type Transition } from "framer-motion";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useWhoami } from "@/hooks/use-whoami";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  Clock,
  AlertCircle,
  RefreshCcw,
  Banknote,
  Settings,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  PartyPopper,
  Plus,
  Pencil,
  Trash2,
  Shield,
} from "lucide-react";

const APPROVER_ROLES = new Set(["owner", "manager", "admin", "finance"]);
const PREFERENCES_STORAGE_KEY = "campreserv:approvalsPreferences";

type QueuePreferences = {
  urgentPendingSecond: boolean;
  urgentAgeHours: string;
  urgentPolicyThreshold: boolean;
  urgentCustomAmountEnabled: boolean;
  urgentCustomAmount: string;
  sortMode: "urgent" | "newest" | "oldest";
};

const DEFAULT_PREFERENCES: QueuePreferences = {
  urgentPendingSecond: true,
  urgentAgeHours: "24",
  urgentPolicyThreshold: true,
  urgentCustomAmountEnabled: false,
  urgentCustomAmount: "",
  sortMode: "urgent",
};

const SPRING_CONFIG: Transition = { type: "spring", stiffness: 300, damping: 25 };

type ActionType = "refund" | "payout" | "config_change";
type ApproverRole = "owner" | "manager" | "finance" | "front_desk";

const ACTION_TYPES: ActionType[] = ["refund", "payout", "config_change"];
const ROLE_OPTIONS: Array<{ value: ApproverRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "finance", label: "Finance" },
  { value: "front_desk", label: "Front Desk" },
];

type PolicyFormData = {
  name: string;
  appliesTo: string[];
  thresholdCents: string;
  currency: string;
  approversNeeded: string;
  description: string;
  approverRoles: string[];
  isActive: boolean;
};

type ApprovalList = Awaited<ReturnType<typeof apiClient.listApprovals>>;
type ApprovalPolicy = ApprovalList["policies"][number];

const DEFAULT_POLICY_FORM: PolicyFormData = {
  name: "",
  appliesTo: [],
  thresholdCents: "",
  currency: "USD",
  approversNeeded: "1",
  description: "",
  approverRoles: ["owner", "manager"],
  isActive: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

const isSortMode = (value: unknown): value is QueuePreferences["sortMode"] =>
  value === "urgent" || value === "newest" || value === "oldest";

const mergePreferences = (prev: QueuePreferences, value: unknown): QueuePreferences => {
  if (!isRecord(value)) return prev;
  return {
    ...prev,
    urgentPendingSecond:
      typeof value.urgentPendingSecond === "boolean"
        ? value.urgentPendingSecond
        : prev.urgentPendingSecond,
    urgentAgeHours:
      typeof value.urgentAgeHours === "string" ? value.urgentAgeHours : prev.urgentAgeHours,
    urgentPolicyThreshold:
      typeof value.urgentPolicyThreshold === "boolean"
        ? value.urgentPolicyThreshold
        : prev.urgentPolicyThreshold,
    urgentCustomAmountEnabled:
      typeof value.urgentCustomAmountEnabled === "boolean"
        ? value.urgentCustomAmountEnabled
        : prev.urgentCustomAmountEnabled,
    urgentCustomAmount:
      typeof value.urgentCustomAmount === "string"
        ? value.urgentCustomAmount
        : prev.urgentCustomAmount,
    sortMode: isSortMode(value.sortMode) ? value.sortMode : prev.sortMode,
  };
};

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

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
    case "rejected":
      return <XCircle className="h-3.5 w-3.5" aria-hidden="true" />;
    case "pending_second":
      return <Clock className="h-3.5 w-3.5" aria-hidden="true" />;
    case "pending":
      return <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />;
    default:
      return null;
  }
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "refund":
      return <RefreshCcw className="h-4 w-4 text-amber-600" aria-hidden="true" />;
    case "payout":
      return <Banknote className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
    case "config_change":
      return <Settings className="h-4 w-4 text-blue-600" aria-hidden="true" />;
    default:
      return null;
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
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - Date.parse(dateStr);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.max(1, Math.floor(diff / 60000))} min ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Skeleton for loading state
function ApprovalRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-5 w-20" />
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-32" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-20 rounded-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>
      </TableCell>
    </TableRow>
  );
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
  const [preferences, setPreferences] = useState<QueuePreferences>(DEFAULT_PREFERENCES);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [policySheetOpen, setPolicySheetOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [policyForm, setPolicyForm] = useState<PolicyFormData>(DEFAULT_POLICY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const prevOpenCountRef = useRef<number>(0);

  // Announce messages to screen readers
  const announce = useCallback((message: string) => {
    setAnnouncement("");
    setTimeout(() => setAnnouncement(message), 100);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
    setOrgId(localStorage.getItem("campreserv:selectedOrg"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      setPreferences((prev) => mergePreferences(prev, parsed));
    } catch {
      // ignore malformed preferences
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const memberships = whoami?.user?.memberships ?? [];
  const ownershipRoles = whoami?.user?.ownershipRoles ?? [];
  const platformRole = whoami?.user?.platformRole;
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

  const approvalsQuery = useQuery<ApprovalList>({
    queryKey: ["approvals", campgroundId, orgId],
    queryFn: apiClient.listApprovals,
    enabled: approvalsEnabled,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approver }: { id: string; approver: string }) => {
      setProcessingId(id);
      return apiClient.approveRequest(id, approver);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({
        title: "Request approved",
        description: "The request has been processed successfully.",
      });
      announce("Request approved successfully");
      setProcessingId(null);
      // Focus next available action
      requestAnimationFrame(() => {
        const nextButton = tableRef.current?.querySelector<HTMLButtonElement>(
          "tbody tr button:not(:disabled)",
        );
        nextButton?.focus();
      });
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Please try again");
      toast({ title: "Approval failed", description: message, variant: "destructive" });
      announce(`Approval failed: ${message}`);
      setProcessingId(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, approver, reason }: { id: string; approver: string; reason: string }) => {
      setProcessingId(id);
      return apiClient.rejectRequest(id, approver, reason);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      setRejectionReasons((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast({
        title: "Request rejected",
        description: "The requester will be notified.",
      });
      announce("Request rejected successfully");
      setProcessingId(null);
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, "Please try again");
      toast({ title: "Rejection failed", description: message, variant: "destructive" });
      announce(`Rejection failed: ${message}`);
      setProcessingId(null);
    },
  });

  const createPolicyMutation = useMutation({
    mutationFn: (data: PolicyFormData) => {
      const thresholdCents = data.thresholdCents
        ? Math.round(parseFloat(data.thresholdCents) * 100)
        : undefined;
      return apiClient.createApprovalPolicy({
        name: data.name,
        appliesTo: data.appliesTo,
        thresholdCents,
        currency: data.currency,
        approversNeeded: parseInt(data.approversNeeded, 10) || 1,
        description: data.description || undefined,
        approverRoles: data.approverRoles,
        campgroundId: campgroundId ?? undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({ title: "Policy created", description: "The new policy is now active." });
      setPolicySheetOpen(false);
      setPolicyForm(DEFAULT_POLICY_FORM);
      announce("Policy created successfully");
    },
    onError: (err: unknown) => {
      toast({
        title: "Failed to create policy",
        description: getErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PolicyFormData }) => {
      const thresholdCents = data.thresholdCents
        ? Math.round(parseFloat(data.thresholdCents) * 100)
        : null;
      return apiClient.updateApprovalPolicy(id, {
        name: data.name,
        appliesTo: data.appliesTo,
        thresholdCents,
        currency: data.currency,
        approversNeeded: parseInt(data.approversNeeded, 10) || 1,
        description: data.description || null,
        approverRoles: data.approverRoles,
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({ title: "Policy updated", description: "Changes have been saved." });
      setPolicySheetOpen(false);
      setEditingPolicy(null);
      setPolicyForm(DEFAULT_POLICY_FORM);
      announce("Policy updated successfully");
    },
    onError: (err: unknown) => {
      toast({
        title: "Failed to update policy",
        description: getErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteApprovalPolicy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast({ title: "Policy deleted", description: "The policy has been removed." });
      setDeleteConfirmId(null);
      announce("Policy deleted successfully");
    },
    onError: (err: unknown) => {
      toast({
        title: "Failed to delete policy",
        description: getErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const openPolicyEdit = useCallback((policy: ApprovalPolicy) => {
    setPolicyForm({
      name: policy.name,
      appliesTo: policy.appliesTo,
      thresholdCents: policy.thresholdCents ? (policy.thresholdCents / 100).toString() : "",
      currency: policy.currency || "USD",
      approversNeeded: policy.approversNeeded.toString(),
      description: policy.description || "",
      approverRoles: policy.approverRoles || ["owner", "manager"],
      isActive: policy.isActive !== false,
    });
    setEditingPolicy(policy.id);
    setPolicySheetOpen(true);
  }, []);

  const openPolicyCreate = useCallback(() => {
    setPolicyForm(DEFAULT_POLICY_FORM);
    setEditingPolicy(null);
    setPolicySheetOpen(true);
  }, []);

  const handlePolicySubmit = useCallback(() => {
    if (!policyForm.name.trim() || policyForm.appliesTo.length === 0) {
      toast({
        title: "Validation error",
        description: "Name and action types are required.",
        variant: "destructive",
      });
      return;
    }
    if (editingPolicy) {
      updatePolicyMutation.mutate({ id: editingPolicy, data: policyForm });
    } else {
      createPolicyMutation.mutate(policyForm);
    }
  }, [editingPolicy, policyForm, createPolicyMutation, updatePolicyMutation, toast]);

  const policies = approvalsQuery.data?.policies ?? [];
  const policyMap = useMemo(
    () => new Map(policies.map((policy) => [policy.id, policy])),
    [policies],
  );
  const requests = approvalsQuery.data?.requests ?? [];
  const sampleCurrency = requests.find((req) => req.currency)?.currency || "USD";
  const ageHours = Math.max(0, Number(preferences.urgentAgeHours));
  const customAmount = Number(preferences.urgentCustomAmount);
  const hasCustomAmount =
    preferences.urgentCustomAmountEnabled && Number.isFinite(customAmount) && customAmount > 0;

  const approverKeys = useMemo(() => {
    return [approverId, whoami?.user?.id, whoami?.user?.email].filter((value): value is string =>
      Boolean(value),
    );
  }, [approverId, whoami?.user?.id, whoami?.user?.email]);

  const enrichedRequests = useMemo(() => {
    const now = Date.now();
    const cutoffMs = ageHours * 60 * 60 * 1000;
    return requests.map((req) => {
      const policy = policyMap.get(req.policyId);
      const createdAtMs = Date.parse(req.createdAt);
      const isOpen = req.status === "pending" || req.status === "pending_second";
      const matchesPendingSecond =
        preferences.urgentPendingSecond && req.status === "pending_second";
      const isStale = ageHours > 0 && Number.isFinite(createdAtMs) && now - createdAtMs > cutoffMs;
      const thresholdCents = policy?.thresholdCents;
      const highValue =
        preferences.urgentPolicyThreshold &&
        thresholdCents !== null &&
        thresholdCents !== undefined &&
        req.amount * 100 >= thresholdCents;
      const customValue = hasCustomAmount && req.amount >= customAmount;
      const urgent = isOpen && (matchesPendingSecond || isStale || highValue || customValue);
      return {
        req,
        policy,
        createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : 0,
        urgent,
        isOpen,
      };
    });
  }, [
    requests,
    policyMap,
    ageHours,
    customAmount,
    hasCustomAmount,
    preferences.urgentPendingSecond,
    preferences.urgentPolicyThreshold,
  ]);

  const summary = useMemo(() => {
    const pending = requests.filter((req) => req.status === "pending").length;
    const pendingSecond = requests.filter((req) => req.status === "pending_second").length;
    const urgent = enrichedRequests.filter((item) => item.urgent).length;
    return { pending, pendingSecond, urgent, total: requests.length };
  }, [requests, enrichedRequests]);

  const openCount = summary.pending + summary.pendingSecond;

  // Celebrate when queue is cleared
  useEffect(() => {
    if (prevOpenCountRef.current > 0 && openCount === 0 && !approvalsQuery.isLoading) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 3000);
    }
    prevOpenCountRef.current = openCount;
  }, [openCount, approvalsQuery.isLoading]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    const statusPriority: Record<string, number> = {
      pending_second: 0,
      pending: 1,
      approved: 2,
      rejected: 3,
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
      if (preferences.sortMode === "urgent") {
        if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
        const statusDiff =
          (statusPriority[a.req.status] ?? 99) - (statusPriority[b.req.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        return b.createdAtMs - a.createdAtMs;
      }
      const timeDiff =
        preferences.sortMode === "oldest"
          ? a.createdAtMs - b.createdAtMs
          : b.createdAtMs - a.createdAtMs;
      if (timeDiff !== 0) return timeDiff;
      return (statusPriority[a.req.status] ?? 99) - (statusPriority[b.req.status] ?? 99);
    });

    return result;
  }, [enrichedRequests, search, statusFilter, typeFilter, urgentOnly, preferences.sortMode]);

  const scopeLabel = campgroundId
    ? scopedMembership?.campground?.name || campgroundId
    : orgId
      ? `Org ${orgId}`
      : "Not set";
  const roleLabel =
    platformRole ||
    scopedRole ||
    (ownershipRoles.length ? ownershipRoles.join(", ") : "unassigned");

  const isLoading = approvalsQuery.isLoading;

  const tableMessage = !scopeReady
    ? "Select a campground or organization to view approvals."
    : whoamiLoading
      ? null // We'll show skeleton instead
      : !whoami
        ? "Sign in to view approvals."
        : !scopeAllowed
          ? "You do not have access to this campground."
          : approvalsQuery.isError
            ? getErrorMessage(approvalsQuery.error, "Failed to load approvals.")
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
      {/* Skip link for accessibility */}
      <a
        href="#approvals-table"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
      >
        Skip to approvals table
      </a>

      <Breadcrumbs
        items={[
          { label: "Finance", href: "/finance" },
          { label: "Approvals", href: "/approvals" },
        ]}
      />

      <div className="mb-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Approvals</h1>
            <p className="text-sm text-muted-foreground">
              Dual control for refunds, payouts, and high-value changes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2 sm:mt-0">
            <Badge variant="secondary" className="font-normal">
              Scope: {scopeLabel}
            </Badge>
            <span className="hidden sm:inline">|</span>
            <span>{approverName}</span>
          </div>
        </div>
      </div>

      {/* Queue Cleared Celebration */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            onClick={() => setShowCelebration(false)}
          >
            <motion.div initial={{ y: 20 }} animate={{ y: 0 }} className="text-center p-8">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <PartyPopper className="h-10 w-10 text-emerald-600" />
              </motion.div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Queue cleared!</h2>
              <p className="text-muted-foreground">All approval requests have been processed.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Approvals queue</CardTitle>
                <CardDescription>
                  Review requests scoped to the selected campground or organization.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
                  <span className="text-sm font-medium text-foreground">{openCount}</span>
                  <span className="text-xs text-muted-foreground">Open</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-200 px-3 py-1.5">
                  <span className="text-sm font-semibold text-amber-700">
                    {summary.pendingSecond}
                  </span>
                  <span className="text-xs text-amber-700">Needs 2nd</span>
                </div>
                {summary.urgent > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="flex items-center gap-1.5 rounded-lg bg-red-100 border border-red-200 px-3 py-1.5"
                  >
                    <span className="text-sm font-bold text-red-700">{summary.urgent}</span>
                    <span className="text-xs text-red-700">Urgent</span>
                  </motion.div>
                )}
                <span className="text-xs text-muted-foreground">{summary.total} total</span>
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
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger id="status-filter" aria-label="Filter by status">
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
                  <Label htmlFor="type-filter">Type</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger id="type-filter" aria-label="Filter by request type">
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
                  className="transition-all hover:scale-105 active:scale-95"
                >
                  {approvalsQuery.isFetching ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-1.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Showing {filteredRequests.length} of {requests.length} requests
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden space-y-3">
              {isLoading && (
                <>
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 flex-1" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </>
              )}
              {tableMessage && (
                <div className="text-center py-8 text-muted-foreground" role="status">
                  {tableMessage}
                </div>
              )}
              {!isLoading && !tableMessage && filteredRequests.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-status-success-bg rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="h-8 w-8 text-status-success" />
                  </div>
                  <p className="font-medium text-foreground">All caught up!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    No approvals match the current filters.
                  </p>
                  {(statusFilter !== "open" || typeFilter !== "all" || urgentOnly || search) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setStatusFilter("open");
                        setTypeFilter("all");
                        setUrgentOnly(false);
                        setSearch("");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              )}
              {!isLoading &&
                !tableMessage &&
                filteredRequests.map(({ req, policy, urgent, isOpen }) => {
                  const reason = rejectionReasons[req.id] ?? "";
                  const trimmedReason = reason.trim();
                  const alreadyApproved =
                    approverKeys.length > 0 &&
                    req.approvals.some((a) => approverKeys.includes(a.approver));
                  const isMutating = processingId === req.id;
                  const approveDisabled = !canAct || !isOpen || alreadyApproved || isMutating;

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "rounded-lg border p-4 space-y-3 transition-colors",
                        urgent && "border-amber-400 bg-amber-50/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <TypeIcon type={req.type} />
                          <span className="font-medium capitalize">{formatLabel(req.type)}</span>
                          {urgent && (
                            <Badge variant="warning" className="text-[10px]">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <Badge
                          variant={statusVariant(req.status)}
                          className="text-[10px] flex items-center gap-1"
                        >
                          <StatusIcon status={req.status} />
                          {formatLabel(req.status)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs block">Requester</span>
                          <span className="font-medium text-foreground">
                            {req.requester || "Unknown"}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-xs block">Amount</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {formatAmount(req.amount, req.currency)}
                          </span>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{req.reason}</p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          {req.approvals.length}/{req.requiredApprovals} approvals ·{" "}
                          {formatRelativeTime(req.createdAt)}
                        </span>
                      </div>

                      {isOpen && (
                        <div className="flex gap-2 pt-2">
                          <Button
                            className={cn(
                              "flex-1 transition-all",
                              !approveDisabled &&
                                "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02] active:scale-[0.98]",
                            )}
                            disabled={approveDisabled}
                            onClick={() =>
                              approveMutation.mutate({ id: req.id, approver: approverId })
                            }
                          >
                            {isMutating && approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-1.5" />
                            )}
                            Approve
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="flex-1 text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4 mr-1.5" />
                                Reject
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-3" align="end">
                              <div className="space-y-2">
                                <Label
                                  htmlFor={`reject-reason-mobile-${req.id}`}
                                  className="text-xs font-medium"
                                >
                                  Rejection reason (required)
                                </Label>
                                <Input
                                  id={`reject-reason-mobile-${req.id}`}
                                  value={reason}
                                  onChange={(e) =>
                                    setRejectionReasons((prev) => ({
                                      ...prev,
                                      [req.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Enter reason..."
                                  className="h-8 text-sm"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="w-full h-8"
                                  onClick={() =>
                                    rejectMutation.mutate({
                                      id: req.id,
                                      approver: approverId,
                                      reason: trimmedReason,
                                    })
                                  }
                                  disabled={!trimmedReason || isMutating}
                                >
                                  {isMutating && rejectMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                  ) : null}
                                  Confirm Rejection
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto" id="approvals-table" tabIndex={-1}>
              <Table ref={tableRef}>
                <caption className="sr-only">
                  Financial approvals queue showing {filteredRequests.length} requests.
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Type</TableHead>
                    <TableHead scope="col">Requested</TableHead>
                    <TableHead scope="col">Reason</TableHead>
                    <TableHead scope="col" className="text-right">
                      Amount
                    </TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Approvals</TableHead>
                    <TableHead scope="col">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <>
                      <ApprovalRowSkeleton />
                      <ApprovalRowSkeleton />
                      <ApprovalRowSkeleton />
                    </>
                  )}
                  {tableMessage && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div role="status" aria-live="polite" className="text-muted-foreground">
                          {tableMessage}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && !tableMessage && filteredRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32">
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="rounded-full bg-emerald-100 p-3 mb-3">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                          </div>
                          <p className="text-sm font-medium text-foreground">All caught up!</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            No approvals match the current filters.
                          </p>
                          {(statusFilter !== "open" ||
                            typeFilter !== "all" ||
                            urgentOnly ||
                            search) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs"
                              onClick={() => {
                                setStatusFilter("open");
                                setTypeFilter("all");
                                setUrgentOnly(false);
                                setSearch("");
                              }}
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  <AnimatePresence mode="popLayout">
                    {!isLoading &&
                      !tableMessage &&
                      filteredRequests.map(({ req, policy, urgent, isOpen }, index) => {
                        const reason = rejectionReasons[req.id] ?? "";
                        const trimmedReason = reason.trim();
                        const alreadyApproved =
                          approverKeys.length > 0 &&
                          req.approvals.some((a) => approverKeys.includes(a.approver));
                        const isMutating = processingId === req.id;
                        const approveDisabled = !canAct || !isOpen || alreadyApproved || isMutating;
                        const rejectDisabled = approveDisabled || !trimmedReason;
                        let actionHint: string | null = null;

                        if (!canAct) {
                          actionHint = "Manager or admin role required.";
                        } else if (alreadyApproved) {
                          actionHint = "You already approved this request.";
                        }

                        return (
                          <motion.tr
                            key={req.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ ...SPRING_CONFIG, delay: index * 0.02 }}
                            className={cn(
                              "border-b transition-colors",
                              urgent
                                ? "bg-amber-50/50 border-l-4 border-l-amber-400"
                                : "hover:bg-muted/50",
                            )}
                          >
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <TypeIcon type={req.type} />
                                <span className="font-medium capitalize text-foreground">
                                  {formatLabel(req.type)}
                                </span>
                                {urgent && (
                                  <Badge
                                    variant="warning"
                                    className="text-[10px] flex items-center gap-1"
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    Urgent
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="text-sm font-medium text-foreground">
                                {req.requester || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatRelativeTime(req.createdAt)}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs text-sm text-muted-foreground py-3">
                              {req.reason}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium text-foreground py-3">
                              {formatAmount(req.amount, req.currency)}
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge
                                variant={statusVariant(req.status)}
                                className="flex items-center gap-1 w-fit"
                              >
                                <StatusIcon status={req.status} />
                                {formatLabel(req.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="text-xs text-muted-foreground">
                                {req.approvals.length}/{req.requiredApprovals} approvals
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {req.approvals.length
                                  ? req.approvals
                                      .map((a) => `${a.approver} (${formatDateTime(a.at)})`)
                                      .join(", ")
                                  : "None yet"}
                              </div>
                              {policy && (
                                <div className="text-xs text-muted-foreground">
                                  Policy: {policy.name}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className={cn(
                                    "transition-all duration-150",
                                    !approveDisabled && [
                                      "bg-emerald-600 hover:bg-emerald-700 text-white",
                                      "hover:scale-105 active:scale-95",
                                    ],
                                  )}
                                  onClick={() =>
                                    approveMutation.mutate({ id: req.id, approver: approverId })
                                  }
                                  disabled={approveDisabled}
                                  aria-label={`Approve ${formatLabel(req.type)} request from ${req.requester || "Unknown"} for ${formatAmount(req.amount, req.currency)}`}
                                >
                                  {isMutating && approveMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4 mr-1" />
                                  )}
                                  Approve
                                </Button>
                                {isOpen && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn(
                                          "transition-all duration-150",
                                          !approveDisabled &&
                                            "hover:bg-red-50 hover:text-red-700 hover:border-red-300 hover:scale-105 active:scale-95",
                                        )}
                                        disabled={approveDisabled}
                                        aria-label={`Reject ${formatLabel(req.type)} request from ${req.requester || "Unknown"}`}
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        Reject
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-3" align="end">
                                      <div className="space-y-3">
                                        <div className="space-y-1">
                                          <Label
                                            htmlFor={`reject-reason-${req.id}`}
                                            className="text-xs font-medium"
                                          >
                                            Rejection reason (required)
                                          </Label>
                                          <Input
                                            id={`reject-reason-${req.id}`}
                                            value={reason}
                                            onChange={(e) =>
                                              setRejectionReasons((prev) => ({
                                                ...prev,
                                                [req.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="Enter reason..."
                                            className="h-9"
                                            aria-required="true"
                                          />
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          className="w-full"
                                          onClick={() =>
                                            rejectMutation.mutate({
                                              id: req.id,
                                              approver: approverId,
                                              reason: trimmedReason,
                                            })
                                          }
                                          disabled={rejectDisabled || isMutating}
                                        >
                                          {isMutating && rejectMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                          ) : (
                                            <XCircle className="h-4 w-4 mr-1.5" />
                                          )}
                                          Confirm Rejection
                                        </Button>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                              {actionHint && (
                                <div className="text-xs text-muted-foreground mt-1.5">
                                  {actionHint}
                                </div>
                              )}
                              {!isOpen && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  No actions available.
                                </div>
                              )}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Policies
                </CardTitle>
                <CardDescription>Rules that trigger dual control</CardDescription>
              </div>
              {canAct && (
                <Sheet open={policySheetOpen} onOpenChange={setPolicySheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={openPolicyCreate}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>{editingPolicy ? "Edit Policy" : "Create Policy"}</SheetTitle>
                      <SheetDescription>
                        {editingPolicy
                          ? "Update the approval policy settings."
                          : "Define when dual control is required for sensitive operations."}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="policy-name">Policy Name *</Label>
                        <Input
                          id="policy-name"
                          value={policyForm.name}
                          onChange={(e) =>
                            setPolicyForm((prev) => ({ ...prev, name: e.target.value }))
                          }
                          placeholder="e.g., Refunds over $250"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Applies To *</Label>
                        <div className="flex flex-wrap gap-2">
                          {ACTION_TYPES.map((type) => (
                            <label
                              key={type}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                                policyForm.appliesTo.includes(type)
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-border hover:border-border",
                              )}
                            >
                              <Checkbox
                                checked={policyForm.appliesTo.includes(type)}
                                onCheckedChange={(checked) => {
                                  setPolicyForm((prev) => ({
                                    ...prev,
                                    appliesTo: checked
                                      ? [...prev.appliesTo, type]
                                      : prev.appliesTo.filter((t) => t !== type),
                                  }));
                                }}
                              />
                              <span className="text-sm capitalize">{type.replace(/_/g, " ")}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="policy-threshold">Threshold ($)</Label>
                          <Input
                            id="policy-threshold"
                            type="number"
                            min="0"
                            step="0.01"
                            value={policyForm.thresholdCents}
                            onChange={(e) =>
                              setPolicyForm((prev) => ({ ...prev, thresholdCents: e.target.value }))
                            }
                            placeholder="e.g., 250"
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty for all amounts
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="policy-approvers">Approvers Needed</Label>
                          <Select
                            value={policyForm.approversNeeded}
                            onValueChange={(value) =>
                              setPolicyForm((prev) => ({ ...prev, approversNeeded: value }))
                            }
                          >
                            <SelectTrigger id="policy-approvers">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 approver</SelectItem>
                              <SelectItem value="2">2 approvers</SelectItem>
                              <SelectItem value="3">3 approvers</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Who Can Approve</Label>
                        <div className="flex flex-wrap gap-2">
                          {ROLE_OPTIONS.map((role) => (
                            <label
                              key={role.value}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer transition-all text-sm",
                                policyForm.approverRoles.includes(role.value)
                                  ? "border-emerald-500 bg-emerald-50"
                                  : "border-border hover:border-border",
                              )}
                            >
                              <Checkbox
                                checked={policyForm.approverRoles.includes(role.value)}
                                onCheckedChange={(checked) => {
                                  setPolicyForm((prev) => ({
                                    ...prev,
                                    approverRoles: checked
                                      ? [...prev.approverRoles, role.value]
                                      : prev.approverRoles.filter((r) => r !== role.value),
                                  }));
                                }}
                              />
                              {role.label}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="policy-description">Description</Label>
                        <Textarea
                          id="policy-description"
                          value={policyForm.description}
                          onChange={(e) =>
                            setPolicyForm((prev) => ({ ...prev, description: e.target.value }))
                          }
                          placeholder="Explain when and why this policy applies..."
                          rows={3}
                        />
                      </div>

                      {editingPolicy && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <Label htmlFor="policy-active">Policy Active</Label>
                          <Switch
                            id="policy-active"
                            checked={policyForm.isActive}
                            onCheckedChange={(checked) =>
                              setPolicyForm((prev) => ({ ...prev, isActive: checked }))
                            }
                          />
                        </div>
                      )}
                    </div>
                    <SheetFooter className="flex gap-2 sm:justify-end">
                      <SheetClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </SheetClose>
                      <Button
                        onClick={handlePolicySubmit}
                        disabled={createPolicyMutation.isPending || updatePolicyMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {(createPolicyMutation.isPending || updatePolicyMutation.isPending) && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        {editingPolicy ? "Save Changes" : "Create Policy"}
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {policiesMessage && (
              <div className="text-xs text-muted-foreground">{policiesMessage}</div>
            )}
            {!policiesMessage && policies.length === 0 && (
              <div className="text-center py-6">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No policies configured</p>
                {canAct && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={openPolicyCreate}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create your first policy
                  </Button>
                )}
              </div>
            )}
            {!policiesMessage &&
              policies.map((policy) => (
                <div
                  key={policy.id}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 space-y-1.5 transition-all",
                    policy.isActive !== false
                      ? "bg-muted/50"
                      : "bg-muted/20 border-dashed opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {policy.name}
                        </span>
                        {policy.isActive === false && (
                          <Badge variant="secondary" className="text-[10px]">
                            Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="secondary" className="text-[10px]">
                        {policy.approversNeeded} approvers
                      </Badge>
                      {canAct && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            aria-label="Edit policy"
                            onClick={() => openPolicyEdit(policy)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Popover
                            open={deleteConfirmId === policy.id}
                            onOpenChange={(open) => setDeleteConfirmId(open ? policy.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                aria-label="Delete policy"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end">
                              <p className="text-sm mb-3">Delete this policy?</p>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deletePolicyMutation.mutate(policy.id)}
                                  disabled={deletePolicyMutation.isPending}
                                >
                                  {deletePolicyMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Delete"
                                  )}
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {policy.appliesTo.map((type) => (
                      <span
                        key={type}
                        className="text-[10px] uppercase tracking-wide text-muted-foreground bg-background px-1.5 py-0.5 rounded"
                      >
                        {type.replace(/_/g, " ")}
                      </span>
                    ))}
                    {policy.thresholdCents && (
                      <span className="text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                        ≥ ${(policy.thresholdCents / 100).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {policy.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {policy.description}
                    </p>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Queue preferences</CardTitle>
            <CardDescription>Customize urgency rules and sorting for this browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Urgency rules
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="urgent-pending-second">Pending second approvals</Label>
                <Switch
                  id="urgent-pending-second"
                  checked={preferences.urgentPendingSecond}
                  onCheckedChange={(checked) =>
                    setPreferences((prev) => ({ ...prev, urgentPendingSecond: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="urgent-age-hours">Older than (hours)</Label>
                <Input
                  id="urgent-age-hours"
                  type="number"
                  min="0"
                  step="1"
                  value={preferences.urgentAgeHours}
                  onChange={(e) =>
                    setPreferences((prev) => ({ ...prev, urgentAgeHours: e.target.value }))
                  }
                  className="w-24"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="urgent-policy-threshold">Above policy threshold</Label>
                <Switch
                  id="urgent-policy-threshold"
                  checked={preferences.urgentPolicyThreshold}
                  onCheckedChange={(checked) =>
                    setPreferences((prev) => ({ ...prev, urgentPolicyThreshold: checked }))
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="urgent-custom-toggle">Above custom amount</Label>
                  <Switch
                    id="urgent-custom-toggle"
                    checked={preferences.urgentCustomAmountEnabled}
                    onCheckedChange={(checked) =>
                      setPreferences((prev) => ({ ...prev, urgentCustomAmountEnabled: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Custom amount ({sampleCurrency})
                  </span>
                  <Input
                    id="urgent-custom-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preferences.urgentCustomAmount}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, urgentCustomAmount: e.target.value }))
                    }
                    className="w-28"
                    disabled={!preferences.urgentCustomAmountEnabled}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort-order">Sort order</Label>
              <Select
                value={preferences.sortMode}
                onValueChange={(value) => {
                  if (isSortMode(value)) {
                    setPreferences((prev) => ({ ...prev, sortMode: value }));
                  }
                }}
              >
                <SelectTrigger id="sort-order" aria-label="Sort order for approvals queue">
                  <SelectValue placeholder="Choose sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent first</SelectItem>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Preferences are saved locally for this browser.
            </div>
          </CardContent>
        </Card>

        <Card className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Access</CardTitle>
            <CardDescription>Approvals require admin or manager roles in scope.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="text-foreground font-medium">{approverName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Role</span>
              <span className="text-foreground font-medium">{roleLabel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Scope</span>
              <span className="text-foreground font-medium">{scopeLabel}</span>
            </div>
            <Badge
              variant={whoamiLoading ? "secondary" : canAct ? "success" : "warning"}
              className="mt-2"
            >
              {whoamiLoading
                ? "Checking access"
                : canAct
                  ? "Can approve requests"
                  : "Approval restricted"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Live region for screen reader announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </DashboardShell>
  );
}
