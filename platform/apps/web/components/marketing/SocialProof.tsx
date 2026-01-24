"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Heart, Shield, Users, Zap } from "lucide-react";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

// Authentic value props - no fake metrics, just genuine statements
const valueProps = [
  {
    icon: Heart,
    title: "Built by Campground Owners",
    description: "We run parks ourselves. We know your pain.",
  },
  {
    icon: Shield,
    title: "No Contracts",
    description: "Month-to-month. Cancel anytime. 30-day guarantee.",
  },
  {
    icon: Users,
    title: "Human Support",
    description: "Real people who understand campgrounds.",
  },
  {
    icon: Zap,
    title: "Go Live Today",
    description: "Same-day setup. Free data migration.",
  },
];
const EASE_OUT: "easeOut" = "easeOut";

function ValuePropCard({ prop, index }: { prop: (typeof valueProps)[0]; index: number }) {
  const prefersReducedMotion = useReducedMotionSafe();
  const Icon = prop.icon;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={
        prefersReducedMotion ? undefined : { duration: 0.4, delay: index * 0.1, ease: EASE_OUT }
      }
      className="flex items-start gap-4 group"
    >
      {/* Icon */}
      <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-keepr-evergreen/10 flex items-center justify-center transition-all duration-300 group-hover:bg-keepr-evergreen/20 group-hover:scale-105">
        <Icon className="h-6 w-6 text-keepr-evergreen" />
      </div>

      {/* Content */}
      <div>
        <h3 className="text-base font-semibold text-foreground mb-0.5">{prop.title}</h3>
        <p className="text-sm text-muted-foreground">{prop.description}</p>
      </div>
    </motion.div>
  );
}

export function SocialProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-50px" });
  const prefersReducedMotion = useReducedMotionSafe();

  return (
    <section ref={sectionRef} className="py-16 bg-slate-50 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center mb-10"
        >
          <p className="text-sm font-medium text-keepr-evergreen uppercase tracking-wider">
            Why Campground Owners Choose Us
          </p>
        </motion.div>

        {/* Value Props Grid - 2x2 on mobile, 4 across on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {valueProps.map((prop, index) => (
            <ValuePropCard key={prop.title} prop={prop} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
