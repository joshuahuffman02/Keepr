"use client";

import { useRef } from "react";
import Image from "next/image";
import { Shield, Heart, Sparkles } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { cn } from "../../lib/utils";
import { useReducedMotionSafe } from "../../hooks/use-reduced-motion-safe";

const pillars = [
  {
    image: "/images/icons/trust-security.png",
    fallbackIcon: Shield,
    title: "Book with Peace of Mind",
    description:
      "Your payment and personal details are protected with the same security used by banks. Focus on the fun, we'll handle the rest.",
    guarantee: "Safe & Secure",
    color: "text-keepr-evergreen",
    bgColor: "bg-keepr-evergreen/10",
  },
  {
    image: "/images/icons/best-price.png",
    fallbackIcon: Sparkles,
    title: "Prices You Can Count On",
    description:
      "What you see is what you pay. No surprise fees at checkout, no hidden costs. Just honest, transparent pricing.",
    guarantee: "No Hidden Fees",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    image: "/images/icons/support.png",
    fallbackIcon: Heart,
    title: "Real People, Real Care",
    description:
      "Questions? Concerns? Our friendly team of camping enthusiasts is here to help you every step of the way.",
    guarantee: "We're Here for You",
    color: "text-rose-500",
    bgColor: "bg-rose-50",
  },
];

interface ValueStackProps {
  className?: string;
}

export function ValueStack({ className }: ValueStackProps) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotionSafe();
  const easeOut: "easeOut" = "easeOut";

  const containerVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion ? undefined : { staggerChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion ? undefined : { duration: 0.5, ease: easeOut },
    },
  };

  return (
    <section
      ref={ref}
      className={cn(
        "py-16 md:py-20 bg-gradient-to-br from-rose-50/40 via-amber-50/30 to-white",
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
            <Heart className="w-4 h-4 fill-amber-500" />
            <span>Family-Trusted Since Day One</span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Why Families Choose Keepr
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto text-lg">
            Creating memories shouldn't come with stress. Here's how we make your camping experience
            easy, safe, and joyful.
          </p>
        </motion.div>

        {/* Pillars grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
        >
          {pillars.map((pillar, i) => {
            const FallbackIcon = pillar.fallbackIcon;
            return (
              <motion.div
                key={i}
                variants={itemVariants}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 transition-all duration-300 hover:-translate-y-1 border border-slate-100"
              >
                {/* Icon */}
                <div
                  className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center mb-6",
                    pillar.bgColor,
                  )}
                >
                  <div className="relative w-8 h-8">
                    <Image
                      src={pillar.image}
                      alt={pillar.title}
                      fill
                      className="object-contain"
                      sizes="32px"
                      onError={(e) => {
                        // Hide image on error, fallback icon will show
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <FallbackIcon
                    className={cn("w-7 h-7 absolute", pillar.color)}
                    style={{ display: "none" }}
                  />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-slate-900 mb-3">{pillar.title}</h3>
                <p className="text-slate-600 mb-5 leading-relaxed">{pillar.description}</p>

                {/* Guarantee badge */}
                <div
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                    pillar.bgColor,
                    pillar.color,
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>{pillar.guarantee}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Trust reinforcement */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-slate-500 text-sm">
            Trusted by thousands of families for their outdoor adventures
          </p>
        </motion.div>
      </div>
    </section>
  );
}
