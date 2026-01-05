'use client';

import { Check, X, ArrowRight, Star, Clock, Users, Zap, Crown, Rocket, Gift, Shield, Wrench, Database, Headphones, Sparkles, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

type EarlyAccessTierKey = "founders_circle" | "pioneer" | "trailblazer";

type TierPricing = {
  bookingFeeCents: number;
  monthlyFeeCents: number;
  monthlyDurationMonths: number | null;
  postPromoMonthlyFeeCents: number;
};

type TierAvailability = {
  tier: EarlyAccessTierKey;
  totalSpots: number;
  remainingSpots: number;
  isSoldOut: boolean;
  pricing: TierPricing;
};

type TierContent = {
  name: string;
  icon: LucideIcon;
  highlight: string;
  color: "amber" | "emerald" | "violet";
  cta: string;
  benefits: (pricing: TierPricing) => string[];
};

const tierOrder: EarlyAccessTierKey[] = ["founders_circle", "pioneer", "trailblazer"];

const fallbackAvailability: Record<EarlyAccessTierKey, { totalSpots: number; pricing: TierPricing }> = {
  founders_circle: {
    totalSpots: 5,
    pricing: {
      bookingFeeCents: 75,
      monthlyFeeCents: 0,
      monthlyDurationMonths: null,
      postPromoMonthlyFeeCents: 0,
    },
  },
  pioneer: {
    totalSpots: 15,
    pricing: {
      bookingFeeCents: 100,
      monthlyFeeCents: 0,
      monthlyDurationMonths: 12,
      postPromoMonthlyFeeCents: 2900,
    },
  },
  trailblazer: {
    totalSpots: 25,
    pricing: {
      bookingFeeCents: 125,
      monthlyFeeCents: 1450,
      monthlyDurationMonths: 6,
      postPromoMonthlyFeeCents: 2900,
    },
  },
};

const formatCurrency = (cents: number, options: { forceDecimals?: boolean } = {}) => {
  const amount = cents / 100;
  if (!Number.isFinite(amount)) return "$0";
  const formatted = options.forceDecimals
    ? amount.toFixed(2)
    : amount % 1 === 0
      ? amount.toFixed(0)
      : amount.toFixed(2);
  return `$${formatted}`;
};

const formatAmount = (cents: number) => {
  const amount = cents / 100;
  if (!Number.isFinite(amount)) return "0";
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
};

const formatDuration = (months: number | null) => {
  if (months === null) return "forever";
  return `for ${months} months`;
};

const tierContent: Record<EarlyAccessTierKey, TierContent> = {
  founders_circle: {
    name: "Founder's Circle",
    icon: Crown,
    highlight: "Best Deal",
    color: "amber",
    cta: "Claim Founder Spot",
    benefits: (pricing) => [
      `${formatCurrency(pricing.monthlyFeeCents)}/month forever (not a typo)`,
      `${formatCurrency(pricing.bookingFeeCents, { forceDecimals: true })} per booking (locked forever)`,
      "Lifetime 'Founder' badge on your listing",
      "Direct line to founders (phone/text)",
      "Co-create features with us",
      "Your logo on our website",
      "First access to every new feature",
    ],
  },
  pioneer: {
    name: "Pioneer",
    icon: Rocket,
    highlight: "Most Popular",
    color: "emerald",
    cta: "Become a Pioneer",
    benefits: (pricing) => {
      const durationLabel = pricing.monthlyDurationMonths
        ? `for first ${pricing.monthlyDurationMonths} months`
        : "for a limited time";
      const postPromoLabel = pricing.postPromoMonthlyFeeCents
        ? `Then just ${formatCurrency(pricing.postPromoMonthlyFeeCents)}/month`
        : "Then standard pricing";
      return [
        `${formatCurrency(pricing.monthlyFeeCents)}/month ${durationLabel}`,
        `${formatCurrency(pricing.bookingFeeCents, { forceDecimals: true })} per booking (locked forever)`,
        postPromoLabel,
        "Priority support forever",
        "Early access to new features",
        "Quarterly strategy calls",
        "Free data migration",
      ];
    },
  },
  trailblazer: {
    name: "Trailblazer",
    icon: Star,
    highlight: "Great Value",
    color: "violet",
    cta: "Join Trailblazers",
    benefits: (pricing) => {
      const durationLabel = pricing.monthlyDurationMonths
        ? `for first ${pricing.monthlyDurationMonths} months`
        : "for a limited time";
      const postPromoLabel = pricing.postPromoMonthlyFeeCents
        ? `Then ${formatCurrency(pricing.postPromoMonthlyFeeCents)}/month`
        : "Then standard pricing";
      const discountPercent = pricing.postPromoMonthlyFeeCents
        ? Math.round(100 - (pricing.monthlyFeeCents / pricing.postPromoMonthlyFeeCents) * 100)
        : null;
      const discountLabel = discountPercent ? `${discountPercent}% off` : "Discounted";
      return [
        `${discountLabel} ${durationLabel} (${formatCurrency(pricing.monthlyFeeCents)}/mo)`,
        `${formatCurrency(pricing.bookingFeeCents, { forceDecimals: true })} per booking (locked forever)`,
        postPromoLabel,
        "Early access to new features",
        "Priority email support",
        "Free data migration",
        "Onboarding call included",
      ];
    },
  },
};

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

type TierModel = {
  key: EarlyAccessTierKey;
  name: string;
  icon: LucideIcon;
  highlight: string;
  color: "amber" | "emerald" | "violet";
  cta: string;
  benefits: string[];
  spots: number;
  spotsRemaining: number | null;
  monthlyPriceDisplay: string;
  monthlyDuration: string;
  bookingFeeDisplay: string;
};

export function PricingPreview() {
  const [showComparison, setShowComparison] = useState(false);
  const [availability, setAvailability] = useState<TierAvailability[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<"loading" | "ready" | "error">("loading");
  const prefersReducedMotion = useReducedMotionSafe();

  useEffect(() => {
    let isMounted = true;
    async function fetchAvailability() {
      try {
        const res = await fetch(`${API_BASE}/early-access/availability`);
        if (!res.ok) throw new Error("Failed to fetch early access availability");
        const data = (await res.json()) as TierAvailability[];
        if (isMounted) {
          setAvailability(data);
          setAvailabilityStatus("ready");
        }
      } catch (err) {
        console.error("Failed to fetch early access availability:", err);
        if (isMounted) {
          setAvailabilityStatus("error");
        }
      }
    }
    fetchAvailability();
    return () => {
      isMounted = false;
    };
  }, []);

  const availabilityByTier = useMemo(
    () => new Map(availability.map((tier) => [tier.tier, tier])),
    [availability]
  );

  const tiers = useMemo<TierModel[]>(() => {
    return tierOrder.map((tierKey) => {
      const content = tierContent[tierKey];
      const live = availabilityByTier.get(tierKey);
      const fallback = fallbackAvailability[tierKey];
      const pricing = live?.pricing ?? fallback.pricing;
      const spots = live?.totalSpots ?? fallback.totalSpots;
      const spotsRemaining = live?.remainingSpots ?? null;

      return {
        key: tierKey,
        name: content.name,
        icon: content.icon,
        highlight: content.highlight,
        color: content.color,
        cta: content.cta,
        benefits: content.benefits(pricing),
        spots,
        spotsRemaining,
        monthlyPriceDisplay: formatAmount(pricing.monthlyFeeCents),
        monthlyDuration: formatDuration(pricing.monthlyDurationMonths),
        bookingFeeDisplay: formatCurrency(pricing.bookingFeeCents, { forceDecimals: true }),
      };
    });
  }, [availabilityByTier]);

  const hasLiveAvailability = availabilityStatus === "ready" && availability.length > 0;

  const { activeTier, upcomingTiers, filledTiers } = useMemo(() => {
    if (!tiers.length) {
      return { activeTier: null, upcomingTiers: [], filledTiers: [] };
    }

    if (!hasLiveAvailability) {
      return {
        activeTier: tiers[0],
        upcomingTiers: tiers.slice(1),
        filledTiers: [],
      };
    }

    let active: TierModel | null = null;
    const upcoming: TierModel[] = [];
    const filled: TierModel[] = [];

    for (const tier of tiers) {
      const remaining = tier.spotsRemaining ?? 0;
      if (remaining > 0 && !active) {
        active = tier;
      } else if (active) {
        upcoming.push(tier);
      } else {
        filled.push(tier);
      }
    }

    return { activeTier: active, upcomingTiers: upcoming, filledTiers: filled };
  }, [tiers, hasLiveAvailability]);

  const totalSpots = tiers.reduce((sum, tier) => sum + tier.spots, 0);
  const totalRemaining = hasLiveAvailability
    ? tiers.reduce((sum, tier) => sum + (tier.spotsRemaining ?? 0), 0)
    : null;
  const spotsFilled = totalRemaining === null ? null : totalSpots - totalRemaining;

  const containerVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    visible: { opacity: 1, transition: prefersReducedMotion ? undefined : { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0, transition: prefersReducedMotion ? undefined : { duration: 0.5 } }
  };

  const availabilityLabel =
    availabilityStatus === "loading"
      ? "Checking early access availability"
      : availabilityStatus === "error" || !hasLiveAvailability
        ? "Early access availability unavailable"
        : activeTier
          ? `NOW OPEN: ${activeTier.name}`
          : "Early Access Closed";
  const availabilityHint =
    availabilityStatus === "loading"
      ? "Checking availability..."
      : availabilityStatus === "error"
        ? "Availability unavailable right now."
        : "Availability updates live. Check back shortly.";

  const hasClaimedSpots = spotsFilled !== null && spotsFilled > 0;
  const progressPercent =
    hasLiveAvailability && spotsFilled !== null && totalSpots > 0
      ? (spotsFilled / totalSpots) * 100
      : 0;
  const remainingSpots =
    hasLiveAvailability && totalRemaining !== null ? totalRemaining : totalSpots;
  const remainingLabel = hasLiveAvailability ? "Founding spots left" : "Founding spots total";
  const joinMessage =
    hasLiveAvailability && totalRemaining !== null
      ? totalRemaining > 0
        ? `Join the next ${totalRemaining} campgrounds building the future of reservation software.`
        : "Early access is full. Standard pricing is available now."
      : `Join the first ${totalSpots} campgrounds building the future of reservation software.`;
  const ctaLink = hasLiveAvailability && totalRemaining === 0 ? "/pricing" : "/signup";
  const ctaLabel = hasLiveAvailability && totalRemaining === 0 ? "See Standard Pricing" : "Claim Your Founding Spot";

  return (
    <section id="pricing" className="py-20 bg-gradient-to-br from-keepr-charcoal via-slate-900 to-keepr-charcoal scroll-mt-24">
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
            {availabilityLabel}
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {hasClaimedSpots
              ? `${spotsFilled} of ${totalSpots} Spots Claimed`
              : `Be One of Our First ${totalSpots} Founding Campgrounds`
            }
          </h2>

          <p className="text-xl text-slate-300 mb-8">
            Early access tiers fill in order — once {activeTier?.name || 'a tier'} is full, the next tier opens.
            Lock in per-booking fees that will never increase.
          </p>

          {/* Overall Progress Bar */}
          <div className="max-w-md mx-auto mb-8">
            {hasLiveAvailability ? (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-300">{spotsFilled} claimed</span>
                  <span className="text-keepr-clay font-semibold">{totalRemaining} spots left</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-keepr-clay to-keepr-evergreen rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${progressPercent}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
              </>
            ) : (
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
                {availabilityHint}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-300">
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
                {hasLiveAvailability ? "NOW OPEN" : "EARLY ACCESS"}
              </div>

              {/* Header */}
              <div className="text-center mb-8 pt-4">
                <activeTier.icon className="h-16 w-16 mx-auto mb-4 text-keepr-clay" />
                <h3 className="text-3xl font-bold text-white mb-2">{activeTier.name}</h3>
                <p className="text-slate-300">First-come, first-served</p>

                {/* Spots Progress */}
                <div className="mt-6 max-w-xs mx-auto">
                  {hasLiveAvailability && activeTier.spotsRemaining !== null ? (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white font-medium">
                          {activeTier.spotsRemaining} of {activeTier.spots} spots left
                        </span>
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
                    </>
                  ) : (
                    <div className="text-sm text-slate-300">
                      {availabilityHint}
                    </div>
                  )}
                </div>

                {/* Pricing */}
                <div className="mt-8 space-y-2">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl text-slate-300">$</span>
                    <span className="text-7xl font-bold text-white">{activeTier.monthlyPriceDisplay}</span>
                    <span className="text-xl text-slate-300">/mo</span>
                  </div>
                  <p className="text-lg text-slate-300">{activeTier.monthlyDuration}</p>
                  <div className="pt-3 mt-3 border-t border-white/10">
                    <span className="text-2xl text-keepr-clay font-bold">
                      {activeTier.bookingFeeDisplay} per booking
                    </span>
                    <span className="text-slate-300 text-sm block mt-1">
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
                <Link href={`/signup?tier=${activeTier.key}`}>
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
              <p className="text-slate-300 text-sm uppercase tracking-wider font-medium">
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
                      <p className="text-sm text-slate-300">{tier.spots} spots</p>

                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-white/60">${tier.monthlyPriceDisplay}</span>
                        <span className="text-sm text-slate-300">/mo {tier.monthlyDuration}</span>
                      </div>
                      <p className="text-sm text-white/50 mt-1">
                        {tier.bookingFeeDisplay} per booking
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
            <p className="text-slate-300 text-sm">
              Already filled: {filledTiers.map(t => t.name).join(', ')}
            </p>
          </div>
        )}

        {/* After Early Access Note */}
        <div className="text-center mb-16">
          <p className="text-slate-300">
            After early access fills: <span className="text-white font-semibold">$100/month + $2.30/booking</span>
          </p>
          <p className="text-slate-300 text-sm mt-2">
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
            <p className="text-slate-300 max-w-2xl mx-auto">
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
                  <p className="text-slate-300 text-sm">We configure, you relax</p>
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-2xl text-slate-300">$</span>
                <span className="text-5xl font-bold text-white">249</span>
                <span className="text-slate-300">one-time</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Site & rate configuration</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Payment gateway setup</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">30-minute training call</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Policy & email template setup</span>
                </li>
              </ul>

              <p className="text-sm text-slate-300">
                Perfect for campgrounds who want to hit the ground running.
              </p>

              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-sm text-slate-300">
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
                  <p className="text-slate-300 text-sm">We import your existing reservations</p>
                </div>
              </div>

              <p className="text-slate-300 mb-6">
                You export from your old system, we clean it up and import it. No more manual data entry.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-slate-300">Up to 500 reservations</span>
                  <span className="text-white font-semibold">$299</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-slate-300">501 – 2,000 reservations</span>
                  <span className="text-white font-semibold">$599</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-slate-300">2,001 – 5,000 reservations</span>
                  <span className="text-white font-semibold">$999</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-300">5,000+ reservations</span>
                  <span className="text-keepr-clay font-semibold">Custom quote</span>
                </div>
              </div>

              <p className="text-sm text-slate-300">
                Includes guest data, reservation history, and QA review.
              </p>

              <div className="mt-6 pt-6 border-t border-border/50">
                <p className="text-sm text-slate-300">
                  <span className="text-keepr-clay font-medium">Prefer to pay over time?</span>{" "}
                  Add $1/booking until paid off.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-300 text-sm mt-8">
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
                  <th className="text-left p-4 text-slate-300 font-medium">Feature</th>
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
                  <td className="p-4 text-slate-300">Monthly Base</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.monthlyBase}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-slate-300">Per Booking Fee</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.perBooking}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-slate-300">Marketplace Commission</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : c.marketplaceCommission === "10%" ? "text-red-400" : "text-white"}`}>
                      {c.marketplaceCommission}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-slate-300">Setup Fee</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.setupFee}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-4 text-slate-300">Free Trial</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10 text-keepr-evergreen font-semibold" : "text-white"}`}>
                      {c.freeTrialDays === "No" ? <X className="h-5 w-5 mx-auto text-red-400" /> : c.freeTrialDays + " days"}
                    </td>
                  ))}
                </tr>

                {/* Feature rows */}
                {Object.entries(featureLabels).map(([key, label]) => (
                  <tr key={key} className="border-b border-border/50">
                    <td className="p-4 text-slate-300">{label}</td>
                    {competitors.map((c) => (
                      <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-keepr-evergreen/10" : ""}`}>
                        {c.features[key as keyof typeof c.features] ? (
                          <Check className={`h-5 w-5 mx-auto ${c.isUs ? "text-keepr-clay" : "text-keepr-evergreen/70"}`} />
                        ) : (
                          <X className="h-5 w-5 mx-auto text-slate-400" />
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
          <p className="text-slate-300 mb-6">
            {joinMessage}
          </p>
          <Button
            asChild
            variant="outline"
            className="border-border bg-muted text-foreground hover:bg-muted px-8 py-6 text-lg"
          >
            <Link href={ctaLink}>
              {ctaLabel}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Trust Elements */}
        <div className="mt-16 pt-16 border-t border-border">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-keepr-clay mb-2">{remainingSpots}</div>
              <p className="text-slate-300">{remainingLabel}</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">30-Day</div>
              <p className="text-slate-300">Money-back guarantee</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">48 Hours</div>
              <p className="text-slate-300">Average time to go live</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Free</div>
              <p className="text-slate-300">DIY setup with guides</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
