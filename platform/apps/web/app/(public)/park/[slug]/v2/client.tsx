"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { ArrowRight, Calendar, MapPin, Search, Sparkles, Users, AlertCircle } from "lucide-react";
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

export function CampgroundV2Client({ slug, initialData }: { slug: string; initialData: PublicCampgroundDetail | null }) {
  const searchParams = useSearchParams();
  const { data: campground } = useQuery({
    queryKey: ["public-campground", slug],
    queryFn: () => apiClient.getPublicCampground(slug),
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

  const events = campground?.events ?? [];
  const promotions = campground?.promotions ?? [];
  const reviews = (campground as { reviews?: unknown[] })?.reviews ?? [];
  const faq = (campground as { faqs?: unknown[] })?.faqs ?? [];
  const siteClasses = campground?.siteClasses ?? [];
  const photos = campground?.photos ?? [];
  const hero = campground?.heroImageUrl || photos[0];

  useEffect(() => {
    if (campground?.id) {
      trackEvent("page_view", { page: `/park/${slug}/v2`, campgroundId: campground.id });
    }
  }, [campground?.id, slug]);

  const filteredSiteClasses = siteClasses.filter((sc: any) => {
    if (typeFilter === "all") return true;
    return (sc.siteType || "").toLowerCase() === typeFilter;
  });

  return (
    <div className="bg-white text-slate-900">
      {/* Hero */}
      <section className="relative">
        <div className="h-[60vh] w-full overflow-hidden rounded-b-3xl bg-slate-900">
          {hero ? (
            <Image src={hero} alt={campground?.name || "Campground"} fill className="object-cover" priority />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
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
                <Badge variant="secondary" className="bg-white/15 border-white/20 text-white">
                  ⭐ {Number(campground.reviewScore).toFixed(1)} ({campground.reviewCount ?? 0})
                </Badge>
              ) : null}
            </div>
            <div className="text-white">
              <h1 className="text-4xl md:text-5xl font-bold">{campground?.name ?? "Campground"}</h1>
              {campground?.tagline && <p className="text-lg text-white/80 mt-2">{campground.tagline}</p>}
            </div>
            {/* Booking bar */}
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
                      guests
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

            {/* Trust badges */}
            <TrustBadges variant="compact" className="mt-4 justify-center text-white/90" />
          </div>
        </div>
      </section>

      {/* Immersive Map Explorer */}
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
                <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                  <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Currently Selection</div>
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
                          guests
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
                {reviews.slice(0, 1).map((rev: any) => (
                  <div key={rev.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-900">{rev.reviewerName || "Guest"}</div>
                      {rev.rating && <Badge variant="secondary">⭐ {rev.rating}</Badge>}
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">{rev.comment}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Reviews will appear here once available.</p>
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
                {faq.slice(0, 2).map((item: any, idx: number) => (
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
        {reviews && reviews.length > 0 && (reviews[0] as any).rating >= 4 && (
          <section className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <FeaturedReview
                review={{
                  id: (reviews[0] as any).id,
                  rating: (reviews[0] as any).rating || 5,
                  comment: (reviews[0] as any).comment || "",
                  guestName: (reviews[0] as any).reviewerName || "Guest",
                  stayDate: (reviews[0] as any).stayDate,
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
                {faq.slice(0, 6).map((item: any, idx: number) => (
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
              reviews.slice(0, 3).map((rev: any) => (
                <Card key={rev.id} className="p-4 border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{rev.reviewerName || "Guest"}</div>
                    {rev.rating && <Badge variant="secondary">⭐ {rev.rating}</Badge>}
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
                {events.map((event: any) => {
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
                    <Card key={promo.id} className="p-4 border-rose-100 bg-rose-50/60 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-rose-700">Deal</div>
                        {promo.validTo && <Badge variant="secondary" className="bg-rose-600 text-white border-rose-500">Ends {promo.validTo.split("T")[0]}</Badge>}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mt-1">{promo.code}</h3>
                      <p className="text-sm text-slate-600">{promo.description || "Special offer for your stay."}</p>
                      <Button
                        className="w-full mt-3 bg-white text-rose-700 border border-rose-200 hover:bg-rose-100"
                        onClick={() => {
                          const q = new URLSearchParams({
                            arrivalDate,
                            departureDate,
                            promoCode: promo.code
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
            <Card className="p-4 text-sm text-slate-600 border-dashed border-slate-200">
              No upcoming events or deals right now. Check back soon or browse availability below.
            </Card>
          </section>
        )}

        {/* Availability cards */}
        <section id="availability" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Available stays</h2>
            <div className="text-sm text-slate-500">Based on your dates and filters</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredSiteClasses.map((sc: any, idx: number) => {
              // Stub scarcity data - in production this would come from availability API
              const stubbedAvailability = [3, 5, 2, 8, 4, 1, 6, 7][idx % 8];
              return (
                <Card key={sc.id} className="overflow-hidden border-slate-200 hover:shadow-lg transition">
                  <div className="relative h-48 w-full bg-slate-100">
                    <Image src={sc.photoUrl || hero || "/placeholder.png"} alt={`${sc.name} site`} fill className="object-cover" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge variant="secondary" className="bg-black/60 text-white border-white/10">
                        {sc.siteType?.toUpperCase() || "STAY"}
                      </Badge>
                      {sc.petFriendly && <Badge variant="secondary" className="bg-emerald-600 text-white border-emerald-500">Pet friendly</Badge>}
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
                        <div className="text-2xl font-bold text-emerald-600">${((sc.defaultRate || 0) / 100).toFixed(0)}</div>
                        <div className="text-xs text-slate-500">per night</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      {sc.maxOccupancy && <Badge variant="outline">Up to {sc.maxOccupancy} guests</Badge>}
                      {sc.hookupsPower && <Badge variant="outline">Power</Badge>}
                      {sc.hookupsWater && <Badge variant="outline">Water</Badge>}
                      {sc.hookupsSewer && <Badge variant="outline">Sewer</Badge>}
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4" />
                        <span>{campground?.city}, {campground?.state}</span>
                      </div>
                      <Button
                        className="bg-slate-900 hover:bg-slate-800"
                        onClick={() => {
                          const q = new URLSearchParams({
                            arrivalDate,
                            departureDate,
                            siteType: sc.siteType || "all",
                            guests
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

        {/* Gallery */}
        {photos.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Gallery</h2>
              <div className="text-sm text-slate-500">{photos.length} photos</div>
            </div>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
              {photos.slice(0, 6).map((p, i) => (
                <div key={p + i} className="relative h-40 rounded-xl overflow-hidden">
                  <Image src={p} alt={`Photo ${i + 1}`} fill className="object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Why Book Direct - full section */}
      <WhyBookDirect campgroundName={campground?.name} />

      {/* AI Chat Widget */}
      {campground?.id && <AiChatWidget campgroundId={campground.id} campgroundName={campground.name} />}

      {/* Sticky Booking Bar - mobile only */}
      <StickyBookingBar
        campgroundName={campground?.name || "Campground"}
        priceFrom={siteClasses.length > 0 ? Math.min(...siteClasses.map((sc: any) => (sc.defaultRate || 0) / 100)) : undefined}
        onBookClick={() => {
          trackEvent("sticky_booking_cta", { campgroundId: campground?.id, page: `/park/${slug}/v2` });
          const q = new URLSearchParams({
            arrivalDate,
            departureDate,
            guests
          }).toString();
          window.location.href = `/park/${slug}/book?${q}`;
        }}
      />
    </div>
  );
}
