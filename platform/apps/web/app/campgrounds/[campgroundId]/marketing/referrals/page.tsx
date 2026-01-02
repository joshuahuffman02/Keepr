"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    Megaphone,
    Gift,
    Link2,
    Percent,
    DollarSign,
    CreditCard,
    TrendingUp,
    Users,
    BarChart3,
    Copy,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    Sparkles,
    Plus,
    Pause,
    Play,
    RefreshCw,
    MessageSquare,
    Target,
    Zap
} from "lucide-react";

const SPRING_CONFIG = {
    type: "spring" as const,
    stiffness: 200,
    damping: 20,
};

type ReferralProgram = {
    id: string;
    code: string;
    linkSlug: string | null;
    source: string | null;
    channel: string | null;
    incentiveType: string;
    incentiveValue: number;
    isActive: boolean;
    notes: string | null;
};

type ReferralPerformance = {
    totalBookings?: number;
    totalRevenue?: number;
    totalRevenueCents?: number;
    totalReferralDiscountCents?: number;
    averageOrderValue?: number;
    conversionRate?: number;
    programs?: Array<{
        programId?: string;
        programCode?: string;
        bookings?: number;
        revenueCents?: number;
        discountCents?: number;
    }>;
};

type StayReasonData = {
    breakdown?: Array<{
        reason?: string;
        count?: number;
        percentage?: number;
    }>;
    total?: number;
    otherReasons?: string[];
};

export default function ReferralsPage() {
    const params = useParams();
    const campgroundId = params?.campgroundId as string;
    const queryClient = useQueryClient();

    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        code: "",
        linkSlug: "",
        source: "",
        channel: "",
        incentiveType: "percent_discount",
        incentiveValue: 10,
        isActive: true,
        notes: ""
    });

    const referralBaseUrl = useMemo(() => (typeof window !== "undefined" ? window.location.origin : "https://campeveryday.com"), []);
    const formatMoney = (cents: number | null | undefined) => `$${(((cents ?? 0) as number) / 100).toFixed(2)}`;

    // Queries
    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundId],
        queryFn: () => apiClient.getCampground(campgroundId),
        enabled: !!campgroundId
    });

    const programsQuery = useQuery({
        queryKey: ["referral-programs", campgroundId],
        queryFn: () => apiClient.listReferralPrograms(campgroundId),
        enabled: !!campgroundId
    });

    const performanceQuery = useQuery({
        queryKey: ["referral-performance", campgroundId],
        queryFn: () => apiClient.getReferralPerformance(campgroundId),
        enabled: !!campgroundId
    });

    const stayReasonQuery = useQuery({
        queryKey: ["stay-reasons", campgroundId],
        queryFn: () => apiClient.getStayReasonBreakdown(campgroundId),
        enabled: !!campgroundId
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: () => apiClient.createReferralProgram(campgroundId, {
            ...form,
            incentiveValue: Number(form.incentiveValue || 0)
        }),
        onSuccess: () => {
            setMessage({ type: "success", text: `Referral code "${form.code}" created! Share it to start earning referrals.` });
            setForm({
                code: "", linkSlug: "", source: "", channel: "",
                incentiveType: "percent_discount", incentiveValue: 10, isActive: true, notes: ""
            });
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["referral-programs", campgroundId] });
        },
        onError: (err: any) => setMessage({ type: "error", text: err?.message || "Failed to create program" })
    });

    const updateMutation = useMutation({
        mutationFn: (payload: { id: string; data: any }) => apiClient.updateReferralProgram(campgroundId, payload.id, payload.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["referral-programs", campgroundId] });
            setMessage({ type: "success", text: "Program updated!" });
        },
        onError: (err: any) => setMessage({ type: "error", text: err?.message || "Failed to update" })
    });

    const copyLink = (program: ReferralProgram) => {
        const url = program.linkSlug ? `${referralBaseUrl}/r/${program.linkSlug}` : `${referralBaseUrl}?ref=${program.code}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(program.id);
        setTimeout(() => setCopiedLink(null), 2000);
    };

    const cg = campgroundQuery.data;
    const programs = programsQuery.data ?? [];
    const performance = performanceQuery.data as ReferralPerformance | undefined;
    const stayReasons = stayReasonQuery.data as StayReasonData | undefined;

    const incentiveLabel = (type: string, value: number) => {
        if (type === "percent_discount") return `${value}% off`;
        return `${formatMoney(value)} ${type === "credit" ? "credit" : "off"}`;
    };

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
                            { label: "Marketing & Referrals" }
                        ]}
                    />
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Megaphone className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                                <h1 className="text-2xl font-bold text-foreground">Marketing & Referrals</h1>
                            </div>
                            <p className="text-muted-foreground">
                                Create referral codes, track performance, and understand why guests choose you
                            </p>
                        </div>
                        <Button
                            onClick={() => setShowForm(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            New Referral Code
                        </Button>
                    </div>
                </motion.div>

                {/* Message */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={cn(
                                "flex items-center gap-3 rounded-lg border px-4 py-3",
                                message.type === "success" && "bg-status-success/15 text-status-success",
                                message.type === "error" && "bg-status-error/15 text-status-error"
                            )}
                        >
                            {message.type === "success" ? <Sparkles className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                            <span className="text-sm font-medium flex-1">{message.text}</span>
                            <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100">
                                <XCircle className="h-4 w-4" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Performance Stats */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.05 }}
                    className="grid gap-4 sm:grid-cols-3"
                >
                    <Card className="border-border bg-card">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-info/15">
                                    <Users className="h-5 w-5 text-status-info" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">
                                        {performance?.totalBookings ?? 0}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Referral Bookings</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border bg-card">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">
                                        {formatMoney(performance?.totalRevenueCents ?? 0)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Referral Revenue</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-border bg-card">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                    <Gift className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-foreground">
                                        {formatMoney(performance?.totalReferralDiscountCents ?? 0)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">Discounts Given</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Create Form Modal */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            <Card className="border-emerald-200 dark:border-emerald-800 bg-card">
                                <CardHeader className="bg-status-success/10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                            <CardTitle className="text-foreground">Create Referral Code</CardTitle>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6 space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Code *</Label>
                                            <Input
                                                value={form.code}
                                                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                                placeholder="FRIEND10"
                                                className="uppercase"
                                            />
                                            <p className="text-xs text-muted-foreground">What guests will enter at checkout</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Link Slug (optional)</Label>
                                            <Input
                                                value={form.linkSlug}
                                                onChange={(e) => setForm({ ...form, linkSlug: e.target.value.toLowerCase().replace(/\s/g, "-") })}
                                                placeholder="summer-special"
                                            />
                                            {form.linkSlug && (
                                                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                    <Link2 className="h-3 w-3" />
                                                    {referralBaseUrl}/r/{form.linkSlug}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Incentive Type</Label>
                                            <Select value={form.incentiveType} onValueChange={(v) => setForm({ ...form, incentiveType: v })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="percent_discount">
                                                        <span className="flex items-center gap-2"><Percent className="h-4 w-4" /> Percent off</span>
                                                    </SelectItem>
                                                    <SelectItem value="amount_discount">
                                                        <span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Fixed amount off</span>
                                                    </SelectItem>
                                                    <SelectItem value="credit">
                                                        <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Account credit</span>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground">
                                                {form.incentiveType === "percent_discount" ? "Percent" : "Amount (cents)"}
                                            </Label>
                                            <Input
                                                type="number"
                                                value={form.incentiveValue}
                                                onChange={(e) => setForm({ ...form, incentiveValue: Number(e.target.value) })}
                                                min={0}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                {form.incentiveType === "percent_discount"
                                                    ? `${form.incentiveValue}% off their booking`
                                                    : `${formatMoney(form.incentiveValue)} off their booking`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Source</Label>
                                            <Input
                                                value={form.source}
                                                onChange={(e) => setForm({ ...form, source: e.target.value })}
                                                placeholder="friend, influencer, partner"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-foreground">Channel</Label>
                                            <Input
                                                value={form.channel}
                                                onChange={(e) => setForm({ ...form, channel: e.target.value })}
                                                placeholder="instagram, email, tiktok"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-foreground">Notes (internal)</Label>
                                        <Input
                                            value={form.notes}
                                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                            placeholder="Fall promo for affiliates"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex items-center gap-2">
                                            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
                                            <Label className="text-foreground">Active immediately</Label>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                                            <Button
                                                onClick={() => createMutation.mutate()}
                                                disabled={createMutation.isPending || !form.code.trim()}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            >
                                                {createMutation.isPending ? (
                                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                                                ) : (
                                                    <><Sparkles className="mr-2 h-4 w-4" /> Create Code</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Programs List */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.1 }}
                >
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <CardTitle className="text-foreground">Referral Programs</CardTitle>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ["referral-programs", campgroundId] })}
                                >
                                    <RefreshCw className={cn("h-4 w-4", programsQuery.isFetching && "animate-spin")} />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {programsQuery.isLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : programs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="rounded-full bg-muted p-4 mb-4">
                                        <Gift className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="font-medium text-foreground mb-1">Ready to earn referrals?</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                                        Create your first referral code and share it with friends, partners, or on social media.
                                    </p>
                                    <Button onClick={() => setShowForm(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Create First Code
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {programs.map((program, index) => (
                                        <motion.div
                                            key={program.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ ...SPRING_CONFIG, delay: index * 0.03 }}
                                            className={cn(
                                                "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border transition-colors",
                                                program.isActive
                                                    ? "border-border bg-background hover:bg-muted/50"
                                                    : "border-border bg-muted/30"
                                            )}
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className={cn(
                                                    "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                                                    program.isActive ? "bg-status-success/15" : "bg-muted"
                                                )}>
                                                    <Gift className={cn(
                                                        "h-5 w-5",
                                                        program.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                                    )} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono font-bold text-foreground">{program.code}</span>
                                                        <Badge variant="outline" className={cn(
                                                            "text-xs",
                                                            program.isActive
                                                                ? "bg-status-success/15 text-status-success"
                                                                : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {program.isActive ? "Active" : "Paused"}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {incentiveLabel(program.incentiveType, program.incentiveValue)}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                                                        {program.linkSlug && (
                                                            <span className="flex items-center gap-1">
                                                                <Link2 className="h-3 w-3" />
                                                                /r/{program.linkSlug}
                                                            </span>
                                                        )}
                                                        {program.source && <span>{program.source}</span>}
                                                        {program.channel && <span>via {program.channel}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => copyLink(program)}
                                                >
                                                    {copiedLink === program.id ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => updateMutation.mutate({
                                                        id: program.id,
                                                        data: { isActive: !program.isActive }
                                                    })}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    {program.isActive ? (
                                                        <><Pause className="mr-1 h-3 w-3" /> Pause</>
                                                    ) : (
                                                        <><Play className="mr-1 h-3 w-3" /> Activate</>
                                                    )}
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Performance by Program */}
                {(performance?.programs?.length ?? 0) > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING_CONFIG, delay: 0.15 }}
                    >
                        <Card className="border-border bg-card">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <CardTitle className="text-foreground">Performance by Program</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border">
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Code</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Bookings</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Revenue</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Discounts</th>
                                                <th className="text-left py-3 px-2 font-medium text-muted-foreground">Source</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {performance?.programs?.map((p: any, i: number) => (
                                                <tr key={`${p.programId}-${i}`} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                                                    <td className="py-3 px-2 font-mono font-medium text-foreground">{p.code || "Unknown"}</td>
                                                    <td className="py-3 px-2 text-foreground">{p.bookings}</td>
                                                    <td className="py-3 px-2 text-foreground">{formatMoney(p.revenueCents)}</td>
                                                    <td className="py-3 px-2 text-foreground">{formatMoney(p.referralDiscountCents)}</td>
                                                    <td className="py-3 px-2 text-muted-foreground">
                                                        {p.source || "–"}{p.channel ? ` / ${p.channel}` : ""}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Stay Reasons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CONFIG, delay: 0.2 }}
                >
                    <Card className="border-border bg-card">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                <div>
                                    <CardTitle className="text-foreground">Why Guests Choose You</CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        Responses from guest surveys about their stay reasons
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {stayReasonQuery.isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : (stayReasons?.breakdown?.length ?? 0) === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p className="text-sm">No stay reason data yet</p>
                                    <p className="text-xs mt-1">Responses will appear as guests complete surveys</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid gap-2">
                                        {stayReasons?.breakdown?.map((r: any, i: number) => (
                                            <div key={r.reason} className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-medium text-foreground">{r.reason}</span>
                                                        <span className="text-sm text-muted-foreground">{r.count}</span>
                                                    </div>
                                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(100, (r.count / Math.max(...(stayReasons?.breakdown ?? []).map((b: { count?: number }) => b.count ?? 0), 1)) * 100)}%` }}
                                                            transition={{ ...SPRING_CONFIG, delay: i * 0.05 }}
                                                            className="h-full bg-status-success rounded-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {(stayReasons?.otherReasons?.length ?? 0) > 0 && (
                                        <div className="pt-4 border-t border-border">
                                            <h4 className="text-sm font-medium text-foreground mb-2">"Other" responses</h4>
                                            <ul className="space-y-1">
                                                {stayReasons?.otherReasons?.map((note: string, idx: number) => (
                                                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                                        <span className="text-muted-foreground/50">•</span>
                                                        {note}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </DashboardShell>
    );
}
