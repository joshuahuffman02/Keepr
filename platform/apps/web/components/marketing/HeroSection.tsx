'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Play, Sparkles, Users, Calendar, Brain } from 'lucide-react';

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
            <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Sparkles className="h-4 w-4 mr-2" />
              The all-in-one platform for modern campgrounds
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Run your campground{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                smarter, not harder
              </span>
            </h1>

            {/* Subheadline - Value Proposition */}
            <p className="text-xl text-muted-foreground leading-relaxed">
              The modern reservation system with AI-powered insights, guest loyalty programs,
              and integrated staff scheduling.
              <span className="font-semibold text-foreground"> $100/month flat</span> + $2.30/booking.
              No contracts. Go live in 48 hours.
            </p>

            {/* Key Features */}
            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-3 rounded-xl bg-card border border-border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-xs font-semibold text-foreground">Loyalty & XP</span>
                <span className="text-xs text-muted-foreground">Keep guests coming back</span>
              </div>
              <div className="flex flex-col items-center text-center p-3 rounded-xl bg-card border border-border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                </div>
                <span className="text-xs font-semibold text-foreground">AI Forecasting</span>
                <span className="text-xs text-muted-foreground">Predict demand & pricing</span>
              </div>
              <div className="flex flex-col items-center text-center p-3 rounded-xl bg-card border border-border shadow-sm">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-foreground">Staff Scheduling</span>
                <span className="text-xs text-muted-foreground">Synced with occupancy</span>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <svg className="mr-1.5 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                30-day money-back guarantee
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <svg className="mr-1.5 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                No contracts, cancel anytime
              </span>
              <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                <svg className="mr-1.5 w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Go live in 48 hours
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-lg px-8 py-6 group"
                asChild
              >
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-base px-6 py-5 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 group"
                asChild
              >
                <Link href="/demo">
                  <Play className="mr-2 h-4 w-4" />
                  Watch Demo
                </Link>
              </Button>
            </div>

            {/* Migration CTA */}
            <div className="flex items-center gap-4 pt-2">
              <div className="text-sm text-muted-foreground">
                Switching from another system? <Link href="/pricing#add-ons" className="font-semibold text-emerald-600 hover:text-emerald-700">Data import services available.</Link>
              </div>
            </div>
          </div>

          {/* Right Column - Visual/Screenshot */}
          <div className="relative lg:pl-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-8 border-white">
              <div className="aspect-[4/3] relative bg-muted">
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
            <div className="absolute -bottom-4 -left-4 bg-card rounded-xl shadow-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-status-success/15 flex items-center justify-center">
                  <svg className="h-6 w-6 text-status-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">48 hours</div>
                  <div className="text-xs text-muted-foreground">to go live</div>
                </div>
              </div>
            </div>

            <div className="absolute -top-4 -right-4 bg-card rounded-xl shadow-lg p-4 border border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center">
                  <svg className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">$100/mo</div>
                  <div className="text-xs text-muted-foreground">transparent pricing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
