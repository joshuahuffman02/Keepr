'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart,
  Grid3x3,
  Smartphone,
  CreditCard,
  Calendar,
  MessageSquare,
  Check,
} from 'lucide-react';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

const popularFeatures = [
  {
    id: 'pos',
    name: 'Point-of-Sale System',
    icon: ShoppingCart,
    description: 'Integrated POS for camp store, rentals, and add-ons.',
    benefits: [
      'Inventory management',
      'Multiple payment methods',
      'Real-time sync with reservations',
      'Staff permissions & reporting',
    ],
    image: '/images/owners/pos.png',
  },
  {
    id: 'grid',
    name: 'Grid Optimization',
    icon: Grid3x3,
    description: 'Visual site management with drag-and-drop assignments.',
    benefits: [
      'Interactive site map',
      'Drag-and-drop assignments',
      'Real-time availability',
      'Site type grouping',
    ],
    image: '/images/owners/grid.png',
  },
  {
    id: 'mobile',
    name: 'Mobile Check-In',
    icon: Smartphone,
    description: 'Contactless check-in and guest self-service portal.',
    benefits: [
      'QR code check-in',
      'Digital waivers',
      'Mobile payments',
      'Guest messaging',
    ],
    image: '/images/owners/mobile-checkin.png',
  },
  {
    id: 'payments',
    name: 'Payment Processing',
    icon: CreditCard,
    description: 'Secure payment processing with multiple gateways.',
    benefits: [
      'Stripe & Square integration',
      'Split payments',
      'Refund management',
      'PCI compliance',
    ],
    image: '/images/owners/payments.png',
  },
  {
    id: 'booking',
    name: 'Online Booking Engine',
    icon: Calendar,
    description: 'Beautiful booking experience for your guests.',
    benefits: [
      'Real-time availability',
      'Dynamic pricing',
      'Add-on selection',
      'Instant confirmation',
    ],
    image: '/images/owners/booking.png',
  },
  {
    id: 'messaging',
    name: 'Guest Messaging',
    icon: MessageSquare,
    description: 'Automated and manual guest communication.',
    benefits: [
      'Booking confirmations',
      'Pre-arrival messages',
      'SMS & email',
      'Custom templates',
    ],
    image: '/images/owners/messaging.png',
  },
];

export function PopularFeatures() {
  const [activeFeature, setActiveFeature] = useState(popularFeatures[0]);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotionSafe();
  const panelId = "popular-feature-panel";

  const handleSelect = (feature: typeof popularFeatures[number]) => {
    setActiveFeature(feature);
    if (typeof window !== "undefined" && window.innerWidth < 1024 && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="py-20 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <p className="text-sm font-medium text-keepr-evergreen uppercase tracking-wider mb-3">
            Popular Features
          </p>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            The tools campground owners love most
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover the features that make daily operations smoother and guests happier.
          </p>
        </motion.div>

        {/* Feature Showcase */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Feature Tabs */}
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-3"
            role="tablist"
            aria-orientation="vertical"
          >
            {popularFeatures.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeFeature.id === feature.id;

              return (
                <button
                  key={feature.id}
                  id={`feature-tab-${feature.id}`}
                  type="button"
                  onClick={() => handleSelect(feature)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={panelId}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-keepr-evergreen focus-visible:ring-offset-2 focus-visible:ring-offset-white ${isActive
                    ? 'border-keepr-evergreen bg-white shadow-lg'
                    : 'border-border bg-white hover:border-keepr-evergreen/30 hover:shadow-md'
                    }`}
                >
                  {/* Active indicator bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 bg-keepr-evergreen transition-opacity duration-300 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  <div className="flex items-center gap-4">
                    <div
                      className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        isActive
                          ? 'bg-keepr-evergreen shadow-md'
                          : 'bg-slate-100'
                        }`}
                    >
                      <Icon className={`h-5 w-5 transition-colors duration-300 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-base font-semibold transition-colors duration-300 ${
                          isActive ? 'text-keepr-evergreen' : 'text-foreground'
                          }`}
                      >
                        {feature.name}
                      </h3>
                      <p className={`text-sm transition-colors duration-300 ${isActive ? 'text-keepr-evergreen/70' : 'text-muted-foreground'}`}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>

          {/* Right: Feature Details with Animation */}
          <motion.div
            ref={detailRef}
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:sticky lg:top-24"
            role="tabpanel"
            id={panelId}
            aria-labelledby={`feature-tab-${activeFeature.id}`}
            tabIndex={0}
          >
            {/* Browser Chrome Frame */}
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Browser Header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border-b border-slate-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-keepr-clay" />
                  <div className="w-3 h-3 rounded-full bg-keepr-evergreen" />
                  <div className="w-3 h-3 rounded-full bg-keepr-charcoal-light" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-white rounded-md px-3 py-1.5 text-xs text-slate-400 text-center border border-slate-200">
                    app.keeprstay.com/dashboard
                  </div>
                </div>
              </div>

              {/* Feature Image with Crossfade */}
              <div className="aspect-[16/10] relative bg-slate-100">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeFeature.id}
                    initial={prefersReducedMotion ? {} : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={prefersReducedMotion ? {} : { opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <Image
                      src={activeFeature.image}
                      alt={`${activeFeature.name} Preview`}
                      fill
                      className="object-cover"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Feature Content with Animation */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeature.id}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="p-8"
                >
                  <h3 className="text-2xl font-bold text-foreground mb-3">
                    {activeFeature.name}
                  </h3>
                  <p className="text-muted-foreground mb-6">{activeFeature.description}</p>

                  {/* Benefits List */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                      Key Benefits
                    </h4>
                    <ul className="grid grid-cols-2 gap-3">
                      {activeFeature.benefits.map((benefit, index) => (
                        <motion.li
                          key={benefit}
                          initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-2"
                        >
                          <div className="h-5 w-5 rounded-full bg-keepr-evergreen/10 flex items-center justify-center flex-shrink-0">
                            <Check className="h-3 w-3 text-keepr-evergreen" />
                          </div>
                          <span className="text-sm text-foreground">{benefit}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
