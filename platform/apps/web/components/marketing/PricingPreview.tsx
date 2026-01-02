'use client';

import { Check, X, ArrowRight, Star, Clock, Users, Zap, Crown, Rocket, Gift, Shield, Wrench, Database, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState } from 'react';

// Early Access Tiers - Real scarcity with limited spots
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
    name: "Camp Everyday",
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

  return (
    <section id="pricing" className="py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Early Access Hero */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-semibold mb-6">
            <Clock className="h-4 w-4" />
            Only 45 Founding Spots Available
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Be One of Our First 45 Founding Campgrounds
          </h2>

          <p className="text-xl text-slate-300 mb-8">
            Lock in per-booking fees that will never increase — $0.75 to $1.25 vs $2.30 standard.
            Once these 45 spots are gone, you'll have helped shape the future of campground software.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-400" />
              <span>Per-booking fee locked forever</span>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-400" />
              <span>Free migration for early access</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-400" />
              <span>Go live in 48 hours</span>
            </div>
          </div>
        </div>

        {/* Early Access Tiers */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-20">
          {earlyAccessTiers.map((tier) => {
            const colorStylesMap = {
              amber: {
                border: "border-amber-500",
                bg: "bg-amber-500/10",
                badge: "bg-amber-500 text-slate-900",
                icon: "text-amber-400",
                button: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
                urgency: "text-amber-400",
              },
              emerald: {
                border: "border-emerald-500",
                bg: "bg-emerald-500/10",
                badge: "bg-emerald-500 text-white",
                icon: "text-emerald-400",
                button: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
                urgency: "text-emerald-400",
              },
              violet: {
                border: "border-violet-500",
                bg: "bg-violet-500/10",
                badge: "bg-violet-500 text-white",
                icon: "text-violet-400",
                button: "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400",
                urgency: "text-violet-400",
              },
            };
            const colorStyles = colorStylesMap[tier.color as keyof typeof colorStylesMap];

            return (
              <div
                key={tier.name}
                className={`relative rounded-2xl border-2 ${colorStyles.border} ${colorStyles.bg} p-8 transition-all duration-300 hover:scale-[1.02]`}
              >
                {/* Badge */}
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 ${colorStyles.badge} text-sm font-bold rounded-full`}>
                  {tier.highlight}
                </div>

                {/* Header */}
                <div className="text-center mb-8 pt-4">
                  <tier.icon className={`h-12 w-12 mx-auto mb-4 ${colorStyles.icon}`} />
                  <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>

                  {/* Spots Counter */}
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="flex -space-x-1">
                      {[...Array(Math.min(tier.spotsRemaining, 5))].map((_, i) => (
                        <div key={i} className="w-6 h-6 rounded-full bg-slate-600 border-2 border-slate-800" />
                      ))}
                    </div>
                    <span className={`text-sm font-semibold ${colorStyles.urgency}`}>
                      {tier.urgency}
                    </span>
                  </div>

                  {/* Pricing */}
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl text-slate-400">$</span>
                      <span className="text-6xl font-bold text-white">{tier.monthlyPrice}</span>
                      <span className="text-slate-400">/mo</span>
                    </div>
                    <p className="text-slate-400">{tier.monthlyDuration}</p>
                    <div className="pt-2 border-t border-slate-700/50">
                      <span className="text-emerald-400 font-semibold">
                        ${tier.bookingFee.toFixed(2)} per booking
                      </span>
                      <span className="text-slate-500 text-sm block">
                        (pass to guest or absorb)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Benefits */}
                <ul className="space-y-3 mb-8">
                  {tier.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{benefit}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Button
                  asChild
                  className={`w-full py-6 text-lg font-semibold ${colorStyles.button} text-white shadow-lg`}
                >
                  <Link href={`/signup?tier=${tier.name.toLowerCase().replace(/['\s]/g, '_').replace(/__/g, '_')}`}>
                    {tier.cta}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* After Early Access Note */}
        <div className="text-center mb-16">
          <p className="text-slate-400">
            After early access fills: <span className="text-white font-semibold">$100/month + $2.30/booking</span>
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Includes $5/month AI credits. SMS at cost + small markup.
          </p>
        </div>

        {/* Setup Assistance Add-Ons */}
        <div id="add-ons" className="max-w-5xl mx-auto mb-20 scroll-mt-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-sm font-semibold mb-6">
              <Wrench className="h-4 w-4" />
              Optional Add-Ons
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">
              Want Help Getting Set Up?
            </h3>
            <p className="text-slate-400 max-w-2xl mx-auto">
              DIY setup is always free with our guides and documentation. But if you'd rather have us handle
              the heavy lifting, we've got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Quick Start */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-blue-500/20">
                  <Headphones className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Quick Start</h4>
                  <p className="text-slate-400 text-sm">We configure, you relax</p>
                </div>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-2xl text-slate-400">$</span>
                <span className="text-5xl font-bold text-white">249</span>
                <span className="text-slate-400">one-time</span>
              </div>

              <ul className="space-y-3 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Site & rate configuration</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Payment gateway setup</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">30-minute training call</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-300">Policy & email template setup</span>
                </li>
              </ul>

              <p className="text-sm text-slate-500">
                Perfect for campgrounds who want to hit the ground running.
              </p>

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <p className="text-sm text-slate-400">
                  <span className="text-blue-400 font-medium">Prefer to pay over time?</span>{" "}
                  Add $1/booking until paid off.
                </p>
              </div>
            </div>

            {/* Data Import Service */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-emerald-500/20">
                  <Database className="h-6 w-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Data Import Service</h4>
                  <p className="text-slate-400 text-sm">We import your existing reservations</p>
                </div>
              </div>

              <p className="text-slate-300 mb-6">
                You export from your old system, we clean it up and import it. No more manual data entry.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">Up to 500 reservations</span>
                  <span className="text-white font-semibold">$299</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">501 – 2,000 reservations</span>
                  <span className="text-white font-semibold">$599</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                  <span className="text-slate-300">2,001 – 5,000 reservations</span>
                  <span className="text-white font-semibold">$999</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-300">5,000+ reservations</span>
                  <span className="text-emerald-400 font-semibold">Custom quote</span>
                </div>
              </div>

              <p className="text-sm text-slate-500">
                Includes guest data, reservation history, and QA review.
              </p>

              <div className="mt-6 pt-6 border-t border-slate-700/50">
                <p className="text-sm text-slate-400">
                  <span className="text-emerald-400 font-medium">Prefer to pay over time?</span>{" "}
                  Add $1/booking until paid off.
                </p>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-500 text-sm mt-8">
            Early access tiers include free data migration assistance.
          </p>
        </div>

        {/* Competitor Comparison Toggle */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowComparison(!showComparison)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            {showComparison ? "Hide" : "Show"} Competitor Comparison
            <ArrowRight className={`h-4 w-4 transition-transform ${showComparison ? "rotate-90" : ""}`} />
          </button>
        </div>

        {/* Competitor Comparison Table */}
        {showComparison && (
          <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left p-4 text-slate-400 font-medium">Feature</th>
                  {competitors.map((c) => (
                    <th
                      key={c.name}
                      className={`p-4 text-center ${c.isUs ? "bg-emerald-500/20" : ""}`}
                    >
                      <span className={c.isUs ? "text-emerald-400 font-bold" : "text-white"}>
                        {c.name}
                      </span>
                      {c.isUs && (
                        <span className="block text-xs text-emerald-400/70 mt-1">That's us!</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Pricing rows */}
                <tr className="border-b border-slate-700/50">
                  <td className="p-4 text-slate-300">Monthly Base</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-white"}`}>
                      {c.monthlyBase}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="p-4 text-slate-300">Per Booking Fee</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-white"}`}>
                      {c.perBooking}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="p-4 text-slate-300">Marketplace Commission</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-emerald-500/10 text-emerald-400 font-semibold" : c.marketplaceCommission === "10%" ? "text-red-400" : "text-white"}`}>
                      {c.marketplaceCommission}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="p-4 text-slate-300">Setup Fee</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-white"}`}>
                      {c.setupFee}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-700/50">
                  <td className="p-4 text-slate-300">Free Trial</td>
                  {competitors.map((c) => (
                    <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-emerald-500/10 text-emerald-400 font-semibold" : "text-white"}`}>
                      {c.freeTrialDays === "No" ? <X className="h-5 w-5 mx-auto text-red-400" /> : c.freeTrialDays + " days"}
                    </td>
                  ))}
                </tr>

                {/* Feature rows */}
                {Object.entries(featureLabels).map(([key, label]) => (
                  <tr key={key} className="border-b border-slate-700/50">
                    <td className="p-4 text-slate-300">{label}</td>
                    {competitors.map((c) => (
                      <td key={c.name} className={`p-4 text-center ${c.isUs ? "bg-emerald-500/10" : ""}`}>
                        {c.features[key as keyof typeof c.features] ? (
                          <Check className={`h-5 w-5 mx-auto ${c.isUs ? "text-emerald-400" : "text-emerald-500"}`} />
                        ) : (
                          <X className="h-5 w-5 mx-auto text-slate-500" />
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
          <p className="text-slate-400 mb-6">
            Join the first 45 campgrounds building the future of reservation software.
          </p>
          <Button
            asChild
            variant="outline"
            className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700 px-8 py-6 text-lg"
          >
            <Link href="/signup">
              Claim Your Founding Spot
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>

        {/* Trust Elements */}
        <div className="mt-16 pt-16 border-t border-slate-700">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-amber-400 mb-2">45</div>
              <p className="text-slate-400">Founding spots available</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">30-Day</div>
              <p className="text-slate-400">Money-back guarantee</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">48 Hours</div>
              <p className="text-slate-400">Average time to go live</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2">Free</div>
              <p className="text-slate-400">DIY setup with guides</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
