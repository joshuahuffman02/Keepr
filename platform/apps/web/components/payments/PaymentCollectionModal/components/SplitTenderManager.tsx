"use client";

import React from "react";
import { Button } from "../../../ui/button";
import {
  X,
  CreditCard,
  Banknote,
  Wallet,
  Gift,
  Receipt,
  Home,
  Building,
  Smartphone,
  FileText,
  Lock,
} from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { PaymentMethodType, PAYMENT_METHOD_INFO, TenderEntry } from "../context/types";
import { cn } from "../../../../lib/utils";

interface SplitTenderManagerProps {
  onAddPayment: () => void;
  disabled?: boolean;
}

export function SplitTenderManager({
  onAddPayment,
  disabled = false,
}: SplitTenderManagerProps) {
  const { state, actions } = usePaymentContext();
  const { tenderEntries, remainingCents, totalDueCents } = state;

  if (tenderEntries.length === 0) {
    return null;
  }

  const completedEntries = tenderEntries.filter((e) => e.status === "completed");
  const totalPaid = completedEntries.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Split Payment</h3>
        <span className="text-sm text-muted-foreground">
          {completedEntries.length} payment{completedEntries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tender entries list */}
      <div className="space-y-2">
        {tenderEntries.map((entry) => (
          <TenderEntryRow
            key={entry.id}
            entry={entry}
            onRemove={() => actions.removeTenderEntry(entry.id)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${(totalPaid / totalDueCents) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Paid: ${(totalPaid / 100).toFixed(2)}
          </span>
          <span className={cn(
            "font-medium",
            remainingCents > 0 ? "text-amber-600" : "text-emerald-600"
          )}>
            {remainingCents > 0
              ? `Remaining: $${(remainingCents / 100).toFixed(2)}`
              : "Fully paid"}
          </span>
        </div>
      </div>

      {/* Add another payment button */}
      {remainingCents > 0 && (
        <Button
          variant="outline"
          onClick={onAddPayment}
          disabled={disabled}
          className="w-full"
        >
          Add Another Payment
        </Button>
      )}
    </div>
  );
}

interface TenderEntryRowProps {
  entry: TenderEntry;
  onRemove: () => void;
  disabled?: boolean;
}

function TenderEntryRow({ entry, onRemove, disabled }: TenderEntryRowProps) {
  const methodInfo = PAYMENT_METHOD_INFO[entry.method];
  const Icon = getMethodIcon(entry.method);

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border",
        entry.status === "completed"
          ? "bg-emerald-50 border-emerald-200"
          : entry.status === "failed"
          ? "bg-red-50 border-red-200"
          : "bg-muted border-border"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center",
            entry.status === "completed"
              ? "bg-status-success-bg text-status-success"
              : entry.status === "failed"
              ? "bg-status-error-bg text-status-error"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p
            className={cn(
              "font-medium text-sm",
              entry.status === "completed"
                ? "text-emerald-800"
                : entry.status === "failed"
                ? "text-red-800"
                : "text-foreground"
            )}
          >
            {methodInfo.label}
          </p>
          {entry.reference && (
            <p className="text-xs text-muted-foreground font-mono">
              {formatReference(entry.method, entry.reference)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-medium",
            entry.status === "completed"
              ? "text-emerald-700"
              : entry.status === "failed"
              ? "text-red-700"
              : "text-foreground"
          )}
        >
          ${(entry.amountCents / 100).toFixed(2)}
        </span>
        {entry.status === "completed" && !disabled && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-6 w-6 text-muted-foreground hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function getMethodIcon(method: PaymentMethodType) {
  switch (method) {
    case "card":
    case "saved_card":
    case "terminal":
      return CreditCard;
    case "apple_pay":
    case "google_pay":
    case "link":
      return Smartphone;
    case "cash":
      return Banknote;
    case "check":
      return FileText;
    case "guest_wallet":
      return Wallet;
    case "gift_card":
      return Gift;
    case "folio":
      return Home;
    case "ach":
      return Building;
    case "deposit_hold":
      return Lock;
    case "external_pos":
      return Receipt;
    default:
      return CreditCard;
  }
}

function formatReference(method: PaymentMethodType, reference: string): string {
  // Truncate long references
  if (reference.length > 20) {
    return `${reference.slice(0, 8)}...${reference.slice(-4)}`;
  }
  return reference;
}

/**
 * Compact display of split tender for inline use
 */
export function SplitTenderSummary() {
  const { state } = usePaymentContext();
  const { tenderEntries, remainingCents } = state;

  const completedEntries = tenderEntries.filter((e) => e.status === "completed");

  if (completedEntries.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>
        {completedEntries.length} payment{completedEntries.length !== 1 ? "s" : ""}
      </span>
      <span className="text-muted-foreground">•</span>
      {remainingCents > 0 ? (
        <span className="text-amber-600 font-medium">
          ${(remainingCents / 100).toFixed(2)} remaining
        </span>
      ) : (
        <span className="text-emerald-600 font-medium">Complete</span>
      )}
    </div>
  );
}
