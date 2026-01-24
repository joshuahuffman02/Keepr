"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface CelebrationOverlayProps {
  show: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function CelebrationOverlay({ show, title, subtitle, icon }: CelebrationOverlayProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-muted/90 backdrop-blur-sm"
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={
          prefersReducedMotion ? { duration: 0.2 } : { type: "spring", stiffness: 200, damping: 15 }
        }
        className="text-center"
      >
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0, rotate: -180 }}
          animate={prefersReducedMotion ? {} : { scale: 1, rotate: 0 }}
          transition={
            prefersReducedMotion ? {} : { delay: 0.1, type: "spring", stiffness: 200, damping: 15 }
          }
          className="mb-6"
        >
          {icon || <CheckCircle2 className="h-20 w-20 text-emerald-400 mx-auto" />}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
          className="text-3xl font-bold text-white mb-2"
        >
          {title}
        </motion.h2>

        {subtitle && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.3 }}
            className="text-muted-foreground"
          >
            {subtitle}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
