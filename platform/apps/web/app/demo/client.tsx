"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Calendar,
  CreditCard,
  Users,
  BarChart3,
  ShoppingCart,
  Clock,
  Check,
  Sparkles,
  Eye,
  Lock,
  Zap,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";

const demoFeatures = [
  {
    icon: Calendar,
    title: "75 Sites",
    description: "RV, tent, cabin, and glamping sites with realistic availability",
  },
  {
    icon: Users,
    title: "200+ Reservations",
    description: "Historical bookings showing patterns and guest data",
  },
  {
    icon: BarChart3,
    title: "AI Insights",
    description: "Pre-generated demand forecasts and pricing recommendations",
  },
  {
    icon: ShoppingCart,
    title: "POS & Inventory",
    description: "Camp store with products, inventory levels, and sales history",
  },
  {
    icon: Clock,
    title: "Staff Schedules",
    description: "Sample staff roster with shifts and time tracking",
  },
  {
    icon: Star,
    title: "Loyalty Program",
    description: "Guest tiers, XP levels, and reward redemptions",
  },
];

const whatYouCanExplore = [
  "Drag-and-drop reservation calendar",
  "Guest profiles with communication history",
  "Dynamic pricing rules and seasonal rates",
  "AI demand forecasting dashboard",
  "Point of sale and inventory management",
  "Staff scheduling synced with occupancy",
  "Housekeeping and maintenance tracking",
  "Reports and analytics dashboard",
  "Guest portal and self-service check-in",
  "Loyalty program with XP and rewards",
];

export function DemoClient() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [parkName, setParkName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // TODO: Actually create demo tenant and capture lead
    // For now, simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-keepr-charcoal via-slate-900 to-keepr-charcoal overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-keepr-evergreen/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-clay/20 border border-keepr-clay/30 rounded-full text-keepr-clay text-sm font-semibold mb-8">
                <Play className="h-4 w-4" />
                Live Demo Environment
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                See Keepr
                <span className="block text-keepr-evergreen">In Action</span>
              </h1>

              <p className="text-xl text-slate-300 mb-8 leading-relaxed">
                Explore a fully-loaded demo with real data. 75 sites, 200+ reservations, AI insights,
                and every feature you'd use day-to-day. No sales pitch required.
              </p>

              <div className="space-y-4 mb-8">
                {[
                  "Full access to all features",
                  "Pre-loaded with realistic data",
                  "Experiment without breaking anything",
                  "Resets nightly - play freely",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-slate-300">
                    <Check className="h-5 w-5 text-keepr-evergreen" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Lead Capture Form */}
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              {!submitted ? (
                <>
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-keepr-evergreen/10 mb-4">
                      <Zap className="h-8 w-8 text-keepr-evergreen" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      Access the Demo
                    </h2>
                    <p className="text-slate-600">
                      Enter your email to get instant access. We'll send you login credentials.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Sarah Johnson"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-keepr-evergreen focus:border-keepr-evergreen transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        Work Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="hello@keeprstay.com"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-keepr-evergreen focus:border-keepr-evergreen transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="parkName" className="block text-sm font-medium text-slate-700 mb-1">
                        Park/Campground Name (optional)
                      </label>
                      <input
                        type="text"
                        id="parkName"
                        value={parkName}
                        onChange={(e) => setParkName(e.target.value)}
                        placeholder="Mountain View RV Park"
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-keepr-evergreen focus:border-keepr-evergreen transition-colors"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full py-6 text-lg bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-dark hover:from-keepr-evergreen-light hover:to-keepr-evergreen"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Creating Your Demo...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Get Instant Access
                          <ArrowRight className="h-5 w-5" />
                        </span>
                      )}
                    </Button>

                    <p className="text-xs text-slate-500 text-center">
                      No credit card required. Demo resets nightly.
                    </p>
                  </form>

                  <div className="mt-6 pt-6 border-t border-slate-200">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <Eye className="h-4 w-4" />
                      <span>Or</span>
                      <Link href="/demo/preview" className="text-keepr-evergreen hover:text-keepr-evergreen-light font-medium">
                        browse without signing up
                      </Link>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-keepr-evergreen/10 mb-6">
                    <Check className="h-8 w-8 text-keepr-evergreen" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    You're In!
                  </h2>
                  <p className="text-slate-600 mb-6">
                    We've sent login credentials to <strong>{email}</strong>.
                    Check your inbox (and spam folder, just in case).
                  </p>
                  <Button
                    asChild
                    className="w-full py-6 text-lg bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-dark hover:from-keepr-evergreen-light hover:to-keepr-evergreen"
                  >
                    <Link href="/auth/signin?demo=true">
                      Open Demo Now
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <p className="mt-4 text-sm text-slate-500">
                    Demo credentials: <code className="bg-slate-100 px-2 py-1 rounded">demo@keeprstay.com</code>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* What's in the Demo */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              What's in the Demo
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              A realistic campground setup so you can see how Keepr handles real-world scenarios.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {demoFeatures.map((feature) => (
              <div
                key={feature.title}
                className="bg-slate-50 rounded-2xl p-8 border border-slate-200"
              >
                <feature.icon className="h-10 w-10 text-keepr-evergreen mb-4" />
                <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Checklist */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Everything You Can Explore
            </h2>
          </div>

          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            <div className="grid md:grid-cols-2 gap-4">
              {whatYouCanExplore.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Demo Mode Banner */}
      <section className="py-12 bg-keepr-evergreen">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 text-white mb-4">
            <Lock className="h-6 w-6" />
            <span className="text-lg font-semibold">Demo Mode = Safe Mode</span>
          </div>
          <p className="text-keepr-off-white/90 max-w-2xl mx-auto">
            The demo environment is completely sandboxed. Create reservations, modify rates,
            experiment with settings - nothing you do affects real data. The demo resets every night.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Ready to See It for Yourself?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Join hundreds of park owners who've explored the demo before making the switch.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="px-8 py-6 text-lg bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-dark hover:from-keepr-evergreen-light hover:to-keepr-evergreen"
            >
              <a href="#top">
                Get Demo Access
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg"
            >
              <Link href="/signup">Start Free Trial Instead</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
