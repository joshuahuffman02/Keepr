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
    description: 'The only campground software with real AI. Predict demand, optimize pricing, and reduce no-shows.',
    icon: Brain,
    color: 'blue',
    exclusive: true,
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
    exclusive: true,
    features: [
      'XP system & leveling',
      'Rewards marketplace',
      'Achievement badges',
      'Referral programs',
    ],
  },
  {
    name: 'Staff Scheduling & Payroll',
    description: 'Finally, staff scheduling that syncs with your occupancy. Includes time tracking.',
    icon: Calendar,
    color: 'emerald',
    exclusive: true,
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
    exclusive: false,
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
    exclusive: false,
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
    exclusive: false,
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
    <section id="features" className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-emerald-600 tracking-wide uppercase mb-3">
            Complete Platform
          </h2>
          <p className="text-4xl font-bold text-slate-900 mb-4">
            Everything competitors have. Plus features they don't.
          </p>
          <p className="text-xl text-slate-600">
            The first 3 features below? No other campground software offers them.
            That's our edge.
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
                className={`group relative bg-white rounded-2xl border-2 ${feature.exclusive ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'} p-8 transition-all duration-300 hover:shadow-xl ${colors.hover}`}
              >
                {/* Exclusive Badge */}
                {feature.exclusive && (
                  <div className="absolute -top-3 left-6 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white">
                    <Sparkles className="h-3 w-3 mr-1" />
                    EXCLUSIVE
                  </div>
                )}

                {/* Icon */}
                <div className={`inline-flex h-14 w-14 items-center justify-center rounded-xl ${colors.bg} mb-6 ${feature.exclusive ? 'mt-2' : ''}`}>
                  <Icon className={`h-7 w-7 ${colors.icon}`} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {feature.name}
                </h3>
                <p className="text-slate-600 mb-6">
                  {feature.description}
                </p>

                {/* Feature List */}
                <ul className="space-y-2 mb-6">
                  {feature.features.map((item) => (
                    <li key={item} className="flex items-center text-sm text-slate-600">
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

                {/* Competitor Note for Exclusive Features */}
                {feature.exclusive && (
                  <div className="text-xs text-red-600 font-medium mb-4">
                    Campspot, Newbook, CampLife don't offer this
                  </div>
                )}

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
