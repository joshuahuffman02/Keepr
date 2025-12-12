'use client';

import { Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Essential',
    description: 'Core bookings and payments',
    price: '49',
    period: '/mo + 1.9% + $0.20/txn',
    features: [
      'Online bookings with itemized taxes/fees',
      'Calendar + availability grid',
      'Basic reporting & exports',
      'Standard support (email/chat)',
      'Fee pass-through toggle for guests',
      'Messaging add-on available ($49/mo)',
    ],
    cta: 'Start free trial',
    popular: false,
  },
  {
    name: 'Pro',
    description: 'Revenue and marketing tools',
    price: '129',
    period: '/mo + 1.5% + $0.15/txn',
    features: [
      'Everything in Essential',
      'Dynamic pricing & rules',
      'Waitlist + abandoned cart nudges',
      'CRM + marketing campaigns',
      'Priority support',
      'Fee pass-through or absorb (configurable)',
    ],
    cta: 'Book a demo',
    popular: true,
  },
  {
    name: 'Business',
    description: 'Operations at scale',
    price: '289',
    period: '/mo + 1.3% + $0.10/txn',
    features: [
      'Everything in Pro',
      'OTA sync + channel rules',
      'Staff scheduling & workflows',
      'Custom reports & dashboards',
      'Phone support included',
      'Messaging bundle included',
    ],
    cta: 'Talk to sales',
    popular: false,
  },
  {
    name: 'Enterprise',
    description: 'Multi-park and high volume',
    price: 'Custom',
    period: '',
    features: [
      'Volume pricing & SLAs',
      'SSO + audit logging',
      'Custom integrations & API access',
      'Premium onboarding',
      'Dedicated TAM & 24/7 support',
      'Fee strategy guidance (pass-through vs absorb)',
    ],
    cta: 'Contact sales',
    popular: false,
  },
];

export function PricingPreview() {
  return (
    <section id="pricing" className="py-24 bg-gradient-to-br from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-emerald-600 tracking-wide uppercase mb-3">
            Pricing
          </h2>
          <p className="text-4xl font-bold text-slate-900 mb-4">
            Simple, transparent pricing
          </p>
          <p className="text-xl text-slate-600">
            Choose the plan that fits your campground. All plans include a 30-day free trial.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border-2 p-8 transition-all duration-300 ${
                plan.popular
                  ? 'border-emerald-500 shadow-2xl scale-105 bg-white'
                  : 'border-slate-200 hover:border-emerald-300 hover:shadow-xl bg-white'
              }`}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-full">
                  Most Popular
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-600 text-sm mb-4">{plan.description}</p>

                <div className="flex items-baseline justify-center gap-1">
                  {plan.price === 'Custom' ? (
                    <div className="text-4xl font-bold text-slate-900">{plan.price}</div>
                  ) : (
                    <>
                      <span className="text-2xl text-slate-600">$</span>
                      <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                      <span className="text-slate-600">{plan.period}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Button
                className={`w-full py-6 text-lg group ${
                  plan.popular
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                    : 'border-2 border-slate-300 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
                variant={plan.popular ? 'default' : 'outline'}
              >
                {plan.cta}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-16 text-center">
          <p className="text-slate-600 mb-4">
            All plans include free data migration, onboarding, and training. Toggle guest fee pass-through or absorption on every plan.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Messaging add-on for Essential/Pro</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              <span>Money-back guarantee</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
