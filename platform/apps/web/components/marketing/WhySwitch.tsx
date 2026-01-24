"use client";

import {
  CheckCircle,
  ArrowRight,
  Sparkles,
  Brain,
  Calendar,
  Clock,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Core platform features
type FeatureColor = "purple" | "blue" | "amber" | "emerald";

const coreFeatures: Array<{
  name: string;
  description: string;
  icon: LucideIcon;
  color: FeatureColor;
}> = [
  {
    name: "Loyalty & Gamification",
    description: "XP system, leveling up, rewards - keep guests coming back year after year",
    icon: Sparkles,
    color: "purple",
  },
  {
    name: "AI-Powered Insights",
    description: "Demand forecasting and no-show prediction to optimize your operations",
    icon: Brain,
    color: "blue",
  },
  {
    name: "Staff Scheduling",
    description: "Schedule staff based on occupancy with integrated time tracking",
    icon: Calendar,
    color: "emerald",
  },
  {
    name: "Lightning Fast",
    description: "Modern interface built for speed - no more waiting on slow software",
    icon: Zap,
    color: "amber",
  },
];

// What you get with Keepr
const benefits = [
  "0% marketplace commission - keep 100% of your booking revenue",
  "DIY setup is free - optional assistance available",
  "Built-in loyalty program with XP, levels, and rewards",
  "AI-powered demand forecasting and pricing insights",
  "Staff scheduling synced with your occupancy",
  "Go live in 48 hours with our setup guides",
];

const colorClasses: Record<FeatureColor, { bg: string; icon: string; border: string }> = {
  purple: {
    bg: "bg-keepr-evergreen/10",
    icon: "text-keepr-evergreen",
    border: "border-keepr-evergreen/20",
  },
  blue: {
    bg: "bg-keepr-evergreen/10",
    icon: "text-keepr-evergreen",
    border: "border-keepr-evergreen/20",
  },
  amber: { bg: "bg-keepr-clay/10", icon: "text-keepr-clay", border: "border-keepr-clay/20" },
  emerald: {
    bg: "bg-keepr-evergreen/10",
    icon: "text-keepr-evergreen",
    border: "border-keepr-evergreen/20",
  },
};

export function WhySwitch() {
  return (
    <section className="py-16 md:py-24 bg-muted">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Why Campgrounds Choose Keepr
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We built the platform we wished existed - modern, powerful, and designed specifically
            for campground operations.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {coreFeatures.map((feature) => {
            const Icon = feature.icon;
            const colors = colorClasses[feature.color];
            return (
              <div
                key={feature.name}
                className={`bg-card rounded-2xl p-6 border-2 ${colors.border} hover:shadow-lg transition-shadow`}
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg} mb-4`}
                >
                  <Icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <h3 className="font-bold text-foreground mb-2">{feature.name}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Benefits List */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-gradient-to-br from-keepr-evergreen/10 to-keepr-clay/10 rounded-2xl p-8 border border-keepr-evergreen/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-keepr-evergreen/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-keepr-evergreen" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">What You Get</h3>
                <p className="text-sm text-keepr-evergreen/80">
                  Everything you need to run your park
                </p>
              </div>
            </div>
            <ul className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-keepr-clay mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 p-6 bg-card rounded-2xl shadow-lg border border-border">
            <div className="text-left">
              <p className="font-semibold text-foreground">Ready to get started?</p>
              <p className="text-sm text-muted-foreground">
                Try the live demo or calculate your potential savings.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                className="bg-keepr-evergreen hover:bg-keepr-evergreen-light text-white whitespace-nowrap"
                asChild
              >
                <Link href="/demo">
                  Try Live Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="whitespace-nowrap" asChild>
                <Link href="/roi-calculator">ROI Calculator</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
