"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Smartphone,
  Building2,
  Banknote,
  Receipt,
  Tent,
  Gift,
  Info
} from "lucide-react";

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

const CARD_BRANDS: { id: CardBrand; label: string; icon: string }[] = [
  { id: "visa", label: "Visa", icon: "💳" },
  { id: "mastercard", label: "Mastercard", icon: "💳" },
  { id: "amex", label: "American Express", icon: "💳" },
  { id: "discover", label: "Discover", icon: "💳" },
  { id: "diners", label: "Diners Club", icon: "💳" },
  { id: "jcb", label: "JCB", icon: "💳" },
];

/**
 * Payment Methods Configuration Component
 * Note: This component displays the available payment method toggles.
 * Full API integration for saving settings is coming soon.
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

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Preview Mode</p>
            <p className="text-sm text-blue-700 mt-1">
              Payment method configuration is in preview. Changes here show how the
              settings will appear but are not saved to the database yet.
            </p>
          </div>
        </div>
      </div>

      {/* Card Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Card Payments
          </CardTitle>
          <CardDescription>
            Accept credit and debit card payments via Stripe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-cards" className="flex-1">
              Enable card payments
            </Label>
            <Switch
              id="enable-cards"
              checked={settings.enableCardPayments}
              onCheckedChange={(checked) => handleToggle("enableCardPayments", checked)}
            />
          </div>

          {settings.enableCardPayments && (
            <div className="pl-4 border-l-2 border-slate-200 space-y-3">
              <p className="text-sm font-medium text-slate-700">Accepted Card Brands</p>
              <div className="grid grid-cols-2 gap-3">
                {CARD_BRANDS.map((brand) => (
                  <label
                    key={brand.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={settings.allowedCardBrands.includes(brand.id)}
                      onCheckedChange={() => handleCardBrandToggle(brand.id)}
                    />
                    <span className="text-sm">{brand.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Digital Wallets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Digital Wallets
          </CardTitle>
          <CardDescription>
            Apple Pay, Google Pay, and Stripe Link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-apple-pay" className="flex-1">
              Apple Pay
            </Label>
            <Switch
              id="enable-apple-pay"
              checked={settings.enableApplePay}
              onCheckedChange={(checked) => handleToggle("enableApplePay", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-google-pay" className="flex-1">
              Google Pay
            </Label>
            <Switch
              id="enable-google-pay"
              checked={settings.enableGooglePay}
              onCheckedChange={(checked) => handleToggle("enableGooglePay", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bank Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank Payments
          </CardTitle>
          <CardDescription>
            ACH bank transfers for US customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-ach" className="flex-1">
              Enable ACH payments
            </Label>
            <Switch
              id="enable-ach"
              checked={settings.enableACH}
              onCheckedChange={(checked) => handleToggle("enableACH", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Manual Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Manual Payments
          </CardTitle>
          <CardDescription>
            Cash, check, and charge-to-site options for staff
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-cash" className="flex-1">
              Cash payments
            </Label>
            <Switch
              id="enable-cash"
              checked={settings.enableCash}
              onCheckedChange={(checked) => handleToggle("enableCash", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-check" className="flex-1">
              Check payments
            </Label>
            <Switch
              id="enable-check"
              checked={settings.enableCheck}
              onCheckedChange={(checked) => handleToggle("enableCheck", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="enable-folio">Charge to site/folio</Label>
              <p className="text-xs text-slate-500">
                Allow guests to charge purchases to their reservation
              </p>
            </div>
            <Switch
              id="enable-folio"
              checked={settings.enableFolio}
              onCheckedChange={(checked) => handleToggle("enableFolio", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Special Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Special Payment Methods
          </CardTitle>
          <CardDescription>
            Gift cards and external POS integration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="enable-gift-cards">Gift cards</Label>
              <p className="text-xs text-slate-500">Coming soon</p>
            </div>
            <Switch
              id="enable-gift-cards"
              checked={settings.enableGiftCards}
              onCheckedChange={(checked) => handleToggle("enableGiftCards", checked)}
              disabled
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="enable-external-pos">External POS</Label>
              <p className="text-xs text-slate-500">Square, Clover, etc. - Coming soon</p>
            </div>
            <Switch
              id="enable-external-pos"
              checked={settings.enableExternalPOS}
              onCheckedChange={(checked) => handleToggle("enableExternalPOS", checked)}
              disabled
            />
          </div>
        </CardContent>
      </Card>

      {/* Fee Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Fee Display
          </CardTitle>
          <CardDescription>
            Control how processing fees are shown to guests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="show-fee-breakdown">Show fee breakdown</Label>
              <p className="text-xs text-slate-500">
                When enabled, guests see processing fees as a separate line item
                (only applies when fee mode is set to "pass through")
              </p>
            </div>
            <Switch
              id="show-fee-breakdown"
              checked={settings.showFeeBreakdown}
              onCheckedChange={(checked) => handleToggle("showFeeBreakdown", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button - Disabled in Preview */}
      <div className="flex justify-end">
        <Button disabled className="opacity-50">
          Save Changes (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
