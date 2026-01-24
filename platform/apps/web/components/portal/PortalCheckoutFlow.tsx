"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaymentCollectionModal } from "../payments/PaymentCollectionModal";
import { RoundUpForCharity } from "@/components/checkout/RoundUpForCharity";
import { apiClient } from "@/lib/api-client";
import { recordTelemetry } from "@/lib/sync-telemetry";
import { Loader2 } from "lucide-react";
import type {
  PaymentMethodType,
  PaymentResult,
} from "@/components/payments/PaymentCollectionModal/context/types";

type CartItem = {
  id: string;
  name: string;
  priceCents: number;
  qty: number;
};

interface PortalCheckoutFlowProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  campgroundId: string;
  guest: PortalGuest | null;
  onSuccess: (order: StoreOrder) => void;
  isOnline: boolean;
  queueOrder: (payload: StoreOrderPayload) => void;
  onQueued: () => void;
}

type FulfillmentType = "pickup" | "curbside" | "delivery" | "table_service";
type OrderPaymentMethod = PaymentMethodType | "charge_to_site";

type GuestReservation = {
  status?: string | null;
  site?: { siteNumber?: string | null } | null;
};

type PortalGuest = {
  id?: string | null;
  email?: string | null;
  primaryFirstName?: string | null;
  primaryLastName?: string | null;
  reservations?: GuestReservation[];
};

type StoreOrderPayload = {
  items: Array<{
    productId: string;
    qty: number;
  }>;
  paymentMethod: OrderPaymentMethod;
  channel: "online";
  fulfillmentType: FulfillmentType;
  guestId?: string;
  paymentId?: string;
  siteNumber?: string;
  deliveryInstructions?: string;
  charityDonation?: {
    charityId: string;
    amountCents: number;
  };
};

type StoreOrder = Awaited<ReturnType<typeof apiClient.createStoreOrder>>;

type CharityDonation = {
  optedIn: boolean;
  amountCents: number;
  charityId: string | null;
};

const getErrorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "Failed to create order";

export function PortalCheckoutFlow({
  isOpen,
  onClose,
  cart,
  campgroundId,
  guest,
  onSuccess,
  isOnline,
  queueOrder,
  onQueued,
}: PortalCheckoutFlowProps) {
  // Step management
  const [step, setStep] = useState<"config" | "payment">("config");

  // Order configuration
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("delivery");
  const [instructions, setInstructions] = useState("");
  const [locationHint, setLocationHint] = useState("");
  const [charityDonation, setCharityDonation] = useState<CharityDonation>({
    optedIn: false,
    amountCents: 0,
    charityId: null,
  });

  // Error handling
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Find active reservation
  const currentReservation = guest?.reservations?.find(
    (reservation) => reservation.status === "checked_in" || reservation.status === "confirmed",
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("config");
      setFulfillment("delivery");
      setInstructions("");
      setLocationHint(currentReservation?.site?.siteNumber || "");
      setCharityDonation({ optedIn: false, amountCents: 0, charityId: null });
      setError(null);
    }
  }, [isOpen, currentReservation?.site?.siteNumber]);

  const subtotalCents = cart.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const totalCents = subtotalCents + (charityDonation.optedIn ? charityDonation.amountCents : 0);

  const needsLocation = fulfillment !== "pickup";

  const handleProceedToPayment = () => {
    if (needsLocation && !locationHint) {
      setError("Please enter where we should bring your order");
      return;
    }
    setError(null);
    setStep("payment");
  };

  const handlePaymentSuccess = async (paymentResult: PaymentResult) => {
    setLoading(true);
    setError(null);

    try {
      // Build order payload with payment result
      const payload: StoreOrderPayload = {
        items: cart.map((item) => ({
          productId: item.id,
          qty: item.qty,
        })),
        paymentMethod: paymentResult.payments?.[0]?.method ?? "card",
        channel: "online",
        fulfillmentType: fulfillment,
        guestId: guest?.id ?? undefined,
      };

      // Add payment reference if available
      if (paymentResult.payments?.[0]?.paymentId) {
        payload.paymentId = paymentResult.payments[0].paymentId;
      }

      // Add location hint / site number
      if (locationHint) {
        payload.siteNumber = locationHint;
      }

      // Add delivery instructions
      if (instructions) {
        payload.deliveryInstructions = instructions;
      }

      // Add charity donation if applicable
      if (charityDonation.optedIn && charityDonation.charityId) {
        payload.charityDonation = {
          charityId: charityDonation.charityId,
          amountCents: charityDonation.amountCents,
        };
      }

      // Create the order
      const order = await apiClient.createStoreOrder(campgroundId, payload);

      recordTelemetry({
        source: "portal-store",
        type: "sync",
        status: "success",
        message: "Portal order completed via unified payment modal",
        meta: { items: cart.length, paymentMethod: payload.paymentMethod },
      });

      onSuccess(order);
    } catch (err) {
      console.error(err);
      setError(getErrorMessage(err));
      recordTelemetry({
        source: "portal-store",
        type: "error",
        status: "failed",
        message: "Order creation failed after payment",
        meta: { error: getErrorMessage(err) },
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle offline queue
  const handleOfflineQueue = () => {
    const payload: StoreOrderPayload = {
      items: cart.map((item) => ({
        productId: item.id,
        qty: item.qty,
      })),
      paymentMethod: "charge_to_site",
      channel: "online",
      fulfillmentType: fulfillment,
      guestId: guest?.id ?? undefined,
    };

    if (locationHint) {
      payload.siteNumber = locationHint;
    } else if (currentReservation?.site?.siteNumber) {
      payload.siteNumber = currentReservation.site.siteNumber;
    }

    if (instructions) {
      payload.deliveryInstructions = instructions;
    }

    if (charityDonation.optedIn && charityDonation.charityId) {
      payload.charityDonation = {
        charityId: charityDonation.charityId,
        amountCents: charityDonation.amountCents,
      };
    }

    queueOrder(payload);
    recordTelemetry({
      source: "portal-store",
      type: "queue",
      status: "pending",
      message: "Order queued offline",
      meta: { items: cart.length, paymentMethod: "charge_to_site" },
    });
    onQueued();
    onClose();
  };

  const handleClose = () => {
    setStep("config");
    onClose();
  };

  // Step 1: Order Configuration
  if (step === "config") {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Checkout</DialogTitle>
            <DialogDescription>
              Complete your order of ${(totalCents / 100).toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Fulfillment Type Selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFulfillment("delivery")}
                className={`p-3 rounded-lg border text-sm font-medium transition ${
                  fulfillment === "delivery"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-border text-foreground"
                }`}
              >
                Deliver to my site/cabin
              </button>
              <button
                onClick={() => setFulfillment("pickup")}
                className={`p-3 rounded-lg border text-sm font-medium transition ${
                  fulfillment === "pickup"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-border text-foreground"
                }`}
              >
                I'll pick up
              </button>
              <button
                onClick={() => setFulfillment("curbside")}
                className={`p-3 rounded-lg border text-sm font-medium transition ${
                  fulfillment === "curbside"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-border text-foreground"
                }`}
              >
                Curbside / meet at gate
              </button>
              <button
                onClick={() => setFulfillment("table_service")}
                className={`p-3 rounded-lg border text-sm font-medium transition ${
                  fulfillment === "table_service"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:border-border text-foreground"
                }`}
              >
                Table/QR service
              </button>
            </div>

            {/* Location hint - required for non-pickup */}
            {needsLocation && (
              <div className="space-y-2">
                <Label htmlFor="location-hint">
                  Where should we bring it?
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Input
                  id="location-hint"
                  placeholder="e.g. Site A12, Cabin 3, Table 4, Gatehouse"
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                />
              </div>
            )}

            {/* Instructions for staff */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Notes for staff</Label>
              <Input
                id="instructions"
                placeholder="Gate code, vehicle description, allergy note..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            {/* Order summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items ({cart.length})</span>
                <span className="font-medium">${(subtotalCents / 100).toFixed(2)}</span>
              </div>
              {charityDonation.optedIn && charityDonation.amountCents > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Charity donation</span>
                  <span>+${(charityDonation.amountCents / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t border-border">
                <span>Total</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Round up for charity */}
            <RoundUpForCharity
              campgroundId={campgroundId}
              totalCents={subtotalCents}
              onChange={setCharityDonation}
            />

            {/* Offline warning */}
            {!isOnline && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You're offline. Your order will be queued and submitted when you're back online.
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                {error}
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              {isOnline ? (
                <Button className="flex-1" onClick={handleProceedToPayment}>
                  Continue to Payment
                </Button>
              ) : (
                <Button className="flex-1" onClick={handleOfflineQueue}>
                  Queue Order
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Payment Collection via unified modal
  return (
    <PaymentCollectionModal
      isOpen={isOpen}
      onClose={() => setStep("config")}
      campgroundId={campgroundId}
      amountDueCents={totalCents}
      subject={{ type: "cart", items: cart }}
      context="portal"
      guestId={guest?.id ?? undefined}
      guestEmail={guest?.email ?? undefined}
      guestName={
        guest?.primaryFirstName
          ? `${guest.primaryFirstName} ${guest.primaryLastName || ""}`.trim()
          : undefined
      }
      enableSplitTender={false}
      enableCharityRoundUp={false} // Already handled in config step
      enablePartialPayment={false}
      onSuccess={handlePaymentSuccess}
      onError={(error) => {
        setError(error.message);
        setStep("config");
      }}
    />
  );
}
