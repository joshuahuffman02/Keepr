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
  MessageSquare,
  Tent,
  Building2,
  Sparkles,
  Gift,
  Award,
  TrendingUp,
  Wrench,
  ShoppingCart,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PRICING, PROOF_POINTS, CTA_COPY, DIFFERENTIATORS } from "@/lib/positioning";
import { FAQJsonLd } from "@/components/seo";

const softwareFaqs = [
  {
    question: "What types of campgrounds can use Camp Everyday?",
    answer: "Camp Everyday works for all types of outdoor hospitality: RV parks, tent campgrounds, cabin rentals, glamping sites, yurts, treehouses, and mixed-use properties. Our flexible site class system lets you manage any combination of accommodations.",
  },
  {
    question: "How is Camp Everyday different from Campspot or Newbook?",
    answer: "Unlike Campspot, we charge zero commission on bookings (just a flat $2.30 per reservation). Unlike Newbook, there are no setup fees or long implementation times. We offer features most competitors lack: AI demand forecasting, built-in loyalty programs, and integrated staff scheduling.",
  },
  {
    question: "Can I manage multiple campground properties?",
    answer: "Yes. Our platform supports multi-property management with centralized reporting, shared guest databases, and portfolio-wide analytics. Each property can have its own branding, rates, and policies.",
  },
  {
    question: "Does it work offline for remote campgrounds?",
    answer: "Yes. Our POS system includes offline mode that syncs when connectivity returns. Staff can process check-ins, take payments, and create reservations even without internet access.",
  },
  {
    question: "What integrations are available?",
    answer: "Camp Everyday integrates with Stripe for payments, QuickBooks and Xero for accounting, major OTA channels (Hipcamp, Airbnb, Booking.com), and offers a full REST API for custom integrations.",
  },
  {
    question: "How does the AI demand forecasting work?",
    answer: "Our AI analyzes your historical booking patterns, local events, weather data, and competitor pricing to predict future demand. It suggests optimal pricing and can automatically adjust rates based on your rules.",
  },
  {
    question: "What guest communication features are included?",
    answer: "All plans include automated confirmation emails, pre-arrival reminders, and check-out instructions. Higher tiers add SMS messaging, guest surveys, and a self-service portal where guests can manage their reservations.",
  },
  {
    question: "Is training provided for my staff?",
    answer: "Yes. We provide DIY video tutorials, role-specific training guides, and live onboarding sessions for Pro and Enterprise plans. Most staff become comfortable with the system within a few hours.",
  },
];

export const metadata: Metadata = {
  title: "Campground Management Software | Camp Everyday - Modern Reservation System",
  description:
    "All-in-one campground management software with online reservations, POS, staff scheduling, AI demand forecasting, and loyalty programs. Go live in 48 hours. $100/mo.",
  keywords: [
    "campground management software",
    "campground reservation software",
    "campground booking system",
    "campground software",
    "rv park management software",
    "campground pos system",
  ],
  openGraph: {
    title: "Campground Management Software - Modern Alternative to Legacy Systems",
    description:
      "All-in-one platform for reservations, POS, staff scheduling, and AI-powered insights. No setup fees, go live in 48 hours.",
    type: "website",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Camp Everyday",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "All-in-one campground management software for reservations, POS, staff scheduling, and AI insights.",
  offers: {
    "@type": "Offer",
    price: "100",
    priceCurrency: "USD",
    priceValidUntil: "2025-12-31",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "50",
  },
};

const featureCategories = [
  {
    title: "Reservations",
    icon: Calendar,
    color: "emerald",
    features: [
      "Online booking engine",
      "Group reservations",
      "Waitlist management",
      "Seasonal/long-term bookings",
      "Automated confirmations",
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    color: "blue",
    features: [
      "Stripe integration",
      "Gift cards & wallets",
      "Refund processing",
      "Double-entry ledger",
      "Charity round-up",
    ],
  },
  {
    title: "Guest Management",
    icon: Users,
    color: "violet",
    features: [
      "Guest profiles",
      "Self-service portal",
      "Loyalty & rewards",
      "Segmentation",
      "Communication history",
    ],
  },
  {
    title: "Point of Sale",
    icon: ShoppingCart,
    color: "amber",
    features: [
      "Full POS system",
      "Inventory tracking",
      "Offline mode",
      "Returns processing",
      "Markdown rules",
    ],
  },
  {
    title: "Staff Operations",
    icon: Wrench,
    color: "cyan",
    features: [
      "Staff scheduling",
      "Time tracking",
      "Payroll integration",
      "Housekeeping management",
      "Maintenance tickets",
    ],
  },
  {
    title: "AI & Analytics",
    icon: BarChart3,
    color: "pink",
    features: [
      "Demand forecasting",
      "Dynamic pricing",
      "No-show prediction",
      "Revenue analytics",
      "A/B testing",
    ],
  },
];

export default function CampgroundManagementSoftwarePage() {
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <FAQJsonLd faqs={softwareFaqs} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-semibold mb-8">
              <Sparkles className="h-4 w-4" />
              The Modern Alternative to Legacy Software
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Campground Management Software
              <span className="block text-emerald-400">That Actually Works</span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed max-w-3xl mx-auto">
              All-in-one platform for reservations, POS, staff scheduling, and AI-powered insights.
              Go live in 48 hours. No setup fees. No contracts.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Button
                asChild
                size="lg"
                className="px-8 py-6 text-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
              >
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Link
                href="/demo"
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Watch 3-min Demo
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
              {PROOF_POINTS.trust.map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Simple Pricing Banner */}
      <section className="py-8 bg-emerald-600">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-white text-center">
            <span className="text-lg font-semibold">Simple Pricing:</span>
            <span className="text-2xl font-bold">${PRICING.standard.monthlyBase}/month</span>
            <span className="text-emerald-200">+</span>
            <span className="text-2xl font-bold">${PRICING.standard.perBooking}/booking</span>
            <span className="text-emerald-200">|</span>
            <span>${PRICING.standard.aiCreditsIncluded}/month AI credits included</span>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Everything You Need to Run Your Campground
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Stop juggling multiple systems. Camp Everyday handles reservations, payments, staff, POS, and analytics in one platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featureCategories.map((category) => {
              const colorMap: Record<string, string> = {
                emerald: "bg-emerald-100 text-emerald-600",
                blue: "bg-blue-100 text-blue-600",
                violet: "bg-violet-100 text-violet-600",
                amber: "bg-amber-100 text-amber-600",
                cyan: "bg-cyan-100 text-cyan-600",
                pink: "bg-pink-100 text-pink-600",
              };

              return (
                <div
                  key={category.title}
                  className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow"
                >
                  <div className={`inline-flex p-3 rounded-xl ${colorMap[category.color]} mb-4`}>
                    <category.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-4">{category.title}</h3>
                  <ul className="space-y-2">
                    {category.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-slate-600">
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Exclusive Features */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 border border-emerald-200 rounded-full text-emerald-700 text-sm font-semibold mb-6">
              <Award className="h-4 w-4" />
              Features Others Don't Have
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              What Makes Camp Everyday Different
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              These aren't coming soon. They're live now.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {DIFFERENTIATORS.exclusive.map((diff) => (
              <div
                key={diff.feature}
                className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-emerald-100">
                    <Zap className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{diff.feature}</h3>
                    <p className="text-slate-600 mb-3">{diff.description}</p>
                    <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full text-sm text-emerald-700">
                      <Star className="h-4 w-4" />
                      {diff.competitorStatus}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Site Types */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Built for Every Type of Campground
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Whether you're running RV sites, tent camping, cabins, or glamping, Camp Everyday handles it all.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {["RV Parks", "Tent Sites", "Cabins", "Glamping", "Yurts", "Treehouses"].map((type) => (
              <div
                key={type}
                className="text-center p-6 bg-slate-50 rounded-xl border border-slate-200"
              >
                <Tent className="h-8 w-8 mx-auto text-emerald-600 mb-3" />
                <span className="font-semibold text-slate-700">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Quick View */}
      <section className="py-20 bg-slate-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Why Parks Switch to Camp Everyday
            </h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              See how we compare to legacy campground software.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                competitor: "Campspot",
                issue: "10% marketplace commission",
                solution: "0% commission, ever",
                link: "/compare/campspot",
              },
              {
                competitor: "Newbook",
                issue: "$1,000-$3,000 setup fee",
                solution: "$0 setup, go live in 48hrs",
                link: "/compare/newbook",
              },
              {
                competitor: "CampLife",
                issue: "No multi-property support",
                solution: "Full portfolio management",
                link: "/compare/camplife",
              },
            ].map((item) => (
              <Link
                key={item.competitor}
                href={item.link}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors"
              >
                <h3 className="text-xl font-bold text-white mb-4">vs {item.competitor}</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 font-semibold">Their issue:</span>
                    <span className="text-slate-300">{item.issue}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 font-semibold">Our solution:</span>
                    <span className="text-slate-300">{item.solution}</span>
                  </div>
                </div>
                <span className="text-emerald-400 font-semibold flex items-center gap-2">
                  See full comparison <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Go Live in 48 Hours
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Getting started with Camp Everyday is simple. No lengthy implementations or training sessions.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "1", title: "Sign Up", description: "Create your account in 2 minutes. No credit card required." },
              { step: "2", title: "Configure", description: "Set up your sites, rates, and policies with our guided wizard." },
              { step: "3", title: "Migrate", description: "We import your data from any system for free." },
              { step: "4", title: "Go Live", description: "Start taking bookings. Your team will be comfortable in hours." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Placeholder */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-lg text-center">
            <div className="flex justify-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-6 w-6 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="text-2xl text-slate-700 mb-6 italic">
              "Camp Everyday replaced 4 different tools we were using. The AI predictions alone have saved us thousands in no-shows."
            </blockquote>
            <div className="text-slate-600">
              <span className="font-semibold text-slate-900">Sarah M.</span>
              <span className="mx-2">|</span>
              <span>Owner, Mountain View RV Park</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to know about Camp Everyday campground management software.
            </p>
          </div>

          <div className="space-y-4">
            {softwareFaqs.map((faq, index) => (
              <details
                key={index}
                className="group border border-slate-200 rounded-xl bg-white overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none px-6 py-5 hover:bg-slate-50 transition-colors">
                  <span className="font-semibold text-slate-900 text-left pr-4">
                    {faq.question}
                  </span>
                  <ChevronDown className="h-5 w-5 text-slate-500 flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-5 pt-0 text-slate-600 leading-relaxed border-t border-slate-100">
                  <div className="pt-4">{faq.answer}</div>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-teal-600">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Modernize Your Campground?
          </h2>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of campgrounds using Camp Everyday to save time, reduce no-shows, and grow revenue.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button
              asChild
              size="lg"
              className="px-8 py-6 text-lg bg-white text-emerald-700 hover:bg-emerald-50"
            >
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Link
              href="/demo"
              className="text-sm font-medium text-emerald-100 hover:text-white transition-colors"
            >
              or watch a quick demo
            </Link>
          </div>

          <p className="text-emerald-200 text-sm">
            No credit card required. {CTA_COPY.primary.subtext}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-semibold mb-4">Compare</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/compare/campspot" className="hover:text-white">vs Campspot</Link></li>
                <li><Link href="/compare/newbook" className="hover:text-white">vs Newbook</Link></li>
                <li><Link href="/compare/camplife" className="hover:text-white">vs CampLife</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Solutions</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/rv-park-reservation-system" className="hover:text-white">RV Park Software</Link></li>
                <li><Link href="/switch-from-campspot" className="hover:text-white">Switch from Campspot</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/demo" className="hover:text-white">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link href="/owners" className="hover:text-white">About</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
            Camp Everyday - Modern campground management software.
          </div>
        </div>
      </footer>
    </div>
  );
}
