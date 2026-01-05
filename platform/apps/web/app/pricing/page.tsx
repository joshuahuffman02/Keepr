import { Metadata } from "next";
import { PricingPreview } from "@/components/marketing/PricingPreview";
import { FAQSection } from "@/components/marketing/FAQSection";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Footer } from "@/components/marketing/Footer";
import { FAQJsonLd } from "@/components/seo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Keepr",
  description: "Transparent plans with fee pass-through controls for campgrounds.",
};

const pricingFaqs = [
  {
    question: "What's included in the base price?",
    answer: "All plans include unlimited users, online reservations, guest portal, POS system, staff scheduling, maintenance tracking, and standard support. Higher tiers add AI features, advanced analytics, and priority support.",
  },
  {
    question: "How does the per-booking fee work?",
    answer: "We charge $2.30 for each confirmed reservation (not per night). This applies to online bookings and staff-created reservations alike. You can pass this fee to guests or absorb it yourself.",
  },
  {
    question: "Can I switch plans later?",
    answer: "Yes, you can upgrade or downgrade at any time. Changes take effect on your next billing cycle. Your early access pricing is locked in forever on your current plan.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards (Visa, Mastercard, American Express) and ACH bank transfers for annual plans. All payments are processed securely through Stripe.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes. All plans include a 30-day free trial with full access to all features. No credit card required to start. If you're not satisfied, we also offer a 30-day money-back guarantee after the trial.",
  },
  {
    question: "What are AI credits and how do they work?",
    answer: "AI credits power features like demand forecasting, no-show prediction, and smart pricing suggestions. Each plan includes a monthly allocation ($5-$25 worth). Unused credits roll over up to 2x your monthly allocation.",
  },
  {
    question: "Do you offer discounts for multiple properties?",
    answer: "Yes. Organizations with 3+ campgrounds receive 15% off the base price for each additional property. Contact our sales team for custom enterprise pricing.",
  },
  {
    question: "Are there any hidden fees?",
    answer: "No. What you see is what you pay. The monthly base price plus $2.30 per booking covers everything. Optional add-ons like SMS messaging are clearly priced separately.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <FAQJsonLd faqs={pricingFaqs} />
      <MarketingHeader />

      <main>
        <section className="border-b border-slate-100 bg-gradient-to-br from-keepr-off-white via-white to-keepr-off-white">
          <div className="max-w-5xl mx-auto px-6 pt-24 pb-16 md:pt-28 md:pb-24 space-y-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-keepr-evergreen">Pricing</p>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
              Pricing built for modern campgrounds
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              Choose the plan that fits today, with flexible service fees you can pass to guests or absorb.
              Taxes and fees are always itemized for clarity.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
              <Button asChild size="lg" className="px-8 bg-keepr-evergreen hover:bg-keepr-evergreen-dark">
                <Link href="/signup">Start Free Trial</Link>
              </Button>
              <Link
                href="#pricing"
                className="text-sm font-medium text-slate-600 hover:text-keepr-evergreen transition-colors"
              >
                Compare plans below
              </Link>
            </div>
            <div className="text-sm text-slate-500">
              Fee pass-through toggle available on all plans. Messaging add-on optional for Essential and Pro.
            </div>
          </div>
        </section>

        <PricingPreview />

        <section className="max-w-4xl mx-auto px-6 py-16 space-y-4 text-center text-slate-700">
          <h2 className="text-2xl font-semibold text-slate-900">Clear fees, compliant receipts</h2>
          <p>
            Guest checkout and staff POS both honor your fee pass-through setting. Service fees and taxes stay
            itemized on every receipt to keep accounting and guest expectations clear.
          </p>
        </section>

        <FAQSection
          faqs={pricingFaqs}
          title="Pricing Questions"
          subtitle="Common questions about our plans and billing."
          className="bg-slate-50"
        />
      </main>

      <Footer />
    </div>
  );
}
