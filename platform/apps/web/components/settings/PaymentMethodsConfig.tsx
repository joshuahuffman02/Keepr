"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CreditCard,
  Smartphone,
  Building2,
  Banknote,
  Receipt,
  Gift,
  Info,
  Sparkles,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      checked && !disabled ? "bg-emerald-50/50" : "hover:bg-slate-50",
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
            <span className="ml-2 text-xs text-slate-500 font-normal">Coming soon</span>
          )}
        </Label>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
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
    enableGiftCards: false,
    enableExternalPOS: false,
    allowedCardBrands: ["visa", "mastercard", "amex", "discover"],
    showFeeBreakdown: false,
  });

  const [showRoadmap, setShowRoadmap] = useState(false);

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
    <div className="space-y-6">
      {/* Info Banner - Warmer design */}
      <div
        className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Info className="h-4 w-4 text-blue-600" aria-hidden="true" />
          </div>
          <div>
            <p className="font-medium text-blue-900">Preview Mode</p>
            <p className="text-sm text-blue-700 mt-1">
              These settings show how your payment options will appear. Full API integration is coming soon.
            </p>
          </div>
        </div>
      </div>

      {/* Summary badge */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
        <span>{enabledCount} payment methods enabled</span>
      </div>

      {/* Card Payments */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-slate-600" aria-hidden="true" />
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
              className="ml-4 pl-4 border-l-2 border-emerald-200 space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2"
            >
              <p className="text-sm font-medium text-slate-700">Accepted Card Brands</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARD_BRANDS.map((brand) => {
                  const isChecked = settings.allowedCardBrands.includes(brand.id);
                  return (
                    <label
                      key={brand.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border",
                        isChecked
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-white border-slate-200 hover:border-slate-300"
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
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-slate-600" aria-hidden="true" />
            Digital Wallets
          </CardTitle>
          <CardDescription>
            Fast checkout with Apple Pay, Google Pay, and Stripe Link
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
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
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" aria-hidden="true" />
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
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-slate-600" aria-hidden="true" />
            In-Person Payments
          </CardTitle>
          <CardDescription>
            Cash, check, and charge-to-site options for staff
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
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
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-slate-600" aria-hidden="true" />
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

      {/* Coming Soon - Collapsed */}
      <Collapsible open={showRoadmap} onOpenChange={setShowRoadmap}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors w-full justify-center py-2">
          <Sparkles className="w-4 h-4" aria-hidden="true" />
          <span>Coming soon features</span>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform",
            showRoadmap && "rotate-180"
          )} aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <Card className="border-dashed opacity-75">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gift className="h-5 w-5 text-slate-400" aria-hidden="true" />
                Special Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100">
              <MethodToggle
                id="enable-gift-cards"
                label="Gift cards"
                description="Sell and redeem gift cards"
                checked={settings.enableGiftCards}
                onCheckedChange={(checked) => handleToggle("enableGiftCards", checked)}
                disabled
                comingSoon
              />
              <MethodToggle
                id="enable-external-pos"
                label="External POS"
                description="Integration with Square, Clover, and more"
                checked={settings.enableExternalPOS}
                onCheckedChange={(checked) => handleToggle("enableExternalPOS", checked)}
                disabled
                comingSoon
              />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

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
      <p id="save-note" className="text-xs text-slate-500 text-right">
        Saving will be available when API integration is complete.
      </p>
    </div>
  );
}
