"use client";

import React, { Suspense } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Button } from "../../ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PaymentCollectionModalProps, PaymentMethodType, PAYMENT_METHOD_INFO } from "./context/types";
import { PaymentProvider, usePaymentContext } from "./context/PaymentContext";
import { MethodSelector } from "./components/MethodSelector";
import { PaymentSummary, PaymentSummaryInline } from "./components/PaymentSummary";

// Lazy load payment method components for code splitting
const CardMethod = React.lazy(() => import("./methods/CardMethod"));
const SavedCardMethod = React.lazy(() => import("./methods/SavedCardMethod"));
const WalletPayMethod = React.lazy(() => import("./methods/WalletPayMethod"));
const ACHMethod = React.lazy(() => import("./methods/ACHMethod"));
const TerminalMethod = React.lazy(() => import("./methods/TerminalMethod"));
const CashMethod = React.lazy(() => import("./methods/CashMethod"));
const CheckMethod = React.lazy(() => import("./methods/CheckMethod"));
const FolioMethod = React.lazy(() => import("./methods/FolioMethod"));
const GuestWalletMethod = React.lazy(() => import("./methods/GuestWalletMethod"));
const GiftCardMethod = React.lazy(() => import("./methods/GiftCardMethod"));
const DepositHoldMethod = React.lazy(() => import("./methods/DepositHoldMethod"));
const ExternalPOSMethod = React.lazy(() => import("./methods/ExternalPOSMethod"));

// Import discount/charity components
import { PromoCodeInput } from "./components/PromoCodeInput";
import { CharityRoundUp } from "./components/CharityRoundUp";
import { FeeEstimate } from "./components/FeeBreakdown";
import { SplitTenderManager } from "./components/SplitTenderManager";
import { SuccessView } from "./components/SuccessView";

// ============================================================================
// INNER MODAL CONTENT (uses context)
// ============================================================================

function PaymentModalContent() {
  const { state, actions, props } = usePaymentContext();
  const { step, selectedMethod, loading, error, configLoading } = state;

  const handleClose = () => {
    if (loading) return; // Prevent closing during payment
    actions.reset();
    props.onClose();
  };

  const handleBack = () => {
    if (step === "payment_entry") {
      actions.selectMethod(null);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "method_select":
        return "Select Payment Method";
      case "payment_entry":
        return selectedMethod ? PAYMENT_METHOD_INFO[selectedMethod].label : "Enter Payment";
      case "processing":
        return "Processing Payment...";
      case "success":
        return "Payment Complete";
      case "error":
        return "Payment Failed";
      default:
        return "Payment";
    }
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {step === "payment_entry" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={loading}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <DialogTitle>{getStepTitle()}</DialogTitle>
              {step !== "processing" && step !== "success" && (
                <PaymentSummaryInline />
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {/* Loading state */}
          {configLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <span className="ml-2 text-slate-600">Loading payment options...</span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Method Selection Step */}
          {!configLoading && step === "method_select" && (
            <div className="space-y-6">
              {/* Split tender manager (shows applied payments) */}
              {props.enableSplitTender !== false && (
                <SplitTenderManager
                  onAddPayment={() => {}}
                  disabled={loading}
                />
              )}

              {/* Promo code input */}
              {props.enablePromoCode !== false && (
                <PromoCodeInput disabled={loading} />
              )}

              {/* Payment method selector */}
              <MethodSelector disabled={loading} />

              {/* Fee estimate */}
              <FeeEstimate />

              {/* Charity round-up */}
              {props.enableCharityRoundUp !== false && (
                <CharityRoundUp disabled={loading} />
              )}

              {/* Payment summary */}
              <PaymentSummary />
            </div>
          )}

          {/* Payment Entry Step */}
          {!configLoading && step === "payment_entry" && selectedMethod && (
            <div className="space-y-6">
              {/* Render the appropriate payment method component */}
              <PaymentMethodRenderer method={selectedMethod} />
              <PaymentSummary />
            </div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
              <p className="text-slate-600">Processing your payment...</p>
              {selectedMethod && (
                <p className="text-sm text-slate-500">
                  Using {PAYMENT_METHOD_INFO[selectedMethod].label}
                </p>
              )}
            </div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <SuccessView
              onDone={(result) => {
                props.onSuccess(result);
              }}
              onCheckInOut={props.onCheckInOut}
              checkInOutLabel={props.checkInOutLabel}
              onPrintReceipt={() => window.print()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// PAYMENT METHOD RENDERER
// ============================================================================

interface PaymentMethodRendererProps {
  method: PaymentMethodType;
}

function PaymentMethodRenderer({ method }: PaymentMethodRendererProps) {
  const { state, actions, props } = usePaymentContext();

  const handleSuccess = (paymentId: string) => {
    // Always show success view when a payment method completes
    // Note: We can't check state.remainingCents here because React state
    // updates from addTenderEntry haven't propagated yet (stale closure)
    // The success view will show appropriate options based on remaining balance
    actions.completePayment();
  };

  const handleError = (error: string) => {
    props.onError?.({
      code: "PAYMENT_FAILED",
      message: error,
      method,
      recoverable: true,
    });
  };

  const handleCancel = () => {
    actions.selectMethod(null);
  };

  // Loading fallback for lazy-loaded components
  const LoadingFallback = (
    <div className="py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
      <p className="mt-2 text-slate-600">Loading payment form...</p>
    </div>
  );

  // Placeholder for methods not yet implemented
  const PlaceholderComponent = () => {
    const methodInfo = PAYMENT_METHOD_INFO[method];
    return (
      <div className="p-6 border border-slate-200 rounded-lg bg-slate-50">
        <div className="text-center space-y-4">
          <p className="text-slate-600">
            {methodInfo.label} payment component coming soon
          </p>
          <p className="text-sm text-slate-500">{methodInfo.description}</p>
          <Button variant="outline" onClick={handleCancel}>
            Back
          </Button>
        </div>
      </div>
    );
  };

  // Render the appropriate payment method component
  return (
    <Suspense fallback={LoadingFallback}>
      {method === "card" && (
        <CardMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "saved_card" && (
        <SavedCardMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "apple_pay" && (
        <WalletPayMethod
          walletType="apple_pay"
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "google_pay" && (
        <WalletPayMethod
          walletType="google_pay"
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "ach" && (
        <ACHMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "terminal" && (
        <TerminalMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "cash" && (
        <CashMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "check" && (
        <CheckMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "folio" && (
        <FolioMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "guest_wallet" && (
        <GuestWalletMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "gift_card" && (
        <GiftCardMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "deposit_hold" && (
        <DepositHoldMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {method === "external_pos" && (
        <ExternalPOSMethod
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      )}
      {/* Link method - show placeholder for now */}
      {method === "link" && (
        <PlaceholderComponent />
      )}
    </Suspense>
  );
}

// ============================================================================
// MAIN EXPORT (wraps content with provider)
// ============================================================================

export function PaymentCollectionModal(props: PaymentCollectionModalProps) {
  return (
    <PaymentProvider modalProps={props}>
      <PaymentModalContent />
    </PaymentProvider>
  );
}
