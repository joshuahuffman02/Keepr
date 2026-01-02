"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  Shield,
  Tent,
  Rocket,
  Sparkles,
  Trophy,
  Star,
  Target,
  Zap,
  Gift,
  PartyPopper,
  Crown,
  Medal,
  Award,
  Heart,
  Users,
  TrendingUp,
  DollarSign,
  Calendar,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { launchConfetti } from "@/lib/gamification/confetti";
import { cn } from "@/lib/utils";

export type AchievementType =
  | "first_booking"
  | "first_payment"
  | "milestone_10"
  | "milestone_50"
  | "milestone_100"
  | "milestone_500"
  | "perfect_week"
  | "revenue_goal"
  | "new_review"
  | "five_star"
  | "full_occupancy"
  | "team_growth"
  | "stripe_connected"
  | "setup_complete"
  | "launch"
  | "welcome"
  | "default";

interface AchievementConfig {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  glowColor: string;
  confetti: boolean;
  particles: number;
  soundEnabled?: boolean;
}

const achievementConfigs: Record<AchievementType, AchievementConfig> = {
  first_booking: {
    icon: Calendar,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    glowColor: "bg-emerald-500/20",
    confetti: true,
    particles: 80,
  },
  first_payment: {
    icon: DollarSign,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    glowColor: "bg-green-500/20",
    confetti: true,
    particles: 100,
  },
  milestone_10: {
    icon: Star,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    glowColor: "bg-amber-500/20",
    confetti: true,
    particles: 60,
  },
  milestone_50: {
    icon: Medal,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    glowColor: "bg-blue-500/20",
    confetti: true,
    particles: 100,
  },
  milestone_100: {
    icon: Trophy,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    glowColor: "bg-amber-500/20",
    confetti: true,
    particles: 140,
  },
  milestone_500: {
    icon: Crown,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
    glowColor: "bg-purple-500/20",
    confetti: true,
    particles: 200,
  },
  perfect_week: {
    icon: Target,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    glowColor: "bg-emerald-500/20",
    confetti: true,
    particles: 100,
  },
  revenue_goal: {
    icon: TrendingUp,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    glowColor: "bg-green-500/20",
    confetti: true,
    particles: 120,
  },
  new_review: {
    icon: Heart,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    glowColor: "bg-pink-500/20",
    confetti: false,
    particles: 0,
  },
  five_star: {
    icon: Star,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    glowColor: "bg-amber-500/20",
    confetti: true,
    particles: 80,
  },
  full_occupancy: {
    icon: MapPin,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    glowColor: "bg-emerald-500/20",
    confetti: true,
    particles: 100,
  },
  team_growth: {
    icon: Users,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    glowColor: "bg-blue-500/20",
    confetti: true,
    particles: 60,
  },
  stripe_connected: {
    icon: Shield,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    glowColor: "bg-emerald-500/20",
    confetti: true,
    particles: 80,
  },
  setup_complete: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    glowColor: "bg-emerald-500/20",
    confetti: true,
    particles: 100,
  },
  launch: {
    icon: Rocket,
    color: "text-violet-400",
    bgColor: "bg-violet-500/20",
    glowColor: "bg-violet-500/20",
    confetti: true,
    particles: 200,
  },
  welcome: {
    icon: PartyPopper,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    glowColor: "bg-amber-500/20",
    confetti: true,
    particles: 140,
  },
  default: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    glowColor: "bg-emerald-500/20",
    confetti: true,
    particles: 80,
  },
};

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 15,
};

interface AchievementCelebrationProps {
  show: boolean;
  type?: AchievementType;
  title: string;
  subtitle?: string;
  badge?: string;
  onComplete?: () => void;
  duration?: number;
  /** Overlay style: full screen or inline toast */
  variant?: "fullscreen" | "toast";
}

/**
 * A reusable celebration component for achievements and milestones.
 * Supports multiple achievement types with unique visuals.
 *
 * @example
 * <AchievementCelebration
 *   show={showCelebration}
 *   type="milestone_100"
 *   title="100 Bookings!"
 *   subtitle="You've reached a major milestone"
 *   onComplete={() => setShowCelebration(false)}
 * />
 */
export function AchievementCelebration({
  show,
  type = "default",
  title,
  subtitle,
  badge,
  onComplete,
  duration = 3000,
  variant = "fullscreen",
}: AchievementCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = achievementConfigs[type];
  const IconComponent = config.icon;

  useEffect(() => {
    if (show && config.confetti && !prefersReducedMotion) {
      launchConfetti({ particles: config.particles, durationMs: 1500 });
    }
  }, [show, config.confetti, config.particles, prefersReducedMotion]);

  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, duration);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete, duration]);

  if (variant === "toast") {
    return (
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={SPRING_CONFIG}
            className="fixed top-4 right-4 z-50 max-w-sm"
          >
            <div className="bg-card dark:bg-muted rounded-xl shadow-2xl border border-border dark:border-border overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <motion.div
                  initial={prefersReducedMotion ? {} : { scale: 0, rotate: -180 }}
                  animate={prefersReducedMotion ? {} : { scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, ...SPRING_CONFIG }}
                  className={cn("p-2 rounded-lg flex-shrink-0", config.bgColor)}
                >
                  <IconComponent className={cn("h-6 w-6", config.color)} />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-foreground dark:text-white truncate">
                      {title}
                    </h4>
                    {badge && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-status-warning/15 text-status-warning rounded-full">
                        {badge}
                      </span>
                    )}
                  </div>
                  {subtitle && (
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>
                {!prefersReducedMotion && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Sparkles className="h-5 w-5 text-amber-400" />
                  </motion.div>
                )}
              </div>
              {/* Progress bar */}
              <motion.div
                className="h-1 bg-status-success"
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: duration / 1000, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Full screen variant
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-muted/95 backdrop-blur-sm"
          onClick={onComplete}
        >
          {/* Content */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0.2 } : SPRING_CONFIG}
            className="text-center relative z-10 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pulsing glow */}
            {!prefersReducedMotion && (
              <motion.div
                className={cn("absolute rounded-full blur-3xl", config.glowColor)}
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 200,
                  height: 200,
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)"
                }}
              />
            )}

            {/* Badge */}
            {badge && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-4"
              >
                <span className="px-3 py-1 text-sm font-semibold bg-status-warning/20 text-status-warning rounded-full">
                  {badge}
                </span>
              </motion.div>
            )}

            {/* Icon container */}
            <motion.div
              initial={prefersReducedMotion ? {} : { scale: 0, rotate: -180 }}
              animate={prefersReducedMotion ? {} : { scale: 1, rotate: 0 }}
              transition={
                prefersReducedMotion
                  ? {}
                  : { delay: 0.1, ...SPRING_CONFIG }
              }
              className="mb-6 relative"
            >
              <div className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center mx-auto",
                config.bgColor
              )}>
                <IconComponent className={cn("h-16 w-16", config.color)} />
              </div>

              {/* Sparkle decorations */}
              {!prefersReducedMotion && (
                <>
                  <motion.div
                    className="absolute -top-2 -right-8"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Sparkles className="h-6 w-6 text-amber-400" />
                  </motion.div>
                  <motion.div
                    className="absolute -bottom-1 -left-6"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Sparkles className="h-5 w-5 text-violet-400" />
                  </motion.div>
                  <motion.div
                    className="absolute top-1/2 -right-10"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Zap className="h-4 w-4 text-amber-300" />
                  </motion.div>
                </>
              )}
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
              className="text-3xl font-bold text-white mb-2"
            >
              {title}
            </motion.h2>

            {/* Subtitle */}
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
                className="text-muted-foreground text-lg max-w-md mx-auto"
              >
                {subtitle}
              </motion.p>
            )}

            {/* Click hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ delay: prefersReducedMotion ? 0 : 1.5 }}
              className="text-muted-foreground text-sm mt-8"
            >
              Click anywhere to continue
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Achievement tracking types
export interface Achievement {
  id: string;
  type: AchievementType;
  title: string;
  description: string;
  unlockedAt?: Date;
  progress?: number;
  target?: number;
}

// Pre-defined achievements for easy use
export const ACHIEVEMENTS = {
  FIRST_BOOKING: {
    type: "first_booking" as const,
    title: "First Booking!",
    subtitle: "Your campground journey has begun",
    badge: "Milestone",
  },
  FIRST_PAYMENT: {
    type: "first_payment" as const,
    title: "First Payment Received!",
    subtitle: "Ka-ching! Your first revenue is in",
    badge: "Revenue",
  },
  TEN_BOOKINGS: {
    type: "milestone_10" as const,
    title: "10 Bookings!",
    subtitle: "You're building momentum",
    badge: "Milestone",
  },
  FIFTY_BOOKINGS: {
    type: "milestone_50" as const,
    title: "50 Bookings!",
    subtitle: "Half a century of happy campers",
    badge: "Major Milestone",
  },
  HUNDRED_BOOKINGS: {
    type: "milestone_100" as const,
    title: "100 Bookings!",
    subtitle: "Welcome to the century club",
    badge: "Elite",
  },
  FIVE_HUNDRED_BOOKINGS: {
    type: "milestone_500" as const,
    title: "500 Bookings!",
    subtitle: "You're a camping legend",
    badge: "Legend",
  },
  FIVE_STAR_REVIEW: {
    type: "five_star" as const,
    title: "5-Star Review!",
    subtitle: "A guest loved their stay",
    badge: "Excellence",
  },
  FULL_OCCUPANCY: {
    type: "full_occupancy" as const,
    title: "Full House!",
    subtitle: "Every site is booked",
    badge: "Achievement",
  },
  STRIPE_CONNECTED: {
    type: "stripe_connected" as const,
    title: "Payments Ready!",
    subtitle: "Stripe is connected and ready to go",
    badge: "Setup",
  },
  LAUNCH_READY: {
    type: "launch" as const,
    title: "Ready for Launch!",
    subtitle: "Your campground is live and accepting bookings",
    badge: "Launch",
  },
};
