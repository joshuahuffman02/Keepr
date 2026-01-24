"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, Loader2, Settings2, AlertTriangle, Lock } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type Gateway = "stripe" | "adyen" | "authorize_net" | "other";
type GatewayMode = "test" | "prod";
type FeeMode = "absorb" | "pass_through";

interface GatewayPreset {
  id: string;
  gateway: Gateway;
  mode: GatewayMode;
  label: string;
  percentBasisPoints: number;
  flatFeeCents: number;
}

interface PaymentGatewayCardProps {
  initialGateway?: Gateway;
  initialMode?: GatewayMode;
  initialFeeMode?: FeeMode;
  initialFeePercent?: number; // basis points
  initialFeeFlat?: number; // cents
  initialPresetId?: string | null;
  hasProductionCredentials?: boolean;
  credentials?: {
    publishableKeySecretId?: string;
    secretKeySecretId?: string;
    merchantAccountIdSecretId?: string;
    webhookSecretId?: string;
  };
  effectiveFee?: {
    percentBasisPoints: number;
    flatFeeCents: number;
  };
  onSave: (data: {
    gateway: Gateway;
    mode: GatewayMode;
    feeMode: FeeMode;
    feePercentBasisPoints?: number;
    feeFlatCents?: number;
    feePresetId?: string | null;
    publishableKeySecretId?: string;
    secretKeySecretId?: string;
    merchantAccountIdSecretId?: string;
    webhookSecretId?: string;
  }) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  disabled: boolean;
}

const isGateway = (value: string): value is Gateway =>
  value === "stripe" || value === "adyen" || value === "authorize_net" || value === "other";

const isGatewayMode = (value: string): value is GatewayMode => value === "test" || value === "prod";

const isFeeMode = (value: string): value is FeeMode =>
  value === "absorb" || value === "pass_through";

const GATEWAY_PRESETS: GatewayPreset[] = [
  {
    id: "preset_stripe_test",
    gateway: "stripe",
    mode: "test",
    label: "Stripe test (no fees)",
    percentBasisPoints: 0,
    flatFeeCents: 0,
  },
  {
    id: "preset_stripe_prod",
    gateway: "stripe",
    mode: "prod",
    label: "Stripe default (2.9% + 30¢)",
    percentBasisPoints: 290,
    flatFeeCents: 30,
  },
  {
    id: "preset_adyen_test",
    gateway: "adyen",
    mode: "test",
    label: "Adyen test (no fees)",
    percentBasisPoints: 0,
    flatFeeCents: 0,
  },
  {
    id: "preset_adyen_prod",
    gateway: "adyen",
    mode: "prod",
    label: "Adyen default (2.5% + 12¢)",
    percentBasisPoints: 250,
    flatFeeCents: 12,
  },
  {
    id: "preset_authorize_test",
    gateway: "authorize_net",
    mode: "test",
    label: "Authorize.Net test",
    percentBasisPoints: 0,
    flatFeeCents: 0,
  },
  {
    id: "preset_authorize_prod",
    gateway: "authorize_net",
    mode: "prod",
    label: "Authorize.Net default (2.9% + 30¢)",
    percentBasisPoints: 290,
    flatFeeCents: 30,
  },
  {
    id: "preset_other_prod",
    gateway: "other",
    mode: "prod",
    label: "Other gateway (3% + 30¢)",
    percentBasisPoints: 300,
    flatFeeCents: 30,
  },
];

export function PaymentGatewayCard({
  initialGateway = "stripe",
  initialMode = "test",
  initialFeeMode = "absorb",
  initialFeePercent,
  initialFeeFlat,
  initialPresetId,
  hasProductionCredentials,
  credentials = {},
  effectiveFee,
  onSave,
  isSaving,
  saveSuccess,
  disabled,
}: PaymentGatewayCardProps) {
  const [gateway, setGateway] = useState<Gateway>(initialGateway);
  const [mode, setMode] = useState<GatewayMode>(initialMode);
  const [feeMode, setFeeMode] = useState<FeeMode>(initialFeeMode);
  const [presetId, setPresetId] = useState<string | null>(initialPresetId ?? "preset_stripe_test");
  const [feePercent, setFeePercent] = useState<string>(
    initialFeePercent !== undefined ? (initialFeePercent / 100).toFixed(2) : "0",
  );
  const [feeFlat, setFeeFlat] = useState<string>(
    initialFeeFlat !== undefined ? (initialFeeFlat / 100).toFixed(2) : "0.30",
  );
  const [publishableKey, setPublishableKey] = useState(credentials.publishableKeySecretId ?? "");
  const [secretKey, setSecretKey] = useState(credentials.secretKeySecretId ?? "");
  const [merchantId, setMerchantId] = useState(credentials.merchantAccountIdSecretId ?? "");
  const [webhookSecret, setWebhookSecret] = useState(credentials.webhookSecretId ?? "");
  const [showCredentials, setShowCredentials] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Filter presets by current gateway and mode
  const availablePresets = useMemo(() => {
    return GATEWAY_PRESETS.filter((p) => p.gateway === gateway && p.mode === mode);
  }, [gateway, mode]);

  // Update fees when preset changes
  useEffect(() => {
    if (presetId) {
      const preset = GATEWAY_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setFeePercent((preset.percentBasisPoints / 100).toFixed(2));
        setFeeFlat((preset.flatFeeCents / 100).toFixed(2));
      }
    }
  }, [presetId]);

  // Reset preset when gateway/mode changes
  useEffect(() => {
    const newPreset = availablePresets[0];
    if (newPreset && !availablePresets.find((p) => p.id === presetId)) {
      setPresetId(newPreset.id);
    }
  }, [gateway, mode, availablePresets, presetId]);

  // Update from props
  useEffect(() => {
    if (initialGateway) setGateway(initialGateway);
    if (initialMode) setMode(initialMode);
    if (initialFeeMode) setFeeMode(initialFeeMode);
    if (initialPresetId !== undefined) setPresetId(initialPresetId);
    if (initialFeePercent !== undefined) setFeePercent((initialFeePercent / 100).toFixed(2));
    if (initialFeeFlat !== undefined) setFeeFlat((initialFeeFlat / 100).toFixed(2));
    if (credentials.publishableKeySecretId) setPublishableKey(credentials.publishableKeySecretId);
    if (credentials.secretKeySecretId) setSecretKey(credentials.secretKeySecretId);
    if (credentials.merchantAccountIdSecretId) setMerchantId(credentials.merchantAccountIdSecretId);
    if (credentials.webhookSecretId) setWebhookSecret(credentials.webhookSecretId);
  }, [
    initialGateway,
    initialMode,
    initialFeeMode,
    initialPresetId,
    initialFeePercent,
    initialFeeFlat,
    credentials,
  ]);

  // Success animation
  useEffect(() => {
    if (saveSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const prodMissingSecrets =
    mode === "prod" && !secretKey && !merchantId && !hasProductionCredentials;

  const effectiveFeeLabel = useMemo(() => {
    if (effectiveFee) {
      const pct = effectiveFee.percentBasisPoints / 100;
      const flat = effectiveFee.flatFeeCents / 100;
      return `${pct.toFixed(2)}% + $${flat.toFixed(2)}`;
    }
    const pct = parseFloat(feePercent) || 0;
    const flat = parseFloat(feeFlat) || 0;
    return `${pct.toFixed(2)}% + $${flat.toFixed(2)}`;
  }, [effectiveFee, feePercent, feeFlat]);

  const handleSave = () => {
    onSave({
      gateway,
      mode,
      feeMode,
      feePercentBasisPoints: Math.round(parseFloat(feePercent) * 100),
      feeFlatCents: Math.round(parseFloat(feeFlat) * 100),
      feePresetId: presetId,
      publishableKeySecretId: publishableKey || undefined,
      secretKeySecretId: secretKey || undefined,
      merchantAccountIdSecretId: merchantId || undefined,
      webhookSecretId: webhookSecret || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          Payment Gateway
        </CardTitle>
        <CardDescription>Configure your payment processor settings and fees.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Gateway and Mode */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gateway-select">Gateway</Label>
            <Select
              value={gateway}
              onValueChange={(value) => {
                if (isGateway(value)) setGateway(value);
              }}
            >
              <SelectTrigger id="gateway-select">
                <SelectValue placeholder="Select gateway" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stripe">
                  <span className="flex items-center gap-2">
                    Stripe
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  </span>
                </SelectItem>
                <SelectItem value="adyen">Adyen</SelectItem>
                <SelectItem value="authorize_net">Authorize.Net</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {gateway !== "stripe" && (
              <p className="text-xs text-amber-600">
                Only Stripe is currently supported. Other gateways coming soon.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gateway-mode">Mode</Label>
            <Select
              value={mode}
              onValueChange={(value) => {
                if (isGatewayMode(value)) setMode(value);
              }}
            >
              <SelectTrigger id="gateway-mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test / Sandbox</SelectItem>
                <SelectItem value="prod">Production</SelectItem>
              </SelectContent>
            </Select>
            {mode === "test" && (
              <p className="text-xs text-blue-600">Test mode - no real charges will be made.</p>
            )}
          </div>
        </div>

        {/* Fee configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="gateway-fee-mode">Who pays gateway fees?</Label>
            <Select
              value={feeMode}
              onValueChange={(value) => {
                if (isFeeMode(value)) setFeeMode(value);
              }}
            >
              <SelectTrigger id="gateway-fee-mode">
                <SelectValue placeholder="Select fee mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absorb">Campground absorbs</SelectItem>
                <SelectItem value="pass_through">Guest pays (pass-through)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fee-preset">Fee preset</Label>
            <Select
              value={presetId ?? "custom"}
              onValueChange={(v) => setPresetId(v === "custom" ? null : v)}
            >
              <SelectTrigger id="fee-preset">
                <SelectValue placeholder="Select preset" />
              </SelectTrigger>
              <SelectContent>
                {availablePresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom fee inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fee-percent">Gateway fee (%)</Label>
            <Input
              id="fee-percent"
              type="number"
              step="0.01"
              min="0"
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              disabled={presetId !== null}
              className={cn(presetId !== null && "bg-muted")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fee-flat">Flat fee (USD)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="fee-flat"
                type="number"
                step="0.01"
                min="0"
                value={feeFlat}
                onChange={(e) => setFeeFlat(e.target.value)}
                disabled={presetId !== null}
                className={cn("pl-7", presetId !== null && "bg-muted")}
              />
            </div>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg">
          <p className="text-sm text-foreground">
            <span className="font-medium">Effective fee:</span> {effectiveFeeLabel} per transaction
          </p>
        </div>

        {/* Credentials section */}
        <Collapsible open={showCredentials} onOpenChange={setShowCredentials}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors">
            <Lock className="w-4 h-4" aria-hidden="true" />
            API Credentials
            <span className="text-xs text-muted-foreground font-normal">
              {showCredentials ? "(click to hide)" : "(click to configure)"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Enter secret references, not the actual keys. Keys are stored securely in your secrets
              manager.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="publishable-key">Publishable key secret ID</Label>
                <Input
                  id="publishable-key"
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                  placeholder="secret/stripe/publishable_key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-key">Secret key secret ID</Label>
                <Input
                  id="secret-key"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="secret/stripe/secret_key"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merchant-id">Merchant/Account ID secret</Label>
                <Input
                  id="merchant-id"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  placeholder="secret/stripe/account_id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Webhook secret ID</Label>
                <Input
                  id="webhook-secret"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="secret/stripe/webhook_secret"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Production warning */}
        {prodMissingSecrets && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3"
            role="alert"
          >
            <AlertTriangle
              className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-amber-900">Credentials required</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Production mode requires API credentials. Add secret references before going live.
              </p>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={disabled || isSaving}
            className={cn(
              "transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] motion-reduce:transform-none",
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
              "Save gateway settings"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">Changes are logged for compliance.</p>
        </div>
      </CardContent>
    </Card>
  );
}
