"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Sparkles, MapPin, Users, TrendingUp, Heart } from "lucide-react";

// Camper avatar illustrations (simple colored circles with initials for now)
const AVATAR_COLORS = [
  "from-emerald-400 to-teal-500",
  "from-blue-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-pink-400 to-rose-500",
  "from-purple-400 to-violet-500",
  "from-cyan-400 to-sky-500",
];

// Magical first names
const FIRST_NAMES = [
  "Sarah", "Mike", "Emily", "David", "Jessica", "Chris", "Amanda", "Josh",
  "Lauren", "Ryan", "Ashley", "Matt", "Nicole", "Tyler", "Megan", "Brandon",
  "Emma", "Jake", "Sophia", "Ethan", "Olivia", "Liam", "Ava", "Noah",
];

// Magical location descriptions
const LOCATIONS = [
  { short: "Yellowstone", full: "the magical wilderness of Yellowstone" },
  { short: "Colorado", full: "the majestic Colorado mountains" },
  { short: "Lake Tahoe", full: "the crystal waters of Lake Tahoe" },
  { short: "Yosemite", full: "the breathtaking Yosemite Valley" },
  { short: "Big Bear", full: "the cozy forests of Big Bear" },
  { short: "Grand Canyon", full: "the awe-inspiring Grand Canyon" },
  { short: "Joshua Tree", full: "the starlit skies of Joshua Tree" },
  { short: "Zion", full: "the red cliffs of Zion" },
  { short: "Glacier", full: "the pristine wilderness of Glacier" },
  { short: "Smokies", full: "the misty peaks of the Smokies" },
  { short: "Acadia", full: "the rugged beauty of Acadia" },
  { short: "Olympic", full: "the enchanted rainforests of Olympic" },
];

// Magical site descriptions
const SITE_TYPES = [
  { short: "RV site", full: "a home-on-wheels adventure spot" },
  { short: "cabin", full: "a cozy cabin hideaway" },
  { short: "tent site", full: "an under-the-stars basecamp" },
  { short: "glamping tent", full: "a luxury glamping retreat" },
  { short: "lakefront spot", full: "a waterfront paradise" },
  { short: "treehouse", full: "an enchanted treehouse" },
];

// Trending messages with magical flair
const TRENDING_MESSAGES = [
  { location: "Yellowstone", message: "Yellowstone is calling adventurers this weekend" },
  { location: "Colorado", message: "Colorado magic is trending among explorers" },
  { location: "Lake Tahoe", message: "Lake Tahoe sparkles with new bookings" },
  { location: "Yosemite", message: "Yosemite dreams are popular right now" },
  { location: "National Parks", message: "National park fever is spreading" },
];

type ActivityType = "booking" | "viewing" | "trending" | "wishlist";

interface Activity {
  id: string;
  type: ActivityType;
  name?: string;
  message: string;
  subMessage?: string;
  location?: string;
  avatarColor?: string;
  initial?: string;
  count?: number;
}

function generateActivities(): Activity[] {
  const activities: Activity[] = [];

  // Generate 3 diverse activities
  const types: ActivityType[] = ["booking", "viewing", "trending"];

  types.forEach((type, index) => {
    const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    const siteType = SITE_TYPES[Math.floor(Math.random() * SITE_TYPES.length)];
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    switch (type) {
      case "booking":
        activities.push({
          id: `${type}-${index}`,
          type,
          name,
          message: `A happy camper just booked ${siteType.full}`,
          subMessage: `in ${location.full}`,
          location: location.short,
          avatarColor,
          initial: name[0],
        });
        break;
      case "viewing":
        const viewerCount = Math.floor(Math.random() * 20) + 8;
        activities.push({
          id: `${type}-${index}`,
          type,
          message: `${viewerCount} adventurers are planning their next escape`,
          subMessage: `exploring ${location.short} right now`,
          count: viewerCount,
        });
        break;
      case "trending":
        const trending = TRENDING_MESSAGES[Math.floor(Math.random() * TRENDING_MESSAGES.length)];
        activities.push({
          id: `${type}-${index}`,
          type,
          message: trending.message,
          subMessage: "Join the adventure",
          location: trending.location,
        });
        break;
    }
  });

  return activities;
}

interface InlineActivityFeedProps {
  className?: string;
}

export function InlineActivityFeed({ className }: InlineActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Generate initial activities after a short delay
    const timer = setTimeout(() => {
      setActivities(generateActivities());
      setIsVisible(true);
    }, 1500);

    // Refresh activities every 45 seconds
    const interval = setInterval(() => {
      setActivities(generateActivities());
    }, 45000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  if (prefersReducedMotion || !isVisible || activities.length === 0) {
    return null;
  }

  const getIcon = (type: ActivityType) => {
    switch (type) {
      case "booking":
        return <Sparkles className="w-4 h-4" />;
      case "viewing":
        return <Users className="w-4 h-4" />;
      case "trending":
        return <TrendingUp className="w-4 h-4" />;
      case "wishlist":
        return <Heart className="w-4 h-4" />;
    }
  };

  const getStyles = (type: ActivityType) => {
    switch (type) {
      case "booking":
        return {
          bg: "bg-gradient-to-br from-emerald-50 to-teal-50",
          border: "border-emerald-100",
          icon: "text-emerald-600 bg-emerald-100",
          text: "text-emerald-900",
        };
      case "viewing":
        return {
          bg: "bg-gradient-to-br from-blue-50 to-indigo-50",
          border: "border-blue-100",
          icon: "text-blue-600 bg-blue-100",
          text: "text-blue-900",
        };
      case "trending":
        return {
          bg: "bg-gradient-to-br from-amber-50 to-orange-50",
          border: "border-amber-100",
          icon: "text-amber-600 bg-amber-100",
          text: "text-amber-900",
        };
      case "wishlist":
        return {
          bg: "bg-gradient-to-br from-pink-50 to-rose-50",
          border: "border-pink-100",
          icon: "text-pink-600 bg-pink-100",
          text: "text-pink-900",
        };
    }
  };

  return (
    <motion.div
      className={`w-full py-6 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4">
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-sm font-medium text-slate-600">
            Live from the campground community
          </span>
        </div>

        {/* Activity cards - horizontal scroll on mobile, grid on desktop */}
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-3 lg:overflow-visible">
          <AnimatePresence mode="popLayout">
            {activities.map((activity, index) => {
              const styles = getStyles(activity.type);

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className={`flex-shrink-0 w-[300px] lg:w-auto rounded-xl p-4 border ${styles.bg} ${styles.border} shadow-sm hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar or Icon */}
                    {activity.type === "booking" && activity.avatarColor ? (
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br ${activity.avatarColor} flex items-center justify-center text-white font-semibold text-sm shadow-sm`}
                      >
                        {activity.initial}
                      </div>
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full ${styles.icon} flex items-center justify-center`}
                      >
                        {getIcon(activity.type)}
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${styles.text} leading-snug`}>
                        {activity.message}
                      </p>
                      {activity.subMessage && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {activity.subMessage}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1.5">Just now</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Hide scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </motion.div>
  );
}
