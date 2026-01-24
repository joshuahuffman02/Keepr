"use client";

import Image from "next/image";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

const benefits = [
  { text: "Free data migration from any system", icon: "/images/icons/owner-cta/handshake.png" },
  { text: "Go live in 48 hours, not weeks", icon: "/images/icons/owner-cta/property-keys.png" },
  { text: "No contracts, cancel anytime", icon: "/images/icons/owner-cta/house-plus.png" },
  { text: "50% less than legacy systems", icon: "/images/icons/owner-cta/growing-money.png" },
];

interface OwnerCTAProps {
  className?: string;
}

export function OwnerCTA({ className }: OwnerCTAProps) {
  return (
    <section
      className={cn(
        "py-16 md:py-20 bg-gradient-to-br from-keepr-charcoal via-slate-900 to-keepr-charcoal",
        className,
      )}
    >
      <div className="max-w-4xl mx-auto px-6 text-center">
        {/* Early Access Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-keepr-clay/15 to-keepr-clay/30 border border-keepr-clay/30 rounded-full text-keepr-clay-light text-sm font-medium mb-6">
          <Sparkles className="h-4 w-4" />
          Founder pricing ends soon — Only 45 spots
        </div>

        {/* Icon - Property Keys */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <Image
            src="/images/icons/owner-cta/property-keys.png"
            alt=""
            fill
            className="object-contain"
            sizes="80px"
          />
        </div>

        {/* Headline */}
        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
          Ready to Ditch Your Legacy System?
        </h2>

        {/* Subheadline */}
        <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
          Stop overpaying for outdated software. Keepr is the modern reservation system built for
          how you actually run your campground — fast, simple, affordable.
        </p>

        {/* Benefits with clay icons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 max-w-2xl mx-auto">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 text-left">
              <div className="relative w-10 h-10 flex-shrink-0">
                <Image src={benefit.icon} alt="" fill className="object-contain" sizes="40px" />
              </div>
              <span className="text-sm text-white/70">{benefit.text}</span>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-light text-white font-semibold rounded-xl hover:from-keepr-evergreen-light hover:to-keepr-evergreen transition-all shadow-lg shadow-keepr-evergreen/30"
          >
            Claim Your Spot
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 text-white/70 font-semibold border border-white/15 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
          >
            View Pricing
          </a>
        </div>

        {/* Small print */}
        <p className="mt-8 text-sm text-white/60">
          No credit card required. No contracts. We'll import your data from Campspot, Newbook, or
          any system.
        </p>
      </div>
    </section>
  );
}
