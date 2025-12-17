"use client";

import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

const benefits = [
  "No commission on bookings",
  "Full control over your rates",
  "Direct guest communication",
  "Professional booking system",
];

interface OwnerCTAProps {
  className?: string;
}

export function OwnerCTA({ className }: OwnerCTAProps) {
  return (
    <section className={cn("py-16 md:py-20 bg-slate-900", className)}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-6">
          <Building2 className="w-8 h-8 text-emerald-400" />
        </div>

        {/* Headline */}
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
          Own a Campground?
        </h2>

        {/* Subheadline */}
        <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
          Join the platform that puts your guests first.
          Get a professional booking system without the commission fees.
        </p>

        {/* Benefits */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mb-10">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/auth/signin?callbackUrl=/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 text-slate-300 font-semibold border border-slate-700 rounded-xl hover:bg-slate-800 hover:text-white transition-colors"
          >
            View Pricing
          </a>
        </div>

        {/* Small print */}
        <p className="mt-8 text-sm text-slate-500">
          No credit card required. Set up in under 5 minutes.
        </p>
      </div>
    </section>
  );
}
