'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import {
  ShoppingCart,
  Grid3x3,
  Smartphone,
  CreditCard,
  Calendar,
  MessageSquare,
  Wifi,
  Package
} from 'lucide-react';

const popularFeatures = [
  {
    id: 'pos',
    name: 'Point-of-Sale System',
    icon: ShoppingCart,
    description: 'Integrated POS for camp store, rentals, and add-ons.',
    benefits: [
      'Inventory management',
      'Multiple payment methods',
      'Real-time sync with reservations',
      'Staff permissions & reporting',
    ],
    image: '/images/owners/pos.png',
  },
  {
    id: 'grid',
    name: 'Grid Optimization',
    icon: Grid3x3,
    description: 'Visual site management with drag-and-drop assignments.',
    benefits: [
      'Interactive site map',
      'Drag-and-drop assignments',
      'Real-time availability',
      'Site type grouping',
    ],
    image: '/images/owners/grid.png',
  },
  {
    id: 'mobile',
    name: 'Mobile Check-In',
    icon: Smartphone,
    description: 'Contactless check-in and guest self-service portal.',
    benefits: [
      'QR code check-in',
      'Digital waivers',
      'Mobile payments',
      'Guest messaging',
    ],
    image: '/images/owners/mobile-checkin.png',
  },
  {
    id: 'payments',
    name: 'Payment Processing',
    icon: CreditCard,
    description: 'Secure payment processing with multiple gateways.',
    benefits: [
      'Stripe & Square integration',
      'Split payments',
      'Refund management',
      'PCI compliance',
    ],
    image: '/images/owners/payments.png',
  },
  {
    id: 'booking',
    name: 'Online Booking Engine',
    icon: Calendar,
    description: 'Beautiful booking experience for your guests.',
    benefits: [
      'Real-time availability',
      'Dynamic pricing',
      'Add-on selection',
      'Instant confirmation',
    ],
    image: '/images/owners/booking.png',
  },
  {
    id: 'messaging',
    name: 'Guest Messaging',
    icon: MessageSquare,
    description: 'Automated and manual guest communication.',
    benefits: [
      'Booking confirmations',
      'Pre-arrival messages',
      'SMS & email',
      'Custom templates',
    ],
    image: '/images/owners/messaging.png',
  },
];

export function PopularFeatures() {
  const [activeFeature, setActiveFeature] = useState(popularFeatures[0]);
  const detailRef = useRef<HTMLDivElement | null>(null);

  const handleSelect = (feature: typeof popularFeatures[number]) => {
    setActiveFeature(feature);
    if (typeof window !== "undefined" && window.innerWidth < 1024 && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="py-24 bg-gradient-to-br from-slate-50 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-base font-semibold text-emerald-600 tracking-wide uppercase mb-3">
            Popular Features
          </h2>
          <p className="text-4xl font-bold text-foreground mb-4">
            The tools campground owners love most
          </p>
          <p className="text-xl text-muted-foreground">
            Discover the features that make daily operations smoother and guests happier.
          </p>
        </div>

        {/* Feature Showcase */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Feature Tabs */}
          <div className="space-y-3">
            {popularFeatures.map((feature) => {
              const Icon = feature.icon;
              const isActive = activeFeature.id === feature.id;

              return (
                <button
                  key={feature.id}
                  onClick={() => handleSelect(feature)}
                  className={`w-full text-left p-6 rounded-xl border-2 transition-all duration-300 ${isActive
                    ? 'border-emerald-500 bg-emerald-50 shadow-lg'
                    : 'border-border bg-card hover:border-emerald-300 hover:shadow-md'
                    }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-600' : 'bg-muted'
                        }`}
                    >
                      <Icon className={`h-6 w-6 ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`text-lg font-semibold mb-1 ${isActive ? 'text-emerald-900' : 'text-foreground'
                          }`}
                      >
                        {feature.name}
                      </h3>
                      <p className={`text-sm ${isActive ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Feature Details */}
          <div ref={detailRef} className="lg:sticky lg:top-24">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              {/* Feature Image Placeholder */}
              <div className="aspect-[16/10] relative bg-muted">
                <Image
                  src={activeFeature.image}
                  alt={`${activeFeature.name} Preview`}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Feature Content */}
              <div className="p-8">
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  {activeFeature.name}
                </h3>
                <p className="text-muted-foreground mb-6">{activeFeature.description}</p>

                {/* Benefits List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                    Key Benefits
                  </h4>
                  <ul className="space-y-2">
                    {activeFeature.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3">
                        <svg
                          className="h-6 w-6 text-emerald-500 flex-shrink-0 mt-0.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-foreground">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
