"use client";

import { Building2, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

const benefits = [
  "Free data migration from any system",
  "Go live in 48 hours, not weeks",
  "No contracts, cancel anytime",
  "50% less than legacy systems",
];

interface OwnerCTAProps {
  className?: string;
}

export function OwnerCTA({ className }: OwnerCTAProps) {
  return (
    <section className={cn("py-16 md:py-20 bg-slate-900", className)}>
      <div className="max-w-4xl mx-auto px-6 text-center">
        {/* Early Access Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          Founder pricing ends soon — Only 45 spots
        </div>

        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-6">
          <Building2 className="w-8 h-8 text-emerald-400" />
        </div>

        {/* Headline */}
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
          Ready to Ditch Your Legacy System?
        </h2>

        {/* Subheadline */}
        <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
          Stop overpaying for outdated software. Camp Everyday is the modern reservation
          system built for how you actually run your campground — fast, simple, affordable.
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
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          >
            Claim Your Spot
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
          No credit card required. No contracts. We'll import your data from Campspot, Newbook, or any system.
        </p>
      </div>
    </section>
  );
}
