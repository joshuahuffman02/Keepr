"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, Loader2, CreditCard, Building2, Users, TestTube, Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type GatewayMode = "test" | "prod";
type FeeMode = "absorb" | "pass_through";
const feeModes: FeeMode[] = ["absorb", "pass_through"];
const isFeeMode = (value: string): value is FeeMode => feeModes.some((mode) => mode === value);

interface StripeSettingsCardProps {
  initialMode?: GatewayMode;
  initialFeeMode?: FeeMode;
  effectiveFee?: {
    percentBasisPoints: number;
    flatFeeCents: number;
  };
  onSave: (data: { mode: GatewayMode; feeMode: FeeMode }) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  disabled: boolean;
}

export function StripeSettingsCard({
  initialMode = "test",
  initialFeeMode = "absorb",
  effectiveFee,
  onSave,
  isSaving,
  saveSuccess,
  disabled,
}: StripeSettingsCardProps) {
  const [mode, setMode] = useState<GatewayMode>(initialMode);
  const [feeMode, setFeeMode] = useState<FeeMode>(initialFeeMode);
  const [showSuccess, setShowSuccess] = useState(false);

  // Update from props
  useEffect(() => {
    if (initialMode) setMode(initialMode);
    if (initialFeeMode) setFeeMode(initialFeeMode);
  }, [initialMode, initialFeeMode]);

  // Success animation
  useEffect(() => {
    if (saveSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const effectiveFeeLabel = useMemo(() => {
    // If we have actual fee values configured, show them
    if (effectiveFee && (effectiveFee.percentBasisPoints > 0 || effectiveFee.flatFeeCents > 0)) {
      const pct = effectiveFee.percentBasisPoints / 100;
      const flat = effectiveFee.flatFeeCents / 100;
      return `${pct.toFixed(2)}% + $${flat.toFixed(2)}`;
    }
    // Default Stripe fees - 2.9% + $0.30 for standard US pricing
    if (mode === "test") {
      return "2.9% + $0.30 (test mode)";
    }
    return "2.9% + $0.30";
  }, [effectiveFee, mode]);

  const handleSave = () => {
    onSave({ mode, feeMode });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
              Stripe Settings
            </CardTitle>
            <CardDescription className="mt-1">
              Configure your Stripe payment processing.
            </CardDescription>
          </div>
          <Badge className="bg-violet-100 text-violet-800 border-violet-200">Stripe</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Mode selection */}
        <div className="space-y-3">
          <Label>Processing mode</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("test")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                mode === "test"
                  ? "border-blue-500 bg-blue-50"
                  : "border-border hover:border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  mode === "test"
                    ? "bg-blue-500 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <TestTube className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p
                  className={cn(
                    "font-medium",
                    mode === "test" ? "text-blue-900" : "text-foreground",
                  )}
                >
                  Test Mode
                </p>
                <p className="text-xs text-muted-foreground">No real charges</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("prod")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                mode === "prod"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-border hover:border-border bg-card",
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  mode === "prod"
                    ? "bg-emerald-500 text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Rocket className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p
                  className={cn(
                    "font-medium",
                    mode === "prod" ? "text-emerald-900" : "text-foreground",
                  )}
                >
                  Live Mode
                </p>
                <p className="text-xs text-muted-foreground">Real transactions</p>
              </div>
            </button>
          </div>
        </div>

        {/* Fee mode */}
        <div className="space-y-2">
          <Label htmlFor="stripe-fee-mode">Who pays processing fees?</Label>
          <Select
            value={feeMode}
            onValueChange={(v) => {
              if (isFeeMode(v)) {
                setFeeMode(v);
              }
            }}
          >
            <SelectTrigger id="stripe-fee-mode">
              <SelectValue placeholder="Select fee mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absorb">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span>Campground absorbs fees</span>
                </div>
              </SelectItem>
              <SelectItem value="pass_through">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span>Guest pays fees</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {feeMode === "absorb"
              ? "Stripe fees are deducted from your payout."
              : "Stripe fees are added to the guest's total at checkout."}
          </p>
        </div>

        {/* Fee summary */}
        <div className="p-4 bg-muted rounded-xl border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Processing fee</p>
              <p className="text-xs text-muted-foreground">Per transaction</p>
            </div>
            <p className="text-lg font-semibold text-foreground">{effectiveFeeLabel}</p>
          </div>
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={disabled || isSaving}
          className={cn(
            "w-full sm:w-auto transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none",
            showSuccess && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : showSuccess ? (
            <>
              <Check
                className="w-4 h-4 mr-2 motion-safe:animate-in motion-safe:zoom-in"
                aria-hidden="true"
              />
              Saved!
            </>
          ) : (
            "Save Stripe settings"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
