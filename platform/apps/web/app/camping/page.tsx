import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Mountain,
  ArrowRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampingSearchForm } from "./CampingSearchForm";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export const metadata: Metadata = {
  title: "Find Campgrounds & RV Parks | Camp Everyday",
  description:
    "Discover campgrounds, RV parks, and outdoor accommodations across the United States. Browse by state, city, or nearby attractions.",
  openGraph: {
    title: "Find Campgrounds & RV Parks | Camp Everyday",
    description:
      "Discover campgrounds, RV parks, and outdoor accommodations across the United States.",
    type: "website",
  },
};

interface StateData {
  id: string;
  name: string;
  slug: string;
  campgroundCount: number;
}

interface PopularDestination {
  id: string;
  name: string;
  slug: string;
  type: string;
  nearbyCampgroundCount: number;
  heroImageUrl?: string;
}

async function getStates(): Promise<StateData[]> {
  try {
    const res = await fetch(`${API_BASE}/api/public/locations`, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getPopularDestinations(): Promise<PopularDestination[]> {
  try {
    const res = await fetch(`${API_BASE}/api/public/locations/featured/destinations`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function CampingIndexPage() {
  const [states, popularDestinations] = await Promise.all([
    getStates(),
    getPopularDestinations(),
  ]);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Find Campgrounds & RV Parks",
    description:
      "Discover campgrounds, RV parks, and outdoor accommodations across the United States.",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://campeveryday.com",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Camping",
          item: "https://campeveryday.com/camping",
        },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative max-w-6xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Find Your Perfect Campsite
          </h1>
          <p className="text-xl text-emerald-100 mb-8 max-w-2xl mx-auto">
            Discover campgrounds, RV parks, and outdoor accommodations across the
            United States. From national parks to hidden gems.
          </p>

          {/* Search Bar */}
          <CampingSearchForm />
        </div>
      </section>

      {/* Popular Destinations */}
      {popularDestinations.length > 0 && (
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Popular Camping Destinations
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularDestinations.slice(0, 6).map((destination) => (
                <Link
                  key={destination.id}
                  href={`/near/${destination.slug}`}
                  className="group relative h-64 rounded-2xl overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: destination.heroImageUrl
                        ? `url(${destination.heroImageUrl})`
                        : "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2">
                      <Mountain className="h-4 w-4" />
                      {destination.type.replace(/_/g, " ")}
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                      {destination.name}
                    </h3>
                    <p className="text-white/70 text-sm mt-1">
                      {destination.nearbyCampgroundCount} campgrounds nearby
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/national-parks">
                  View All National Parks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Browse by State */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">
            Browse Campgrounds by State
          </h2>

          {states.length > 0 ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {states
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((state) => (
                  <Link
                    key={state.id}
                    href={`/camping/${state.slug}`}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-emerald-600" />
                      <span className="font-medium text-slate-700">{state.name}</span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {state.campgroundCount}
                    </span>
                  </Link>
                ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Placeholder states when API not available */}
              {[
                "Alabama",
                "Alaska",
                "Arizona",
                "Arkansas",
                "California",
                "Colorado",
                "Connecticut",
                "Delaware",
                "Florida",
                "Georgia",
                "Hawaii",
                "Idaho",
                "Illinois",
                "Indiana",
                "Iowa",
                "Kansas",
                "Kentucky",
                "Louisiana",
                "Maine",
                "Maryland",
                "Massachusetts",
                "Michigan",
                "Minnesota",
                "Mississippi",
                "Missouri",
                "Montana",
                "Nebraska",
                "Nevada",
                "New Hampshire",
                "New Jersey",
                "New Mexico",
                "New York",
                "North Carolina",
                "North Dakota",
                "Ohio",
                "Oklahoma",
                "Oregon",
                "Pennsylvania",
                "Rhode Island",
                "South Carolina",
                "South Dakota",
                "Tennessee",
                "Texas",
                "Utah",
                "Vermont",
                "Virginia",
                "Washington",
                "West Virginia",
                "Wisconsin",
                "Wyoming",
              ].map((state) => (
                <Link
                  key={state}
                  href={`/camping/${state.toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium text-slate-700">{state}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Camping Types */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">
            Types of Camping
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "/images/icons/bouncing-tent.png",
                title: "Tent Camping",
                description: "Traditional camping with tent sites and basic amenities.",
                href: "/?category=tent",
              },
              {
                icon: "/images/icons/electric-hookup.png",
                title: "RV Parks",
                description: "Full-hookup sites with electric, water, and sewer connections.",
                href: "/?category=rv",
              },
              {
                icon: "/images/icons/regions/lake.png",
                title: "Lakefront Camping",
                description: "Waterfront sites with beach access and water activities.",
                href: "/?amenity=lakefront",
              },
              {
                icon: "/images/icons/regions/mountain.png",
                title: "Backcountry",
                description: "Remote wilderness camping for the adventurous spirit.",
                href: "/?category=backcountry",
              },
            ].map((type) => (
              <Link
                key={type.title}
                href={type.href}
                className="group p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-lg transition-all"
              >
                <div className="relative w-16 h-16 mb-4">
                  <Image
                    src={type.icon}
                    alt=""
                    fill
                    className="object-contain group-hover:scale-110 transition-transform"
                    sizes="64px"
                  />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">{type.title}</h3>
                <p className="text-slate-600 text-sm">{type.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-emerald-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Own a Campground?
          </h2>
          <p className="text-emerald-100 text-lg mb-8">
            Claim your listing on Camp Everyday and start accepting online reservations
            today. No marketplace commission, transparent pricing.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-white text-emerald-900 hover:bg-emerald-50"
            >
              <Link href="/claim-your-listing">
                Claim Your Listing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
            >
              <Link href="/for-campgrounds">Learn More</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
