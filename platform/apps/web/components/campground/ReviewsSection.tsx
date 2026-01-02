"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Star, User, ChevronDown, Quote, Camera, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  comment: string;
  reviewerName?: string | null;
  stayDate?: string | null;
  siteNumber?: string | null;
  photos?: string[];
  helpful?: number;
  verified?: boolean;
}

interface ReviewsSectionProps {
  reviews: Review[];
  averageRating?: number | null;
  totalCount?: number;
  className?: string;
}

export function ReviewsSection({
  reviews,
  averageRating,
  totalCount,
  className,
}: ReviewsSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "recent" | "highest" | "photos">("all");

  // Calculate rating distribution
  const distribution = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const rounded = Math.round(r.rating);
      if (rounded >= 1 && rounded <= 5) {
        dist[rounded as keyof typeof dist]++;
      }
    });
    const total = reviews.length || 1;
    return Object.entries(dist)
      .reverse()
      .map(([stars, count]) => ({
        stars: parseInt(stars),
        count,
        percentage: Math.round((count / total) * 100),
      }));
  }, [reviews]);

  // Filter reviews
  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];

    switch (filter) {
      case "recent":
        filtered.sort((a, b) => {
          if (!a.stayDate || !b.stayDate) return 0;
          return new Date(b.stayDate).getTime() - new Date(a.stayDate).getTime();
        });
        break;
      case "highest":
        filtered.sort((a, b) => b.rating - a.rating);
        break;
      case "photos":
        filtered = filtered.filter((r) => r.photos && r.photos.length > 0);
        break;
    }

    return filtered;
  }, [reviews, filter]);

  // Display reviews (limited or all)
  const displayedReviews = showAll ? filteredReviews : filteredReviews.slice(0, 3);

  // Format date
  const formatStayDate = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  if (reviews.length === 0) {
    return (
      <section className={cn("space-y-4", className)}>
        <h2 className="text-xl font-semibold text-foreground">Reviews</h2>
        <div className="text-center py-12 bg-muted rounded-xl border border-border border-dashed">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Star className="h-6 w-6 text-amber-500" />
          </div>
          <p className="text-muted-foreground font-medium">No reviews yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to share your experience!
          </p>
        </div>
      </section>
    );
  }

  const avgRating = averageRating ?? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
  const count = totalCount ?? reviews.length;

  return (
    <section className={cn("space-y-6", className)}>
      {/* Header with rating summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            <span className="text-2xl font-bold text-foreground">
              {avgRating.toFixed(1)}
            </span>
          </div>
          <span className="text-muted-foreground">
            {count} review{count === 1 ? "" : "s"}
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "recent", "highest", "photos"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(
                filter === f
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" && "All"}
              {f === "recent" && "Most Recent"}
              {f === "highest" && "Highest Rated"}
              {f === "photos" && (
                <>
                  <Camera className="h-3 w-3 mr-1" />
                  Photos
                </>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Rating distribution bars */}
      <div className="grid gap-2 max-w-sm">
        {distribution.map(({ stars, percentage }) => (
          <div key={stars} className="flex items-center gap-2 text-sm">
            <span className="w-16 text-muted-foreground">{stars} stars</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-amber-400 rounded-full"
                initial={prefersReducedMotion ? { width: `${percentage}%` } : { width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, delay: 0.1 * (5 - stars) }}
              />
            </div>
            <span className="w-10 text-right text-muted-foreground">{percentage}%</span>
          </div>
        ))}
      </div>

      {/* Reviews list */}
      <div className="space-y-6">
        {displayedReviews.map((review, idx) => (
          <motion.div
            key={review.id}
            className="pb-6 border-b border-border last:border-0 last:pb-0"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            {/* Review header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {review.reviewerName || "Guest"}
                    </span>
                    {review.verified && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Verified Stay
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatStayDate(review.stayDate)}
                    {review.siteNumber && ` - Site ${review.siteNumber}`}
                  </div>
                </div>
              </div>

              {/* Star rating */}
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < review.rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* Review content */}
            <div className="relative">
              <Quote className="absolute -left-2 -top-2 h-6 w-6 text-muted-foreground" />
              <p className="text-foreground leading-relaxed pl-4">
                {review.comment}
              </p>
            </div>

            {/* Review photos */}
            {review.photos && review.photos.length > 0 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {review.photos.map((photo, i) => (
                  <div
                    key={i}
                    className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden"
                  >
                    <Image
                      src={photo}
                      alt={`Review photo ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="96px"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Helpful button */}
            {review.helpful !== undefined && (
              <div className="flex items-center gap-2 mt-4">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                  Helpful{review.helpful > 0 && ` (${review.helpful})`}
                </Button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Show more button */}
      {filteredReviews.length > 3 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            "Show less"
          ) : (
            <>
              Show all {count} reviews
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      )}
    </section>
  );
}

// Compact featured review for sidebar or cards
export function ReviewHighlight({
  review,
  className,
}: {
  review: Review;
  className?: string;
}) {
  return (
    <div className={cn("p-4 bg-amber-50 rounded-xl border border-amber-100", className)}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-3.5 w-3.5",
                i < review.rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-amber-200"
              )}
            />
          ))}
        </div>
        <span className="text-sm text-amber-700 font-medium">
          {review.reviewerName || "Guest"}
        </span>
      </div>
      <p className="text-sm text-amber-900 line-clamp-3 italic">
        "{review.comment}"
      </p>
    </div>
  );
}
