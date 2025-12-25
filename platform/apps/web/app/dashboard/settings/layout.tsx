"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Settings } from "lucide-react";
import { ReactNode, useMemo } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";

// Map of route segments to human-readable names
const routeLabels: Record<string, string> = {
  "pricing-rules": "Dynamic Pricing",
  "seasonal-rates": "Seasonal Rates",
  "deposit-policies": "Deposit Policies",
  "tax-rules": "Tax Rules",
  "upsells": "Upsells",
  "memberships": "Memberships",
  "blackout-dates": "Blackout Dates",
  "promotions": "Promotions",
  "templates": "Email Templates",
  "notification-triggers": "Notification Triggers",
  "communications": "Communications",
  "campaigns": "Campaigns",
  "users": "Users & Roles",
  "permissions": "Permissions",
  "access-control": "Access Control",
  "security": "Security",
  "privacy": "Privacy",
  "developers": "Developers",
  "webhooks": "Webhooks",
  "policies": "Campground Config",
  "branding": "Branding",
  "photos": "Photos",
  "localization": "Localization",
  "store-hours": "Store Hours",
  "integrations": "Integrations",
  "analytics": "Analytics",
  "payments": "Payments",
  "ota": "OTA Channels",
  "gamification": "Gamification",
  "jobs": "Jobs",
  "developer": "Developer",
  "accessibility": "ADA Accessibility",
  "faqs": "FAQs",
  "import": "Data Import",
  "billing": "Subscription",
  "pos-integrations": "POS Integrations",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    if (!pathname) return [];

    // Remove /dashboard/settings prefix and split remaining path
    const settingsPath = pathname.replace("/dashboard/settings", "");
    if (!settingsPath || settingsPath === "/") {
      return []; // On the main settings page, no breadcrumbs needed
    }

    const segments = settingsPath.split("/").filter(Boolean);
    const crumbs: { label: string; href: string }[] = [];

    segments.forEach((segment, index) => {
      const label = routeLabels[segment] || segment.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const href = "/dashboard/settings/" + segments.slice(0, index + 1).join("/");
      crumbs.push({ label, href });
    });

    return crumbs;
  }, [pathname]);

  // Don't show breadcrumbs on the main settings page
  const showBreadcrumbs = breadcrumbs.length > 0;

  return (
    <DashboardShell>
      {showBreadcrumbs && (
        <div className="mb-6 flex items-center gap-2 text-sm">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-slate-300" />
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-slate-900 dark:text-slate-100">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-slate-500 hover:text-emerald-600 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
