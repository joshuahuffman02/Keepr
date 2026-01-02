"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

interface SiteMapPickerProps {
    campgroundId: string;
    arrivalDate?: string;
    departureDate?: string;
    selectedSiteId?: string;
    onSiteSelect: (siteId: string) => void;
    showLegend?: boolean;
    compact?: boolean;
}

type SiteStatus = "available" | "occupied" | "maintenance";

const statusColors: Record<SiteStatus, { bg: string; border: string; text: string; hoverBg: string }> = {
    available: {
        bg: "bg-status-success/10",
        border: "border-status-success/30",
        text: "text-status-success",
        hoverBg: "hover:bg-status-success/15"
    },
    occupied: {
        bg: "bg-status-info/10",
        border: "border-status-info/30",
        text: "text-status-info",
        hoverBg: "hover:bg-status-info/15"
    },
    maintenance: {
        bg: "bg-status-warning/10",
        border: "border-status-warning/30",
        text: "text-status-warning",
        hoverBg: "hover:bg-status-warning/15"
    }
};

const siteTypeIcons: Record<string, string> = {
    rv: "truck",
    tent: "tent",
    cabin: "home",
    group: "users",
    glamping: "sparkles"
};

export function SiteMapPicker({
    campgroundId,
    arrivalDate,
    departureDate,
    selectedSiteId,
    onSiteSelect,
    showLegend = true,
    compact = false
}: SiteMapPickerProps) {
    const sitesQuery = useQuery({
        queryKey: ["sites-status", campgroundId, arrivalDate, departureDate],
        queryFn: () =>
            apiClient.getSitesWithStatus(campgroundId, {
                arrivalDate,
                departureDate
            }),
        enabled: !!campgroundId,
        refetchInterval: 30000 // Refresh every 30s for live updates
    });

    if (sitesQuery.isLoading) {
        return (
            <div className="rounded-lg border border-border bg-muted p-6 text-center">
                <div className="text-sm text-muted-foreground">Loading site map…</div>
            </div>
        );
    }

    if (sitesQuery.error) {
        return (
            <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-4 text-sm text-status-error">
                Failed to load site map. Please try again.
            </div>
        );
    }

    const sites = sitesQuery.data || [];

    // Group sites by site class for organization
    const sitesByClass = sites.reduce((acc, site) => {
        const className = site.siteClassName || "Uncategorized";
        if (!acc[className]) acc[className] = [];
        acc[className].push(site);
        return acc;
    }, {} as Record<string, typeof sites>);

    const statusCounts = {
        available: sites.filter((s) => s.status === "available").length,
        occupied: sites.filter((s) => s.status === "occupied").length,
        maintenance: sites.filter((s) => s.status === "maintenance").length
    };

    return (
        <div className="space-y-4">
            {showLegend && (
                <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded border border-status-success/30 bg-status-success/10" />
                        <span className="text-muted-foreground">Available ({statusCounts.available})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded border border-status-info/30 bg-status-info/10" />
                        <span className="text-muted-foreground">Occupied ({statusCounts.occupied})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded border border-status-warning/30 bg-status-warning/10" />
                        <span className="text-muted-foreground">Maintenance ({statusCounts.maintenance})</span>
                    </div>
                </div>
            )}

            {Object.entries(sitesByClass).map(([className, classSites]) => (
                <div key={className} className="space-y-2">
                    {Object.keys(sitesByClass).length > 1 && (
                        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{className}</div>
                    )}
                    <div
                        className={`grid gap-2 ${compact
                                ? "grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"
                                : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                            }`}
                    >
                        {classSites.map((site) => {
                            const colors = statusColors[site.status];
                            const isSelected = site.id === selectedSiteId;
                            const isClickable = site.status === "available";
                            const icon = siteTypeIcons[site.siteType] || "pin";

                            return (
                                <button
                                    key={site.id}
                                    type="button"
                                    onClick={() => isClickable && onSiteSelect(site.id)}
                                    disabled={!isClickable}
                                    title={
                                        site.status === "available"
                                            ? `${site.name} - Click to select`
                                            : site.status === "occupied"
                                                ? `${site.name} - ${site.statusDetail || "Occupied"}`
                                                : `${site.name} - ${site.statusDetail || "Maintenance"}`
                                    }
                                    className={`
                    relative rounded-lg border-2 transition-all duration-150
                    ${colors.bg} ${colors.border} ${colors.text}
                    ${isClickable ? `cursor-pointer ${colors.hoverBg}` : "cursor-not-allowed opacity-75"}
                    ${isSelected ? "ring-2 ring-action-primary ring-offset-2" : ""}
                    ${compact ? "p-2" : "p-3"}
                  `}
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        {!compact && <span className="text-lg">{icon}</span>}
                                        <span className={`font-semibold ${compact ? "text-xs" : "text-sm"}`}>{site.siteNumber}</span>
                                        {!compact && (
                                            <span className="text-xs opacity-75">
                                                {site.status === "available"
                                                    ? "Open"
                                                    : site.status === "occupied"
                                                        ? "Booked"
                                                        : "Maint."}
                                            </span>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-action-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {sites.length === 0 && (
                <div className="rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
                    No sites found for this campground.
                </div>
            )}
        </div>
    );
}

export default SiteMapPicker;
