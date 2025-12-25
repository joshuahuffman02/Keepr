"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
    DollarSign
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

const meterTypeConfig = {
    power: { icon: Zap, label: "Power", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
    water: { icon: Droplets, label: "Water", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
    sewer: { icon: Waves, label: "Sewer", color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-100 dark:bg-slate-800/50" },
};

export default function BillingSettingsPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;

    // Meter state
    const [meterMessage, setMeterMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [meterForm, setMeterForm] = useState({ siteId: "", type: "power", serialNumber: "" });
    const [creatingMeter, setCreatingMeter] = useState(false);

    // Meter reading state
    const [readForm, setReadForm] = useState({ meterId: "", readingValue: "", readAt: "", note: "" });
    const [readMessage, setReadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [savingRead, setSavingRead] = useState(false);

    // Bulk import state
    const [importText, setImportText] = useState("");
    const [importMessage, setImportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

    const invoicesQuery = useQuery({
        queryKey: ["invoices", reservationId],
        queryFn: () => apiClient.listInvoicesByReservation(reservationId),
        enabled: !!reservationId
    });

    const cg = campgroundQuery.data;
    const meters = metersQuery.data ?? [];

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
            setMeterMessage({ type: "success", text: `${meterTypeConfig[meterForm.type as keyof typeof meterTypeConfig]?.label || "Meter"} created for site ${meterForm.siteId}!` });
            setMeterForm({ siteId: "", type: meterForm.type, serialNumber: "" });
            metersQuery.refetch();
        } catch (err: any) {
            setMeterMessage({ type: "error", text: err?.message || "Failed to create meter" });
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
            setReadMessage({ type: "error", text: err?.message || "Failed to save reading" });
        } finally {
            setSavingRead(false);
        }
    };

    const handleImportReads = async () => {
        if (!campgroundId || !importText.trim()) return;
        setImportMessage(null);
        try {
            const parsed = JSON.parse(importText);
            if (!Array.isArray(parsed)) throw new Error("Expected an array of readings");
            await apiClient.importUtilityMeterReads({
                campgroundId,
                reads: parsed.map((r: any) => ({
                    meterId: r.meterId,
                    readingValue: Number(r.readingValue),
                    readAt: r.readAt,
                    note: r.note,
                    readBy: r.readBy,
                    source: r.source
                }))
            });
            setImportMessage({ type: "success", text: `Imported ${parsed.length} readings successfully!` });
            setImportText("");
        } catch (err: any) {
            setImportMessage({ type: "error", text: err?.message || "Invalid JSON format. Use an array of readings." });
        }
    };

    const handleRunLateFees = async () => {
        setRunningLateFees(true);
        setLateFeeMessage(null);
        try {
            await apiClient.runLateFees();
            setLateFeeMessage({ type: "success", text: "Late fee processing started. Overdue invoices will be updated shortly." });
        } catch (err: any) {
            setLateFeeMessage({ type: "error", text: err?.message || "Failed to run late fees" });
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
            className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                message.type === "success" && "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300",
                message.type === "error" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            )}
        >
            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span className="text-sm font-medium flex-1">{message.text}</span>
            <button onClick={onDismiss} className="opacity-60 hover:opacity-100 shrink-0">
                <XCircle className="h-4 w-4" />
            </button>
        </motion.div>
    );

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
                            Track utility usage for long-stay billing and manage invoices
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
                                        Track power, water, and sewer usage for sites with metered billing
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

                            {/* Create Meter Form */}
                            <div className="rounded-lg border border-border bg-muted/30 p-4">
                                <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add New Meter
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-4">
                                    <div className="space-y-2">
                                        <Label className="text-foreground">Site ID *</Label>
                                        <Input
                                            value={meterForm.siteId}
                                            onChange={(e) => setMeterForm({ ...meterForm, siteId: e.target.value })}
                                            placeholder="SITE-001"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-foreground">Type *</Label>
                                        <Select value={meterForm.type} onValueChange={(v) => setMeterForm({ ...meterForm, type: v })}>
                                            <SelectTrigger>
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
                                        <Label className="text-foreground">Serial Number</Label>
                                        <Input
                                            value={meterForm.serialNumber}
                                            onChange={(e) => setMeterForm({ ...meterForm, serialNumber: e.target.value })}
                                            placeholder="Optional"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button
                                            onClick={handleCreateMeter}
                                            disabled={creatingMeter || !meterForm.siteId}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
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

                            {/* Meters List */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-medium text-foreground">Your Meters</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => metersQuery.refetch()}
                                    >
                                        <RefreshCw className={cn("h-4 w-4", metersQuery.isFetching && "animate-spin")} />
                                    </Button>
                                </div>

                                {metersQuery.isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    </div>
                                ) : meters.length === 0 ? (
                                    <div className="text-center py-8 border border-dashed border-border rounded-lg">
                                        <Gauge className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">No meters yet</p>
                                        <p className="text-xs text-muted-foreground mt-1">Add a meter above to start tracking usage</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                        {meters.map((meter, i) => {
                                            const config = meterTypeConfig[meter.type as keyof typeof meterTypeConfig] || meterTypeConfig.power;
                                            const Icon = config.icon;
                                            return (
                                                <motion.div
                                                    key={meter.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ ...SPRING_CONFIG, delay: i * 0.03 }}
                                                    className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                                                >
                                                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", config.bg)}>
                                                        <Icon className={cn("h-4 w-4", config.color)} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-medium text-foreground truncate">{meter.siteId}</p>
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
                                        Enter meter readings for billing calculations
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

                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Single Reading */}
                                <div className="space-y-4">
                                    <h3 className="font-medium text-foreground">Single Reading</h3>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Meter</Label>
                                            <Select value={readForm.meterId} onValueChange={(v) => setReadForm({ ...readForm, meterId: v })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a meter..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {meters.map((m) => {
                                                        const config = meterTypeConfig[m.type as keyof typeof meterTypeConfig] || meterTypeConfig.power;
                                                        const Icon = config.icon;
                                                        return (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                <span className="flex items-center gap-2">
                                                                    <Icon className={cn("h-4 w-4", config.color)} />
                                                                    {m.siteId} - {config.label}
                                                                </span>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-3 grid-cols-2">
                                            <div className="space-y-2">
                                                <Label className="text-foreground">Reading Value *</Label>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={readForm.readingValue}
                                                    onChange={(e) => setReadForm({ ...readForm, readingValue: e.target.value })}
                                                    placeholder="1234.56"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-foreground">Date/Time</Label>
                                                <Input
                                                    type="datetime-local"
                                                    value={readForm.readAt}
                                                    onChange={(e) => setReadForm({ ...readForm, readAt: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Note (optional)</Label>
                                            <Input
                                                value={readForm.note}
                                                onChange={(e) => setReadForm({ ...readForm, note: e.target.value })}
                                                placeholder="Tech initials, observations, etc."
                                            />
                                        </div>
                                        <Button
                                            onClick={handleAddRead}
                                            disabled={savingRead || !readForm.meterId || !readForm.readingValue}
                                            className="w-full"
                                        >
                                            {savingRead ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                                            ) : (
                                                <><CheckCircle2 className="mr-2 h-4 w-4" /> Save Reading</>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Bulk Import */}
                                <div className="space-y-4">
                                    <h3 className="font-medium text-foreground">Bulk Import</h3>
                                    <AnimatePresence>
                                        {importMessage && (
                                            <MessageBanner message={importMessage} onDismiss={() => setImportMessage(null)} />
                                        )}
                                    </AnimatePresence>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label className="text-foreground">JSON Array of Readings</Label>
                                            <textarea
                                                className="min-h-[140px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                placeholder='[{"meterId":"...","readingValue":123.45,"readAt":"2025-01-15T10:00:00Z"}]'
                                                value={importText}
                                                onChange={(e) => setImportText(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleImportReads}
                                            disabled={!importText.trim()}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            <Upload className="mr-2 h-4 w-4" />
                                            Import Readings
                                        </Button>
                                    </div>
                                </div>
                            </div>
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
                                    <Input
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
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            )}

                            {reservationId && !invoicesQuery.isFetching && invoicesQuery.data?.length === 0 && (
                                <div className="text-center py-8 border border-dashed border-border rounded-lg">
                                    <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                                    <p className="text-sm text-muted-foreground">No invoices found for this reservation</p>
                                </div>
                            )}

                            {invoicesQuery.data && invoicesQuery.data.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Invoice</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Due Date</th>
                                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Total</th>
                                                <th className="text-right py-3 px-2 font-medium text-muted-foreground">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoicesQuery.data.map((inv: Invoice) => (
                                                <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                                                    <td className="py-3 px-2 font-medium text-foreground">{inv.number}</td>
                                                    <td className="py-3 px-2">
                                                        <Badge variant="outline" className={cn(
                                                            inv.status === "paid" && "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
                                                            inv.status === "overdue" && "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
                                                            inv.status === "pending" && "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                                                        )}>
                                                            {inv.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-2 text-muted-foreground">
                                                        {new Date(inv.dueDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="py-3 px-2 text-right text-foreground font-medium">
                                                        {formatMoney(inv.totalCents)}
                                                    </td>
                                                    <td className="py-3 px-2 text-right">
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
        </DashboardShell>
    );
}
