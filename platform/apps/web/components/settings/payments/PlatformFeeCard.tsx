"use client";

import { useMemo, useState, useEffect } from "react";
import { Check, Loader2, DollarSign, Users, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type BillingPlan = "ota_only" | "standard" | "enterprise";
type FeeMode = "absorb" | "pass_through";

interface PlatformFeeCardProps {
  initialFee?: number; // cents
  initialPlan?: BillingPlan;
  initialFeeMode?: FeeMode;
  initialMonthlyFee?: number; // cents
  onSave: (data: {
    perBookingFeeCents: number;
    billingPlan: BillingPlan;
    feeMode: FeeMode;
    monthlyFeeCents?: number;
  }) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  disabled: boolean;
}

const PLAN_DEFAULTS: Record<BillingPlan, { fee: number; label: string; description: string }> = {
  ota_only: {
    fee: 3.0,
    label: "OTA-only",
    description: "For properties using OTA channels only",
  },
  standard: {
    fee: 2.0,
    label: "Standard",
    description: "Direct bookings + OTA channels",
  },
  enterprise: {
    fee: 1.0,
    label: "Enterprise",
    description: "High volume with monthly subscription",
  },
};

const isBillingPlan = (value: string): value is BillingPlan =>
  value === "ota_only" || value === "standard" || value === "enterprise";

const isFeeMode = (value: string): value is FeeMode =>
  value === "absorb" || value === "pass_through";

export function PlatformFeeCard({
  initialFee,
  initialPlan = "ota_only",
  initialFeeMode = "absorb",
  initialMonthlyFee,
  onSave,
  isSaving,
  saveSuccess,
  disabled,
}: PlatformFeeCardProps) {
  const [plan, setPlan] = useState<BillingPlan>(initialPlan);
  const [fee, setFee] = useState<string>(
    initialFee !== undefined ? (initialFee / 100).toFixed(2) : "",
  );
  const [feeMode, setFeeMode] = useState<FeeMode>(initialFeeMode);
  const [monthlyFee, setMonthlyFee] = useState<string>(
    initialMonthlyFee !== undefined ? (initialMonthlyFee / 100).toFixed(2) : "500.00",
  );
  const [showSuccess, setShowSuccess] = useState(false);

  // Update state when props change
  useEffect(() => {
    if (initialFee !== undefined) {
      setFee((initialFee / 100).toFixed(2));
    }
    if (initialPlan) setPlan(initialPlan);
    if (initialFeeMode) setFeeMode(initialFeeMode);
    if (initialMonthlyFee !== undefined) {
      setMonthlyFee((initialMonthlyFee / 100).toFixed(2));
    }
  }, [initialFee, initialPlan, initialFeeMode, initialMonthlyFee]);

  // Show success animation
  useEffect(() => {
    if (saveSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const planDefault = PLAN_DEFAULTS[plan];

  const effectiveFee = useMemo(() => {
    const num = parseFloat(fee);
    return Number.isNaN(num) ? planDefault.fee : num;
  }, [fee, planDefault.fee]);

  const handleSave = () => {
    const feeValue = parseFloat(fee) || planDefault.fee;
    const monthlyValue = plan === "enterprise" ? parseFloat(monthlyFee) * 100 : undefined;

    onSave({
      perBookingFeeCents: Math.round(feeValue * 100),
      billingPlan: plan,
      feeMode,
      monthlyFeeCents: monthlyValue ? Math.round(monthlyValue) : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Platform Fee
        </CardTitle>
        <CardDescription>Configure the per-booking fee that supports the platform.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan selection */}
        <div className="space-y-2">
          <Label htmlFor="billing-plan">Billing plan</Label>
          <Select
            value={plan}
            onValueChange={(value) => {
              if (isBillingPlan(value)) setPlan(value);
            }}
          >
            <SelectTrigger id="billing-plan" className="w-full">
              <SelectValue placeholder="Select plan" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PLAN_DEFAULTS).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{value.label}</span>
                    <span className="text-muted-foreground text-xs">
                      (default ${value.fee.toFixed(2)})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{planDefault.description}</p>
        </div>

        {/* Fee input */}
        <div className="space-y-2">
          <Label htmlFor="booking-fee">Fee per booking (USD)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="booking-fee"
              type="number"
              step="0.01"
              min="0"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder={planDefault.fee.toFixed(2)}
              className="pl-7"
              aria-describedby="fee-help"
            />
          </div>
          <p id="fee-help" className="text-xs text-muted-foreground">
            Leave blank to use plan default (${planDefault.fee.toFixed(2)})
          </p>
        </div>

        {/* Fee mode */}
        <div className="space-y-2">
          <Label htmlFor="fee-mode">Who pays the fee?</Label>
          <Select
            value={feeMode}
            onValueChange={(value) => {
              if (isFeeMode(value)) setFeeMode(value);
            }}
          >
            <SelectTrigger id="fee-mode">
              <SelectValue placeholder="Select fee mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absorb">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span>Campground absorbs</span>
                </div>
              </SelectItem>
              <SelectItem value="pass_through">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <span>Guest pays</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {feeMode === "absorb"
              ? "Fee is deducted from the campground's payout."
              : "Fee is added to the guest's total at checkout."}
          </p>
        </div>

        {/* Monthly fee for enterprise */}
        {plan === "enterprise" && (
          <div className="space-y-2 pt-4 border-t border-border">
            <Label htmlFor="monthly-fee">Monthly subscription (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="monthly-fee"
                type="number"
                step="0.01"
                min="0"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                placeholder="500.00"
                className="pl-7"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly subscription fee in addition to per-booking fees.
            </p>
          </div>
        )}

        {/* Preview card */}
        <div className="p-4 bg-muted rounded-xl border border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">Guest checkout preview</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Campsite rental (example)</span>
              <span className="text-foreground">$75.00</span>
            </div>
            {feeMode === "pass_through" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Booking fee</span>
                <span>${effectiveFee.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-2 border-t border-border">
              <span className="text-foreground">Guest pays</span>
              <span className="text-foreground">
                ${(75 + (feeMode === "pass_through" ? effectiveFee : 0)).toFixed(2)}
              </span>
            </div>
            {feeMode === "absorb" && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Your payout (after fee)</span>
                <span>${(75 - effectiveFee).toFixed(2)}</span>
              </div>
            )}
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
            "Save fee settings"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
