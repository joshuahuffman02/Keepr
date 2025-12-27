"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  DollarSign,
  Calendar,
  ShoppingCart,
  Shield,
  Settings,
  LucideIcon,
} from "lucide-react";

interface Category {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  description: string;
}

const categories: Category[] = [
  {
    id: "property",
    label: "Property",
    icon: Building2,
    href: "/dashboard/settings/central/property",
    description: "Campground profile, sites, equipment",
  },
  {
    id: "pricing",
    label: "Pricing",
    icon: DollarSign,
    href: "/dashboard/settings/central/pricing",
    description: "Rates, seasons, taxes, deposits",
  },
  {
    id: "bookings",
    label: "Bookings",
    icon: Calendar,
    href: "/dashboard/settings/central/bookings",
    description: "Policies, rules, custom fields",
  },
  {
    id: "store",
    label: "Store",
    icon: ShoppingCart,
    href: "/dashboard/settings/central/store",
    description: "Products, POS, upsells",
  },
  {
    id: "access",
    label: "Access",
    icon: Shield,
    href: "/dashboard/settings/central/access",
    description: "Users, roles, permissions",
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    href: "/dashboard/settings/central/system",
    description: "Integrations, health, jobs",
  },
];

interface CategoryTabsProps {
  className?: string;
}

export function CategoryTabs({ className }: CategoryTabsProps) {
  const pathname = usePathname();

  const getActiveCategory = () => {
    for (const category of categories) {
      if (pathname?.startsWith(category.href)) {
        return category.id;
      }
    }
    return "property";
  };

  const activeCategory = getActiveCategory();

  return (
    <div className={cn("border-b bg-white", className)}>
      <nav
        role="tablist"
        aria-label="Settings categories"
        className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-hide"
      >
        {categories.map((category) => {
          const isActive = category.id === activeCategory;
          const Icon = category.icon;

          return (
            <Link
              key={category.id}
              href={category.href}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${category.id}-panel`}
              title={category.description}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium",
                "border-b-2 transition-all duration-200 whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset",
                "hover:bg-slate-50",
                isActive
                  ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{category.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export { categories };
export type { Category };
