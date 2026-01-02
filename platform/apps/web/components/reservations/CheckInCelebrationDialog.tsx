"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tent,
  Sparkles,
  MapPin,
  Calendar,
  User,
  PartyPopper,
} from "lucide-react";
import { useAchievement } from "@/hooks/use-achievement";
import { AchievementCelebration } from "@/components/ui/achievement-celebration";
import { haptic } from "@/hooks/use-haptic";

const SPRING_CONFIG = { type: "spring" as const, stiffness: 200, damping: 15 };

interface CheckInCelebrationDialogProps {
  open: boolean;
  onClose: () => void;
  guestName: string;
  siteName: string;
  arrivalDate: string;
  departureDate: string;
}

export function CheckInCelebrationDialog({
  open,
  onClose,
  guestName,
  siteName,
  arrivalDate,
  departureDate,
}: CheckInCelebrationDialogProps) {
  const prefersReducedMotion = useReducedMotion();
  const achievement = useAchievement();

  // Trigger haptic and achievement on dialog open
  useEffect(() => {
    if (open) {
      haptic.success();

      // Check for first check-in achievement
      const firstCheckInKey = "first_check_in_completed";
      if (!achievement.isUnlocked(firstCheckInKey)) {
        achievement.unlockOnce(firstCheckInKey, {
          type: "first_booking",
          title: "First Check-In!",
          subtitle: "You've welcomed your first guest",
        });
      }
    }
  }, [open]);

  return (
    <>
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

      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Guest Checked In</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center py-6 space-y-5">
          {/* Celebration Icon with Animation */}
          <motion.div
            className="relative"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.5, y: 20 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={SPRING_CONFIG}
          >
            {/* Decorative sparkles and party elements */}
            {!prefersReducedMotion && (
              <>
                <motion.div
                  className="absolute -top-3 -right-3"
                  initial={{ opacity: 0, scale: 0, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, ...SPRING_CONFIG }}
                >
                  <PartyPopper className="h-6 w-6 text-status-warning" />
                </motion.div>
                <motion.div
                  className="absolute -top-1 -left-4"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, ...SPRING_CONFIG }}
                >
                  <Sparkles className="h-5 w-5 text-status-success" />
                </motion.div>
                <motion.div
                  className="absolute -bottom-2 -right-2"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, ...SPRING_CONFIG }}
                >
                  <Sparkles className="h-4 w-4 text-status-info" />
                </motion.div>
              </>
            )}
            {/* Main icon */}
            <motion.div
              className="h-20 w-20 rounded-full bg-status-success flex items-center justify-center shadow-lg"
              initial={
                prefersReducedMotion
                  ? {}
                  : { boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.4)" }
              }
              animate={
                prefersReducedMotion
                  ? {}
                  : { boxShadow: "0 0 0 20px rgba(16, 185, 129, 0)" }
              }
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Tent className="h-10 w-10 text-white" strokeWidth={2} />
            </motion.div>
          </motion.div>

          {/* Welcome Title */}
          <motion.div
            className="text-center"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
            }
            transition={{ delay: 0.2, ...SPRING_CONFIG }}
          >
            <h2 className="text-2xl font-bold text-foreground">
              Welcome to Camp!
            </h2>
            <p className="mt-1 text-muted-foreground">Guest has been checked in</p>
          </motion.div>

          {/* Guest Details */}
          <motion.div
            className="w-full space-y-3"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
            }
            transition={{ delay: 0.3, ...SPRING_CONFIG }}
          >
            <div className="rounded-xl border border-status-success/30 bg-status-success/10 p-4 space-y-3">
              {/* Guest Name */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-status-success/15 flex items-center justify-center">
                  <User className="h-5 w-5 text-status-success" />
                </div>
                <div>
                  <div className="text-xs text-status-success font-medium">
                    Guest
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {guestName}
                  </div>
                </div>
              </div>

              {/* Site */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-status-success/15 flex items-center justify-center">
                  <MapPin className="h-5 w-5 text-status-success" />
                </div>
                <div>
                  <div className="text-xs text-status-success font-medium">
                    Assigned Site
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {siteName}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-status-success/15 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-status-success" />
                </div>
                <div>
                  <div className="text-xs text-status-success font-medium">
                    Stay Dates
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    {arrivalDate} - {departureDate}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Done Button */}
          <motion.div
            className="w-full"
            initial={
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }
            }
            animate={
              prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
            }
            transition={{ delay: 0.4, ...SPRING_CONFIG }}
          >
            <Button
              onClick={onClose}
              className="w-full"
            >
              Done
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
