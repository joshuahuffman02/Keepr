import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Star,
  Tent,
  Mountain,
  Filter,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerApiUrl } from "@/lib/api-base";

interface LocationPageData {
  type: "state" | "city" | "region" | "county";
  name: string;
  slug: string;
  state?: string;
  description?: string;
  heroImageUrl?: string;
  campgroundCount: number;
  avgRating?: number;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  popularAmenities?: string[];
  highlights?: string[];
  bestTimeToVisit?: string;
  campgrounds: Array<{
    id: string;
    slug: string;
    name: string;
    city?: string;
    state?: string;
    rating?: number;
    reviewCount?: number;
    reviewScore?: number;
    priceRange?: { min: number; max: number };
    amenities?: string[];
    heroImageUrl?: string;
    isBookable?: boolean;
    claimStatus?: string;
  }>;
  nearbyAttractions?: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    nearbyCampgroundCount?: number;
    campgroundCount?: number;
  }>;
  childLocations?: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    campgroundCount: number;
  }>;
  breadcrumbs?: Array<{
    name: string;
    slug: string;
  }>;
  metaTitle: string;
  metaDescription: string;
}

async function getLocation(slugParts: string[]): Promise<LocationPageData | null> {
  const slug = slugParts.join("/");
  try {
    const url = getServerApiUrl(`/public/locations/${slug}`);
    const res = await fetch(url, {
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
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const location = await getLocation(slug);

  if (!location) {
    return {
      title: "Location Not Found",
    };
  }

  return {
    title: location.metaTitle,
    description: location.metaDescription,
    openGraph: {
      title: location.metaTitle,
      description: location.metaDescription,
      type: "website",
      images: location.heroImageUrl ? [location.heroImageUrl] : [],
    },
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const location = await getLocation(slug);

  if (!location) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: location.name,
    description: location.description || location.metaDescription,
    ...(location.heroImageUrl ? { image: location.heroImageUrl } : {}),
  };

  const breadcrumbStructuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Camping",
        item: "https://keeprstay.com/camping",
      },
      ...(location.breadcrumbs || []).map((bc, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: bc.name,
        item: `https://keeprstay.com/camping/${bc.slug}`,
      })),
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />

      {/* Hero Section */}
      <section
        className="relative pb-32 bg-cover bg-center"
        style={{
          backgroundImage: location.heroImageUrl
            ? `url(${location.heroImageUrl})`
            : "linear-gradient(135deg, #065f46 0%, #064e3b 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-6xl mx-auto px-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-white/70 text-sm mb-6">
            <Link href="/camping" className="hover:text-white">
              Camping
            </Link>
            {(location.breadcrumbs || []).map((bc, index) => (
              <span key={bc.slug} className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                {index === (location.breadcrumbs || []).length - 1 ? (
                  <span className="text-white">{bc.name}</span>
                ) : (
                  <Link href={`/camping/${bc.slug}`} className="hover:text-white">
                    {bc.name}
                  </Link>
                )}
              </span>
            ))}
          </nav>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Camping in {location.name}
          </h1>

          <p className="text-xl text-white/80 mb-6 max-w-2xl">
            {location.description ||
              `Discover ${location.campgroundCount} campgrounds and RV parks in ${location.name}. Find your perfect outdoor getaway.`}
          </p>

          {/* Stats */}
          <div className="flex flex-wrap gap-6 text-white">
            <div className="flex items-center gap-2">
              <Tent className="h-5 w-5" />
              <span className="font-semibold">{location.campgroundCount}</span>
              <span className="text-white/70">Campgrounds</span>
            </div>
            {location.avgRating && (
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{location.avgRating.toFixed(1)}</span>
                <span className="text-white/70">Avg Rating</span>
              </div>
            )}
            {location.priceRangeLow && location.priceRangeHigh && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  ${(location.priceRangeLow / 100).toFixed(0)} - $
                  {(location.priceRangeHigh / 100).toFixed(0)}
                </span>
                <span className="text-white/70">per night</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-12">
            {/* Sidebar - Filters & Info */}
            <div className="lg:col-span-1 space-y-8">
              {/* Child Locations */}
              {(location.childLocations || []).length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    {location.type === "state" ? "Cities" : "Areas"}
                  </h3>
                  <div className="space-y-2">
                    {(location.childLocations || []).slice(0, 10).map((child) => (
                      <Link
                        key={child.id}
                        href={`/camping/${child.slug}`}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-slate-700">{child.name}</span>
                        <span className="text-sm text-slate-500">
                          {child.campgroundCount}
                        </span>
                      </Link>
                    ))}
                  </div>
                  {(location.childLocations || []).length > 10 && (
                    <button className="mt-3 text-emerald-600 text-sm hover:underline">
                      Show all {(location.childLocations || []).length} locations
                    </button>
                  )}
                </div>
              )}

              {/* Nearby Attractions */}
              {(location.nearbyAttractions || []).length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Nearby Attractions
                  </h3>
                  <div className="space-y-2">
                    {(location.nearbyAttractions || []).slice(0, 5).map((attraction) => (
                      <Link
                        key={attraction.id}
                        href={`/near/${attraction.slug}`}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Mountain className="h-5 w-5 text-emerald-600" />
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-700 truncate">
                            {attraction.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {attraction.nearbyCampgroundCount} campgrounds nearby
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular Amenities */}
              {(location.popularAmenities || []).length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">
                    Popular Amenities
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(location.popularAmenities || []).map((amenity) => (
                      <span
                        key={amenity}
                        className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Time to Visit */}
              {location.bestTimeToVisit && (
                <div className="bg-blue-50 rounded-xl p-4">
                  <h3 className="font-bold text-slate-900 mb-2">Best Time to Visit</h3>
                  <p className="text-slate-600 text-sm">{location.bestTimeToVisit}</p>
                </div>
              )}
            </div>

            {/* Main - Campground List */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-900">
                  {location.campgroundCount} Campgrounds in {location.name}
                </h2>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </div>

              {/* Campground Grid */}
              <div className="grid md:grid-cols-2 gap-6">
                {location.campgrounds.map((campground) => (
                  <Link
                    key={campground.id}
                    href={`/campground/${campground.slug}`}
                    className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Image */}
                    <div
                      className="h-48 bg-slate-200 bg-cover bg-center"
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
                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">
                        {campground.name}
                      </h3>

                      {(campground.city || campground.state) && (
                        <p className="flex items-center gap-1 text-sm text-slate-500 mb-3">
                          <MapPin className="h-4 w-4" />
                          {[campground.city, campground.state]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}

                      {/* Rating & Price */}
                      <div className="flex items-center justify-between">
                        {campground.rating ? (
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
                        ) : (
                          <div />
                        )}

                        {campground.priceRange && (
                          <div className="text-right">
                            <span className="font-bold text-emerald-600">
                              ${(campground.priceRange.min / 100).toFixed(0)}
                            </span>
                            <span className="text-sm text-slate-500"> /night</span>
                          </div>
                        )}
                      </div>

                      {/* Amenities Preview */}
                      {(campground.amenities || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {(campground.amenities || []).slice(0, 3).map((amenity) => (
                            <span
                              key={amenity}
                              className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                            >
                              {amenity}
                            </span>
                          ))}
                          {(campground.amenities || []).length > 3 && (
                            <span className="px-2 py-0.5 text-slate-500 text-xs">
                              +{(campground.amenities || []).length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bookable Badge */}
                      {campground.isBookable && (
                        <div className="mt-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs font-medium">
                            Book Online
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination Info */}
              {location.campgrounds.length < location.campgroundCount && (
                <div className="mt-8 text-center text-slate-500">
                  Showing {location.campgrounds.length} of {location.campgroundCount} campgrounds
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Section */}
      {(location.highlights || []).length > 0 && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Why Camp in {location.name}?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(location.highlights || []).map((highlight, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl p-6 border border-slate-200"
                >
                  <p className="text-slate-700">{highlight}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SEO Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">
            Camping Guide: {location.name}
          </h2>
          <div className="prose prose-slate max-w-none">
            <p>
              {location.name} offers {location.campgroundCount} campgrounds and RV
              parks for outdoor enthusiasts. Whether you're looking for a rustic tent
              camping experience or a full-service RV resort,{" "}
              {location.type === "state" ? "the state" : "the area"} has options for
              every camping style.
            </p>

            {(location.popularAmenities || []).length > 0 && (
              <>
                <h3>Popular Amenities</h3>
                <p>
                  Campgrounds in {location.name} commonly offer{" "}
                  {(location.popularAmenities || []).slice(0, 5).join(", ")}. Many facilities
                  cater to both tent campers and RV travelers with various hookup
                  options.
                </p>
              </>
            )}

            {(location.nearbyAttractions || []).length > 0 && (
              <>
                <h3>Things to Do</h3>
                <p>
                  Visitors to {location.name} can explore nearby attractions including{" "}
                  {(location.nearbyAttractions || [])
                    .slice(0, 3)
                    .map((a) => a.name)
                    .join(", ")}
                  . The region offers excellent opportunities for hiking, fishing, and
                  wildlife viewing.
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
