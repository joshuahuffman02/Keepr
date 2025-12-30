'use client';

import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { ArrowRight, Play } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-white -z-10" />

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-status-success/15 text-status-success border border-status-success/30">
              <span className="relative flex h-2 w-2 mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success"></span>
              </span>
              Tired of clunky software? There's a better way.
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
              The Modern Alternative to{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                Legacy Reservation Systems
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-slate-600 leading-relaxed">
              Ditch the outdated software, confusing contracts, and nickel-and-dime fees.
              Camp Everyday is built for 2025 — fast, simple, and priced fairly.
            </p>

            {/* Pain Points */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-status-error/15 text-status-error border border-status-error/30">
                <svg className="mr-1.5 w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> No contracts
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-status-error/15 text-status-error border border-status-error/30">
                <svg className="mr-1.5 w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> No setup fees
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-status-error/15 text-status-error border border-status-error/30">
                <svg className="mr-1.5 w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg> No hidden costs
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-status-success/15 text-status-success border border-status-success/30">
                <svg className="mr-1.5 w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Go live in 48 hours
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-lg px-8 py-6 group"
              >
                Get a Free Demo
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 border-2 border-slate-300 hover:border-emerald-600 hover:text-emerald-600 group"
              >
                <Play className="mr-2 h-5 w-5" />
                Watch Video
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center gap-8 pt-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white"
                  />
                ))}
              </div>
              <div className="text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Switching from Campspot or Newbook?</div>
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-emerald-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  <span className="text-slate-600">We migrate your data for free</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Visual/Screenshot */}
          <div className="relative lg:pl-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-white">
              <div className="aspect-[4/3] relative bg-slate-100">
                <Image
                  src="/images/owners/dashboard-preview.png"
                  alt="Camp Everyday Host Dashboard"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* Floating Feature Cards */}
            <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-4 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-status-success/15 flex items-center justify-center">
                  <svg className="h-6 w-6 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">10x faster</div>
                  <div className="text-xs text-slate-600">vs legacy systems</div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-4 border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">50% less</div>
                  <div className="text-xs text-slate-600">than competitors</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
