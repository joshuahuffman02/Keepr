"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { DepositSettings } from "@/components/campgrounds/DepositSettings";
import { CampgroundProfileForm } from "@/components/campgrounds/CampgroundProfileForm";
import { CampgroundMapUpload } from "@/components/campgrounds/CampgroundMapUpload";
import { SiteMapCanvas } from "@/components/maps/SiteMapCanvas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NewbookImport } from "@/components/settings/NewbookImport";

export default function CampgroundSettingsPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
    const [dryRun, setDryRun] = useState(true);
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState<string | null>(null);
    const [importSchemaLoading, setImportSchemaLoading] = useState(false);

    const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");
    const [includePii, setIncludePii] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState<string | null>(null);

    const [meterMessage, setMeterMessage] = useState<string | null>(null);
    const [meterForm, setMeterForm] = useState({ siteId: "", type: "power", serialNumber: "" });
    const [meterReadForm, setMeterReadForm] = useState({ meterId: "", readingValue: "", readAt: "", note: "" });
    const [importReadsText, setImportReadsText] = useState("");
    const [readMessage, setReadMessage] = useState<string | null>(null);
    const [lateFeeMessage, setLateFeeMessage] = useState<string | null>(null);
    const [invoiceReservationInput, setInvoiceReservationInput] = useState("");
    const [invoiceReservationId, setInvoiceReservationId] = useState("");
    const [referralForm, setReferralForm] = useState({
        code: "",
        linkSlug: "",
        source: "",
        channel: "",
        incentiveType: "percent_discount",
        incentiveValue: 10,
        isActive: true,
        notes: ""
    });
    const [referralMessage, setReferralMessage] = useState<string | null>(null);

    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [rigLength, setRigLength] = useState("");
    const [rigWidth, setRigWidth] = useState("");
    const [rigHeight, setRigHeight] = useState("");
    const [needsAda, setNeedsAda] = useState(false);
    const [amenitiesInput, setAmenitiesInput] = useState("");
    const [previewMessage, setPreviewMessage] = useState<string | null>(null);

    // Tab navigation
    type SettingsTab = "general" | "data" | "marketing" | "billing" | "advanced";
    const [activeTab, setActiveTab] = useState<SettingsTab>("general");
    const locationSearch = typeof window !== "undefined" ? window.location.search : "";

    const queryClient = useQueryClient();

    useEffect(() => {
        if (!locationSearch) return;
        const tab = new URLSearchParams(locationSearch).get("tab");
        if (tab && ["general", "data", "marketing", "billing", "advanced"].includes(tab)) {
            setActiveTab(tab as SettingsTab);
        }
    }, [locationSearch]);

    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId
    });

    const mapQuery = useQuery({
        queryKey: ["campground-map", campgroundId, startDate, endDate],
        queryFn: () =>
            apiClient.getCampgroundMap(campgroundId, {
                startDate: startDate || undefined,
                endDate: endDate || undefined
            }),
        enabled: !!campgroundId
    });

    const previewMutation = useMutation({
        mutationFn: (payload: any) => apiClient.previewAssignments(campgroundId, payload)
    });

    const referralProgramsQuery = useQuery({
        queryKey: ["referral-programs", campgroundId],
        queryFn: () => apiClient.listReferralPrograms(campgroundId),
        enabled: !!campgroundId
    });

    const referralPerformanceQuery = useQuery({
        queryKey: ["referral-performance", campgroundId],
        queryFn: () => apiClient.getReferralPerformance(campgroundId),
        enabled: !!campgroundId
    });

    const stayReasonQuery = useQuery({
        queryKey: ["stay-reasons", campgroundId],
        queryFn: () => apiClient.getStayReasonBreakdown(campgroundId),
        enabled: !!campgroundId
    });

    const createReferralMutation = useMutation({
        mutationFn: () => apiClient.createReferralProgram(campgroundId, {
            ...referralForm,
            incentiveValue: Number(referralForm.incentiveValue || 0)
        }),
        onSuccess: () => {
            setReferralMessage("Referral program saved.");
            setReferralForm({
                code: "",
                linkSlug: "",
                source: "",
                channel: "",
                incentiveType: referralForm.incentiveType,
                incentiveValue: referralForm.incentiveType === "percent_discount" ? 10 : 1000,
                isActive: true,
                notes: ""
            });
            queryClient.invalidateQueries({ queryKey: ["referral-programs", campgroundId] });
        },
        onError: (err: any) => setReferralMessage(err?.message || "Failed to save referral program")
    });

    const updateReferralMutation = useMutation({
        mutationFn: (payload: { id: string; data: any }) => apiClient.updateReferralProgram(campgroundId, payload.id, payload.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["referral-programs", campgroundId] });
        },
        onError: (err: any) => setReferralMessage(err?.message || "Failed to update referral program")
    });

    const cg = campgroundQuery.data;
    const referralBaseUrl = useMemo(() => (typeof window !== "undefined" ? window.location.origin : "https://campeveryday.com"), []);
    const formatMoney = (cents: number | null | undefined) => `$${(((cents ?? 0) as number) / 100).toFixed(2)}`;

    const mapBaseImageUrl = useMemo(() => {
        const layers = mapQuery.data?.config?.layers as any;
        if (!layers || typeof layers !== "object") return null;
        if (typeof layers.baseImageUrl === "string") return layers.baseImageUrl;
        if (typeof layers.baseImage?.url === "string") return layers.baseImage.url;
        if (typeof layers.background?.url === "string") return layers.background.url;
        if (typeof layers.image === "string") return layers.image;
        return null;
    }, [mapQuery.data?.config?.layers]);

    const sites = mapQuery.data?.sites ?? [];
    const adaCount = useMemo(() => sites.filter((s) => s.ada).length, [sites]);
    const conflictSites = useMemo(() => sites.filter((s) => (s.conflicts?.length ?? 0) > 0).length, [sites]);
    const siteLabelById = useMemo(() => {
        const map = new Map<string, string>();
        sites.forEach((s) => {
            map.set(s.siteId, s.label || s.name || s.siteNumber || s.siteId);
        });
        return map;
    }, [sites]);

    const metersQuery = useQuery({
        queryKey: ["utility-meters", campgroundId],
        queryFn: () => apiClient.listUtilityMeters(campgroundId),
        enabled: !!campgroundId
    });

    const invoicesQuery = useQuery({
        queryKey: ["invoices", invoiceReservationId],
        queryFn: () => apiClient.listInvoicesByReservation(invoiceReservationId),
        enabled: !!invoiceReservationId
    });

    const handlePreviewEligibility = () => {
        if (!campgroundId) return;
        if (!startDate || !endDate) {
            setPreviewMessage("Select start and end dates to preview eligibility.");
            return;
        }
        setPreviewMessage(null);
        const requiredAmenities = amenitiesInput
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean);

        previewMutation.mutate({
            startDate,
            endDate,
            rig: {
                length: rigLength ? Number(rigLength) : undefined,
                width: rigWidth ? Number(rigWidth) : undefined,
                height: rigHeight ? Number(rigHeight) : undefined
            },
            needsADA: needsAda,
            requiredAmenities,
            partySize: undefined
        });
    };

    const handleImportFile = async (file: File) => {
        if (!campgroundId) return;
        setImporting(true);
        setImportMessage(null);
        try {
            const raw = await file.text();
            let payload: any = raw;
            if (importFormat === "json") {
                try {
                    payload = JSON.parse(raw);
                } catch {
                    setImportMessage("Invalid JSON file");
                    setImporting(false);
                    return;
                }
            }
            const res = await apiClient.importReservations(campgroundId, {
                format: importFormat,
                payload,
                dryRun,
                filename: file.name
            });
            if (dryRun) {
                setImportMessage(
                    `Dry run: ${res.validCount ?? 0} valid, ${res.errorCount ?? 0} errors${res.validationErrors?.length ? " (check errors in response)" : ""
                    }`
                );
            } else if (res.jobId) {
                setImportMessage(`Import queued as job ${res.jobId}. Status: ${res.status ?? "queued"}`);
            } else {
                setImportMessage("Import submitted.");
            }
        } catch (err: any) {
            setImportMessage(err?.message || "Import failed");
        } finally {
            setImporting(false);
        }
    };

    const triggerFilePicker = () => {
        fileInputRef.current?.click();
    };

    const downloadBlob = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDownloadTemplate = async () => {
        if (!campgroundId) return;
        setImportSchemaLoading(true);
        setImportMessage(null);
        try {
            const schema = await apiClient.getReservationImportSchema(campgroundId);
            const headers: string[] = schema?.csvColumns ?? [
                "campgroundId",
                "siteId",
                "guestId",
                "arrivalDate",
                "departureDate",
                "adults",
                "totalAmount"
            ];
            const sampleRow: Record<string, string | number> = {
                campgroundId,
                siteId: "SITE-123",
                guestId: "GUEST-123",
                arrivalDate: "2025-01-10",
                departureDate: "2025-01-12",
                adults: 2,
                totalAmount: 10000,
                children: 0,
                status: "confirmed",
                paidAmount: 0,
                source: "import"
            };
            const line = headers.join(",");
            const sample = headers.map((h) => (sampleRow as any)[h] ?? "").join(",");
            const csv = `${line}\n${sample}\n`;
            downloadBlob(csv, "reservation-import-template.csv", "text/csv");
            setImportMessage("Template downloaded.");
        } catch (err: any) {
            setImportMessage(err?.message || "Failed to download template");
        } finally {
            setImportSchemaLoading(false);
        }
    };

    const handleExportQuick = async () => {
        if (!campgroundId) return;
        setExporting(true);
        setExportMessage(null);
        try {
            const res = await apiClient.exportReservationsPage(campgroundId, {
                format: exportFormat,
                includePII: includePii
            });
            if (exportFormat === "csv" && res.csv) {
                downloadBlob(res.csv, `reservations-${campgroundId}.csv`, "text/csv");
            } else {
                downloadBlob(JSON.stringify(res, null, 2), `reservations-${campgroundId}.json`, "application/json");
            }
            setExportMessage(res.nextToken ? "Downloaded first page; more available via pagination or export job." : "Export downloaded.");
        } catch (err: any) {
            setExportMessage(err?.message || "Export failed");
        } finally {
            setExporting(false);
        }
    };

    const handleQueueExportJob = async () => {
        if (!campgroundId) return;
        setExporting(true);
        setExportMessage(null);
        try {
            const job = await apiClient.queueReservationExportJob(campgroundId, { format: exportFormat });
            setExportMessage(`Export job queued (${job.id ?? "job"})`);
        } catch (err: any) {
            setExportMessage(err?.message || "Failed to queue export job");
        } finally {
            setExporting(false);
        }
    };

    const handleCreateMeter = async () => {
        if (!campgroundId) return;
        setMeterMessage(null);
        try {
            await apiClient.createUtilityMeter(campgroundId, {
                siteId: meterForm.siteId,
                type: meterForm.type,
                serialNumber: meterForm.serialNumber || undefined
            });
            setMeterMessage("Meter created.");
            setMeterForm({ siteId: "", type: meterForm.type, serialNumber: "" });
            metersQuery.refetch();
        } catch (err: any) {
            setMeterMessage(err?.message || "Failed to create meter");
        }
    };

    const handleAddRead = async () => {
        setReadMessage(null);
        try {
            await apiClient.addUtilityMeterRead(meterReadForm.meterId, {
                readingValue: Number(meterReadForm.readingValue),
                readAt: meterReadForm.readAt,
                note: meterReadForm.note || undefined
            });
            setReadMessage("Read saved.");
            setMeterReadForm({ meterId: meterReadForm.meterId, readingValue: "", readAt: "", note: "" });
        } catch (err: any) {
            setReadMessage(err?.message || "Failed to save read");
        }
    };

    const handleImportReads = async () => {
        if (!campgroundId) return;
        setReadMessage(null);
        try {
            const parsed = JSON.parse(importReadsText || "[]");
            if (!Array.isArray(parsed)) throw new Error("Expected an array of reads");
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
            setReadMessage("Reads imported.");
            setImportReadsText("");
        } catch (err: any) {
            setReadMessage(err?.message || "Failed to import reads (use JSON array)");
        }
    };

    const handleRunLateFees = async () => {
        setLateFeeMessage(null);
        try {
            await apiClient.runLateFees();
            setLateFeeMessage("Late fees job kicked off.");
        } catch (err: any) {
            setLateFeeMessage(err?.message || "Failed to run late fees");
        }
    };

    const triggerInvoiceFetch = () => {
        setInvoiceReservationId(invoiceReservationInput.trim());
    };

    if (campgroundQuery.isLoading) {
        return (
            <DashboardShell>
                <div className="p-6">Loading...</div>
            </DashboardShell>
        );
    }

    if (!cg) {
        return (
            <DashboardShell>
                <div className="p-6 text-red-600">Campground not found</div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                <Breadcrumbs
                    items={[
                        { label: "Campgrounds", href: "/campgrounds?all=true" },
                        { label: cg.name, href: `/campgrounds/${campgroundId}` },
                        { label: "Settings" }
                    ]}
                />

                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
                </div>

                {/* Horizontal Tab Bar */}
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm overflow-x-auto">
                    {([{ key: "general", label: "General" }, { key: "data", label: "Data" }, { key: "marketing", label: "Marketing" }, { key: "billing", label: "Billing" }, { key: "advanced", label: "Advanced" }] as const).map((tab) => (
                        <Button key={tab.key} size="sm" variant={activeTab === tab.key ? "default" : "ghost"} className="whitespace-nowrap" onClick={() => setActiveTab(tab.key)}>{tab.label}</Button>
                    ))}
                </div>

                <div className="grid gap-6">
                    {/* General Tab */}
                    {activeTab === "general" && (<>
                        <CampgroundProfileForm campground={cg} />
                        <DepositSettings campground={cg} />
                    </>)}

                    {/* Marketing Tab */}
                    {activeTab === "marketing" && (<>
                        <Card id="utilities-billing" className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Referral programs</h2>
                                    <p className="text-sm text-slate-600">Create codes/links, set incentives, and manage status.</p>
                                </div>
                                {referralProgramsQuery.isFetching && <span className="text-xs text-slate-500">Refreshing…</span>}
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-sm">Code</Label>
                                            <input
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                                value={referralForm.code}
                                                onChange={(e) => setReferralForm({ ...referralForm, code: e.target.value })}
                                                placeholder="FRIEND10"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-sm">Link slug (optional)</Label>
                                            <input
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                                value={referralForm.linkSlug}
                                                onChange={(e) => setReferralForm({ ...referralForm, linkSlug: e.target.value })}
                                                placeholder="camp-crew"
                                            />
                                            {referralForm.linkSlug && (
                                                <p className="text-[11px] text-slate-500 mt-1">{`${referralBaseUrl}/r/${referralForm.linkSlug}`}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-sm">Source</Label>
                                            <input
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                                value={referralForm.source}
                                                onChange={(e) => setReferralForm({ ...referralForm, source: e.target.value })}
                                                placeholder="friend, influencer, partner"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-sm">Channel</Label>
                                            <input
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                                value={referralForm.channel}
                                                onChange={(e) => setReferralForm({ ...referralForm, channel: e.target.value })}
                                                placeholder="email, social, sms"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-sm">Incentive type</Label>
                                            <select
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                                value={referralForm.incentiveType}
                                                onChange={(e) => setReferralForm({ ...referralForm, incentiveType: e.target.value })}
                                            >
                                                <option value="percent_discount">Percent discount</option>
                                                <option value="amount_discount">Amount discount (cents)</option>
                                                <option value="credit">Credit (cents)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-sm">
                                                Value {referralForm.incentiveType === "percent_discount" ? "(%)" : "(cents)"}
                                            </Label>
                                            <input
                                                type="number"
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                                value={referralForm.incentiveValue}
                                                onChange={(e) => setReferralForm({ ...referralForm, incentiveValue: Number(e.target.value) })}
                                                min={0}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-sm">Notes (internal)</Label>
                                        <textarea
                                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                            value={referralForm.notes}
                                            onChange={(e) => setReferralForm({ ...referralForm, notes: e.target.value })}
                                            rows={2}
                                            placeholder="e.g., Fall promo affiliates only"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch checked={referralForm.isActive} onCheckedChange={(val) => setReferralForm({ ...referralForm, isActive: val })} />
                                        <Label className="text-sm">Active</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => createReferralMutation.mutate()}
                                            disabled={createReferralMutation.isPending || !referralForm.code.trim()}
                                        >
                                            {createReferralMutation.isPending ? "Saving..." : "Save referral program"}
                                        </Button>
                                        {referralMessage && <span className="text-sm text-slate-600">{referralMessage}</span>}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-800">Existing programs</h3>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => queryClient.invalidateQueries({ queryKey: ["referral-programs", campgroundId] })}
                                        >
                                            Refresh
                                        </Button>
                                    </div>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-slate-600">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Code</th>
                                                    <th className="px-3 py-2 text-left">Incentive</th>
                                                    <th className="px-3 py-2 text-left">Source</th>
                                                    <th className="px-3 py-2 text-left">Status</th>
                                                    <th className="px-3 py-2 text-left">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(referralProgramsQuery.data ?? []).map((p) => (
                                                    <tr key={p.id} className="border-t border-slate-200">
                                                        <td className="px-3 py-2">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-900">{p.code}</span>
                                                                {p.linkSlug && (
                                                                    <span className="text-[11px] text-slate-500">{`${referralBaseUrl}/r/${p.linkSlug}`}</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {p.incentiveType === "percent_discount"
                                                                ? `${p.incentiveValue}% off`
                                                                : `${formatMoney(p.incentiveValue)} ${p.incentiveType === "credit" ? "credit" : "off"}`
                                                            }
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-700">
                                                            {(p.source || "–")}{p.channel ? ` / ${p.channel}` : ""}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "Active" : "Paused"}</Badge>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => updateReferralMutation.mutate({ id: p.id, data: { isActive: !p.isActive } })}
                                                                disabled={updateReferralMutation.isPending}
                                                            >
                                                                {p.isActive ? "Pause" : "Activate"}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {(referralProgramsQuery.data ?? []).length === 0 && (
                                                    <tr>
                                                        <td className="px-3 py-3 text-slate-500 text-sm" colSpan={5}>No referral programs yet.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <Card className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Referral performance</h2>
                                    <p className="text-sm text-slate-600">Bookings, revenue, and discounts attributed to referrals.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="rounded-lg border border-slate-200 p-4">
                                    <div className="text-xs text-slate-500 uppercase">Bookings</div>
                                    <div className="text-xl font-bold text-slate-900">
                                        {referralPerformanceQuery.data?.totalBookings ?? 0}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 p-4">
                                    <div className="text-xs text-slate-500 uppercase">Revenue</div>
                                    <div className="text-xl font-bold text-slate-900">
                                        {formatMoney(referralPerformanceQuery.data?.totalRevenueCents ?? 0)}
                                    </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 p-4">
                                    <div className="text-xs text-slate-500 uppercase">Referral discounts</div>
                                    <div className="text-xl font-bold text-slate-900">
                                        {formatMoney(referralPerformanceQuery.data?.totalReferralDiscountCents ?? 0)}
                                    </div>
                                </div>
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Program / Code</th>
                                            <th className="px-3 py-2 text-left">Bookings</th>
                                            <th className="px-3 py-2 text-left">Revenue</th>
                                            <th className="px-3 py-2 text-left">Discounts</th>
                                            <th className="px-3 py-2 text-left">Source</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(referralPerformanceQuery.data?.programs ?? []).map((p: any) => (
                                            <tr key={`${p.programId}-${p.code}`} className="border-t border-slate-200">
                                                <td className="px-3 py-2">
                                                    <div className="font-semibold text-slate-900">{p.code || "Unknown"}</div>
                                                </td>
                                                <td className="px-3 py-2">{p.bookings}</td>
                                                <td className="px-3 py-2">{formatMoney(p.revenueCents)}</td>
                                                <td className="px-3 py-2">{formatMoney(p.referralDiscountCents)}</td>
                                                <td className="px-3 py-2 text-slate-700">
                                                    {(p.source || "–")}{p.channel ? ` / ${p.channel}` : ""}
                                                </td>
                                            </tr>
                                        ))}
                                        {(referralPerformanceQuery.data?.programs ?? []).length === 0 && (
                                            <tr>
                                                <td className="px-3 py-3 text-slate-500 text-sm" colSpan={5}>No referral data yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                        <Card className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Stay reasons</h2>
                                    <p className="text-sm text-slate-600">Breakdown of guest-selected reasons for their stay.</p>
                                </div>
                            </div>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Reason</th>
                                            <th className="px-3 py-2 text-left">Count</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(stayReasonQuery.data?.breakdown ?? []).map((r: any) => (
                                            <tr key={r.reason} className="border-t border-slate-200">
                                                <td className="px-3 py-2 text-slate-900">{r.reason}</td>
                                                <td className="px-3 py-2">{r.count}</td>
                                            </tr>
                                        ))}
                                        {(stayReasonQuery.data?.breakdown ?? []).length === 0 && (
                                            <tr>
                                                <td className="px-3 py-3 text-slate-500 text-sm" colSpan={2}>No stay reason responses yet.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {(stayReasonQuery.data?.otherReasons?.length ?? 0) > 0 && (
                                <div className="space-y-1">
                                    <h4 className="text-sm font-semibold text-slate-800">“Other” notes</h4>
                                    <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                                        {stayReasonQuery.data?.otherReasons?.map((note: string, idx: number) => (
                                            <li key={idx}>{note}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Card>
                    </>)}

                    {/* Advanced Tab */}
                    {activeTab === "advanced" && (
                        <Card className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Map & assignment</h2>
                                    <p className="text-sm text-slate-600">
                                        Load the campground map, inspect ADA/amenities, and preview eligibility with conflicts.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="start-date">Arrival date</Label>
                                        <input
                                            id="start-date"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="end-date">Departure date</Label>
                                        <input
                                            id="end-date"
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Rig size (ft/in)</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="Length"
                                                value={rigLength}
                                                onChange={(e) => setRigLength(e.target.value)}
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="Width"
                                                value={rigWidth}
                                                onChange={(e) => setRigWidth(e.target.value)}
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                            />
                                            <input
                                                type="number"
                                                min={0}
                                                placeholder="Height"
                                                value={rigHeight}
                                                onChange={(e) => setRigHeight(e.target.value)}
                                                className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch id="needs-ada" checked={needsAda} onCheckedChange={setNeedsAda} />
                                        <Label htmlFor="needs-ada">ADA required</Label>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="amenities">Required amenities (comma separated)</Label>
                                        <input
                                            id="amenities"
                                            type="text"
                                            placeholder="power,sewer,water"
                                            value={amenitiesInput}
                                            onChange={(e) => setAmenitiesInput(e.target.value)}
                                            className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button onClick={handlePreviewEligibility} disabled={previewMutation.isPending}>
                                            {previewMutation.isPending ? "Checking..." : "Preview eligibility"}
                                        </Button>
                                        {previewMessage && <span className="text-sm text-amber-700">{previewMessage}</span>}
                                    </div>
                                    <div className="text-sm text-slate-700">
                                        {mapQuery.isLoading && <p>Loading map...</p>}
                                        {mapQuery.isError && <p className="text-red-600">Failed to load map.</p>}
                                        {mapQuery.data && (
                                            <div className="space-y-1">
                                                <p>
                                                    Sites loaded: <strong>{sites.length}</strong>{" "}
                                                    {adaCount ? `• ADA: ${adaCount}` : ""}{" "}
                                                    {conflictSites ? `• Conflicts: ${conflictSites}` : ""}
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {sites.slice(0, 12).map((s) => (
                                                        <Badge key={s.siteId} variant={s.ada ? "default" : "secondary"}>
                                                            {s.label || s.name}
                                                        </Badge>
                                                    ))}
                                                    {sites.length > 12 && <span className="text-xs text-slate-500">+ more</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800">Site map preview</div>
                                            <p className="text-xs text-slate-500">
                                                Upload a base map image and review layout geometry + conflicts.
                                            </p>
                                        </div>
                                        <CampgroundMapUpload
                                            campgroundId={campgroundId}
                                            initialUrl={mapBaseImageUrl}
                                            onUploaded={() => mapQuery.refetch()}
                                        />
                                        <SiteMapCanvas
                                            map={mapQuery.data}
                                            isLoading={mapQuery.isLoading}
                                            showLabels
                                        />
                                        {mapQuery.isError && (
                                            <p className="text-xs text-rose-600">Failed to load map preview.</p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Eligibility preview</Label>
                                        {previewMutation.isPending && <p className="text-sm text-slate-600">Checking...</p>}
                                        {!previewMutation.data && !previewMutation.isPending && (
                                            <p className="text-sm text-slate-600">Set dates and run preview to see eligible sites.</p>
                                        )}
                                        {previewMutation.data && (
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-green-700">
                                                        Eligible ({previewMutation.data.eligible.length})
                                                    </p>
                                                    <div className="space-y-1 max-h-48 overflow-auto pr-1">
                                                        {previewMutation.data.eligible.map((row) => (
                                                            <div key={row.siteId} className="rounded border border-green-100 bg-green-50 px-3 py-2">
                                                                <div className="flex items-center justify-between text-sm font-medium text-green-800">
                                                                    <span>{siteLabelById.get(row.siteId) ?? row.siteId}</span>
                                                                    <span>{row.reasons?.length ? "With notes" : "Clear"}</span>
                                                                </div>
                                                                {row.conflicts?.length ? (
                                                                    <p className="text-xs text-amber-700">
                                                                        Conflicts present: {row.conflicts.map((c) => c.type).join(", ")}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-semibold text-red-700">
                                                        Ineligible ({previewMutation.data.ineligible.length})
                                                    </p>
                                                    <div className="space-y-1 max-h-48 overflow-auto pr-1">
                                                        {previewMutation.data.ineligible.map((row) => (
                                                            <div key={row.siteId} className="rounded border border-red-100 bg-red-50 px-3 py-2">
                                                                <div className="flex items-center justify-between text-sm font-medium text-red-800">
                                                                    <span>{siteLabelById.get(row.siteId) ?? row.siteId}</span>
                                                                    <span>{row.reasons.join(", ")}</span>
                                                                </div>
                                                                {row.conflicts?.length ? (
                                                                    <p className="text-xs text-amber-700">
                                                                        Conflicts: {row.conflicts.map((c) => c.type).join(", ")}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Data Tab */}
                    {activeTab === "data" && (<>
                        <Card className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Reservation import/export</h2>
                                    <p className="text-sm text-slate-600">
                                        Import from CSV/JSON or export reservations with pagination and PII controls.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-6 md:grid-cols-2">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="import-format">Import format</Label>
                                        <select
                                            id="import-format"
                                            className="rounded border border-slate-200 px-2 py-1 text-sm"
                                            value={importFormat}
                                            onChange={(e) => setImportFormat(e.target.value as "csv" | "json")}
                                        >
                                            <option value="csv">CSV</option>
                                            <option value="json">JSON</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch id="dry-run" checked={dryRun} onCheckedChange={setDryRun} />
                                        <Label htmlFor="dry-run">Dry run (validate only)</Label>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept={importFormat === "csv" ? ".csv,text/csv" : ".json,application/json"}
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImportFile(file);
                                        }}
                                    />
                                    <div className="flex items-center gap-2">
                                        <Button variant="default" onClick={triggerFilePicker} disabled={importing}>
                                            {importing ? "Importing..." : "Select file to import"}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={async () => {
                                                if (!campgroundId) return;
                                                const schema = await apiClient.getReservationImportSchema(campgroundId);
                                                downloadBlob(
                                                    JSON.stringify(schema, null, 2),
                                                    "reservation-import-schema.json",
                                                    "application/json"
                                                );
                                            }}
                                        >
                                            View schema
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDownloadTemplate}
                                            disabled={importSchemaLoading}
                                        >
                                            {importSchemaLoading ? "Preparing..." : "Download CSV template"}
                                        </Button>
                                    </div>
                                    {importMessage && <p className="text-sm text-slate-700">{importMessage}</p>}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="export-format">Export format</Label>
                                        <select
                                            id="export-format"
                                            className="rounded border border-slate-200 px-2 py-1 text-sm"
                                            value={exportFormat}
                                            onChange={(e) => setExportFormat(e.target.value as "csv" | "json")}
                                        >
                                            <option value="csv">CSV</option>
                                            <option value="json">JSON</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Switch id="include-pii" checked={includePii} onCheckedChange={setIncludePii} />
                                        <Label htmlFor="include-pii">Include PII</Label>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button onClick={handleExportQuick} disabled={exporting}>
                                            {exporting ? "Exporting..." : "Quick download"}
                                        </Button>
                                        <Button variant="outline" onClick={handleQueueExportJob} disabled={exporting}>
                                            Queue export job
                                        </Button>
                                    </div>
                                    {exportMessage && <p className="text-sm text-slate-700">{exportMessage}</p>}
                                </div>
                            </div>
                        </Card>

                        {/* NewBook Import */}
                        <NewbookImport campgroundId={campgroundId} />
                    </>)}

                    {/* Billing Tab */}
                    {activeTab === "billing" && (<>
                        <Card className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Utility meters</h2>
                                    <p className="text-sm text-slate-600">Manage meters and capture reads for long-stay billing.</p>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Site ID</Label>
                                    <input
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={meterForm.siteId}
                                        onChange={(e) => setMeterForm({ ...meterForm, siteId: e.target.value })}
                                        placeholder="site id"
                                    />
                                    <Label>Type</Label>
                                    <select
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={meterForm.type}
                                        onChange={(e) => setMeterForm({ ...meterForm, type: e.target.value })}
                                    >
                                        <option value="power">Power</option>
                                        <option value="water">Water</option>
                                        <option value="sewer">Sewer</option>
                                    </select>
                                    <Label>Serial (optional)</Label>
                                    <input
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={meterForm.serialNumber}
                                        onChange={(e) => setMeterForm({ ...meterForm, serialNumber: e.target.value })}
                                        placeholder="123-ABC"
                                    />
                                    <Button onClick={handleCreateMeter}>Create meter</Button>
                                    {meterMessage && <p className="text-sm text-slate-700">{meterMessage}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>Meter ID</Label>
                                    <input
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={meterReadForm.meterId}
                                        onChange={(e) => setMeterReadForm({ ...meterReadForm, meterId: e.target.value })}
                                        placeholder="meter id"
                                    />
                                    <Label>Reading value</Label>
                                    <input
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={meterReadForm.readingValue}
                                        onChange={(e) => setMeterReadForm({ ...meterReadForm, readingValue: e.target.value })}
                                        placeholder="e.g. 1234.5"
                                    />
                                    <Label>Read at</Label>
                                    <input
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        type="datetime-local"
                                        value={meterReadForm.readAt}
                                        onChange={(e) => setMeterReadForm({ ...meterReadForm, readAt: e.target.value })}
                                    />
                                    <Label>Note (optional)</Label>
                                    <input
                                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={meterReadForm.note}
                                        onChange={(e) => setMeterReadForm({ ...meterReadForm, note: e.target.value })}
                                        placeholder="Tech initials, etc."
                                    />
                                    <Button onClick={handleAddRead}>Save read</Button>
                                    {readMessage && <p className="text-sm text-slate-700">{readMessage}</p>}
                                </div>

                                <div className="space-y-2">
                                    <Label>Import reads (JSON array)</Label>
                                    <textarea
                                        className="min-h-[160px] w-full rounded border border-slate-200 px-2 py-1 text-sm"
                                        placeholder='[{"meterId":"...","readingValue":123,"readAt":"2025-01-15T00:00:00Z"}]'
                                        value={importReadsText}
                                        onChange={(e) => setImportReadsText(e.target.value)}
                                    />
                                    <Button onClick={handleImportReads}>Import reads</Button>
                                </div>
                            </div>

                            <div className="rounded border">
                                <div className="grid grid-cols-4 bg-slate-50 px-3 py-2 text-sm font-semibold">
                                    <div>Meter</div>
                                    <div>Site</div>
                                    <div>Type</div>
                                    <div>Serial</div>
                                </div>
                                <div className="divide-y">
                                    {metersQuery.isLoading && <div className="px-3 py-3 text-sm text-slate-600">Loading meters...</div>}
                                    {metersQuery.data?.map((m) => (
                                        <div key={m.id} className="grid grid-cols-4 px-3 py-2 text-sm">
                                            <div className="truncate">{m.id}</div>
                                            <div>{m.siteId}</div>
                                            <div className="capitalize">{m.type}</div>
                                            <div>{m.serialNumber || "—"}</div>
                                        </div>
                                    ))}
                                    {(metersQuery.data ?? []).length === 0 && !metersQuery.isLoading && (
                                        <div className="px-3 py-3 text-sm text-slate-600">No meters yet.</div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Invoices & late fees</h2>
                                    <p className="text-sm text-slate-600">View invoices by reservation and trigger late-fee run.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" onClick={handleRunLateFees}>
                                        Run late fees
                                    </Button>
                                </div>
                            </div>
                            {lateFeeMessage && <p className="text-sm text-slate-700">{lateFeeMessage}</p>}

                            <div className="flex flex-wrap items-end gap-2">
                                <div className="flex flex-col gap-1">
                                    <Label>Reservation ID</Label>
                                    <input
                                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                                        value={invoiceReservationInput}
                                        onChange={(e) => setInvoiceReservationInput(e.target.value)}
                                        placeholder="reservation id"
                                    />
                                </div>
                                <Button onClick={triggerInvoiceFetch}>Load invoices</Button>
                            </div>

                            {invoicesQuery.isFetching && <p className="text-sm text-slate-600">Loading invoices...</p>}
                            {invoicesQuery.data && invoicesQuery.data.length === 0 && (
                                <p className="text-sm text-slate-600">No invoices found for this reservation.</p>
                            )}
                            {invoicesQuery.data && invoicesQuery.data.length > 0 && (
                                <div className="rounded border">
                                    <div className="grid grid-cols-5 bg-slate-50 px-3 py-2 text-sm font-semibold">
                                        <div>Invoice</div>
                                        <div>Status</div>
                                        <div>Due</div>
                                        <div>Total</div>
                                        <div>Balance</div>
                                    </div>
                                    <div className="divide-y">
                                        {invoicesQuery.data.map((inv) => (
                                            <div key={inv.id} className="grid grid-cols-5 px-3 py-2 text-sm">
                                                <div className="truncate">{inv.number}</div>
                                                <div className="capitalize">{inv.status}</div>
                                                <div>{new Date(inv.dueDate).toLocaleDateString()}</div>
                                                <div>${(inv.totalCents / 100).toFixed(2)}</div>
                                                <div>${(inv.balanceCents / 100).toFixed(2)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </>)}
                </div>
            </div>
        </DashboardShell >
    );
}
