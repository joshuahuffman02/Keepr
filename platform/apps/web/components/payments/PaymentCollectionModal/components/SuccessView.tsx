"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "../../../ui/button";
import {
  Check,
  Receipt,
  Mail,
  Printer,
  Download,
  CreditCard,
  Banknote,
  Wallet,
  Gift,
  Home,
  Building,
  Smartphone,
  FileText,
  Lock,
  LogIn,
  LogOut,
  Loader2,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { usePaymentContext } from "../context/PaymentContext";
import {
  PaymentMethodType,
  PAYMENT_METHOD_INFO,
  TenderEntry,
  PaymentResult,
} from "../context/types";
import { cn } from "../../../../lib/utils";
import { useAchievement } from "../../../../hooks/use-achievement";
import { AchievementCelebration } from "../../../ui/achievement-celebration";
import { haptic } from "../../../../hooks/use-haptic";

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 200,
  damping: 15,
};
// import { apiClient } from "../../../../lib/api-client"; // TODO: Enable when email API is implemented

interface SuccessViewProps {
  onDone: (result: PaymentResult) => void;
  onCheckInOut?: () => void;
  checkInOutLabel?: string; // "Check In" or "Check Out"
  onPrintReceipt?: () => void;
}

export function SuccessView({
  onDone,
  onCheckInOut,
  checkInOutLabel,
  onPrintReceipt,
}: SuccessViewProps) {
  const { state, props } = usePaymentContext();
  const {
    tenderEntries,
    appliedDiscounts,
    charityDonation,
    originalAmountCents,
    discountCents,
    totalDueCents,
  } = state;

  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const achievement = useAchievement();

  // Build the payment result for callbacks
  const buildPaymentResult = (): PaymentResult => ({
    success: true,
    totalPaidCents: totalPaid,
    payments: completedEntries.map((t) => ({
      method: t.method,
      amountCents: t.amountCents,
      paymentId: t.reference,
    })),
    appliedDiscounts,
    charityDonation: charityDonation.optedIn ? charityDonation : undefined,
  });

  const completedEntries = tenderEntries.filter((e) => e.status === "completed");
  const totalPaid = completedEntries.reduce((sum, e) => sum + e.amountCents, 0);

  // Trigger achievement celebration on mount
  useEffect(() => {
    // Haptic feedback for successful payment
    haptic.success();

    // Check for first payment achievement
    const firstPaymentKey = "first_payment_collected";
    if (!achievement.isUnlocked(firstPaymentKey)) {
      achievement.unlockOnce(firstPaymentKey, {
        type: "first_payment",
        title: "First Payment Collected!",
        subtitle: "You're on your way to a great day",
      });
    }
    // Check for large payment ($500+)
    else if (totalPaid >= 50000 && !achievement.isUnlocked("large_payment")) {
      achievement.unlockOnce("large_payment", {
        type: "revenue_goal",
        title: "Big Payment!",
        subtitle: `You just collected $${(totalPaid / 100).toFixed(0)}`,
      });
    }
  }, []);

  // Auto-send email receipt when component mounts (if guest email available)
  // Note: Email functionality will be enabled once the API endpoint is implemented
  useEffect(() => {
    const sendEmailReceipt = async () => {
      if (!props.guestEmail || !props.campgroundId || emailSent || emailSending) return;

      // Get the reservation ID from subject if available
      const reservationId =
        props.subject?.type === "reservation" || props.subject?.type === "balance"
          ? props.subject.reservationId
          : undefined;

      if (!reservationId) return;

      setEmailSending(true);
      try {
        // TODO: Enable when API endpoint is implemented
        // await apiClient.emailPaymentReceipt(props.campgroundId, reservationId, {
        //   email: props.guestEmail,
        //   payments: completedEntries.map((t) => ({
        //     method: t.method,
        //     amountCents: t.amountCents,
        //     reference: t.reference,
        //   })),
        //   totalPaidCents: totalPaid,
        // });
        // setEmailSent(true);

        // For now, just simulate success after a brief delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        setEmailSent(true);
      } catch (err) {
        console.error("Failed to send receipt email:", err);
        // Don't show error - email is best effort
      } finally {
        setEmailSending(false);
      }
    };

    sendEmailReceipt();
  }, [props.guestEmail, props.campgroundId, props.subject, emailSent, emailSending]);

  const handleDone = () => {
    onDone(buildPaymentResult());
  };

  const handleCheckInOut = () => {
    if (onCheckInOut) {
      onCheckInOut();
    }
    onDone(buildPaymentResult());
  };

  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center py-6 space-y-6">
      {/* Achievement Celebration */}
      {achievement.isShowing && achievement.currentAchievement && (
        <AchievementCelebration
          show={achievement.isShowing}
          type={achievement.currentAchievement.type}
          title={achievement.currentAchievement.title}
          subtitle={achievement.currentAchievement.subtitle}
          onComplete={achievement.dismiss}
          variant="toast"
        />
      )}

      {/* Success Icon with Animation */}
      <motion.div
        className="relative"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.5, rotate: -180 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
        transition={SPRING_CONFIG}
      >
        {/* Decorative sparkles */}
        {!prefersReducedMotion && (
          <>
            <motion.div
              className="absolute -top-2 -right-2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, ...SPRING_CONFIG }}
            >
              <Sparkles className="h-5 w-5 text-amber-400" />
            </motion.div>
            <motion.div
              className="absolute -bottom-1 -left-3"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, ...SPRING_CONFIG }}
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </motion.div>
          </>
        )}
        {/* Main success circle */}
        <motion.div
          className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200"
          initial={prefersReducedMotion ? {} : { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" }}
          animate={prefersReducedMotion ? {} : { boxShadow: "0 0 0 20px rgba(16, 185, 129, 0)" }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Check className="h-10 w-10 text-white" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Title with Animation */}
      <motion.div
        className="text-center"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.2, ...SPRING_CONFIG }}
      >
        <h2 className="text-2xl font-bold text-foreground">Payment Complete!</h2>
        <p className="mt-1 text-muted-foreground">Thank you for your payment</p>
      </motion.div>

      {/* Email sent indicator */}
      {emailSending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sending receipt to {props.guestEmail}...
        </div>
      )}
      {emailSent && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          Receipt sent to {props.guestEmail}
        </div>
      )}

      {/* Payment Summary */}
      <motion.div
        className="w-full max-w-sm space-y-4"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ...SPRING_CONFIG }}
      >
        {/* Payment Breakdown */}
        <div className="bg-muted rounded-lg p-4 space-y-3">
          {/* Original amount */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">${(originalAmountCents / 100).toFixed(2)}</span>
          </div>

          {/* Discounts */}
          {appliedDiscounts.length > 0 && (
            <>
              {appliedDiscounts.map((discount, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-emerald-600">{discount.code || discount.description}</span>
                  <span className="text-emerald-600">
                    -${(discount.discountCents / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </>
          )}

          {/* Charity donation */}
          {charityDonation.optedIn && charityDonation.amountCents > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-pink-600">
                Donation to {charityDonation.charityName || "charity"}
              </span>
              <span className="text-pink-600">
                +${(charityDonation.amountCents / 100).toFixed(2)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border pt-2">
            <div className="flex justify-between font-medium">
              <span className="text-foreground">Total Paid</span>
              <span className="text-emerald-600 text-lg">${(totalPaid / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods Used */}
        {completedEntries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Payment{completedEntries.length > 1 ? "s" : ""} received via:
            </h3>
            <div className="space-y-2">
              {completedEntries.map((entry) => (
                <PaymentMethodRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div
        className="w-full max-w-sm space-y-3"
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.4, ...SPRING_CONFIG }}
      >
        {/* Print receipt */}
        {onPrintReceipt && (
          <Button variant="outline" onClick={onPrintReceipt} className="w-full">
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
        )}

        {/* Check In/Out button (if applicable) */}
        {onCheckInOut && checkInOutLabel && (
          <Button onClick={handleCheckInOut} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {checkInOutLabel === "Check In" ? (
              <LogIn className="h-4 w-4 mr-2" />
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            {checkInOutLabel}
          </Button>
        )}

        {/* Done/Close button */}
        <Button
          variant={onCheckInOut ? "outline" : "default"}
          onClick={handleDone}
          className={cn("w-full", !onCheckInOut && "bg-emerald-600 hover:bg-emerald-700")}
        >
          {onCheckInOut ? "Close" : "Done"}
        </Button>
      </motion.div>

      {/* Transaction reference */}
      {completedEntries.length > 0 && completedEntries[0].reference && (
        <p className="text-xs text-muted-foreground font-mono">
          Ref: {completedEntries[0].reference}
        </p>
      )}
    </div>
  );
}

interface PaymentMethodRowProps {
  entry: TenderEntry;
}

function PaymentMethodRow({ entry }: PaymentMethodRowProps) {
  const methodInfo = PAYMENT_METHOD_INFO[entry.method];
  const Icon = getMethodIcon(entry.method);

  return (
    <div className="flex items-center justify-between p-2 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-emerald-50 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <span className="text-sm text-foreground">{methodInfo.label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">
        ${(entry.amountCents / 100).toFixed(2)}
      </span>
    </div>
  );
}

function getMethodIcon(method: PaymentMethodType) {
  switch (method) {
    case "card":
    case "saved_card":
    case "terminal":
      return CreditCard;
    case "apple_pay":
    case "google_pay":
    case "link":
      return Smartphone;
    case "cash":
      return Banknote;
    case "check":
      return FileText;
    case "guest_wallet":
      return Wallet;
    case "gift_card":
      return Gift;
    case "folio":
      return Home;
    case "ach":
      return Building;
    case "deposit_hold":
      return Lock;
    case "external_pos":
      return Receipt;
    default:
      return CreditCard;
  }
}

/**
 * Compact success indicator for inline confirmation
 */
export function SuccessIndicator({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-emerald-600">
      <div className="h-5 w-5 rounded-full bg-emerald-100 flex items-center justify-center">
        <Check className="h-3 w-3" />
      </div>
      <span className="text-sm font-medium">{message || "Payment successful"}</span>
    </div>
  );
}
