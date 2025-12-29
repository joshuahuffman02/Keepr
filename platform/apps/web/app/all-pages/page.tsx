"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { useMenuConfig } from "@/hooks/use-menu-config";
import { useWhoami } from "@/hooks/use-whoami";
import {
  resolvePages,
  getPagesByCategory,
  CATEGORY_INFO,
  searchPages,
  PageCategory,
} from "@/lib/page-registry";
import { cn } from "@/lib/utils";

export default function AllPagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PageCategory | "all">("all");
  const { isPinned, togglePin } = useMenuConfig();
  const { data: whoami } = useWhoami();

  // Get selected campground for resolving dynamic pages
  const selectedCampground =
    typeof window !== "undefined"
      ? localStorage.getItem("campreserv:selectedCampground")
      : null;

  // Resolve all pages for this campground
  const allPages = useMemo(
    () => resolvePages(selectedCampground || null),
    [selectedCampground]
  );

  // Filter by permissions (basic check)
  const permissions = (whoami?.allowed as Record<string, boolean> | undefined) || {};
  const platformRole = (whoami?.user as { platformRole?: string | null } | undefined)?.platformRole ?? null;
  const accessiblePages = useMemo(() => {
    return allPages.filter((page) => {
      if (!page.permissions || page.permissions.length === 0) return true;
      if (platformRole) return true; // Platform admins can see everything
      return page.permissions.some((p) => permissions[p]);
    });
  }, [allPages, permissions, platformRole]);

  // Search and filter
  const filteredPages = useMemo(() => {
    let pages = accessiblePages;

    if (searchQuery.trim()) {
      pages = searchPages(pages, searchQuery);
    }

    if (selectedCategory !== "all") {
      pages = pages.filter((p) => p.category === selectedCategory);
    }

    return pages;
  }, [accessiblePages, searchQuery, selectedCategory]);

  // Group by category for display
  const pagesByCategory = useMemo(
    () => getPagesByCategory(filteredPages),
    [filteredPages]
  );

  // Only show categories that have accessible pages
  const availableCategories = useMemo(() => {
    const categoriesWithPages = new Set<PageCategory>();
    for (const page of accessiblePages) {
      categoriesWithPages.add(page.category);
    }
    return ["all" as const, ...Array.from(categoriesWithPages).sort((a, b) => {
      const order: PageCategory[] = ["operations", "guests", "finance", "marketing", "reports", "store", "staff", "settings", "admin"];
      return order.indexOf(a) - order.indexOf(b);
    })];
  }, [accessiblePages]);

  const categories = availableCategories;

  return (
    <DashboardShell title="All Pages" subtitle="Browse and pin pages to your menu">
      {/* Search and filters */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedCategory === cat
                  ? "bg-teal-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {cat === "all" ? "All" : CATEGORY_INFO[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {searchQuery && filteredPages.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500">No pages found matching "{searchQuery}"</p>
        </div>
      ) : selectedCategory === "all" ? (
        // Show grouped by category when viewing all
        <div className="space-y-8">
          {Object.entries(pagesByCategory).map(([category, pages]) => {
            if (pages.length === 0) return null;
            const catInfo = CATEGORY_INFO[category as PageCategory];
            return (
              <div key={category}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {catInfo?.label || category}
                  </h2>
                  <p className="text-sm text-slate-500">{catInfo?.description}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pages.map((page) => (
                    <PageCard
                      key={page.href}
                      page={page}
                      isPinned={isPinned(page.href)}
                      onTogglePin={() => togglePin(page.href)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Show flat list when filtering by category
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPages.map((page) => (
            <PageCard
              key={page.href}
              page={page}
              isPinned={isPinned(page.href)}
              onTogglePin={() => togglePin(page.href)}
            />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

interface PageCardProps {
  page: {
    href: string;
    label: string;
    description: string;
    icon: string;
    category: PageCategory;
  };
  isPinned: boolean;
  onTogglePin: () => void;
}

function PageCard({ page, isPinned, onTogglePin }: PageCardProps) {
  return (
    <div className="group relative bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md hover:border-slate-300 transition-all">
      <Link href={page.href} className="block">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <PageIcon name={page.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 truncate">{page.label}</h3>
            <p className="text-sm text-slate-500 line-clamp-2">{page.description}</p>
          </div>
        </div>
      </Link>

      {/* Pin button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin();
        }}
        className={cn(
          "absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
          isPinned
            ? "bg-amber-100 text-amber-600"
            : "bg-slate-100 text-slate-400 opacity-0 group-hover:opacity-100"
        )}
        title={isPinned ? "Unpin from menu" : "Pin to menu"}
      >
        <svg
          viewBox="0 0 24 24"
          fill={isPinned ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z" />
        </svg>
      </button>
    </div>
  );
}

function PageIcon({ name }: { name: string }) {
  const stroke = "#64748b";
  const common = {
    width: 20,
    height: 20,
    strokeWidth: 1.6,
    stroke,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "reservation":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 3h12a2 2 0 0 1 2 2v16l-5-3-5 3-5-3V5a2 2 0 0 1 2-2Z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "guest":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "message":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "reports":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M4 20h16M4 4h5v16H4zM11 8h4v12h-4zM17 12h3v8h-3z" />
        </svg>
      );
    case "payments":
    case "pricing":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9 10c0-1.5 1.5-2.5 3-2.5s3 .9 3 2.5-1.5 2.5-3 2.5-3 .9-3 2.5 1.5 2.5 3 2.5 3-.9 3-2.5" />
        </svg>
      );
    case "wrench":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M19.4 4.6a5 5 0 0 1-6.8 6.8L8 15l-3-3 3.6-4.6a5 5 0 0 1 6.8-2.8l-3 3 3 3z" />
          <path d="M7 14 3.5 17.5" />
        </svg>
      );
    case "camp":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="m4 20 8-14 8 14M2 20h20M9 15h6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="9" cy="8" r="3" />
          <path d="M2 20a7 7 0 0 1 14 0" />
          <circle cx="17" cy="9" r="2" />
          <path d="M22 20a4.5 4.5 0 0 0-6-4.2" />
        </svg>
      );
    case "policy":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 4h12v16l-6-3-6 3z" />
          <path d="M9 9h6M9 12h6" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "tag":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M20 12 12 20 4 12V4h8l8 8Z" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M3 11v2a1 1 0 0 0 1 1h2l5 3V7L6 10H4a1 1 0 0 0-1 1Z" />
          <path d="M14 7a4 4 0 0 1 0 10" />
        </svg>
      );
    case "star":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 3v3M12 18v3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M3 12h3M18 12h3M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 8l1.8 3.7L18 13l-3.7 1.3L12 18l-1.3-3.7L7 13l3.7-1.3z" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "alert":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 2 2 22h20L12 2Z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      );
    case "form":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M8 10h8M8 14h6" />
        </svg>
      );
    case "brand":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="7" />
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
          <path d="M13 5v2M13 17v2M13 11v2" />
        </svg>
      );
    case "ledger":
    case "audit":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2V6a2 2 0 0 1 2-2Z" />
          <path d="M9 8h6M9 12h6" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg {...common} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
