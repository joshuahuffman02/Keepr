import { Metadata } from "next";
import { PricingPreview } from "@/components/marketing/PricingPreview";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing | Camp Everyday",
  description: "Transparent plans with fee pass-through controls for campgrounds.",
};

export default function PricingPage() {
  return (
    <main className="bg-white min-h-screen">
      <section className="border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24 space-y-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">Pricing</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
            Pricing built for modern campgrounds
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            Choose the plan that fits today, with flexible service fees you can pass to guests or absorb.
            Taxes and fees are always itemized for clarity.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Button asChild size="lg" className="px-8">
              <Link href="/owners#pricing">Compare plans</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8 border-2">
              <Link href="/contact">Talk to sales</Link>
            </Button>
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
    </main>
  );
}
