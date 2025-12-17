"use client";

import { DollarSign, Building2, Zap, Camera, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

const pillars = [
  {
    icon: DollarSign,
    title: "No Hidden Fees",
    description: "Zero booking fees, zero service fees. The price you see is the price you pay.",
    guarantee: "Price transparency guaranteed",
    iconBg: "from-emerald-500 to-teal-600",
    iconShadow: "shadow-emerald-500/20",
  },
  {
    icon: Building2,
    title: "Book Direct",
    description: "Skip the middleman. Book directly with the campground for the best experience and rates.",
    guarantee: "Direct from the park",
    iconBg: "from-violet-500 to-purple-600",
    iconShadow: "shadow-violet-500/20",
  },
  {
    icon: Zap,
    title: "Instant Confirmation",
    description: "Know you're booked in seconds. Real-time availability means no waiting, no uncertainty.",
    guarantee: "Confirmed immediately",
    iconBg: "from-amber-500 to-orange-600",
    iconShadow: "shadow-amber-500/20",
  },
  {
    icon: Camera,
    title: "Verified Quality",
    description: "Real photos, real reviews, real availability. What you see is what you get when you arrive.",
    guarantee: "No surprises",
    iconBg: "from-rose-500 to-pink-600",
    iconShadow: "shadow-rose-500/20",
  },
];

interface ValueStackProps {
  className?: string;
}

export function ValueStack({ className }: ValueStackProps) {
  return (
    <section className={cn("py-16 md:py-20 bg-slate-50", className)}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            Why Book With Camp Everyday?
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            We partner directly with campgrounds to bring you the best experience.
            No middleman markup, no hidden fees, just great camping.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {pillars.map((pillar, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 md:p-8 shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 transition-shadow"
            >
              {/* Icon */}
              <div
                className={cn(
                  "w-14 h-14 rounded-xl flex items-center justify-center mb-6 shadow-lg bg-gradient-to-br",
                  pillar.iconBg,
                  pillar.iconShadow
                )}
              >
                <pillar.icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-slate-900 mb-3">{pillar.title}</h3>
              <p className="text-slate-600 mb-4">{pillar.description}</p>

              {/* Guarantee badge */}
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">{pillar.guarantee}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Additional trust statement */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-full px-4 py-2 text-sm font-medium">
            <Shield className="h-4 w-4" />
            Your satisfaction is our priority
          </div>
        </div>
      </div>
    </section>
  );
}
