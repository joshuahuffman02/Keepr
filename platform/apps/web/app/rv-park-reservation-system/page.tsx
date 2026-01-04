import { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  ArrowRight,
  Calendar,
  CreditCard,
  Users,
  BarChart3,
  Zap,
  Shield,
  Clock,
  Star,
  Sparkles,
  Award,
  Truck,
  Plug,
  Gauge,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PRICING, PROOF_POINTS, CTA_COPY, DIFFERENTIATORS } from "@/lib/positioning";

export const metadata: Metadata = {
  title: "RV Park Reservation System | Keepr - Online Booking for RV Parks",
  description:
    "Complete RV park reservation system with hookup management, utility metering, long-term booking support, and online reservations. Go live in 48 hours. $100/mo.",
  keywords: [
    "rv park reservation system",
    "rv park software",
    "rv park booking system",
    "rv park management software",
    "rv campground software",
    "rv park online booking",
  ],
  openGraph: {
    title: "RV Park Reservation System - Built for Modern RV Parks",
    description:
      "Complete reservation system with hookup management, utility metering, and online booking. No setup fees, go live in 48 hours.",
    type: "website",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Keepr - RV Park Reservation System",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "Complete RV park reservation system with hookup management, utility metering, and online booking.",
  offers: {
    "@type": "Offer",
    price: "100",
    priceCurrency: "USD",
  },
};

const rvSpecificFeatures = [
  {
    title: "Hookup Management",
    icon: Plug,
    description: "Track 30/50 amp, water, sewer, and cable hookups per site. Guests see availability at booking.",
    features: [
      "30/50 amp electrical tracking",
      "Water/sewer hookup status",
      "Cable/WiFi per site",
      "Pull-through vs back-in",
    ],
  },
  {
    title: "Utility Metering",
    icon: Gauge,
    description: "Built-in utility billing for electric, water, and propane. Bill guests fairly for what they use.",
    features: [
      "Electric meter readings",
      "Water usage tracking",
      "Propane fill-ups",
      "Automatic billing",
    ],
  },
  {
    title: "RV Size Filtering",
    icon: Truck,
    description: "Guests can filter by rig size, ensuring they only see sites that fit their RV.",
    features: [
      "Length/width restrictions",
      "Slide-out requirements",
      "Big rig friendly flags",
      "Auto-match to sites",
    ],
  },
  {
    title: "Long-Term Stays",
    icon: Calendar,
    description: "Monthly and seasonal rates with recurring billing. Perfect for snowbirds and workampers.",
    features: [
      "Monthly rate cards",
      "Seasonal contracts",
      "Recurring billing",
      "Workamper programs",
    ],
  },
];

export default function RvParkReservationSystemPage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-sm font-semibold mb-8">
              <Truck className="h-4 w-4" />
              Built Specifically for RV Parks
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              RV Park Reservation System
              <span className="block text-blue-400">With Hookup Management Built In</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed max-w-3xl mx-auto">
              Online booking, utility metering, long-term stay management, and AI demand forecasting.
              Everything your RV park needs in one platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                asChild
                size="lg"
                className="px-8 py-6 text-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400"
              >
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg border-slate-600 text-white hover:bg-slate-800"
              >
                <Link href="/demo">See RV Features Demo</Link>
              </Button>
            </div>

            {/* RV-Specific Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { value: "30/50", label: "Amp Tracking", note: "Per site hookup status" },
                { value: "Utility", label: "Metering", note: "Bill for actual usage" },
                { value: "Long-Term", label: "Stays", note: "Monthly & seasonal" },
                { value: "48hrs", label: "Go Live", note: "Free data migration" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-blue-400">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-300 font-medium">{stat.label}</div>
                  <div className="text-xs text-slate-500">{stat.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Banner */}
      <section className="py-8 bg-blue-600">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-white text-center">
            <span className="text-lg font-semibold">Simple Pricing:</span>
            <span className="text-2xl font-bold">${PRICING.standard.monthlyBase}/month</span>
            <span className="text-blue-200">+</span>
            <span className="text-2xl font-bold">${PRICING.standard.perBooking}/booking</span>
            <span className="text-blue-200">|</span>
            <span>Utility metering included</span>
          </div>
        </div>
      </section>

      {/* RV-Specific Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Features Built for RV Parks
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Not just generic campground software. Keepr understands what RV parks actually need.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {rvSpecificFeatures.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-blue-100">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-slate-600 mb-4">{feature.description}</p>
                    <ul className="grid grid-cols-2 gap-2">
                      {feature.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                          <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Online Booking Flow */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Online Booking That RVers Love
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Guests can book 24/7, filtering by hookup type, RV size, and amenities. No phone tag required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Search & Filter",
                description: "Guests enter dates and RV size. They see only sites that fit their rig with the hookups they need.",
              },
              {
                step: "2",
                title: "Pick Their Site",
                description: "Interactive map shows available sites. Pull-through, back-in, shaded, pet-friendly - all visible.",
              },
              {
                step: "3",
                title: "Book & Pay",
                description: "Secure checkout with deposit options. Confirmation email with check-in instructions sent automatically.",
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl p-8 border border-slate-200 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All-in-One Platform */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              More Than Just Reservations
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Keepr handles everything else too - POS, staff scheduling, and AI-powered insights.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: CreditCard, title: "POS System", desc: "Camp store sales, inventory, offline mode" },
              { icon: Users, title: "Loyalty Program", desc: "Built-in rewards for repeat guests" },
              { icon: BarChart3, title: "AI Forecasting", desc: "Predict demand and optimize rates" },
              { icon: Calendar, title: "Staff Scheduling", desc: "Sync schedules with occupancy" },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-slate-50 rounded-xl p-6 border border-slate-200 text-center"
              >
                <item.icon className="h-8 w-8 mx-auto text-blue-600 mb-3" />
                <h3 className="font-bold text-slate-900 mb-1">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitor Comparison */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Compare to Other RV Park Software
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                competitor: "Campspot",
                issue: "10% marketplace fee",
                solution: "0% commission",
                link: "/compare/campspot",
              },
              {
                competitor: "Newbook",
                issue: "$3K setup fee",
                solution: "$0 to start",
                link: "/compare/newbook",
              },
              {
                competitor: "CampLife",
                issue: "Single park only",
                solution: "Multi-property ready",
                link: "/compare/camplife",
              },
            ].map((item) => (
              <Link
                key={item.competitor}
                href={item.link}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-xl font-bold text-white mb-4">vs {item.competitor}</h3>
                <div className="space-y-2 mb-6 text-sm">
                  <div className="text-red-400">Their issue: {item.issue}</div>
                  <div className="text-blue-400">Our solution: {item.solution}</div>
                </div>
                <span className="text-blue-400 font-semibold flex items-center gap-2">
                  Full comparison <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-blue-50 rounded-3xl p-8 md:p-12 border border-blue-100 text-center">
            <div className="flex justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-6 w-6 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="text-2xl text-slate-700 mb-6 italic">
              "The utility metering alone saves us hours every week. No more manual meter readings and calculations."
            </blockquote>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-900">Mike T.</span>
              <span className="mx-2">|</span>
              <span>Manager, Riverside RV Resort</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-blue-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Upgrade Your RV Park?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join RV parks across the country using Keepr for reservations, utility billing, and more.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              asChild
              size="lg"
              className="px-8 py-6 text-lg bg-white text-blue-700 hover:bg-blue-50"
            >
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-white/30 text-white hover:bg-white/10"
            >
              <Link href="/demo">Try Live Demo</Link>
            </Button>
          </div>

          <p className="text-blue-200 text-sm">
            No credit card required. {CTA_COPY.primary.subtext}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-400 text-sm">
              Keepr - RV park reservation system built for modern parks.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/campground-management-software" className="hover:text-white">Campground Software</Link>
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
              <Link href="/demo" className="hover:text-white">Demo</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
