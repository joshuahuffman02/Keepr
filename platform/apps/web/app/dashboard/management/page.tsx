"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  Tent,
  Users,
  ShoppingCart,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Wrench,
  Ticket,
  Clock,
  Calendar,
  Sparkles,
  Search,
  ChevronRight,
  Star,
} from "lucide-react";

type ManagementLink = {
  name: string;
  href: string;
  description: string;
};

type ManagementCategory = {
  title: string;
  description: string;
  icon: typeof Tent;
  color: string;
  links: ManagementLink[];
};

const managementCategories: ManagementCategory[] = [
  {
    title: "Inventory & Property",
    description: "Manage sites, site classes, and property details",
    icon: Tent,
    color: "emerald",
    links: [
      {
        name: "Sites",
        href: "/campgrounds?goto=sites",
        description: "View and manage individual campsites",
      },
      {
        name: "Site Classes & Pricing",
        href: "/campgrounds?goto=classes",
        description: "Configure site categories and set nightly rates",
      },
      {
        name: "Dynamic Pricing",
        href: "/campgrounds?goto=dynamic-pricing",
        description: "Set seasonal rates, weekend pricing, and discounts",
      },
    ],
  },
  {
    title: "Guests & Groups",
    description: "Manage guest records and group bookings",
    icon: Users,
    color: "blue",
    links: [
      {
        name: "Groups",
        href: "/groups",
        description: "Manage group reservations and events",
      },
      {
        name: "Guest Database",
        href: "/guests",
        description: "Search and manage guest profiles",
      },
      {
        name: "Memberships",
        href: "/memberships",
        description: "View and manage guest memberships",
      },
    ],
  },
  {
    title: "Finance & Revenue",
    description: "Track revenue, payouts, and financial transactions",
    icon: DollarSign,
    color: "green",
    links: [
      {
        name: "Ledger",
        href: "/ledger",
        description: "View all financial transactions and entries",
      },
      {
        name: "Payouts",
        href: "/finance/payouts",
        description: "Track and manage payment disbursements",
      },
      {
        name: "Gift Cards",
        href: "/finance/gift-cards",
        description: "Manage gift card inventory and redemptions",
      },
      {
        name: "Disputes",
        href: "/finance/disputes",
        description: "Handle payment disputes and chargebacks",
      },
      {
        name: "Referral Program",
        href: "/dashboard/referrals",
        description: "Earn $50 credits by referring other campground owners",
      },
    ],
  },
  {
    title: "Store & Products",
    description: "Manage store inventory and products",
    icon: ShoppingCart,
    color: "orange",
    links: [
      {
        name: "Store",
        href: "/store",
        description: "Manage store products and inventory",
      },
      {
        name: "Point of Sale",
        href: "/pos",
        description: "Process walk-in sales and transactions",
      },
      {
        name: "Equipment Rentals",
        href: "/operations/rentals",
        description: "Manage rental equipment and bookings",
      },
    ],
  },
  {
    title: "Operations",
    description: "Daily operations and maintenance tasks",
    icon: Wrench,
    color: "violet",
    links: [
      {
        name: "Operations Board",
        href: "/operations",
        description: "Central dashboard for daily operations",
      },
      {
        name: "Maintenance",
        href: "/maintenance",
        description: "Track and manage maintenance requests",
      },
      {
        name: "Housekeeping",
        href: "/housekeeping",
        description: "Manage cleaning schedules and site turnover",
      },
      {
        name: "Waitlist",
        href: "/waitlist",
        description: "Manage guest waitlist for sold-out dates",
      },
    ],
  },
  {
    title: "Staff",
    description: "Staff management and scheduling",
    icon: Clock,
    color: "indigo",
    links: [
      {
        name: "Staff Timeclock",
        href: "/staff/timeclock",
        description: "Track employee clock-in and clock-out times",
      },
      {
        name: "Staff Scheduling",
        href: "/staff-scheduling",
        description: "Create and manage staff schedules",
      },
      {
        name: "Staff Gamification",
        href: "/gamification",
        description: "View staff achievements and leaderboards",
      },
    ],
  },
];

const iconColorMap: Record<string, string> = {
  emerald: "bg-status-success/15 text-status-success",
  blue: "bg-status-info/15 text-status-info",
  green: "bg-status-success/15 text-status-success",
  orange: "bg-status-warning/15 text-status-warning",
  violet: "bg-violet-100 text-violet-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export default function ManagementLandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("campreserv:nav:favorites");
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const toggleFavorite = (href: string) => {
    setFavorites((prev) => {
      const next = prev.includes(href)
        ? prev.filter((f) => f !== href)
        : [href, ...prev].slice(0, 20);
      // Persist to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("campreserv:nav:favorites", JSON.stringify(next));
      }
      return next;
    });
  };

  // Filter categories and links based on search query
  const filteredCategories = managementCategories
    .map((category) => ({
      ...category,
      links: category.links.filter(
        (link) =>
          link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.description.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((category) => category.links.length > 0 || searchQuery === "");

  return (
    <DashboardShell>
      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your campground inventory, finances, operations, and staff
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search management areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tip for favorites */}
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Star className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Save your most-used pages to Favorites
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Click the star icon on any card to add it to your sidebar favorites for quick access.
            </p>
          </div>
        </div>

        {/* Management Categories */}
        <div className="space-y-12">
          {filteredCategories.map((category) => {
            const IconComponent = category.icon;
            const iconColorClass = iconColorMap[category.color] || iconColorMap.violet;

            return (
              <div key={category.title}>
                {/* Category Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2.5 rounded-lg ${iconColorClass}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{category.title}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">{category.description}</p>
                  </div>
                </div>

                {/* Links Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {category.links.map((link) => {
                    const isFavorite = favorites.includes(link.href);
                    return (
                      <div key={link.href} className="relative group">
                        <Link href={link.href} className="block">
                          <Card className="h-full transition-all hover:shadow-md hover:border-emerald-300 cursor-pointer group-hover:bg-muted">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold text-foreground">
                                  {link.name}
                                </CardTitle>
                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                              </div>
                              <CardDescription className="text-sm line-clamp-2">
                                {link.description}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        </Link>
                        {/* Favorite button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(link.href);
                          }}
                          className={`absolute top-3 right-10 p-1.5 rounded-md transition-all ${
                            isFavorite
                              ? "text-amber-500 bg-amber-50"
                              : "text-muted-foreground hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                          }`}
                          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filteredCategories.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-2">
              <Search className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No items found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search term or browse the categories above
            </p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
