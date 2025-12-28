"use client";

import React from "react";
import { Button } from "../../../ui/button";
import { Wallet, Info } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";

interface GuestWalletMethodProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

/**
 * Guest Wallet Method
 * Note: Wallet debit API is not yet implemented.
 * This component shows the balance but cannot process debits.
 */
export default function GuestWalletMethod({
  onCancel,
}: GuestWalletMethodProps) {
  const { state, actions } = usePaymentContext();
  const { walletBalanceCents } = state;

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Wallet className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Guest Wallet</h3>
          <p className="text-sm text-slate-500">
            Pay using stored credit balance
          </p>
        </div>
      </div>

      {/* Balance Display */}
      {walletBalanceCents > 0 && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-purple-800">Available Balance</span>
            <span className="text-xl font-bold text-purple-900">
              ${(walletBalanceCents / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Coming Soon Message */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Coming Soon</p>
            <p className="text-sm text-blue-700 mt-1">
              Wallet payments are not yet available.
              This feature will allow guests to pay using their stored credit balance.
            </p>
          </div>
        </div>
      </div>

      {/* Info about wallet */}
      <div className="text-sm text-slate-600 space-y-2">
        <p>Guest wallets are useful for:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Storing refunds as credit for future use</li>
          <li>Prepaid balances for frequent guests</li>
          <li>Loyalty rewards and credits</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleCancel}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
