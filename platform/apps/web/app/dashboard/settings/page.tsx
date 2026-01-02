"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import {
  DollarSign,
  Mail,
  Lock,
  Settings,
  Search,
  ChevronRight,
  Star,
  Palette,
  Check,
} from "lucide-react";
import { useThemePreferences, type AccentColor } from "@/hooks/use-theme-preferences";
import { cn } from "@/lib/utils";

type SettingLink = {
  name: string;
  href: string;
  description: string;
};

type SettingCategory = {
  title: string;
  description: string;
  icon: typeof DollarSign;
  color: string;
  links: SettingLink[];
};

const settingsCategories: SettingCategory[] = [
  {
    title: "Pricing & Revenue",
    description: "Manage pricing strategies, rates, and revenue optimization",
    icon: DollarSign,
    color: "emerald",
    links: [
      {
        name: "Dynamic Pricing",
        href: "/dashboard/settings/pricing-rules",
        description: "Configure automated pricing rules based on demand, seasons, and events",
      },
      {
        name: "Seasonal Rates",
        href: "/dashboard/settings/seasonal-rates",
        description: "Set up seasonal rate variations throughout the year",
      },
      {
        name: "Deposit Policies",
        href: "/dashboard/settings/deposit-policies",
        description: "Define deposit requirements and policies for reservations",
      },
      {
        name: "Tax Rules",
        href: "/dashboard/settings/tax-rules",
        description: "Configure tax rates and rules for different site types",
      },
      {
        name: "Upsells",
        href: "/dashboard/settings/upsells",
        description: "Create and manage additional products and services",
      },
      {
        name: "Memberships",
        href: "/dashboard/settings/memberships",
        description: "Set up membership tiers and benefits",
      },
      {
        name: "Blackout Dates",
        href: "/dashboard/settings/blackout-dates",
        description: "Block dates for maintenance or special events",
      },
      {
        name: "Promotions",
        href: "/dashboard/settings/promotions",
        description: "Create promotional campaigns and discount codes",
      },
    ],
  },
  {
    title: "Communications",
    description: "Configure email templates and notification settings",
    icon: Mail,
    color: "blue",
    links: [
      {
        name: "Email Templates",
        href: "/dashboard/settings/templates",
        description: "Customize email templates for confirmations, reminders, and more",
      },
      {
        name: "SMS / Text Messages",
        href: "/dashboard/settings/sms",
        description: "Configure Twilio for sending and receiving text messages",
      },
      {
        name: "Notification Triggers",
        href: "/dashboard/settings/notification-triggers",
        description: "Set up automated notifications and triggers",
      },
      {
        name: "Communications",
        href: "/dashboard/settings/communications",
        description: "Manage communication preferences and settings",
      },
      {
        name: "Campaigns",
        href: "/dashboard/settings/campaigns",
        description: "Create and manage marketing campaigns",
      },
    ],
  },
  {
    title: "Access & Security",
    description: "Manage users, permissions, and security settings",
    icon: Lock,
    color: "red",
    links: [
      {
        name: "Users & Roles",
        href: "/dashboard/settings/users",
        description: "Manage staff users and their roles",
      },
      {
        name: "Permissions",
        href: "/dashboard/settings/permissions",
        description: "Configure role-based access control",
      },
      {
        name: "Access Control",
        href: "/dashboard/settings/access-control",
        description: "Set up advanced access controls and restrictions",
      },
      {
        name: "Security",
        href: "/dashboard/settings/security",
        description: "Configure security policies and authentication",
      },
      {
        name: "Privacy",
        href: "/dashboard/settings/privacy",
        description: "Manage privacy settings and data protection",
      },
      {
        name: "Developers",
        href: "/dashboard/settings/developers",
        description: "API keys and developer tools",
      },
      {
        name: "Webhooks",
        href: "/dashboard/settings/webhooks",
        description: "Configure webhook endpoints for integrations",
      },
    ],
  },
  {
    title: "Property",
    description: "Configure campground details, branding, and localization",
    icon: Settings,
    color: "violet",
    links: [
      {
        name: "Booking Rules",
        href: "/dashboard/settings/policies",
        description: "Deposit requirements and cancellation policies",
      },
      {
        name: "Branding",
        href: "/dashboard/settings/branding",
        description: "Customize your brand colors, logo, and style",
      },
      {
        name: "Photos",
        href: "/dashboard/settings/photos",
        description: "Manage property photos and gallery",
      },
      {
        name: "FAQs",
        href: "/dashboard/settings/faqs",
        description: "Manage frequently asked questions for guests",
      },
      {
        name: "Localization",
        href: "/dashboard/settings/localization",
        description: "Set timezone, language, and regional preferences",
      },
      {
        name: "Store Hours",
        href: "/dashboard/settings/store-hours",
        description: "Configure operating hours and schedules",
      },
      {
        name: "Integrations",
        href: "/dashboard/settings/integrations",
        description: "Connect third-party services and tools",
      },
      {
        name: "POS Integrations",
        href: "/dashboard/settings/pos-integrations",
        description: "Connect to Lightspeed, Shopify POS, Vend, and other point-of-sale systems",
      },
      {
        name: "Analytics",
        href: "/dashboard/settings/analytics",
        description: "Configure analytics and tracking",
      },
      {
        name: "Payments",
        href: "/dashboard/settings/payments",
        description: "Set up payment processors and methods",
      },
      {
        name: "OTA Channels",
        href: "/dashboard/settings/ota",
        description: "Manage online travel agency integrations",
      },
      {
        name: "Gamification",
        href: "/dashboard/settings/gamification",
        description: "Configure badges, rewards, and engagement features",
      },
      {
        name: "Jobs",
        href: "/dashboard/settings/jobs",
        description: "Manage background jobs and scheduled tasks",
      },
      {
        name: "Data Import",
        href: "/dashboard/settings/import",
        description: "Import sites and guests from CSV or other systems",
      },
      {
        name: "ADA Accessibility",
        href: "/dashboard/settings/accessibility",
        description: "Certify your campground's accessibility features and earn ADA badges",
      },
    ],
  },
];

const iconColorMap: Record<string, string> = {
  emerald: "bg-status-success/15 text-status-success",
  blue: "bg-status-info/15 text-status-info",
  red: "bg-status-error/15 text-status-error",
  violet: "bg-violet-100 text-violet-700",
};

const accentColorOptions: { value: AccentColor; label: string; color: string }[] = [
  { value: "emerald", label: "Emerald", color: "bg-emerald-500" },
  { value: "blue", label: "Blue", color: "bg-blue-500" },
  { value: "violet", label: "Violet", color: "bg-violet-500" },
  { value: "rose", label: "Rose", color: "bg-rose-500" },
  { value: "amber", label: "Amber", color: "bg-amber-500" },
  { value: "cyan", label: "Cyan", color: "bg-cyan-500" },
  { value: "indigo", label: "Indigo", color: "bg-indigo-500" },
];

export default function SettingsLandingPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const theme = useThemePreferences();

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
  const filteredCategories = settingsCategories
    .map((category) => ({
      ...category,
      links: category.links.filter(
        (link) =>
          link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          link.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.links.length > 0 || searchQuery === "");

  return (
    <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-2">
            Manage your campground configuration, pricing, communications, and security
          </p>
        </div>

        {/* Theme Preferences Card */}
        <Card className="mb-8 border border-slate-200 bg-white">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-status-success/15 text-status-success">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Appearance</CardTitle>
                <CardDescription>Customize your theme and visual preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Accent Color */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Accent Color</Label>
              <div className="flex flex-wrap gap-2">
                {accentColorOptions.map((option) => {
                  const isSelected = theme.accentColor === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => theme.setAccentColor(option.value)}
                      title={option.label}
                      className={cn(
                        "relative h-10 w-10 rounded-full transition-all",
                        option.color,
                        isSelected
                          ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                          : "hover:scale-105"
                      )}
                    >
                      {isSelected && (
                        <Check className="absolute inset-0 m-auto h-5 w-5 text-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accessibility Options */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <Label className="text-sm font-medium">Accessibility</Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reduced Motion</p>
                  <p className="text-xs text-slate-500">
                    Minimize animations for motion sensitivity
                  </p>
                </div>
                <Switch
                  checked={theme.reducedMotion}
                  onCheckedChange={theme.toggleReducedMotion}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">High Contrast</p>
                  <p className="text-xs text-slate-500">
                    Increase contrast for better visibility
                  </p>
                </div>
                <Switch
                  checked={theme.highContrast}
                  onCheckedChange={theme.toggleHighContrast}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search settings..."
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
              Save your most-used settings to Favorites
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Click the star icon on any card to add it to your sidebar favorites for quick access.
            </p>
          </div>
        </div>

        {/* Settings Categories */}
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
                    <h2 className="text-xl font-bold text-slate-900">{category.title}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{category.description}</p>
                  </div>
                </div>

                {/* Settings Links Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {category.links.map((link) => {
                    const isFavorite = favorites.includes(link.href);
                    return (
                      <div key={link.href} className="relative group">
                        <Link href={link.href} className="block">
                          <Card className="h-full transition-all hover:shadow-md hover:border-emerald-300 cursor-pointer group-hover:bg-slate-50">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold text-slate-900">
                                  {link.name}
                                </CardTitle>
                                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
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
                              : "text-slate-300 hover:text-amber-500 hover:bg-amber-50 opacity-0 group-hover:opacity-100"
                          }`}
                          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star
                            className="h-4 w-4"
                            fill={isFavorite ? "currentColor" : "none"}
                          />
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
            <div className="text-slate-400 mb-2">
              <Search className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No settings found</h3>
            <p className="text-slate-500">
              Try adjusting your search term or browse the categories above
            </p>
          </div>
        )}
      </div>
  );
}
