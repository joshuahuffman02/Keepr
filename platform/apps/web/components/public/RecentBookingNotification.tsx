"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";

interface Booking {
  guestName: string;
  siteType: string;
  timeAgo: string;
}

// Stubbed recent bookings - in production, fetch from API
const stubBookings: Booking[] = [
  { guestName: "Sarah M.", siteType: "RV Site", timeAgo: "5 minutes ago" },
  { guestName: "Mike T.", siteType: "Cabin", timeAgo: "12 minutes ago" },
  { guestName: "Lisa K.", siteType: "Tent Site", timeAgo: "20 minutes ago" },
  { guestName: "David R.", siteType: "Glamping", timeAgo: "35 minutes ago" },
  { guestName: "Emma W.", siteType: "RV Site", timeAgo: "1 hour ago" },
];

export function RecentBookingNotification({ campgroundId }: { campgroundId?: string }) {
  const [visible, setVisible] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;

    let index = 0;

    // Show first notification after 8 seconds
    const initialTimeout = setTimeout(() => {
      setBooking(stubBookings[index]);
      setVisible(true);
    }, 8000);

    // Show subsequent notifications every 30 seconds
    const interval = setInterval(() => {
      index = (index + 1) % stubBookings.length;
      setBooking(stubBookings[index]);
      setVisible(true);

      // Auto-hide after 6 seconds
      setTimeout(() => setVisible(false), 6000);
    }, 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [campgroundId, dismissed]);

  // Auto-hide current notification after 6 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && booking && !dismissed && (
        <motion.div
          className="fixed bottom-20 left-6 z-40 max-w-sm"
          initial={{ opacity: 0, x: -100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -100, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-4 pr-10">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {booking.guestName} just booked
                </p>
                <p className="text-xs text-slate-600">
                  {booking.siteType} • {booking.timeAgo}
                </p>
              </div>
            </div>

            {/* Pulse indicator */}
            <div className="absolute -top-1 -right-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
