"use client";

import React, { useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { Loader2, FileText } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { apiClient } from "../../../../lib/api-client";

interface CheckMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

export function CheckMethod({ onSuccess, onError, onCancel }: CheckMethodProps) {
  const { state, actions, props } = usePaymentContext();

  const [checkNumber, setCheckNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountDue = state.remainingCents / 100;
  const canComplete = checkNumber.trim().length > 0;

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  const handleComplete = async () => {
    if (!canComplete) {
      setError("Please enter a check number");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Generate reference for check payment
      const reference = `CHECK-${checkNumber.trim()}`;
      const amountCents = state.remainingCents;

      // Get reservation ID from subject if available
      const reservationId =
        props.subject?.type === "reservation" || props.subject?.type === "balance"
          ? props.subject.reservationId
          : undefined;

      // Record the payment in the database
      if (reservationId) {
        await apiClient.recordReservationPayment(reservationId, amountCents, [
          {
            method: "check",
            amountCents,
            note: `Check #${checkNumber.trim()}${bankName ? ` - ${bankName.trim()}` : ""}`,
          },
        ]);
      }

      // Add tender entry for UI tracking
      actions.addTenderEntry({
        method: "check",
        amountCents,
        reference,
        metadata: {
          checkNumber: checkNumber.trim(),
          bankName: bankName.trim() || undefined,
        },
      });

      onSuccess?.(reference);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record check payment";
      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Amount display */}
      <div className="text-center p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">Check Amount</p>
        <p className="text-3xl font-bold text-foreground">${amountDue.toFixed(2)}</p>
      </div>

      {/* Check details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="check-number" className="text-sm text-muted-foreground">
            Check Number <span className="text-red-500">*</span>
          </Label>
          <Input
            id="check-number"
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            placeholder="e.g., 1234"
            className="font-medium"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank-name" className="text-sm text-muted-foreground">
            Bank Name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bank-name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g., First National Bank"
          />
        </div>
      </div>

      {/* Info box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          Ensure the check is properly endorsed and made out for the correct amount before recording
          this payment.
        </p>
      </div>

      {/* Error display */}
      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}

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
              <FileText className="h-4 w-4 mr-2" />
              Record Check Payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default CheckMethod;
