"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Tablet,
    Key,
    CheckCircle2,
    XCircle,
    Wifi,
    WifiOff,
    Trash2,
    RotateCcw,
    Copy,
    Loader2,
    Sparkles,
    Clock,
    ShieldCheck,
    CreditCard,
    UserCheck,
    Users,
    AlertCircle,
    PartyPopper
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
};

type KioskDevice = {
    id: string;
    name: string;
    status: "active" | "revoked" | "pending";
    lastSeenAt?: string;
    allowCheckIn?: boolean;
    allowWalkIns?: boolean;
    allowPayments?: boolean;
};

export default function KioskDevicesPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;
    const queryClient = useQueryClient();

    const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
    const [showCelebration, setShowCelebration] = useState(false);
    const [copiedCode, setCopiedCode] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

    // Fetch campground for breadcrumb
    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId
    });

    // Kiosk devices query
    const devicesQuery = useQuery({
        queryKey: ["kiosk-devices", campgroundId],
        queryFn: () => apiClient.kioskListDevices(campgroundId),
        enabled: !!campgroundId
    });

    // Generate pairing code mutation
    const generateCodeMutation = useMutation({
        mutationFn: () => apiClient.kioskGeneratePairingCode(campgroundId),
        onSuccess: (data) => {
            setPairingCode(data);
            setMessage({ type: "info", text: "Enter this code on your kiosk device" });
        },
        onError: (err: any) => {
            setMessage({ type: "error", text: err?.message || "Failed to generate pairing code" });
        }
    });

    // Revoke device mutation
    const revokeMutation = useMutation({
        mutationFn: (deviceId: string) => apiClient.kioskRevokeDevice(campgroundId, deviceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kiosk-devices", campgroundId] });
            setMessage({ type: "success", text: "Device paused successfully. Guests cannot check in until re-enabled." });
        },
        onError: (err: any) => {
            setMessage({ type: "error", text: err?.message || "Failed to revoke device" });
        }
    });

    // Enable device mutation
    const enableMutation = useMutation({
        mutationFn: (deviceId: string) => apiClient.kioskEnableDevice(campgroundId, deviceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kiosk-devices", campgroundId] });
            setMessage({ type: "success", text: "Device is back online and ready for guests!" });
        },
        onError: (err: any) => {
            setMessage({ type: "error", text: err?.message || "Failed to enable device" });
        }
    });

    // Delete device mutation
    const deleteMutation = useMutation({
        mutationFn: (deviceId: string) => apiClient.kioskDeleteDevice(campgroundId, deviceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["kiosk-devices", campgroundId] });
            setMessage({ type: "success", text: "Device removed permanently" });
        },
        onError: (err: any) => {
            setMessage({ type: "error", text: err?.message || "Failed to delete device" });
        }
    });

    const copyPairingCode = () => {
        if (pairingCode) {
            navigator.clipboard.writeText(pairingCode.code);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        }
    };

    const getTimeRemaining = (expiresAt: string) => {
        const diff = new Date(expiresAt).getTime() - Date.now();
        if (diff <= 0) return "Expired";
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
    };

    const getLastSeenStatus = (lastSeenAt: string | null | undefined) => {
        if (!lastSeenAt) return { label: "Never connected", color: "text-muted-foreground", icon: WifiOff };
        const diff = Date.now() - new Date(lastSeenAt).getTime();
        const hours = diff / (1000 * 60 * 60);
        if (hours < 1) return { label: "Online", color: "text-emerald-600 dark:text-emerald-400", icon: Wifi };
        if (hours < 24) return { label: `${Math.floor(hours)}h ago`, color: "text-amber-600 dark:text-amber-400", icon: Wifi };
        return { label: "Offline", color: "text-red-600 dark:text-red-400", icon: WifiOff };
    };

    const devices = devicesQuery.data ?? [];
    const cg = campgroundQuery.data;
    const kioskUrl = typeof window !== "undefined" ? `${window.location.origin}/kiosk` : "";

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
                            { label: cg?.name || "...", href: `/campgrounds/${campgroundId}` },
                            { label: "Kiosk Devices" }
                        ]}
                    />
                    <div className="mt-4 flex items-start justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Tablet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                <h1 className="text-2xl font-bold text-foreground">Kiosk Devices</h1>
                            </div>
                            <p className="text-muted-foreground">
                                Set up self-service check-in kiosks for 24/7 guest arrivals
                            </p>
                        </div>
                        {devices.length > 0 && (
                            <Badge variant="secondary" className="bg-status-success/15 text-status-success">
                                {devices.filter(d => d.status === "active").length} active
                            </Badge>
                        )}
                    </div>
                </motion.div>

                {/* Status Message */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={cn(
                                "flex items-center gap-3 rounded-lg border px-4 py-3",
                                message.type === "success" && "bg-status-success/15 text-status-success",
                                message.type === "error" && "bg-status-error/15 text-status-error",
                                message.type === "info" && "bg-status-info/15 text-status-info"
                            )}
                        >
                            {message.type === "success" && <Sparkles className="h-5 w-5" />}
                            {message.type === "error" && <AlertCircle className="h-5 w-5" />}
                            {message.type === "info" && <Key className="h-5 w-5" />}
                            <span className="text-sm font-medium">{message.text}</span>
                            <button
                                onClick={() => setMessage(null)}
                                className="ml-auto text-current opacity-60 hover:opacity-100"
                            >
                                <XCircle className="h-4 w-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pair New Device Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                >
                    <Card className="border-border bg-card overflow-hidden">
                        <div className="bg-status-success/10">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <CardTitle className="text-foreground">Pair New Device</CardTitle>
                                </div>
                                <CardDescription className="text-muted-foreground">
                                    Generate a 6-digit code to securely connect an iPad or tablet
                                </CardDescription>
                            </CardHeader>
                        </div>
                        <CardContent className="pt-6">
                            {!pairingCode ? (
                                <div className="flex flex-col items-center gap-4 py-6">
                                    <div className="rounded-full bg-muted p-4">
                                        <Tablet className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <p className="text-sm text-muted-foreground text-center max-w-md">
                                        Kiosks let guests check themselves in without waiting for staff.
                                        Perfect for after-hours arrivals and busy check-in times.
                                    </p>
                                    <Button
                                        onClick={() => generateCodeMutation.mutate()}
                                        disabled={generateCodeMutation.isPending}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        {generateCodeMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Key className="mr-2 h-4 w-4" />
                                                Generate Pairing Code
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center gap-4 py-6"
                                >
                                    <p className="text-sm text-muted-foreground">Enter this code on the kiosk:</p>
                                    <div className="relative">
                                        <div className="text-5xl font-mono font-bold tracking-[0.3em] text-foreground bg-muted/50 px-8 py-4 rounded-xl border border-border">
                                            {pairingCode.code}
                                        </div>
                                        <button
                                            onClick={copyPairingCode}
                                            className="absolute -right-2 -top-2 rounded-full bg-background border border-border p-2 shadow-sm hover:bg-muted transition-colors"
                                        >
                                            {copiedCode ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-muted-foreground" />
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>Expires in {getTimeRemaining(pairingCode.expiresAt)}</span>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPairingCode(null)}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Generate New Code
                                    </Button>
                                </motion.div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Paired Devices */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.1 }}
                >
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <CardTitle className="text-foreground">Paired Devices</CardTitle>
                                </div>
                                {devicesQuery.isFetching && (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                            <CardDescription className="text-muted-foreground">
                                Manage your connected kiosk devices
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {devicesQuery.isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : devices.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="rounded-full bg-muted p-4 mb-4">
                                        <Tablet className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-medium text-foreground mb-1">No devices paired yet</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        Generate a pairing code above to connect your first kiosk.
                                        Guests will be able to check in themselves 24/7.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {devices.map((device, index) => {
                                        const lastSeen = getLastSeenStatus(device.lastSeenAt);
                                        const LastSeenIcon = lastSeen.icon;

                                        return (
                                            <motion.div
                                                key={device.id}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ ...SPRING_CONFIG, delay: index * 0.05 }}
                                                className={cn(
                                                    "flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors",
                                                    device.status === "active"
                                                        ? "border-border bg-background hover:bg-muted/50"
                                                        : "border-border bg-muted/30"
                                                )}
                                            >
                                                <div className="flex items-center gap-4 min-w-0">
                                                    <div className={cn(
                                                        "flex h-10 w-10 items-center justify-center rounded-lg",
                                                        device.status === "active"
                                                            ? "bg-status-success/15"
                                                            : "bg-muted"
                                                    )}>
                                                        <Tablet className={cn(
                                                            "h-5 w-5",
                                                            device.status === "active"
                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                : "text-muted-foreground"
                                                        )} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-foreground truncate">
                                                                {device.name}
                                                            </span>
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    device.status === "active"
                                                                        ? "bg-status-success/15 text-status-success"
                                                                        : "bg-status-error/15 text-status-error"
                                                                )}
                                                            >
                                                                {device.status === "active" ? (
                                                                    <><CheckCircle2 className="mr-1 h-3 w-3" /> Active</>
                                                                ) : (
                                                                    <><XCircle className="mr-1 h-3 w-3" /> Paused</>
                                                                )}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className={cn("flex items-center gap-1 text-xs", lastSeen.color)}>
                                                                <LastSeenIcon className="h-3 w-3" />
                                                                {lastSeen.label}
                                                            </span>
                                                            <div className="flex gap-1.5">
                                                                {device.allowCheckIn && (
                                                                    <span className="flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                        <UserCheck className="h-3 w-3" /> Check-in
                                                                    </span>
                                                                )}
                                                                {device.allowWalkIns && (
                                                                    <span className="flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                        <Users className="h-3 w-3" /> Walk-ins
                                                                    </span>
                                                                )}
                                                                {device.allowPayments && (
                                                                    <span className="flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                                                        <CreditCard className="h-3 w-3" /> Payments
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {device.status === "active" ? (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => revokeMutation.mutate(device.id)}
                                                            disabled={revokeMutation.isPending}
                                                        >
                                                            Pause
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => enableMutation.mutate(device.id)}
                                                            disabled={enableMutation.isPending}
                                                            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-900/20"
                                                        >
                                                            Re-enable
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setDeleteConfirm({ id: device.id, name: device.name })}
                                                        disabled={deleteMutation.isPending}
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Setup Instructions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.15 }}
                >
                    <Card className="border-border bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-foreground text-base">Setup Instructions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                <li>
                                    On your iPad or tablet, open the browser and go to{" "}
                                    <code className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground text-xs">
                                        {kioskUrl}
                                    </code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(kioskUrl);
                                            setMessage({ type: "success", text: "URL copied to clipboard" });
                                            setTimeout(() => setMessage(null), 2000);
                                        }}
                                        className="ml-2 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                    >
                                        <Copy className="h-3 w-3 inline" />
                                    </button>
                                </li>
                                <li>Generate a pairing code using the button above</li>
                                <li>Enter the 6-digit code on the kiosk screen</li>
                                <li>The device will connect automatically to this campground</li>
                                <li>Enable Guided Access (iOS) or kiosk mode for production use</li>
                            </ol>
                            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                                Typical setup time: 2-3 minutes per device
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Device</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove "{deleteConfirm?.name}" permanently? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteConfirm) {
                                    deleteMutation.mutate(deleteConfirm.id);
                                    setDeleteConfirm(null);
                                }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardShell>
    );
}
