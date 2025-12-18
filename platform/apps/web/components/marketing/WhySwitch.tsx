'use client';

import { XCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const painPoints = [
  {
    legacy: "Long-term contracts that lock you in",
    modern: "Month-to-month, cancel anytime",
  },
  {
    legacy: "Hidden fees and surprise charges",
    modern: "Transparent pricing, one simple rate",
  },
  {
    legacy: "Clunky interface from the 2000s",
    modern: "Modern UI built for speed",
  },
  {
    legacy: "Weeks of setup and training",
    modern: "Go live in 48 hours",
  },
  {
    legacy: "Expensive per-booking commissions",
    modern: "Flat fee, you keep more revenue",
  },
  {
    legacy: "Slow support, endless ticket queues",
    modern: "Real humans, same-day responses",
  },
];

export function WhySwitch() {
  return (
    <section className="py-16 md:py-24 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Why Campgrounds Are Switching
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Legacy reservation systems were built for a different era.
            Here's why modern campgrounds choose Camp Everyday.
          </p>
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
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 bg-white rounded-2xl shadow-lg border border-slate-100">
            <div className="text-left">
              <p className="font-semibold text-slate-900">Ready to make the switch?</p>
              <p className="text-sm text-slate-500">We'll migrate your data for free — no disruption to your bookings.</p>
            </div>
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white whitespace-nowrap"
              asChild
            >
              <a href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
