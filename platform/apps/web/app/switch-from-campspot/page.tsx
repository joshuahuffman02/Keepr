import { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  DollarSign,
  Clock,
  Users,
  Shield,
  Star,
  Sparkles,
  Gift,
  Zap,
  Phone,
  Mail,
  Calendar,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { PRICING, COMPETITOR_PAIN_POINTS, CTA_COPY } from "@/lib/positioning";

export const metadata: Metadata = {
  title: "Switch from Campspot to Keepr | Free Migration in 48 Hours",
  description:
    "Tired of Campspot's 10% commission and rising fees? Switch to Keepr with free data migration. Keep all your features, lose the hidden costs. Go live in 48 hours.",
  keywords: [
    "switch from campspot",
    "campspot alternative",
    "campspot migration",
    "leave campspot",
    "campspot replacement",
  ],
  openGraph: {
    title: "Switch from Campspot - Free Migration, Better Features, Lower Costs",
    description:
      "Free data migration from Campspot. Go live in 48 hours. No 10% marketplace fee. Everything you love about Campspot, none of what you don't.",
    type: "website",
  },
};

const migrationSteps = [
  {
    day: "Day 1",
    title: "Export Your Data",
    description: "We'll guide you through exporting your reservations, guests, and settings from Campspot. Takes about 30 minutes.",
    icon: Database,
  },
  {
    day: "Day 1",
    title: "We Import & Configure",
    description: "Our team imports your data and configures your account to match your current setup. No work for you.",
    icon: Zap,
  },
  {
    day: "Day 2",
    title: "Quick Training Call",
    description: "30-minute call to walk through Keepr. Your team will be comfortable immediately - it's intuitive.",
    icon: Phone,
  },
  {
    day: "Day 2",
    title: "Go Live",
    description: "Switch your booking engine and start taking reservations. We're on standby for any questions.",
    icon: Calendar,
  },
];

const whatYouKeep = [
  "All guest profiles and contact info",
  "Reservation history",
  "Site configurations",
  "Rate structures and seasonal pricing",
  "Cancellation and deposit policies",
  "Email templates",
  "Payment methods on file",
];

const whatYouGain = [
  "0% marketplace commission (vs Campspot's 10%)",
  "Lower per-booking fee ($2.30 vs $3.00+)",
  "Built-in loyalty program",
  "AI demand forecasting",
  "Staff scheduling & payroll",
  "No forced Campspot branding",
  "Dedicated support during peak season",
];

const whatYouLose = [
  "The 10% marketplace commission",
  "Unpredictable pricing",
  "Campspot's branding on your booking engine",
  "Limited automation options",
  "Slow support during peak season",
];

export default function SwitchFromCampspotPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 bg-gradient-to-br from-keepr-charcoal via-slate-900 to-keepr-charcoal overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-keepr-evergreen/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-clay/20 border border-keepr-clay/30 rounded-full text-keepr-clay text-sm font-semibold mb-8">
              <Gift className="h-4 w-4" />
              Free Migration - Limited Time
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Switch from Campspot
              <span className="block text-keepr-evergreen">Keep Everything. Lose the Fees.</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed max-w-3xl mx-auto">
              Tired of the 10% marketplace commission? We'll migrate your data for free and have you
              live in 48 hours. Same features you rely on, none of the hidden costs.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                asChild
                size="lg"
                className="px-8 py-6 text-lg bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-dark hover:from-keepr-evergreen-light hover:to-keepr-evergreen"
              >
                <Link href="/signup">
                  Start Free Migration
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg border-slate-600 text-white hover:bg-slate-800"
              >
                <Link href="/compare/campspot">See Full Comparison</Link>
              </Button>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { value: "0%", label: "Commission", note: "vs 10% at Campspot" },
                { value: "$2.30", label: "Per Booking", note: "vs $3+ at Campspot" },
                { value: "48hrs", label: "Migration Time", note: "Free data transfer" },
                { value: "$0", label: "Migration Fee", note: "We handle everything" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-keepr-evergreen">
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

      {/* Why Parks Leave Campspot */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Why Parks Are Leaving Campspot
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Sound familiar? Here's what we hear from park owners switching to Keepr.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPETITOR_PAIN_POINTS.campspot.slice(0, 9).map((painPoint, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="text-slate-700">{painPoint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Migration Timeline */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-evergreen/10 border border-keepr-evergreen/20 rounded-full text-keepr-evergreen text-sm font-semibold mb-6">
              <Clock className="h-4 w-4" />
              48-Hour Migration
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How the Switch Works
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              We handle the heavy lifting. You'll be live in 48 hours with all your data intact.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {migrationSteps.map((step, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-keepr-evergreen/10 text-keepr-evergreen text-sm font-semibold rounded-full">
                      {step.day}
                    </span>
                  </div>
                  <step.icon className="h-8 w-8 text-keepr-evergreen mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-600 text-sm">{step.description}</p>
                </div>
                {index < migrationSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-keepr-evergreen/20" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Keep / Gain / Lose */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              The Full Picture
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Here's exactly what happens when you switch from Campspot.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* What You Keep */}
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-keepr-evergreen/20">
                  <Shield className="h-6 w-6 text-keepr-evergreen" />
                </div>
                <h3 className="text-xl font-bold text-white">What You Keep</h3>
              </div>
              <ul className="space-y-3">
                {whatYouKeep.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What You Gain */}
            <div className="bg-keepr-evergreen/10 backdrop-blur border border-keepr-evergreen/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-keepr-evergreen/20">
                  <Sparkles className="h-6 w-6 text-keepr-evergreen" />
                </div>
                <h3 className="text-xl font-bold text-white">What You Gain</h3>
              </div>
              <ul className="space-y-3">
                {whatYouGain.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-keepr-evergreen flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What You Lose */}
            <div className="bg-red-500/10 backdrop-blur border border-red-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <X className="h-6 w-6 text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-white">What You Lose</h3>
              </div>
              <ul className="space-y-3">
                {whatYouLose.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <X className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300 line-through opacity-70">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Example */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-keepr-evergreen/10 rounded-3xl p-8 md:p-12 border border-keepr-evergreen/20">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Calculate Your Savings
              </h2>
              <p className="text-slate-600">
                Here's what a typical park saves by switching from Campspot.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-keepr-evergreen/20 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Example: Park with 300 bookings/month at $75 avg
              </h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-slate-600">Per-booking savings ($3.00 vs $2.30)</span>
                  <span className="text-keepr-evergreen font-bold">+$210/month</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-slate-600">10% marketplace commission eliminated</span>
                  <span className="text-keepr-evergreen font-bold">+$2,250/month*</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-slate-600">AI no-show reduction (est. 10%)</span>
                  <span className="text-keepr-evergreen font-bold">+$225/month</span>
                </div>
                <div className="flex justify-between items-center py-3 border-t-2 border-keepr-evergreen/20">
                  <span className="text-slate-900 font-bold text-lg">Potential Annual Savings</span>
                  <span className="text-keepr-evergreen font-bold text-2xl">$32,000+</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-4">
                *If 100% of bookings currently come through Campspot marketplace. Actual savings vary.
              </p>
            </div>

            <div className="text-center">
              <Button asChild size="lg" className="bg-keepr-evergreen hover:bg-keepr-evergreen-light">
                <Link href="/roi-calculator">
                  Calculate Your Exact Savings
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-lg text-center">
            <div className="flex justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-6 w-6 fill-keepr-clay text-keepr-clay" />
              ))}
            </div>
            <blockquote className="text-2xl text-slate-700 mb-6 italic">
              "We were nervous about switching after 3 years on Campspot. The migration took exactly 2 days, and the 10% we were paying in marketplace fees? Gone. Wish we'd done it sooner."
            </blockquote>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-900">Jennifer R.</span>
              <span className="mx-2">|</span>
              <span>Owner, Lakeside Family Campground</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-keepr-evergreen to-keepr-evergreen-dark">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Leave Campspot Behind?
          </h2>
          <p className="text-xl text-keepr-off-white/90 mb-8 max-w-2xl mx-auto">
            Free migration, 48-hour go-live, 30-day money-back guarantee. No risk, just better software.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              asChild
              size="lg"
              className="px-8 py-6 text-lg bg-white text-keepr-evergreen hover:bg-keepr-off-white"
            >
              <Link href="/signup">
                Start Free Migration
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg border-white/30 text-white hover:bg-white/10"
            >
              <Link href="/demo">Try Demo First</Link>
            </Button>
          </div>

          <p className="text-keepr-off-white/70 text-sm">
            Questions? Email us at{" "}
            <a href="mailto:switch@keeprstay.com" className="underline">
              switch@keeprstay.com
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
