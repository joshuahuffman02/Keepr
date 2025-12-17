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
            star <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"
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
        variant === "light" && "bg-white shadow-lg border border-slate-100",
        variant === "dark" && "bg-slate-800 border border-slate-700",
        variant === "glass" && "bg-white/10 backdrop-blur-sm border border-white/20",
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
              variant === "light" && "text-emerald-600",
              variant === "dark" && "text-emerald-400",
              variant === "glass" && "text-emerald-300"
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
          variant === "light" && "text-slate-700",
          variant === "dark" && "text-slate-200",
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
            variant === "light" && "bg-emerald-100 text-emerald-700",
            variant === "dark" && "bg-emerald-900 text-emerald-200",
            variant === "glass" && "bg-white/20 text-white"
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
              variant === "light" && "text-slate-900",
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
                variant === "light" && "text-slate-500",
                variant === "dark" && "text-slate-400",
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
