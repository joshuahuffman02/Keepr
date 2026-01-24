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
  Award,
  Sparkles,
  CreditCard,
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
  title: "Keepr vs Newbook - Full Feature Comparison 2025",
  description:
    "Compare Keepr to Newbook. No $1,000-$3,000 setup fee, faster onboarding, AI features, and simpler pricing. Switch in 48 hours.",
  keywords: [
    "newbook alternative",
    "newbook vs",
    "newbook competitor",
    "campground software comparison",
    "best newbook alternative",
  ],
  openGraph: {
    title: "Keepr vs Newbook - Which is Better for Your Park?",
    description:
      "Comprehensive comparison of Keepr and Newbook. See features, pricing, and why parks are choosing Keepr.",
    type: "website",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Keepr vs Newbook Comparison",
  description: "A comprehensive comparison of Keepr and Newbook campground management software",
  author: {
    "@type": "Organization",
    name: "Keepr",
  },
};

export default function CompareNewbookPage() {
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
              Keepr vs Newbook
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed">
              Enterprise features.{" "}
              <span className="text-keepr-evergreen font-semibold">No $3,000 setup fee.</span> Go
              live in 48 hours, not weeks.
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
                { value: "$0", label: "Setup Fee", note: "vs $1K-$3K at Newbook" },
                { value: "$100", label: "Per Month", note: "vs $150+ at Newbook" },
                { value: "48hrs", label: "Go Live Time", note: "vs weeks at Newbook" },
                { value: "Simple", label: "Pricing", note: "Add-ons clearly priced" },
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
              Why Parks Look for Newbook Alternatives
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Newbook is powerful, but it comes with trade-offs. Here's what we hear from park
              owners.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {COMPETITOR_PAIN_POINTS.newbook.map((painPoint, index) => (
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
              Looking for something simpler? We built Keepr for you.
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
              Keepr matches Newbook's features at a fraction of the cost and complexity.
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
                    <div className="text-slate-700 font-bold">Newbook</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Pricing Rows */}
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <td colSpan={3} className="p-4 font-bold text-slate-900">
                    Pricing & Onboarding
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Setup Fee</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-bold">$0</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-red-600 font-semibold">$1,000 - $3,000</span>
                  </td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Monthly Base</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">$100/month</span>
                  </td>
                  <td className="p-4 text-center text-slate-600">$150+/month</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Time to Go Live</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">48 hours</span>
                  </td>
                  <td className="p-4 text-center text-slate-600">Weeks</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="p-4 text-slate-700">Learning Curve</td>
                  <td className="p-4 text-center bg-keepr-evergreen/5 border-x border-keepr-evergreen/10">
                    <span className="text-keepr-evergreen font-semibold">Simple</span>
                  </td>
                  <td className="p-4 text-center text-slate-600">Complex</td>
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
                          {feature.newbook === true ? (
                            <Check className="h-5 w-5 mx-auto text-keepr-evergreen" />
                          ) : feature.newbook === false ? (
                            <X className="h-5 w-5 mx-auto text-slate-400" />
                          ) : (
                            <span className="text-slate-600">{feature.newbook}</span>
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
              Features Newbook Doesn't Offer
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              AI-powered insights that actually help you make more money.
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
                  <Zap className="h-4 w-4 text-keepr-clay" />
                  <span className="text-sm text-keepr-clay">{diff.competitorStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Setup Fee Comparison */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-slate-50 rounded-3xl p-8 md:p-12 border border-slate-200">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Save $1,000 - $3,000 on Day One
              </h2>
              <p className="text-slate-600">
                Newbook's setup fee could pay for 10-30 months of Keepr service.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div className="text-center p-8 bg-white rounded-xl border border-slate-200">
                <div className="text-sm font-semibold text-slate-500 mb-2">NEWBOOK</div>
                <div className="text-4xl font-bold text-red-600 mb-2">$1,000 - $3,000</div>
                <div className="text-slate-600">Setup fee before you start</div>
                <div className="text-sm text-slate-500 mt-2">+ $150+/month subscription</div>
              </div>
              <div className="text-center p-8 bg-keepr-evergreen/10 rounded-xl border border-keepr-evergreen/20">
                <div className="text-sm font-semibold text-keepr-evergreen mb-2">KEEPR</div>
                <div className="text-4xl font-bold text-keepr-evergreen mb-2">$0</div>
                <div className="text-slate-600">No setup fee, ever</div>
                <div className="text-sm text-slate-500 mt-2">Just $100/month + usage</div>
              </div>
            </div>

            <div className="text-center">
              <Button
                asChild
                size="lg"
                className="bg-keepr-evergreen hover:bg-keepr-evergreen-light"
              >
                <Link href="/signup">
                  Start Without the Big Upfront Cost
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
                Simple Onboarding. No Training Required.
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                Unlike Newbook's complex platform that requires extensive training, Keepr is
                intuitive from day one. Most staff are comfortable within hours, not weeks.
              </p>

              <div className="space-y-4">
                {[
                  { icon: Clock, text: "Go live in 48 hours" },
                  { icon: Shield, text: "Free data migration included" },
                  { icon: Users, text: "Intuitive interface - minimal training" },
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
              <h3 className="text-xl font-bold text-slate-900 mb-6">Newbook vs Keepr Setup</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-semibold text-slate-500">Newbook</div>
                  <div className="flex-1 bg-red-100 rounded-full h-4 relative">
                    <div className="absolute left-0 top-0 h-full w-[80%] bg-red-500 rounded-full" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-red-700">
                      2-4 weeks
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 text-sm font-semibold text-keepr-evergreen">Keepr</div>
                  <div className="flex-1 bg-keepr-evergreen/15 rounded-full h-4 relative">
                    <div className="absolute left-0 top-0 h-full w-[15%] bg-keepr-evergreen rounded-full" />
                    <span className="absolute left-[18%] top-1/2 -translate-y-1/2 text-xs text-keepr-evergreen">
                      48 hours
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready for Simpler, More Affordable Software?
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Get Newbook-level features without the complexity or cost. No contracts, no risk, 30-day
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
