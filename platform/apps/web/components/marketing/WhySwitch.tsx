'use client';

import { XCircle, CheckCircle, ArrowRight, Sparkles, Brain, Calendar, Users, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// Features NO competitor offers
const exclusiveFeatures = [
  {
    name: "Loyalty & Gamification",
    description: "XP system, leveling up, rewards - drive repeat bookings like never before",
    icon: Sparkles,
    color: "purple",
  },
  {
    name: "AI Demand Forecasting",
    description: "Predict busy periods and optimize pricing automatically",
    icon: Brain,
    color: "blue",
  },
  {
    name: "AI No-Show Detection",
    description: "Identify high-risk reservations before they cancel",
    icon: Zap,
    color: "amber",
  },
  {
    name: "Staff Scheduling + Payroll",
    description: "Integrated with reservations and time tracking",
    icon: Calendar,
    color: "emerald",
  },
];

// Pain points comparison
const painPoints = [
  {
    legacy: "10% marketplace commission eats into profits",
    modern: "0% marketplace commission - keep your revenue",
  },
  {
    legacy: "$1,000-$3,000 setup fees",
    modern: "$0 setup fee - start for free",
  },
  {
    legacy: "No loyalty programs or gamification",
    modern: "Built-in loyalty with XP, levels, and rewards",
  },
  {
    legacy: "No AI or demand forecasting",
    modern: "AI-powered pricing and no-show prediction",
  },
  {
    legacy: "No staff scheduling integration",
    modern: "Staff scheduling synced with occupancy",
  },
  {
    legacy: "Weeks of setup and training",
    modern: "Go live in 48 hours",
  },
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
          <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-700 border border-emerald-200 mb-4">
            <Star className="h-4 w-4 mr-2" />
            Features no competitor has
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Why Parks Are Switching to Camp Everyday
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            We built the features campgrounds actually need - ones legacy systems
            like Campspot and Newbook don't offer.
          </p>
        </div>

        {/* Exclusive Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {exclusiveFeatures.map((feature) => {
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
                <div className="mt-3 inline-flex items-center text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  <XCircle className="h-3 w-3 mr-1" />
                  Competitors don't have this
                </div>
              </div>
            );
          })}
        </div>

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Legacy Column */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Legacy Systems</h3>
                <p className="text-sm text-slate-500">Campspot, Newbook, ResNexus...</p>
              </div>
            </div>
            <ul className="space-y-4">
              {painPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-600">{point.legacy}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Modern Column */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border border-emerald-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Camp Everyday</h3>
                <p className="text-sm text-emerald-600">Built for modern campgrounds</p>
              </div>
            </div>
            <ul className="space-y-4">
              {painPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700 font-medium">{point.modern}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-6 p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
            <div className="text-left">
              <p className="font-semibold text-slate-900">Ready to make the switch?</p>
              <p className="text-sm text-slate-500">We'll migrate your data for free. Go live in 48 hours.</p>
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
                <Link href="/switch-from-campspot">
                  Migration Guide
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
