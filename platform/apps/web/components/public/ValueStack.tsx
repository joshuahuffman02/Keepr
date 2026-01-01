"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

const pillars = [
  {
    image: "/images/icons/trust-security.png",
    title: "Your Adventure, Protected",
    description: "Bank-level security keeps your payment and personal info safe. Book with complete peace of mind.",
    guarantee: "100% Secure",
  },
  {
    image: "/images/icons/best-price.png",
    title: "No Middleman Magic",
    description: "Book directly with campgrounds. No hidden fees, no markup - just honest pricing for honest adventures.",
    guarantee: "Best Price Promise",
  },
  {
    image: "/images/icons/support.png",
    title: "Real Humans, Real Help",
    description: "Our team of camping enthusiasts is here whenever you need us. Day or night, rain or shine.",
    guarantee: "24/7 Support",
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
            Your Trust is Our Treasure
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Every great adventure begins with peace of mind. Here's how we make
            your journey magical from the very first click.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {pillars.map((pillar, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-6 md:p-8 shadow-lg shadow-slate-900/5 hover:shadow-xl hover:shadow-slate-900/10 transition-all hover:-translate-y-1"
            >
              {/* Icon */}
              <div className="relative w-16 h-16 mb-6">
                <Image
                  src={pillar.image}
                  alt={pillar.title}
                  fill
                  className="object-contain"
                  sizes="64px"
                />
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
          <div className="inline-flex items-center gap-3 bg-emerald-50 text-emerald-700 rounded-full px-5 py-2.5 text-sm font-medium">
            <Image
              src="/images/icons/trust-security.png"
              alt="Security"
              width={24}
              height={24}
              className="object-contain"
            />
            Your satisfaction is our priority
          </div>
        </div>
      </div>
    </section>
  );
}
