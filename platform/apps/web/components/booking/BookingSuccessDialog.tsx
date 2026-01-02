"use client";

import { useEffect, useState, useMemo } from "react";
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
  Share2,
  Clock,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { CelebrationAnimation } from "./CelebrationAnimation";

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

// Generate calendar event links
function generateCalendarLinks(data: BookingReceiptData, campgroundName?: string) {
  const title = `Camping Trip - ${campgroundName || data.siteName}`;
  const description = `Reservation #${data.reservationId.slice(0, 8)}\nSite: ${data.siteName}\nGuest: ${data.guestName}`;

  // Parse dates - assumes format like "2024-01-15" or "Jan 15, 2024"
  const parseDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const startDate = parseDate(data.arrivalDate);
  const endDate = parseDate(data.departureDate);

  // Google Calendar
  const googleUrl = new URL("https://calendar.google.com/calendar/render");
  googleUrl.searchParams.set("action", "TEMPLATE");
  googleUrl.searchParams.set("text", title);
  googleUrl.searchParams.set("dates", `${startDate}/${endDate}`);
  googleUrl.searchParams.set("details", description);

  // Outlook Calendar
  const outlookUrl = new URL("https://outlook.live.com/calendar/0/deeplink/compose");
  outlookUrl.searchParams.set("subject", title);
  outlookUrl.searchParams.set("startdt", data.arrivalDate);
  outlookUrl.searchParams.set("enddt", data.departureDate);
  outlookUrl.searchParams.set("body", description);

  // Apple Calendar (.ics file)
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${startDate}`,
    `DTEND:${endDate}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const icsBlob = new Blob([icsContent], { type: "text/calendar" });
  const icsUrl = URL.createObjectURL(icsBlob);

  return {
    google: googleUrl.toString(),
    outlook: outlookUrl.toString(),
    apple: icsUrl
  };
}

// Calculate days until arrival
function getDaysUntilArrival(arrivalDate: string): number {
  const arrival = new Date(arrivalDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  arrival.setHours(0, 0, 0, 0);
  const diffTime = arrival.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function BookingSuccessDialog({
  open,
  receiptData,
  onClose,
  onDone,
  campgroundName
}: BookingSuccessDialogProps & { campgroundName?: string }) {
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCalendarMenu, setShowCalendarMenu] = useState(false);

  // Trigger celebration when dialog opens
  useEffect(() => {
    if (open && receiptData) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open, receiptData]);

  const calendarLinks = useMemo(() => {
    if (!receiptData) return null;
    return generateCalendarLinks(receiptData, campgroundName);
  }, [receiptData, campgroundName]);

  const daysUntilArrival = useMemo(() => {
    if (!receiptData) return 0;
    return getDaysUntilArrival(receiptData.arrivalDate);
  }, [receiptData]);

  if (!receiptData) return null;

  const MethodIcon = getMethodIcon(receiptData.method);
  const firstName = receiptData.guestName.split(" ")[0];

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
    <>
      {/* Celebration confetti */}
      <CelebrationAnimation isActive={showCelebration} />

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

            {/* Personalized Title */}
            <motion.div
              className="text-center"
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
              }
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.2, ...SPRING_CONFIG }}
            >
              <h2 className="text-xl font-bold text-foreground">
                You&apos;re going camping, {firstName}!
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reservation #{receiptData.reservationId.slice(0, 8)}
              </p>
              {daysUntilArrival > 0 && (
                <motion.p
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-sm font-medium"
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, ...SPRING_CONFIG }}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {daysUntilArrival === 1 ? "Tomorrow!" : `${daysUntilArrival} days until your adventure`}
                </motion.p>
              )}
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
            <div className="rounded-xl border border-border bg-muted p-4 space-y-3">
              {/* Guest */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Guest</div>
                  <div className="text-sm font-semibold text-foreground">
                    {receiptData.guestName}
                  </div>
                </div>
              </div>

              {/* Site */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Site</div>
                  <div className="text-sm font-semibold text-foreground">
                    {receiptData.siteName}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Dates</div>
                  <div className="text-sm font-semibold text-foreground">
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

          {/* Add to Calendar */}
          {calendarLinks && (
            <motion.div
              className="w-full"
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
              }
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ delay: 0.35, ...SPRING_CONFIG }}
            >
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-center"
                  onClick={() => setShowCalendarMenu(!showCalendarMenu)}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Add to Calendar
                </Button>

                {showCalendarMenu && (
                  <motion.div
                    className="absolute top-full left-0 right-0 mt-2 p-2 bg-card rounded-lg border border-border shadow-lg z-10"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <a
                      href={calendarLinks.google}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm text-foreground transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Google Calendar
                    </a>
                    <a
                      href={calendarLinks.outlook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm text-foreground transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#0078D4">
                        <path d="M24 7.387v10.478c0 .23-.08.424-.238.576-.16.152-.354.228-.586.228h-8.5v-6.5L17 12l2.5-.186V7.387c0-.11-.037-.205-.11-.282-.073-.077-.167-.116-.28-.116H10.5V4.73L24 7.387zm-13.5 6.802V20.5H2.724c-.23 0-.424-.076-.584-.228-.16-.152-.24-.347-.24-.576V7.387L10.5 4.73v2.259H2.5v6.5l8 .7zM0 7.387c0-.23.08-.424.24-.576.16-.152.354-.228.584-.228h8.676v3.406H.5c-.11 0-.205.04-.282.116-.077.077-.116.172-.116.282v4.427L0 14.189V7.387z"/>
                      </svg>
                      Outlook
                    </a>
                    <a
                      href={calendarLinks.apple}
                      download="camping-reservation.ics"
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-sm text-foreground transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      Apple Calendar
                    </a>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <motion.div
            className="w-full flex flex-col gap-2"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
            }
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...SPRING_CONFIG }}
          >
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopyReceipt} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy Receipt
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `Camping Reservation`,
                      text: `I'm going camping! Reservation #${receiptData.reservationId.slice(0, 8)} at ${receiptData.siteName}`,
                    }).catch(() => {});
                  } else {
                    handleCopyReceipt();
                  }
                }}
                className="px-3"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
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
    </>
  );
}
