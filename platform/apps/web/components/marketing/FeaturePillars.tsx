'use client';

import {
  TrendingUp,
  Settings,
  Megaphone,
  Users,
  Zap,
  BarChart3,
  ArrowRight,
  Brain,
  Sparkles,
  Calendar
} from 'lucide-react';

const features = [
  {
    name: 'AI-Powered Intelligence',
    description: 'Predict demand, optimize pricing, and reduce no-shows with built-in AI.',
    icon: Brain,
    color: 'blue',
    features: [
      'AI demand forecasting',
      'AI pricing recommendations',
      'AI no-show detection',
      'Anomaly detection alerts',
    ],
  },
  {
    name: 'Loyalty & Gamification',
    description: 'Turn one-time guests into lifetime campers with XP, levels, and rewards.',
    icon: Sparkles,
    color: 'purple',
    features: [
      'XP system & leveling',
      'Rewards marketplace',
      'Achievement badges',
      'Referral programs',
    ],
  },
  {
    name: 'Staff Scheduling & Payroll',
    description: 'Schedule staff based on occupancy with integrated time tracking and payroll.',
    icon: Calendar,
    color: 'emerald',
    features: [
      'Shift scheduling',
      'Time clock & tracking',
      'Payroll integration',
      'Occupancy-based staffing',
    ],
  },
  {
    name: 'Reservations & Revenue',
    description: 'Maximize bookings with dynamic pricing and intelligent revenue management.',
    icon: TrendingUp,
    color: 'teal',
    features: [
      'Drag-and-drop calendar',
      'Dynamic pricing rules',
      'Group bookings',
      'Waitlist management',
    ],
  },
  {
    name: 'Guest Experience',
    description: 'Delight guests with seamless booking, check-in, and communication.',
    icon: Users,
    color: 'pink',
    features: [
      'Online booking engine',
      'Self-service portal',
      '2-way SMS messaging',
      'Push notifications',
    ],
  },
  {
    name: 'Operations & Integrations',
    description: 'Run your entire park from one place. Connect to your favorite tools.',
    icon: Settings,
    color: 'amber',
    features: [
      'Housekeeping management',
      'Maintenance tickets',
      'POS & camp store',
      'Accounting integrations',
    ],
  },
];

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-100',
    icon: 'text-emerald-600',
    hover: 'hover:border-emerald-300',
  },
  blue: {
    bg: 'bg-blue-100',
    icon: 'text-blue-600',
    hover: 'hover:border-blue-300',
  },
  purple: {
    bg: 'bg-purple-100',
    icon: 'text-purple-600',
    hover: 'hover:border-purple-300',
  },
  pink: {
    bg: 'bg-pink-100',
    icon: 'text-pink-600',
    hover: 'hover:border-pink-300',
  },
  amber: {
    bg: 'bg-amber-100',
    icon: 'text-amber-600',
    hover: 'hover:border-amber-300',
  },
  teal: {
    bg: 'bg-teal-100',
    icon: 'text-teal-600',
    hover: 'hover:border-teal-300',
  },
};

export function FeaturePillars() {
  return (
    <section id="features" className="py-24 bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-emerald-600 tracking-wide uppercase mb-3">
            Complete Platform
          </h2>
          <p className="text-4xl font-bold text-foreground mb-4">
            Everything you need to run your campground
          </p>
          <p className="text-xl text-muted-foreground">
            From AI-powered insights to guest loyalty programs, we've built the
            all-in-one platform for modern campground operations.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            const colors = colorClasses[feature.color as keyof typeof colorClasses];

            return (
              <div
                key={feature.name}
                className={`group relative bg-card rounded-2xl border-2 border-border p-8 transition-all duration-300 hover:shadow-xl ${colors.hover}`}
              >
                {/* Icon */}
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} mb-6`}>
                  <Icon className={`h-7 w-7 ${colors.icon}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-foreground mb-3">
                  {feature.name}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {feature.description}
                </p>

                {/* Feature List */}
                <ul className="space-y-2">
                  {feature.features.map((item) => (
                    <li key={item} className="flex items-center text-sm text-muted-foreground">
                      <svg
                        className="h-5 w-5 text-emerald-500 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Hover Effect */}
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
