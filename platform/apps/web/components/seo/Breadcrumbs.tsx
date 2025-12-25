/**
 * SEO-Optimized Breadcrumbs Component
 * Provides visual breadcrumbs + JSON-LD structured data
 */

"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { BreadcrumbJsonLd } from "./JsonLd";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
  homeLabel?: string;
}

/**
 * Breadcrumbs with structured data for SEO
 * Automatically includes JSON-LD schema
 */
export function Breadcrumbs({
  items,
  className,
  showHome = true,
  homeLabel = "Home",
}: BreadcrumbsProps) {
  const allItems = showHome
    ? [{ name: homeLabel, path: "/" }, ...items]
    : items;

  return (
    <>
      <BreadcrumbJsonLd items={allItems} />
      <nav
        aria-label="Breadcrumb"
        className={cn("flex items-center text-sm text-slate-600", className)}
      >
        <ol className="flex items-center gap-1 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
          {allItems.map((item, index) => {
            const isLast = index === allItems.length - 1;
            const isFirst = index === 0;

            return (
              <li
                key={item.path}
                className="flex items-center"
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                {index > 0 && (
                  <ChevronRight className="h-4 w-4 mx-1 text-slate-400 flex-shrink-0" />
                )}
                {isLast ? (
                  <span
                    className="text-slate-900 font-medium truncate max-w-[200px]"
                    itemProp="name"
                    aria-current="page"
                  >
                    {item.name}
                  </span>
                ) : (
                  <Link
                    href={item.path}
                    className="hover:text-emerald-600 transition-colors flex items-center gap-1"
                    itemProp="item"
                  >
                    {isFirst && showHome && (
                      <Home className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span itemProp="name" className="truncate max-w-[150px]">
                      {item.name}
                    </span>
                  </Link>
                )}
                <meta itemProp="position" content={String(index + 1)} />
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Generate breadcrumb items for a campground page
 */
export function getCampgroundBreadcrumbs(campground: {
  name: string;
  slug: string;
  state?: string | null;
  city?: string | null;
}): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: "Browse Campgrounds", path: "/browse" },
  ];

  if (campground.state) {
    const stateSlug = campground.state.toLowerCase().replace(/\s+/g, "-");
    items.push({
      name: campground.state,
      path: `/browse/${stateSlug}`,
    });

    if (campground.city) {
      const citySlug = `${campground.city.toLowerCase().replace(/\s+/g, "-")}-${stateSlug}`;
      items.push({
        name: campground.city,
        path: `/browse/${citySlug}`,
      });
    }
  }

  items.push({
    name: campground.name,
    path: `/park/${campground.slug}`,
  });

  return items;
}

/**
 * Generate breadcrumb items for dashboard pages
 */
export function getDashboardBreadcrumbs(
  sections: Array<{ name: string; path: string }>
): BreadcrumbItem[] {
  return [
    { name: "Dashboard", path: "/dashboard" },
    ...sections,
  ];
}
