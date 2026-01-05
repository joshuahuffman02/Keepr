'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  TrendingUp,
  Settings,
  Users,
  Brain,
  Sparkles,
  Calendar
} from 'lucide-react';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

const features = [
  {
    name: 'AI-Powered Intelligence',
    description: 'Predict demand, optimize pricing, and reduce no-shows with built-in AI.',
    icon: Brain,
    color: 'blue',
    features: [
      'AI demand forecasting',
      'AI pricing recommendations',
      'AI no-show detection',
      'Anomaly detection alerts',
    ],
  },
  {
    name: 'Loyalty & Gamification',
    description: 'Turn one-time guests into lifetime campers with XP, levels, and rewards.',
    icon: Sparkles,
    color: 'purple',
    features: [
      'XP system & leveling',
      'Rewards marketplace',
      'Achievement badges',
      'Referral programs',
    ],
  },
  {
    name: 'Staff Scheduling & Payroll',
    description: 'Schedule staff based on occupancy with integrated time tracking and payroll.',
    icon: Calendar,
    color: 'emerald',
    features: [
      'Shift scheduling',
      'Time clock & tracking',
      'Payroll integration',
      'Occupancy-based staffing',
    ],
  },
  {
    name: 'Reservations & Revenue',
    description: 'Maximize bookings with dynamic pricing and intelligent revenue management.',
    icon: TrendingUp,
    color: 'teal',
    features: [
      'Drag-and-drop calendar',
      'Dynamic pricing rules',
      'Group bookings',
      'Waitlist management',
    ],
  },
  {
    name: 'Guest Experience',
    description: 'Delight guests with seamless booking, check-in, and communication.',
    icon: Users,
    color: 'pink',
    features: [
      'Online booking engine',
      'Self-service portal',
      '2-way SMS messaging',
      'Push notifications',
    ],
  },
  {
    name: 'Operations & Integrations',
    description: 'Run your entire park from one place. Connect to your favorite tools.',
    icon: Settings,
    color: 'amber',
    features: [
      'Housekeeping management',
      'Maintenance tickets',
      'POS & camp store',
      'Accounting integrations',
    ],
  },
];

const colorClasses = {
  emerald: {
    bg: 'bg-keepr-evergreen/10',
    icon: 'text-keepr-evergreen',
    hover: 'hover:border-keepr-evergreen/30',
  },
  blue: {
    bg: 'bg-keepr-evergreen/10',
    icon: 'text-keepr-evergreen',
    hover: 'hover:border-keepr-evergreen/30',
  },
  purple: {
    bg: 'bg-keepr-evergreen/10',
    icon: 'text-keepr-evergreen',
    hover: 'hover:border-keepr-evergreen/30',
  },
  pink: {
    bg: 'bg-keepr-evergreen/10',
    icon: 'text-keepr-evergreen',
    hover: 'hover:border-keepr-evergreen/30',
  },
  amber: {
    bg: 'bg-keepr-clay/10',
    icon: 'text-keepr-clay',
    hover: 'hover:border-keepr-clay/30',
  },
  teal: {
    bg: 'bg-keepr-evergreen/10',
    icon: 'text-keepr-evergreen',
    hover: 'hover:border-keepr-evergreen/30',
  },
};

export function FeaturePillars() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotionSafe();

  const containerVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: prefersReducedMotion ? {} : { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion ? undefined : { duration: 0.5, ease: 'easeOut' as const },
    },
  };

  return (
    <section ref={ref} id="features" className="py-24 bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-base font-semibold text-keepr-evergreen tracking-wide uppercase mb-3">
            Complete Platform
          </h2>
          <p className="text-4xl font-bold text-foreground mb-4">
            Everything you need to run your campground
          </p>
          <p className="text-xl text-muted-foreground">
            From AI-powered insights to guest loyalty programs, we've built the
            all-in-one platform for modern campground operations.
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature) => {
            const Icon = feature.icon;
            const colors = colorClasses[feature.color as keyof typeof colorClasses];

            return (
              <motion.div
                key={feature.name}
                variants={itemVariants}
                className={`group relative bg-card rounded-2xl border-2 border-border p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${colors.hover}`}
              >
                {/* Icon */}
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} mb-6 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className={`h-7 w-7 ${colors.icon}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {feature.name}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {feature.description}
                </p>

                {/* Feature List */}
                <ul className="space-y-2">
                  {feature.features.map((item) => (
                    <li key={item} className="flex items-center text-sm text-muted-foreground">
                      <svg
                        className="h-5 w-5 text-keepr-clay mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Hover Effect */}
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-keepr-evergreen/10 to-keepr-clay/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
