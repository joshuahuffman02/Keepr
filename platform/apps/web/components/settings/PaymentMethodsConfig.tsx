"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CreditCard,
  Smartphone,
  Building2,
  Banknote,
  Receipt,
  Gift,
  Info,
  Check,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GiftCardsManagement } from "@/components/settings/payments/GiftCardsManagement";
import { ExternalPOSRecording } from "@/components/settings/payments/ExternalPOSRecording";

type CardBrand = "visa" | "mastercard" | "amex" | "discover" | "diners" | "jcb";

interface PaymentMethodSettings {
  enableCardPayments: boolean;
  enableApplePay: boolean;
  enableGooglePay: boolean;
  enableACH: boolean;
  enableCash: boolean;
  enableCheck: boolean;
  enableFolio: boolean;
  enableGiftCards: boolean;
  enableExternalPOS: boolean;
  allowedCardBrands: CardBrand[];
  showFeeBreakdown: boolean;
}

interface PaymentMethodsConfigProps {
  campgroundId: string;
}

const CARD_BRANDS: { id: CardBrand; label: string; logo?: string }[] = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "amex", label: "American Express" },
  { id: "discover", label: "Discover" },
  { id: "diners", label: "Diners Club" },
  { id: "jcb", label: "JCB" },
];

interface MethodToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  comingSoon?: boolean;
}

function MethodToggle({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  comingSoon,
}: MethodToggleProps) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg transition-colors",
      checked && !disabled ? "bg-status-success-bg/60" : "hover:bg-muted",
      disabled && "opacity-60"
    )}>
      <div className="flex-1 min-w-0">
        <Label
          htmlFor={id}
          className={cn(
            "font-medium cursor-pointer",
            disabled && "cursor-not-allowed"
          )}
        >
          {label}
          {comingSoon && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">Coming soon</span>
          )}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
      {description && <span id={`${id}-desc`} className="sr-only">{description}</span>}
    </div>
  );
}

/**
 * Payment Methods Configuration Component
 * Allows campground admins to configure which payment methods to accept.
 */
export function PaymentMethodsConfig({ campgroundId }: PaymentMethodsConfigProps) {
  const [settings, setSettings] = useState<PaymentMethodSettings>({
    enableCardPayments: true,
    enableApplePay: true,
    enableGooglePay: true,
    enableACH: true,
    enableCash: true,
    enableCheck: true,
    enableFolio: true,
    enableGiftCards: true,
    enableExternalPOS: true,
    allowedCardBrands: ["visa", "mastercard", "amex", "discover"],
    showFeeBreakdown: false,
  });

  const [activeTab, setActiveTab] = useState("settings");

  const handleToggle = (key: keyof PaymentMethodSettings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleCardBrandToggle = (brand: CardBrand) => {
    setSettings((prev) => {
      const brands = prev.allowedCardBrands.includes(brand)
        ? prev.allowedCardBrands.filter((b) => b !== brand)
        : [...prev.allowedCardBrands, brand];
      return { ...prev, allowedCardBrands: brands };
    });
  };

  const enabledCount = [
    settings.enableCardPayments,
    settings.enableApplePay,
    settings.enableGooglePay,
    settings.enableACH,
    settings.enableCash,
    settings.enableCheck,
    settings.enableFolio,
  ].filter(Boolean).length;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="settings" className="gap-2">
          <Settings2 className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </TabsTrigger>
        <TabsTrigger value="gift-cards" className="gap-2">
          <Gift className="w-4 h-4" />
          <span className="hidden sm:inline">Gift Cards</span>
        </TabsTrigger>
        <TabsTrigger value="external-pos" className="gap-2">
          <Smartphone className="w-4 h-4" />
          <span className="hidden sm:inline">External POS</span>
        </TabsTrigger>
      </TabsList>

      {/* Settings Tab */}
      <TabsContent value="settings" className="space-y-6 motion-safe:animate-in motion-safe:fade-in">
        {/* Info Banner - Warmer design */}
        <div
          className="p-4 bg-status-info-bg border border-status-info-border rounded-xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-status-info/10 flex items-center justify-center flex-shrink-0">
              <Info className="h-4 w-4 text-status-info" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground">Payment Method Settings</p>
              <p className="text-sm text-status-info-text mt-1">
                Configure which payment methods to accept at checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Summary badge */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="w-4 h-4 text-status-success" aria-hidden="true" />
          <span>{enabledCount} payment methods enabled</span>
        </div>

      {/* Card Payments */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Card Payments
          </CardTitle>
          <CardDescription>
            Accept credit and debit card payments via Stripe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <MethodToggle
            id="enable-cards"
            label="Enable card payments"
            description="Accept Visa, Mastercard, and other major cards"
            checked={settings.enableCardPayments}
            onCheckedChange={(checked) => handleToggle("enableCardPayments", checked)}
          />

          {settings.enableCardPayments && (
            <div
              className="ml-4 pl-4 border-l-2 border-status-success-border space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2"
            >
              <p className="text-sm font-medium text-foreground">Accepted Card Brands</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_BRANDS.map((brand) => {
                  const isChecked = settings.allowedCardBrands.includes(brand.id);
                  return (
                    <label
                      key={brand.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border",
                        isChecked
                          ? "bg-status-success-bg border-status-success-border"
                          : "bg-card border-border hover:border-border"
                      )}
                    >
                      <Checkbox
                        id={`brand-${brand.id}`}
                        checked={isChecked}
                        onCheckedChange={() => handleCardBrandToggle(brand.id)}
                        aria-label={`Accept ${brand.label}`}
                      />
                      <span className="text-sm">{brand.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Digital Wallets */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Digital Wallets
          </CardTitle>
          <CardDescription>
            Fast checkout with Apple Pay, Google Pay, and Stripe Link
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <MethodToggle
            id="enable-apple-pay"
            label="Apple Pay"
            description="One-tap payments on Apple devices"
            checked={settings.enableApplePay}
            onCheckedChange={(checked) => handleToggle("enableApplePay", checked)}
          />
          <MethodToggle
            id="enable-google-pay"
            label="Google Pay"
            description="Quick checkout on Android and web"
            checked={settings.enableGooglePay}
            onCheckedChange={(checked) => handleToggle("enableGooglePay", checked)}
          />
        </CardContent>
      </Card>

      {/* Bank Payments */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Bank Payments
          </CardTitle>
          <CardDescription>
            ACH bank transfers for US customers (lower fees)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <MethodToggle
            id="enable-ach"
            label="ACH bank transfers"
            description="Direct bank debits with lower processing fees"
            checked={settings.enableACH}
            onCheckedChange={(checked) => handleToggle("enableACH", checked)}
          />
        </CardContent>
      </Card>

      {/* Manual Payments */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            In-Person Payments
          </CardTitle>
          <CardDescription>
            Cash, check, and charge-to-site options for staff
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <MethodToggle
            id="enable-cash"
            label="Cash payments"
            description="Record cash payments at check-in"
            checked={settings.enableCash}
            onCheckedChange={(checked) => handleToggle("enableCash", checked)}
          />
          <MethodToggle
            id="enable-check"
            label="Check payments"
            description="Accept personal or business checks"
            checked={settings.enableCheck}
            onCheckedChange={(checked) => handleToggle("enableCheck", checked)}
          />
          <MethodToggle
            id="enable-folio"
            label="Charge to site/folio"
            description="Let guests charge purchases to their reservation"
            checked={settings.enableFolio}
            onCheckedChange={(checked) => handleToggle("enableFolio", checked)}
          />
        </CardContent>
      </Card>

      {/* Fee Display */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/40">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Fee Transparency
          </CardTitle>
          <CardDescription>
            Control how processing fees appear to guests
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <MethodToggle
            id="show-fee-breakdown"
            label="Show fee breakdown"
            description="Display processing fees as a separate line item at checkout"
            checked={settings.showFeeBreakdown}
            onCheckedChange={(checked) => handleToggle("showFeeBreakdown", checked)}
          />
        </CardContent>
      </Card>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button
            disabled
            className="opacity-50 cursor-not-allowed"
            aria-describedby="save-note"
          >
            Save Changes
          </Button>
        </div>
        <p id="save-note" className="text-xs text-muted-foreground text-right">
          Saving will be available when API integration is complete.
        </p>
      </TabsContent>

      {/* Gift Cards Tab */}
      <TabsContent value="gift-cards" className="motion-safe:animate-in motion-safe:fade-in">
        <GiftCardsManagement campgroundId={campgroundId} />
      </TabsContent>

      {/* External POS Tab */}
      <TabsContent value="external-pos" className="motion-safe:animate-in motion-safe:fade-in">
        <ExternalPOSRecording campgroundId={campgroundId} />
      </TabsContent>
    </Tabs>
  );
}
