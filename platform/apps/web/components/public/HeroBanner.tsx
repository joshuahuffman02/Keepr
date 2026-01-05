"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, Star } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

interface HeroBannerProps {
  onSearch: (query: string, filters: {
    location: string;
    dates: { checkIn: string; checkOut: string };
    guests: number;
  } | null) => void;
}

/**
 * HeroBanner - Refined Design
 *
 * Design principles:
 * - Full-bleed campground photo with gradient overlay
 * - Clean, spacious layout with elevated typography
 * - Trust signals prominently displayed
 * - Floating featured campground preview on XL screens
 * - Smooth transition to white content below
 */
export function HeroBanner({ onSearch }: HeroBannerProps) {
  const prefersReducedMotion = useReducedMotionSafe();

  // Animation variants - disabled if user prefers reduced motion
  const fadeUp = prefersReducedMotion
    ? { initial: {}, animate: {} }
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
      };

  const fadeUpDelayed = (delay: number) =>
    prefersReducedMotion
      ? { initial: {}, animate: {}, transition: {} }
      : {
          initial: { opacity: 0, y: 30 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay },
        };

  const fadeInRight = prefersReducedMotion
    ? { initial: {}, animate: {}, transition: {} }
    : {
        initial: { opacity: 0, x: 50 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.7, delay: 0.6 },
      };

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=2000&h=1200&fit=crop"
          alt="Peaceful campground at sunset"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        {/* Refined overlay - softer gradient for warmth */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/60 to-slate-900/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/30" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 w-full">
        <div className="max-w-3xl">
          {/* Trust Badge */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5 }}
            className="mb-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
              <Shield className="w-4 h-4 text-keepr-evergreen" />
              <span className="text-sm text-white/90 font-medium">
                Trusted by 50,000+ happy campers
              </span>
              <div className="flex items-center gap-0.5 ml-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main Headline - Elevated typography */}
          <motion.h1
            {...fadeUpDelayed(0.1)}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white tracking-tight leading-[0.95] mb-6"
          >
            Find your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-keepr-evergreen to-teal-400">
              perfect escape
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            {...fadeUpDelayed(0.2)}
            className="text-xl md:text-2xl text-white/80 mb-10 max-w-xl leading-relaxed"
          >
            Discover verified campgrounds with transparent pricing. Book
            directly, no surprises.
          </motion.p>

          {/* Search Box - Uses existing SearchBar component */}
          <motion.div {...fadeUpDelayed(0.3)}>
            <SearchBar onSearch={onSearch} />
          </motion.div>

          {/* Trust Signals Row */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-10 flex flex-wrap items-center gap-6"
          >
            {[
              { icon: CheckCircle2, text: "Verified reviews" },
              { icon: Shield, text: "Secure booking" },
              { icon: Star, text: "Best price guarantee" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-white/70">
                <item.icon className="w-4 h-4 text-keepr-evergreen" />
                <span className="text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Floating Card - Featured Campground Preview (XL screens only) */}
      <motion.div
        {...fadeInRight}
        className="hidden xl:block absolute right-16 top-1/2 -translate-y-1/2"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20 shadow-2xl">
          <div className="relative w-64 h-40 rounded-xl overflow-hidden mb-3">
            <Image
              src="https://images.unsplash.com/photo-1533873984035-25970ab07461?w=600&h=400&fit=crop"
              alt="Featured campground"
              fill
              className="object-cover"
              sizes="256px"
            />
            <div className="absolute top-2 left-2 px-2 py-1 bg-keepr-evergreen text-white text-xs font-bold rounded-full">
              Top Rated
            </div>
          </div>
          <h3 className="text-white font-semibold mb-1">
            Ponderosa Pines Resort
          </h3>
          <p className="text-white/60 text-sm mb-2">Flagstaff, Arizona</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white font-medium">4.9</span>
              <span className="text-white/50 text-sm">(847)</span>
            </div>
            <Link
              href="/park/ponderosa-pines"
              className="text-keepr-evergreen text-sm font-medium hover:underline"
            >
              View →
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Bottom gradient for smooth transition to white content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
