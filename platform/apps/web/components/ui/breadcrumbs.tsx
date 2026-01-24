"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb item with flexible naming
 * Supports both 'label' and 'name' for backwards compatibility
 */
export interface BreadcrumbItem {
  label?: string;
  name?: string;
  href?: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
  homeLabel?: string;
  enableSeo?: boolean;
}

/**
 * Unified Breadcrumbs component
 * Supports both simple breadcrumbs and SEO-enhanced with JSON-LD
 */
export function Breadcrumbs({
  items,
  className,
  showHome = false,
  homeLabel = "Home",
  enableSeo = false,
}: BreadcrumbsProps) {
  if (!items || items.length === 0) return null;

  const allItems = showHome
    ? [{ name: homeLabel, label: homeLabel, path: "/", href: "/" }, ...items]
    : items;

  // Normalize items to have both label/name and href/path
  const normalizedItems = allItems.map((item) => ({
    label: item.label || item.name || "",
    name: item.name || item.label || "",
    href: item.href || item.path,
    path: item.path || item.href,
  }));

  if (enableSeo) {
    return (
      <>
        <BreadcrumbJsonLd items={normalizedItems} />
        <nav
          aria-label="Breadcrumb"
          className={cn("flex items-center text-sm text-muted-foreground", className)}
        >
          <ol
            className="flex items-center gap-1 flex-wrap"
            itemScope
            itemType="https://schema.org/BreadcrumbList"
          >
            {normalizedItems.map((item, index) => {
              const isLast = index === normalizedItems.length - 1;
              const isFirst = index === 0;

              return (
                <li
                  key={item.path || `item-${index}`}
                  className="flex items-center"
                  itemProp="itemListElement"
                  itemScope
                  itemType="https://schema.org/ListItem"
                >
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/70 flex-shrink-0" />
                  )}
                  {isLast ? (
                    <span
                      className="text-foreground font-medium truncate max-w-[200px]"
                      itemProp="name"
                      aria-current="page"
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link
                      href={item.href || "#"}
                      className="hover:text-action-primary transition-colors flex items-center gap-1"
                      itemProp="item"
                    >
                      {isFirst && showHome && <Home className="h-4 w-4" aria-hidden="true" />}
                      <span itemProp="name" className="truncate max-w-[150px]">
                        {item.label}
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

  // Simple breadcrumbs without SEO
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex flex-wrap items-center gap-1 text-sm text-muted-foreground", className)}
    >
      {normalizedItems.map((item, idx) => {
        const isLast = idx === normalizedItems.length - 1;
        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground font-medium transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium" : ""}>{item.label}</span>
            )}
            {!isLast && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * JSON-LD Breadcrumb Schema for SEO
 */
function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; path?: string }> }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path ? `${process.env.NEXT_PUBLIC_SITE_URL || ""}${item.path}` : undefined,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
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
  const items: BreadcrumbItem[] = [{ name: "Browse Campgrounds", path: "/browse" }];

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
  sections: Array<{ name: string; path: string }>,
): BreadcrumbItem[] {
  return [{ name: "Dashboard", path: "/dashboard" }, ...sections];
}
