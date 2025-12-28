"use client";

import React, { useState, useEffect } from "react";
import { Button } from "../../../ui/button";
import { RadioGroup, RadioGroupItem } from "../../../ui/radio-group";
import { Label } from "../../../ui/label";
import { Checkbox } from "../../../ui/checkbox";
import { Loader2, AlertCircle, SmartphoneNfc, Wifi, WifiOff, Check } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { TerminalReader } from "../context/types";
import { apiClient } from "../../../../lib/api-client";
import { cn } from "../../../../lib/utils";

interface TerminalMethodProps {
  onSuccess?: (paymentId: string) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

type TerminalStatus =
  | "idle"
  | "creating"
  | "waiting_for_card"
  | "processing"
  | "success"
  | "error";

export function TerminalMethod({ onSuccess, onError, onCancel }: TerminalMethodProps) {
  const { state, actions, props } = usePaymentContext();
  const { terminalReaders } = state;

  const [selectedReaderId, setSelectedReaderId] = useState<string>("");
  const [saveCard, setSaveCard] = useState(false);
  const [status, setStatus] = useState<TerminalStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Auto-select first online reader
  useEffect(() => {
    if (terminalReaders.length > 0 && !selectedReaderId) {
      const onlineReader = terminalReaders.find((r) => r.status === "online");
      if (onlineReader) {
        setSelectedReaderId(onlineReader.id);
      }
    }
  }, [terminalReaders, selectedReaderId]);

  const selectedReader = terminalReaders.find((r) => r.id === selectedReaderId);
  const hasOnlineReaders = terminalReaders.some((r) => r.status === "online");
  const showSaveCard = !!props.guestId;

  const handleCancel = () => {
    actions.selectMethod(null);
    onCancel?.();
  };

  const handlePayment = async () => {
    if (!selectedReader) {
      setError("Please select a card reader");
      return;
    }

    if (selectedReader.status !== "online") {
      setError("Selected reader is offline");
      return;
    }

    setError(null);
    setStatus("creating");
    setStatusMessage("Creating payment...");

    try {
      // Create terminal payment
      const terminalPayment = await apiClient.createTerminalPayment(props.campgroundId, {
        readerId: selectedReader.id,
        amountCents: state.remainingCents,
        guestId: props.guestId,
        saveCard: saveCard && !!props.guestId,
        metadata: {
          source: "payment_collection_modal",
          context: props.context,
        },
      });

      setStatus("waiting_for_card");
      setStatusMessage("Present card on reader...");

      // Process payment on reader
      const result = await apiClient.processTerminalPayment(
        props.campgroundId,
        selectedReader.id,
        terminalPayment.paymentIntentId
      );

      if (!result.success) {
        throw new Error(result.error || "Terminal payment failed");
      }

      setStatus("success");
      setStatusMessage("Payment successful!");

      // Add tender entry
      actions.addTenderEntry({
        method: "terminal",
        amountCents: state.remainingCents,
        reference: result.paymentId,
        metadata: {
          readerId: selectedReader.id,
          readerLabel: selectedReader.label,
        },
      });

      onSuccess?.(result.paymentId || "terminal_payment");
    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Terminal payment failed");
      onError?.(err.message || "Terminal payment failed");
    }
  };

  // No readers available
  if (terminalReaders.length === 0) {
    return (
      <div className="py-8 text-center space-y-4">
        <SmartphoneNfc className="h-12 w-12 mx-auto text-slate-300" />
        <p className="text-slate-600">No card readers configured</p>
        <p className="text-sm text-slate-500">
          Contact your administrator to set up a Stripe Terminal
        </p>
        <Button variant="outline" onClick={handleCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  // Payment in progress
  if (status !== "idle" && status !== "error") {
    return (
      <div className="py-12 text-center space-y-4">
        {status === "success" ? (
          <div className="h-16 w-16 rounded-full bg-green-100 mx-auto flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
        ) : (
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-emerald-600" />
        )}
        <p className="text-slate-600 font-medium">{statusMessage}</p>
        {status === "waiting_for_card" && (
          <p className="text-sm text-slate-500">
            Tap, insert, or swipe the card on the reader
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* No online readers warning */}
      {!hasOnlineReaders && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          All card readers are offline
        </div>
      )}

      {/* Reader selection */}
      <RadioGroup
        value={selectedReaderId}
        onValueChange={setSelectedReaderId}
        className="space-y-3"
      >
        {terminalReaders.map((reader) => {
          const isOnline = reader.status === "online";
          const isSelected = selectedReaderId === reader.id;

          return (
            <div
              key={reader.id}
              className={cn(
                "flex items-center gap-3 p-4 border-2 rounded-lg transition-all",
                isOnline ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                isSelected && isOnline
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 hover:border-slate-300"
              )}
              onClick={() => isOnline && setSelectedReaderId(reader.id)}
            >
              <RadioGroupItem
                value={reader.id}
                id={reader.id}
                disabled={!isOnline}
                className="sr-only"
              />

              {/* Reader icon with status */}
              <div className="flex-shrink-0 relative">
                <SmartphoneNfc className="h-8 w-8 text-slate-600" />
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white",
                    isOnline ? "bg-green-500" : "bg-slate-400"
                  )}
                />
              </div>

              {/* Reader details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{reader.label}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded",
                      isOnline
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && isOnline && (
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </RadioGroup>

      {/* Save card checkbox */}
      {showSaveCard && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="save-card-terminal"
            checked={saveCard}
            onCheckedChange={(checked) => setSaveCard(checked === true)}
          />
          <Label htmlFor="save-card-terminal" className="text-sm text-slate-600 cursor-pointer">
            Save card for future payments
          </Label>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          onClick={handlePayment}
          disabled={!selectedReader || selectedReader.status !== "online"}
          className="min-w-[120px]"
        >
          <SmartphoneNfc className="h-4 w-4 mr-2" />
          Pay ${(state.remainingCents / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  );
}

export default TerminalMethod;
