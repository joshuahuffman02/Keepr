'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingDown, Clock, Star, Headphones } from 'lucide-react';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

// Outcome-focused stats that speak to campground owner pain points
const stats = [
  {
    icon: TrendingDown,
    value: 30,
    suffix: '%',
    label: 'Fewer No-Shows',
    description: 'With automated reminders',
    color: 'text-keepr-evergreen',
    iconBg: 'bg-keepr-evergreen/15',
  },
  {
    icon: Clock,
    value: 2,
    suffix: ' hrs',
    label: 'Saved Daily',
    description: 'On admin tasks',
    color: 'text-keepr-clay',
    iconBg: 'bg-keepr-clay/15',
  },
  {
    icon: Star,
    value: 4.9,
    suffix: '/5',
    label: 'Owner Rating',
    description: 'From beta testers',
    color: 'text-amber-500',
    iconBg: 'bg-amber-500/15',
  },
  {
    icon: Headphones,
    value: 24,
    suffix: '/7',
    label: 'Expert Support',
    description: 'Real humans, always',
    color: 'text-violet-500',
    iconBg: 'bg-violet-500/15',
  },
];

// Animated counter hook
function useAnimatedCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const prefersReducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (!startOnView || !isInView) return;
    if (prefersReducedMotion) {
      setCount(end);
      return;
    }

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(end * easeOut);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, isInView, startOnView, prefersReducedMotion]);

  return { count, ref };
}

function StatCard({ stat, index }: { stat: typeof stats[0]; index: number }) {
  const prefersReducedMotion = useReducedMotionSafe();
  const { count, ref } = useAnimatedCounter(stat.value, 2000);
  const Icon = stat.icon;

  // Format the count based on suffix
  const formattedCount = stat.suffix === '/5' || stat.suffix === ' hrs'
    ? count.toFixed(1)
    : Math.round(count);

  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={prefersReducedMotion ? undefined : { duration: 0.5, delay: index * 0.1, ease: 'easeOut' as const }}
      className="text-center group"
    >
      {/* Icon */}
      <div className="flex justify-center mb-4">
        <div className={`h-14 w-14 rounded-2xl ${stat.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          <Icon className={`h-7 w-7 ${stat.color}`} />
        </div>
      </div>

      {/* Value with animated counter */}
      <div className="flex items-baseline justify-center gap-0.5 mb-2">
        <span className={`text-4xl md:text-5xl font-bold ${stat.color}`}>
          {formattedCount}
        </span>
        <span className={`text-2xl md:text-3xl font-bold ${stat.color}`}>
          {stat.suffix}
        </span>
      </div>

      {/* Label */}
      <div className="text-lg font-semibold text-foreground mb-1">
        {stat.label}
      </div>

      {/* Description */}
      <div className="text-sm text-muted-foreground">
        {stat.description}
      </div>
    </motion.div>
  );
}

export function SocialProof() {
  const prefersReducedMotion = useReducedMotionSafe();

  return (
    <section className="py-16 bg-gradient-to-br from-amber-50/40 via-white to-emerald-50/30 border-y border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Optional header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            What Campground Owners Can Expect
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
