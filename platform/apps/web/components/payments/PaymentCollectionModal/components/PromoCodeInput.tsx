"use client";

import React, { useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { Loader2, Tag, X, Check } from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import { cn } from "../../../../lib/utils";

interface PromoCodeInputProps {
  disabled?: boolean;
}

export function PromoCodeInput({ disabled = false }: PromoCodeInputProps) {
  const { state, actions } = usePaymentContext();
  const { appliedDiscounts, loading } = state;

  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasAppliedPromo = appliedDiscounts.some((d) => d.promoCodeId);

  const handleApply = async () => {
    if (!code.trim()) {
      setError("Please enter a promo code");
      return;
    }

    setApplying(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await actions.applyPromoCode(code.trim().toUpperCase());
      if (result) {
        setSuccess(true);
        setCode("");
        // Clear success message after a delay
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError("Invalid or expired promo code");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply promo code";
      setError(message);
    } finally {
      setApplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleApply();
    }
  };

  return (
    <div className="space-y-3">
      {/* Applied discounts */}
      {appliedDiscounts.length > 0 && (
        <div className="space-y-2">
          {appliedDiscounts.map((discount) => (
            <div
              key={discount.promoCodeId || discount.code}
              className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  {discount.code || discount.description}
                </span>
                <span className="text-sm text-emerald-600">
                  -${(discount.discountCents / 100).toFixed(2)}
                </span>
              </div>
              {discount.promoCodeId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => actions.removeDiscount(discount.promoCodeId!)}
                  disabled={disabled || loading}
                  className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
                  aria-label="Remove discount"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Promo code input */}
      {!hasAppliedPromo && (
        <div className="space-y-1">
          <Label htmlFor="promo-code" className="text-sm text-muted-foreground">
            Promo Code
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="promo-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter code"
                disabled={disabled || applying}
                className={cn(
                  "uppercase",
                  error && "border-red-300 focus:border-red-500",
                  success && "border-emerald-300 focus:border-emerald-500"
                )}
              />
              {success && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              )}
            </div>
            <Button
              type="button"
              onClick={handleApply}
              disabled={disabled || applying || !code.trim()}
              variant="outline"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Apply"
              )}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
