"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// Honest, accurate messages - no fake numbers
const MESSAGES = [
  { highlight: "Thousands of happy campers", rest: "have found their perfect spot" },
  { highlight: "From coast to coast", rest: "families are making memories" },
  { highlight: "New campgrounds", rest: "added every week" },
  { highlight: "Book instantly", rest: "at hundreds of campgrounds nationwide" },
  { highlight: "Plan your next adventure", rest: "with real-time availability" },
];

interface InlineActivityFeedProps {
  className?: string;
}

export function InlineActivityFeed({ className }: InlineActivityFeedProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Show after a short delay
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 2000);

    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Rotate through messages
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (prefersReducedMotion || !isVisible) {
    return null;
  }

  const message = MESSAGES[currentIndex];

  return (
    <motion.div
      className={`w-full py-4 bg-gradient-to-r from-slate-50 via-white to-slate-50 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-center gap-3">
          {/* Pulsing dot */}
          <motion.div
            className="w-2 h-2 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Message text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={currentIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-sm text-slate-600"
            >
              <span className="font-semibold text-slate-800">{message.highlight}</span>
              {" "}{message.rest}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
