"use client";

import React, { useState, useMemo } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { Loader2, Banknote, Calculator } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { cn } from "../../../../lib/utils";
import { apiClient } from "../../../../lib/api-client";

interface CashMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

// Quick cash amount buttons
const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100];

export function CashMethod({ onSuccess, onError, onCancel }: CashMethodProps) {
  const { state, actions, props } = usePaymentContext();

  const [amountReceived, setAmountReceived] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountDue = state.remainingCents / 100;
  const receivedAmount = parseFloat(amountReceived) || 0;

  const changeDue = useMemo(() => {
    if (receivedAmount >= amountDue) {
      return receivedAmount - amountDue;
    }
    return 0;
  }, [receivedAmount, amountDue]);

  const isExactAmount = receivedAmount === amountDue;
  const canComplete = receivedAmount >= amountDue;

  const handleQuickAmount = (amount: number) => {
    setAmountReceived(amount.toFixed(2));
  };

  const handleExactAmount = () => {
    setAmountReceived(amountDue.toFixed(2));
  };

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  const handleComplete = async () => {
    if (!canComplete) {
      setError("Amount received must be at least the amount due");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate a simple reference for cash payments
      const reference = `CASH-${Date.now()}`;
      const amountCents = state.remainingCents;

      // Get reservation ID from subject - required for balance/reservation payments
      const reservationId = props.subject?.type === "reservation" || props.subject?.type === "balance"
        ? props.subject.reservationId
        : undefined;

      // For reservation/balance payments, we MUST have a reservation ID
      if ((props.subject?.type === "reservation" || props.subject?.type === "balance") && !reservationId) {
        throw new Error("Missing reservation ID - cannot record payment");
      }

      // Record the payment in the database
      if (reservationId) {
        await apiClient.recordReservationPayment(reservationId, amountCents, [
          { method: "cash", amountCents, note: reference }
        ]);
      }

      // Add tender entry for UI tracking
      actions.addTenderEntry({
        method: "cash",
        amountCents,
        reference,
        metadata: {
          amountReceivedCents: Math.round(receivedAmount * 100),
          changeDueCents: Math.round(changeDue * 100),
        },
      });

      onSuccess?.(reference);
    } catch (err: any) {
      setError(err.message || "Failed to record cash payment");
      onError?.(err.message || "Failed to record cash payment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Amount due display */}
      <div className="text-center p-4 bg-slate-50 rounded-lg">
        <p className="text-sm text-slate-500">Amount Due</p>
        <p className="text-3xl font-bold text-slate-900">${amountDue.toFixed(2)}</p>
      </div>

      {/* Quick amount buttons */}
      <div className="space-y-2">
        <Label className="text-sm text-slate-600">Quick Amounts</Label>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickAmount(amount)}
              className={cn(
                "font-medium",
                parseFloat(amountReceived) === amount && "border-emerald-500 bg-emerald-50"
              )}
            >
              ${amount}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExactAmount}
          className={cn(
            "w-full font-medium",
            isExactAmount && "border-emerald-500 bg-emerald-50"
          )}
        >
          Exact Amount (${amountDue.toFixed(2)})
        </Button>
      </div>

      {/* Amount received input */}
      <div className="space-y-2">
        <Label htmlFor="amount-received" className="text-sm text-slate-600">
          Amount Received
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
          <Input
            id="amount-received"
            type="number"
            step="0.01"
            min="0"
            value={amountReceived}
            onChange={(e) => setAmountReceived(e.target.value)}
            placeholder="0.00"
            className="pl-7 text-lg font-medium"
          />
        </div>
      </div>

      {/* Change calculator */}
      {receivedAmount > 0 && (
        <div
          className={cn(
            "p-4 rounded-lg border-2",
            canComplete
              ? "border-emerald-500 bg-emerald-50"
              : "border-amber-500 bg-amber-50"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-slate-600" />
              <span className="font-medium text-slate-700">
                {canComplete ? "Change Due" : "Amount Short"}
              </span>
            </div>
            <span
              className={cn(
                "text-2xl font-bold",
                canComplete ? "text-emerald-700" : "text-amber-700"
              )}
            >
              ${canComplete ? changeDue.toFixed(2) : (amountDue - receivedAmount).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleComplete}
          disabled={!canComplete || loading}
          className="min-w-[160px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Recording...
            </>
          ) : (
            <>
              <Banknote className="h-4 w-4 mr-2" />
              Complete Cash Payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default CashMethod;
