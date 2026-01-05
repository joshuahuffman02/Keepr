'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Rocket, Users, MessageSquare, Lightbulb } from 'lucide-react';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

const earlyAccessBenefits = [
  {
    id: 1,
    icon: Rocket,
    title: 'Shape the Product',
    description:
      'As an early adopter, you get direct input on features we build. Your feedback shapes the roadmap.',
  },
  {
    id: 2,
    icon: Users,
    title: 'Founding Community',
    description:
      'Join a small group of forward-thinking campground owners. Network, share ideas, and grow together.',
  },
  {
    id: 3,
    icon: MessageSquare,
    title: 'Direct Access',
    description:
      'Skip the support queue. Early access members get direct communication with our team.',
  },
  {
    id: 4,
    icon: Lightbulb,
    title: 'Locked-In Pricing',
    description:
      'Early access pricing is locked forever. As we grow and add features, your rate stays the same.',
  },
];

export function Testimonials() {
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
    <section ref={ref} className="py-20 bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <p className="text-sm font-medium text-keepr-evergreen uppercase tracking-wider mb-3">
            Early Access
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Be part of something new
          </h2>
          <p className="text-lg text-muted-foreground">
            We're building Keepr with campground owners, not just for them.
            Early adopters get unique benefits you won't find anywhere else.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {earlyAccessBenefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={benefit.id}
                variants={itemVariants}
                className="group bg-card rounded-2xl border border-border p-6 hover:border-keepr-evergreen/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                {/* Icon */}
                <div className="h-12 w-12 rounded-xl bg-keepr-evergreen/10 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6 text-keepr-evergreen" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-foreground mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground text-sm">{benefit.description}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Limited spots available in each early access tier
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center text-keepr-evergreen hover:text-keepr-evergreen/80 font-semibold transition-colors"
          >
            View early access pricing
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
