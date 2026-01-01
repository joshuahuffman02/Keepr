import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Globe,
  Star,
  Tent,
  Trees,
  Waves,
  Mountain,
  Shield,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  Users,
  Wifi,
  Zap,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServerApiUrl } from "@/lib/api-base";

interface CampgroundPageData {
  id: string;
  slug: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  heroImageUrl?: string;
  claimStatus: "unclaimed" | "claim_pending" | "claimed";
  isClaimable: boolean;
  isComingSoon: boolean;
  isBookable: boolean;
  amenities: string[];
  siteTypes: string[];
  totalSites?: number;
  priceRange?: { min: number; max: number };
  rating?: number;
  reviewCount?: number;
  seededDataSource?: string;
  nearbyAttractions: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    distanceMiles: number;
  }>;
  metaTitle: string;
  metaDescription: string;
}

async function getCampground(slug: string): Promise<CampgroundPageData | null> {
  try {
    const url = getServerApiUrl(`/public/campgrounds/${slug}`);
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campground = await getCampground(slug);

  if (!campground) {
    return {
      title: "Campground Not Found",
    };
  }

  return {
    title: campground.metaTitle,
    description: campground.metaDescription,
    openGraph: {
      title: campground.metaTitle,
      description: campground.metaDescription,
      type: "website",
      images: campground.heroImageUrl ? [campground.heroImageUrl] : [],
    },
  };
}

// Amenity icon mapping
function getAmenityIcon(amenity: string) {
  const iconMap: Record<string, React.ReactNode> = {
    wifi: <Wifi className="h-5 w-5" />,
    electric: <Zap className="h-5 w-5" />,
    water: <Droplets className="h-5 w-5" />,
    pool: <Waves className="h-5 w-5" />,
    hiking: <Mountain className="h-5 w-5" />,
    trees: <Trees className="h-5 w-5" />,
  };
  return iconMap[amenity.toLowerCase()] || <CheckCircle2 className="h-5 w-5" />;
}

export default async function CampgroundPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campground = await getCampground(slug);

  if (!campground) {
    notFound();
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Campground",
    name: campground.name,
    description: campground.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: campground.address,
      addressLocality: campground.city,
      addressRegion: campground.state,
      postalCode: campground.zipCode,
      addressCountry: campground.country || "US",
    },
    ...(campground.latitude && campground.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: campground.latitude,
            longitude: campground.longitude,
          },
        }
      : {}),
    ...(campground.phone ? { telephone: campground.phone } : {}),
    ...(campground.website ? { url: campground.website } : {}),
    ...(campground.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: campground.rating,
            reviewCount: campground.reviewCount || 0,
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
        className="relative pb-32 bg-cover bg-center"
        style={{
          backgroundImage: campground.heroImageUrl
            ? `url(${campground.heroImageUrl})`
            : "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-3xl">
            {/* Claim Status Badge */}
            {campground.claimStatus === "unclaimed" && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-300 text-sm mb-4">
                <Shield className="h-4 w-4" />
                Unclaimed Listing
              </div>
            )}
            {campground.isComingSoon && (
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-300 text-sm mb-4">
                <Clock className="h-4 w-4" />
                Coming Soon to Camp Everyday
              </div>
            )}

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {campground.name}
            </h1>

            {(campground.city || campground.state) && (
              <p className="flex items-center gap-2 text-xl text-white/80 mb-6">
                <MapPin className="h-5 w-5" />
                {[campground.city, campground.state].filter(Boolean).join(", ")}
              </p>
            )}

            {campground.rating && (
              <div className="flex items-center gap-2 text-white mb-8">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">{campground.rating.toFixed(1)}</span>
                {campground.reviewCount && (
                  <span className="text-white/60">
                    ({campground.reviewCount} reviews)
                  </span>
                )}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              {campground.isBookable ? (
                <Button
                  asChild
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Link href={`/booking/${campground.slug}`}>
                    <Calendar className="mr-2 h-5 w-5" />
                    Check Availability
                  </Link>
                </Button>
              ) : campground.isClaimable ? (
                <Button
                  asChild
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  <Link href={`/claim/${campground.slug}`}>
                    <Shield className="mr-2 h-5 w-5" />
                    Claim This Listing
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  <Link href="/signup">
                    <Users className="mr-2 h-5 w-5" />
                    Get Notified When Available
                  </Link>
                </Button>
              )}

              {campground.website && (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10"
                >
                  <a
                    href={campground.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="mr-2 h-5 w-5" />
                    Visit Website
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-12">
              {/* Description */}
              {campground.description && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    About {campground.name}
                  </h2>
                  <p className="text-slate-600 leading-relaxed">
                    {campground.description}
                  </p>
                </div>
              )}

              {/* Site Types */}
              {campground.siteTypes.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    Accommodation Types
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {campground.siteTypes.map((type) => (
                      <div
                        key={type}
                        className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg"
                      >
                        <Tent className="h-6 w-6 text-emerald-600" />
                        <span className="font-medium text-slate-700">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amenities */}
              {campground.amenities.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    Amenities
                  </h2>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {campground.amenities.map((amenity) => (
                      <div
                        key={amenity}
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                      >
                        <span className="text-emerald-600">
                          {getAmenityIcon(amenity)}
                        </span>
                        <span className="text-slate-700">{amenity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby Attractions */}
              {campground.nearbyAttractions.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">
                    Nearby Attractions
                  </h2>
                  <div className="space-y-3">
                    {campground.nearbyAttractions.map((attraction) => (
                      <Link
                        key={attraction.id}
                        href={`/near/${attraction.slug}`}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Mountain className="h-5 w-5 text-emerald-600" />
                          <div>
                            <div className="font-medium text-slate-900">
                              {attraction.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              {attraction.type.replace(/_/g, " ")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span>{attraction.distanceMiles.toFixed(1)} mi</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Contact Card */}
              <div className="bg-slate-50 rounded-xl p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4">
                  {campground.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                      <div className="text-slate-600">
                        {campground.address}
                        <br />
                        {campground.city}, {campground.state} {campground.zipCode}
                      </div>
                    </div>
                  )}
                  {campground.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-slate-400" />
                      <a
                        href={`tel:${campground.phone}`}
                        className="text-emerald-600 hover:underline"
                      >
                        {campground.phone}
                      </a>
                    </div>
                  )}
                  {campground.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-slate-400" />
                      <a
                        href={campground.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline truncate"
                      >
                        {campground.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Range Card */}
              {campground.priceRange && (
                <div className="bg-emerald-50 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Price Range
                  </h3>
                  <div className="text-2xl font-bold text-emerald-600">
                    ${(campground.priceRange.min / 100).toFixed(0)} - $
                    {(campground.priceRange.max / 100).toFixed(0)}
                  </div>
                  <div className="text-sm text-slate-500">per night</div>
                </div>
              )}

              {/* Claim CTA for Unclaimed */}
              {campground.claimStatus === "unclaimed" && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Own this campground?
                  </h3>
                  <p className="text-slate-600 text-sm mb-4">
                    Claim your listing to manage reservations, update your profile,
                    and attract more campers.
                  </p>
                  <Button asChild className="w-full bg-amber-600 hover:bg-amber-500">
                    <Link href={`/claim/${campground.slug}`}>
                      Claim Your Listing
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}

              {/* Total Sites */}
              {campground.totalSites && (
                <div className="bg-slate-50 rounded-xl p-6">
                  <div className="text-3xl font-bold text-slate-900">
                    {campground.totalSites}
                  </div>
                  <div className="text-slate-500">Total Sites</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      {campground.latitude && campground.longitude && (
        <section className="py-16 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Location</h2>
            <div className="bg-slate-200 rounded-xl h-96 flex items-center justify-center">
              <div className="text-center text-slate-500">
                <MapPin className="h-12 w-12 mx-auto mb-2" />
                <p>
                  {campground.latitude.toFixed(4)}, {campground.longitude.toFixed(4)}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${campground.latitude},${campground.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 hover:underline mt-2 inline-block"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Related Locations */}
      {campground.state && (
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-6">
              Explore More Campgrounds
            </h2>
            <div className="flex flex-wrap gap-4">
              <Link
                href={`/camping/${campground.state.toLowerCase().replace(/\s+/g, "-")}`}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
              >
                More campgrounds in {campground.state}
              </Link>
              {campground.city && (
                <Link
                  href={`/camping/${campground.state.toLowerCase().replace(/\s+/g, "-")}/${campground.city.toLowerCase().replace(/\s+/g, "-")}`}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                >
                  Campgrounds near {campground.city}
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Data Source Attribution - Required by RIDB API Agreement */}
      {campground.seededDataSource === "recreation_gov" && (
        <section className="py-6 bg-slate-100 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-6">
            <p className="text-sm text-slate-500 text-center">
              Campground data sourced from{" "}
              <a
                href="https://www.recreation.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                Recreation.gov
              </a>
              . Camp Everyday is not affiliated with or endorsed by the U.S. Government.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
