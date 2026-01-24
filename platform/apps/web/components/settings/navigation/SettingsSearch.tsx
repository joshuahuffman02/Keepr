"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search,
  Building2,
  DollarSign,
  Calendar,
  ShoppingCart,
  Shield,
  Settings,
  LucideIcon,
} from "lucide-react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

interface SearchItem {
  id: string;
  label: string;
  description: string;
  href: string;
  category: string;
  categoryIcon: LucideIcon;
  keywords: string[];
}

// All searchable settings items
const searchItems: SearchItem[] = [
  // Property
  {
    id: "profile",
    label: "Campground Profile",
    description: "Name, address, contact info",
    href: "/dashboard/settings/central/property/profile",
    category: "Property",
    categoryIcon: Building2,
    keywords: ["name", "address", "contact", "phone", "email"],
  },
  {
    id: "sites",
    label: "Site Types",
    description: "RV, tent, cabin configurations",
    href: "/dashboard/settings/central/property/sites",
    category: "Property",
    categoryIcon: Building2,
    keywords: ["site", "type", "rv", "tent", "cabin", "class"],
  },
  {
    id: "equipment",
    label: "Equipment Types",
    description: "RV types, tow requirements",
    href: "/dashboard/settings/central/property/equipment",
    category: "Property",
    categoryIcon: Building2,
    keywords: ["equipment", "rv", "motorhome", "trailer", "tow", "length"],
  },
  {
    id: "branding",
    label: "Branding",
    description: "Logo, colors, theme",
    href: "/dashboard/settings/branding",
    category: "Property",
    categoryIcon: Building2,
    keywords: ["brand", "logo", "color", "theme"],
  },
  {
    id: "photos",
    label: "Photos",
    description: "Property images",
    href: "/dashboard/settings/photos",
    category: "Property",
    categoryIcon: Building2,
    keywords: ["photo", "image", "gallery"],
  },

  // Pricing
  {
    id: "rate-groups",
    label: "Rate Groups",
    description: "Calendar periods with colors",
    href: "/dashboard/settings/central/pricing/rate-groups",
    category: "Pricing",
    categoryIcon: DollarSign,
    keywords: ["rate", "group", "season", "calendar", "color", "period"],
  },
  {
    id: "seasonal",
    label: "Seasonal Rates",
    description: "Season-based pricing",
    href: "/dashboard/settings/central/pricing/seasonal",
    category: "Pricing",
    categoryIcon: DollarSign,
    keywords: ["seasonal", "rate", "summer", "winter", "peak"],
  },
  {
    id: "dynamic",
    label: "Dynamic Pricing",
    description: "Demand-based rules",
    href: "/dashboard/settings/central/pricing/dynamic",
    category: "Pricing",
    categoryIcon: DollarSign,
    keywords: ["dynamic", "pricing", "demand", "rule", "automatic"],
  },
  {
    id: "taxes",
    label: "Tax Rules",
    description: "Tax rates and exemptions",
    href: "/dashboard/settings/central/pricing/taxes",
    category: "Pricing",
    categoryIcon: DollarSign,
    keywords: ["tax", "rate", "exempt", "lodging"],
  },
  {
    id: "deposits",
    label: "Deposit Policies",
    description: "Deposit requirements",
    href: "/dashboard/settings/deposit-policies",
    category: "Pricing",
    categoryIcon: DollarSign,
    keywords: ["deposit", "payment", "policy"],
  },

  // Bookings
  {
    id: "policies",
    label: "Booking Policies",
    description: "Cancellation, check-in rules",
    href: "/dashboard/settings/central/bookings/policies",
    category: "Bookings",
    categoryIcon: Calendar,
    keywords: ["booking", "policy", "cancel", "cancellation", "check-in", "check-out"],
  },
  {
    id: "stay-rules",
    label: "Stay Rules",
    description: "Min/max night requirements",
    href: "/dashboard/settings/central/bookings/stay-rules",
    category: "Bookings",
    categoryIcon: Calendar,
    keywords: ["stay", "rule", "minimum", "maximum", "night"],
  },
  {
    id: "custom-fields",
    label: "Custom Fields",
    description: "Guest questions (UDFs)",
    href: "/dashboard/settings/central/bookings/custom-fields",
    category: "Bookings",
    categoryIcon: Calendar,
    keywords: ["custom", "field", "question", "udf", "guest"],
  },
  {
    id: "optimization",
    label: "Grid Optimization",
    description: "Auto-optimize site assignments",
    href: "/dashboard/settings/central/bookings/optimization",
    category: "Bookings",
    categoryIcon: Calendar,
    keywords: ["optimization", "grid", "auto", "move", "assignment"],
  },
  {
    id: "blackouts",
    label: "Blackout Dates",
    description: "Block dates from booking",
    href: "/dashboard/settings/blackout-dates",
    category: "Bookings",
    categoryIcon: Calendar,
    keywords: ["blackout", "block", "date", "close"],
  },
  {
    id: "promotions",
    label: "Promotions",
    description: "Discounts and promo codes",
    href: "/dashboard/settings/promotions",
    category: "Bookings",
    categoryIcon: Calendar,
    keywords: ["promotion", "discount", "promo", "code", "coupon"],
  },

  // Store
  {
    id: "products",
    label: "Store Products",
    description: "POS inventory items",
    href: "/dashboard/settings/central/store/products",
    category: "Store",
    categoryIcon: ShoppingCart,
    keywords: ["store", "product", "pos", "inventory", "item"],
  },
  {
    id: "upsells",
    label: "Upsells",
    description: "Add-on products for guests",
    href: "/dashboard/settings/upsells",
    category: "Store",
    categoryIcon: ShoppingCart,
    keywords: ["upsell", "addon", "extra"],
  },
  {
    id: "pos-integrations",
    label: "POS Integrations",
    description: "Connect POS systems",
    href: "/dashboard/settings/pos-integrations",
    category: "Store",
    categoryIcon: ShoppingCart,
    keywords: ["pos", "integration", "lightspeed", "shopify"],
  },

  // Access
  {
    id: "users",
    label: "Users",
    description: "Staff accounts",
    href: "/dashboard/settings/central/access/users",
    category: "Access",
    categoryIcon: Shield,
    keywords: ["user", "staff", "account", "employee"],
  },
  {
    id: "roles",
    label: "Roles & Permissions",
    description: "Access control",
    href: "/dashboard/settings/central/access/roles",
    category: "Access",
    categoryIcon: Shield,
    keywords: ["role", "permission", "access", "control"],
  },
  {
    id: "security",
    label: "Security Settings",
    description: "Password policies, 2FA",
    href: "/dashboard/settings/security",
    category: "Access",
    categoryIcon: Shield,
    keywords: ["security", "password", "2fa", "authentication"],
  },

  // System
  {
    id: "system-check",
    label: "System Check",
    description: "Configuration health",
    href: "/dashboard/settings/central/system/check",
    category: "System",
    categoryIcon: Settings,
    keywords: ["system", "check", "health", "issue", "error"],
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Third-party connections",
    href: "/dashboard/settings/central/system/integrations",
    category: "System",
    categoryIcon: Settings,
    keywords: ["integration", "connect", "third-party", "api"],
  },
  {
    id: "email-templates",
    label: "Email Templates",
    description: "Customize emails",
    href: "/dashboard/settings/templates",
    category: "System",
    categoryIcon: Settings,
    keywords: ["email", "template", "message", "notification"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    description: "Event notifications",
    href: "/dashboard/settings/webhooks",
    category: "System",
    categoryIcon: Settings,
    keywords: ["webhook", "event", "notification", "api"],
  },
];

interface SettingsSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSearch({ open, onOpenChange }: SettingsSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Filter results based on query
  const results = useMemo(() => {
    if (!query.trim()) {
      // Show popular/recent when no query
      return searchItems.slice(0, 8);
    }

    const lowerQuery = query.toLowerCase();
    return searchItems.filter((item) => {
      const searchText =
        `${item.label} ${item.description} ${item.keywords.join(" ")}`.toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].href);
            onOpenChange(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [results, selectedIndex, router, onOpenChange],
  );

  const handleSelect = (item: SearchItem) => {
    router.push(item.href);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>Search Settings</DialogTitle>
        </VisuallyHidden>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <Input
            type="text"
            placeholder="Search settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-lg border-0 shadow-none focus-visible:ring-0 px-0"
            autoFocus
            aria-label="Search settings"
            aria-controls="search-results"
            aria-activedescendant={results[selectedIndex]?.id}
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div id="search-results" role="listbox" className="max-h-[50vh] overflow-auto p-2">
          {results.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No settings found for "{query}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, index) => {
                const Icon = item.categoryIcon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left",
                      "transition-colors duration-75",
                      isSelected ? "bg-emerald-50 text-emerald-900" : "hover:bg-muted",
                    )}
                    style={{
                      animationDelay: `${index * 30}ms`,
                    }}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center h-8 w-8 rounded-lg",
                        isSelected ? "bg-emerald-100" : "bg-muted",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isSelected ? "text-emerald-600" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-card rounded border text-[10px]">↑↓</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-card rounded border text-[10px]">↵</kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-card rounded border text-[10px]">ESC</kbd>
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
