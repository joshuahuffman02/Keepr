"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2, Shield, Tent, Rocket, Sparkles } from "lucide-react";

interface SetupCelebrationProps {
  show: boolean;
  title: string;
  subtitle?: string;
  type?: "stripe" | "sites" | "launch" | "default";
  onComplete?: () => void;
  duration?: number;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 200,
  damping: 15,
};

// Simple confetti particle
function ConfettiParticle({ delay, color }: { delay: number; color: string }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return null;

  const randomX = Math.random() * 200 - 100;
  const randomRotation = Math.random() * 360;

  return (
    <motion.div
      className="absolute w-3 h-3 rounded-sm"
      style={{
        backgroundColor: color,
        left: "50%",
        top: "40%",
      }}
      initial={{ opacity: 0, y: 0, x: 0, rotate: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: [0, -100, 200],
        x: [0, randomX],
        rotate: [0, randomRotation],
        scale: [0, 1, 0.5],
      }}
      transition={{
        duration: 2,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    />
  );
}

export function SetupCelebration({
  show,
  title,
  subtitle,
  type = "default",
  onComplete,
  duration = 2000,
}: SetupCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();
  const [confettiColors] = useState([
    "#10b981", // emerald
    "#14b8a6", // teal
    "#f59e0b", // amber
    "#a855f7", // violet
    "#3b82f6", // blue
  ]);

  useEffect(() => {
    if (show && onComplete) {
      const timer = setTimeout(onComplete, duration);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete, duration]);

  const getIcon = () => {
    switch (type) {
      case "stripe":
        return <Shield className="h-16 w-16 text-emerald-400" />;
      case "sites":
        return <Tent className="h-16 w-16 text-emerald-400" />;
      case "launch":
        return <Rocket className="h-16 w-16 text-emerald-400" />;
      default:
        return <CheckCircle2 className="h-16 w-16 text-emerald-400" />;
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-sm"
        >
          {/* Confetti particles */}
          {!prefersReducedMotion && type === "launch" && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 50 }).map((_, i) => (
                <ConfettiParticle
                  key={i}
                  delay={i * 0.02}
                  color={confettiColors[i % confettiColors.length]}
                />
              ))}
            </div>
          )}

          {/* Content */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0.2 } : SPRING_CONFIG}
            className="text-center relative z-10"
          >
            {/* Pulsing glow */}
            {!prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl"
                animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{
                  width: 200,
                  height: 200,
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            )}

            {/* Icon container */}
            <motion.div
              initial={prefersReducedMotion ? {} : { scale: 0, rotate: -180 }}
              animate={prefersReducedMotion ? {} : { scale: 1, rotate: 0 }}
              transition={
                prefersReducedMotion
                  ? {}
                  : { delay: 0.1, type: "spring", stiffness: 200, damping: 15 }
              }
              className="mb-6 relative"
            >
              <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                {getIcon()}
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
                className="text-slate-300 text-lg"
              >
                {subtitle}
              </motion.p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
