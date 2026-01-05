'use client';

import { Check, X, ArrowRight, Star, Clock, Users, Zap, Crown, Rocket, Gift, Shield, Wrench, Database, Headphones, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

// Early Access Tiers - Waterfall: first fills, then next opens
const earlyAccessTiers = [
  {
    name: "Founder's Circle",
    spots: 5,
    spotsRemaining: 5, // Update this as spots fill
    icon: Crown,
    monthlyPrice: 0,
    monthlyDuration: "forever",
    bookingFee: 0.75,
    highlight: "Best Deal",
    color: "amber",
    benefits: [
      "$0/month forever (not a typo)",
      "$0.75 per booking (locked forever)",
      "Lifetime 'Founder' badge on your listing",
      "Direct line to founders (phone/text)",
      "Co-create features with us",
      "Your logo on our website",
      "First access to every new feature",
    ],
    cta: "Claim Founder Spot",
    urgency: "Only 5 spots",
  },
  {
    name: "Pioneer",
    spots: 15,
    spotsRemaining: 15,
    icon: Rocket,
    monthlyPrice: 0,
    monthlyDuration: "for 12 months",
    bookingFee: 1.00,
    highlight: "Most Popular",
    color: "emerald",
    benefits: [
      "$0/month for first 12 months",
      "$1.00 per booking (locked forever)",
      "Then just $29/month",
      "Priority support forever",
      "Early access to new features",
      "Quarterly strategy calls",
      "Free data migration",
    ],
    cta: "Become a Pioneer",
    urgency: "15 spots available",
  },
  {
    name: "Trailblazer",
    spots: 25,
    spotsRemaining: 25,
    icon: Star,
    monthlyPrice: 14.50,
    monthlyDuration: "for 6 months",
    bookingFee: 1.25,
    highlight: "Great Value",
    color: "violet",
    benefits: [
      "50% off for first 6 months ($14.50/mo)",
      "$1.25 per booking (locked forever)",
      "Then $29/month",
      "Early access to new features",
      "Priority email support",
      "Free data migration",
      "Onboarding call included",
    ],
    cta: "Join Trailblazers",
    urgency: "25 spots available",
  },
];

// Competitor comparison data
const competitors = [
  {
    name: "Keepr",
    isUs: true,
    monthlyBase: "$100",
    perBooking: "$2.30",
    marketplaceCommission: "0%",
    setupFee: "DIY Free",
    paymentProcessing: "2.9% + $0.30",
    freeTrialDays: "30-day guarantee",
    support: "Email",
    aiIncluded: "$5/mo",
    features: {
      onlineBooking: true,
      dynamicPricing: true,
      guestMessaging: true,
      pos: true,
      staffScheduling: true,
      mobileApp: true,
      aiFeatures: true,
      multiProperty: true,
    },
  },
  {
    name: "Campspot",
    isUs: false,
    monthlyBase: "Varies",
    perBooking: "$3.00",
    marketplaceCommission: "10%",
    setupFee: "$$$",
    paymentProcessing: "2.5%",
    freeTrialDays: "No",
    support: "Standard",
    features: {
      onlineBooking: true,
      dynamicPricing: true,
      guestMessaging: true,
      pos: true,
      staffScheduling: false,
      mobileApp: true,
      aiFeatures: false,
      multiProperty: true,
    },
  },
  {
    name: "Firefly",
    isUs: false,
    monthlyBase: "Quote",
    perBooking: "Varies",
    marketplaceCommission: "N/A",
    setupFee: "$$",
    paymentProcessing: "2.5%",
    freeTrialDays: "Yes",
    support: "24/7",
    features: {
      onlineBooking: true,
      dynamicPricing: true,
      guestMessaging: true,
      pos: true,
      staffScheduling: true,
      mobileApp: false,
      aiFeatures: false,
      multiProperty: true,
    },
  },
  {
    name: "Newbook",
    isUs: false,
    monthlyBase: "Quote",
    perBooking: "Varies",
    marketplaceCommission: "N/A",
    setupFee: "$0",
    paymentProcessing: "Varies",
    freeTrialDays: "Free tier",
    support: "24/7",
    features: {
      onlineBooking: true,
      dynamicPricing: true,
      guestMessaging: true,
      pos: true,
      staffScheduling: true,
      mobileApp: true,
      aiFeatures: false,
      multiProperty: true,
    },
  },
  {
    name: "ResNexus",
    isUs: false,
    monthlyBase: "$30+",
    perBooking: "$0",
    marketplaceCommission: "N/A",
    setupFee: "$$",
    paymentProcessing: "2.5%",
    freeTrialDays: "14",
    support: "Standard",
    features: {
      onlineBooking: true,
      dynamicPricing: true,
      guestMessaging: true,
      pos: false,
      staffScheduling: false,
      mobileApp: true,
      aiFeatures: false,
      multiProperty: true,
    },
  },
];

const featureLabels: Record<string, string> = {
  onlineBooking: "Online Booking",
  dynamicPricing: "Dynamic Pricing",
  guestMessaging: "Guest Messaging",
  pos: "Point of Sale",
  staffScheduling: "Staff Scheduling",
  mobileApp: "Mobile App",
  aiFeatures: "AI Features",
  multiProperty: "Multi-Property",
};

export function PricingPreview() {
  const [showComparison, setShowComparison] = useState(false);
  const prefersReducedMotion = useReducedMotionSafe();

  // Determine which tier is currently active (first one with spots remaining)
  const { activeTier, upcomingTiers, filledTiers } = useMemo(() => {
    let active = null;
    const upcoming: typeof earlyAccessTiers = [];
    const filled: typeof earlyAccessTiers = [];

    for (const tier of earlyAccessTiers) {
      if (tier.spotsRemaining > 0 && !active) {
        active = tier;
      } else if (active) {
        upcoming.push(tier);
      } else {
        filled.push(tier);
      }
    }

    return { activeTier: active, upcomingTiers: upcoming, filledTiers: filled };
  }, []);

  // Calculate total spots and remaining
  const totalSpots = earlyAccessTiers.reduce((sum, t) => sum + t.spots, 0);
  const totalRemaining = earlyAccessTiers.reduce((sum, t) => sum + t.spotsRemaining, 0);
  const spotsFilled = totalSpots - totalRemaining;

  const containerVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    visible: { opacity: 1, transition: prefersReducedMotion ? undefined : { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: prefersReducedMotion ? undefined : { duration: 0.5 } }
  };

  return (
    <section id="pricing" className="py-24 bg-gradient-to-br from-keepr-charcoal via-slate-900 to-keepr-charcoal">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Early Access Hero */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-4xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-clay/15 border border-keepr-clay/30 rounded-full text-keepr-clay text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            {activeTier ? `NOW OPEN: ${activeTier.name}` : 'Early Access Closed'}
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {spotsFilled > 0
              ? `${spotsFilled} of 45 Spots Claimed`
              : 'Be One of Our First 45 Founding Campgrounds'
            }
          </h2>

          <p className="text-xl text-muted-foreground mb-8">
            Early access tiers fill in order — once {activeTier?.name || 'a tier'} is full, the next tier opens.
            Lock in per-booking fees that will never increase.
          </p>

          {/* Overall Progress Bar */}
          <div className="max-w-md mx-auto mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">{spotsFilled} claimed</span>
              <span className="text-keepr-clay font-semibold">{totalRemaining} spots left</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-keepr-clay to-keepr-evergreen rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: `${(spotsFilled / totalSpots) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-keepr-clay" />
              <span>Per-booking fee locked forever</span>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-keepr-clay" />
              <span>Free migration for early access</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-keepr-clay" />
              <span>Go live in 48 hours</span>
            </div>
          </div>
        </motion.div>

        {/* Active Tier - Hero Card */}
        {activeTier && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="relative rounded-3xl border-2 border-keepr-clay/60 bg-gradient-to-br from-keepr-clay/20 via-keepr-clay/10 to-transparent p-10 shadow-2xl shadow-keepr-clay/20">
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-3xl bg-keepr-clay/5 blur-xl -z-10" />

              {/* Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-keepr-clay text-white text-sm font-bold rounded-full shadow-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                NOW OPEN
              </div>

              {/* Header */}
              <div className="text-center mb-8 pt-4">
                <activeTier.icon className="h-16 w-16 mx-auto mb-4 text-keepr-clay" />
                <h3 className="text-3xl font-bold text-white mb-2">{activeTier.name}</h3>
                <p className="text-muted-foreground">First-come, first-served</p>

                {/* Spots Progress */}
                <div className="mt-6 max-w-xs mx-auto">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white font-medium">{activeTier.spotsRemaining} of {activeTier.spots} spots left</span>
                  </div>
                  <div className="h-4 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-keepr-clay rounded-full"
                      initial={{ width: '100%' }}
                      whileInView={{ width: `${(activeTier.spotsRemaining / activeTier.spots) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    />
                  </div>
                </div>

                {/* Pricing */}
                <div className="mt-8 space-y-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl text-muted-foreground">$</span>
                    <span className="text-7xl font-bold text-white">{activeTier.monthlyPrice}</span>
                    <span className="text-xl text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-lg text-muted-foreground">{activeTier.monthlyDuration}</p>
                  <div className="pt-3 mt-3 border-t border-white/10">
                    <span className="text-2xl text-keepr-clay font-bold">
                      ${activeTier.bookingFee.toFixed(2)} per booking
                    </span>
                    <span className="text-muted-foreground text-sm block mt-1">
                      (pass to guest or absorb — locked forever)
                    </span>
                  </div>
                </div>
              </div>

              {/* Benefits */}
              <ul className="grid md:grid-cols-2 gap-3 mb-8">
                {activeTier.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-keepr-clay flex-shrink-0 mt-0.5" />
                    <span className="text-white/90">{benefit}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                asChild
                className="w-full py-7 text-xl font-bold bg-keepr-clay hover:bg-keepr-clay-light text-white shadow-lg shadow-keepr-clay/30"
              >
                <Link href={`/signup?tier=${activeTier.name.toLowerCase().replace(/['\s]/g, '_').replace(/__/g, '_')}`}>
                  {activeTier.cta}
                  <ArrowRight className="ml-2 h-6 w-6" />
                </Link>
              </Button>
            </div>
          </motion.div>
        )}

        {/* Upcoming Tiers - Smaller, Grayed Out */}
        {upcomingTiers.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="max-w-4xl mx-auto mb-16"
          >
            <div className="text-center mb-6">
              <p className="text-muted-foreground text-sm uppercase tracking-wider font-medium">
                Coming Next — Opens when {activeTier?.name} fills
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {upcomingTiers.map((tier, index) => (
                <motion.div
                  key={tier.name}
                  variants={itemVariants}
                  className="relative rounded-xl border border-white/10 bg-white/5 p-6 opacity-60"
                >
                  {/* Queue Position */}
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-slate-700 text-white/70 text-xs font-medium rounded-full">
                    Opens {index === 0 ? 'next' : `after ${upcomingTiers[index - 1]?.name}`}
                  </div>

                  <div className="flex items-start gap-4 pt-2">
                    <div className="p-3 rounded-xl bg-white/5">
                      <tier.icon className="h-8 w-8 text-white/40" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-white/70">{tier.name}</h4>
                      <p className="text-sm text-muted-foreground">{tier.spots} spots</p>

                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white/60">${tier.monthlyPrice}</span>
                        <span className="text-sm text-muted-foreground">/mo {tier.monthlyDuration}</span>
                      </div>
                      <p className="text-sm text-white/50 mt-1">
                        ${tier.bookingFee.toFixed(2)} per booking
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Filled Tiers (if any) */}
        {filledTiers.length > 0 && (
          <div className="max-w-2xl mx-auto mb-16 text-center">
            <p className="text-muted-foreground text-sm">
              Already filled: {filledTiers.map(t => t.name).join(', ')}
            </p>
          </div>
        )}

        {/* After Early Access Note */}
        <div className="text-center mb-16">
          <p className="text-muted-foreground">
            After early access fills: <span className="text-white font-semibold">$100/month + $2.30/booking</span>
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Includes $5/month AI credits. SMS at cost + small markup.
          </p>
        </div>

        {/* Setup Assistance Add-Ons */}
        <div id="add-ons" className="max-w-5xl mx-auto mb-20 scroll-mt-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-evergreen/15 border border-keepr-evergreen/30 rounded-full text-keepr-evergreen text-sm font-semibold mb-6">
              <Wrench className="h-4 w-4" />
              Optional Add-Ons
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">
              Want Help Getting Set Up?
            </h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              DIY setup is always free with our guides and documentation. But if you'd rather have us handle
              the heavy lifting, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Quick Start */}
            <div className="rounded-2xl border border-border bg-muted/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-keepr-evergreen/15">
                  <Headphones className="h-6 w-6 text-keepr-evergreen" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Quick Start</h4>
                  <p className="text-muted-foreground text-sm">We configure, you relax</p>
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-2xl text-muted-foreground">$</span>
                <span className="text-5xl font-bold text-white">249</span>
                <span className="text-muted-foreground">one-time</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Site & rate configuration</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Payment gateway setup</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">30-minute training call</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Policy & email template setup</span>
                </li>
              </ul>

              <p className="text-sm text-muted-foreground">
                Perfect for campgrounds who want to hit the ground running.
              </p>

              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  <span className="text-keepr-evergreen font-medium">Prefer to pay over time?</span>{" "}
                  Add $1/booking until paid off.
                </p>
              </div>
            </div>

            {/* Data Import Service */}
            <div className="rounded-2xl border border-border bg-muted/50 p-8">
                <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-keepr-clay/15">
                  <Database className="h-6 w-6 text-keepr-clay" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Data Import Service</h4>
                  <p className="text-muted-foreground text-sm">We import your existing reservations</p>
                </div>
              </div>

              <p className="text-muted-foreground mb-6">
                You export from your old system, we clean it up and import it. No more manual data entry.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Up to 500 reservations</span>
                  <span className="text-white font-semibold">$299</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">501 – 2,000 reservations</span>
                  <span className="text-white font-semibold">$599</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground">2,001 – 5,000 reservations</span>
                  <span className="text-white font-semibold">$999</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">5,000+ reservations</span>
                  <span className="text-keepr-clay font-semibold">Custom quote</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Includes guest data, reservation history, and QA review.
              </p>

              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  <span className="text-keepr-clay font-medium">Prefer to pay over time?</span>{" "}
                  Add $1/booking until paid off.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-muted-foreground text-sm mt-8">
            Early access tiers include free data migration assistance.
          </p>
        </div>

        {/* Competitor Comparison Toggle */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-card/10 hover:bg-card/20 text-foreground rounded-full transition-colors"
          >
            {showComparison ? "Hide" : "Show"} Competitor Comparison
            <ArrowRight className={`h-4 w-4 transition-transform ${showComparison ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Competitor Comparison Table */}
        {showComparison && (
          <div className="overflow-x-auto rounded-2xl border border-border bg-muted/50 backdrop-blur">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Feature</th>
                  {competitors.map((c) => (
                    <th
                      key={c.name}
                      className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/20" : ""}`}
                    >
                      <span className={c.isUs ? "text-keepr-evergreen font-bold" : "text-white"}>
                        {c.name}
                      </span>
                      {c.isUs && (
                        <span className="block text-xs text-keepr-evergreen/70 mt-1">That's us!</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Pricing rows */}
                <tr className="border-b border-border/50">
                  <td className="p-4 text-muted-foreground">Monthly Base</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.monthlyBase}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-muted-foreground">Per Booking Fee</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.perBooking}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-muted-foreground">Marketplace Commission</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : c.marketplaceCommission === "10%" ? "text-red-400" : "text-white"}`}>
                      {c.marketplaceCommission}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-muted-foreground">Setup Fee</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.setupFee}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-muted-foreground">Free Trial</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.freeTrialDays === "No" ? <X className="h-5 w-5 mx-auto text-red-400" /> : c.freeTrialDays + " days"}
                    </td>
                  ))}
                </tr>

                {/* Feature rows */}
                {Object.entries(featureLabels).map(([key, label]) => (
                  <tr key={key} className="border-b border-border/50">
                    <td className="p-4 text-muted-foreground">{label}</td>
                    {competitors.map((c) => (
                      <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10" : ""}`}>
                        {c.features[key as keyof typeof c.features] ? (
                          <Check className={`h-5 w-5 mx-auto ${c.isUs ? "text-keepr-clay" : "text-keepr-evergreen/70"}`} />
                        ) : (
                          <X className="h-5 w-5 mx-auto text-muted-foreground" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground mb-6">
            Join the first 45 campgrounds building the future of reservation software.
          </p>
          <Button
            asChild
            variant="outline"
            className="border-border bg-muted text-foreground hover:bg-muted px-8 py-6 text-lg"
          >
            <Link href="/signup">
              Claim Your Founding Spot
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Trust Elements */}
        <div className="mt-16 pt-16 border-t border-border">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-keepr-clay mb-2">45</div>
              <p className="text-muted-foreground">Founding spots available</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">30-Day</div>
              <p className="text-muted-foreground">Money-back guarantee</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">48 Hours</div>
              <p className="text-muted-foreground">Average time to go live</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Free</div>
              <p className="text-muted-foreground">DIY setup with guides</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
