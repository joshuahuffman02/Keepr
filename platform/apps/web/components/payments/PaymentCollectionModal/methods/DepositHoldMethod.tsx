"use client";

import React from "react";
import { Button } from "../../../ui/button";
import { Shield, Info } from "lucide-react";

interface DepositHoldMethodProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

/**
 * Deposit/Authorization Hold Method
 * Note: Auth hold API is not yet implemented.
 * This component shows a placeholder until the API is ready.
 */
export default function DepositHoldMethod({ onCancel }: DepositHoldMethodProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Shield className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Authorization Hold</h3>
          <p className="text-sm text-muted-foreground">
            Place a temporary hold on the guest's card
          </p>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Coming Soon</p>
            <p className="text-sm text-amber-700 mt-1">
              Authorization holds for security deposits are not yet available. This feature will
              allow you to place a temporary hold on a guest's card that can be captured or released
              later.
            </p>
          </div>
        </div>
      </div>

      {/* Info about auth holds */}
      <div className="text-sm text-muted-foreground space-y-2">
        <p>Authorization holds are useful for:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Security deposits for potential damages</li>
          <li>Incidental charges during a stay</li>
          <li>Pet deposits or equipment rentals</li>
        </ul>
        <p className="mt-3">
          The hold amount is reserved but not charged until you capture it. Uncaptured holds
          automatically release after 7 days.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    </div>
  );
}
