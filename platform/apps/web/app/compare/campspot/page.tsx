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
  Zap,
  Shield,
  TrendingUp,
  MessageSquare,
  Calendar,
  CreditCard,
  Star,
  Award,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import {
  PRICING,
  COMPETITOR_PAIN_POINTS,
  FEATURE_COMPARISON,
  DIFFERENTIATORS,
  CTA_COPY,
} from "@/lib/positioning";

export const metadata: Metadata = {
  title: "Keepr vs Campspot - Full Feature Comparison 2025",
  description:
    "Compare Keepr to Campspot. No 10% marketplace commission, AI-powered features, loyalty programs, and staff scheduling included. Switch in 48 hours.",
  keywords: [
    "campspot alternative",
    "campspot vs",
    "campspot competitor",
    "campground software comparison",
    "best campspot alternative",
  ],
  openGraph: {
    title: "Keepr vs Campspot - Which is Better for Your Park?",
    description:
      "Comprehensive comparison of Keepr and Campspot. See features, pricing, and what 100+ parks say about switching.",
    type: "website",
  },
};

// Structured data for SEO
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Keepr vs Campspot Comparison",
  description: "A comprehensive comparison of Keepr and Campspot campground management software",
  author: {
    "@type": "Organization",
    name: "Keepr",
  },
};

export default function CompareCampspotPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-keepr-charcoal via-slate-900 to-keepr-charcoal overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-keepr-evergreen/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-clay/20 border border-keepr-clay/30 rounded-full text-keepr-clay text-sm font-semibold mb-8">
              <Sparkles className="h-4 w-4" />
              2025 Comparison Guide
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Keepr vs Campspot
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
              Everything Campspot offers.{" "}
              <span className="text-keepr-evergreen font-semibold">
                Plus loyalty programs, AI, and staff scheduling.
              </span>{" "}
              Without the 10% marketplace commission.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                asChild
                size="lg"
                className="px-8 py-6 text-lg bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-dark hover:from-keepr-evergreen-light hover:to-keepr-evergreen"
              >
                <Link href="/signup">
                  {CTA_COPY.switch.button}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg border-slate-600 text-white hover:bg-slate-800"
              >
                <Link href="#comparison">See Full Comparison</Link>
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              {[
                { value: "0%", label: "Marketplace Commission", note: "vs 10% at Campspot" },
                { value: "$2.30", label: "Per Booking", note: "vs $3+ at Campspot" },
                { value: "48hrs", label: "Go Live Time", note: "Free data migration" },
                { value: "$0", label: "Setup Fee", note: "No contracts" },
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

      {/* Pain Points Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Why Parks Are Switching from Campspot
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              We talked to dozens of park owners. Here's what they told us about their Campspot
              experience.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPETITOR_PAIN_POINTS.campspot.slice(0, 9).map((painPoint, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-slate-700 font-medium">{painPoint}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-600 mb-6">
              Sound familiar? You're not alone. That's why we built something better.
            </p>
            <Button asChild className="bg-keepr-evergreen hover:bg-keepr-evergreen-light">
              <Link href="/signup">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section id="comparison" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Feature-by-Feature Comparison
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              See exactly what you get with Keepr vs Campspot. No hidden features, no surprises.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-lg">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-4 text-slate-600 font-semibold">Feature</th>
                  <th className="p-4 text-center bg-keepr-evergreen/10 border-x border-keepr-evergreen/20">
                    <div className="text-keepr-evergreen font-bold">Keepr</div>
                    <div className="text-xs text-keepr-evergreen/80 mt-1">That's us!</div>
                  </th>
                  <th className="p-4 text-center">
                    <div className="text-slate-700 font-bold">Campspot</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Pricing Rows */}
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td colSpan={3} className="p-4 font-bold text-slate-900">
                    Pricing
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Monthly Base</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">$100/month</span>
                  </td>
                  <td className="p-4 text-center text-slate-600">Varies (opaque)</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Per Booking Fee</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">$2.30</span>
                  </td>
                  <td className="p-4 text-center text-slate-600">$3.00+</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Marketplace Commission</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-bold">0%</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-red-600 font-semibold">10%</span>
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Setup Fee</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">$0</span>
                  </td>
                  <td className="p-4 text-center text-slate-600">$$$</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">AI Credits Included</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">$5/month</span>
                  </td>
                  <td className="p-4 text-center">
                    <X className="h-5 w-5 mx-auto text-slate-400" />
                  </td>
                </tr>

                {/* Feature Categories */}
                {FEATURE_COMPARISON.categories.map((category) => (
                  <>
                    <tr key={category.name} className="border-b border-slate-100 bg-slate-50/50">
                      <td colSpan={3} className="p-4 font-bold text-slate-900">
                        {category.name}
                      </td>
                    </tr>
                    {category.features.map((feature) => (
                      <tr key={feature.name} className="border-b border-slate-100">
                        <td className="p-4 text-slate-700">{feature.name}</td>
                        <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                          {feature.us === true ? (
                            <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                          ) : feature.us === false ? (
                            <X className="h-5 w-5 mx-auto text-slate-400" />
                          ) : (
                            <span className="text-keepr-evergreen">{feature.us}</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {feature.campspot === true ? (
                            <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                          ) : feature.campspot === false ? (
                            <X className="h-5 w-5 mx-auto text-slate-400" />
                          ) : (
                            <span className="text-slate-600">{feature.campspot}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Exclusive Features Section */}
      <section className="py-20 bg-gradient-to-br from-keepr-charcoal to-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-evergreen/20 border border-keepr-evergreen/30 rounded-full text-keepr-evergreen text-sm font-semibold mb-6">
              <Award className="h-4 w-4" />
              Exclusive to Keepr
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Features Campspot Doesn't Offer
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              These aren't coming soon. They're live now.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {DIFFERENTIATORS.exclusive.map((diff) => (
              <div
                key={diff.feature}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8"
              >
                <h3 className="text-xl font-bold text-white mb-2">{diff.feature}</h3>
                <p className="text-slate-300 mb-4">{diff.description}</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-keepr-clay/20 rounded-full">
                  <Star className="h-4 w-4 text-keepr-clay" />
                  <span className="text-sm text-keepr-clay">{diff.competitorStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator Preview */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Calculate Your Savings</h2>
              <p className="text-slate-600">
                See how much you could save by switching from Campspot to Keepr.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div className="text-center p-6 bg-white rounded-xl border border-slate-200">
                <DollarSign className="h-8 w-8 mx-auto text-keepr-evergreen mb-2" />
                <div className="text-2xl font-bold text-slate-900">$0.70</div>
                <div className="text-sm text-slate-600">Saved per booking</div>
                <div className="text-xs text-slate-500 mt-1">($3.00 vs $2.30)</div>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-slate-200">
                <TrendingUp className="h-8 w-8 mx-auto text-keepr-evergreen mb-2" />
                <div className="text-2xl font-bold text-slate-900">10%</div>
                <div className="text-sm text-slate-600">Commission eliminated</div>
                <div className="text-xs text-slate-500 mt-1">Keep more revenue</div>
              </div>
              <div className="text-center p-6 bg-white rounded-xl border border-slate-200">
                <Zap className="h-8 w-8 mx-auto text-keepr-evergreen mb-2" />
                <div className="text-2xl font-bold text-slate-900">$5</div>
                <div className="text-sm text-slate-600">AI credits included</div>
                <div className="text-xs text-slate-500 mt-1">Predict demand, reduce no-shows</div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-slate-600 mb-4">
                <strong>Example:</strong> A park with 300 bookings/month saves{" "}
                <span className="text-keepr-evergreen font-bold">$210/month</span> just on
                per-booking fees, plus keeps an extra{" "}
                <span className="text-keepr-evergreen font-bold">10%</span> of every marketplace
                booking.
              </p>
              <Button
                asChild
                size="lg"
                className="bg-keepr-evergreen hover:bg-keepr-evergreen-light"
              >
                <Link href="/roi-calculator">
                  Calculate Your Exact Savings
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Migration Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Switching is Easier Than You Think
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                We handle the heavy lifting. Export your data from Campspot, and we'll import it for
                you. Most parks go live in 48 hours or less.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Clock, text: "Go live in 48 hours" },
                  { icon: Shield, text: "Free data migration included" },
                  { icon: Users, text: "Dedicated onboarding support" },
                  { icon: CreditCard, text: "No contracts, cancel anytime" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-keepr-evergreen/10">
                      <item.icon className="h-5 w-5 text-keepr-evergreen" />
                    </div>
                    <span className="text-slate-700 font-medium">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-lg">
              <h3 className="text-xl font-bold text-slate-900 mb-6">Migration Timeline</h3>
              <div className="space-y-6">
                {[
                  { day: "Day 1", task: "Export data from Campspot" },
                  { day: "Day 1", task: "We import and configure your account" },
                  { day: "Day 2", task: "Quick training call (30 min)" },
                  { day: "Day 2", task: "Go live and start taking bookings" },
                ].map((step, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 text-sm font-semibold text-keepr-evergreen">
                      {step.day}
                    </div>
                    <div className="flex-1 pb-6 border-b border-slate-100 last:border-0">
                      <p className="text-slate-700">{step.task}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Switch from Campspot?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Join the growing number of parks that made the switch. No contracts, no risk, 30-day
            money-back guarantee.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              asChild
              size="lg"
              className="px-8 py-6 text-lg bg-gradient-to-r from-keepr-evergreen to-keepr-evergreen-dark hover:from-keepr-evergreen-light hover:to-keepr-evergreen"
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
              <Link href="/demo">Try Live Demo</Link>
            </Button>
          </div>

          <p className="text-slate-500 text-sm">
            No credit card required. {CTA_COPY.primary.subtext}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
