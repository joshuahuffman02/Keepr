import { Metadata } from "next";
import Link from "next/link";
import {
  Check,
  X,
  ArrowRight,
  AlertTriangle,
  Building2,
  Zap,
  Shield,
  Award,
  Sparkles,
  Users,
  Clock,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import {
  COMPETITOR_PAIN_POINTS,
  FEATURE_COMPARISON,
  DIFFERENTIATORS,
  CTA_COPY,
} from "@/lib/positioning";

export const metadata: Metadata = {
  title: "Keepr vs CampLife - Full Feature Comparison 2025",
  description:
    "Compare Keepr to CampLife. Multi-property support, AI features, loyalty programs, and transparent pricing. See why growing parks choose Keepr.",
  keywords: [
    "camplife alternative",
    "camplife vs",
    "camplife competitor",
    "campground software comparison",
    "best camplife alternative",
  ],
  openGraph: {
    title: "Keepr vs CampLife - Which is Better for Your Park?",
    description:
      "Comprehensive comparison of Keepr and CampLife. See features, pricing, and why parks are choosing Keepr.",
    type: "website",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Keepr vs CampLife Comparison",
  description: "A comprehensive comparison of Keepr and CampLife campground management software",
  author: {
    "@type": "Organization",
    name: "Keepr",
  },
};

export default function CompareCamplifePage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />

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
              Keepr vs CampLife
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
              CampLife simplicity.{" "}
              <span className="text-keepr-evergreen font-semibold">
                Enterprise features.
              </span>{" "}
              Multi-property support and AI included.
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
                { value: "Multi", label: "Property Support", note: "CampLife: Single only" },
                { value: "$100", label: "Per Month", note: "Transparent pricing" },
                { value: "AI", label: "Features Included", note: "Demand forecasting + more" },
                { value: "Loyalty", label: "Program Built-in", note: "CampLife lacks this" },
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
              What CampLife Users Are Missing
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              CampLife works well for small, single-location parks. But as you grow, you'll hit these walls.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {COMPETITOR_PAIN_POINTS.camplife.map((painPoint, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="text-slate-700 font-medium">{painPoint}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-600 mb-6">
              Ready to grow beyond CampLife's limitations?
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
              Keepr has everything CampLife offers, plus advanced features for growing operations.
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
                    <div className="text-slate-700 font-bold">CampLife</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Scalability Rows */}
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td colSpan={3} className="p-4 font-bold text-slate-900">
                    Scalability
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Multi-Property Support</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                  </td>
                  <td className="p-4 text-center">
                    <X className="h-5 w-5 mx-auto text-red-400" />
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Portfolio Analytics</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                  </td>
                  <td className="p-4 text-center">
                    <X className="h-5 w-5 mx-auto text-slate-400" />
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Central Rate Push</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                  </td>
                  <td className="p-4 text-center">
                    <X className="h-5 w-5 mx-auto text-slate-400" />
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Transparent Pricing</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">$100/mo + $2.30/booking</span>
                    <span className="block text-xs text-keepr-evergreen/80">
                      SMS at cost. AI beyond included credits billed separately.
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-600">Undisclosed (demo required)</td>
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
                          {feature.camplife === true ? (
                            <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                          ) : feature.camplife === false ? (
                            <X className="h-5 w-5 mx-auto text-slate-400" />
                          ) : (
                            <span className="text-slate-600">{feature.camplife}</span>
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

      {/* Growth Features Section */}
      <section className="py-20 bg-gradient-to-br from-keepr-charcoal to-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-keepr-evergreen/20 border border-keepr-evergreen/30 rounded-full text-keepr-evergreen text-sm font-semibold mb-6">
              <TrendingUp className="h-4 w-4" />
              Built for Growth
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Features You'll Need as You Scale
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Don't outgrow your software. Keepr scales with you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Building2,
                title: "Multi-Property Management",
                description: "Manage multiple campgrounds from one dashboard. Share rates, staff, and insights across locations.",
              },
              {
                icon: Users,
                title: "Loyalty & Gamification",
                description: "Built-in XP system and rewards program. Turn one-time guests into repeat visitors.",
              },
              {
                icon: Zap,
                title: "AI Demand Forecasting",
                description: "Predict busy periods and optimize pricing automatically. $5/month AI credits included.",
              },
              {
                icon: Award,
                title: "Staff Scheduling + Payroll",
                description: "Integrated scheduling that syncs with reservations. Time tracking and payroll built-in.",
              },
              {
                icon: Shield,
                title: "Advanced Analytics",
                description: "A/B testing, anomaly detection, and rate parity monitoring across all properties.",
              },
              {
                icon: Clock,
                title: "Workflow Automation",
                description: "Automate emails, tasks, and notifications. Reduce manual work by hours per week.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8"
              >
                <feature.icon className="h-10 w-10 text-keepr-evergreen mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Transparency */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Transparent Pricing. No Demo Required.
              </h2>
              <p className="text-slate-600">
                CampLife requires a demo just to see pricing. Keepr publishes its base pricing up front, with usage-based add-ons billed separately.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="text-center p-8 bg-white rounded-xl border border-slate-200">
                <div className="text-sm font-semibold text-slate-500 mb-2">CAMPLIFE</div>
                <div className="text-4xl font-bold text-slate-400 mb-2">Pricing hidden</div>
                <div className="text-slate-600">"Contact us for pricing"</div>
                <div className="text-sm text-slate-500 mt-2">Demo required</div>
              </div>
              <div className="text-center p-8 bg-keepr-evergreen/10 rounded-xl border border-keepr-evergreen/20">
                <div className="text-sm font-semibold text-keepr-evergreen mb-2">KEEPR</div>
                <div className="text-4xl font-bold text-keepr-evergreen mb-2">$100/mo</div>
                <div className="text-slate-600">+ $2.30 per booking</div>
                <div className="text-sm text-keepr-evergreen mt-2">$5/mo AI credits included</div>
                <div className="text-xs text-slate-500 mt-2">SMS at cost · AI overage billed separately</div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-slate-600 mb-4">
                Transparent base pricing with usage-based add-ons billed separately.
              </p>
              <Button asChild size="lg" className="bg-keepr-evergreen hover:bg-keepr-evergreen-light">
                <Link href="/pricing">
                  See Full Pricing Details
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
                Easy Migration from CampLife
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                We make switching simple. Export your data from CampLife, and we'll handle the rest.
                Keep your guest history, reservations, and settings.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Clock, text: "Go live in 48 hours" },
                  { icon: Shield, text: "Free data migration included" },
                  { icon: Users, text: "Keep all guest history and preferences" },
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
              <h3 className="text-xl font-bold text-slate-900 mb-6">What Gets Migrated</h3>
              <div className="space-y-4">
                {[
                  "Guest profiles and contact info",
                  "Reservation history",
                  "Site configurations",
                  "Rate structures",
                  "Policy settings",
                  "Email templates",
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-keepr-evergreen" />
                    <span className="text-slate-700">{item}</span>
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
            Ready to Outgrow CampLife?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Get the features you need to scale. No contracts, no risk, 30-day money-back guarantee.
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
