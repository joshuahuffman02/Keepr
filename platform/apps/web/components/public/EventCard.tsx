"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Paintbrush,
  Music,
  Gift,
  Repeat,
  Clock,
  MapPin,
  Calendar,
  Users,
  Heart
} from "lucide-react";

// Event type color mapping
const eventTypeStyles: Record<
  string,
  { bg: string; text: string; icon: typeof Activity }
> = {
  activity: { bg: "bg-blue-100", text: "text-blue-700", icon: Activity },
  workshop: { bg: "bg-purple-100", text: "text-purple-700", icon: Paintbrush },
  entertainment: { bg: "bg-pink-100", text: "text-pink-700", icon: Music },
  holiday: { bg: "bg-red-100", text: "text-red-700", icon: Gift },
  recurring: { bg: "bg-green-100", text: "text-green-700", icon: Repeat },
  ongoing: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock }
};

interface EventCardProps {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  isAllDay: boolean;
  imageUrl: string | null;
  priceCents: number;
  capacity: number | null;
  currentSignups: number;
  campground: {
    id: string;
    slug: string | null;
    name: string;
    city: string | null;
    state: string | null;
    heroImageUrl: string | null;
  };
}

export function EventCard({
  id,
  title,
  description,
  eventType,
  startDate,
  endDate,
  startTime,
  endTime,
  isAllDay,
  imageUrl,
  priceCents,
  capacity,
  currentSignups,
  campground
}: EventCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [imageError, setImageError] = useState(false);

  const style = eventTypeStyles[eventType.toLowerCase()] || eventTypeStyles.activity;
  const Icon = style.icon;

  // Format date display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  };

  // Format time display
  const formatTime = (time: string | null) => {
    if (!time) return null;
    // Assuming time is in HH:mm format
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Format price
  const formatPrice = (cents: number) => {
    if (cents === 0) return "Free";
    return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
  };

  // Capacity display
  const spotsLeft = capacity ? capacity - currentSignups : null;
  const isAlmostFull = spotsLeft !== null && spotsLeft <= 5 && spotsLeft > 0;
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0;

  const heroImage = imageUrl || campground.heroImageUrl;
  const campgroundLink = campground.slug
    ? `/campground/${campground.slug}`
    : `/campgrounds/${campground.id}`;

  return (
    <motion.article
      className="group relative bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {heroImage && !imageError ? (
          <Image
            src={heroImage}
            alt={title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
            <Icon className="w-16 h-16 text-orange-300" />
          </div>
        )}

        {/* Event Type Badge */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
          </span>
        </div>

        {/* Price Badge */}
        <div className="absolute top-3 right-12">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
              priceCents === 0
                ? "bg-green-500 text-white"
                : "bg-card/90 text-foreground"
            }`}
          >
            {formatPrice(priceCents)}
          </span>
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsWishlisted(!isWishlisted);
          }}
          className="absolute top-3 right-3 p-2 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card transition-colors"
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isWishlisted ? "filled" : "empty"}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isWishlisted
                    ? "fill-red-500 text-red-500"
                    : "text-muted-foreground hover:text-red-500"
                }`}
              />
            </motion.div>
          </AnimatePresence>
        </button>

        {/* Capacity Warning */}
        {(isAlmostFull || isSoldOut) && (
          <div className="absolute bottom-3 left-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                isSoldOut
                  ? "bg-red-500 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {isSoldOut ? "Sold Out" : `Only ${spotsLeft} spots left`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Date & Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span className="font-medium">{formatDate(startDate)}</span>
          {endDate && startDate !== endDate && (
            <>
              <span>-</span>
              <span>{formatDate(endDate)}</span>
            </>
          )}
          {!isAllDay && startTime && (
            <span className="text-muted-foreground">
              {formatTime(startTime)}
              {endTime && ` - ${formatTime(endTime)}`}
            </span>
          )}
          {isAllDay && <span className="text-muted-foreground">All Day</span>}
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg text-foreground line-clamp-2 group-hover:text-orange-600 transition-colors">
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
        )}

        {/* Campground Info */}
        <Link
          href={campgroundLink}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-orange-600 transition-colors"
        >
          <MapPin className="w-4 h-4" />
          <span className="truncate">
            {campground.name}
            {campground.city && campground.state && (
              <span className="text-muted-foreground">
                {" "}
                - {campground.city}, {campground.state}
              </span>
            )}
          </span>
        </Link>

        {/* Capacity indicator */}
        {capacity && !isSoldOut && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>
              {currentSignups} / {capacity} registered
            </span>
            {/* Progress bar */}
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isAlmostFull ? "bg-amber-500" : "bg-orange-500"
                }`}
                style={{
                  width: `${Math.min((currentSignups / capacity) * 100, 100)}%`
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Clickable overlay */}
      <Link
        href={`/events/${id}`}
        className="absolute inset-0 z-10"
        aria-label={`View ${title}`}
      />
    </motion.article>
  );
}
