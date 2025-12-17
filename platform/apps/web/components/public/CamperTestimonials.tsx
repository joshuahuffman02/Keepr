"use client";

import { Star, CheckCircle2, Quote } from "lucide-react";
import { cn } from "../../lib/utils";

interface Testimonial {
  id: string;
  name: string;
  location?: string;
  campground?: string;
  rating: number;
  quote: string;
  stayDate?: string;
  avatar?: string;
}

// Static testimonials - can be replaced with API data later
const defaultTestimonials: Testimonial[] = [
  {
    id: "1",
    name: "Sarah M.",
    location: "Portland, OR",
    campground: "Pine Valley RV Resort",
    rating: 5,
    quote: "Booking was so easy! No surprise fees and the campground was exactly as pictured. We'll definitely use Camp Everyday again.",
    stayDate: "November 2024",
  },
  {
    id: "2",
    name: "Mike & Jenny T.",
    location: "Austin, TX",
    campground: "Lakeside Campground",
    rating: 5,
    quote: "Finally, a booking site that doesn't charge ridiculous fees. The direct booking feature meant we could ask the campground questions before we arrived.",
    stayDate: "October 2024",
  },
  {
    id: "3",
    name: "David R.",
    location: "Denver, CO",
    campground: "Mountain View RV Park",
    rating: 5,
    quote: "Instant confirmation was a game changer. No more wondering if our spot was actually reserved. Highly recommend!",
    stayDate: "September 2024",
  },
  {
    id: "4",
    name: "Lisa & Tom K.",
    location: "Seattle, WA",
    campground: "Coastal Haven",
    rating: 5,
    quote: "We've tried other booking sites but always got hit with hidden fees at checkout. Camp Everyday shows the real price upfront.",
    stayDate: "August 2024",
  },
  {
    id: "5",
    name: "Chris P.",
    location: "Phoenix, AZ",
    campground: "Desert Oasis RV",
    rating: 5,
    quote: "The photos were accurate, the reviews were genuine, and the whole process was smooth. This is how camping booking should be.",
    stayDate: "October 2024",
  },
  {
    id: "6",
    name: "Amanda & Steve B.",
    location: "Nashville, TN",
    campground: "Smoky Mountain Camp",
    rating: 5,
    quote: "Love that we can book directly with the campground. It feels more personal and we got a great rate.",
    stayDate: "November 2024",
  },
];

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

interface CamperTestimonialsProps {
  testimonials?: Testimonial[];
  className?: string;
}

export function CamperTestimonials({
  testimonials = defaultTestimonials,
  className,
}: CamperTestimonialsProps) {
  return (
    <section className={cn("py-16 md:py-20 bg-white", className)}>
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
            What Campers Are Saying
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Don't just take our word for it. Here's what real campers have to say about booking with Camp Everyday.
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-slate-50 rounded-2xl p-6 relative"
            >
              {/* Quote icon */}
              <Quote className="absolute top-4 right-4 h-8 w-8 text-slate-200" />

              {/* Rating */}
              <div className="mb-4">
                <StarRating rating={testimonial.rating} />
              </div>

              {/* Quote */}
              <blockquote className="text-slate-700 mb-4 relative z-10">
                "{testimonial.quote}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-3">
                {/* Avatar - initials fallback */}
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-700 font-semibold text-sm">
                    {testimonial.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 truncate">{testimonial.name}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                  {testimonial.campground && (
                    <p className="text-sm text-slate-500 truncate">
                      Stayed at {testimonial.campground}
                    </p>
                  )}
                </div>
              </div>

              {/* Stay date */}
              {testimonial.stayDate && (
                <p className="text-xs text-slate-400 mt-3">{testimonial.stayDate}</p>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-slate-600 mb-4">Join thousands of happy campers</p>
          <a
            href="#search"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Find Your Next Adventure
          </a>
        </div>
      </div>
    </section>
  );
}
