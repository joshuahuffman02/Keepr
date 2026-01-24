"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// DOMPurify requires browser DOM - lazy load only on client
let DOMPurify: { sanitize: (html: string) => string } | null = null;
if (typeof window !== "undefined") {
  DOMPurify = require("dompurify");
}
import {
  MapPin,
  Star,
  Calendar,
  ExternalLink,
  Building2,
  Trees,
  Globe,
  Phone,
  Share2,
  Heart,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { trackEvent } from "@/lib/analytics";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { TrustBadges } from "@/components/public/TrustBadges";
import { WhyBookDirect } from "@/components/public/WhyBookDirect";

// Import new campground components
import {
  PhotoGalleryGrid,
  BookingSidebar,
  MobileBookingBar,
  QuickFacts,
  AmenitiesSection,
  ReviewsSection,
  SiteClassCards,
  CharityBadge,
  CharityFloatingBadge,
  FadeInSection,
} from "@/components/campground";

type PublicCampgroundDetail = Awaited<ReturnType<typeof apiClient.getPublicCampground>>;

type SiteClassWithType = {
  id: string;
  name: string;
  siteType?: string | null;
  description?: string | null;
  defaultRate?: number | null;
  maxOccupancy?: number | null;
  hookupsPower?: boolean | null;
  hookupsWater?: boolean | null;
  hookupsSewer?: boolean | null;
  petFriendly?: boolean | null;
  photoUrl?: string | null;
};

type Review = {
  id: string;
  rating: number;
  comment: string;
  reviewerName?: string;
  stayDate?: string;
};

type CampgroundEvent = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  description?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const parseSiteClasses = (value: unknown): SiteClassWithType[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<SiteClassWithType[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const id = readString(item.id);
    const name = readString(item.name);
    if (!id || !name) return acc;
    const entry: SiteClassWithType = { id, name };
    const siteType = readString(item.siteType);
    if (siteType !== undefined) entry.siteType = siteType;
    const description = readString(item.description);
    if (description !== undefined) entry.description = description;
    const defaultRate = readNumber(item.defaultRate);
    if (defaultRate !== undefined) entry.defaultRate = defaultRate;
    const maxOccupancy = readNumber(item.maxOccupancy);
    if (maxOccupancy !== undefined) entry.maxOccupancy = maxOccupancy;
    const hookupsPower = readBoolean(item.hookupsPower);
    if (hookupsPower !== undefined) entry.hookupsPower = hookupsPower;
    const hookupsWater = readBoolean(item.hookupsWater);
    if (hookupsWater !== undefined) entry.hookupsWater = hookupsWater;
    const hookupsSewer = readBoolean(item.hookupsSewer);
    if (hookupsSewer !== undefined) entry.hookupsSewer = hookupsSewer;
    const petFriendly = readBoolean(item.petFriendly);
    if (petFriendly !== undefined) entry.petFriendly = petFriendly;
    const photoUrl = readString(item.photoUrl);
    if (photoUrl !== undefined) entry.photoUrl = photoUrl;
    acc.push(entry);
    return acc;
  }, []);
};

const parseReviews = (value: unknown): Review[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<Review[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const id = readString(item.id);
    const rating = readNumber(item.rating);
    const comment = readString(item.comment);
    if (!id || rating === undefined || !comment) return acc;
    const review: Review = { id, rating, comment };
    const reviewerName = readString(item.reviewerName);
    if (reviewerName) review.reviewerName = reviewerName;
    const stayDate = readString(item.stayDate);
    if (stayDate) review.stayDate = stayDate;
    acc.push(review);
    return acc;
  }, []);
};

const parseAmenities = (value: unknown): string[] => (isStringArray(value) ? value : []);

const parseEvents = (value: unknown): CampgroundEvent[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<CampgroundEvent[]>((acc, item) => {
    if (!isRecord(item)) return acc;
    const id = readString(item.id);
    const title = readString(item.title);
    if (!id || !title) return acc;
    const event: CampgroundEvent = { id, title };
    const startDate = readString(item.startDate);
    if (startDate) event.startDate = startDate;
    const endDate = readString(item.endDate);
    if (endDate) event.endDate = endDate;
    const description = readString(item.description);
    if (description) event.description = description;
    acc.push(event);
    return acc;
  }, []);
};

function nextWeekendRange() {
  const today = new Date();
  const day = today.getDay();
  const daysUntilFri = (5 - day + 7) % 7 || 7;
  const arrival = new Date(today);
  arrival.setDate(arrival.getDate() + daysUntilFri);
  const departure = new Date(arrival);
  departure.setDate(departure.getDate() + 2);
  return {
    arrival: arrival.toISOString().split("T")[0],
    departure: departure.toISOString().split("T")[0],
  };
}

export function CampgroundV2Client({
  slug,
  initialData,
  previewToken,
}: {
  slug: string;
  initialData: PublicCampgroundDetail | null;
  previewToken?: string;
}) {
  const searchParams = useSearchParams();
  const { data: campground } = useQuery({
    queryKey: ["public-campground", slug, previewToken],
    queryFn: () => apiClient.getPublicCampground(slug, previewToken),
    initialData,
  });

  const defaultDates = useMemo(() => nextWeekendRange(), []);

  // Form state
  const [arrivalDate, setArrivalDate] = useState(
    searchParams?.get("arrival") || defaultDates.arrival,
  );
  const [departureDate, setDepartureDate] = useState(
    searchParams?.get("departure") || defaultDates.departure,
  );
  const paramGuests = searchParams?.get("guests");
  const paramAdults = searchParams?.get("adults");
  const paramChildren = searchParams?.get("children");
  const totalGuests =
    paramGuests ||
    (paramAdults ? (Number(paramAdults) + Number(paramChildren || 0)).toString() : "2");
  const [guests, setGuests] = useState(totalGuests);

  // Fetch value stack (guarantees, bonuses, charity)
  const { data: valueStack } = useQuery({
    queryKey: ["value-stack", campground?.id],
    queryFn: async () => {
      const res = await fetch(`/api/public/campgrounds/${campground!.id}/value-stack`);
      return res.ok ? res.json() : null;
    },
    enabled: !!campground?.id,
  });

  // Track page view
  useEffect(() => {
    if (campground?.id) {
      trackEvent("page_view", {
        page: `/park/${slug}/v2`,
        campgroundId: campground.id,
      });
    }
  }, [campground?.id, slug]);

  // Extract data with proper typing
  const campgroundExtras = isRecord(campground) ? campground : null;
  const siteClasses = parseSiteClasses(campground?.siteClasses);
  const photos = campground?.photos ?? [];
  const hero = campground?.heroImageUrl || photos[0];
  const events = parseEvents(campground?.events);
  const reviews = parseReviews(campgroundExtras?.reviews);
  const amenities = parseAmenities(campgroundExtras?.amenities);

  // Check if external (RIDB imported)
  const isExternal = readBoolean(campgroundExtras?.isExternal) ?? false;
  const isClaimable = readBoolean(campgroundExtras?.isClaimable) ?? false;
  const externalUrl = readString(campgroundExtras?.externalUrl) ?? null;
  const seededDataSource = readString(campgroundExtras?.seededDataSource) ?? null;
  const phone = readString(campgroundExtras?.phone) ?? campground?.phone ?? undefined;
  const website = readString(campgroundExtras?.website) ?? campground?.website ?? undefined;

  // Navigate to booking
  const handleBookClick = () => {
    trackEvent("booking_cta", {
      campgroundId: campground?.id,
      page: `/park/${slug}/v2`,
    });
    const q = new URLSearchParams({
      arrivalDate,
      departureDate,
      guests,
      ...(previewToken ? { token: previewToken } : {}),
    }).toString();
    window.location.href = `/park/${slug}/book?${q}`;
  };

  const handleSiteClassSelect = (siteClass: SiteClassWithType) => {
    trackEvent("accommodation_book_click", {
      siteClassId: siteClass.id,
      campgroundId: campground?.id,
    });
    const q = new URLSearchParams({
      arrivalDate,
      departureDate,
      siteType: siteClass.siteType || "all",
      guests,
      ...(previewToken ? { token: previewToken } : {}),
    }).toString();
    window.location.href = `/park/${slug}/book?${q}`;
  };

  // Share functionality
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campground?.name,
          text: campground?.tagline || `Check out ${campground?.name}!`,
          url: window.location.href,
        });
        trackEvent("share_click", { campgroundId: campground?.id });
      } catch (err) {
        // User cancelled
      }
    }
  };

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      {/* Skip to main content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-slate-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-emerald-500"
      >
        Skip to main content
      </a>

      {/* Photo Gallery Hero */}
      <section className="relative" aria-label="Campground photos">
        <PhotoGalleryGrid
          photos={photos.length > 0 ? photos : hero ? [hero] : []}
          campgroundName={campground?.name || "Campground"}
          isExternal={isExternal}
        />

        {/* Charity floating badge */}
        {valueStack?.charity && (
          <div className="absolute bottom-4 left-4 z-10">
            <CharityFloatingBadge
              charityName={valueStack.charity.charity.name}
              totalRaised={valueStack.charity.stats.totalAmountCents}
            />
          </div>
        )}
      </section>

      {/* Main content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 md:px-6 py-8 overflow-hidden">
        {/* Breadcrumbs */}
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Campgrounds", href: "/explore" },
            {
              label: campground?.state || "State",
              href: `/camping/${campground?.state?.toLowerCase().replace(/\s+/g, "-")}`,
            },
            { label: campground?.name || "Campground" },
          ]}
          className="mb-6 text-sm text-slate-500"
        />

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[minmax(0,1fr),380px] gap-8 lg:gap-12">
          {/* Left column - Content */}
          <div className="space-y-10 min-w-0">
            {/* Header */}
            <header className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                    {campground?.name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span>
                        {campground?.city}, {campground?.state}
                      </span>
                    </div>
                    {campground?.reviewScore && Number(campground.reviewCount) > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="font-medium">
                          {Number(campground.reviewScore).toFixed(1)}
                        </span>
                        <span className="text-slate-500">({campground.reviewCount} reviews)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    className="h-10 w-10"
                    aria-label="Share"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    aria-label="Save to favorites"
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {campground?.tagline && (
                <p className="text-lg text-slate-600">{campground.tagline}</p>
              )}
            </header>

            {/* External campground notice */}
            {isExternal && (
              <Card className="p-6 border-amber-200 bg-amber-50">
                <div className="flex items-start gap-4">
                  <Trees className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h2 className="font-semibold text-slate-900">
                      {seededDataSource === "recreation_gov"
                        ? "Federal Recreation Area"
                        : "Public Campground"}
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">
                      This campground is managed by{" "}
                      {seededDataSource === "recreation_gov"
                        ? "Recreation.gov"
                        : "an external provider"}
                      . Book directly through their official website.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {externalUrl && (
                        <Button
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => {
                            trackEvent("external_booking_click", {
                              campgroundId: campground?.id,
                              referrerUrl: externalUrl,
                            });
                            window.open(externalUrl, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Book on Recreation.gov
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {isClaimable && (
                        <Button variant="outline" asChild>
                          <Link href={`/claim/${slug}`}>
                            <Building2 className="h-4 w-4 mr-2" />
                            Claim This Listing
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Quick Facts */}
            <FadeInSection delay={0.1}>
              <QuickFacts
                siteClasses={siteClasses}
                amenities={amenities}
                city={campground?.city}
                state={campground?.state}
                totalSites={siteClasses.length}
              />
            </FadeInSection>

            {/* Divider */}
            <hr className="border-slate-200" />

            {/* About */}
            {campground?.description && (
              <FadeInSection delay={0.1}>
                <section className="space-y-4">
                  <h2 className="text-xl font-semibold text-slate-900">About {campground.name}</h2>
                  <div
                    className="text-slate-600 prose prose-sm prose-slate max-w-none [&>p]:mb-4"
                    dangerouslySetInnerHTML={{
                      __html:
                        DOMPurify?.sanitize(campground.description || "") ||
                        campground.description ||
                        "",
                    }}
                  />
                </section>
              </FadeInSection>
            )}

            {/* Charity Section (if enabled) */}
            {valueStack?.charity && (
              <>
                <hr className="border-slate-200" />
                <FadeInSection delay={0.1}>
                  <CharityBadge
                    charity={valueStack.charity.charity}
                    stats={valueStack.charity.stats}
                    customMessage={valueStack.charity.customMessage}
                    variant="full"
                  />
                </FadeInSection>
              </>
            )}

            {/* Accommodations */}
            {!isExternal && siteClasses.length > 0 && (
              <>
                <hr className="border-slate-200" />
                <FadeInSection delay={0.1}>
                  <SiteClassCards
                    siteClasses={siteClasses}
                    heroImage={hero}
                    onSelectSiteClass={handleSiteClassSelect}
                  />
                </FadeInSection>
              </>
            )}

            {/* Amenities */}
            {(amenities.length > 0 || siteClasses.length > 0) && (
              <>
                <hr className="border-slate-200" />
                <FadeInSection delay={0.1}>
                  <AmenitiesSection amenities={amenities} siteClasses={siteClasses} />
                </FadeInSection>
              </>
            )}

            {/* Reviews */}
            {!isExternal && (
              <>
                <hr className="border-slate-200" />
                <FadeInSection delay={0.1}>
                  <ReviewsSection
                    reviews={reviews}
                    averageRating={
                      campground?.reviewScore ? Number(campground.reviewScore) : undefined
                    }
                    totalCount={campground?.reviewCount ?? undefined}
                  />
                </FadeInSection>
              </>
            )}

            {/* Events */}
            {!isExternal && events.length > 0 && (
              <>
                <hr className="border-slate-200" />
                <FadeInSection delay={0.1}>
                  <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-slate-900">Upcoming Events</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {events.slice(0, 4).map((event) => (
                        <Card key={event.id} className="p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {event.startDate?.split("T")[0]}
                              {event.endDate &&
                                event.endDate !== event.startDate &&
                                ` - ${event.endDate.split("T")[0]}`}
                            </span>
                          </div>
                          <h3 className="font-semibold text-slate-900">{event.title}</h3>
                          {event.description && (
                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <button
                            className="flex items-center p-0 h-auto mt-2 text-emerald-600 text-sm font-medium hover:underline"
                            onClick={() => {
                              setArrivalDate(event.startDate?.split("T")[0] || arrivalDate);
                              setDepartureDate(event.endDate?.split("T")[0] || departureDate);
                            }}
                          >
                            Book for this event
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </button>
                        </Card>
                      ))}
                    </div>
                  </section>
                </FadeInSection>
              </>
            )}

            {/* Contact & Location */}
            {!isExternal && (
              <>
                <hr className="border-slate-200" />
                <FadeInSection delay={0.1}>
                  <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-slate-900">Location & Contact</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <MapPin className="h-5 w-5 text-slate-400" />
                          <div>
                            <div className="font-medium text-slate-900">Address</div>
                            <div className="text-sm text-slate-600">
                              {campground?.city}, {campground?.state}
                            </div>
                          </div>
                        </div>
                        {phone && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-slate-400" />
                            <div>
                              <div className="font-medium text-slate-900">Phone</div>
                              <a
                                href={`tel:${phone}`}
                                className="text-sm text-emerald-600 hover:underline"
                              >
                                {phone}
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {website && (
                          <div className="flex items-center gap-3">
                            <Globe className="h-5 w-5 text-slate-400" />
                            <div>
                              <div className="font-medium text-slate-900">Website</div>
                              <a
                                href={website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-emerald-600 hover:underline"
                              >
                                Visit website
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </FadeInSection>
              </>
            )}

            {/* Why Book Direct */}
            {!isExternal && <WhyBookDirect campgroundName={campground?.name} />}

            {/* Trust badges */}
            {!isExternal && <TrustBadges variant="stacked" className="justify-start" />}

            {/* RIDB Attribution */}
            {seededDataSource === "recreation_gov" && (
              <div className="text-xs text-slate-400 pt-4">
                Campground data provided by{" "}
                <a
                  href="https://ridb.recreation.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-slate-600"
                >
                  Recreation Information Database (RIDB)
                </a>
              </div>
            )}
          </div>

          {/* Right column - Sticky Booking Sidebar (desktop only) */}
          {!isExternal && (
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <BookingSidebar
                  campgroundName={campground?.name || "Campground"}
                  campgroundSlug={slug}
                  siteClasses={siteClasses}
                  reviewScore={campground?.reviewScore ? Number(campground.reviewScore) : undefined}
                  reviewCount={campground?.reviewCount ?? undefined}
                  arrivalDate={arrivalDate}
                  departureDate={departureDate}
                  guests={guests}
                  onArrivalChange={setArrivalDate}
                  onDepartureChange={setDepartureDate}
                  onGuestsChange={setGuests}
                  onBookClick={handleBookClick}
                  previewToken={previewToken}
                  charityName={valueStack?.charity?.charity?.name}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* AI Chat Widget */}
      {campground?.id && !isExternal && (
        <AiChatWidget campgroundId={campground.id} campgroundName={campground.name} />
      )}

      {/* Mobile Booking Bar */}
      {!isExternal && (
        <MobileBookingBar
          priceFrom={
            siteClasses.length > 0
              ? Math.min(
                  ...siteClasses.map((sc) => (sc.defaultRate || 0) / 100).filter((p) => p > 0),
                ) || null
              : null
          }
          reviewScore={campground?.reviewScore ? Number(campground.reviewScore) : undefined}
          reviewCount={campground?.reviewCount ?? undefined}
          arrivalDate={arrivalDate}
          departureDate={departureDate}
          guests={guests}
          onArrivalChange={setArrivalDate}
          onDepartureChange={setDepartureDate}
          onGuestsChange={setGuests}
          onBookClick={handleBookClick}
          charityName={valueStack?.charity?.charity?.name}
        />
      )}
    </div>
  );
}
