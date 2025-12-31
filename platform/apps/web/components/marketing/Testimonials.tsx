'use client';

import { Rocket, Users, MessageSquare, Lightbulb } from 'lucide-react';

const earlyAccessBenefits = [
  {
    id: 1,
    icon: Rocket,
    title: 'Shape the Product',
    description:
      'As an early adopter, you get direct input on features we build. Your feedback shapes the roadmap.',
  },
  {
    id: 2,
    icon: Users,
    title: 'Founding Community',
    description:
      'Join a small group of forward-thinking campground owners. Network, share ideas, and grow together.',
  },
  {
    id: 3,
    icon: MessageSquare,
    title: 'Direct Access',
    description:
      'Skip the support queue. Early access members get direct communication with our team.',
  },
  {
    id: 4,
    icon: Lightbulb,
    title: 'Locked-In Pricing',
    description:
      'Early access pricing is locked forever. As we grow and add features, your rate stays the same.',
  },
];

export function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-emerald-600 tracking-wide uppercase mb-3">
            Early Access
          </h2>
          <p className="text-4xl font-bold text-slate-900 mb-4">
            Be part of something new
          </p>
          <p className="text-xl text-slate-600">
            We're building Camp Everyday with campground owners, not just for them.
            Early adopters get unique benefits you won't find anywhere else.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {earlyAccessBenefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.id}
                className="bg-white rounded-2xl border-2 border-slate-200 p-8 hover:border-emerald-300 hover:shadow-xl transition-all duration-300"
              >
                {/* Icon */}
                <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-emerald-600" />
                </div>

                {/* Content */}
                <h3 className="font-bold text-slate-900 mb-2">{benefit.title}</h3>
                <p className="text-slate-600 text-sm">{benefit.description}</p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-slate-600 mb-4">
            Limited spots available in each early access tier
          </p>
          <a
            href="#pricing"
            className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-semibold"
          >
            View early access pricing
            <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
