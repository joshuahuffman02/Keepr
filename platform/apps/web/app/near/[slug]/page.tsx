import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Star,
  Tent,
  Mountain,
  Trees,
  Waves,
  Landmark,
  Car,
  ArrowRight,
  Calendar,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

interface AttractionPageData {
  id: string;
  type: string;
  name: string;
  slug: string;
  state?: string;
  city?: string;
  description?: string;
  heroImageUrl?: string;
  activities: string[];
  bestSeason?: string;
  nearbyCampgroundCount: number;
  avgCampgroundRating?: number;
  campgrounds: Array<{
    id: string;
    slug: string;
    name: string;
    city?: string;
    state?: string;
    distanceMiles: number;
    driveTimeMinutes?: number;
    rating?: number;
    reviewCount?: number;
    priceRange?: { min: number; max: number };
    amenities: string[];
    heroImageUrl?: string;
    isBookable: boolean;
  }>;
  relatedAttractions: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    nearbyCampgroundCount: number;
  }>;
  seo: {
    metaTitle: string;
    metaDescription: string;
  };
}

async function getAttraction(slug: string): Promise<AttractionPageData | null> {
  try {
    const res = await fetch(`${API_BASE}/public/attractions/${slug}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const attraction = await getAttraction(slug);

  if (!attraction) {
    return {
      title: "Attraction Not Found",
    };
  }

  return {
    title: attraction.seo.metaTitle,
    description: attraction.seo.metaDescription,
    openGraph: {
      title: attraction.seo.metaTitle,
      description: attraction.seo.metaDescription,
      type: "website",
      images: attraction.heroImageUrl ? [attraction.heroImageUrl] : [],
    },
  };
}

// Get icon for attraction type
function getAttractionIcon(type: string) {
  const iconMap: Record<string, React.ReactNode> = {
    national_park: <Mountain className="h-6 w-6" />,
    state_park: <Trees className="h-6 w-6" />,
    national_forest: <Trees className="h-6 w-6" />,
    lake: <Waves className="h-6 w-6" />,
    beach: <Waves className="h-6 w-6" />,
    river: <Waves className="h-6 w-6" />,
    mountain: <Mountain className="h-6 w-6" />,
    historic_site: <Landmark className="h-6 w-6" />,
  };
  return iconMap[type] || <Mountain className="h-6 w-6" />;
}

// Format attraction type for display
function formatAttractionType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function AttractionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const attraction = await getAttraction(slug);

  if (!attraction) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: attraction.name,
    description: attraction.description || attraction.seo.metaDescription,
    ...(attraction.heroImageUrl ? { image: attraction.heroImageUrl } : {}),
    ...(attraction.state
      ? {
          address: {
            "@type": "PostalAddress",
            addressRegion: attraction.state,
            addressCountry: "US",
          },
        }
      : {}),
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* Hero Section */}
      <section
        className="relative pt-20 pb-32 bg-cover bg-center"
        style={{
          backgroundImage: attraction.heroImageUrl
            ? `url(${attraction.heroImageUrl})`
            : "linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-6xl mx-auto px-6">
          {/* Type Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur rounded-full text-white text-sm mb-6">
            {getAttractionIcon(attraction.type)}
            {formatAttractionType(attraction.type)}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Camping Near {attraction.name}
          </h1>

          {(attraction.city || attraction.state) && (
            <p className="flex items-center gap-2 text-xl text-white/80 mb-6">
              <MapPin className="h-5 w-5" />
              {[attraction.city, attraction.state].filter(Boolean).join(", ")}
            </p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-6 text-white">
            <div className="flex items-center gap-2">
              <Tent className="h-5 w-5" />
              <span className="font-semibold">{attraction.nearbyCampgroundCount}</span>
              <span className="text-white/70">Nearby Campgrounds</span>
            </div>
            {attraction.avgCampgroundRating && (
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">
                  {attraction.avgCampgroundRating.toFixed(1)}
                </span>
                <span className="text-white/70">Avg Rating</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-12">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-8">
              {/* About */}
              {attraction.description && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    About {attraction.name}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {attraction.description}
                  </p>
                </div>
              )}

              {/* Best Season */}
              {attraction.bestSeason && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sun className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900">Best Time to Visit</h3>
                  </div>
                  <p className="text-slate-600 text-sm">{attraction.bestSeason}</p>
                </div>
              )}

              {/* Activities */}
              {attraction.activities.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Activities</h3>
                  <div className="flex flex-wrap gap-2">
                    {attraction.activities.map((activity) => (
                      <span
                        key={activity}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                      >
                        {activity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Attractions */}
              {attraction.relatedAttractions.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    Nearby Attractions
                  </h3>
                  <div className="space-y-2">
                    {attraction.relatedAttractions.slice(0, 5).map((related) => (
                      <Link
                        key={related.id}
                        href={`/near/${related.slug}`}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-blue-600">
                          {getAttractionIcon(related.type)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-700 truncate text-sm">
                            {related.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {related.nearbyCampgroundCount} campgrounds
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main - Campground List */}
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">
                {attraction.nearbyCampgroundCount} Campgrounds Near {attraction.name}
              </h2>

              {/* Campground List */}
              <div className="space-y-4">
                {attraction.campgrounds.map((campground) => (
                  <Link
                    key={campground.id}
                    href={`/campground/${campground.slug}`}
                    className="group flex flex-col md:flex-row gap-4 bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Image */}
                    <div
                      className="md:w-64 h-48 md:h-auto bg-slate-200 bg-cover bg-center flex-shrink-0"
                      style={{
                        backgroundImage: campground.heroImageUrl
                          ? `url(${campground.heroImageUrl})`
                          : undefined,
                      }}
                    >
                      {!campground.heroImageUrl && (
                        <div className="h-full flex items-center justify-center">
                          <Tent className="h-12 w-12 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {campground.name}
                          </h3>

                          {(campground.city || campground.state) && (
                            <p className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                              <MapPin className="h-4 w-4" />
                              {[campground.city, campground.state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          )}
                        </div>

                        {campground.priceRange && (
                          <div className="text-right flex-shrink-0">
                            <span className="text-lg font-bold text-emerald-600">
                              ${(campground.priceRange.min / 100).toFixed(0)}
                            </span>
                            <span className="text-sm text-slate-500">/night</span>
                          </div>
                        )}
                      </div>

                      {/* Distance */}
                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Car className="h-4 w-4" />
                          {campground.distanceMiles.toFixed(1)} miles away
                        </span>
                        {campground.driveTimeMinutes && (
                          <span>({campground.driveTimeMinutes} min drive)</span>
                        )}
                      </div>

                      {/* Rating & Amenities */}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-4">
                          {campground.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="font-semibold text-slate-700">
                                {campground.rating.toFixed(1)}
                              </span>
                              {campground.reviewCount && (
                                <span className="text-sm text-slate-500">
                                  ({campground.reviewCount})
                                </span>
                              )}
                            </div>
                          )}

                          {campground.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {campground.amenities.slice(0, 3).map((amenity) => (
                                <span
                                  key={amenity}
                                  className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                                >
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {campground.isBookable && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500">
                            <Calendar className="mr-1 h-4 w-4" />
                            Book Now
                          </Button>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Load More */}
              {attraction.campgrounds.length < attraction.nearbyCampgroundCount && (
                <div className="mt-8 text-center">
                  <Button variant="outline" size="lg">
                    Load More Campgrounds
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SEO Content */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Camping Guide: {attraction.name}
          </h2>
          <div className="prose prose-slate max-w-none">
            <p>
              Planning a camping trip near {attraction.name}? This{" "}
              {formatAttractionType(attraction.type).toLowerCase()} in{" "}
              {attraction.state || "the United States"} offers visitors a chance to
              experience nature at its finest, with {attraction.nearbyCampgroundCount}{" "}
              campgrounds and RV parks located nearby.
            </p>

            {attraction.activities.length > 0 && (
              <>
                <h3>Popular Activities</h3>
                <p>
                  Visitors to {attraction.name} enjoy activities including{" "}
                  {attraction.activities.join(", ")}. The area offers something for
                  every outdoor enthusiast, from casual day hikers to experienced
                  adventurers.
                </p>
              </>
            )}

            <h3>Camping Options</h3>
            <p>
              Campgrounds near {attraction.name} range from primitive backcountry sites
              to full-service RV parks with all modern amenities. Whether you prefer
              tent camping under the stars or the comfort of a fully-equipped RV site,
              you'll find options to suit your camping style.
            </p>

            {attraction.bestSeason && (
              <>
                <h3>When to Visit</h3>
                <p>
                  The best time to camp near {attraction.name} is {attraction.bestSeason}
                  . During this period, you'll experience optimal weather conditions and
                  the best access to trails and facilities.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* State Link */}
      {attraction.state && (
        <section className="py-8 bg-white border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-6">
            <Link
              href={`/camping/${attraction.state.toLowerCase().replace(/\s+/g, "-")}`}
              className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              View all campgrounds in {attraction.state}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
