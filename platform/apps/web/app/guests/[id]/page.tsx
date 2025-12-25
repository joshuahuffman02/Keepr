"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../components/breadcrumbs";
import { apiClient } from "../../../lib/api-client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Badge } from "../../../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Trophy, Star, History, ArrowLeft, Trash2, Plus, Car, Truck, Mail, MessageSquare, GitBranch, RotateCcw, PlusCircle, Send, Wallet, DollarSign } from "lucide-react";
import { cn } from "../../../lib/utils";
import { useToast } from "../../../components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useInfiniteQuery } from "@tanstack/react-query";

const TIER_COLORS: Record<string, string> = {
    Bronze: "bg-amber-600",
    Silver: "bg-slate-400",
    Gold: "bg-yellow-500",
    Platinum: "bg-gradient-to-r from-slate-300 to-slate-500"
};

export default function GuestDetailPage() {
    const params = useParams();
    const router = useRouter();
    const guestId = params.id as string;
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch Guest Data
    // Note: We might need a getGuest(id) method, but currently we only have getGuests().
    // Let's check if we can filter or if we need to add getGuest(id).
    // The current apiClient has getGuests() which returns all guests.
    // Ideally we should have getGuest(id).
    // For now, I'll use getGuests and find the guest, but I should probably add getGuest(id) to API client if it exists in backend.
    // Backend has `Get('guests/:guestId')` in LoyaltyController but that's for loyalty profile.
    // There is likely a GuestsController.
    // Let's assume for now we can use getGuests() and filter client side, or better, add getGuest to apiClient if the backend supports it.
    // Looking at apiClient.ts, there is `updateGuest` which takes ID.
    // There is `deleteGuest`.
    // There is `getGuests`.
    // Let's check if there is a `getGuest` in backend.
    // I'll assume for now I can just use getGuests() and find it, to avoid blocking.
    // Wait, `getLoyaltyProfile` is available.

    const guestQuery = useQuery({
        queryKey: ["guest", guestId],
        queryFn: () => apiClient.getGuest(guestId)
    });

    const loyaltyQuery = useQuery({
        queryKey: ["loyalty", guestId],
        queryFn: () => apiClient.getLoyaltyProfile(guestId)
    });

    const [commTypeFilter, setCommTypeFilter] = useState<string>("all");
    const [commDirectionFilter, setCommDirectionFilter] = useState<string>("all");
    const [commStatusFilter, setCommStatusFilter] = useState<string>("all");
    const [composeType, setComposeType] = useState<"email" | "sms" | "note" | "call">("email");
    const [composeDirection, setComposeDirection] = useState<"inbound" | "outbound">("outbound");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [composeTo, setComposeTo] = useState("");
    const [composeFrom, setComposeFrom] = useState("");

    const campgroundIdForGuest = useMemo(
        () => (guestQuery.data as any)?.campgroundId || (guestQuery.data as any)?.campgrounds?.[0]?.id || "",
        [guestQuery.data]
    );

    // Wallet state and queries
    const [addCreditOpen, setAddCreditOpen] = useState(false);
    const [creditAmount, setCreditAmount] = useState("");
    const [creditReason, setCreditReason] = useState("");
    const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
    const [creditScopeType, setCreditScopeType] = useState<"campground" | "organization" | "global">("campground");

    const walletsQuery = useQuery({
        queryKey: ["wallets", campgroundIdForGuest, guestId],
        queryFn: () => apiClient.getGuestWalletsForCampground(campgroundIdForGuest, guestId),
        enabled: !!campgroundIdForGuest && !!guestId
    });

    const wallets = walletsQuery.data ?? [];
    const selectedWallet = useMemo(
        () => wallets.find((wallet) => wallet.walletId === selectedWalletId) ?? wallets[0],
        [wallets, selectedWalletId]
    );
    const selectedBalanceCents = selectedWallet?.balanceCents ?? 0;
    const selectedAvailableCents = selectedWallet?.availableCents ?? 0;
    const walletScopeLabel = (wallet: { scopeType: string; campgroundName?: string }) => {
        if (wallet.scopeType === "organization") return `Portfolio${wallet.campgroundName ? ` · ${wallet.campgroundName}` : ""}`;
        if (wallet.scopeType === "global") return "Global wallet";
        return `Campground${wallet.campgroundName ? ` · ${wallet.campgroundName}` : ""}`;
    };

    useEffect(() => {
        if (!wallets.length) {
            setSelectedWalletId(null);
            return;
        }
        if (!selectedWalletId || !wallets.some((wallet) => wallet.walletId === selectedWalletId)) {
            setSelectedWalletId(wallets[0].walletId);
        }
    }, [selectedWalletId, wallets]);

    useEffect(() => {
        if (selectedWallet?.scopeType) {
            setCreditScopeType(selectedWallet.scopeType);
        }
    }, [selectedWallet?.walletId, selectedWallet?.scopeType]);

    const walletTransactionsQuery = useQuery({
        queryKey: ["wallet-transactions", campgroundIdForGuest, guestId, selectedWallet?.walletId],
        queryFn: () =>
            apiClient.getWalletTransactions(campgroundIdForGuest, guestId, 20, 0, selectedWallet?.walletId),
        enabled: !!campgroundIdForGuest && !!guestId && !!selectedWallet?.walletId
    });

    const addCreditMutation = useMutation({
        mutationFn: (data: { amountCents: number; reason?: string; scopeType: "campground" | "organization" | "global"; scopeId?: string }) =>
            apiClient.addWalletCredit(campgroundIdForGuest, guestId, data.amountCents, data.reason, data.scopeType, data.scopeId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["wallets", campgroundIdForGuest, guestId] });
            queryClient.invalidateQueries({ queryKey: ["wallet-transactions", campgroundIdForGuest, guestId] });
            setAddCreditOpen(false);
            setCreditAmount("");
            setCreditReason("");
            toast({ title: "Credit added", description: "Wallet credit has been added successfully." });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: error.message || "Failed to add credit", variant: "destructive" });
        }
    });

    type CommunicationsPage = { items: any[]; nextCursor?: string | null };
    const campgroundQuery = useQuery({
        queryKey: ["campground", campgroundIdForGuest],
        queryFn: () => apiClient.getCampground(campgroundIdForGuest),
        enabled: !!campgroundIdForGuest
    });
    const organizationId = campgroundQuery.data?.organizationId;
    const SLA_MINUTES = campgroundQuery.data?.slaMinutes ?? Number(process.env.NEXT_PUBLIC_SLA_MINUTES || 30);

    const commsQuery = useInfiniteQuery<CommunicationsPage>({
        queryKey: ["communications", "guest", guestId, commTypeFilter, commDirectionFilter],
        queryFn: ({ pageParam }) =>
            apiClient.listCommunications({
                campgroundId: campgroundIdForGuest,
                guestId: guestId,
                limit: 20,
                type: ["email", "sms", "note", "call"].includes(commTypeFilter) ? commTypeFilter : undefined,
                direction: commDirectionFilter === "all" ? undefined : commDirectionFilter,
                cursor: pageParam as string | undefined
            }),
        enabled: !!guestId && !!campgroundIdForGuest,
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined
    });

    const commItems = commsQuery.data?.pages?.flatMap((p: any) => p.items) ?? [];
    const overdueCount = commItems.filter((c: any) => {
        const createdDate = c.createdAt ? new Date(c.createdAt) : null;
        const minutesSince = createdDate ? (Date.now() - createdDate.getTime()) / 60000 : 0;
        const isInboundPending = c.direction === "inbound" && !(c.status || "").startsWith("delivered") && (c.status || "") !== "sent" && (c.status || "") !== "failed";
        return isInboundPending && minutesSince > SLA_MINUTES;
    }).length;

    const playbookJobsQuery = useQuery({
        queryKey: ["communications", "playbook-jobs", campgroundIdForGuest],
        queryFn: () => apiClient.listPlaybookJobs(campgroundIdForGuest),
        enabled: !!campgroundIdForGuest
    });

    const playbooksQuery = useQuery({
        queryKey: ["communications", "playbooks", campgroundIdForGuest],
        queryFn: () => apiClient.listPlaybooks(campgroundIdForGuest),
        enabled: !!campgroundIdForGuest
    });

    const playbookNameById = useMemo(() => {
        const map: Record<string, string> = {};
        (playbooksQuery.data || []).forEach((p: any) => {
            map[p.id] = p.name || p.type || "Playbook";
        });
        return map;
    }, [playbooksQuery.data]);

    const statusTone = (status?: string | null) => {
        const normalized = (status || "").toLowerCase();
        if (normalized.includes("complaint") || normalized.includes("bounce") || normalized.includes("fail")) {
            return "bg-red-100 text-red-700 border border-red-200";
        }
        if (normalized.startsWith("delivered") || normalized === "sent" || normalized === "received") {
            return "bg-emerald-100 text-emerald-700 border border-emerald-200";
        }
        if (normalized.includes("pending") || normalized.includes("processing")) {
            return "bg-amber-100 text-amber-800 border border-amber-200";
        }
        return "bg-slate-100 text-slate-700 border border-slate-200";
    };

    const timelineItems = useMemo(() => {
        const normalizedStatus = commStatusFilter.toLowerCase();
        const comms = commItems
            .filter((c: any) => ["email", "sms"].includes(c.type))
            .filter((c: any) => (commTypeFilter === "all" || commTypeFilter === "automation" ? true : c.type === commTypeFilter))
            .filter((c: any) => (commStatusFilter === "all" ? true : (c.status || "").toLowerCase().includes(normalizedStatus)))
            .map((c: any) => ({
                kind: "communication" as const,
                id: c.id,
                date: c.createdAt,
                type: c.type,
                direction: c.direction,
                subject: c.subject,
                body: c.preview || c.body,
                status: c.status,
                provider: c.provider,
                toAddress: c.toAddress,
                fromAddress: c.fromAddress
            }));

        const jobs = (playbookJobsQuery.data || [])
            .filter((job: any) => !guestId || job.guestId === guestId)
            .filter((job: any) => commStatusFilter === "all" ? true : (job.status || "").toLowerCase().includes(normalizedStatus))
            .filter((job: any) => commTypeFilter === "all" || commTypeFilter === "automation")
            .map((job: any) => ({
                kind: "playbook" as const,
                id: job.id,
                date: job.updatedAt || job.scheduledAt || job.createdAt,
                status: job.status,
                name: playbookNameById[job.playbookId] || "Playbook step",
                attempts: job.attempts,
                lastError: job.lastError
            }));

        return [...comms, ...jobs].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    }, [commItems, commStatusFilter, commTypeFilter, guestId, playbookJobsQuery.data, playbookNameById]);

    const retryPlaybookMutation = useMutation({
        mutationFn: async (jobId: string) => {
            return apiClient.retryPlaybookJob(jobId, campgroundIdForGuest);
        },
        onSuccess: () => {
            playbookJobsQuery.refetch();
            toast({ title: "Retry queued" });
        },
        onError: () => {
            toast({ title: "Retry failed", variant: "destructive" });
        }
    });

    const [adjustPointsOpen, setAdjustPointsOpen] = useState(false);
    const [adjustAmount, setAdjustAmount] = useState("");
    const [adjustReason, setAdjustReason] = useState("");
    const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");

    const adjustPointsMutation = useMutation({
        mutationFn: async () => {
            const amount = parseInt(adjustAmount);
            if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");
            const finalAmount = adjustType === "add" ? amount : -amount;
            return apiClient.awardPoints(guestId, finalAmount, adjustReason);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["loyalty", guestId] });
            setAdjustPointsOpen(false);
            setAdjustAmount("");
            setAdjustReason("");
            toast({ title: "Points updated successfully" });
        },
        onError: () => {
            toast({ title: "Failed to update points", variant: "destructive" });
        }
    });

    const guest = guestQuery.data;
    const formsQuery = useQuery({
        queryKey: ["form-submissions-guest", guestId],
        queryFn: () => apiClient.getFormSubmissionsByGuest(guestId),
    });

    if (guestQuery.isLoading) {
        return (
            <DashboardShell>
                <div className="flex items-center justify-center h-96">Loading guest details...</div>
            </DashboardShell>
        );
    }

    if (!guest) {
        return (
            <DashboardShell>
                <div className="flex flex-col items-center justify-center h-96 gap-4">
                    <div className="text-lg text-slate-500">Guest not found</div>
                    <Button onClick={() => router.push("/guests")}>Back to Guests</Button>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <div className="space-y-6">
                <Breadcrumbs items={[{ label: "Guests", href: "/guests" }, { label: `${guest.primaryFirstName} ${guest.primaryLastName}` }]} />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/guests")}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{guest.primaryFirstName} {guest.primaryLastName}</h1>
                            <div className="text-sm text-slate-500">{guest.email} • {guest.phone}</div>
                        </div>
                    </div>
                    {guest.reservations?.[0] && (
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => router.push(`/booking?guestId=${guest.id}`)}
                        >
                            <History className="h-4 w-4" />
                            Rebook Last Trip
                        </Button>
                    )}
                </div>

                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="equipment">Equipment</TabsTrigger>
                        <TabsTrigger value="wallet">Wallet</TabsTrigger>
                        <TabsTrigger value="loyalty">Loyalty & Rewards</TabsTrigger>
                        <TabsTrigger value="communications">Communications</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Guest Information</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-slate-500">Full Name</Label>
                                    <div className="font-medium">{guest.primaryFirstName} {guest.primaryLastName}</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500">Email</Label>
                                    <div className="font-medium">{guest.email}</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500">Phone</Label>
                                    <div className="font-medium">{guest.phone}</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-slate-500">Address</Label>
                                    <div className="font-medium">
                                        {guest.address1}
                                        {guest.address2 && <>, {guest.address2}</>}
                                        <br />
                                        {guest.city}, {guest.state} {guest.postalCode}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex items-center justify-between">
                                <CardTitle>Forms</CardTitle>
                                {formsQuery.isLoading ? (
                                    <span className="text-xs text-slate-500">Loading…</span>
                                ) : (
                                    <Badge variant={(formsQuery.data || []).some((f: any) => f.status === "pending") ? "destructive" : "secondary"}>
                                        {(formsQuery.data || []).filter((f: any) => f.status === "pending").length} pending
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {formsQuery.isError && <div className="text-xs text-red-600">Failed to load forms.</div>}
                                {!formsQuery.isLoading && (formsQuery.data || []).length === 0 && (
                                    <div className="text-xs text-slate-500">No forms for this guest.</div>
                                )}
                                <div className="space-y-1">
                                    {(formsQuery.data || []).map((f: any) => (
                                        <div key={f.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1">
                                            <div>
                                                <div className="font-medium text-slate-900 text-sm">{f.formTemplate?.title || "Form"}</div>
                                                <div className="text-xs text-slate-500">{f.formTemplate?.type}</div>
                                            </div>
                                            <Badge variant={f.status === "completed" ? "default" : f.status === "pending" ? "destructive" : "secondary"}>
                                                {f.status}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="equipment" className="space-y-4">
                        <GuestEquipmentTab guestId={guestId} />
                    </TabsContent>

                    <TabsContent value="wallet" className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
                            <div>
                                <div className="text-sm font-medium">Wallet scope</div>
                                <div className="text-xs text-muted-foreground">Choose which wallet to view or apply.</div>
                            </div>
                            <Select value={selectedWalletId ?? ""} onValueChange={setSelectedWalletId}>
                                <SelectTrigger className="w-[220px]" disabled={!wallets.length}>
                                    <SelectValue placeholder={wallets.length ? "Select wallet" : "No wallets yet"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {wallets.map((wallet) => (
                                        <SelectItem key={wallet.walletId} value={wallet.walletId}>
                                            {walletScopeLabel(wallet)} · ${(wallet.balanceCents / 100).toFixed(2)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
                                    <Wallet className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        ${(selectedBalanceCents / 100).toFixed(2)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {selectedWallet ? walletScopeLabel(selectedWallet) : "Available for purchases"}
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Available</CardTitle>
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        ${(selectedAvailableCents / 100).toFixed(2)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        After pending holds
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Transaction History</CardTitle>
                                    <CardDescription>Recent wallet activity for this guest</CardDescription>
                                </div>
                                <Dialog open={addCreditOpen} onOpenChange={setAddCreditOpen}>
                                    <DialogTrigger asChild>
                                        <Button>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Credit
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Add Wallet Credit</DialogTitle>
                                            <DialogDescription>
                                                Add credit to this guest&apos;s wallet. This can be used for POS purchases or reservation payments.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="credit-amount" className="text-right">
                                                    Amount
                                                </Label>
                                                <div className="col-span-3 relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                                    <Input
                                                        id="credit-amount"
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={creditAmount}
                                                        onChange={(e) => setCreditAmount(e.target.value)}
                                                        className="pl-7"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="credit-reason" className="text-right">
                                                    Reason
                                                </Label>
                                                <Input
                                                    id="credit-reason"
                                                    value={creditReason}
                                                    onChange={(e) => setCreditReason(e.target.value)}
                                                    className="col-span-3"
                                                    placeholder="e.g. Grandparent gift, Goodwill credit"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label className="text-right">Scope</Label>
                                                <div className="col-span-3">
                                                    <Select value={creditScopeType} onValueChange={(value) => setCreditScopeType(value as "campground" | "organization" | "global")}>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select scope" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="campground">This campground</SelectItem>
                                                            {organizationId && <SelectItem value="organization">Portfolio (all campgrounds)</SelectItem>}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setAddCreditOpen(false)}>
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={() => {
                                                    const amountCents = Math.round(parseFloat(creditAmount) * 100);
                                                    if (isNaN(amountCents) || amountCents <= 0) {
                                                        toast({ title: "Invalid amount", variant: "destructive" });
                                                        return;
                                                    }
                                                    if (creditScopeType === "organization" && !organizationId) {
                                                        toast({ title: "Organization required", variant: "destructive" });
                                                        return;
                                                    }
                                                    const scopeId =
                                                        creditScopeType === "organization"
                                                            ? organizationId
                                                            : creditScopeType === "campground"
                                                            ? campgroundIdForGuest
                                                            : undefined;
                                                    addCreditMutation.mutate({
                                                        amountCents,
                                                        reason: creditReason || undefined,
                                                        scopeType: creditScopeType,
                                                        scopeId: scopeId || undefined
                                                    });
                                                }}
                                                disabled={addCreditMutation.isPending}
                                            >
                                                {addCreditMutation.isPending ? "Adding..." : "Add Credit"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                {walletTransactionsQuery.isLoading ? (
                                    <div className="text-center py-4 text-muted-foreground">Loading transactions...</div>
                                ) : walletTransactionsQuery.data?.transactions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>No wallet transactions yet</p>
                                        <p className="text-sm">Add credit to get started</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead>Reason</TableHead>
                                                <TableHead className="text-right">Amount</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {walletTransactionsQuery.data?.transactions.map((tx) => (
                                                <TableRow key={tx.id}>
                                                    <TableCell className="text-muted-foreground">
                                                        {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            tx.direction === "issue" || tx.direction === "refund" ? "default" :
                                                            tx.direction === "redeem" ? "secondary" : "outline"
                                                        }>
                                                            {tx.direction}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{tx.reason || tx.referenceType}</TableCell>
                                                    <TableCell className={cn(
                                                        "text-right font-medium",
                                                        tx.direction === "issue" || tx.direction === "refund" ? "text-green-600" : "text-red-600"
                                                    )}>
                                                        {tx.direction === "issue" || tx.direction === "refund" ? "+" : "-"}
                                                        ${(tx.amountCents / 100).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        ${(tx.afterBalanceCents / 100).toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="loyalty" className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Current Tier</CardTitle>
                                    <Trophy className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{loyaltyQuery.data?.tier || "Bronze"}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Based on lifetime points
                                    </p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Points Balance</CardTitle>
                                    <Star className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{loyaltyQuery.data?.pointsBalance.toLocaleString() || 0}</div>
                                    <p className="text-xs text-muted-foreground">
                                        Available to redeem
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Transaction History</CardTitle>
                                    <CardDescription>Recent points activity for this guest</CardDescription>
                                </div>
                                <Dialog open={adjustPointsOpen} onOpenChange={setAdjustPointsOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline">Adjust Points</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Adjust Loyalty Points</DialogTitle>
                                            <DialogDescription>
                                                Manually add or deduct points for this guest.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label className="text-right">Action</Label>
                                                <div className="col-span-3 flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant={adjustType === "add" ? "default" : "outline"}
                                                        onClick={() => setAdjustType("add")}
                                                        className="flex-1"
                                                    >
                                                        Add
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant={adjustType === "deduct" ? "default" : "outline"}
                                                        onClick={() => setAdjustType("deduct")}
                                                        className={cn("flex-1", adjustType === "deduct" && "bg-red-600 hover:bg-red-700")}
                                                    >
                                                        Deduct
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="amount" className="text-right">
                                                    Amount
                                                </Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    value={adjustAmount}
                                                    onChange={(e) => setAdjustAmount(e.target.value)}
                                                    className="col-span-3"
                                                    placeholder="e.g. 500"
                                                />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="reason" className="text-right">
                                                    Reason
                                                </Label>
                                                <Input
                                                    id="reason"
                                                    value={adjustReason}
                                                    onChange={(e) => setAdjustReason(e.target.value)}
                                                    className="col-span-3"
                                                    placeholder="e.g. Manual adjustment, Bonus"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="ghost" onClick={() => setAdjustPointsOpen(false)}>Cancel</Button>
                                            <Button onClick={() => adjustPointsMutation.mutate()} disabled={adjustPointsMutation.isPending || !adjustAmount || !adjustReason}>
                                                {adjustPointsMutation.isPending ? "Saving..." : "Save Adjustment"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loyaltyQuery.data?.transactions?.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{new Date(tx.createdAt).toLocaleDateString()}</TableCell>
                                                <TableCell>{tx.reason}</TableCell>
                                                <TableCell className={cn("text-right font-medium", tx.amount > 0 ? "text-emerald-600" : "text-red-600")}>
                                                    {tx.amount > 0 ? "+" : ""}{tx.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {(!loyaltyQuery.data?.transactions || loyaltyQuery.data.transactions.length === 0) && (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                                    No transactions found
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="communications" className="space-y-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <CardTitle>Communications</CardTitle>
                                    {overdueCount > 0 && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                            {overdueCount} need reply
                                        </span>
                                    )}
                                </div>
                                <CardDescription>Last 20 messages for this guest</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Quick Filters */}
                                <div className="flex flex-wrap gap-2 text-sm">
                                    <Button
                                        size="sm"
                                        variant={commTypeFilter === "email" && commDirectionFilter === "outbound" ? "secondary" : "outline"}
                                        onClick={() => {
                                            setCommTypeFilter("email");
                                            setCommDirectionFilter("outbound");
                                            commsQuery.refetch();
                                        }}
                                        className="gap-1"
                                    >
                                        <Send className="h-3 w-3" />
                                        Sent Emails
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={commTypeFilter === "all" && commDirectionFilter === "all" ? "secondary" : "outline"}
                                        onClick={() => {
                                            setCommTypeFilter("all");
                                            setCommDirectionFilter("all");
                                            commsQuery.refetch();
                                        }}
                                    >
                                        All Communications
                                    </Button>
                                </div>

                                {/* Filters */}
                                <div className="flex flex-wrap gap-3 text-sm">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Type</Label>
                                        <select
                                            className="h-9 rounded border border-slate-200 bg-white px-2 text-sm"
                                            value={commTypeFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setCommTypeFilter(value);
                                                queryClient.removeQueries({
                                                    queryKey: ["communications", "guest", guestId, commDirectionFilter]
                                                });
                                                commsQuery.refetch();
                                            }}
                                        >
                                            <option value="all">All</option>
                                            <option value="email">Email</option>
                                            <option value="sms">SMS</option>
                                            <option value="automation">Automation</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Status</Label>
                                        <select
                                            className="h-9 rounded border border-slate-200 bg-white px-2 text-sm"
                                            value={commStatusFilter}
                                            onChange={(e) => setCommStatusFilter(e.target.value)}
                                        >
                                            <option value="all">All</option>
                                            <option value="sent">Sent</option>
                                            <option value="delivered">Delivered</option>
                                            <option value="pending">Pending</option>
                                            <option value="failed">Failed</option>
                                            <option value="bounce">Bounced</option>
                                            <option value="complaint">Complaint</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Direction</Label>
                                        <select
                                            className="h-9 rounded border border-slate-200 bg-white px-2 text-sm"
                                            value={commDirectionFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setCommDirectionFilter(value);
                                                queryClient.removeQueries({
                                                    queryKey: ["communications", "guest", guestId, commTypeFilter]
                                                });
                                                commsQuery.refetch();
                                            }}
                                        >
                                            <option value="all">All</option>
                                            <option value="outbound">Outbound</option>
                                            <option value="inbound">Inbound</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Collapsible Log Communication Form */}
                                <details className="group">
                                    <summary className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-slate-800 py-2 border-t border-slate-100 mt-2">
                                        <PlusCircle className="h-4 w-4" />
                                        <span>Log Communication</span>
                                    </summary>
                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Type</Label>
                                                <select
                                                    className="w-full h-9 rounded border border-slate-200 bg-white px-2 text-sm"
                                                    value={composeType}
                                                    onChange={(e) => setComposeType(e.target.value as any)}
                                                >
                                                    <option value="email">Email</option>
                                                    <option value="sms">SMS</option>
                                                    <option value="note">Note</option>
                                                    <option value="call">Call</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Direction</Label>
                                                <select
                                                    className="w-full h-9 rounded border border-slate-200 bg-white px-2 text-sm"
                                                    value={composeDirection}
                                                    onChange={(e) => setComposeDirection(e.target.value as any)}
                                                >
                                                    <option value="outbound">Outbound</option>
                                                    <option value="inbound">Inbound</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Subject (optional)</Label>
                                            <Input
                                                value={composeSubject}
                                                onChange={(e) => setComposeSubject(e.target.value)}
                                                placeholder="Subject"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Body</Label>
                                            <textarea
                                                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm min-h-[80px]"
                                                value={composeBody}
                                                onChange={(e) => setComposeBody(e.target.value)}
                                                placeholder="Log the message content"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-xs">To</Label>
                                                <Input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="email or phone" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">From</Label>
                                                <Input value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)} placeholder="email or phone" />
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={async () => {
                                                if (!campgroundIdForGuest) return;
                                                if (!composeBody.trim()) {
                                                    return toast({ title: "Body required", variant: "destructive" });
                                                }
                                                await apiClient.createCommunication({
                                                    campgroundId: campgroundIdForGuest,
                                                    guestId,
                                                    type: composeType,
                                                    direction: composeDirection,
                                                    subject: composeSubject || undefined,
                                                    body: composeBody,
                                                    toAddress: composeTo || undefined,
                                                    fromAddress: composeFrom || undefined
                                                });
                                                setComposeBody("");
                                                setComposeSubject("");
                                                setComposeTo("");
                                                setComposeFrom("");
                                                commsQuery.refetch();
                                                toast({ title: "Logged" });
                                            }}
                                            disabled={!campgroundIdForGuest}
                                        >
                                            Log communication
                                        </Button>
                                    </div>
                                </details>

                                <div className="space-y-2 max-h-96 overflow-auto pr-1">
                                    {!timelineItems.length && (
                                        <div className="text-sm text-slate-500">No communications yet.</div>
                                    )}
                                    <div className="relative pl-3 border-l border-slate-200 space-y-4">
                                        {timelineItems.map((item: any) => {
                                            const createdDate = item.date ? new Date(item.date) : null;
                                            const Icon = item.kind === "playbook" ? GitBranch : item.type === "sms" ? MessageSquare : Mail;
                                            return (
                                                <div key={`${item.kind}-${item.id}`} className="relative pl-4">
                                                    <span className="absolute -left-[9px] top-2 h-4 w-4 rounded-full bg-white border border-slate-300 flex items-center justify-center">
                                                        <Icon className="h-3 w-3 text-slate-500" />
                                                    </span>
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            <span>{createdDate ? formatDistanceToNow(createdDate, { addSuffix: true }) : ""}</span>
                                                            {item.kind === "communication" && (
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                        item.direction === "outbound"
                                                                            ? "bg-blue-100 text-blue-700 border border-blue-200"
                                                                            : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                                    }`}
                                                                >
                                                                    {item.direction}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize", statusTone(item.status))}>
                                                                {item.status || "sent"}
                                                            </span>
                                                            {item.kind === "playbook" && (item.status || "").toLowerCase() === "failed" && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => retryPlaybookMutation.mutate(item.id)}
                                                                    disabled={retryPlaybookMutation.isPending}
                                                                    className="h-7"
                                                                >
                                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                                    Retry
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="mt-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] font-semibold">
                                                                {item.kind === "playbook" ? "Playbook" : item.type}
                                                            </Badge>
                                                            {item.kind === "playbook" && <span className="text-xs text-slate-600">{item.name}</span>}
                                                            {item.kind === "communication" && item.subject && (
                                                                <span className="text-sm font-medium text-slate-900">{item.subject}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-slate-700 line-clamp-2">
                                                            {item.kind === "playbook"
                                                                ? item.lastError
                                                                    ? `Attempts: ${item.attempts ?? 0} • Last error: ${item.lastError}`
                                                                    : `Attempts: ${item.attempts ?? 0}`
                                                                : item.body}
                                                        </div>
                                                        {item.kind === "communication" && (
                                                            <div className="text-xs text-slate-500">
                                                                {item.provider ? `Provider: ${item.provider}` : ""}
                                                                {item.toAddress ? ` • To: ${item.toAddress}` : ""}
                                                                {item.fromAddress ? ` • From: ${item.fromAddress}` : ""}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {commsQuery.hasNextPage && (
                                        <div className="pt-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => commsQuery.fetchNextPage()}
                                                disabled={commsQuery.isFetchingNextPage}
                                            >
                                                {commsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardShell>
    );
}

function GuestEquipmentTab({ guestId }: { guestId: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [addOpen, setAddOpen] = useState(false);
    const [newEquipment, setNewEquipment] = useState({
        type: "trailer",
        make: "",
        model: "",
        length: "",
        plateNumber: "",
        plateState: ""
    });

    const equipmentQuery = useQuery({
        queryKey: ["guest-equipment", guestId],
        queryFn: () => apiClient.getGuestEquipment(guestId)
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            return apiClient.createGuestEquipment(guestId, {
                ...newEquipment,
                length: newEquipment.length ? parseInt(newEquipment.length) : undefined
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["guest-equipment", guestId] });
            setAddOpen(false);
            setNewEquipment({ type: "trailer", make: "", model: "", length: "", plateNumber: "", plateState: "" });
            toast({ title: "Equipment added" });
        },
        onError: () => {
            toast({ title: "Failed to add equipment", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return apiClient.deleteGuestEquipment(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["guest-equipment", guestId] });
            toast({ title: "Equipment removed" });
        },
        onError: () => {
            toast({ title: "Failed to remove equipment", variant: "destructive" });
        }
    });

    if (equipmentQuery.isLoading) return <div>Loading equipment...</div>;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Guest Equipment</CardTitle>
                    <CardDescription>Manage vehicles and RVs for this guest</CardDescription>
                </div>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Equipment
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Equipment</DialogTitle>
                            <DialogDescription>Add a new vehicle or RV to this guest's profile.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Type</Label>
                                <select
                                    className="col-span-3 flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={newEquipment.type}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, type: e.target.value })}
                                >
                                    <option value="motorhome_a">Motorhome Class A</option>
                                    <option value="motorhome_b">Motorhome Class B</option>
                                    <option value="motorhome_c">Motorhome Class C</option>
                                    <option value="trailer">Travel Trailer</option>
                                    <option value="fifth_wheel">Fifth Wheel</option>
                                    <option value="popup">Pop-up Camper</option>
                                    <option value="truck_camper">Truck Camper</option>
                                    <option value="van">Camper Van</option>
                                    <option value="tow_vehicle">Tow Vehicle</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Make</Label>
                                <Input
                                    value={newEquipment.make}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, make: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g. Ford, Winnebago"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Model</Label>
                                <Input
                                    value={newEquipment.model}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, model: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g. F-150, Journey"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Length (ft)</Label>
                                <Input
                                    type="number"
                                    value={newEquipment.length}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, length: e.target.value })}
                                    className="col-span-3"
                                    placeholder="e.g. 30"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Plate</Label>
                                <Input
                                    value={newEquipment.plateNumber}
                                    onChange={(e) => setNewEquipment({ ...newEquipment, plateNumber: e.target.value })}
                                    className="col-span-3"
                                    placeholder="License Plate"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
                            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                                {createMutation.isPending ? "Adding..." : "Add Equipment"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Make/Model</TableHead>
                            <TableHead>Length</TableHead>
                            <TableHead>Plate</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {equipmentQuery.data?.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="capitalize flex items-center gap-2">
                                    {item.type === "car" || item.type === "truck" ? <Car className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                                    {item.type.replace("_", " ")}
                                </TableCell>
                                <TableCell>{item.make} {item.model}</TableCell>
                                <TableCell>{item.length ? `${item.length}'` : "-"}</TableCell>
                                <TableCell>
                                    {item.plateNumber && (
                                        <Badge variant="outline" className="font-mono">
                                            {item.plateNumber}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            if (confirm("Are you sure you want to remove this item?")) {
                                                deleteMutation.mutate(item.id);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {(!equipmentQuery.data || equipmentQuery.data.length === 0) && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                    No equipment found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
