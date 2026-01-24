"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Home, Search, HelpCircle, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

// Camping tips/facts for the 404 page
const TRAIL_TIPS = [
  "Pack light, travel far. The best adventures await around the bend.",
  "Lost? Follow the river downstream - it usually leads to civilization.",
  "The best campfire stories start with 'Remember when we got lost...'",
  "Every wrong turn is just an unexpected adventure.",
  "In the wild, the only dead end is giving up.",
  "Sometimes the scenic route is the one you didn't plan to take.",
  "A compass points north, but adventure can be found in any direction.",
  "The trail less traveled often has the best views.",
];

// Secret message for spinning compass easter egg
const SECRET_MESSAGE = "You found a secret trail! Use code LOSTTRAIL for 10% off.";

export default function NotFound() {
  const [compassRotation, setCompassRotation] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Get a random tip based on current time (so it's consistent but varied)
  const tip = useMemo(() => {
    const index = Math.floor(Date.now() / 60000) % TRAIL_TIPS.length;
    return TRAIL_TIPS[index];
  }, []);

  // Handle compass click
  const handleCompassClick = useCallback(() => {
    if (prefersReducedMotion) return;

    const newRotation = compassRotation + 360;
    setCompassRotation(newRotation);

    const newSpinCount = spinCount + 1;
    setSpinCount(newSpinCount);

    // After 3 spins, show secret
    if (newSpinCount >= 3 && !showSecret) {
      setShowSecret(true);
    }
  }, [compassRotation, spinCount, showSecret, prefersReducedMotion]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-12 relative overflow-hidden">
      {/* Floating background decorations */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating tent */}
          <motion.div
            className="absolute top-[15%] left-[10%] w-16 h-16 opacity-20"
            animate={{
              y: [0, -15, 0],
              rotate: [0, 5, 0],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/images/icons/lonely-tent.png"
              alt=""
              fill
              className="object-contain"
              sizes="64px"
            />
          </motion.div>

          {/* Floating pine tree */}
          <motion.div
            className="absolute top-[20%] right-[15%] w-14 h-14 opacity-15"
            animate={{
              y: [0, -10, 0],
              rotate: [0, -3, 0],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Image
              src="/images/icons/hero/pine-tree.png"
              alt=""
              fill
              className="object-contain"
              sizes="56px"
            />
          </motion.div>

          {/* Floating mountain */}
          <motion.div
            className="absolute bottom-[25%] right-[8%] w-20 h-20 opacity-10"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Image
              src="/images/icons/hero/mountain.png"
              alt=""
              fill
              className="object-contain"
              sizes="80px"
            />
          </motion.div>

          {/* Floating campfire */}
          <motion.div
            className="absolute bottom-[20%] left-[12%] w-12 h-12 opacity-20"
            animate={{
              y: [0, -12, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <Image
              src="/images/icons/campfire.png"
              alt=""
              fill
              className="object-contain"
              sizes="48px"
            />
          </motion.div>
        </div>
      )}

      <div className="text-center max-w-md relative z-10">
        {/* Interactive Compass */}
        <motion.button
          onClick={handleCompassClick}
          className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center cursor-pointer hover:from-emerald-200 hover:to-teal-200 transition-colors shadow-lg shadow-emerald-500/10 border border-emerald-200/50"
          whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          title="Click to spin the compass"
        >
          <motion.div
            animate={{ rotate: compassRotation }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Compass className="w-12 h-12 text-emerald-600" />
          </motion.div>
        </motion.button>

        {/* 404 Badge */}
        <motion.span
          className="inline-block px-4 py-1.5 mb-4 text-sm font-bold text-emerald-700 bg-emerald-100 rounded-full border border-emerald-200"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          404 - Trail Not Found
        </motion.span>

        {/* Headline */}
        <motion.h1
          className="text-3xl font-bold text-slate-900 mb-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Even our best scouts couldn't find this page
        </motion.h1>

        {/* Description */}
        <motion.p
          className="text-slate-600 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Looks like you've wandered off the marked trail. But that's okay - sometimes the best
          discoveries happen when we get a little lost.
        </motion.p>

        {/* Tip card */}
        <motion.div
          className="bg-white rounded-xl p-4 mb-8 shadow-md border border-slate-100"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 flex-shrink-0 relative">
              <Image
                src="/images/icons/confused-compass.png"
                alt=""
                fill
                className="object-contain"
                sizes="32px"
              />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-emerald-600 mb-1">Trail Tip</p>
              <p className="text-sm text-slate-600">{tip}</p>
            </div>
          </div>
        </motion.div>

        {/* Secret message (after 3 compass spins) */}
        {showSecret && (
          <motion.div
            className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 mb-6 border border-amber-200"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <p className="text-sm font-medium text-amber-800">{SECRET_MESSAGE}</p>
          </motion.div>
        )}

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link href="/">
            <Button size="lg" className="mb-4 w-full sm:w-auto">
              <Home className="w-4 h-4 mr-2" />
              Head Back to Camp
            </Button>
          </Link>
        </motion.div>

        {/* Secondary Links */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-3 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Link
            href="/"
            className="text-slate-600 hover:text-emerald-600 flex items-center gap-1.5 transition-colors"
          >
            <Search className="w-4 h-4" />
            Find a Campground
          </Link>
          <span className="hidden sm:inline text-slate-300">|</span>
          <Link
            href="/help"
            className="text-slate-600 hover:text-emerald-600 flex items-center gap-1.5 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Ask a Ranger
          </Link>
        </motion.div>

        {/* Compass spin hint */}
        {!showSecret && spinCount > 0 && spinCount < 3 && !prefersReducedMotion && (
          <motion.p
            className="mt-6 text-xs text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {3 - spinCount} more spin{3 - spinCount > 1 ? "s" : ""} to find a secret...
          </motion.p>
        )}
      </div>
    </div>
  );
}
