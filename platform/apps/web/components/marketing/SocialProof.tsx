'use client';

import { MapPin, Star, Users, TrendingUp } from 'lucide-react';

const stats = [
  {
    icon: Users,
    value: 'Early Access',
    label: 'Campgrounds',
    description: 'Be among the first',
  },
  {
    icon: MapPin,
    value: 'USA',
    label: 'Nationwide',
    description: 'Available everywhere',
  },
  {
    icon: Star,
    value: 'Premium',
    label: 'Features',
    description: 'Built for hospitality',
  },
  {
    icon: TrendingUp,
    value: 'Launching',
    label: '2025',
    description: 'Join the waitlist',
  },
];

export function SocialProof() {
  return (
    <section className="py-12 bg-card border-y border-border">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="text-center">
                <div className="flex justify-center mb-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Icon className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-foreground mb-1">{stat.value}</div>
                <div className="text-sm font-semibold text-foreground mb-1">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
