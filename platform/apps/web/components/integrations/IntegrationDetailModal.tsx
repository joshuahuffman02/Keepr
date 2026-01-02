"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    CheckCircle2,
    Shield,
    RefreshCw,
    ExternalLink,
    AlertTriangle,
    Loader2,
    Copy,
    type LucideIcon
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface IntegrationDetailModalProps {
    integration: IntegrationDefinition | null;
    isOpen: boolean;
    onClose: () => void;
    status?: "connected" | "error" | "pending" | "disconnected" | null;
    lastSyncedAt?: string | null;
    onConnect: () => Promise<void>;
    onDisconnect?: () => Promise<void>;
    onSync?: () => Promise<void>;
    syncLogs?: Array<{
        id: string;
        status: string;
        message: string;
        occurredAt: string;
    }>;
}

export function IntegrationDetailModal({
    integration,
    isOpen,
    onClose,
    status,
    lastSyncedAt,
    onConnect,
    onDisconnect,
    onSync,
    syncLogs = []
}: IntegrationDetailModalProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    if (!integration) return null;

    const Icon = ICON_MAP[integration.logo] || Calculator;
    const isConnected = status === "connected";
    const hasError = status === "error";

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            await onConnect();
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
            }, 3000);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSync = async () => {
        if (!onSync) return;
        setIsSyncing(true);
        try {
            await onSync();
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <div className="flex items-start gap-4">
                        <div
                            className={cn(
                                "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl",
                                isConnected
                                    ? "bg-status-success/15 text-status-success"
                                    : hasError
                                    ? "bg-status-error/15 text-status-error"
                                    : "bg-status-info/15 text-status-info"
                            )}
                        >
                            <Icon className="h-7 w-7" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                {integration.name}
                                {isConnected && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-xs font-medium text-status-success">
                                        <Check className="h-3 w-3" />
                                        Connected
                                    </span>
                                )}
                            </DialogTitle>
                            <DialogDescription className="mt-1">
                                {integration.longDescription || integration.description}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    {showSuccess ? (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="py-8 text-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-success/15"
                            >
                                <CheckCircle2 className="h-8 w-8 text-status-success" />
                            </motion.div>
                            <h3 className="text-lg font-semibold text-foreground">
                                You're all set!
                            </h3>
                            <p className="mt-1 text-muted-foreground">
                                {integration.name} is now connected. Data will sync automatically.
                            </p>
                        </motion.div>
                    ) : isConnected ? (
                        <motion.div
                            key="connected"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Tabs defaultValue="overview" className="mt-4">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="activity">Activity</TabsTrigger>
                                    <TabsTrigger value="settings">Settings</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview" className="mt-4 space-y-4">
                                    {/* Sync status */}
                                    <div className="rounded-lg border bg-muted/50 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-medium text-foreground">Sync Status</h4>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {hasError
                                                        ? "There was an issue with the last sync"
                                                        : lastSyncedAt
                                                        ? `Last synced ${formatRelativeTime(lastSyncedAt)}`
                                                        : "Sync not started yet"}
                                                </p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleSync}
                                                disabled={isSyncing}
                                            >
                                                {isSyncing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="h-4 w-4" />
                                                )}
                                                <span className="ml-2">Sync Now</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* What's syncing */}
                                    <div className="rounded-lg border p-4">
                                        <h4 className="font-medium text-foreground mb-3">What's Syncing</h4>
                                        <ul className="space-y-2">
                                            {integration.features.map((feature) => (
                                                <li
                                                    key={feature}
                                                    className="flex items-center gap-2 text-sm"
                                                >
                                                    <Check className="h-4 w-4 text-status-success" />
                                                    <span className="text-foreground">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Security note */}
                                    <div className="flex items-start gap-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4">
                                        <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-blue-900 dark:text-blue-100">
                                                Secure Connection
                                            </h4>
                                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                                Your credentials are encrypted and stored securely.
                                                We never store your password.
                                            </p>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="activity" className="mt-4 space-y-2">
                                    {syncLogs.length > 0 ? (
                                        syncLogs.map((log) => (
                                            <div
                                                key={log.id}
                                                className="flex items-start gap-3 rounded-lg border p-3"
                                            >
                                                <div
                                                    className={cn(
                                                        "mt-0.5 h-2 w-2 rounded-full shrink-0",
                                                        log.status === "success"
                                                            ? "bg-status-success"
                                                            : log.status === "error"
                                                            ? "bg-status-error"
                                                            : "bg-status-warning"
                                                    )}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-foreground">
                                                        {log.message || "Sync completed"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {formatRelativeTime(log.occurredAt)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No sync activity yet</p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="settings" className="mt-4 space-y-4">
                                    {/* Disconnect section */}
                                    <div className="rounded-lg border border-red-200 dark:border-red-800 p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-medium text-foreground">
                                                    Disconnect Integration
                                                </h4>
                                                <p className="text-sm text-muted-foreground mt-1 mb-3">
                                                    This will stop syncing data to {integration.name}.
                                                    Your existing data in {integration.name} will not be affected.
                                                </p>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={onDisconnect}
                                                >
                                                    Disconnect {integration.name}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Help link */}
                                    <div className="text-center">
                                        <a
                                            href="#"
                                            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                            View integration documentation
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="connect"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="mt-4 space-y-4"
                        >
                            {/* Features */}
                            <div className="rounded-lg border p-4">
                                <h4 className="font-medium text-foreground mb-3">What you'll get</h4>
                                <ul className="space-y-2">
                                    {integration.features.map((feature) => (
                                        <li
                                            key={feature}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <Check className="h-4 w-4 text-status-success" />
                                            <span className="text-foreground">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Security note */}
                            <div className="flex items-start gap-3 rounded-lg bg-muted dark:bg-muted/50 p-4">
                                <Shield className="h-5 w-5 text-muted-foreground dark:text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-foreground">
                                        Secure & Private
                                    </h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        We use OAuth to connect securely. Your login credentials
                                        are never shared with us.
                                    </p>
                                </div>
                            </div>

                            {/* Connect button */}
                            <Button
                                className="w-full"
                                size="lg"
                                onClick={handleConnect}
                                disabled={isConnecting}
                            >
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        Connect {integration.name}
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
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
