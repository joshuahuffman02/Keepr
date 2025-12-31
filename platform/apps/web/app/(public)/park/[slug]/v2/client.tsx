"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  ArrowRight, Calendar, MapPin, Search, Sparkles, Users, AlertCircle,
  Shield, Gift, ChevronLeft, ChevronRight, Mail, Check, Flame, Coffee,
  Tent, ShieldCheck, CloudRain, DollarSign, Umbrella, BadgeCheck, Clock, Star,
  ExternalLink, Building2, Trees, Phone, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { trackEvent } from "@/lib/analytics";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { TrustBadges } from "@/components/public/TrustBadges";
import { FeaturedReview } from "@/components/public/FeaturedReview";
import { WhyBookDirect } from "@/components/public/WhyBookDirect";
import { StickyBookingBar } from "@/components/public/StickyBookingBar";
import { ScarcityBadge } from "@/components/public/ScarcityIndicator";
import dynamic from "next/dynamic";

const BookingMap = dynamic(() => import("@/components/maps/BookingMap"), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-slate-100 animate-pulse rounded-xl" />
});

type PublicCampgroundDetail = Awaited<ReturnType<typeof apiClient.getPublicCampground>>;

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
    departure: departure.toISOString().split("T")[0]
  };
}

export function CampgroundV2Client({ slug, initialData, previewToken }: { slug: string; initialData: PublicCampgroundDetail | null; previewToken?: string }) {
  const searchParams = useSearchParams();
  const { data: campground } = useQuery({
    queryKey: ["public-campground", slug, previewToken],
    queryFn: () => apiClient.getPublicCampground(slug, previewToken),
    initialData
  });

  const defaultDates = useMemo(() => nextWeekendRange(), []);

  // Initialize from URL params or defaults
  const [arrivalDate, setArrivalDate] = useState(searchParams?.get("arrival") || defaultDates.arrival);
  const [departureDate, setDepartureDate] = useState(searchParams?.get("departure") || defaultDates.departure);

  // Combine adults+children for guests count if needed, or take direct "guests" param
  const paramGuests = searchParams?.get("guests");
  const paramAdults = searchParams?.get("adults");
  const paramChildren = searchParams?.get("children");

  const totalGuests = paramGuests || (paramAdults ? (Number(paramAdults) + Number(paramChildren || 0)).toString() : "2");

  const [guests, setGuests] = useState(totalGuests);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>(undefined);

  const { data: sitesStatus, isLoading: sitesLoading } = useQuery({
    queryKey: ["sites-status", campground?.id, arrivalDate, departureDate],
    queryFn: () =>
      apiClient.getSitesWithStatus(campground!.id, {
        arrivalDate,
        departureDate,
      }),
    enabled: !!campground?.id && !!arrivalDate && !!departureDate,
  });

  // Fetch value stack (guarantees, bonuses, lead config)
  const { data: valueStack } = useQuery({
    queryKey: ["value-stack", campground?.id],
    queryFn: async () => {
      const res = await fetch(`/api/public/campgrounds/${campground!.id}/value-stack`);
      return res.ok ? res.json() : null;
    },
    enabled: !!campground?.id,
  });

  // Lead capture state
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const submitLead = async (source: string) => {
    if (!leadEmail || !campground?.id) return;
    setLeadSubmitting(true);
    try {
      await fetch(`/api/public/campgrounds/${campground.id}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: leadEmail, source }),
      });
      setLeadSubmitted(true);
      trackEvent("lead_captured", { campgroundId: campground.id, source });
    } catch (e) {
      console.error("Lead capture failed", e);
    }
    setLeadSubmitting(false);
  };

  // Gallery state for keyboard navigation
  const [galleryIndex, setGalleryIndex] = useState(0);

  type Review = {
    id: string;
    rating: number;
    comment: string;
    reviewerName?: string;
    stayDate?: string;
  };

  type FAQ = {
    question: string;
    answer: string;
  };

  type CampgroundWithExtras = typeof campground & {
    reviews?: Review[];
    faqs?: FAQ[];
  };

  const campgroundExtended = campground as CampgroundWithExtras;
  const events = campground?.events ?? [];
  const promotions = campground?.promotions ?? [];
  const reviews = (campgroundExtended?.reviews ?? []) as Review[];
  const faq = campgroundExtended?.faqs ?? [];
  const siteClasses = campground?.siteClasses ?? [];
  const photos = campground?.photos ?? [];
  const hero = campground?.heroImageUrl || photos[0];

  // Check if this is an external/unclaimed campground (RIDB imported)
  const isExternal = (campground as any)?.isExternal ?? false;
  const isClaimable = (campground as any)?.isClaimable ?? false;
  const externalUrl = (campground as any)?.externalUrl as string | null;
  const seededDataSource = (campground as any)?.seededDataSource as string | null;

  useEffect(() => {
    if (campground?.id) {
      trackEvent("page_view", { page: `/park/${slug}/v2`, campgroundId: campground.id });
    }
  }, [campground?.id, slug]);

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

  const typedSiteClasses = siteClasses as SiteClassWithType[];
  const filteredSiteClasses = typedSiteClasses.filter((sc) => {
    if (typeFilter === "all") return true;
    return (sc.siteType || "").toLowerCase() === typeFilter;
  });

  return (
    <div className="bg-white text-slate-900">
      {/* Skip to main content link for accessibility */}
      <a
        href="#availability"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-slate-900 focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-emerald-500"
      >
        Skip to available stays
      </a>

      {/* Hero */}
      <section className="relative" aria-label="Campground hero">
        <div className="h-[60vh] w-full overflow-hidden rounded-b-3xl bg-slate-900">
          {hero ? (
            <Image
              src={hero}
              alt={`${campground?.name || "Campground"} - ${campground?.tagline || "scenic outdoor camping destination"} in ${campground?.city}, ${campground?.state}`}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600" aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" aria-hidden="true" />
        </div>
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto max-w-6xl w-full px-6 pb-8 flex flex-col gap-4">
            {/* Breadcrumbs */}
            <div className="mb-2">
              <Breadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Parks", href: "/" },
                  { label: campground?.name || "Park" }
                ]}
                className="flex items-center gap-2 text-sm text-white/80"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-white">
              <Badge variant="secondary" className="bg-white/15 border-white/20 text-white">
                {campground?.city}, {campground?.state}
              </Badge>
              {campground?.reviewScore ? (
                <Badge variant="secondary" className="bg-white/15 border-white/20 text-white flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {Number(campground.reviewScore).toFixed(1)} ({campground.reviewCount ?? 0})
                </Badge>
              ) : null}
            </div>
            <div className="text-white">
              <h1 className="text-4xl md:text-5xl font-bold">{campground?.name ?? "Campground"}</h1>
              {campground?.tagline && <p className="text-lg text-white/80 mt-2">{campground.tagline}</p>}
            </div>
            {/* Booking bar - different for external vs internal campgrounds */}
            {isExternal ? (
              <div className="bg-white rounded-2xl shadow-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-slate-600 mb-2">
                    <Trees className="h-4 w-4" />
                    <span className="text-sm">
                      {seededDataSource === "recreation_gov" ? "Federal Recreation Area" : "Public Campground"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    This campground is managed by {seededDataSource === "recreation_gov" ? "Recreation.gov" : "an external provider"}.
                    Book directly through their official website.
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {externalUrl && (
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        trackEvent("external_booking_click", { campgroundId: campground?.id, referrerUrl: externalUrl || "" });
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
            ) : (
              <div className="bg-white rounded-2xl shadow-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex flex-1 flex-wrap gap-3">
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="border-none bg-transparent px-0 text-sm" />
                    <span className="text-slate-400">→</span>
                    <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="border-none bg-transparent px-0 text-sm" />
                  </div>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                    <Users className="h-4 w-4 text-slate-500" />
                    <Select value={guests} onValueChange={setGuests}>
                      <SelectTrigger className="w-[120px] border-none bg-transparent px-0">
                        <SelectValue placeholder="Guests" />
                      </SelectTrigger>
                      <SelectContent>
                        {["1", "2", "3", "4", "5", "6", "7", "8"].map((g) => (
                          <SelectItem key={g} value={g}>{g} guest{g === "1" ? "" : "s"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                    <Sparkles className="h-4 w-4 text-slate-500" />
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[150px] border-none bg-transparent px-0">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="rv">RV</SelectItem>
                        <SelectItem value="cabin">Cabin</SelectItem>
                        <SelectItem value="tent">Tent</SelectItem>
                        <SelectItem value="glamping">Glamping</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      trackEvent("booking_cta", { campgroundId: campground?.id, page: `/park/${slug}/v2` });
                      const q = new URLSearchParams({
                        arrivalDate,
                        departureDate,
                        guests,
                        ...(previewToken ? { token: previewToken } : {})
                      }).toString();
                      window.location.href = `/park/${slug}/book?${q}`;
                    }}
                  >
                    Check availability
                  </Button>
                  <Button variant="outline" onClick={() => window.location.href = "#availability"}>
                    View availability
                  </Button>
                </div>
              </div>
            )}

            {/* Trust badges */}
            <TrustBadges variant="compact" className="mt-4 justify-center text-white/90" />
          </div>
        </div>
      </section>

      {/* Immersive Map Explorer - only shown if enabled and NOT external */}
      {campground?.showPublicMap && !isExternal && (
        <section className="w-full bg-slate-900 overflow-hidden">
          <div className="relative h-[70vh] min-h-[520px] group">
            <BookingMap
              sites={(sitesStatus || []).map(s => ({
                ...s,
                latitude: s.latitude ?? null,
                longitude: s.longitude ?? null
              }))}
              campgroundCenter={{
                latitude: campground?.latitude ? Number(campground.latitude) : null,
                longitude: campground?.longitude ? Number(campground.longitude) : null
              }}
              isLoading={sitesLoading}
              selectedSiteId={selectedSiteId}
              onSelectSite={(id) => {
                setSelectedSiteId(id);
                const element = document.getElementById("availability");
                if (element) {
                  element.scrollIntoView({ behavior: "smooth" });
                }
              }}
              height="100%"
              variant="immersive"
            />
            <div className="absolute top-6 left-6 z-10 pointer-events-none max-w-sm">
              <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/20 pointer-events-auto">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Explore the Grounds
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tap pins to view site details and availability for your selected dates.
                </p>
                {selectedSiteId && (
                  <div className="mt-3 p-3 bg-status-success/15 rounded-xl border border-status-success/30 animate-in fade-in slide-in-from-top-2">
                    <div className="text-xs font-bold text-status-success uppercase tracking-wider">Currently Selection</div>
                    <div className="font-semibold text-slate-900 mt-0.5">
                      {sitesStatus?.find(s => s.id === selectedSiteId)?.siteNumber} ({sitesStatus?.find(s => s.id === selectedSiteId)?.siteClassName})
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        const site = sitesStatus?.find(s => s.id === selectedSiteId);
                        if (site) {
                          trackEvent("map_site_book_click", { siteId: selectedSiteId, campgroundId: campground?.id });
                          const q = new URLSearchParams({
                            arrivalDate,
                            departureDate,
                            siteType: site.siteType || "all",
                            siteId: site.id,
                            guests,
                            ...(previewToken ? { token: previewToken } : {})
                          }).toString();
                          window.location.href = `/park/${slug}/book?${q}`;
                        }
                      }}
                    >
                      Reserve This Spot
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-6 right-6 z-10 hidden md:block">
              <Badge className="bg-slate-900/80 text-white backdrop-blur-md border-white/10 px-3 py-1.5 text-xs">
                Live Availability Powered by Camp Everyday
              </Badge>
            </div>
          </div>
        </section>
      )}

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Preview strip for reviews/FAQ */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card className="p-4 border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Guest reviews</h2>
              <Button variant="ghost" size="sm" onClick={() => (window.location.href = "/reviews")}>
                See all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            {reviews && reviews.length > 0 ? (
              <div className="space-y-2">
                {reviews.slice(0, 1).map((rev) => (
                  <div key={rev.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">{rev.reviewerName || "Guest"}</div>
                      {rev.rating && <Badge variant="secondary" className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rev.rating}</Badge>}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">{rev.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-10 h-10 bg-status-warning/15 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="h-5 w-5 text-status-warning" />
                </div>
                <p className="text-sm text-slate-600">Be the first to share your experience!</p>
                <p className="text-xs text-slate-400 mt-1">Reviews appear after your stay</p>
              </div>
            )}
          </Card>
          <Card className="p-4 border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">FAQ</h2>
              <Button variant="ghost" size="sm" onClick={() => (window.location.href = "#faq")}>
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            {faq && faq.length > 0 ? (
              <div className="space-y-1">
                {faq.slice(0, 2).map((item, idx: number) => (
                  <div key={idx} className="space-y-1">
                    <div className="font-semibold text-slate-900">{item.question}</div>
                    <p className="text-sm text-slate-700 line-clamp-2">{item.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Common questions will appear here once added.</p>
            )}
          </Card>
        </section>

        {/* Featured Review - highlight top review */}
        {reviews && reviews.length > 0 && reviews[0].rating >= 4 && (
          <section className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <FeaturedReview
                review={{
                  id: reviews[0].id,
                  rating: reviews[0].rating || 5,
                  comment: reviews[0].comment || "",
                  guestName: reviews[0].reviewerName || "Guest",
                  stayDate: reviews[0].stayDate,
                  isVerified: true,
                }}
                variant="light"
                className="h-full"
              />
            </div>
            <div className="hidden md:block">
              <WhyBookDirect variant="compact" />
            </div>
          </section>
        )}

        {/* FAQ + Reviews side rail */}
        <section id="faq" className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">FAQ</h2>
            {faq && faq.length > 0 ? (
              <div className="space-y-3">
                {faq.slice(0, 6).map((item, idx: number) => (
                  <Card key={idx} className="p-4 border-slate-200">
                    <div className="font-semibold text-slate-900">{item.question}</div>
                    <p className="text-sm text-slate-600 mt-1">{item.answer}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-4 text-sm text-slate-600 border-dashed border-slate-200">
                Common questions will appear here once added.
              </Card>
            )}
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Guest reviews</h2>
            {reviews && reviews.length > 0 ? (
              reviews.slice(0, 3).map((rev) => (
                <Card key={rev.id} className="p-4 border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{rev.reviewerName || "Guest"}</div>
                    {rev.rating && <Badge variant="secondary" className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rev.rating}</Badge>}
                  </div>
                  <p className="text-sm text-slate-700 line-clamp-3">{rev.comment}</p>
                  {rev.stayDate && <div className="text-xs text-slate-500">Stayed {rev.stayDate}</div>}
                </Card>
              ))
            ) : (
              <Card className="p-4 text-sm text-slate-600 border-dashed border-slate-200">
                Reviews will appear here once available.
              </Card>
            )}
            <Button variant="outline" className="w-full" onClick={() => window.location.href = "/reviews"}>
              See all reviews
            </Button>
          </div>
        </section>
        {/* Events rail */}
        {events.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Events & offers</h2>
              <Button variant="ghost" size="sm" onClick={() => window.location.href = "#availability"}>
                Book from events <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-2">
                {events.map((event) => {
                  const eventStart = event.startDate?.split("T")[0];
                  const eventEnd = event.endDate ? event.endDate.split("T")[0] : eventStart;
                  return (
                    <Card key={event.id} className="overflow-hidden border-slate-200 hover:shadow-md transition">
                      <div className="relative h-40 w-full bg-slate-100">
                        <Image src={event.imageUrl || event.photoUrl || hero || "/placeholder.png"} alt={event.title} fill className="object-cover" />
                        <div className="absolute top-3 left-3 flex gap-2">
                          <Badge variant="secondary" className="bg-black/60 text-white border-white/10">
                            {event.eventType || "Event"}
                          </Badge>
                          {event.priceCents === 0 && <Badge variant="secondary" className="bg-emerald-600 text-white border-emerald-500">Free</Badge>}
                        </div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="h-4 w-4" />
                          <span>{eventStart} → {eventEnd}</span>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                        {event.description && <p className="text-sm text-slate-600 line-clamp-2">{event.description}</p>}
                        <div className="flex flex-wrap gap-2">
                          {event.location && <Badge variant="outline">{event.location}</Badge>}
                          {event.priceCents ? <Badge variant="outline">From ${(event.priceCents / 100).toFixed(0)}</Badge> : null}
                        </div>
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => {
                            setArrivalDate(eventStart);
                            setDepartureDate(eventEnd);
                            window.location.href = "#availability";
                          }}
                        >
                          Book these dates
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {promotions.length > 0 && (
                <div className="space-y-3">
                  {promotions.map((promo) => (
                    <Card key={promo.id} className="p-4 border-status-error/30 bg-status-error/10 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-status-error">Deal</div>
                        {promo.validTo && <Badge variant="secondary" className="bg-status-error text-white border-status-error">Ends {promo.validTo.split("T")[0]}</Badge>}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{promo.code}</h3>
                      <p className="text-sm text-slate-600">{promo.description || "Special offer for your stay."}</p>
                      <Button
                        className="w-full mt-3 bg-white text-status-error border border-status-error/30 hover:bg-status-error/10"
                        onClick={() => {
                          const q = new URLSearchParams({
                            arrivalDate,
                            departureDate,
                            promoCode: promo.code,
                            ...(previewToken ? { token: previewToken } : {})
                          }).toString();
                          window.location.href = `/park/${slug}/book?${q}`;
                        }}
                      >
                        Apply & book
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Events & offers</h2>
            <Card className="p-6 border-dashed border-slate-200 bg-gradient-to-br from-status-success/10 to-teal-50">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 bg-status-success/15 rounded-full flex items-center justify-center mx-auto">
                  <Sparkles className="h-6 w-6 text-status-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {valueStack?.leadCaptureConfig?.eventsHeadline || "Something exciting is coming..."}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {valueStack?.leadCaptureConfig?.eventsSubtext || "Sign up to be the first to know about special events and deals"}
                  </p>
                </div>
                {!leadSubmitted ? (
                  <div className="flex gap-2 max-w-sm mx-auto">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      className="flex-1"
                      aria-label="Email address for event notifications"
                    />
                    <Button
                      onClick={() => submitLead("events_notify")}
                      disabled={leadSubmitting || !leadEmail}
                      className="bg-emerald-600 hover:bg-emerald-700 transition-all duration-150 hover:scale-105 active:scale-95"
                    >
                      {leadSubmitting ? (
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>{valueStack?.leadCaptureConfig?.eventsButtonText || "Notify Me"}</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-status-success animate-in fade-in zoom-in duration-300">
                    <div className="w-6 h-6 bg-status-success/15 rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                    <span className="font-medium">You're on the list!</span>
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}

        {/* Availability cards - or external campground info section */}
        {isExternal ? (
          <section id="availability" className="space-y-6">
            {/* About this campground */}
            <Card className="p-6 border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">About {campground?.name}</h2>
              {campground?.description && (
                <div
                  className="text-slate-600 mb-4 prose prose-sm prose-slate max-w-none [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mt-4 [&>h2]:mb-2 [&>p]:mb-2"
                  dangerouslySetInnerHTML={{ __html: campground.description }}
                />
              )}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-5 w-5 text-slate-400" />
                    <div>
                      <div className="font-medium text-slate-900">Location</div>
                      <div className="text-sm text-slate-600">
                        {campground?.city && campground?.state
                          ? `${campground.city}, ${campground.state}`
                          : campground?.state || "Location varies"}
                      </div>
                    </div>
                  </div>
                  {(campground as any)?.amenities?.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-slate-400 mt-0.5" />
                      <div>
                        <div className="font-medium text-slate-900">Amenities</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {((campground as any).amenities as string[]).slice(0, 6).map((a, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{a}</Badge>
                          ))}
                          {((campground as any).amenities as string[]).length > 6 && (
                            <Badge variant="outline" className="text-xs">+{((campground as any).amenities as string[]).length - 6} more</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {(campground as any)?.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-900">Website</div>
                        <a
                          href={(campground as any).website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-emerald-600 hover:underline"
                        >
                          Visit official website
                        </a>
                      </div>
                    </div>
                  )}
                  {(campground as any)?.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-medium text-slate-900">Phone</div>
                        <a
                          href={`tel:${(campground as any).phone}`}
                          className="text-sm text-emerald-600 hover:underline"
                        >
                          {(campground as any).phone}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Book externally CTA */}
            <Card className="p-6 border-emerald-200 bg-emerald-50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Ready to book?</h3>
                  <p className="text-sm text-slate-600">
                    Make a reservation directly through {seededDataSource === "recreation_gov" ? "Recreation.gov" : "the official website"}.
                  </p>
                </div>
                {externalUrl && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      trackEvent("external_booking_click", { campgroundId: campground?.id, referrerUrl: externalUrl || "" });
                      window.open(externalUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Book on Recreation.gov
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </Card>

            {/* Claim This Listing CTA */}
            {isClaimable && (
              <Card className="p-6 border-amber-200 bg-amber-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-slate-900">Own or manage this campground?</h3>
                    </div>
                    <p className="text-sm text-slate-600">
                      Claim your free listing to manage bookings, respond to reviews, and update your campground information.
                    </p>
                  </div>
                  <Button variant="outline" className="border-amber-300 hover:bg-amber-100" asChild>
                    <Link href={`/claim/${slug}`}>
                      Claim This Listing
                    </Link>
                  </Button>
                </div>
              </Card>
            )}

            {/* RIDB Attribution */}
            {seededDataSource === "recreation_gov" && (
              <div className="text-center text-xs text-slate-400 py-4">
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
          </section>
        ) : (
          <section id="availability" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Available stays</h2>
              <div className="text-sm text-slate-500">Based on your dates and filters</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredSiteClasses.map((sc: SiteClassWithType, idx: number) => {
                // Stub scarcity data - in production this would come from availability API
                const stubbedAvailability = [3, 5, 2, 8, 4, 1, 6, 7][idx % 8];
                const pricePerNight = ((sc.defaultRate || 0) / 100).toFixed(0);
                return (
                  <Card
                    key={sc.id}
                    className="group overflow-hidden border-slate-200 transition-all duration-300 ease-out hover:shadow-xl hover:-translate-y-1 motion-reduce:hover:translate-y-0 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2"
                    style={{ animationDelay: `${idx * 100}ms` }}
                    role="article"
                    aria-label={`${sc.name} - $${pricePerNight} per night`}
                  >
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                      <Image
                        src={sc.photoUrl || hero || "/placeholder.png"}
                        alt={`${sc.name} accommodation at ${campground?.name} - ${sc.description || sc.siteType}`}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
                      />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <Badge variant="secondary" className="bg-black/60 text-white border-white/10">
                          {sc.siteType?.toUpperCase() || "STAY"}
                        </Badge>
                        {sc.petFriendly && <Badge variant="secondary" className="bg-status-success text-white border-status-success">Pet friendly</Badge>}
                      </div>
                      {/* Scarcity badge for limited availability */}
                      {stubbedAvailability <= 5 && (
                        <div className="absolute top-3 right-3">
                          <ScarcityBadge sitesLeft={stubbedAvailability} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">{sc.name}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{sc.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-status-success" aria-label={`${pricePerNight} dollars per night`}>
                            ${pricePerNight}
                          </div>
                          <div className="text-xs text-slate-500">per night</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600" role="list" aria-label="Amenities">
                        {sc.maxOccupancy && <Badge variant="outline" role="listitem">Up to {sc.maxOccupancy} guests</Badge>}
                        {sc.hookupsPower && <Badge variant="outline" role="listitem" title="Electric hookup available">Power</Badge>}
                        {sc.hookupsWater && <Badge variant="outline" role="listitem" title="Water hookup available">Water</Badge>}
                        {sc.hookupsSewer && <Badge variant="outline" role="listitem" title="Sewer hookup available">Sewer</Badge>}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          <span>{campground?.city}, {campground?.state}</span>
                        </div>
                        <Button
                          className="bg-slate-900 hover:bg-slate-800 transition-all duration-150 hover:scale-105 active:scale-95 motion-reduce:hover:scale-100"
                          aria-label={`Book ${sc.name} for $${pricePerNight} per night`}
                          onClick={() => {
                            trackEvent("accommodation_book_click", { siteClassId: sc.id, campgroundId: campground?.id });
                            const q = new URLSearchParams({
                              arrivalDate,
                              departureDate,
                              siteType: sc.siteType || "all",
                              guests,
                              ...(previewToken ? { token: previewToken } : {})
                            }).toString();
                            window.location.href = `/park/${slug}/book?${q}`;
                          }}
                        >
                          Book
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {filteredSiteClasses.length === 0 && (
                <Card className="p-6 text-center text-slate-600 space-y-2">
                  <div>No stays match these filters.</div>
                  <Button variant="ghost" size="sm" onClick={() => setTypeFilter("all")}>
                    Clear filters
                  </Button>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* Gallery with keyboard navigation */}
        {photos.length > 0 && (
          <section className="space-y-3" aria-label="Photo gallery">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Gallery</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{galleryIndex + 1} of {Math.min(photos.length, 6)}</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setGalleryIndex(Math.max(0, galleryIndex - 1))}
                    disabled={galleryIndex === 0}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setGalleryIndex(Math.min(Math.min(photos.length, 6) - 1, galleryIndex + 1))}
                    disabled={galleryIndex >= Math.min(photos.length, 6) - 1}
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div
              className="grid gap-3 grid-cols-2 md:grid-cols-3"
              role="region"
              aria-roledescription="carousel"
              aria-label="Campground photos"
            >
              {photos.slice(0, 6).map((p, i) => (
                <button
                  key={p + i}
                  className={`relative h-40 rounded-xl overflow-hidden transition-all duration-200 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                    i === galleryIndex ? "ring-2 ring-emerald-500" : ""
                  }`}
                  onClick={() => setGalleryIndex(i)}
                  aria-label={`View photo ${i + 1} of ${Math.min(photos.length, 6)}`}
                  aria-current={i === galleryIndex ? "true" : undefined}
                >
                  <Image
                    src={p}
                    alt={`${campground?.name} photo ${i + 1} - campground view`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Guarantees & Bonuses Section */}
        {valueStack && (valueStack.guarantees?.length > 0 || valueStack.bonuses?.length > 0) && (
          <section className="space-y-6 bg-gradient-to-br from-slate-50 to-emerald-50 -mx-6 px-6 py-8 rounded-2xl">
            {/* Guarantees */}
            {valueStack.guarantees?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-status-success" />
                  <h2 className="text-lg font-semibold text-slate-900">Our Guarantees</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {valueStack.guarantees.map((g: { id: string; title: string; description: string; iconName?: string }) => {
                    const iconMap: Record<string, typeof ShieldCheck> = {
                      "shield-check": ShieldCheck,
                      "cloud-rain": CloudRain,
                      "clock": Clock,
                      "dollar-sign": DollarSign,
                      "sparkles": Sparkles,
                      "umbrella": Umbrella,
                      "badge-check": BadgeCheck,
                    };
                    const IconComponent = iconMap[g.iconName as string] || Shield;
                    return (
                      <Card key={g.id} className="p-4 border-status-success/30 bg-white/80 backdrop-blur-sm">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 bg-status-success/15 rounded-full flex items-center justify-center flex-shrink-0">
                            <IconComponent className="h-5 w-5 text-status-success" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{g.title}</h3>
                            <p className="text-sm text-slate-600 mt-1">{g.description}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bonuses */}
            {valueStack.bonuses?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-status-success" />
                    <h2 className="text-lg font-semibold text-slate-900">Included With Your Stay</h2>
                  </div>
                  {valueStack.totalBonusValue > 0 && (
                    <Badge variant="secondary" className="bg-status-success/15 text-status-success border-status-success/30">
                      ${(valueStack.totalBonusValue / 100).toFixed(0)} value included
                    </Badge>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {valueStack.bonuses.map((b: { id: string; name: string; valueCents: number; description?: string; iconName?: string }) => {
                    const bonusIconMap: Record<string, typeof Flame> = {
                      "flame": Flame,
                      "coffee": Coffee,
                      "tent": Tent,
                      "map-pin": MapPin,
                      "gift": Gift,
                      "sparkles": Sparkles,
                    };
                    const IconComponent = bonusIconMap[b.iconName as string] || Gift;
                    return (
                      <div key={b.id} className="flex items-center gap-3 p-3 bg-white/60 rounded-lg">
                        <div className="w-8 h-8 bg-status-warning/15 rounded-full flex items-center justify-center flex-shrink-0">
                          <IconComponent className="h-4 w-4 text-status-warning" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">{b.name}</span>
                            <span className="text-sm text-status-success font-semibold">${(b.valueCents / 100).toFixed(0)} value</span>
                          </div>
                          {b.description && (
                            <p className="text-xs text-slate-500 truncate">{b.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Why Book Direct - full section (only for internal campgrounds) */}
      {!isExternal && <WhyBookDirect campgroundName={campground?.name} />}

      {/* AI Chat Widget (only for internal campgrounds) */}
      {campground?.id && !isExternal && <AiChatWidget campgroundId={campground.id} campgroundName={campground.name} />}

      {/* Sticky Booking Bar - mobile only (only for internal campgrounds) */}
      {!isExternal && (
        <StickyBookingBar
          campgroundName={campground?.name || "Campground"}
          priceFrom={typedSiteClasses.length > 0 ? Math.min(...typedSiteClasses.map((sc) => (sc.defaultRate || 0) / 100)) : undefined}
          onBookClick={() => {
            trackEvent("sticky_booking_cta", { campgroundId: campground?.id, page: `/park/${slug}/v2` });
            const q = new URLSearchParams({
              arrivalDate,
              departureDate,
              guests,
              ...(previewToken ? { token: previewToken } : {})
            }).toString();
            window.location.href = `/park/${slug}/book?${q}`;
          }}
        />
      )}
    </div>
  );
}
