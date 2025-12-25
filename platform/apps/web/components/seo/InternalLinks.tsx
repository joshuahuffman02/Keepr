/**
 * Internal Linking Components for Programmatic SEO
 * Helps with link equity distribution and related content discovery
 */

"use client";

import Link from "next/link";
import { MapPin, ArrowRight, Star, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedCampground {
  name: string;
  slug: string;
  city?: string | null;
  state?: string | null;
  heroImageUrl?: string | null;
  reviewScore?: number | null;
  siteTypes?: string[];
}

interface RelatedCampgroundsProps {
  campgrounds: RelatedCampground[];
  title?: string;
  className?: string;
  maxItems?: number;
}

/**
 * Related campgrounds section for internal linking
 */
export function RelatedCampgrounds({
  campgrounds,
  title = "Nearby Campgrounds",
  className,
  maxItems = 4,
}: RelatedCampgroundsProps) {
  const items = campgrounds.slice(0, maxItems);

  if (items.length === 0) return null;

  return (
    <section className={cn("py-8", className)} aria-labelledby="related-campgrounds-title">
      <h2 id="related-campgrounds-title" className="text-xl font-bold text-slate-900 mb-4">
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((campground) => (
          <Link
            key={campground.slug}
            href={`/park/${campground.slug}`}
            className="group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            {campground.heroImageUrl && (
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={campground.heroImageUrl}
                  alt={campground.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
            )}
            <div className="p-4">
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                {campground.name}
              </h3>
              {(campground.city || campground.state) && (
                <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[campground.city, campground.state].filter(Boolean).join(", ")}
                </p>
              )}
              {campground.reviewScore && (
                <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {campground.reviewScore.toFixed(1)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface LocationLink {
  name: string;
  slug: string;
  count: number;
}

interface LocationLinksProps {
  locations: LocationLink[];
  title?: string;
  type?: "state" | "city";
  className?: string;
}

/**
 * Location-based internal links for programmatic SEO
 */
export function LocationLinks({
  locations,
  title = "Explore by Location",
  type = "state",
  className,
}: LocationLinksProps) {
  if (locations.length === 0) return null;

  return (
    <section className={cn("py-8", className)} aria-labelledby="location-links-title">
      <h2 id="location-links-title" className="text-xl font-bold text-slate-900 mb-4">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {locations.map((location) => (
          <Link
            key={location.slug}
            href={`/browse/${location.slug}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-full text-sm text-slate-700 hover:text-emerald-700 transition-colors"
          >
            <MapPin className="h-4 w-4" />
            {location.name}
            <span className="text-xs text-slate-500">({location.count})</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface SiteTypeLink {
  type: string;
  label: string;
  count: number;
}

interface SiteTypeLinksProps {
  siteTypes: SiteTypeLink[];
  title?: string;
  className?: string;
}

/**
 * Site type filtering links
 */
export function SiteTypeLinks({
  siteTypes,
  title = "Browse by Type",
  className,
}: SiteTypeLinksProps) {
  if (siteTypes.length === 0) return null;

  return (
    <section className={cn("py-8", className)} aria-labelledby="site-type-links-title">
      <h2 id="site-type-links-title" className="text-xl font-bold text-slate-900 mb-4">
        {title}
      </h2>
      <div className="flex flex-wrap gap-2">
        {siteTypes.map((siteType) => (
          <Link
            key={siteType.type}
            href={`/browse?type=${siteType.type}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-emerald-300 rounded-lg text-sm text-slate-700 hover:text-emerald-700 transition-colors"
          >
            {siteType.label}
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
              {siteType.count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

interface QuickLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Styled internal link with arrow
 */
export function QuickLink({ href, children, className }: QuickLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium group",
        className
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

interface FooterLinksSection {
  title: string;
  links: Array<{ name: string; href: string }>;
}

interface SEOFooterLinksProps {
  sections: FooterLinksSection[];
  className?: string;
}

/**
 * Footer links section for SEO value distribution
 */
export function SEOFooterLinks({ sections, className }: SEOFooterLinksProps) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-8", className)}>
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="font-semibold text-slate-900 mb-3">{section.title}</h3>
          <ul className="space-y-2">
            {section.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Default footer link sections for Camp Everyday
 */
export const DEFAULT_FOOTER_SECTIONS: FooterLinksSection[] = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "/features" },
      { name: "Pricing", href: "/pricing" },
      { name: "Case Studies", href: "/case-studies" },
      { name: "Roadmap", href: "/public-roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { name: "Documentation", href: "/docs" },
      { name: "API Reference", href: "/developers" },
      { name: "Help Center", href: "/help" },
      { name: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "/about" },
      { name: "Careers", href: "/careers" },
      { name: "Contact", href: "/contact" },
      { name: "Press", href: "/press" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
      { name: "Cookie Policy", href: "/cookies" },
      { name: "GDPR", href: "/gdpr" },
    ],
  },
];

interface AvailabilityCtaProps {
  campgroundSlug: string;
  campgroundName: string;
  className?: string;
}

/**
 * Call-to-action for checking availability
 */
export function AvailabilityCta({
  campgroundSlug,
  campgroundName,
  className,
}: AvailabilityCtaProps) {
  return (
    <div className={cn("bg-emerald-50 border border-emerald-100 rounded-xl p-6", className)}>
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Calendar className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900">Check Availability</h3>
          <p className="text-sm text-slate-600 mt-1">
            See available dates and book your stay at {campgroundName}
          </p>
          <Link
            href={`/park/${campgroundSlug}/book`}
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            View Availability
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
