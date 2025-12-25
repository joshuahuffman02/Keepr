"use client";

import { motion } from "framer-motion";
import {
    Calculator,
    FileSpreadsheet,
    Receipt,
    Users,
    MessageSquare,
    MessagesSquare,
    KeyRound,
    DoorOpen,
    FolderSync,
    Webhook,
    Settings,
    Check,
    Sparkles,
    ArrowRight,
    type LucideIcon
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { IntegrationDefinition } from "@/lib/integrations-directory";

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
    Calculator,
    FileSpreadsheet,
    Receipt,
    Users,
    MessageSquare,
    MessagesSquare,
    KeyRound,
    DoorOpen,
    FolderSync,
    Webhook,
    Settings
};

interface IntegrationCardProps {
    integration: IntegrationDefinition;
    status?: "connected" | "error" | "pending" | "disconnected" | null;
    lastSyncedAt?: string | null;
    onConnect: () => void;
    onManage?: () => void;
}

export function IntegrationCard({
    integration,
    status,
    lastSyncedAt,
    onConnect,
    onManage
}: IntegrationCardProps) {
    const Icon = ICON_MAP[integration.logo] || Calculator;
    const isConnected = status === "connected";
    const hasError = status === "error";
    const isPending = status === "pending";
    const isComingSoon = integration.comingSoon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
        >
            <Card
                className={cn(
                    "group relative h-full transition-all duration-200",
                    "border-border bg-card hover:shadow-lg",
                    "hover:border-slate-300 dark:hover:border-slate-600",
                    isConnected && "ring-2 ring-emerald-500/20 border-emerald-200 dark:border-emerald-800",
                    hasError && "ring-2 ring-red-500/20 border-red-200 dark:border-red-800",
                    isComingSoon && "opacity-75"
                )}
            >
                {/* Popular badge */}
                {integration.popular && !isConnected && (
                    <div className="absolute -top-2 -right-2 z-10">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                            <Sparkles className="h-3 w-3" />
                            Popular
                        </span>
                    </div>
                )}

                {/* Coming soon badge */}
                {isComingSoon && (
                    <div className="absolute -top-2 -right-2 z-10">
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                            Coming Soon
                        </span>
                    </div>
                )}

                <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                            className={cn(
                                "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors",
                                isConnected
                                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                    : hasError
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                            )}
                        >
                            <Icon className="h-6 w-6" />
                        </div>

                        {/* Title and status */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground truncate">
                                    {integration.name}
                                </h3>
                                {isConnected && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                        <Check className="h-3 w-3" />
                                        Connected
                                    </span>
                                )}
                                {hasError && (
                                    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                                        Error
                                    </span>
                                )}
                                {isPending && (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                        Pending
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {integration.description}
                            </p>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                    {/* Features list */}
                    <ul className="space-y-1.5">
                        {integration.features.slice(0, 3).map((feature) => (
                            <li
                                key={feature}
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>

                    {/* Last synced (if connected) */}
                    {isConnected && lastSyncedAt && (
                        <p className="text-xs text-muted-foreground">
                            Last synced: {formatRelativeTime(lastSyncedAt)}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="pt-2">
                        {isComingSoon ? (
                            <Button disabled className="w-full" variant="outline">
                                Coming Soon
                            </Button>
                        ) : isConnected ? (
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={onManage}
                                >
                                    Manage
                                </Button>
                                {hasError && (
                                    <Button
                                        variant="destructive"
                                        onClick={onConnect}
                                    >
                                        Reconnect
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <Button
                                className={cn(
                                    "w-full group/btn transition-all",
                                    "bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200",
                                    "dark:text-slate-900"
                                )}
                                onClick={onConnect}
                            >
                                <span>Connect {integration.name}</span>
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}
