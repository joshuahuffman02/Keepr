"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { differenceInCalendarDays, differenceInHours, format } from "date-fns";
import { Sparkles, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SPRING_CONFIG } from "@/lib/portal-constants";

interface ArrivalCountdownProps {
  arrivalDate: string;
  checkInTime: string | null;
  siteName: string;
  siteNumber: string;
  campgroundName: string;
}

type CountdownUrgency = "low" | "medium" | "high";

export function ArrivalCountdown({
  arrivalDate,
  checkInTime,
  siteName,
  siteNumber,
  campgroundName,
}: ArrivalCountdownProps) {
  // Initialize with null to avoid hydration mismatch, then set on mount
  const [now, setNow] = useState<Date | null>(null);

  // Set initial value and update every minute for accurate countdown
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!now) return null;

  const arrival = new Date(arrivalDate);
  const daysUntil = differenceInCalendarDays(arrival, now);
  const hoursUntil = differenceInHours(arrival, now);

  // Don't show if arrival is in the past
  if (daysUntil < 0) return null;

  // Different messaging based on time until arrival
  const getCountdownContent = (): {
    number: number;
    label: string;
    message: string;
    urgency: CountdownUrgency;
  } => {
    if (daysUntil === 0) {
      return {
        number: hoursUntil > 0 ? hoursUntil : 0,
        label: hoursUntil === 1 ? "hour" : "hours",
        message: "Your adventure begins today!",
        urgency: "high",
      };
    }
    if (daysUntil === 1) {
      return {
        number: 1,
        label: "day",
        message: "Almost there! See you tomorrow",
        urgency: "medium",
      };
    }
    if (daysUntil <= 7) {
      return {
        number: daysUntil,
        label: "days",
        message: "Your trip is coming up soon!",
        urgency: "medium",
      };
    }
    return {
      number: daysUntil,
      label: "days",
      message: "Your adventure starts in",
      urgency: "low",
    };
  };

  const content = getCountdownContent();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_CONFIG}
    >
      <Card className="overflow-hidden border-0 shadow-lg">
        <div
          className={`relative ${
            content.urgency === "high"
              ? "bg-gradient-to-br from-amber-500 to-orange-600"
              : "bg-gradient-to-br from-emerald-500 to-teal-600"
          } text-white`}
        >
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm mb-1">{content.message}</p>
                <div className="flex items-baseline gap-2">
                  <motion.span
                    key={content.number}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-bold"
                  >
                    {content.number}
                  </motion.span>
                  <span className="text-xl text-white/90">{content.label}</span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1 text-sm text-white/80">
                  <Clock className="h-4 w-4" />
                  <span>Check-in: {checkInTime || "3:00 PM"}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-white/80">
                  <MapPin className="h-4 w-4" />
                  <span>Site {siteNumber}</span>
                </div>
                <p className="text-xs text-white/70">{format(arrival, "EEEE, MMMM d, yyyy")}</p>
              </div>
            </div>

            {/* Decorative sparkles */}
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <Sparkles className="h-28 w-28" />
            </div>
          </CardContent>
        </div>
      </Card>
    </motion.div>
  );
}
