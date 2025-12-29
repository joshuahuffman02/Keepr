"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Check,
  Sparkles,
  Copy,
  ArrowRight,
  Calendar,
  User,
  MapPin,
  CreditCard,
  Banknote,
  FileText,
  Home,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SPRING_CONFIG = { type: "spring" as const, stiffness: 200, damping: 15 };

export interface BookingReceiptData {
  reservationId: string;
  guestName: string;
  siteName: string;
  arrivalDate: string;
  departureDate: string;
  amountCents: number;
  method: string;
  cashReceivedCents?: number;
  changeDueCents?: number;
}

interface BookingSuccessDialogProps {
  open: boolean;
  receiptData: BookingReceiptData | null;
  onClose: () => void;
  onDone: (reservationId: string) => void;
}

const getMethodIcon = (method: string) => {
  switch (method.toLowerCase()) {
    case "cash":
      return Banknote;
    case "check":
      return FileText;
    case "folio":
      return Home;
    default:
      return CreditCard;
  }
};

const getMethodLabel = (method: string) => {
  switch (method.toLowerCase()) {
    case "cash":
      return "Cash";
    case "check":
      return "Check";
    case "folio":
      return "Folio";
    case "card":
      return "Card";
    default:
      return method;
  }
};

export function BookingSuccessDialog({
  open,
  receiptData,
  onClose,
  onDone,
}: BookingSuccessDialogProps) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  if (!receiptData) return null;

  const MethodIcon = getMethodIcon(receiptData.method);

  const handleCopyReceipt = () => {
    const receiptText = [
      `Reservation #${receiptData.reservationId.slice(0, 8)}`,
      `Guest: ${receiptData.guestName}`,
      `Site: ${receiptData.siteName}`,
      `Dates: ${receiptData.arrivalDate} → ${receiptData.departureDate}`,
      `Method: ${getMethodLabel(receiptData.method)}`,
      `Amount: $${(receiptData.amountCents / 100).toFixed(2)}`,
      receiptData.cashReceivedCents !== undefined
        ? `Cash received: $${(receiptData.cashReceivedCents / 100).toFixed(2)}`
        : "",
      receiptData.changeDueCents
        ? `Change due: $${(receiptData.changeDueCents / 100).toFixed(2)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(receiptText).catch(() => undefined);
      toast({
        title: "Receipt copied",
        description: "Receipt details copied to clipboard.",
      });
    }
  };

  const handleDone = () => {
    onDone(receiptData.reservationId);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Booking Confirmed</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-4 space-y-5">
          {/* Success Icon with Animation */}
          <motion.div
            className="relative"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.5, rotate: -180 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, rotate: 0 }
            }
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
              className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200"
              initial={
                prefersReducedMotion
                  ? {}
                  : { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" }
              }
              animate={
                prefersReducedMotion
                  ? {}
                  : { boxShadow: "0 0 0 16px rgba(16, 185, 129, 0)" }
              }
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Check className="h-8 w-8 text-white" strokeWidth={3} />
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.div
            className="text-center"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...SPRING_CONFIG }}
          >
            <h2 className="text-xl font-bold text-slate-900">
              Booking Confirmed!
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Reservation #{receiptData.reservationId.slice(0, 8)}
            </p>
          </motion.div>

          {/* Receipt Details */}
          <motion.div
            className="w-full space-y-3"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.3, ...SPRING_CONFIG }}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              {/* Guest */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Guest</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {receiptData.guestName}
                  </div>
                </div>
              </div>

              {/* Site */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Site</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {receiptData.siteName}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Dates</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {receiptData.arrivalDate} → {receiptData.departureDate}
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MethodIcon className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700">
                    {getMethodLabel(receiptData.method)}
                  </span>
                </div>
                <span className="text-lg font-bold text-emerald-700">
                  ${(receiptData.amountCents / 100).toFixed(2)}
                </span>
              </div>

              {receiptData.cashReceivedCents !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Cash received</span>
                  <span className="font-medium text-emerald-700">
                    ${(receiptData.cashReceivedCents / 100).toFixed(2)}
                  </span>
                </div>
              )}

              {receiptData.changeDueCents ? (
                <div className="flex items-center justify-between text-sm border-t border-emerald-200 pt-2 mt-2">
                  <span className="font-medium text-emerald-700">Change due</span>
                  <span className="font-bold text-emerald-800">
                    ${(receiptData.changeDueCents / 100).toFixed(2)}
                  </span>
                </div>
              ) : null}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            className="w-full flex flex-col gap-2"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...SPRING_CONFIG }}
          >
            <Button variant="outline" onClick={handleCopyReceipt}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Receipt
            </Button>
            <Button
              onClick={handleDone}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              View Reservation
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
