"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { SearchBar } from "../../components/public/SearchBar";
import { CampgroundCard } from "../../components/public/CampgroundCard";
import { apiClient } from "../../lib/api-client";
import { trackEvent } from "@/lib/analytics";
import { LeadCaptureForm } from "../../components/marketing/LeadCaptureForm";

// Sample external campgrounds to mix with internal ones
const externalCampgrounds = [
    {
        id: "ext-1",
        name: "Yellowstone River RV Park",
        city: "Gardiner",
        state: "MT",
        description: "Gateway to Yellowstone National Park",
        rating: 4.7,
        reviewCount: 328,
        pricePerNight: 65,
        amenities: ["Full Hookups", "WiFi", "Pet Friendly"]
    },
    {
        id: "ext-2",
        name: "Redwood Coast Cabins",
        city: "Crescent City",
        state: "CA",
        description: "Nestled among the ancient redwoods",
        rating: 4.9,
        reviewCount: 156,
        pricePerNight: 125,
        amenities: ["Cabins", "Hiking Trails", "Fire Pits"]
    },
    {
        id: "ext-3",
        name: "Great Smoky Mountains Camp",
        city: "Gatlinburg",
        state: "TN",
        description: "Family camping in the Smokies",
        rating: 4.6,
        reviewCount: 412,
        pricePerNight: 45,
        amenities: ["Tent Sites", "Showers", "Camp Store"]
    },
    {
        id: "ext-4",
        name: "Desert Oasis RV Resort",
        city: "Palm Springs",
        state: "CA",
        description: "Luxury RV resort with pool and spa",
        rating: 4.8,
        reviewCount: 289,
        pricePerNight: 85,
        amenities: ["Pool", "Hot Tub", "Full Hookups"]
    },
    {
        id: "ext-5",
        name: "Maine Coastal Campground",
        city: "Bar Harbor",
        state: "ME",
        description: "Ocean views near Acadia National Park",
        rating: 4.5,
        reviewCount: 198,
        pricePerNight: 55,
        amenities: ["Ocean View", "Kayak Rentals", "WiFi"]
    },
    {
        id: "ext-6",
        name: "Rocky Mountain High Camp",
        city: "Estes Park",
        state: "CO",
        description: "High altitude camping adventure",
        rating: 4.7,
        reviewCount: 267,
        pricePerNight: 50,
        amenities: ["Mountain Views", "Hiking", "Wildlife"]
    }
];

export function HomeClient() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFilters, setSearchFilters] = useState<{
        location: string;
        dates: { checkIn: string; checkOut: string };
        guests: number;
    } | null>(null);

    // Fetch public campgrounds from our system
    const { data: internalCampgrounds = [], isLoading } = useQuery({
        queryKey: ["public-campgrounds"],
        queryFn: () => apiClient.getPublicCampgrounds()
    });

    // Combine and filter campgrounds
    const allCampgrounds = useMemo(() => {
        const internal = internalCampgrounds.map((cg) => {
            const rating = cg.reviewScore ?? undefined;
            const reviewCount = cg.reviewCount ?? undefined;

            let badge: string | undefined;
            if (typeof rating === "number" && typeof reviewCount === "number") {
                if (rating >= 4.7 && reviewCount >= 100) {
                    badge = "Top rated";
                } else if (rating >= 4.5 && reviewCount >= 20) {
                    badge = "Guest favorite";
                } else if (reviewCount < 10) {
                    badge = "Rising star";
                }
            }

            return {
                ...cg,
                isInternal: true,
                rating,
                reviewCount,
                pricePerNight: cg.pricePerNight ?? undefined,
                ratingBadge: badge
            };
        });

        const externalWithBadges = externalCampgrounds.map((cg) => ({
            ...cg,
            isInternal: false,
            ratingBadge: cg.reviewCount && cg.reviewCount > 150 ? "Popular pick" : undefined
        }));

        const combined = [...internal, ...externalWithBadges];

        // Build search terms from query and location filter
        const searchTerms: string[] = [];
        if (searchQuery) searchTerms.push(searchQuery.toLowerCase());
        if (searchFilters?.location) searchTerms.push(searchFilters.location.toLowerCase());

        // If no filters, return all
        if (searchTerms.length === 0) {
            return combined;
        }

        // Filter campgrounds that match ANY search term
        return combined.filter((cg) => {
            const searchableText = [
                cg.name,
                cg.city,
                cg.state,
                "country" in cg ? cg.country : "",
                "tagline" in cg ? cg.tagline : "",
                "amenities" in cg ? cg.amenities?.join(" ") : ""
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchTerms.some((term) => searchableText.includes(term));
        });
    }, [internalCampgrounds, searchQuery, searchFilters]);

    const handleSearch = (query: string, filters: typeof searchFilters) => {
        setSearchQuery(query);
        setSearchFilters(filters);
    };

    useEffect(() => {
        trackEvent("page_view", { page: "/" });
    }, []);

    return (
        <div className="min-h-screen max-w-[480px] mx-auto sm:max-w-none sm:mx-0">
            {/* Hero Section */}
            <section className="relative overflow-hidden">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700" />

                {/* Decorative elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
                    <svg className="absolute bottom-0 left-0 right-0 text-white/5" viewBox="0 0 1440 320">
                        <path fill="currentColor" d="M0,192L48,197.3C96,203,192,213,288,229.3C384,245,480,267,576,250.7C672,235,768,181,864,181.3C960,181,1056,235,1152,234.7C1248,235,1344,181,1392,154.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
                    </svg>
                </div>

                {/* Content */}
                <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                            Find Your Perfect
                            <span className="block bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
                                Camping Adventure with Camp Everyday
                            </span>
                        </h1>
                        <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
                            Discover amazing campgrounds, RV parks, and cabins across the country.
                            Book your next outdoor escape today.
                        </p>
                    </div>

                    <SearchBar onSearch={handleSearch} />

                    {/* Quick stats */}
                    <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
                        <div className="text-center">
                            <div className="text-3xl md:text-4xl font-bold text-white">500+</div>
                            <div className="text-sm text-white/70">Campgrounds</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl md:text-4xl font-bold text-white">50K+</div>
                            <div className="text-sm text-white/70">Happy Campers</div>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl md:text-4xl font-bold text-white">4.8★</div>
                            <div className="text-sm text-white/70">Avg Rating</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Campgrounds */}
            <section className="max-w-7xl mx-auto px-6 py-16">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                            {searchQuery ? "Search Results" : "Featured Campgrounds"}
                        </h2>
                        <p className="text-slate-600 mt-1">
                            {searchQuery
                                ? `${allCampgrounds.length} campgrounds found`
                                : "Discover top-rated destinations"}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            Tap the heart to save a campground. Saved lists stay on this device for now.
                        </p>
                    </div>
                    <div className="w-full sm:w-auto flex items-center gap-2">
                        <span className="text-sm text-slate-500 whitespace-nowrap">Sort by:</span>
                        <select className="flex-1 sm:flex-none w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                            <option>Recommended</option>
                            <option>Price: Low to High</option>
                            <option>Price: High to Low</option>
                            <option>Rating</option>
                            <option>Reviews</option>
                        </select>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-lg animate-pulse">
                                <div className="aspect-[4/3] bg-slate-200" />
                                <div className="p-5 space-y-3">
                                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                                    <div className="h-5 bg-slate-200 rounded w-2/3" />
                                    <div className="h-4 bg-slate-200 rounded w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {allCampgrounds.map((campground) => (
                            <CampgroundCard
                                key={campground.id}
                                id={campground.id}
                                name={campground.name}
                                slug={"slug" in campground ? campground.slug : undefined}
                                city={campground.city || undefined}
                                state={campground.state || undefined}
                                country={"country" in campground ? (campground.country || undefined) : undefined}
                                imageUrl={"heroImageUrl" in campground ? (campground.heroImageUrl || undefined) : undefined}
                                isInternal={campground.isInternal}
                                rating={campground.rating}
                                reviewCount={campground.reviewCount}
                                pricePerNight={campground.pricePerNight}
                                amenities={"amenities" in campground ? campground.amenities : []}
                                onExplore={() => trackEvent("site_card_view", { campgroundId: campground.id, page: "/" })}
                            />
                        ))}
                    </div>
                )}

                {!isLoading && allCampgrounds.length === 0 && (
                    <div className="text-center py-16">
                        <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">No campgrounds found</h3>
                        <p className="text-slate-600">Try adjusting your search or filters</p>
                    </div>
                )}
            </section>

            {/* Why Campreserv Section */}
            <section className="bg-slate-50 py-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                            Why Choose Camp Everyday?
                        </h2>
                        <p className="text-slate-600 max-w-2xl mx-auto">
                            We partner with the best campgrounds to bring you verified listings,
                            instant booking, and premium outdoor experiences.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-900/5">
                            <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Verified Listings</h3>
                            <p className="text-slate-600">
                                All campgrounds marked "Verified" are personally vetted for quality,
                                amenities, and guest satisfaction.
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-900/5">
                            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-violet-500/20">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Instant Booking</h3>
                            <p className="text-slate-600">
                                Book your perfect site in seconds. Real-time availability,
                                instant confirmation, zero hassle.
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-slate-900/5">
                            <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
                                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Best Price Promise</h3>
                            <p className="text-slate-600">
                                Find a lower price? We'll match it. Plus, exclusive deals and
                                discounts for our members.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Demo request */}
            <section className="bg-white py-16 border-y border-slate-100">
                <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
                    <div className="space-y-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">Request a demo</div>
                        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                            Want more bookings or a smoother operation?
                        </h2>
                        <p className="text-slate-600">
                            Tell us what you want to improve. We’ll follow up with a tailored walkthrough—no spam, no auto-sync to external tools.
                        </p>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li>• Name + email + interest captured securely</li>
                            <li>• Scoped to your selected campground (or the public demo)</li>
                            <li>• No third-party sync—stays inside Camp Everyday</li>
                        </ul>
                    </div>
                    <LeadCaptureForm
                        defaultCampgroundId="public-site"
                        defaultCampgroundName="Camp Everyday demo"
                        title="Request a walkthrough"
                    />
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                        Own a Campground?
                    </h2>
                    <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
                        Join hundreds of campground owners who use Camp Everyday Host to manage reservations,
                        streamline operations, and grow their business.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <a
                            href="/auth/signin?callbackUrl=/dashboard"
                            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        >
                            Get Started Free
                        </a>
                        <a
                            href="/owners"
                            className="px-8 py-4 text-slate-700 font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Learn More
                        </a>
                    </div>
                </div>
            </section>
        </div>
    );
}
