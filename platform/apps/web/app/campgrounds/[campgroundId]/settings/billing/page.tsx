"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
    Receipt,
    Gauge,
    Zap,
    Droplets,
    Waves,
    Plus,
    FileText,
    Clock,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Loader2,
    Search,
    RefreshCw,
    Upload,
    Sparkles,
    CalendarClock,
    ChevronDown,
    HelpCircle,
    Table,
    FileSpreadsheet,
    Info,
    PartyPopper,
    MapPin
} from "lucide-react";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
};

type UtilityMeter = {
    id: string;
    siteId: string;
    type: string;
    serialNumber?: string;
};

type Invoice = {
    id: string;
    number: string;
    status: string;
    dueDate: string;
    totalCents: number;
    balanceCents: number;
};

type Site = {
    id: string;
    name: string;
    siteNumber: string;
    siteClassId?: string | null;
};

type SiteClass = {
    id: string;
    name: string;
    meteredEnabled?: boolean;
    meteredType?: string | null;
};

const meterTypeConfig = {
    power: { icon: Zap, label: "Power", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", unit: "kWh" },
    water: { icon: Droplets, label: "Water", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30", unit: "gal" },
    sewer: { icon: Waves, label: "Sewer", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/50", unit: "gal" },
};

// Celebration confetti effect
const SuccessCelebration = ({ show }: { show: boolean }) => {
    if (!show) return null;
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
        >
            <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="bg-emerald-500 text-white rounded-full p-6 shadow-2xl"
            >
                <PartyPopper className="h-12 w-12" />
            </motion.div>
        </motion.div>
    );
};

export default function BillingSettingsPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;

    // Celebration state
    const [showCelebration, setShowCelebration] = useState(false);

    // Meter state
    const [meterMessage, setMeterMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [meterForm, setMeterForm] = useState({ siteId: "", type: "power", serialNumber: "" });
    const [creatingMeter, setCreatingMeter] = useState(false);

    // Meter reading state
    const [readForm, setReadForm] = useState({ meterId: "", readingValue: "", readAt: "", note: "" });
    const [readMessage, setReadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [savingRead, setSavingRead] = useState(false);

    // Bulk import state - now table-based
    const [bulkRows, setBulkRows] = useState<Array<{ meterId: string; readingValue: string; readAt: string }>>([
        { meterId: "", readingValue: "", readAt: "" }
    ]);
    const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [importingBulk, setImportingBulk] = useState(false);
    const [showBulkImport, setShowBulkImport] = useState(false);

    // Invoice state
    const [invoiceSearch, setInvoiceSearch] = useState("");
    const [reservationId, setReservationId] = useState("");
    const [lateFeeMessage, setLateFeeMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [runningLateFees, setRunningLateFees] = useState(false);

    // Queries
    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId
    });

    const metersQuery = useQuery({
        queryKey: ["utility-meters", campgroundId],
        queryFn: () => apiClient.listUtilityMeters(campgroundId),
        enabled: !!campgroundId
    });

    const sitesQuery = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
        enabled: !!campgroundId
    });

    const siteClassesQuery = useQuery({
        queryKey: ["site-classes", campgroundId],
        queryFn: () => apiClient.getSiteClasses(campgroundId),
        enabled: !!campgroundId
    });

    const invoicesQuery = useQuery({
        queryKey: ["invoices", reservationId],
        queryFn: () => apiClient.listInvoicesByReservation(reservationId),
        enabled: !!reservationId
    });

    const cg = campgroundQuery.data;
    const meters = metersQuery.data ?? [];
    const sites = (sitesQuery.data ?? []) as Site[];
    const siteClasses = (siteClassesQuery.data ?? []) as SiteClass[];

    // Get sites with metered billing enabled (through their site class)
    const meteredSites = useMemo(() => {
        const meteredClassIds = new Set(
            siteClasses
                .filter((sc: SiteClass) => sc.meteredEnabled)
                .map((sc: SiteClass) => sc.id)
        );

        return sites.filter((site: Site) =>
            site.siteClassId && meteredClassIds.has(site.siteClassId)
        );
    }, [sites, siteClasses]);

    // Sites that already have meters
    const sitesWithMeters = useMemo(() => {
        return new Set(meters.map((m: any) => m.siteId));
    }, [meters]);

    // Sites available for new meters (metered enabled but no meter yet for this type)
    const availableSitesForMeter = useMemo(() => {
        const existingMetersBySiteAndType = new Map<string, Set<string>>();
        meters.forEach((m: UtilityMeter) => {
            const key = m.siteId;
            if (!existingMetersBySiteAndType.has(key)) {
                existingMetersBySiteAndType.set(key, new Set());
            }
            existingMetersBySiteAndType.get(key)?.add(m.type);
        });

        return meteredSites.filter((site: Site) => {
            const existingTypes = existingMetersBySiteAndType.get(site.id);
            return !existingTypes || !existingTypes.has(meterForm.type);
        });
    }, [meteredSites, meters, meterForm.type]);

    const triggerCelebration = useCallback(() => {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 1500);
    }, []);

    const handleCreateMeter = async () => {
        if (!campgroundId || !meterForm.siteId) return;
        setCreatingMeter(true);
        setMeterMessage(null);
        try {
            await apiClient.createUtilityMeter(campgroundId, {
                siteId: meterForm.siteId,
                type: meterForm.type,
                serialNumber: meterForm.serialNumber || undefined
            });
            const siteName = sites.find((s: Site) => s.id === meterForm.siteId)?.siteNumber || meterForm.siteId;
            setMeterMessage({ type: "success", text: `${meterTypeConfig[meterForm.type as keyof typeof meterTypeConfig]?.label || "Meter"} meter added to ${siteName}!` });
            setMeterForm({ siteId: "", type: meterForm.type, serialNumber: "" });
            metersQuery.refetch();
            // Celebrate first meter
            if (meters.length === 0) {
                triggerCelebration();
            }
        } catch (err: any) {
            setMeterMessage({ type: "error", text: err?.message || "Failed to create meter. Please try again." });
        } finally {
            setCreatingMeter(false);
        }
    };

    const handleAddRead = async () => {
        if (!readForm.meterId || !readForm.readingValue) return;
        setSavingRead(true);
        setReadMessage(null);
        try {
            await apiClient.addUtilityMeterRead(readForm.meterId, {
                readingValue: Number(readForm.readingValue),
                readAt: readForm.readAt || new Date().toISOString(),
                ...(readForm.note && { note: readForm.note })
            });
            setReadMessage({ type: "success", text: "Reading saved! Usage will be calculated on next billing cycle." });
            setReadForm({ meterId: readForm.meterId, readingValue: "", readAt: "", note: "" });
        } catch (err: any) {
            setReadMessage({ type: "error", text: err?.message || "Failed to save reading. Please check the value and try again." });
        } finally {
            setSavingRead(false);
        }
    };

    const addBulkRow = () => {
        setBulkRows([...bulkRows, { meterId: "", readingValue: "", readAt: "" }]);
    };

    const updateBulkRow = (index: number, field: string, value: string) => {
        const newRows = [...bulkRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setBulkRows(newRows);
    };

    const removeBulkRow = (index: number) => {
        if (bulkRows.length > 1) {
            setBulkRows(bulkRows.filter((_, i) => i !== index));
        }
    };

    const handleBulkImport = async () => {
        const validRows = bulkRows.filter(r => r.meterId && r.readingValue);
        if (validRows.length === 0) {
            setImportMessage({ type: "error", text: "Please fill in at least one row with meter and reading value." });
            return;
        }

        setImportingBulk(true);
        setImportMessage(null);
        try {
            await apiClient.importUtilityMeterReads({
                campgroundId,
                reads: validRows.map(r => ({
                    meterId: r.meterId,
                    readingValue: Number(r.readingValue),
                    readAt: r.readAt || new Date().toISOString()
                }))
            });
            setImportMessage({ type: "success", text: `Imported ${validRows.length} reading${validRows.length > 1 ? 's' : ''} successfully!` });
            setBulkRows([{ meterId: "", readingValue: "", readAt: "" }]);
            if (validRows.length >= 3) {
                triggerCelebration();
            }
        } catch (err: any) {
            setImportMessage({ type: "error", text: err?.message || "Failed to import readings. Please check your data." });
        } finally {
            setImportingBulk(false);
        }
    };

    const handleRunLateFees = async () => {
        setRunningLateFees(true);
        setLateFeeMessage(null);
        try {
            await apiClient.runLateFees();
            setLateFeeMessage({ type: "success", text: "Late fee processing started. Overdue invoices will be updated shortly." });
        } catch (err: any) {
            setLateFeeMessage({ type: "error", text: err?.message || "Failed to run late fees. Please try again." });
        } finally {
            setRunningLateFees(false);
        }
    };

    const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const MessageBanner = ({ message, onDismiss }: { message: { type: string; text: string }; onDismiss: () => void }) => (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            role={message.type === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                message.type === "success" && "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
                message.type === "error" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            )}
        >
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />}
            <span className="text-sm font-medium flex-1">{message.text}</span>
            <button
                onClick={onDismiss}
                className="opacity-60 hover:opacity-100 shrink-0 p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500"
                aria-label="Dismiss message"
            >
                <XCircle className="h-4 w-4" />
            </button>
        </motion.div>
    );

    return (
        <DashboardShell>
            <TooltipProvider>
                <div className="space-y-6">
                    {/* Celebration overlay */}
                    <AnimatePresence>
                        <SuccessCelebration show={showCelebration} />
                    </AnimatePresence>

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
                                { label: "Settings", href: `/campgrounds/${campgroundId}/settings` },
                                { label: "Billing & Utilities" }
                            ]}
                        />
                        <div className="mt-4">
                            <div className="flex items-center gap-2">
                                <Receipt className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                <h1 className="text-2xl font-bold text-foreground">Billing & Utilities</h1>
                            </div>
                            <p className="text-muted-foreground mt-1">
                                Track utility usage for long-stay guests and generate accurate bills
                            </p>
                        </div>
                    </motion.div>

                    {/* Utility Meters Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                    >
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <div>
                                        <CardTitle className="text-foreground">Utility Meters</CardTitle>
                                        <CardDescription className="text-muted-foreground">
                                            Add meters to sites that have metered billing enabled in their site class
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <AnimatePresence>
                                    {meterMessage && (
                                        <MessageBanner message={meterMessage} onDismiss={() => setMeterMessage(null)} />
                                    )}
                                </AnimatePresence>

                                {/* No metered sites warning */}
                                {meteredSites.length === 0 && !sitesQuery.isLoading && !siteClassesQuery.isLoading && (
                                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                                        <div className="flex gap-3">
                                            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                                    No sites with metered billing
                                                </p>
                                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                                    To add meters, first enable metered billing on a site class. Go to{" "}
                                                    <a
                                                        href={`/campgrounds/${campgroundId}/settings/site-classes`}
                                                        className="underline hover:no-underline font-medium"
                                                    >
                                                        Site Classes
                                                    </a>{" "}
                                                    and turn on "Metered Utilities" for any class that needs usage tracking.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Create Meter Form */}
                                {meteredSites.length > 0 && (
                                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                                        <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
                                            <Plus className="h-4 w-4" />
                                            Add New Meter
                                        </h3>
                                        <div className="grid gap-4 sm:grid-cols-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="meter-site" className="text-foreground flex items-center gap-1.5">
                                                    Site <span className="text-red-500">*</span>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-xs">Only sites with metered billing enabled appear here. Enable it in Site Class settings.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </Label>
                                                <Select
                                                    value={meterForm.siteId}
                                                    onValueChange={(v) => setMeterForm({ ...meterForm, siteId: v })}
                                                >
                                                    <SelectTrigger id="meter-site" aria-describedby="meter-site-hint">
                                                        <SelectValue placeholder="Select a site..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {availableSitesForMeter.length === 0 ? (
                                                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                                                                All metered sites already have {meterTypeConfig[meterForm.type as keyof typeof meterTypeConfig]?.label.toLowerCase()} meters
                                                            </div>
                                                        ) : (
                                                            availableSitesForMeter.map((site: Site) => (
                                                                <SelectItem key={site.id} value={site.id}>
                                                                    <span className="flex items-center gap-2">
                                                                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                                        {site.siteNumber}
                                                                        {site.name !== site.siteNumber && (
                                                                            <span className="text-muted-foreground">({site.name})</span>
                                                                        )}
                                                                    </span>
                                                                </SelectItem>
                                                            ))
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <p id="meter-site-hint" className="sr-only">
                                                    Select a site that has metered billing enabled
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="meter-type" className="text-foreground">
                                                    Utility Type <span className="text-red-500">*</span>
                                                </Label>
                                                <Select value={meterForm.type} onValueChange={(v) => setMeterForm({ ...meterForm, type: v })}>
                                                    <SelectTrigger id="meter-type">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(meterTypeConfig).map(([key, config]) => {
                                                            const Icon = config.icon;
                                                            return (
                                                                <SelectItem key={key} value={key}>
                                                                    <span className="flex items-center gap-2">
                                                                        <Icon className={cn("h-4 w-4", config.color)} />
                                                                        {config.label}
                                                                    </span>
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="meter-serial" className="text-foreground">Serial Number</Label>
                                                <Input
                                                    id="meter-serial"
                                                    value={meterForm.serialNumber}
                                                    onChange={(e) => setMeterForm({ ...meterForm, serialNumber: e.target.value })}
                                                    placeholder="Optional"
                                                />
                                            </div>
                                            <div className="flex items-end">
                                                <Button
                                                    onClick={handleCreateMeter}
                                                    disabled={creatingMeter || !meterForm.siteId}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white transition-transform active:scale-95"
                                                >
                                                    {creatingMeter ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <><Plus className="mr-2 h-4 w-4" /> Add Meter</>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Meters List */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-medium text-foreground">Your Meters</h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => metersQuery.refetch()}
                                            aria-label="Refresh meters list"
                                        >
                                            <RefreshCw className={cn("h-4 w-4", metersQuery.isFetching && "animate-spin")} />
                                        </Button>
                                    </div>

                                    {metersQuery.isLoading ? (
                                        <div className="flex items-center justify-center py-8" role="status" aria-label="Loading meters">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : meters.length === 0 ? (
                                        <div className="text-center py-10 border border-dashed border-border rounded-lg bg-muted/20">
                                            <motion.div
                                                initial={{ scale: 0.9, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ type: "spring", stiffness: 200 }}
                                            >
                                                <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                                                    <Gauge className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <h4 className="font-medium text-foreground mb-1">No meters yet</h4>
                                                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                                                    {meteredSites.length > 0
                                                        ? "Add your first meter above to start tracking utility usage for long-stay guests."
                                                        : "Enable metered billing on a site class to get started."}
                                                </p>
                                                {meteredSites.length > 0 && (
                                                    <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                                                        <Sparkles className="h-3.5 w-3.5" />
                                                        {meteredSites.length} site{meteredSites.length !== 1 ? 's' : ''} ready for meters
                                                    </p>
                                                )}
                                            </motion.div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {meters.map((meter: UtilityMeter, i: number) => {
                                                const config = meterTypeConfig[meter.type as keyof typeof meterTypeConfig] || meterTypeConfig.power;
                                                const Icon = config.icon;
                                                const site = sites.find((s: Site) => s.id === meter.siteId);
                                                return (
                                                    <motion.div
                                                        key={meter.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ ...SPRING_CONFIG, delay: i * 0.03 }}
                                                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 hover:shadow-sm transition-all cursor-default"
                                                    >
                                                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", config.bg)}>
                                                            <Icon className={cn("h-4 w-4", config.color)} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium text-foreground truncate">
                                                                {site?.siteNumber || meter.siteId}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {config.label} {meter.serialNumber && `· ${meter.serialNumber}`}
                                                            </p>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Record Readings Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: 0.1 }}
                    >
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <CalendarClock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <div>
                                        <CardTitle className="text-foreground">Record Readings</CardTitle>
                                        <CardDescription className="text-muted-foreground">
                                            Enter meter readings to calculate usage and generate bills
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <AnimatePresence>
                                    {readMessage && (
                                        <MessageBanner message={readMessage} onDismiss={() => setReadMessage(null)} />
                                    )}
                                </AnimatePresence>

                                {meters.length === 0 ? (
                                    <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                                        <CalendarClock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">Add a meter first to start recording readings</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Single Reading */}
                                        <div className="space-y-4">
                                            <h3 className="font-medium text-foreground">Quick Entry</h3>
                                            <div className="grid gap-4 sm:grid-cols-5">
                                                <div className="space-y-2 sm:col-span-2">
                                                    <Label htmlFor="reading-meter" className="text-foreground">Meter</Label>
                                                    <Select value={readForm.meterId} onValueChange={(v) => setReadForm({ ...readForm, meterId: v })}>
                                                        <SelectTrigger id="reading-meter">
                                                            <SelectValue placeholder="Select meter..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {meters.map((m: UtilityMeter) => {
                                                                const config = meterTypeConfig[m.type as keyof typeof meterTypeConfig] || meterTypeConfig.power;
                                                                const Icon = config.icon;
                                                                const site = sites.find((s: Site) => s.id === m.siteId);
                                                                return (
                                                                    <SelectItem key={m.id} value={m.id}>
                                                                        <span className="flex items-center gap-2">
                                                                            <Icon className={cn("h-4 w-4", config.color)} />
                                                                            {site?.siteNumber || m.siteId} - {config.label}
                                                                        </span>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="reading-value" className="text-foreground">
                                                        Reading <span className="text-red-500">*</span>
                                                    </Label>
                                                    <Input
                                                        id="reading-value"
                                                        type="number"
                                                        step="0.01"
                                                        value={readForm.readingValue}
                                                        onChange={(e) => setReadForm({ ...readForm, readingValue: e.target.value })}
                                                        placeholder="1234.56"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="reading-date" className="text-foreground">Date</Label>
                                                    <Input
                                                        id="reading-date"
                                                        type="datetime-local"
                                                        value={readForm.readAt}
                                                        onChange={(e) => setReadForm({ ...readForm, readAt: e.target.value })}
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <Button
                                                        onClick={handleAddRead}
                                                        disabled={savingRead || !readForm.meterId || !readForm.readingValue}
                                                        className="w-full transition-transform active:scale-95"
                                                    >
                                                        {savingRead ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <><CheckCircle2 className="mr-2 h-4 w-4" /> Save</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Bulk Import - Collapsible */}
                                        <Collapsible open={showBulkImport} onOpenChange={setShowBulkImport}>
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" className="w-full justify-between hover:bg-muted/50">
                                                    <span className="flex items-center gap-2">
                                                        <Table className="h-4 w-4" />
                                                        Enter multiple readings at once
                                                    </span>
                                                    <ChevronDown className={cn("h-4 w-4 transition-transform", showBulkImport && "rotate-180")} />
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="pt-4">
                                                <AnimatePresence>
                                                    {importMessage && (
                                                        <div className="mb-4">
                                                            <MessageBanner message={importMessage} onDismiss={() => setImportMessage(null)} />
                                                        </div>
                                                    )}
                                                </AnimatePresence>

                                                <div className="rounded-lg border border-border overflow-hidden">
                                                    <table className="w-full text-sm" role="table" aria-label="Bulk meter readings entry">
                                                        <thead>
                                                            <tr className="bg-muted/50 border-b border-border">
                                                                <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">Meter</th>
                                                                <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">Reading Value</th>
                                                                <th scope="col" className="text-left py-2 px-3 font-medium text-muted-foreground">Date (optional)</th>
                                                                <th scope="col" className="w-10"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {bulkRows.map((row, index) => (
                                                                <tr key={index} className="border-b border-border last:border-0">
                                                                    <td className="py-2 px-3">
                                                                        <Select
                                                                            value={row.meterId}
                                                                            onValueChange={(v) => updateBulkRow(index, "meterId", v)}
                                                                        >
                                                                            <SelectTrigger className="h-9" aria-label={`Select meter for row ${index + 1}`}>
                                                                                <SelectValue placeholder="Select..." />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {meters.map((m: UtilityMeter) => {
                                                                                    const config = meterTypeConfig[m.type as keyof typeof meterTypeConfig] || meterTypeConfig.power;
                                                                                    const Icon = config.icon;
                                                                                    const site = sites.find((s: Site) => s.id === m.siteId);
                                                                                    return (
                                                                                        <SelectItem key={m.id} value={m.id}>
                                                                                            <span className="flex items-center gap-2">
                                                                                                <Icon className={cn("h-4 w-4", config.color)} />
                                                                                                {site?.siteNumber || m.siteId}
                                                                                            </span>
                                                                                        </SelectItem>
                                                                                    );
                                                                                })}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </td>
                                                                    <td className="py-2 px-3">
                                                                        <Input
                                                                            type="number"
                                                                            step="0.01"
                                                                            className="h-9"
                                                                            value={row.readingValue}
                                                                            onChange={(e) => updateBulkRow(index, "readingValue", e.target.value)}
                                                                            placeholder="0.00"
                                                                            aria-label={`Reading value for row ${index + 1}`}
                                                                        />
                                                                    </td>
                                                                    <td className="py-2 px-3">
                                                                        <Input
                                                                            type="datetime-local"
                                                                            className="h-9"
                                                                            value={row.readAt}
                                                                            onChange={(e) => updateBulkRow(index, "readAt", e.target.value)}
                                                                            aria-label={`Date for row ${index + 1}`}
                                                                        />
                                                                    </td>
                                                                    <td className="py-2 px-1">
                                                                        {bulkRows.length > 1 && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => removeBulkRow(index)}
                                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                                                                                aria-label={`Remove row ${index + 1}`}
                                                                            >
                                                                                <XCircle className="h-4 w-4" />
                                                                            </Button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                <div className="flex items-center justify-between mt-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={addBulkRow}
                                                    >
                                                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                                                        Add Row
                                                    </Button>
                                                    <Button
                                                        onClick={handleBulkImport}
                                                        disabled={importingBulk || !bulkRows.some(r => r.meterId && r.readingValue)}
                                                        className="transition-transform active:scale-95"
                                                    >
                                                        {importingBulk ? (
                                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</>
                                                        ) : (
                                                            <><Upload className="mr-2 h-4 w-4" /> Import {bulkRows.filter(r => r.meterId && r.readingValue).length || ""} Readings</>
                                                        )}
                                                    </Button>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Invoices Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: 0.15 }}
                    >
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                        <div>
                                            <CardTitle className="text-foreground">Invoices</CardTitle>
                                            <CardDescription className="text-muted-foreground">
                                                Look up invoices by reservation and manage late fees
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={handleRunLateFees}
                                        disabled={runningLateFees}
                                        className="transition-transform active:scale-95"
                                    >
                                        {runningLateFees ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                                        ) : (
                                            <><Clock className="mr-2 h-4 w-4" /> Run Late Fees</>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <AnimatePresence>
                                    {lateFeeMessage && (
                                        <MessageBanner message={lateFeeMessage} onDismiss={() => setLateFeeMessage(null)} />
                                    )}
                                </AnimatePresence>

                                {/* Invoice Search */}
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <Label htmlFor="invoice-search" className="sr-only">Search by reservation ID</Label>
                                        <Input
                                            id="invoice-search"
                                            value={invoiceSearch}
                                            onChange={(e) => setInvoiceSearch(e.target.value)}
                                            placeholder="Enter reservation ID..."
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") setReservationId(invoiceSearch.trim());
                                            }}
                                        />
                                    </div>
                                    <Button onClick={() => setReservationId(invoiceSearch.trim())}>
                                        <Search className="mr-2 h-4 w-4" />
                                        Search
                                    </Button>
                                </div>

                                {/* Results */}
                                {invoicesQuery.isFetching && (
                                    <div className="flex items-center justify-center py-8" role="status" aria-label="Loading invoices">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                )}

                                {reservationId && !invoicesQuery.isFetching && invoicesQuery.data?.length === 0 && (
                                    <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/20">
                                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">No invoices found for this reservation</p>
                                    </div>
                                )}

                                {invoicesQuery.data && invoicesQuery.data.length > 0 && (
                                    <div className="overflow-x-auto rounded-lg border border-border">
                                        <table className="w-full text-sm" role="table" aria-label="Invoice results">
                                            <thead>
                                                <tr className="border-b border-border bg-muted/50">
                                                    <th scope="col" className="text-left py-3 px-3 font-medium text-muted-foreground">Invoice</th>
                                                    <th scope="col" className="text-left py-3 px-3 font-medium text-muted-foreground">Status</th>
                                                    <th scope="col" className="text-left py-3 px-3 font-medium text-muted-foreground">Due Date</th>
                                                    <th scope="col" className="text-right py-3 px-3 font-medium text-muted-foreground">Total</th>
                                                    <th scope="col" className="text-right py-3 px-3 font-medium text-muted-foreground">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {invoicesQuery.data.map((inv: Invoice) => (
                                                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                                                        <td className="py-3 px-3 font-medium text-foreground">{inv.number}</td>
                                                        <td className="py-3 px-3">
                                                            <Badge variant="outline" className={cn(
                                                                inv.status === "paid" && "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
                                                                inv.status === "overdue" && "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
                                                                inv.status === "pending" && "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                                                            )}>
                                                                {inv.status}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-3 px-3 text-muted-foreground">
                                                            {new Date(inv.dueDate).toLocaleDateString()}
                                                        </td>
                                                        <td className="py-3 px-3 text-right text-foreground font-medium">
                                                            {formatMoney(inv.totalCents)}
                                                        </td>
                                                        <td className="py-3 px-3 text-right">
                                                            <span className={cn(
                                                                "font-medium",
                                                                inv.balanceCents > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                                                            )}>
                                                                {formatMoney(inv.balanceCents)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </TooltipProvider>
        </DashboardShell>
    );
}
