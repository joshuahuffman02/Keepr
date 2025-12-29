"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { RecentBookingNotification } from "@/components/public/RecentBookingNotification";
import {
    Wifi, Waves, Flame, Droplets, Store, Fish, Ship, PlayCircle, ShowerHead, Dog,
    Footprints, Mountain, Bike, Check, Tent, Caravan, Home, Users, Sparkles,
    Star, Calendar, MapPin, Clock, Phone, Mail, Link2, Zap, Droplet, Plug, Leaf,
    TreeDeciduous, Palette, RefreshCw, Truck, PawPrint, Cable, Bath, type LucideIcon
} from "lucide-react";
import { PARK_AMENITIES, SITE_CLASS_AMENITIES, CABIN_AMENITIES } from "@/lib/amenities";

type PublicCampgroundDetail = Awaited<ReturnType<typeof apiClient.getPublicCampground>>;

// Helper to get amenity icon and label from our centralized definitions
function getAmenityDisplay(amenityId: string): { icon: LucideIcon; label: string } | null {
    // Check park amenities first
    const parkAmenity = PARK_AMENITIES.find(a => a.id === amenityId);
    if (parkAmenity) return { icon: parkAmenity.icon, label: parkAmenity.label };

    // Check site class amenities
    const siteAmenity = SITE_CLASS_AMENITIES.find(a => a.id === amenityId);
    if (siteAmenity) return { icon: siteAmenity.icon, label: siteAmenity.label };

    // Check cabin amenities
    const cabinAmenity = CABIN_AMENITIES.find(a => a.id === amenityId);
    if (cabinAmenity) return { icon: cabinAmenity.icon, label: cabinAmenity.label };

    return null;
}

// Legacy amenity icon mapping for backward compatibility (display names -> icons)
const legacyAmenityIcons: Record<string, LucideIcon> = {
    WiFi: Wifi,
    wifi: Wifi,
    Pool: Waves,
    pool: Waves,
    "Hot Tub": Flame,
    Laundry: Droplets,
    laundry: Droplets,
    "Camp Store": Store,
    store: Store,
    "Fishing Dock": Fish,
    fishing: Fish,
    "Boat Ramp": Ship,
    boat_launch: Ship,
    Playground: PlayCircle,
    playground: PlayCircle,
    "Fire Pits": Flame,
    fire_pit_communal: Flame,
    Showers: ShowerHead,
    showers: ShowerHead,
    "Pet Friendly": Dog,
    dog_park: Dog,
    "Hiking Trails": Footprints,
    hiking_trails: Footprints,
    "Mountain Views": Mountain,
    "Bike Rentals": Bike,
    biking_trails: Bike,
    pickleball: Bike,
    walking_trails: Footprints,
    bath_house: Bath,
    restrooms: Bath,
    rec_room: PlayCircle,
    dump_station: Truck,
};

// Site type icon mapping
const siteTypeIcons: Record<string, React.ReactNode> = {
    rv: <Caravan className="h-8 w-8" />,
    tent: <Tent className="h-8 w-8" />,
    cabin: <Home className="h-8 w-8" />,
    group: <Users className="h-8 w-8" />,
    glamping: <Sparkles className="h-8 w-8" />,
};

function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}

function formatTime(timeStr: string | null | undefined): string {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
}

function ReviewBadge({ score, count }: { score?: number | null; count?: number | null }) {
    if (score === undefined || score === null) return null;
    const numeric = Number(score);
    if (!Number.isFinite(numeric)) return null;
    return (
        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200 text-sm font-semibold">
            <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" /> {numeric.toFixed(1)}</span>
            <span className="text-amber-700 text-xs">{count ?? 0} reviews</span>
        </div>
    );
}

// Photo Gallery Component with Emotional Overlay
function PhotoGallery({
    photos,
    heroImage,
    campgroundId,
    campgroundName,
    tagline,
    reviewScore,
    reviewCount,
    city,
    state
}: {
    photos: string[];
    heroImage?: string | null;
    campgroundId?: string;
    campgroundName?: string;
    tagline?: string | null;
    reviewScore?: number | null;
    reviewCount?: number | null;
    city?: string | null;
    state?: string | null;
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);
    const allPhotos = heroImage ? [heroImage, ...photos.filter((p) => p !== heroImage)] : photos;

    useEffect(() => {
        if (!allPhotos[activeIndex]) return;
        trackEvent("image_viewed", { campgroundId, imageId: allPhotos[activeIndex], page: "campground_detail" });
    }, [activeIndex, campgroundId, allPhotos]);

    // Touch handlers for mobile swipe
    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (touchStart - touchEnd > 75) {
            // Swipe left - next image
            setActiveIndex((prev) => (prev + 1) % allPhotos.length);
        }
        if (touchStart - touchEnd < -75) {
            // Swipe right - previous image
            setActiveIndex((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
        }
    };

    if (allPhotos.length === 0) {
        return (
            <div className="w-full h-[500px] bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white">
                <Tent className="h-20 w-20" />
            </div>
        );
    }

    return (
        <div className="relative">
            <div
                className="w-full h-[500px] relative overflow-hidden"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <Image
                    src={allPhotos[activeIndex]}
                    alt="Campground photo"
                    fill
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Emotional Overlay Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
                    <div className="max-w-3xl space-y-3">
                        {/* Pre-headline sparkle */}
                        <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
                            <Sparkles className="h-4 w-4" />
                            <span>Your next adventure awaits</span>
                        </div>

                        {/* Campground Name */}
                        {campgroundName && (
                            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight drop-shadow-lg">
                                {campgroundName}
                            </h1>
                        )}

                        {/* Tagline */}
                        {tagline && (
                            <p className="text-lg md:text-xl text-white/90 font-medium max-w-2xl">
                                {tagline}
                            </p>
                        )}

                        {/* Location & Reviews */}
                        <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm pt-2">
                            {city && state && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="h-4 w-4" />
                                    {city}, {state}
                                </span>
                            )}
                            {reviewScore && reviewScore > 0 && (
                                <>
                                    <span className="text-white/50">•</span>
                                    <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                        <span className="font-semibold text-white">{reviewScore.toFixed(1)}</span>
                                        <span className="text-white/70">({reviewCount} reviews)</span>
                                    </span>
                                </>
                            )}
                            <span className="flex items-center gap-1.5 text-emerald-300">
                                <Check className="h-4 w-4" />
                                Verified photos
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Photo navigation dots */}
            {allPhotos.length > 1 && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2">
                    {allPhotos.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setActiveIndex(i);
                                trackEvent("image_clicked", { campgroundId, imageId: allPhotos[i], page: "campground_detail" });
                            }}
                            className={`w-3 h-3 rounded-full transition-all ${i === activeIndex ? "bg-white scale-110" : "bg-white/50 hover:bg-white/75"
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Amenities Grid
function AmenitiesGrid({ amenities }: { amenities: string[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {amenities.map((amenity) => {
                // Try to get from our centralized definitions first
                const amenityDisplay = getAmenityDisplay(amenity);
                // Fall back to legacy mapping for backward compatibility
                const LegacyIcon = legacyAmenityIcons[amenity];
                const Icon = amenityDisplay?.icon ?? LegacyIcon ?? Check;
                const label = amenityDisplay?.label ?? amenity;

                return (
                    <div
                        key={amenity}
                        className="flex items-center gap-2 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100"
                    >
                        <span className="text-emerald-600"><Icon className="h-5 w-5" /></span>
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                    </div>
                );
            })}
        </div>
    );
}

// Site Class Card
function SiteClassCard({
    siteClass,
    slug,
    viewOnly,
    externalUrl,
    onSelect
}: {
    siteClass: PublicCampgroundDetail["siteClasses"][0];
    slug: string;
    viewOnly: boolean;
    externalUrl?: string | null;
    onSelect?: (siteType?: string) => void;
}) {
    // Get top amenities to display (max 4 additional beyond hookups)
    type SiteClassWithExtras = typeof siteClass & {
        amenityTags?: string[];
        electricAmps?: number[];
    };
    const siteClassExtended = siteClass as SiteClassWithExtras;
    const amenityTags = siteClassExtended.amenityTags;
    const electricAmps = siteClassExtended.electricAmps;
    const displayAmenities = useMemo(() => {
        if (!amenityTags || amenityTags.length === 0) return [];
        return amenityTags.slice(0, 4).map(tag => {
            const display = getAmenityDisplay(tag);
            return display ? { id: tag, ...display } : null;
        }).filter(Boolean) as Array<{ id: string; icon: LucideIcon; label: string }>;
    }, [amenityTags]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-32 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
                {siteTypeIcons[siteClass.siteType || "tent"] || <Tent className="h-10 w-10" />}
            </div>
            <div className="p-5">
                <h3 className="font-bold text-lg text-slate-900">{siteClass.name}</h3>
                {siteClass.description && (
                    <p className="text-slate-600 text-sm mt-1">{siteClass.description}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                    {siteClass.maxOccupancy && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                            Up to {siteClass.maxOccupancy} guests
                        </span>
                    )}
                    {siteClass.hookupsPower && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded inline-flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            {electricAmps && electricAmps.length > 0 ? `${electricAmps.join("/")}A` : "Power"}
                        </span>
                    )}
                    {siteClass.hookupsWater && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded inline-flex items-center gap-1"><Droplet className="h-3 w-3" /> Water</span>
                    )}
                    {siteClass.hookupsSewer && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded inline-flex items-center gap-1"><Plug className="h-3 w-3" /> Sewer</span>
                    )}
                    {siteClass.petFriendly && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded inline-flex items-center gap-1"><Dog className="h-3 w-3" /> Pets OK</span>
                    )}
                    {/* Display additional amenities from amenityTags */}
                    {displayAmenities.map((amenity) => (
                        <span key={amenity.id} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded inline-flex items-center gap-1">
                            <amenity.icon className="h-3 w-3" /> {amenity.label}
                        </span>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-2xl font-bold text-emerald-600">
                            {formatPrice(siteClass.defaultRate || 0)}
                        </span>
                        <span className="text-slate-500 text-sm">/night</span>
                    </div>
                    {viewOnly ? (
                        externalUrl ? (
                            <a
                                href={externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
                            >
                                View Website
                            </a>
                        ) : (
                            <span className="text-slate-500 text-sm">View-only listing</span>
                        )
                    ) : (
                        <Link
                            href={`/park/${slug}/book?siteType=${siteClass.siteType || "all"}`}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-lg font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 group"
                        >
                            <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                            Reserve This Site
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper to get recurrence description
function getRecurrenceDescription(recurrenceDays?: number[]): string {
    if (!recurrenceDays || recurrenceDays.length === 0) return '';
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    if (recurrenceDays.length === 7) return 'Daily';
    if (recurrenceDays.length === 2 && recurrenceDays.includes(0) && recurrenceDays.includes(6)) return 'Weekends';
    if (recurrenceDays.length === 5 && !recurrenceDays.includes(0) && !recurrenceDays.includes(6)) return 'Weekdays';
    if (recurrenceDays.length === 1) return `Every ${dayNames[recurrenceDays[0]]}`;

    return recurrenceDays.map(d => shortDays[d]).join(', ');
}

// Event Card
function EventCard({ event, slug }: { event: PublicCampgroundDetail["events"][0]; slug: string }) {
    const typeColors: Record<string, string> = {
        activity: "bg-blue-100 text-blue-700",
        workshop: "bg-purple-100 text-purple-700",
        entertainment: "bg-pink-100 text-pink-700",
        holiday: "bg-red-100 text-red-700 ring-2 ring-red-200",
        recurring: "bg-green-100 text-green-700",
        ongoing: "bg-amber-100 text-amber-700",
        themed: "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200",
    };

    const isParentEvent = event.eventType === 'holiday' || event.eventType === 'themed';
    const isOngoing = event.eventType === 'ongoing';
    const recurrenceLabel = event.isRecurring ? getRecurrenceDescription(event.recurrenceDays) : '';

    // Build booking link with event dates
    const eventStartDate = event.startDate.split('T')[0];
    const eventEndDate = event.endDate ? event.endDate.split('T')[0] : (() => {
        const d = new Date(event.startDate);
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    })();

    // Parent events (Holiday/Themed) get special treatment
    if (isParentEvent) {
        return (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200 p-6 hover:shadow-lg transition-all">
                {event.imageUrl && (
                    <div className="relative mb-4 h-44 w-full overflow-hidden rounded-lg">
                        <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
                    </div>
                )}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <span
                            className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide ${typeColors[event.eventType]}`}
                        >
                            {event.eventType === 'holiday' ? <><Star className="h-3.5 w-3.5 inline" /> Holiday Weekend</> : <><Palette className="h-3.5 w-3.5 inline" /> Themed Weekend</>}
                        </span>
                        <h3 className="font-bold text-xl text-slate-900 mt-3">{event.title}</h3>
                        {event.description && (
                            <p className="text-slate-600 mt-2">{event.description}</p>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-4">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.startDate)} {event.endDate && `- ${formatDate(event.endDate)}`}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                        </div>
                    )}
                </div>
                {/* Show child events if any */}
                {event.children && event.children.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Events this weekend:</h4>
                        <div className="space-y-2">
                            {event.children.slice(0, 4).map((child: any) => (
                                <div key={child.id} className="flex items-center justify-between text-sm bg-white p-2 rounded-lg">
                                    <span className="font-medium text-slate-800">{child.title}</span>
                                    <span className="text-slate-500">{child.startTime && formatTime(child.startTime)}</span>
                                </div>
                            ))}
                            {event.children.length > 4 && (
                                <div className="text-sm text-slate-500 text-center">+{event.children.length - 4} more events</div>
                            )}
                        </div>
                    </div>
                )}
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <div>
                        {event.priceCents && event.priceCents > 0 ? (
                            <span className="font-semibold text-emerald-600">{formatPrice(event.priceCents)}</span>
                        ) : (
                            <span className="font-semibold text-emerald-600">Free</span>
                        )}
                    </div>
                    <Link
                        href={`/park/${slug}?arrivalDate=${eventStartDate}&departureDate=${eventEndDate}#availability`}
                        className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        Book Weekend →
                    </Link>
                </div>
            </div>
        );
    }

    // Ongoing events get banner style
    if (isOngoing) {
        return (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200 p-5 hover:shadow-md transition-all">
                {event.imageUrl && (
                    <div className="relative mb-3 h-36 w-full overflow-hidden rounded-lg">
                        <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
                    </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                    <Palette className="h-5 w-5 text-amber-600" />
                    <span className="text-xs px-2 py-1 bg-amber-500 text-white rounded-full font-bold uppercase">
                        All Weekend
                    </span>
                </div>
                <h4 className="font-bold text-slate-900 text-lg">{event.title}</h4>
                {event.description && (
                    <p className="text-slate-600 text-sm mt-1">{event.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                    {event.location && (
                        <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{event.location}</span>
                        </div>
                    )}
                    {event.startTime && event.endTime && (
                        <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Standard event card (with recurring badge if applicable)
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            {event.imageUrl && (
                <div className="relative mb-3 h-44 w-full overflow-hidden rounded-lg">
                    <Image src={event.imageUrl} alt={event.title} fill className="object-cover" />
                </div>
            )}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${typeColors[event.eventType] || "bg-slate-100 text-slate-600"}`}
                        >
                            {event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)}
                        </span>
                        {recurrenceLabel && (
                            <span className="text-xs px-2 py-1 bg-green-500 text-white rounded-full font-medium inline-flex items-center gap-1">
                                <RefreshCw className="h-3 w-3" /> {recurrenceLabel}
                            </span>
                        )}
                    </div>
                    <h4 className="font-bold text-slate-900 mt-2">{event.title}</h4>
                    {event.description && (
                        <p className="text-slate-600 text-sm mt-1 line-clamp-2">{event.description}</p>
                    )}
                </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(event.startDate)}</span>
                </div>
                {event.startTime && (
                    <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{formatTime(event.startTime)}</span>
                    </div>
                )}
                {event.location && (
                    <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                    </div>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                    {event.priceCents && event.priceCents > 0 ? (
                        <span className="font-semibold text-emerald-600">{formatPrice(event.priceCents)}</span>
                    ) : (
                        <span className="font-semibold text-emerald-600">Free</span>
                    )}
                    {event.capacity && (
                        <span className="text-sm text-slate-500 ml-2">
                            {event.currentSignups || 0}/{event.capacity} spots
                        </span>
                    )}
                </div>
                <Link
                    href={`/park/${slug}/book?arrivalDate=${eventStartDate}&departureDate=${eventEndDate}`}
                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                >
                    Book for Event →
                </Link>
            </div>
        </div>
    );
}

// Availability Filter Component
function AvailabilityFilter({ slug }: { slug: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialArrival = searchParams.get("arrivalDate") || "";
    const initialDeparture = searchParams.get("departureDate") || "";
    const initialSiteType = searchParams.get("siteType") || "all";

    const [arrivalDate, setArrivalDate] = useState(initialArrival);
    const [departureDate, setDepartureDate] = useState(initialDeparture);
    const [siteType, setSiteType] = useState(initialSiteType);

    // Sync state with URL params when they change (e.g. from AI Chat)
    useEffect(() => {
        setArrivalDate(searchParams.get("arrivalDate") || "");
        setDepartureDate(searchParams.get("departureDate") || "");
        setSiteType(searchParams.get("siteType") || "all");
    }, [searchParams]);

    const handleSearch = () => {
        const params = new URLSearchParams();
        if (arrivalDate) params.set("arrivalDate", arrivalDate);
        if (departureDate) params.set("departureDate", departureDate);
        if (siteType && siteType !== "all") params.set("siteType", siteType);

        const query = params.toString();
        router.push(`/park/${slug}/book${query ? `?${query}` : ""}`);
    };

    // Auto-set departure date logic
    const handleArrivalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setArrivalDate(val);
        if (val && !departureDate) {
            const nextDay = new Date(val);
            nextDay.setDate(nextDay.getDate() + 3); // Default 3 nights
            setDepartureDate(nextDay.toISOString().split('T')[0]);
        }
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div
            id="availability"
            className="bg-white p-4 md:p-6 rounded-2xl shadow-xl border border-slate-100 -mt-12 relative z-10 mx-4 md:mx-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Arrival</label>
                <input
                    type="date"
                    min={today}
                    value={arrivalDate}
                    onChange={handleArrivalChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-900"
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Departure</label>
                <input
                    type="date"
                    min={arrivalDate || today}
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-900"
                />
            </div>
            <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Accommodation</label>
                <select
                    value={siteType}
                    onChange={(e) => setSiteType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-slate-900 bg-white"
                >
                    <option value="all">All Types</option>
                    <option value="rv">RV Sites</option>
                    <option value="cabin">Cabins</option>
                    <option value="tent">Tent Sites</option>
                    <option value="glamping">Glamping</option>
                </select>
            </div>
            <button
                onClick={handleSearch}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 group"
            >
                <Sparkles className="h-4 w-4 group-hover:animate-pulse" />
                <span>Find Your Perfect Spot</span>
            </button>
        </div>
    );
}

export function CampgroundDetailClient({
    slug,
    initialData
}: {
    slug: string;
    initialData?: PublicCampgroundDetail | null;
}) {
    const { data: campground, isLoading, error } = useQuery({
        queryKey: ["public-campground", slug],
        queryFn: () => apiClient.getPublicCampground(slug),
        enabled: !!slug,
        initialData: initialData || undefined,
    });

    useEffect(() => {
        if (!campground) return;
        trackEvent("page_view", { page: `/park/${slug}`, campgroundId: campground.id });
        (campground.siteClasses || []).slice(0, 10).forEach((sc) => {
            trackEvent("site_class_viewed", { campgroundId: campground.id, siteClassId: sc.id, page: `/park/${slug}` });
        });
    }, [campground, slug]);

    const reviewsQuery = useQuery({
        queryKey: ["public-reviews", campground?.id],
        queryFn: () => apiClient.getPublicReviews(campground!.id),
        enabled: !!campground?.id
    });
    useEffect(() => {
        if (!campground?.id) return;
        const count = reviewsQuery.data?.length || 0;
        if (count > 0) {
            trackEvent("review_viewed", { campgroundId: campground.id, metadata: { count }, page: `/park/${slug}` });
        }
    }, [campground?.id, reviewsQuery.data, slug]);
    const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
    const [sortOption, setSortOption] = useState<"relevant" | "newest" | "highest" | "lowest" | "photos">("relevant");
    const [searchTerm, setSearchTerm] = useState("");
    const [photosOnly, setPhotosOnly] = useState(false);
    const [tagFilter, setTagFilter] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(6);

    const filteredReviews = useMemo(() => {
        // Deduplicate reviews by ID to prevent duplicates from backend
        const rawItems = reviewsQuery.data || [];
        const seenIds = new Set<string>();
        const items = rawItems.filter((r) => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
        });

        const byRating = ratingFilter === "all"
            ? items
            : items.filter((r) => Math.floor(r.rating) === Number(ratingFilter));

        const byPhotos = photosOnly ? byRating.filter((r) => (r.photos || []).length > 0) : byRating;

        const byTag = tagFilter
            ? byPhotos.filter((r) => (r.tags || []).map((t) => t.toLowerCase()).includes(tagFilter.toLowerCase()))
            : byPhotos;

        const term = searchTerm.trim().toLowerCase();
        const bySearch = term
            ? byTag.filter((r) =>
                (r.title || "").toLowerCase().includes(term) ||
                (r.body || "").toLowerCase().includes(term) ||
                (r.tags || []).some((t) => t.toLowerCase().includes(term))
            )
            : byTag;

        const sorted = [...bySearch].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            switch (sortOption) {
                case "newest":
                    return dateB - dateA;
                case "highest":
                    return b.rating - a.rating || dateB - dateA;
                case "lowest":
                    return a.rating - b.rating || dateB - dateA;
                case "photos":
                    return (b.photos?.length || 0) - (a.photos?.length || 0) || dateB - dateA;
                case "relevant":
                default:
                    // simple relevance: higher rating then recency
                    return b.rating - a.rating || dateB - dateA;
            }
        });
        return sorted;
    }, [reviewsQuery.data, ratingFilter, sortOption, searchTerm, photosOnly, tagFilter]);

    const ratingBuckets = useMemo(() => {
        const buckets: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        // Deduplicate by ID
        const seenIds = new Set<string>();
        const uniqueReviews = (reviewsQuery.data || []).filter((r) => {
            if (seenIds.has(r.id)) return false;
            seenIds.add(r.id);
            return true;
        });
        uniqueReviews.forEach((r) => {
            const key = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
            buckets[key] = (buckets[key] || 0) + 1;
        });
        const total = uniqueReviews.length || 1;
        return { buckets, total };
    }, [reviewsQuery.data]);

    useEffect(() => {
        if (!campground?.id || !campground.promotions?.length) return;
        campground.promotions.forEach((promo) => {
            trackEvent("deal_viewed", { campgroundId: campground.id, promotionId: promo.id, page: `/park/${slug}` });
        });
    }, [campground?.id, campground?.promotions, slug]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50 to-white">
                {/* Animated tent icon */}
                <div className="relative">
                    <Tent className="h-12 w-12 text-emerald-500 animate-bounce" />
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-slate-200/50 rounded-full blur-sm" />
                </div>
                <div className="text-center space-y-2">
                    <p className="text-slate-700 font-medium animate-pulse">Loading your adventure...</p>
                    <p className="text-sm text-slate-500">Getting campground details ready</p>
                </div>
                {/* Progress dots */}
                <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="w-2 h-2 rounded-full bg-emerald-500"
                            style={{
                                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`
                            }}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (error || !campground) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4">
                <Tent className="h-16 w-16 text-emerald-500" />
                <h1 className="text-2xl font-bold text-slate-800">Campground Not Found</h1>
                <p className="text-slate-600">The campground you're looking for doesn't exist or isn't available.</p>
                <Link
                    href="/"
                    className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700"
                >
                    Browse All Campgrounds
                </Link>
            </div>
        );
    }

    const viewOnly = Boolean(campground.isExternal || campground.isBookable === false);
    const externalHref = campground.externalUrl || campground.website || null;
    const amenityList =
        campground.amenities && campground.amenities.length > 0
            ? campground.amenities
            : Object.keys(campground.amenitySummary || {});

    return (
        <>
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                {/* Hero Section */}
                <PhotoGallery
                    photos={campground.photos || []}
                    heroImage={campground.heroImageUrl}
                    campgroundId={campground.id}
                    campgroundName={campground.name}
                    tagline={campground.tagline}
                    reviewScore={campground.reviewScore}
                    reviewCount={campground.reviewCount}
                    city={campground.city}
                    state={campground.state}
                />

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 pb-12">
                    {/* Availability Filter Overlay */}
                    {!viewOnly && <AvailabilityFilter slug={slug} />}

                    {/* Breadcrumbs */}
                    <div className="mt-8 mb-6">
                        <Breadcrumbs
                            items={[
                                { label: "Home", href: "/" },
                                { label: "Parks", href: "/" },
                                { label: campground.name }
                            ]}
                        />
                    </div>

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mt-6 mb-10">
                        <div>
                            {campground.tagline && (
                                <p className="text-emerald-600 font-medium mb-2">{campground.tagline}</p>
                            )}
                            <h1 className="text-4xl md:text-5xl font-bold text-slate-900">{campground.name}</h1>
                            <p className="text-xl text-slate-600 mt-2">
                                {[campground.city, campground.state, campground.country].filter(Boolean).join(", ")}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 mt-3">
                                <ReviewBadge score={campground.reviewScore} count={campground.reviewCount} />
                                {externalHref && (
                                    <a
                                        href={externalHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-emerald-600 hover:underline inline-flex items-center gap-1"
                                    >
                                        <span>Visit Website</span> <span aria-hidden>↗</span>
                                    </a>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                            {viewOnly ? (
                                externalHref ? (
                                    <a
                                        href={externalHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-slate-900 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                                    >
                                        View on Website
                                    </a>
                                ) : (
                                    <span className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold border border-slate-200">
                                        View-only listing
                                    </span>
                                )
                            ) : (
                                <Link
                                    href={`/park/${slug}#availability`}
                                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 group"
                                >
                                    <Sparkles className="h-5 w-5 group-hover:animate-pulse" />
                                    Reserve Your Stay
                                </Link>
                            )}
                            {campground.phone && (
                                <a href={`tel:${campground.phone}`} className="text-slate-600 hover:text-emerald-600 inline-flex items-center gap-1">
                                    <Phone className="h-4 w-4" /> {campground.phone}
                                </a>
                            )}
                            {campground.email && (
                                <a href={`mailto:${campground.email}`} className="text-slate-600 hover:text-emerald-600 inline-flex items-center gap-1">
                                    <Mail className="h-4 w-4" /> {campground.email}
                                </a>
                            )}
                        </div>
                    </div>

                    {viewOnly && (
                        <div className="mb-8 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <Link2 className="h-5 w-5 text-amber-600 flex-shrink-0" aria-hidden />
                            <div>
                                <p className="font-semibold text-amber-900">Discovery listing — booking handled off-platform</p>
                                <p className="text-sm text-amber-800">
                                    Booking is disabled here. {externalHref ? "Use the website link to reserve directly." : "Please contact the campground to book."}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {campground.description && (
                        <section className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-4">About This Campground</h2>
                            <p className="text-slate-700 text-lg leading-relaxed max-w-4xl">{campground.description}</p>
                        </section>
                    )}

                    {/* Operations Info */}
                    <section className="mb-12 bg-slate-50 rounded-2xl p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                            {campground.checkInTime && (
                                <div>
                                    <div className="flex justify-center mb-1"><Clock className="h-6 w-6 text-slate-400" /></div>
                                    <div className="text-sm text-slate-500">Check-in</div>
                                    <div className="font-semibold text-slate-800">{formatTime(campground.checkInTime)}</div>
                                </div>
                            )}
                            {campground.checkOutTime && (
                                <div>
                                    <div className="flex justify-center mb-1"><Clock className="h-6 w-6 text-slate-400" /></div>
                                    <div className="text-sm text-slate-500">Check-out</div>
                                    <div className="font-semibold text-slate-800">{formatTime(campground.checkOutTime)}</div>
                                </div>
                            )}
                            {campground.seasonStart && (
                                <div>
                                    <div className="flex justify-center mb-1"><Leaf className="h-6 w-6 text-green-500" /></div>
                                    <div className="text-sm text-slate-500">Season Opens</div>
                                    <div className="font-semibold text-slate-800">
                                        {new Date(campground.seasonStart).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </div>
                                </div>
                            )}
                            {campground.seasonEnd && (
                                <div>
                                    <div className="flex justify-center mb-1"><TreeDeciduous className="h-6 w-6 text-amber-500" /></div>
                                    <div className="text-sm text-slate-500">Season Ends</div>
                                    <div className="font-semibold text-slate-800">
                                        {new Date(campground.seasonEnd).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Reviews */}
                    <section className="mb-12">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Guest Reviews</h2>
                                <p className="text-sm text-slate-600">What recent guests are saying</p>
                            </div>
                            {campground.reviewScore ? (
                                <div className="flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-2 rounded-full border border-amber-200 text-sm font-semibold">
                                    <span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" /> {Number(campground.reviewScore).toFixed(1)}</span>
                                    <span className="text-amber-700 text-xs">{campground.reviewCount ?? 0} reviews</span>
                                </div>
                            ) : null}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-slate-600">Rating</label>
                                <select
                                    value={ratingFilter}
                                    onChange={(e) => setRatingFilter(e.target.value as "all" | "5" | "4" | "3" | "2" | "1")}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="all">All</option>
                                    <option value="5">5 stars</option>
                                    <option value="4">4 stars</option>
                                    <option value="3">3 stars</option>
                                    <option value="2">2 stars</option>
                                    <option value="1">1 star</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-slate-600">Sort</label>
                                <select
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as "relevant" | "newest" | "highest" | "lowest" | "photos")}
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value="relevant">Most relevant</option>
                                    <option value="newest">Newest</option>
                                    <option value="highest">Highest rating</option>
                                    <option value="lowest">Lowest rating</option>
                                    <option value="photos">Photos first</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-slate-600">Search</label>
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Keywords..."
                                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-slate-300"
                                    checked={photosOnly}
                                    onChange={(e) => setPhotosOnly(e.target.checked)}
                                />
                                Photos only
                            </label>
                        </div>
                        {reviewsQuery.data && reviewsQuery.data.some((r) => (r.tags || []).length > 0) && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {Array.from(
                                    new Set(
                                        (reviewsQuery.data ?? [])
                                            .flatMap((r) => r.tags ?? [])
                                            .map((t) => t.trim())
                                            .filter(Boolean)
                                    )
                                )
                                    .slice(0, 12)
                                    .map((tag) => (
                                        <button
                                            key={tag}
                                            onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                                            className={`px-3 py-1 rounded-full text-sm border transition-colors ${tagFilter === tag
                                                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                                : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                {tagFilter && (
                                    <button
                                        onClick={() => setTagFilter(null)}
                                        className="text-xs text-emerald-600 hover:underline"
                                    >
                                        Clear tags
                                    </button>
                                )}
                            </div>
                        )}
                        {reviewsQuery.data && reviewsQuery.data.length > 0 && (
                            <div className="mb-4 grid grid-cols-1 sm:grid-cols-5 gap-2">
                                {[5, 4, 3, 2, 1].map((star) => {
                                    const count = ratingBuckets.buckets[star] || 0;
                                    const pct = ratingBuckets.total ? Math.round((count / ratingBuckets.total) * 100) : 0;
                                    return (
                                        <div key={star} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs text-slate-600">
                                                <span>{star}★</span>
                                                <span>{pct}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded">
                                                <div className="h-2 bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {reviewsQuery.isLoading && (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <div className="flex gap-0.5">
                                    {[0, 1, 2, 3, 4].map((i) => (
                                        <Star
                                            key={i}
                                            className="h-4 w-4 text-slate-200"
                                            style={{ animation: `pulse 1s ease-in-out ${i * 0.1}s infinite` }}
                                        />
                                    ))}
                                </div>
                                <span>Gathering guest experiences...</span>
                            </div>
                        )}
                        {filteredReviews && filteredReviews.length === 0 && (
                            <div className="text-sm text-slate-500">No reviews yet.</div>
                        )}
                        {filteredReviews && filteredReviews.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredReviews.slice(0, visibleCount).map((review) => (
                                    <div key={review.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 text-amber-800 font-semibold">
                                                {review.rating.toFixed(1)}
                                            </span>
                                            {review.photos && review.photos.length > 0 && (
                                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                                    {review.photos.length} photo{review.photos.length > 1 ? "s" : ""}
                                                </span>
                                            )}
                                            <div className="text-sm text-slate-500">
                                                {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                                            </div>
                                        </div>
                                        {review.title && <div className="text-base font-semibold text-slate-900">{review.title}</div>}
                                        {review.body && <p className="text-sm text-slate-700 leading-relaxed">{review.body}</p>}
                                        {review.replies && review.replies.length > 0 && (
                                            <div className="mt-2 border-t border-slate-100 pt-2 space-y-1">
                                                {review.replies.map((reply) => (
                                                    <div key={reply.id} className="text-xs text-slate-600">
                                                        <span className="font-semibold text-slate-800">{reply.authorType === "staff" ? "Host" : "Guest"}:</span> {reply.body}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {visibleCount < filteredReviews.length && (
                                    <button
                                        onClick={() => setVisibleCount((c) => c + 6)}
                                        className="col-span-full text-sm font-semibold text-emerald-600 hover:underline justify-self-center"
                                    >
                                        Show more reviews
                                    </button>
                                )}
                            </div>
                        )}
                        {reviewsQuery.error && <div className="text-sm text-rose-600">Failed to load reviews.</div>}
                    </section>

                    {/* Amenities */}
                    {amenityList && amenityList.length > 0 && (
                        <section className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Amenities</h2>
                            <AmenitiesGrid amenities={amenityList} />
                        </section>
                    )}

                    {/* Site Types */}
                    {campground.siteClasses && campground.siteClasses.length > 0 && (
                        <section className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Accommodations</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {campground.siteClasses.map((sc) => (
                                    <SiteClassCard
                                        key={sc.id}
                                        siteClass={sc}
                                        slug={slug}
                                        viewOnly={campground.isExternal || campground.isBookable === false}
                                        externalUrl={campground.externalUrl || campground.website}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Upcoming Events */}
                    {campground.events && campground.events.length > 0 && (
                        <section className="mb-12">
                            <h2 className="text-2xl font-bold text-slate-900 mb-6">Upcoming Events & Activities</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {campground.events.map((event) => (
                                    <EventCard key={event.id} event={event} slug={slug} />
                                ))}
                            </div>
                        </section>
                    )}


                    {/* Promotions / Deals */}
                    {campground.promotions && campground.promotions.length > 0 && (
                        <section className="mb-12">
                            <div className="flex items-center gap-3 mb-6">
                                <h2 className="text-2xl font-bold text-slate-900">Deals & Offers</h2>
                                <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">
                                    Limited Time
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {campground.promotions.map((promo) => (
                                    <div key={promo.id} className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-xl border-2 border-rose-100 p-5 relative overflow-hidden group hover:shadow-lg transition-all hover:scale-[1.02]">
                                        <div className="absolute top-0 right-0 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                            SAVE {promo.type === 'percentage' ? `${promo.value}%` : formatPrice(promo.value)}
                                        </div>
                                        <div className="mb-4">
                                            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-2">
                                                <Zap className="h-6 w-6 text-rose-600" />
                                            </div>
                                            <h3 className="font-bold text-slate-900 text-lg">{promo.code}</h3>
                                            <p className="text-slate-600 text-sm mt-1">{promo.description || "Special offer for our guests!"}</p>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            {promo.validTo && (
                                                <div className="text-xs text-rose-700 font-medium flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    <span>Expires {formatDate(promo.validTo)}</span>
                                                </div>
                                            )}
                                        </div>

                                        <Link
                                            href={`/park/${slug}/book?promoCode=${promo.code}`}
                                            onClick={() => trackEvent("deal_applied", { campgroundId: campground.id, promotionId: promo.id, metadata: { code: promo.code }, page: `/park/${slug}` })}
                                            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold py-2.5 rounded-lg hover:from-rose-600 hover:to-orange-600 transition-all shadow-md shadow-rose-500/20 group"
                                        >
                                            <Zap className="h-4 w-4 group-hover:animate-pulse" />
                                            Grab This Deal
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Social Links */}
                    {(campground.facebookUrl || campground.instagramUrl) && (
                        <section className="mb-12 text-center">
                            <h2 className="text-xl font-bold text-slate-900 mb-4">Connect With Us</h2>
                            <div className="flex justify-center gap-4">
                                {campground.facebookUrl && (
                                    <a
                                        href={campground.facebookUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                                    >
                                        Facebook
                                    </a>
                                )}
                                {campground.instagramUrl && (
                                    <a
                                        href={campground.instagramUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity"
                                    >
                                        Instagram
                                    </a>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>

            {/* AI Chat Widget */}
            <AiChatWidget campgroundId={campground.id} campgroundName={campground.name} />

            {/* Recent Booking Notifications */}
            <RecentBookingNotification campgroundId={campground.id} />
        </>
    );
}
