"use client";

import React, { useState } from "react";
import { Button } from "../../../ui/button";
import { Wallet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { apiClient } from "../../../../lib/api-client";

interface GuestWalletMethodProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

/**
 * Guest Wallet Method
 * Allows guests to pay using their stored credit balance.
 */
export default function GuestWalletMethod({
  onSuccess,
  onError,
  onCancel,
}: GuestWalletMethodProps) {
  const { state, actions, props } = usePaymentContext();
  const { walletBalanceCents, remainingCents } = state;
  const [isProcessing, setIsProcessing] = useState(false);

  const canPayFull = walletBalanceCents >= remainingCents;
  const paymentAmountCents = canPayFull ? remainingCents : walletBalanceCents;

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  const handlePayWithWallet = async () => {
    // Extract reservationId from subject if available
    const referenceId = props.subject.type === "reservation" || props.subject.type === "balance"
      ? props.subject.reservationId
      : props.subject.type === "seasonal"
        ? props.subject.contractId
        : null;

    const referenceType = props.subject.type === "reservation" || props.subject.type === "balance"
      ? "reservation"
      : props.subject.type === "seasonal"
        ? "seasonal_contract"
        : props.subject.type === "cart"
          ? "pos_cart"
          : "custom";

    if (!props.guestId || !props.campgroundId || !referenceId) {
      onError("Missing required payment information");
      return;
    }

    if (paymentAmountCents <= 0) {
      onError("No wallet balance available");
      return;
    }

    setIsProcessing(true);

    try {
      const result = await apiClient.debitWallet(
        props.campgroundId,
        props.guestId,
        paymentAmountCents,
        referenceType,
        referenceId
      );

      // Add tender entry for tracking
      actions.addTenderEntry({
        method: "guest_wallet",
        amountCents: paymentAmountCents,
        status: "completed",
        reference: result.transactionId,
        metadata: {
          walletId: result.walletId,
          newBalance: result.balanceCents,
        },
      });

      // If this covers the full amount, complete the payment
      if (canPayFull) {
        actions.completePayment();
      }

      onSuccess(result.transactionId);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to process wallet payment";
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Wallet className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Guest Wallet</h3>
          <p className="text-sm text-muted-foreground">
            Pay using stored credit balance
          </p>
        </div>
      </div>

      {/* Balance Display */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-purple-800">Available Balance</span>
          <span className="text-xl font-bold text-purple-900">
            ${(walletBalanceCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Payment Amount */}
      <div className="p-4 bg-muted border border-border rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-foreground">Amount Due</span>
          <span className="font-medium text-foreground">
            ${(remainingCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-foreground font-medium">Pay with Wallet</span>
          <span className="text-lg font-bold text-purple-900">
            ${(paymentAmountCents / 100).toFixed(2)}
          </span>
        </div>
        {!canPayFull && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Wallet balance is less than amount due. The remaining ${((remainingCents - walletBalanceCents) / 100).toFixed(2)} will need to be paid with another method.
            </p>
          </div>
        )}
        {canPayFull && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-green-50 border border-green-200 rounded">
            <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-800">
              Wallet balance covers the full amount due.
            </p>
          </div>
        )}
      </div>

      {/* No balance warning */}
      {walletBalanceCents <= 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">No Wallet Balance</p>
              <p className="text-sm text-red-700 mt-1">
                This guest does not have any credit in their wallet. Please choose another payment method.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info about wallet */}
      <div className="text-sm text-muted-foreground space-y-2">
        <p>Guest wallets are useful for:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Storing refunds as credit for future use</li>
          <li>Prepaid balances for frequent guests</li>
          <li>Loyalty rewards and credits</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
          Go Back
        </Button>
        <Button
          onClick={handlePayWithWallet}
          disabled={isProcessing || walletBalanceCents <= 0}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Pay ${(paymentAmountCents / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
