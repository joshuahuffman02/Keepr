"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, Calendar, Clock, AlertCircle, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface CancellationPolicy {
  id: string;
  name: string;
  description?: string;
  rules: Array<{
    daysBeforeArrival: number;
    refundPercent: number;
    description?: string;
  }>;
  noShowPenaltyPercent?: number;
}

interface CancellationPolicyCardProps {
  policy?: CancellationPolicy | null;
  arrivalDate: string;
  totalCents: number;
  className?: string;
  variant?: "compact" | "full";
}

// Default flexible policy if none specified
const DEFAULT_POLICY: CancellationPolicy = {
  id: "default",
  name: "Standard Cancellation Policy",
  rules: [
    { daysBeforeArrival: 7, refundPercent: 100, description: "Full refund" },
    { daysBeforeArrival: 3, refundPercent: 50, description: "50% refund" },
    { daysBeforeArrival: 0, refundPercent: 0, description: "No refund" },
  ],
  noShowPenaltyPercent: 100,
};

export function CancellationPolicyCard({
  policy,
  arrivalDate,
  totalCents,
  className,
  variant = "full"
}: CancellationPolicyCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const activePolicy = policy || DEFAULT_POLICY;

  // Calculate key dates and refund amounts
  const policyDetails = useMemo(() => {
    const arrival = new Date(arrivalDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    arrival.setHours(0, 0, 0, 0);

    const daysUntilArrival = Math.ceil(
      (arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Sort rules by days before arrival (descending)
    const sortedRules = [...activePolicy.rules].sort(
      (a, b) => b.daysBeforeArrival - a.daysBeforeArrival
    );

    // Find current applicable rule
    const currentRule = sortedRules.find(
      (rule) => daysUntilArrival >= rule.daysBeforeArrival
    ) || sortedRules[sortedRules.length - 1];

    // Calculate deadline for free cancellation
    const freeCancellationRule = sortedRules.find((r) => r.refundPercent === 100);
    let freeCancellationDeadline: Date | null = null;
    let daysUntilDeadline = 0;

    if (freeCancellationRule) {
      freeCancellationDeadline = new Date(arrival);
      freeCancellationDeadline.setDate(
        freeCancellationDeadline.getDate() - freeCancellationRule.daysBeforeArrival
      );
      daysUntilDeadline = Math.ceil(
        (freeCancellationDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      daysUntilArrival,
      currentRule,
      currentRefundAmount: Math.round((totalCents * currentRule.refundPercent) / 100),
      freeCancellationDeadline,
      daysUntilDeadline,
      canCancelFree: currentRule.refundPercent === 100,
      sortedRules,
    };
  }, [arrivalDate, totalCents, activePolicy]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  if (variant === "compact") {
    return (
      <motion.div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg",
          policyDetails.canCancelFree
            ? "bg-emerald-50 border border-emerald-200"
            : "bg-amber-50 border border-amber-200",
          className
        )}
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        <div
          className={cn(
            "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center",
            policyDetails.canCancelFree ? "bg-emerald-100" : "bg-amber-100"
          )}
        >
          {policyDetails.canCancelFree ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium",
              policyDetails.canCancelFree ? "text-emerald-800" : "text-amber-800"
            )}
          >
            {policyDetails.canCancelFree
              ? "Free cancellation available"
              : `${policyDetails.currentRule.refundPercent}% refund if cancelled now`}
          </p>
          {policyDetails.freeCancellationDeadline && policyDetails.daysUntilDeadline > 0 && (
            <p className="text-xs text-muted-foreground">
              Until {formatDate(policyDetails.freeCancellationDeadline)}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        "rounded-xl border bg-card overflow-hidden",
        className
      )}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-muted border-b border-border">
        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{activePolicy.name}</h3>
          <p className="text-sm text-muted-foreground">Review before booking</p>
        </div>
      </div>

      {/* Current status banner */}
      <div
        className={cn(
          "px-4 py-3 border-b",
          policyDetails.canCancelFree
            ? "bg-emerald-50 border-emerald-100"
            : "bg-amber-50 border-amber-100"
        )}
      >
        <div className="flex items-center gap-2">
          {policyDetails.canCancelFree ? (
            <>
              <Check className="h-5 w-5 text-emerald-600" />
              <span className="font-medium text-emerald-800">
                Free cancellation until{" "}
                {policyDetails.freeCancellationDeadline
                  ? formatDate(policyDetails.freeCancellationDeadline)
                  : "check-in"}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800">
                {policyDetails.currentRule.refundPercent === 0
                  ? "Non-refundable at this time"
                  : `${policyDetails.currentRule.refundPercent}% refund (${formatCurrency(policyDetails.currentRefundAmount)}) if cancelled now`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Policy rules timeline */}
      <div className="p-4">
        <div className="space-y-0">
          {policyDetails.sortedRules.map((rule, idx) => {
            const ruleDate = new Date(arrivalDate);
            ruleDate.setDate(ruleDate.getDate() - rule.daysBeforeArrival);
            const isActive = policyDetails.currentRule === rule;
            const isPast = new Date() > ruleDate;

            return (
              <div key={idx} className="relative">
                {/* Connector line */}
                {idx < policyDetails.sortedRules.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-[11px] top-6 w-0.5 h-8",
                      isPast ? "bg-muted" : "bg-muted"
                    )}
                  />
                )}

                <div className="flex items-start gap-3 py-2">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-0.5",
                      isActive
                        ? rule.refundPercent === 100
                          ? "bg-emerald-500"
                          : rule.refundPercent > 0
                          ? "bg-amber-500"
                          : "bg-red-500"
                        : "bg-muted"
                    )}
                  >
                    {rule.refundPercent === 100 ? (
                      <Check className={cn("h-3 w-3", isActive ? "text-white" : "text-muted-foreground")} />
                    ) : (
                      <span className={cn("text-xs font-medium", isActive ? "text-white" : "text-muted-foreground")}>
                        {rule.refundPercent}%
                      </span>
                    )}
                  </div>

                  {/* Rule content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                        {rule.daysBeforeArrival === 0
                          ? "Day of arrival"
                          : rule.daysBeforeArrival === 1
                          ? "1 day before"
                          : `${rule.daysBeforeArrival}+ days before`}
                      </span>
                      {isActive && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rule.refundPercent === 100
                        ? "Full refund"
                        : rule.refundPercent === 0
                        ? "No refund"
                        : `${rule.refundPercent}% refund (${formatCurrency(Math.round((totalCents * rule.refundPercent) / 100))})`}
                    </p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="text-right text-sm text-muted-foreground">
                    {formatDate(ruleDate)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* No-show penalty */}
        {activePolicy.noShowPenaltyPercent && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2 text-sm">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                No-shows are charged {activePolicy.noShowPenaltyPercent}% of the reservation total.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
