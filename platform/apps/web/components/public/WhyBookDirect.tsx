"use client";

import { DollarSign, MessageSquare, Shield, Zap, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

const benefits = [
  {
    icon: MessageSquare,
    title: "Direct Communication",
    description: "Message the park directly with questions before you book. No middleman.",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
  },
  {
    icon: DollarSign,
    title: "Transparent Pricing",
    description: "See the full price upfront. Know exactly what you're paying before you book.",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
  },
  {
    icon: Zap,
    title: "Instant Confirmation",
    description: "Get immediate booking confirmation. No waiting, no uncertainty.",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
  },
  {
    icon: Shield,
    title: "Secure Booking",
    description: "Your payment and personal info are protected with industry-standard security.",
    iconColor: "text-rose-500",
    iconBg: "bg-rose-50",
  },
];

interface WhyBookDirectProps {
  className?: string;
  campgroundName?: string;
  variant?: "full" | "compact";
}

export function WhyBookDirect({
  className,
  campgroundName,
  variant = "full",
}: WhyBookDirectProps) {
  if (variant === "compact") {
    return (
      <div className={cn("bg-emerald-50 rounded-xl p-4", className)}>
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-emerald-600" />
          <h3 className="font-semibold text-emerald-900">Why Book Direct?</h3>
        </div>
        <ul className="space-y-2">
          {benefits.slice(0, 3).map((benefit, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <span>{benefit.title}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <section className={cn("py-12 md:py-16 bg-muted", className)}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-8 md:mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
            Why Book Direct{campgroundName ? ` with ${campgroundName}` : ""}?
          </h2>
          <p className="text-muted-foreground">
            Skip the middleman and enjoy these benefits when you book directly.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, i) => (
            <div key={i} className="bg-card rounded-xl p-6 shadow-sm">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mb-4",
                  benefit.iconBg
                )}
              >
                <benefit.icon className={cn("h-5 w-5", benefit.iconColor)} />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Trust statement */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 inline mr-1 text-emerald-500" />
            Trusted by thousands of campers nationwide
          </p>
        </div>
      </div>
    </section>
  );
}
