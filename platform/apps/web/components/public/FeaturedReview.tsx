"use client";

import { Star, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface FeaturedReviewProps {
  review: {
    id: string;
    rating: number;
    comment: string;
    guestName: string;
    guestLocation?: string;
    stayDate?: string;
    isVerified?: boolean;
  };
  className?: string;
  variant?: "light" | "dark" | "glass";
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-muted-foreground"
          )}
        />
      ))}
    </div>
  );
}

export function FeaturedReview({
  review,
  className,
  variant = "light",
}: FeaturedReviewProps) {
  const truncatedComment = review.comment.length > 150
    ? review.comment.slice(0, 150) + "..."
    : review.comment;

  return (
    <div
      className={cn(
        "rounded-xl p-4",
        variant === "light" && "bg-card shadow-lg border border-border",
        variant === "dark" && "bg-muted border border-border",
        variant === "glass" && "bg-card/10 backdrop-blur-sm border border-white/20",
        className
      )}
    >
      {/* Rating */}
      <div className="flex items-center gap-2 mb-2">
        <StarRating rating={review.rating} />
        {review.isVerified && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              variant === "light" && "text-status-success",
              variant === "dark" && "text-status-success",
              variant === "glass" && "text-status-success"
            )}
          >
            <CheckCircle2 className="h-3 w-3" />
            Verified Stay
          </span>
        )}
      </div>

      {/* Quote */}
      <blockquote
        className={cn(
          "text-sm mb-3",
          variant === "light" && "text-foreground",
          variant === "dark" && "text-muted-foreground",
          variant === "glass" && "text-white"
        )}
      >
        "{truncatedComment}"
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-2">
        {/* Avatar - initials */}
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
            variant === "light" && "bg-status-success/15 text-status-success",
            variant === "dark" && "bg-status-success/15 text-status-success",
            variant === "glass" && "bg-card/20 text-foreground"
          )}
        >
          {review.guestName
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </div>

        <div>
          <p
            className={cn(
              "text-sm font-medium",
              variant === "light" && "text-foreground",
              variant === "dark" && "text-white",
              variant === "glass" && "text-white"
            )}
          >
            {review.guestName}
          </p>
          {(review.guestLocation || review.stayDate) && (
            <p
              className={cn(
                "text-xs",
                variant === "light" && "text-muted-foreground",
                variant === "dark" && "text-muted-foreground",
                variant === "glass" && "text-white/70"
              )}
            >
              {[review.guestLocation, review.stayDate].filter(Boolean).join(" • ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
