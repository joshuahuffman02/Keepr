"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, MapPin, Users, TrendingUp } from "lucide-react";

// Sample data for social proof notifications
const FIRST_NAMES = [
  "Sarah", "Mike", "Emily", "David", "Jessica", "Chris", "Amanda", "Josh",
  "Lauren", "Ryan", "Ashley", "Matt", "Nicole", "Tyler", "Megan", "Brandon",
];

const LOCATIONS = [
  "near Yellowstone",
  "in Colorado",
  "by Lake Tahoe",
  "in Yosemite",
  "at Big Bear",
  "near Grand Canyon",
  "in Joshua Tree",
  "at Zion",
  "near Glacier",
  "in the Smokies",
];

const SITE_TYPES = [
  "an RV site",
  "a tent site",
  "a cabin",
  "a glamping tent",
  "a lakefront spot",
  "a group site",
];

const TRENDING_MESSAGES = [
  "Lake Tahoe is trending this weekend",
  "Colorado campgrounds are filling up fast",
  "Yellowstone bookings up 40% this month",
  "RV sites are popular right now",
  "Glamping searches up 25% today",
];

type ActivityType = "booking" | "viewing" | "trending";

interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: number;
}

const STORAGE_KEY = "campreserv:activity-feed-dismissed";

function generateActivity(): Activity {
  const types: ActivityType[] = ["booking", "booking", "viewing", "trending"];
  const type = types[Math.floor(Math.random() * types.length)];

  let message = "";

  switch (type) {
    case "booking":
      const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
      const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      const siteType = SITE_TYPES[Math.floor(Math.random() * SITE_TYPES.length)];
      message = `${name} just booked ${siteType} ${location}`;
      break;
    case "viewing":
      const viewerCount = Math.floor(Math.random() * 15) + 5;
      const viewLocation = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      message = `${viewerCount} people viewing campgrounds ${viewLocation}`;
      break;
    case "trending":
      message = TRENDING_MESSAGES[Math.floor(Math.random() * TRENDING_MESSAGES.length)];
      break;
  }

  return {
    id: Math.random().toString(36).substring(2, 9),
    type,
    message,
    timestamp: Date.now(),
  };
}

interface ActivityFeedProps {
  /** Delay before first notification in ms (default: 10000) */
  initialDelay?: number;
  /** Interval between notifications in ms (default: 30000) */
  interval?: number;
  /** How long each notification shows in ms (default: 5000) */
  displayDuration?: number;
}

export function ActivityFeed({
  initialDelay = 10000,
  interval = 30000,
  displayDuration = 5000,
}: ActivityFeedProps) {
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isDismissedPermanently, setIsDismissedPermanently] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Check localStorage for permanent dismissal
  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(STORAGE_KEY) === "true";
    setIsDismissedPermanently(dismissed);
  }, []);

  // Show activity notifications
  useEffect(() => {
    if (isDismissedPermanently || prefersReducedMotion) return;

    let showTimeout: NodeJS.Timeout;
    let hideTimeout: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    const showActivity = () => {
      const activity = generateActivity();
      setCurrentActivity(activity);
      setIsVisible(true);

      hideTimeout = setTimeout(() => {
        setIsVisible(false);
      }, displayDuration);
    };

    // Initial delay before first notification
    showTimeout = setTimeout(() => {
      showActivity();

      // Then show periodically
      intervalId = setInterval(showActivity, interval);
    }, initialDelay);

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
      clearInterval(intervalId);
    };
  }, [isDismissedPermanently, prefersReducedMotion, initialDelay, interval, displayDuration]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
  }, []);

  const handleDismissPermanently = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsDismissedPermanently(true);
    setIsVisible(false);
  }, []);

  if (isDismissedPermanently || prefersReducedMotion) {
    return null;
  }

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case "booking":
        return <MapPin className="w-4 h-4 text-emerald-600" />;
      case "viewing":
        return <Users className="w-4 h-4 text-blue-600" />;
      case "trending":
        return <TrendingUp className="w-4 h-4 text-amber-600" />;
    }
  };

  const getBgColor = (type: ActivityType) => {
    switch (type) {
      case "booking":
        return "bg-emerald-50 border-emerald-100";
      case "viewing":
        return "bg-blue-50 border-blue-100";
      case "trending":
        return "bg-amber-50 border-amber-100";
    }
  };

  return (
    <AnimatePresence>
      {isVisible && currentActivity && (
        <motion.div
          className="fixed bottom-6 left-6 z-40 max-w-sm"
          initial={{ opacity: 0, x: -100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -100, scale: 0.9 }}
          transition={{ type: "spring", bounce: 0.3 }}
        >
          <div
            className={`rounded-xl px-4 py-3 shadow-lg border flex items-start gap-3 ${getBgColor(
              currentActivity.type
            )}`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(currentActivity.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {currentActivity.message}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Just now</p>
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-full hover:bg-muted/50 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Don't show again link */}
          <button
            onClick={handleDismissPermanently}
            className="mt-2 text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            Don't show these
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
