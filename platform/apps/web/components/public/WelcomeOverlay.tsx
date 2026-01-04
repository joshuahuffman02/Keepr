"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Image from "next/image";

const STORAGE_KEY = "campreserv:welcomed";

export function WelcomeOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user has been welcomed before
    const hasBeenWelcomed = localStorage.getItem(STORAGE_KEY);

    if (!hasBeenWelcomed) {
      // Show overlay after a brief delay for page to settle
      const showTimer = setTimeout(() => {
        setShouldRender(true);
        setIsVisible(true);
      }, 500);

      return () => clearTimeout(showTimer);
    }
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      // Mark as welcomed
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "true");
      }
    }, 4000);

    return () => clearTimeout(dismissTimer);
  }, [isVisible]);

  // Handle click to dismiss early
  const handleDismiss = () => {
    setIsVisible(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "true");
    }
  };

  if (!shouldRender || prefersReducedMotion) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-b from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-sm cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={handleDismiss}
        >
          <motion.div
            className="text-center px-8 max-w-lg"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Animated campfire illustration */}
            <motion.div
              className="relative w-32 h-32 mx-auto mb-8"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/images/icons/hero/campfire.png"
                alt="Welcome campfire"
                fill
                className="object-contain drop-shadow-2xl"
                sizes="128px"
                priority
              />
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 bg-orange-500/30 rounded-full blur-2xl -z-10"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>

            {/* Welcome text */}
            <motion.h1
              className="text-3xl md:text-4xl font-bold text-white mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Welcome to{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Keepr
              </span>
            </motion.h1>

            <motion.p
              className="text-lg md:text-xl text-white/80 mb-8 font-light"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Every adventure starts with a single step.
            </motion.p>

            {/* Decorative stars */}
            <motion.div
              className="flex justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[...Array(5)].map((_, i) => (
                <motion.span
                  key={i}
                  className="text-amber-400 text-lg"
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    scale: [0.9, 1.1, 0.9],
                  }}
                  transition={{
                    duration: 1.5,
                    delay: i * 0.2,
                    repeat: Infinity,
                  }}
                >
                  *
                </motion.span>
              ))}
            </motion.div>

            {/* Skip hint */}
            <motion.p
              className="text-xs text-white/40 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              Tap anywhere to begin exploring
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
