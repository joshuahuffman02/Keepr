import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, Star, ArrowRight, Tent, Caravan, Home } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { generatePageMetadata, getBaseUrl } from "@/lib/seo";
import { Breadcrumbs, BreadcrumbItem } from "@/components/seo";
import { LocationLinks, RelatedCampgrounds } from "@/components/seo/InternalLinks";

// Use ISR - pages generated on-demand and cached for 1 hour
export const revalidate = 3600;

type Props = {
  params: Promise<{ location: string }>;
};

/**
 * Parse location slug into state/city components
 * Formats: "california" (state) or "austin-texas" (city-state)
 */
function parseLocationSlug(slug: string): { state: string; city?: string } {
  const parts = slug.split("-");

  // Try to identify state (usually last 1-2 parts)
  // Common 2-word states: new-york, new-jersey, new-mexico, etc.
  const twoWordStates = [
    "new-york",
    "new-jersey",
    "new-mexico",
    "new-hampshire",
    "north-carolina",
    "north-dakota",
    "south-carolina",
    "south-dakota",
    "west-virginia",
    "rhode-island",
  ];

  const lastTwo = parts.slice(-2).join("-");
  if (twoWordStates.includes(lastTwo) && parts.length > 2) {
    return {
      state: lastTwo,
      city: parts.slice(0, -2).join("-"),
    };
  }

  // Single word state
  if (parts.length === 1) {
    return { state: parts[0] };
  }

  // City + state format
  return {
    state: parts[parts.length - 1],
    city: parts.slice(0, -1).join("-"),
  };
}

/**
 * Format slug to display name
 */
function formatName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;
  const parsed = parseLocationSlug(location);
  const baseUrl = getBaseUrl();

  const stateName = formatName(parsed.state);
  const cityName = parsed.city ? formatName(parsed.city) : undefined;

  const title = cityName
    ? `Campgrounds in ${cityName}, ${stateName} - RV Parks & Camping`
    : `Campgrounds in ${stateName} - RV Parks, Cabins & Camping`;

  const description = cityName
    ? `Find and book the best campgrounds, RV parks, and cabins near ${cityName}, ${stateName}. Compare sites, read reviews, and reserve your spot online.`
    : `Discover top-rated campgrounds across ${stateName}. Book RV sites, tent camping, cabins, and glamping experiences. Reserve online with instant confirmation.`;

  return generatePageMetadata({
    title,
    description,
    path: `/browse/${location}`,
    keywords: [
      `campgrounds ${cityName || stateName}`,
      `camping ${cityName || stateName}`,
      `RV parks ${cityName || stateName}`,
      `${stateName} camping`,
      cityName ? `${cityName} campgrounds` : `best campgrounds ${stateName}`,
    ],
  });
}

export default async function LocationPage({ params }: Props) {
  const { location } = await params;
  const parsed = parseLocationSlug(location);
  const baseUrl = getBaseUrl();

  const stateName = formatName(parsed.state);
  const cityName = parsed.city ? formatName(parsed.city) : undefined;

  // Fetch campgrounds for this location
  let campgrounds: Awaited<ReturnType<typeof apiClient.getPublicCampgrounds>> = [];

  try {
    const allCampgrounds = await apiClient.getPublicCampgrounds();

    // Filter by location
    campgrounds = allCampgrounds.filter((cg) => {
      const stateMatch = cg.state?.toLowerCase().replace(/\s+/g, "-") === parsed.state;
      if (!stateMatch) return false;

      if (parsed.city) {
        return cg.city?.toLowerCase().replace(/\s+/g, "-") === parsed.city;
      }

      return true;
    });
  } catch {
    // Continue with empty results
  }

  if (campgrounds.length === 0) {
    notFound();
  }

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbItem[] = [{ name: "Browse Campgrounds", path: "/browse" }];

  if (cityName) {
    breadcrumbs.push(
      { name: stateName, path: `/browse/${parsed.state}` },
      { name: cityName, path: `/browse/${location}` },
    );
  } else {
    breadcrumbs.push({ name: stateName, path: `/browse/${location}` });
  }

  // Get unique cities for internal linking (if showing state page)
  const cityLinks = !cityName
    ? Array.from(
        new Map(
          campgrounds
            .filter((cg) => cg.city)
            .map((cg) => [
              cg.city,
              {
                name: cg.city!,
                slug: `${cg.city!.toLowerCase().replace(/\s+/g, "-")}-${parsed.state}`,
                count: campgrounds.filter((c) => c.city === cg.city).length,
              },
            ]),
        ).values(),
      ).sort((a, b) => b.count - a.count)
    : [];

  // Get site type counts
  const siteTypeCounts = campgrounds.reduce<Record<string, number>>((acc, cg) => {
    // This would need actual site data - placeholder for now
    return acc;
  }, {});

  // Get nearby states for internal linking
  // This is simplified - you'd want a proper adjacency map
  const nearbyStates = [
    { name: "California", slug: "california", count: 0 },
    { name: "Texas", slug: "texas", count: 0 },
    { name: "Florida", slug: "florida", count: 0 },
    { name: "Colorado", slug: "colorado", count: 0 },
  ].filter((s) => s.slug !== parsed.state);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} className="mb-6" showHome enableSeo />

      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
          {cityName ? `Campgrounds in ${cityName}, ${stateName}` : `Campgrounds in ${stateName}`}
        </h1>
        <p className="text-lg text-slate-600 mt-2">
          {campgrounds.length} campground{campgrounds.length !== 1 ? "s" : ""} available
        </p>
      </header>

      {/* City links (on state pages) */}
      {cityLinks.length > 0 && (
        <LocationLinks
          locations={cityLinks}
          title={`Cities in ${stateName}`}
          type="city"
          className="mb-8"
        />
      )}

      {/* Campground grid */}
      <section aria-label="Campground listings" className="mb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campgrounds.map((campground) => (
            <article
              key={campground.slug}
              className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              <Link href={`/park/${campground.slug}`} className="block">
                {/* Image */}
                <div className="aspect-[16/10] bg-slate-100 overflow-hidden">
                  {campground.heroImageUrl ? (
                    <img
                      src={campground.heroImageUrl}
                      alt={campground.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <Tent className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                    {campground.name}
                  </h2>

                  {(campground.city || campground.state) && (
                    <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {[campground.city, campground.state].filter(Boolean).join(", ")}
                      </span>
                    </p>
                  )}

                  {campground.tagline && (
                    <p className="text-sm text-slate-500 mt-2 line-clamp-2">{campground.tagline}</p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    {campground.reviewScore ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-sm font-medium">
                          {Number(campground.reviewScore).toFixed(1)}
                        </span>
                        {campground.reviewCount && (
                          <span className="text-xs text-slate-500">({campground.reviewCount})</span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                      View details
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* SEO Content Section */}
      <section className="bg-slate-50 rounded-2xl p-6 md:p-8 mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Camping in {cityName || stateName}
        </h2>
        <div className="prose prose-slate max-w-none">
          <p>
            {cityName
              ? `Discover the best camping experiences near ${cityName}, ${stateName}. From full-hookup RV sites to rustic tent camping and cozy cabins, find the perfect spot for your next outdoor adventure.`
              : `${stateName} offers diverse camping experiences across its beautiful landscapes. Whether you're looking for beachfront RV parks, mountain cabins, or family-friendly campgrounds, you'll find it here.`}
          </p>
          <p>
            All campgrounds listed on Keepr offer online booking with instant confirmation. Compare
            amenities, read guest reviews, and find available dates for your preferred travel dates.
          </p>
        </div>
      </section>

      {/* Nearby states */}
      {!cityName && nearbyStates.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Explore More States</h2>
          <div className="flex flex-wrap gap-3">
            {nearbyStates.map((state) => (
              <Link
                key={state.slug}
                href={`/browse/${state.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 rounded-lg text-sm text-slate-700 hover:text-emerald-700 transition-colors"
              >
                <MapPin className="h-4 w-4" />
                {state.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 md:p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Can't find what you're looking for?</h2>
        <p className="text-slate-600 mt-2 mb-4">
          Search all campgrounds or contact us for personalized recommendations.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
          >
            Search All Campgrounds
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-semibold rounded-lg transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </div>
  );
}

/**
 * Generate static params for location pages
 * Returns empty array to use on-demand ISR instead of build-time generation
 * This prevents build timeouts while still caching pages after first visit
 */
export function generateStaticParams() {
  // Return empty array - pages will be generated on-demand with ISR
  // This avoids build timeouts from API calls during static generation
  return [];
}
