"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  DollarSign,
  TrendingDown,
  ArrowRight,
  Check,
  Sparkles,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  PiggyBank,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/PublicHeader";

const KEEPR_BASE = 100;
const KEEPR_PER_BOOKING = 2.3;
const KEEPR_AI_INCLUDED = 5;

const competitors = [
  {
    id: "campspot",
    name: "Campspot",
    baseLow: 199,
    baseHigh: 599,
    perBooking: 2.5,
    setupFee: 2000,
    aiExtra: 150,
  },
  {
    id: "newbook",
    name: "Newbook",
    baseLow: 300,
    baseHigh: 500,
    perBooking: 2.0,
    setupFee: 2500,
    aiExtra: 100,
  },
  {
    id: "camplife",
    name: "CampLife",
    baseLow: 200,
    baseHigh: 400,
    perBooking: 1.5,
    setupFee: 1000,
    aiExtra: 0,
  },
  {
    id: "rms",
    name: "RMS",
    baseLow: 350,
    baseHigh: 600,
    perBooking: 2.0,
    setupFee: 3000,
    aiExtra: 200,
  },
  {
    id: "other",
    name: "Other / Custom",
    baseLow: 200,
    baseHigh: 500,
    perBooking: 2.0,
    setupFee: 1500,
    aiExtra: 100,
  },
];

export function ROICalculatorClient() {
  const [sites, setSites] = useState(75);
  const [monthlyBookings, setMonthlyBookings] = useState(150);
  const [currentSoftware, setCurrentSoftware] = useState("campspot");
  const [currentMonthlyCost, setCurrentMonthlyCost] = useState<number | "">("");
  const [wantsAI, setWantsAI] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const competitor = competitors.find((c) => c.id === currentSoftware) || competitors[0];

  // Calculate costs
  const estimatedCompetitorBase = (competitor.baseLow + competitor.baseHigh) / 2;
  const competitorPerBookingCost = monthlyBookings * competitor.perBooking;
  const competitorAICost = wantsAI ? competitor.aiExtra : 0;
  const competitorMonthly =
    typeof currentMonthlyCost === "number" && currentMonthlyCost > 0
      ? currentMonthlyCost
      : estimatedCompetitorBase + competitorPerBookingCost + competitorAICost;
  const competitorAnnual = competitorMonthly * 12;
  const competitorFirstYear = competitorAnnual + competitor.setupFee;

  const keeprPerBooking = monthlyBookings * KEEPR_PER_BOOKING;
  const keeprMonthly = KEEPR_BASE + keeprPerBooking;
  const keeprAnnual = keeprMonthly * 12;
  const keeprFirstYear = keeprAnnual; // No setup fee

  const monthlySavings = competitorMonthly - keeprMonthly;
  const annualSavings = competitorAnnual - keeprAnnual;
  const firstYearSavings = competitorFirstYear - keeprFirstYear;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Actually capture lead
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-emerald-500/10 to-transparent" />

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-semibold mb-8">
            <Calculator className="h-4 w-4" />
            ROI Calculator
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            How Much Could You
            <span className="block text-emerald-400">Save?</span>
          </h1>

          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Compare your current software costs to Keepr&apos;s transparent pricing.
            Most parks save $5,000-15,000 per year.
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="py-16 -mt-8 relative z-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="grid lg:grid-cols-2">
              {/* Input Side */}
              <div className="p-8 bg-slate-50 border-r border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Your Park Details</h2>

                {/* Sites */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Number of Sites
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="10"
                      max="300"
                      value={sites}
                      onChange={(e) => setSites(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <span className="w-16 text-right text-lg font-semibold text-slate-900">
                      {sites}
                    </span>
                  </div>
                </div>

                {/* Monthly Bookings */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Average Monthly Bookings
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="20"
                      max="800"
                      step="10"
                      value={monthlyBookings}
                      onChange={(e) => setMonthlyBookings(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <span className="w-16 text-right text-lg font-semibold text-slate-900">
                      {monthlyBookings}
                    </span>
                  </div>
                </div>

                {/* Current Software */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Current Software
                  </label>
                  <select
                    value={currentSoftware}
                    onChange={(e) => setCurrentSoftware(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    {competitors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Features */}
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantsAI}
                      onChange={(e) => setWantsAI(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Include AI features (pricing, forecasting)
                    </span>
                  </label>
                  <p className="text-xs text-slate-500 mt-1 ml-8">
                    Competitors charge $100-200/mo extra. Keepr includes it.
                  </p>
                </div>

                {/* Advanced Options */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
                >
                  {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Advanced Options
                </button>

                {showAdvanced && (
                  <div className="p-4 bg-white rounded-lg border border-slate-200 mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Your Actual Monthly Cost (if known)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                      <input
                        type="number"
                        value={currentMonthlyCost}
                        onChange={(e) =>
                          setCurrentMonthlyCost(e.target.value ? Number(e.target.value) : "")
                        }
                        placeholder="Enter your current monthly cost"
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Leave blank to use estimated {competitor.name} pricing
                    </p>
                  </div>
                )}
              </div>

              {/* Results Side */}
              <div className="p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Your Potential Savings</h2>

                {/* Cost Comparison */}
                <div className="space-y-6 mb-8">
                  {/* Current */}
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-800">
                        {competitor.name} (Estimated)
                      </span>
                      <span className="text-xl font-bold text-red-600">
                        {formatCurrency(competitorMonthly)}/mo
                      </span>
                    </div>
                    <div className="text-xs text-red-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Base fee</span>
                        <span>{formatCurrency(estimatedCompetitorBase)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Per-booking ({monthlyBookings} x ${competitor.perBooking})</span>
                        <span>{formatCurrency(competitorPerBookingCost)}</span>
                      </div>
                      {wantsAI && competitor.aiExtra > 0 && (
                        <div className="flex justify-between">
                          <span>AI features</span>
                          <span>{formatCurrency(competitor.aiExtra)}</span>
                        </div>
                      )}
                      {competitor.setupFee > 0 && (
                        <div className="flex justify-between pt-1 border-t border-red-200">
                          <span>Setup fee (Year 1)</span>
                          <span>{formatCurrency(competitor.setupFee)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Keepr */}
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-emerald-800">Keepr</span>
                      <span className="text-xl font-bold text-emerald-600">
                        {formatCurrency(keeprMonthly)}/mo
                      </span>
                    </div>
                    <div className="text-xs text-emerald-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Base fee</span>
                        <span>{formatCurrency(KEEPR_BASE)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Per-booking ({monthlyBookings} x ${KEEPR_PER_BOOKING})</span>
                        <span>{formatCurrency(keeprPerBooking)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>AI features</span>
                        <span className="font-medium">Included</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-emerald-200">
                        <span>Setup fee</span>
                        <span className="font-medium">$0</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Savings Summary */}
                <div className="bg-slate-900 rounded-xl p-6 text-white mb-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(monthlySavings)}
                      </div>
                      <div className="text-xs text-slate-400">Monthly Savings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(annualSavings)}
                      </div>
                      <div className="text-xs text-slate-400">Annual Savings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(firstYearSavings)}
                      </div>
                      <div className="text-xs text-slate-400">First Year</div>
                    </div>
                  </div>
                </div>

                {/* What You Could Do */}
                {firstYearSavings > 0 && (
                  <div className="text-sm text-slate-600 mb-6">
                    <p className="font-medium text-slate-900 mb-2">
                      What could {formatCurrency(firstYearSavings)} do for your park?
                    </p>
                    <ul className="space-y-1">
                      {firstYearSavings >= 500 && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          New patio furniture for {Math.floor(firstYearSavings / 500)} sites
                        </li>
                      )}
                      {firstYearSavings >= 3000 && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          Upgraded WiFi infrastructure
                        </li>
                      )}
                      {firstYearSavings >= 5000 && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          Additional part-time staff for peak season
                        </li>
                      )}
                      {firstYearSavings >= 10000 && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-500" />
                          Playground or amenity upgrade
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* CTA */}
                {!submitted ? (
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email for a detailed comparison"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      required
                    />
                    <Button
                      type="submit"
                      className="w-full py-6 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                    >
                      Get My Custom Savings Report
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                    <p className="text-xs text-slate-500 text-center">
                      We&apos;ll send a detailed PDF with your specific numbers.
                    </p>
                  </form>
                ) : (
                  <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <Check className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                    <p className="font-semibold text-emerald-900">Check your inbox!</p>
                    <p className="text-sm text-emerald-700">
                      We&apos;ll send your custom savings report shortly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Benefits */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">
            Beyond the Savings
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <Clock className="h-10 w-10 text-violet-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Time Savings</h3>
              <p className="text-slate-600 text-sm">
                Parks report saving 10-15 hours per week with automated booking, communication,
                and reporting.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <Sparkles className="h-10 w-10 text-violet-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">AI Revenue Boost</h3>
              <p className="text-slate-600 text-sm">
                Dynamic pricing and demand forecasting typically increase revenue 15-20%.
                Included free.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200">
              <Zap className="h-10 w-10 text-violet-600 mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">Faster Setup</h3>
              <p className="text-slate-600 text-sm">
                Go live in days, not weeks. No $2,000+ setup fee. We handle data migration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Ready to See the Full Picture?
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Book a demo and we&apos;ll walk through your specific situation.
            No pressure, just honest numbers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="px-8 py-6 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            >
              <Link href="/demo">
                Try the Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="px-8 py-6 text-lg">
              <Link href="/pricing">View Full Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-slate-400 text-sm">
              Keepr - Transparent pricing for modern campgrounds.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/pricing" className="hover:text-white">
                Pricing
              </Link>
              <Link href="/compare/campspot" className="hover:text-white">
                vs Campspot
              </Link>
              <Link href="/demo" className="hover:text-white">
                Demo
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
