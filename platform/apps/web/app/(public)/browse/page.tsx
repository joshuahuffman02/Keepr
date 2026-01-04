import { Metadata } from "next";
import Link from "next/link";
import { MapPin, Star, ArrowRight, Tent, Search } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { generatePageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/seo";
import { LocationLinks } from "@/components/seo/InternalLinks";

export const metadata: Metadata = generatePageMetadata({
  title: "Find Campgrounds - RV Parks, Cabins & Camping Sites",
  description:
    "Browse campgrounds across the United States. Find RV parks, tent sites, cabins, and glamping experiences. Book online with instant confirmation.",
  path: "/browse",
  keywords: [
    "campgrounds near me",
    "RV parks",
    "camping sites",
    "cabin rentals",
    "glamping",
    "tent camping",
    "campground directory",
  ],
});

export const revalidate = 3600; // Revalidate every hour

export default async function CampgroundsIndexPage() {
  let campgrounds: Awaited<ReturnType<typeof apiClient.getPublicCampgrounds>> = [];
  let stateMap = new Map<string, { count: number; campgrounds: typeof campgrounds }>();

  try {
    campgrounds = await apiClient.getPublicCampgrounds();

    // Group by state
    campgrounds.forEach((cg) => {
      if (cg.state) {
        const existing = stateMap.get(cg.state);
        if (existing) {
          existing.count++;
          existing.campgrounds.push(cg);
        } else {
          stateMap.set(cg.state, { count: 1, campgrounds: [cg] });
        }
      }
    });
  } catch {
    // Continue with empty results
  }

  // Sort states by campground count
  const sortedStates = Array.from(stateMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([state, data]) => ({
      name: state,
      slug: state.toLowerCase().replace(/\s+/g, "-"),
      count: data.count,
      featured: data.campgrounds.slice(0, 2),
    }));

  // Get featured campgrounds (top rated)
  const featuredCampgrounds = [...campgrounds]
    .filter((cg) => cg.reviewScore)
    .sort((a, b) => Number(b.reviewScore || 0) - Number(a.reviewScore || 0))
    .slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[{ name: "Browse Campgrounds", path: "/browse" }]}
        className="mb-6"
        showHome
        enableSeo
      />

      {/* Hero Section */}
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900">
          Find Your Perfect Campground
        </h1>
        <p className="text-xl text-slate-600 mt-4 max-w-2xl mx-auto">
          Discover {campgrounds.length.toLocaleString()}+ campgrounds, RV parks, and
          cabins across the United States
        </p>

        {/* Search CTA */}
        <div className="mt-8 max-w-xl mx-auto">
          <Link
            href="/"
            className="flex items-center gap-3 px-6 py-4 bg-white border-2 border-slate-200 hover:border-emerald-300 rounded-xl text-left transition-colors group"
          >
            <Search className="h-5 w-5 text-slate-400 group-hover:text-emerald-500" />
            <span className="text-slate-500">
              Search by location, name, or amenities...
            </span>
          </Link>
        </div>
      </header>

      {/* Featured Campgrounds */}
      {featuredCampgrounds.length > 0 && (
        <section className="mb-16" aria-labelledby="featured-heading">
          <h2
            id="featured-heading"
            className="text-2xl font-bold text-slate-900 mb-6"
          >
            Top-Rated Campgrounds
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredCampgrounds.map((campground) => (
              <Link
                key={campground.slug}
                href={`/park/${campground.slug}`}
                className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
              >
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
                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {campground.name}
                  </h3>
                  {(campground.city || campground.state) && (
                    <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                      <MapPin className="h-4 w-4" />
                      {[campground.city, campground.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {campground.reviewScore && (
                    <div className="flex items-center gap-1 text-amber-600 mt-2">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-medium">
                        {Number(campground.reviewScore).toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Browse by State */}
      <section className="mb-16" aria-labelledby="states-heading">
        <h2 id="states-heading" className="text-2xl font-bold text-slate-900 mb-6">
          Browse by State
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStates.map((state) => (
            <Link
              key={state.slug}
              href={`/browse/${state.slug}`}
              className="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {state.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {state.count} campground{state.count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </section>

      {/* SEO Content */}
      <section className="bg-slate-50 rounded-2xl p-6 md:p-8 mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">
          Find the Best Campgrounds in America
        </h2>
        <div className="prose prose-slate max-w-none">
          <p>
            Keepr makes it easy to discover and book campgrounds across the
            United States. Whether you're planning a family RV trip, a romantic cabin
            getaway, or a rustic tent camping adventure, we have options for every
            type of camper.
          </p>
          <h3>Types of Camping Available</h3>
          <ul>
            <li>
              <strong>RV Sites</strong> - Full hookup sites with water, electric, and
              sewer connections
            </li>
            <li>
              <strong>Tent Camping</strong> - Primitive and improved tent sites in
              scenic locations
            </li>
            <li>
              <strong>Cabin Rentals</strong> - Cozy cabins with amenities from rustic
              to luxury
            </li>
            <li>
              <strong>Glamping</strong> - Unique accommodations like yurts, treehouses,
              and safari tents
            </li>
          </ul>
          <h3>Why Book with Keepr?</h3>
          <ul>
            <li>Instant confirmation on all bookings</li>
            <li>Verified guest reviews and ratings</li>
            <li>Secure online payments</li>
            <li>Real-time availability calendars</li>
            <li>Mobile-friendly booking experience</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-600 rounded-2xl p-6 md:p-8 text-center text-white">
        <h2 className="text-2xl font-bold">Ready to Start Your Adventure?</h2>
        <p className="mt-2 text-emerald-100">
          Search campgrounds by location, dates, and amenities to find your perfect
          spot.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50 transition-colors"
        >
          <Search className="h-5 w-5" />
          Search Campgrounds
        </Link>
      </section>
    </div>
  );
}
