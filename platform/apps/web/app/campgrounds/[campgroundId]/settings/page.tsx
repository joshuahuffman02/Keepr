"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DepositSettings } from "@/components/campgrounds/DepositSettings";
import { CampgroundProfileForm } from "@/components/campgrounds/CampgroundProfileForm";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Settings,
    Receipt,
    Megaphone,
    Database,
    Tablet,
    ChevronRight,
    Loader2
} from "lucide-react";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
};

const settingsLinks = [
    {
        href: (id: string) => `/campgrounds/${id}/settings/billing`,
        icon: Receipt,
        label: "Billing & Utilities",
        description: "Utility meters, meter readings, invoices, and late fees",
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-900/30"
    },
    {
        href: (id: string) => `/campgrounds/${id}/marketing/referrals`,
        icon: Megaphone,
        label: "Marketing & Referrals",
        description: "Referral programs, performance tracking, and guest insights",
        color: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-100 dark:bg-purple-900/30"
    },
    {
        href: (id: string) => `/campgrounds/${id}/admin/data`,
        icon: Database,
        label: "Data Operations",
        description: "Import/export reservations and PMS integrations",
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-900/30"
    },
    {
        href: (id: string) => `/campgrounds/${id}/admin/kiosk`,
        icon: Tablet,
        label: "Kiosk Devices",
        description: "Self-service check-in kiosks for 24/7 guest arrivals",
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-900/30"
    }
];

export default function CampgroundSettingsPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;

    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId
    });

    const cg = campgroundQuery.data;

    if (campgroundQuery.isLoading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            </DashboardShell>
        );
    }

    if (!cg) {
        return (
            <DashboardShell>
                <div className="p-6 text-red-600 dark:text-red-400">Campground not found</div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING_CONFIG}
                >
                    <Breadcrumbs
                        items={[
                            { label: "Campgrounds", href: "/campgrounds?all=true" },
                            { label: cg.name, href: `/campgrounds/${campgroundId}` },
                            { label: "Settings" }
                        ]}
                    />
                    <div className="mt-4 flex items-center gap-2">
                        <Settings className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                    </div>
                    <p className="text-muted-foreground mt-1">
                        Manage your campground profile, deposits, and configuration
                    </p>
                </motion.div>

                {/* Quick Links to Other Settings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {settingsLinks.map((link, i) => {
                            const Icon = link.icon;
                            return (
                                <motion.div
                                    key={link.label}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ ...SPRING_CONFIG, delay: 0.05 + i * 0.03 }}
                                >
                                    <Link href={link.href(campgroundId)}>
                                        <Card className="border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer group h-full">
                                            <CardContent className="pt-4 pb-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shrink-0", link.bg)}>
                                                        <Icon className={cn("h-5 w-5", link.color)} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1">
                                                            <span className="font-medium text-foreground">{link.label}</span>
                                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                            {link.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Profile Form */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.1 }}
                >
                    <CampgroundProfileForm campground={cg} />
                </motion.div>

                {/* Deposit Settings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.15 }}
                >
                    <DepositSettings campground={cg} />
                </motion.div>
            </div>
        </DashboardShell>
    );
}
