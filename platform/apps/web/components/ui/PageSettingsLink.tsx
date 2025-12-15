"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageSettingsLinkProps {
    href: string;
    label?: string;
    className?: string;
}

/**
 * A small contextual settings icon that links to the relevant settings page.
 * Place in page headers to help users find settings quickly.
 */
export function PageSettingsLink({
    href,
    label = "Settings",
    className,
}: PageSettingsLinkProps) {
    return (
        <Link
            href={href}
            className={cn(
                "inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors",
                className
            )}
            title={label}
        >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
        </Link>
    );
}

/**
 * Common settings mappings for pages
 */
export const PAGE_SETTINGS_MAP: Record<string, { href: string; label: string }> = {
    calendar: { href: "/settings/blackout-dates", label: "Blackout Settings" },
    pos: { href: "/store", label: "Store Settings" },
    messages: { href: "/settings/templates", label: "Message Templates" },
    reservations: { href: "/settings/deposit-policies", label: "Deposit Policies" },
    guests: { href: "/settings/privacy", label: "Privacy Settings" },
    reports: { href: "/reports/saved", label: "Saved Reports" },
    waitlist: { href: "/settings/seasonal-rates", label: "Seasonal Rates" },
    maintenance: { href: "/settings/notification-triggers", label: "Notification Settings" },
    ledger: { href: "/settings/tax-rules", label: "Tax & Currency" },
    booking: { href: "/settings/pricing-rules", label: "Pricing Rules" },
};
