'use client';

import { CheckCircle, ArrowRight, Sparkles, Brain, Calendar, Clock, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Core platform features
const coreFeatures = [
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

// What you get with Camp Everyday
const benefits = [
  "0% marketplace commission - keep 100% of your booking revenue",
  "$0 setup fee - start using the platform immediately",
  "Built-in loyalty program with XP, levels, and rewards",
  "AI-powered demand forecasting and pricing insights",
  "Staff scheduling synced with your occupancy",
  "Go live in 48 hours with free data migration",
];

const colorClasses = {
  purple: { bg: "bg-purple-100", icon: "text-purple-600", border: "border-purple-200" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600", border: "border-blue-200" },
  amber: { bg: "bg-amber-100", icon: "text-amber-600", border: "border-amber-200" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", border: "border-emerald-200" },
};

export function WhySwitch() {
  return (
    <section className="py-16 md:py-24 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Why Campgrounds Choose Camp Everyday
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We built the platform we wished existed - modern, powerful, and designed
            specifically for campground operations.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {coreFeatures.map((feature) => {
            const Icon = feature.icon;
            const colors = colorClasses[feature.color as keyof typeof colorClasses];
            return (
              <div
                key={feature.name}
                className={`bg-white rounded-2xl p-6 border-2 ${colors.border} hover:shadow-lg transition-shadow`}
              >
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg} mb-4`}>
                  <Icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{feature.name}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* Benefits List */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">What You Get</h3>
                <p className="text-sm text-emerald-600">Everything you need to run your park</p>
              </div>
            </div>
            <ul className="grid md:grid-cols-2 gap-4">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
            <div className="text-left">
              <p className="font-semibold text-slate-900">Ready to get started?</p>
              <p className="text-sm text-slate-500">Try the live demo or calculate your potential savings.</p>
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white whitespace-nowrap"
                asChild
              >
                <Link href="/demo">
                  Try Live Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="whitespace-nowrap"
                asChild
              >
                <Link href="/roi-calculator">
                  ROI Calculator
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
