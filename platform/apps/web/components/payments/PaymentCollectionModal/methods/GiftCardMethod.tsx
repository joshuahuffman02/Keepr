"use client";

import React, { useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { Loader2, Gift, Check, Search, X } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { useGiftCard, formatGiftCardCode } from "../hooks/useGiftCard";
import { cn } from "../../../../lib/utils";

interface GiftCardMethodProps {
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}

export default function GiftCardMethod({
  onSuccess,
  onError,
  onCancel,
}: GiftCardMethodProps) {
  const { state, actions } = usePaymentContext();
  const { remainingCents } = state;
  const { giftCard, loading, error, lookupGiftCard, redeemGiftCard, clearGiftCard } =
    useGiftCard();

  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [useFullBalance, setUseFullBalance] = useState(true);

  const handleLookup = async () => {
    if (!code.trim()) return;
    await lookupGiftCard(code);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLookup();
    }
  };

  const handleRedeem = async () => {
    if (!giftCard) return;

    const amountToRedeem = useFullBalance
      ? Math.min(giftCard.balanceCents, remainingCents)
      : Math.round(parseFloat(customAmount || "0") * 100);

    if (amountToRedeem <= 0) {
      onError("Please enter a valid amount");
      return;
    }

    if (amountToRedeem > giftCard.balanceCents) {
      onError(`Gift card only has $${(giftCard.balanceCents / 100).toFixed(2)} available`);
      return;
    }

    setRedeeming(true);

    try {
      const result = await redeemGiftCard(giftCard.code, amountToRedeem);

      if (result) {
        // Record the tender entry
        actions.addTenderEntry({
          method: "gift_card",
          amountCents: result.amountRedeemedCents,
          reference: `${giftCard.code} (${result.transactionId})`,
        });

        onSuccess(result.transactionId);
      }
    } catch (err: any) {
      onError(err.message || "Failed to redeem gift card");
    } finally {
      setRedeeming(false);
    }
  };

  const maxRedeemable = giftCard ? Math.min(giftCard.balanceCents, remainingCents) : 0;

  return (
    <div className="space-y-6">
      {/* Gift Card Lookup */}
      {!giftCard && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-foreground">
            <Gift className="h-5 w-5" />
            <span className="font-medium">Enter Gift Card Code</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gift-card-code" className="sr-only">
              Gift Card Code
            </Label>
            <div className="flex gap-2">
              <Input
                id="gift-card-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="XXXX-XXXX-XXXX"
                disabled={loading}
                className="uppercase font-mono"
              />
              <Button onClick={handleLookup} disabled={loading || !code.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      {/* Gift Card Found */}
      {giftCard && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Gift className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-mono font-medium text-emerald-800">
                    {formatGiftCardCode(giftCard.code)}
                  </p>
                  <p className="text-sm text-emerald-600">
                    Balance: ${(giftCard.balanceCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearGiftCard}
                className="h-8 w-8 text-emerald-600 hover:text-emerald-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {giftCard.expiresAt && (
              <p className="mt-2 text-xs text-emerald-600">
                Expires: {new Date(giftCard.expiresAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Amount Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              Amount to Redeem
            </Label>

            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                <input
                  type="radio"
                  name="redeem-amount"
                  checked={useFullBalance}
                  onChange={() => setUseFullBalance(true)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    Use full balance
                    {giftCard.balanceCents > remainingCents && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        (${(remainingCents / 100).toFixed(2)} of $
                        {(giftCard.balanceCents / 100).toFixed(2)})
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Apply ${(maxRedeemable / 100).toFixed(2)} to this payment
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted">
                <input
                  type="radio"
                  name="redeem-amount"
                  checked={!useFullBalance}
                  onChange={() => setUseFullBalance(false)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">Custom amount</p>
                  {!useFullBalance && (
                    <div className="mt-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="0.00"
                          min="0.01"
                          max={(maxRedeemable / 100).toFixed(2)}
                          step="0.01"
                          className="pl-7"
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Max: ${(maxRedeemable / 100).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={redeeming}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRedeem}
              disabled={
                redeeming ||
                (!useFullBalance &&
                  (!customAmount || parseFloat(customAmount) <= 0))
              }
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {redeeming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Redeeming...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Redeem $
                  {useFullBalance
                    ? (maxRedeemable / 100).toFixed(2)
                    : customAmount || "0.00"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Initial Cancel Button */}
      {!giftCard && (
        <Button variant="outline" onClick={onCancel} className="w-full">
          Cancel
        </Button>
      )}
    </div>
  );
}
