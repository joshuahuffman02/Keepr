"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Gift,
  Trash2,
  Percent,
  Send,
  RotateCcw,
  ShoppingCart,
  Calendar,
  FileText,
  DollarSign,
  ClipboardList,
  Inbox,
  Loader2,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

type Override = {
  id: string;
  type: string;
  status: string;
  reason?: string | null;
  targetEntity?: string | null;
  targetId?: string | null;
  deltaAmount?: number | null;
  createdAt?: string;
};

type FormErrors = {
  type?: string;
  reason?: string;
  targetEntity?: string;
  targetId?: string;
  deltaAmount?: string;
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 20,
};

const targetEntityOptions = [
  { value: "pos_ticket", label: "Store Purchase", icon: ShoppingCart, description: "Point of sale transaction" },
  { value: "reservation", label: "Reservation", icon: Calendar, description: "Campsite booking" },
  { value: "invoice", label: "Invoice", icon: FileText, description: "Billing invoice" },
];

const requestTypes = [
  { value: "comp", label: "Comp", icon: Gift, description: "Complimentary - waive full charge", color: "text-purple-600 dark:text-purple-400" },
  { value: "void", label: "Void", icon: Trash2, description: "Cancel this transaction", color: "text-red-600 dark:text-red-400" },
  { value: "discount", label: "Discount", icon: Percent, description: "Apply a price reduction", color: "text-blue-600 dark:text-blue-400" },
];

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  pending: {
    icon: Clock,
    label: "Pending",
    className: "bg-status-warning/15 text-status-warning border-status-warning/30"
  },
  approved: {
    icon: CheckCircle2,
    label: "Approved",
    className: "bg-status-success/15 text-status-success border-status-success/30"
  },
  rejected: {
    icon: XCircle,
    label: "Rejected",
    className: "bg-status-error/15 text-status-error border-status-error/30"
  },
};

export default function OverridesPage({ params }: { params: { campgroundId: string } }) {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [form, setForm] = useState({
    type: "comp",
    reason: "",
    targetEntity: "",
    targetId: "",
    deltaAmount: ""
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff/overrides?campgroundId=${params.campgroundId}`);
      if (res.ok) {
        setOverrides(await res.json());
      }
    } catch {
      // Silent fail for list load
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.type) {
      newErrors.type = "Please select a request type";
    }

    if (!form.reason.trim()) {
      newErrors.reason = "Please explain why this is needed";
    } else if (form.reason.trim().length < 10) {
      newErrors.reason = "Please provide more detail (at least 10 characters)";
    }

    if (!form.targetEntity) {
      newErrors.targetEntity = "Please select what this applies to";
    }

    if (!form.targetId.trim()) {
      newErrors.targetId = "Please enter the ID or reference number";
    }

    if ((form.type === "comp" || form.type === "discount") && form.deltaAmount) {
      const amount = parseFloat(form.deltaAmount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.deltaAmount = "Please enter a valid amount";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async () => {
    if (!validateForm()) return;

    setSubmitStatus("loading");
    setStatusMessage(null);

    try {
      const res = await fetch("/api/staff/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campgroundId: params.campgroundId,
          type: form.type,
          reason: form.reason,
          targetEntity: form.targetEntity,
          targetId: form.targetId,
          deltaAmount: form.deltaAmount ? parseFloat(form.deltaAmount) : undefined
        })
      });

      if (res.ok) {
        setSubmitStatus("success");
        setStatusMessage("Your request has been sent for approval");
        setForm({ type: "comp", reason: "", targetEntity: "", targetId: "", deltaAmount: "" });
        setErrors({});
        await load();

        // Reset success state after a moment
        setTimeout(() => {
          setSubmitStatus("idle");
          setStatusMessage(null);
        }, 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitStatus("error");
        setStatusMessage(data.message || "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitStatus("error");
      setStatusMessage("Unable to connect. Please check your connection and try again.");
    }
  };

  const resetForm = () => {
    setForm({ type: "comp", reason: "", targetEntity: "", targetId: "", deltaAmount: "" });
    setErrors({});
    setSubmitStatus("idle");
    setStatusMessage(null);
  };

  const selectedType = requestTypes.find(t => t.value === form.type);
  const selectedEntity = targetEntityOptions.find(e => e.value === form.targetEntity);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_CONFIG}
        >
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-400">
              Staff
            </p>
            <h1 className="text-2xl font-bold text-foreground">Request Approval</h1>
            <p className="text-muted-foreground text-sm">
              Need a comp, void, or discount? Submit your request here for manager review.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/campgrounds/${params.campgroundId}/staff/timeclock`}
              className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
            >
              Time clock
            </Link>
            <Link
              href={`/campgrounds/${params.campgroundId}/staff/approvals`}
              className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
            >
              My Approvals
            </Link>
          </div>
        </motion.div>

        {/* Request Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.05 }}
        >
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <CardTitle className="text-foreground">New Request</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Fill out the details below and a manager will review it shortly.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Request Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">What do you need?</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {requestTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = form.type === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, type: type.value });
                          setErrors({ ...errors, type: undefined });
                        }}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 text-left transition-all",
                          isSelected
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-500"
                            : "border-border bg-background hover:border-muted-foreground/30 hover:bg-muted/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", type.color)} />
                        <div>
                          <div className={cn(
                            "font-medium",
                            isSelected ? "text-foreground" : "text-foreground"
                          )}>
                            {type.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.type && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.type}
                  </p>
                )}
              </div>

              {/* Amount Field (for comp/discount) */}
              <AnimatePresence>
                {(form.type === "comp" || form.type === "discount") && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <label className="text-sm font-medium text-foreground">
                      {form.type === "comp" ? "Amount to comp" : "Discount amount"}
                      <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                    </label>
                    <div className="relative max-w-xs">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.deltaAmount}
                        onChange={(e) => {
                          setForm({ ...form, deltaAmount: e.target.value });
                          setErrors({ ...errors, deltaAmount: undefined });
                        }}
                        placeholder="0.00"
                        className={cn(
                          "pl-9 bg-background border-border text-foreground",
                          errors.deltaAmount && "border-red-500 focus:ring-red-500"
                        )}
                      />
                    </div>
                    {errors.deltaAmount && (
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {errors.deltaAmount}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Target Entity & ID */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">What does this apply to?</label>
                  <Select
                    value={form.targetEntity}
                    onValueChange={(v) => {
                      setForm({ ...form, targetEntity: v });
                      setErrors({ ...errors, targetEntity: undefined });
                    }}
                  >
                    <SelectTrigger className={cn(
                      "bg-background border-border text-foreground",
                      errors.targetEntity && "border-red-500"
                    )}>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {targetEntityOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selectedEntity && (
                    <p className="text-xs text-muted-foreground">{selectedEntity.description}</p>
                  )}
                  {errors.targetEntity && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.targetEntity}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {selectedEntity?.label || "Item"} ID or reference
                  </label>
                  <Input
                    value={form.targetId}
                    onChange={(e) => {
                      setForm({ ...form, targetId: e.target.value });
                      setErrors({ ...errors, targetId: undefined });
                    }}
                    placeholder={
                      form.targetEntity === "reservation"
                        ? "e.g., RES-12345"
                        : form.targetEntity === "invoice"
                        ? "e.g., INV-2024-001"
                        : "e.g., TKT-98765"
                    }
                    className={cn(
                      "bg-background border-border text-foreground",
                      errors.targetId && "border-red-500 focus:ring-red-500"
                    )}
                  />
                  {errors.targetId && (
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.targetId}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Why is this needed?</label>
                <Input
                  value={form.reason}
                  onChange={(e) => {
                    setForm({ ...form, reason: e.target.value });
                    setErrors({ ...errors, reason: undefined });
                  }}
                  placeholder="Explain the situation so the manager has context..."
                  className={cn(
                    "bg-background border-border text-foreground",
                    errors.reason && "border-red-500 focus:ring-red-500"
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Include relevant details like guest name, incident reference, or receipt number.
                </p>
                {errors.reason && (
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.reason}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={submit}
                  disabled={submitStatus === "loading"}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="override-submit"
                >
                  {submitStatus === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Request
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={resetForm}
                  disabled={submitStatus === "loading"}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear Form
                </Button>
              </div>

              {/* Status Message */}
              <AnimatePresence>
                {statusMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-4 py-3",
                      submitStatus === "success"
                        ? "bg-status-success/15 text-status-success border border-status-success/30"
                        : "bg-status-error/15 text-status-error border border-status-error/30"
                    )}
                  >
                    {submitStatus === "success" ? (
                      <Sparkles className="h-5 w-5 text-status-success" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-status-error" />
                    )}
                    <span className="text-sm font-medium">{statusMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Requests Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <CardTitle className="text-foreground">Your Recent Requests</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Track the status of your submitted requests.
                    </CardDescription>
                  </div>
                </div>
                {overrides.length > 0 && (
                  <Badge variant="secondary" className="text-[11px] bg-muted text-muted-foreground">
                    {overrides.length} request{overrides.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Loading your requests...</span>
                </div>
              ) : overrides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="rounded-full bg-muted p-3 mb-3">
                    <Inbox className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No requests yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When you submit a request, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {overrides.map((o, index) => {
                    const status = statusConfig[o.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    const typeInfo = requestTypes.find(t => t.value === o.type);
                    const TypeIcon = typeInfo?.icon || Gift;
                    const entityInfo = targetEntityOptions.find(e => e.value === o.targetEntity);

                    return (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: index * 0.03 }}
                        className="px-4 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg",
                              "bg-muted"
                            )}>
                              <TypeIcon className={cn("h-4 w-4", typeInfo?.color || "text-muted-foreground")} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium capitalize text-foreground">
                                {o.type}
                                {entityInfo && (
                                  <span className="text-muted-foreground font-normal ml-1.5">
                                    for {entityInfo.label.toLowerCase()}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {o.reason || "No reason provided"}
                                {o.targetId && (
                                  <span className="ml-1 text-muted-foreground/70">
                                    ({o.targetId})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn("shrink-0 gap-1", status.className)}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardShell>
  );
}
