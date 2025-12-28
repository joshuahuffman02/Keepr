"use client";

import React from "react";
import { Button } from "../../../ui/button";
import { CreditCard, Info } from "lucide-react";

interface ExternalPOSMethodProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

/**
 * External POS Method (Square, Clover, etc.)
 * Note: External payment recording API is not yet implemented.
 * This component shows a placeholder until the API is ready.
 */
export default function ExternalPOSMethod({
  onCancel,
}: ExternalPOSMethodProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="p-2 bg-slate-100 rounded-lg">
          <CreditCard className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">External POS</h3>
          <p className="text-sm text-slate-500">
            Record a payment from Square, Clover, or another terminal
          </p>
        </div>
      </div>

      {/* Coming Soon Message */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Coming Soon</p>
            <p className="text-sm text-blue-700 mt-1">
              External POS payment recording is not yet available.
              This feature will allow you to record payments processed through
              Square, Clover, or other external payment terminals.
            </p>
          </div>
        </div>
      </div>

      {/* Info about external POS */}
      <div className="text-sm text-slate-600 space-y-2">
        <p>External POS recording is useful for:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Recording payments from Square terminals</li>
          <li>Recording payments from Clover devices</li>
          <li>Tracking payments processed outside of Stripe</li>
        </ul>
        <p className="mt-3">
          You'll be able to enter the transaction ID from your external
          terminal to keep your records in sync.
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
