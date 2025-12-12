"use client";

import { useState, useEffect } from "react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { Plus, Pencil, Trash2, Loader2, Calendar, Moon, CalendarRange, Sun, CreditCard, Repeat } from "lucide-react";
import { format } from "date-fns";

type PaymentSchedule = "single" | "weekly" | "monthly" | "as_you_stay" | "offseason_installments";
type PricingStructure = "per_night" | "flat_week" | "flat_month" | "flat_season";

type SeasonalRate = {
    id: string;
    campgroundId: string;
    siteClassId: string | null;
    name: string;
    rateType: "nightly" | "weekly" | "monthly" | "seasonal";
    amount: number;
    minNights: number | null;
    startDate: string | null;
    endDate: string | null;
    isActive: boolean;
    paymentSchedule: PaymentSchedule;
    pricingStructure: PricingStructure;
    offseasonInterval: number | null;
    offseasonAmount: number | null;
    prorateExcess: boolean;
    createdAt: string;
    updatedAt: string;
};

type SiteClass = {
    id: string;
    name: string;
};

type SeasonalRateFormData = {
    name: string;
    rateType: "nightly" | "weekly" | "monthly" | "seasonal";
    amount: string;
    minNights: string;
    startDate: string;
    endDate: string;
    siteClassId: string;
    isActive: boolean;
    paymentSchedule: PaymentSchedule;
    pricingStructure: PricingStructure;
    offseasonInterval: string;
    offseasonAmount: string;
    prorateExcess: boolean;
};

const defaultFormData: SeasonalRateFormData = {
    name: "",
    rateType: "nightly",
    amount: "",
    minNights: "",
    startDate: "",
    endDate: "",
    siteClassId: "",
    isActive: true,
    paymentSchedule: "single",
    pricingStructure: "per_night",
    offseasonInterval: "",
    offseasonAmount: "",
    prorateExcess: true
};

const paymentScheduleLabels: Record<PaymentSchedule, string> = {
    single: "Single Payment",
    weekly: "Weekly Payments",
    monthly: "Monthly Payments",
    as_you_stay: "Pay As You Stay",
    offseason_installments: "Offseason Installments"
};

const pricingStructureLabels: Record<PricingStructure, string> = {
    per_night: "Per Night",
    flat_week: "Flat Weekly Rate",
    flat_month: "Flat Monthly Rate",
    flat_season: "Flat Season Rate"
};

export default function SeasonalRatesSettingsPage() {
    const [rates, setRates] = useState<SeasonalRate[]>([]);
    const [siteClasses, setSiteClasses] = useState<SiteClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [campgroundId, setCampgroundId] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRate, setEditingRate] = useState<SeasonalRate | null>(null);
    const [formData, setFormData] = useState<SeasonalRateFormData>(defaultFormData);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filterSiteClass, setFilterSiteClass] = useState<string>("all");

    useEffect(() => {
        const cg = localStorage.getItem("campreserv:selectedCampground");
        setCampgroundId(cg);
        if (cg) {
            loadData(cg);
        }
    }, []);

    const loadData = async (cgId: string) => {
        setLoading(true);
        try {
            const [ratesData, classesData] = await Promise.all([
                apiClient.getSeasonalRates(cgId),
                apiClient.getSiteClasses(cgId)
            ]);
            setRates(ratesData);
            setSiteClasses(classesData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingRate(null);
        setFormData(defaultFormData);
        setError(null);
        setIsModalOpen(true);
    };

    const openEditModal = (rate: SeasonalRate) => {
        setEditingRate(rate);
        setFormData({
            name: rate.name,
            rateType: rate.rateType,
            amount: String(rate.amount / 100),
            minNights: rate.minNights !== null ? String(rate.minNights) : "",
            startDate: rate.startDate ? rate.startDate.split("T")[0] : "",
            endDate: rate.endDate ? rate.endDate.split("T")[0] : "",
            siteClassId: rate.siteClassId || "",
            isActive: rate.isActive,
            paymentSchedule: rate.paymentSchedule,
            pricingStructure: rate.pricingStructure,
            offseasonInterval: rate.offseasonInterval !== null ? String(rate.offseasonInterval) : "",
            offseasonAmount: rate.offseasonAmount !== null ? String(rate.offseasonAmount / 100) : "",
            prorateExcess: rate.prorateExcess
        });
        setError(null);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!campgroundId) return;
        if (!formData.name.trim()) {
            setError("Name is required");
            return;
        }
        if (!formData.amount || Number(formData.amount) <= 0) {
            setError("Amount must be greater than 0");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const payload = {
                name: formData.name.trim(),
                rateType: formData.rateType,
                amount: Math.round(Number(formData.amount) * 100),
                minNights: formData.minNights ? Number(formData.minNights) : undefined,
                startDate: formData.startDate || undefined,
                endDate: formData.endDate || undefined,
                siteClassId: formData.siteClassId || undefined,
                isActive: formData.isActive,
                paymentSchedule: formData.paymentSchedule,
                pricingStructure: formData.pricingStructure,
                offseasonInterval: formData.offseasonInterval ? Number(formData.offseasonInterval) : undefined,
                offseasonAmount: formData.offseasonAmount ? Math.round(Number(formData.offseasonAmount) * 100) : undefined,
                prorateExcess: formData.prorateExcess
            };

            if (editingRate) {
                await apiClient.updateSeasonalRate(editingRate.id, payload);
            } else {
                await apiClient.createSeasonalRate({ campgroundId, ...payload });
            }
            setIsModalOpen(false);
            loadData(campgroundId);
        } catch (err: any) {
            setError(err.message || "Failed to save seasonal rate");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this seasonal rate?")) return;
        try {
            await apiClient.deleteSeasonalRate(id);
            if (campgroundId) loadData(campgroundId);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleActive = async (rate: SeasonalRate) => {
        try {
            await apiClient.updateSeasonalRate(rate.id, { isActive: !rate.isActive });
            if (campgroundId) loadData(campgroundId);
        } catch (err) {
            console.error(err);
        }
    };

    const formatAmount = (amount: number) => {
        return `$${(amount / 100).toFixed(2)}`;
    };

    const getRateTypeIcon = (type: string) => {
        switch (type) {
            case "nightly": return <Moon className="h-5 w-5" />;
            case "weekly": return <Calendar className="h-5 w-5" />;
            case "monthly": return <CalendarRange className="h-5 w-5" />;
            case "seasonal": return <Sun className="h-5 w-5" />;
            default: return null;
        }
    };

    const getRateTypeColor = (type: string) => {
        switch (type) {
            case "nightly": return "bg-indigo-100 text-indigo-600";
            case "weekly": return "bg-blue-100 text-blue-600";
            case "monthly": return "bg-teal-100 text-teal-600";
            case "seasonal": return "bg-amber-100 text-amber-600";
            default: return "bg-slate-100 text-slate-600";
        }
    };

    const getRateTypeLabel = (type: string) => {
        switch (type) {
            case "nightly": return "Nightly";
            case "weekly": return "Weekly";
            case "monthly": return "Monthly";
            case "seasonal": return "Seasonal";
            default: return type;
        }
    };

    const getSiteClassName = (siteClassId: string | null) => {
        if (!siteClassId) return "All Site Classes";
        const sc = siteClasses.find(c => c.id === siteClassId);
        return sc?.name || "Unknown";
    };

    const filteredRates = filterSiteClass === "all"
        ? rates
        : rates.filter(r => r.siteClassId === filterSiteClass || (filterSiteClass === "none" && !r.siteClassId));

    if (!campgroundId) {
        return (
            <DashboardShell>
                <div className="text-center py-12 text-muted-foreground">
                    Please select a campground first.
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="font-semibold">Heads up: pricing is consolidating</div>
                    <p className="mt-1">
                        Use <a href="/settings/pricing-rules" className="underline font-semibold">Pricing Rules</a> for new dynamic/seasonal adjustments.
                        This page remains for existing seasonal rates and will be retired after migration.
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Seasonal Rates</h1>
                        <p className="text-muted-foreground">Configure rate schedules, payment plans, and pricing structures.</p>
                    </div>
                    <Button onClick={openCreateModal}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Rate
                    </Button>
                </div>

                {siteClasses.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Filter by Site Class:</Label>
                        <Select value={filterSiteClass} onValueChange={setFilterSiteClass}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Rates</SelectItem>
                                <SelectItem value="none">All Site Classes</SelectItem>
                                {siteClasses.map(sc => (
                                    <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : rates.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="font-semibold text-lg mb-2">No seasonal rates configured</h3>
                            <p className="text-muted-foreground mb-4">
                                Create seasonal rates to offer different pricing for various seasons and stay lengths.
                            </p>
                            <Button onClick={openCreateModal}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Rate
                            </Button>
                        </CardContent>
                    </Card>
                ) : filteredRates.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">No rates match the selected filter.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {filteredRates.map((rate) => (
                            <Card key={rate.id} className={!rate.isActive ? "opacity-60" : ""}>
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-lg ${getRateTypeColor(rate.rateType)}`}>
                                                {getRateTypeIcon(rate.rateType)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-lg">{rate.name}</span>
                                                    <Badge variant={rate.isActive ? "default" : "secondary"}>
                                                        {rate.isActive ? "Active" : "Inactive"}
                                                    </Badge>
                                                    <Badge variant="outline">
                                                        {getRateTypeLabel(rate.rateType)}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1 space-x-2">
                                                    <span className="font-semibold text-foreground">{formatAmount(rate.amount)}</span>
                                                    <span>•</span>
                                                    <span>{getSiteClassName(rate.siteClassId)}</span>
                                                    {rate.minNights && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Min {rate.minNights} nights</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                                                        <CreditCard className="h-3 w-3" />
                                                        {paymentScheduleLabels[rate.paymentSchedule]}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-slate-100 px-2 py-1 rounded">
                                                        <Repeat className="h-3 w-3" />
                                                        {pricingStructureLabels[rate.pricingStructure]}
                                                    </div>
                                                    {rate.prorateExcess && (
                                                        <Badge variant="outline" className="text-xs">Prorate</Badge>
                                                    )}
                                                </div>
                                                {(rate.startDate || rate.endDate) && (
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {rate.startDate && format(new Date(rate.startDate), "MMM d, yyyy")}
                                                        {rate.startDate && rate.endDate && " - "}
                                                        {rate.endDate && format(new Date(rate.endDate), "MMM d, yyyy")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={rate.isActive}
                                                onCheckedChange={() => toggleActive(rate)}
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => openEditModal(rate)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(rate.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRate ? "Edit Seasonal Rate" : "Create Seasonal Rate"}</DialogTitle>
                        <DialogDescription>
                            {editingRate ? "Update the rate details." : "Configure a new seasonal rate with payment and pricing options."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h4>
                            <div className="space-y-2">
                                <Label>Rate Name</Label>
                                <Input
                                    placeholder="e.g. Summer Peak, Winter Weekly"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Rate Type</Label>
                                    <Select
                                        value={formData.rateType}
                                        onValueChange={(val) => setFormData({ ...formData, rateType: val as any })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="nightly">Nightly</SelectItem>
                                            <SelectItem value="weekly">Weekly</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="seasonal">Seasonal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Amount ($)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="e.g. 75.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Site Class (Optional)</Label>
                                    <Select
                                        value={formData.siteClassId || "all"}
                                        onValueChange={(val) => setFormData({ ...formData, siteClassId: val === "all" ? "" : val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Site Classes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Site Classes</SelectItem>
                                            {siteClasses.map(sc => (
                                                <SelectItem key={sc.id} value={sc.id}>{sc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Min Nights (Optional)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 7"
                                        value={formData.minNights}
                                        onChange={(e) => setFormData({ ...formData, minNights: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date (Optional)</Label>
                                    <Input
                                        type="date"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date (Optional)</Label>
                                    <Input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment & Pricing */}
                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Payment & Pricing Structure</h4>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Payment Schedule</Label>
                                    <Select
                                        value={formData.paymentSchedule}
                                        onValueChange={(val) => setFormData({ ...formData, paymentSchedule: val as PaymentSchedule })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Single Payment (Upfront)</SelectItem>
                                            <SelectItem value="weekly">Weekly Payments</SelectItem>
                                            <SelectItem value="monthly">Monthly Payments</SelectItem>
                                            <SelectItem value="as_you_stay">Pay As You Stay</SelectItem>
                                            <SelectItem value="offseason_installments">Offseason Installments</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {formData.paymentSchedule === "single" && "Guest pays the full amount upfront"}
                                        {formData.paymentSchedule === "weekly" && "Guest pays weekly during their stay"}
                                        {formData.paymentSchedule === "monthly" && "Guest pays monthly during their stay"}
                                        {formData.paymentSchedule === "as_you_stay" && "Guest pays for upcoming period in advance"}
                                        {formData.paymentSchedule === "offseason_installments" && "Guest pays portions during off-season months"}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Pricing Structure</Label>
                                    <Select
                                        value={formData.pricingStructure}
                                        onValueChange={(val) => setFormData({ ...formData, pricingStructure: val as PricingStructure })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="per_night">Per Night (× nights)</SelectItem>
                                            <SelectItem value="flat_week">Flat Weekly Rate</SelectItem>
                                            <SelectItem value="flat_month">Flat Monthly Rate</SelectItem>
                                            <SelectItem value="flat_season">Flat Season Rate</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {formData.pricingStructure === "per_night" && "Standard rate × number of nights"}
                                        {formData.pricingStructure === "flat_week" && "One price for a full week"}
                                        {formData.pricingStructure === "flat_month" && "One price for a full month"}
                                        {formData.pricingStructure === "flat_season" && "One price for entire season"}
                                    </p>
                                </div>
                            </div>

                            {/* Offseason installments options */}
                            {formData.paymentSchedule === "offseason_installments" && (
                                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                                    <div className="space-y-2">
                                        <Label>Payment Interval (Months)</Label>
                                        <Select
                                            value={formData.offseasonInterval || "1"}
                                            onValueChange={(val) => setFormData({ ...formData, offseasonInterval: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">Every Month</SelectItem>
                                                <SelectItem value="2">Every 2 Months</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Amount Per Payment ($)</Label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="e.g. 500.00"
                                            value={formData.offseasonAmount}
                                            onChange={(e) => setFormData({ ...formData, offseasonAmount: e.target.value })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Prorate option for flat rates */}
                            {(formData.pricingStructure === "flat_week" || formData.pricingStructure === "flat_month") && (
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                                    <Switch
                                        id="prorate-excess"
                                        checked={formData.prorateExcess}
                                        onCheckedChange={(checked) => setFormData({ ...formData, prorateExcess: checked })}
                                    />
                                    <div>
                                        <Label htmlFor="prorate-excess" className="cursor-pointer">Prorate Excess Days</Label>
                                        <p className="text-xs text-muted-foreground">
                                            If stay is longer than the flat period, prorate additional days at the same rate
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center gap-2 pt-4 border-t">
                            <Switch
                                id="is-active"
                                checked={formData.isActive}
                                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                            />
                            <Label htmlFor="is-active">Active</Label>
                        </div>

                        {error && (
                            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DashboardShell>
    );
}
