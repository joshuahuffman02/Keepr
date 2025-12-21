"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type RedemptionChannel = "reservation" | "pos" | "manual";
type GiftCardHistory = {
  id: string;
  type: "issued" | "redeemed" | "adjusted";
  amount: number;
  note?: string;
  ref?: string;
  channel: RedemptionChannel;
  createdAt: string;
  balanceAfter: number;
};

type GiftCard = {
  accountId: string;
  code: string;
  amount: number;
  balance: number;
  expiresOn?: string;
  issuedTo?: string;
  issuedFor?: RedemptionChannel;
  campgroundId?: string | null;
  createdAt: string;
  history: GiftCardHistory[];
};

type GiftCardStatus = "active" | "expired" | "empty";

type StoredValueAccount = {
  id: string;
  campgroundId: string;
  type: "gift" | "credit";
  currency: string;
  status: "active" | "frozen" | "expired";
  issuedAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, any> | null;
  createdAt?: string;
  updatedAt?: string;
  codes: Array<{ id: string; code: string; active: boolean; createdAt?: string }>;
  balanceCents: number;
  issuedCents: number;
};

type StoredValueLedger = {
  id: string;
  accountId: string;
  campgroundId: string;
  direction: string;
  amountCents: number;
  currency: string;
  beforeBalanceCents?: number;
  afterBalanceCents?: number;
  referenceType?: string;
  referenceId?: string;
  channel?: string | null;
  reason?: string | null;
  createdAt: string;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const statusFor = (card: GiftCard): GiftCardStatus => {
  const now = new Date();
  if (card.expiresOn && new Date(card.expiresOn) < now) return "expired";
  if (card.balance <= 0) return "empty";
  return "active";
};

const remainingDays = (card: GiftCard) => {
  if (!card.expiresOn) return null;
  const diff = new Date(card.expiresOn).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const normalizeChannel = (value?: string | null): RedemptionChannel => {
  if (value === "reservation" || value === "pos" || value === "manual") return value;
  return "manual";
};

const mapLedgerType = (direction: string): GiftCardHistory["type"] | null => {
  if (direction === "issue" || direction === "refund") return "issued";
  if (direction === "redeem" || direction === "hold_capture") return "redeemed";
  if (direction === "adjust" || direction === "expire") return "adjusted";
  return null;
};

const readMetadataString = (metadata: Record<string, any> | null | undefined, key: string) => {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
};

export default function GiftCardsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [issueForm, setIssueForm] = useState({
    code: "",
    amount: "100",
    expiresOn: "",
    issuedTo: "",
    issuedFor: "reservation" as RedemptionChannel,
    note: "",
    reference: ""
  });
  const [redeemForm, setRedeemForm] = useState({
    code: "",
    amount: "",
    channel: "reservation" as RedemptionChannel,
    reference: ""
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const accountsQuery = useQuery({
    queryKey: ["stored-value-accounts", campgroundId],
    queryFn: () => apiClient.getStoredValueAccounts(campgroundId!),
    enabled: !!campgroundId
  });

  const ledgerQuery = useQuery({
    queryKey: ["stored-value-ledger", campgroundId],
    queryFn: () => apiClient.getStoredValueLedger(campgroundId!),
    enabled: !!campgroundId
  });

  const issueMutation = useMutation({
    mutationFn: (payload: {
      tenantId: string;
      amountCents: number;
      currency: string;
      expiresAt?: string;
      code?: string;
      type: "gift" | "credit";
      metadata?: Record<string, any>;
    }) => apiClient.issueStoredValue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stored-value-accounts", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["stored-value-ledger", campgroundId] });
    }
  });

  const redeemMutation = useMutation({
    mutationFn: (payload: {
      code?: string;
      amountCents: number;
      currency: string;
      referenceType: string;
      referenceId: string;
      channel?: string;
    }) => apiClient.redeemStoredValue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stored-value-accounts", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["stored-value-ledger", campgroundId] });
    }
  });

  const adjustMutation = useMutation({
    mutationFn: (payload: { accountId: string; deltaCents: number; reason: string }) =>
      apiClient.adjustStoredValue(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stored-value-accounts", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["stored-value-ledger", campgroundId] });
    }
  });

  const ledgerByAccount = useMemo(() => {
    const map = new Map<string, StoredValueLedger[]>();
    (ledgerQuery.data ?? []).forEach((entry) => {
      const list = map.get(entry.accountId) ?? [];
      list.push(entry);
      map.set(entry.accountId, list);
    });
    return map;
  }, [ledgerQuery.data]);

  const cards = useMemo(() => {
    const accounts = (accountsQuery.data ?? []) as StoredValueAccount[];
    return accounts.map((account) => {
      const metadata = account.metadata ?? {};
      const issuedForRaw = readMetadataString(metadata, "issuedFor") || readMetadataString(metadata, "channel");
      const issuedFor = issuedForRaw ? normalizeChannel(issuedForRaw) : undefined;
      const issuedTo = readMetadataString(metadata, "issuedTo");
      const issuedNote = readMetadataString(metadata, "note");
      const reference = readMetadataString(metadata, "reference");
      const codeEntry = account.codes.find((c) => c.active) ?? account.codes[0];
      const cardCode = codeEntry?.code || account.id.slice(-8).toUpperCase();
      const history = (ledgerByAccount.get(account.id) ?? [])
        .map((entry) => {
          const type = mapLedgerType(entry.direction);
          if (!type) return null;
          return {
            id: entry.id,
            type,
            amount: entry.amountCents / 100,
            note: entry.reason || issuedNote,
            ref: entry.referenceId || reference,
            channel: normalizeChannel(entry.channel || issuedForRaw),
            createdAt: entry.createdAt,
            balanceAfter: (entry.afterBalanceCents ?? entry.amountCents) / 100
          } as GiftCardHistory;
        })
        .filter((entry): entry is GiftCardHistory => Boolean(entry));

      return {
        accountId: account.id,
        code: cardCode,
        amount: account.issuedCents / 100,
        balance: account.balanceCents / 100,
        expiresOn: account.expiresAt || undefined,
        issuedTo: issuedTo || undefined,
        issuedFor,
        campgroundId: account.campgroundId,
        createdAt: account.issuedAt || account.createdAt || new Date().toISOString(),
        history
      } satisfies GiftCard;
    });
  }, [accountsQuery.data, ledgerByAccount]);

  useEffect(() => {
    if (!cards.length || redeemForm.code) return;
    setRedeemForm((prev) => ({ ...prev, code: cards[0].code }));
  }, [cards, redeemForm.code]);

  const stats = useMemo(() => {
    const totalIssued = cards.reduce((sum, c) => sum + c.amount, 0);
    const outstanding = cards.reduce((sum, c) => sum + c.balance, 0);
    const redeemed = totalIssued - outstanding;
    const expiringSoon = cards.filter((c) => {
      const days = remainingDays(c);
      return typeof days === "number" && days >= 0 && days <= 30;
    }).length;
    return { totalIssued, outstanding, redeemed, expiringSoon };
  }, [cards]);

  const history = useMemo(() => {
    return cards
      .flatMap((card) =>
        card.history.map((entry) => ({
          ...entry,
          code: card.code,
          issuedTo: card.issuedTo
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cards]);

  const billingExplainer = (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-900">Guest vs reservation billing</CardTitle>
        <CardDescription className="text-amber-800">
          Guest wallets and transferring charges between guest and reservation are on the roadmap; today credits live in the stored value ledger.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-amber-900 space-y-1">
        <p>Planned: per-guest wallets and move/merge tools between guest and their reservations.</p>
        <p>Current workflow: issue a gift card/credit and apply it to the needed reservation or POS order.</p>
      </CardContent>
    </Card>
  );

  const handleIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!campgroundId) {
      toast({ title: "Select a campground", description: "Choose a campground before issuing.", variant: "destructive" });
      return;
    }
    const amount = parseFloat(issueForm.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter an amount", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }

    const customCode = issueForm.code.trim() ? issueForm.code.trim().toUpperCase() : undefined;
    if (customCode && cards.find((c) => c.code === customCode)) {
      toast({ title: "Code already exists", description: "Use a unique code for each gift card.", variant: "destructive" });
      return;
    }

    try {
      const result = await issueMutation.mutateAsync({
        tenantId: campgroundId,
        amountCents: Math.round(amount * 100),
        currency: "usd",
        expiresAt: issueForm.expiresOn || undefined,
        code: customCode,
        type: "gift",
        metadata: {
          issuedTo: issueForm.issuedTo || undefined,
          issuedFor: issueForm.issuedFor,
          note: issueForm.note || undefined,
          reference: issueForm.reference || undefined,
          channel: issueForm.issuedFor
        }
      });
      const issuedCode = result.code || customCode || "NEW-CODE";
      setIssueForm({
        code: "",
        amount: "100",
        expiresOn: "",
        issuedTo: "",
        issuedFor: "reservation",
        note: "",
        reference: ""
      });
      setRedeemForm((prev) => ({ ...prev, code: issuedCode }));
      toast({ title: "Gift card issued", description: `${issuedCode} created with ${formatMoney(amount)} available.` });
    } catch (err) {
      console.error("Failed to issue gift card:", err);
      toast({ title: "Issue failed", description: "Unable to issue gift card. Try again.", variant: "destructive" });
    }
  };

  const handleRedeem = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(redeemForm.amount);
    if (!redeemForm.code) {
      toast({ title: "Pick a card", description: "Choose a gift card to redeem.", variant: "destructive" });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ title: "Enter an amount", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }

    const card = cards.find((c) => c.code === redeemForm.code);
    if (!card) {
      toast({ title: "Not found", description: "Gift card code was not found.", variant: "destructive" });
      return;
    }
    if (statusFor(card) === "expired") {
      toast({ title: "Card is expired", description: "Use a valid (non-expired) card.", variant: "destructive" });
      return;
    }
    if (amount > card.balance) {
      toast({ title: "Amount too high", description: "Redemption exceeds remaining balance.", variant: "destructive" });
      return;
    }

    const reference = redeemForm.reference.trim();
    if ((redeemForm.channel === "reservation" || redeemForm.channel === "pos") && !reference) {
      toast({ title: "Add a reference", description: "Reservation or POS redemptions need a reference.", variant: "destructive" });
      return;
    }

    try {
      await redeemMutation.mutateAsync({
        code: redeemForm.code,
        amountCents: Math.round(amount * 100),
        currency: "usd",
        referenceType: redeemForm.channel,
        referenceId: reference || `manual-${Date.now()}`,
        channel: redeemForm.channel
      });
      toast({
        title: "Redemption recorded",
        description: `${formatMoney(amount)} applied to ${redeemForm.channel === "reservation" ? "reservation" : redeemForm.channel === "pos" ? "POS order" : "manual credit"}${reference ? ` (${reference})` : ""}.`
      });
      setRedeemForm((prev) => ({ ...prev, amount: "", reference: "" }));
    } catch (err) {
      console.error("Failed to redeem gift card:", err);
      toast({ title: "Redemption failed", description: "Unable to redeem gift card. Try again.", variant: "destructive" });
    }
  };

  const channelLabel = (channel: RedemptionChannel) => {
    if (channel === "reservation") return "Reservation";
    if (channel === "pos") return "POS order";
    return "Manual";
  };

  return (
    <DashboardShell>
      {billingExplainer}
      <Breadcrumbs
        items={[
          { label: "Finance", href: "/finance" },
          { label: "Gift Cards & Credits", href: "/finance/gift-cards" }
        ]}
      />

      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-slate-900">Gift Cards & Store Credit</h1>
        <p className="text-sm text-slate-600">
          Issue and redeem gift cards against reservations or POS orders. Balances are tracked in the stored value ledger—no external processors needed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Outstanding balance</CardTitle>
            <CardDescription className="text-2xl font-semibold text-slate-900">{formatMoney(stats.outstanding)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Redeemed to date</CardTitle>
            <CardDescription className="text-2xl font-semibold text-emerald-700">{formatMoney(stats.redeemed)}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Cards issued</CardTitle>
            <CardDescription className="text-2xl font-semibold text-slate-900">{cards.length}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Expiring soon (30d)</CardTitle>
            <CardDescription className="text-2xl font-semibold text-amber-700">{stats.expiringSoon}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Issue card / credit</CardTitle>
            <CardDescription>Create a new code with balance, expiry, and optional context.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleIssue}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="code">Code (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      placeholder="Auto-generate"
                      value={issueForm.code}
                      onChange={(e) => setIssueForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setIssueForm((prev) => ({ ...prev, code: `CAMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}` }))
                      }
                    >
                      Generate
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={issueForm.amount}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="expiresOn">Expiry (optional)</Label>
                  <Input
                    id="expiresOn"
                    type="date"
                    value={issueForm.expiresOn}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, expiresOn: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="issuedTo">Issued to (optional)</Label>
                  <Input
                    id="issuedTo"
                    placeholder="Guest name / walk-in"
                    value={issueForm.issuedTo}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, issuedTo: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="issuedFor">Redeem against</Label>
                  <Select
                    value={issueForm.issuedFor}
                    onValueChange={(value: RedemptionChannel) => setIssueForm((prev) => ({ ...prev, issuedFor: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reservation">Reservation</SelectItem>
                      <SelectItem value="pos">POS order</SelectItem>
                      <SelectItem value="manual">Manual credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reference">Reference (optional)</Label>
                  <Input
                    id="reference"
                    placeholder="e.g. R-1050 or POS-998"
                    value={issueForm.reference}
                    onChange={(e) => setIssueForm((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  placeholder="Add any constraints or why the credit was issued"
                  value={issueForm.note}
                  onChange={(e) => setIssueForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!campgroundId || issueMutation.isPending}>
                  {issueMutation.isPending ? "Creating..." : "Create code"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Redeem</CardTitle>
            <CardDescription>Apply a card against a reservation or POS ticket.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleRedeem}>
              <div className="space-y-1">
                <Label htmlFor="redeemCode">Gift card</Label>
                <Select
                  value={redeemForm.code}
                  onValueChange={(value) => setRedeemForm((prev) => ({ ...prev, code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gift card" />
                  </SelectTrigger>
                  <SelectContent>
                    {cards.length ? (
                      cards.map((card) => (
                        <SelectItem key={card.code} value={card.code}>
                          {card.code} · {formatMoney(card.balance)} left
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No gift cards yet
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="redeemAmount">Amount</Label>
                  <Input
                    id="redeemAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={redeemForm.amount}
                    onChange={(e) => setRedeemForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="channel">Channel</Label>
                  <Select
                    value={redeemForm.channel}
                    onValueChange={(value: RedemptionChannel) => setRedeemForm((prev) => ({ ...prev, channel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reservation">Reservation</SelectItem>
                      <SelectItem value="pos">POS order</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reference">{redeemForm.channel === "reservation" ? "Reservation ID" : redeemForm.channel === "pos" ? "POS order ID" : "Reference (optional)"}</Label>
                <Input
                  id="reference"
                  placeholder={redeemForm.channel === "reservation" ? "R-1084" : redeemForm.channel === "pos" ? "POS-1240" : "Optional note"}
                  value={redeemForm.reference}
                  onChange={(e) => setRedeemForm((prev) => ({ ...prev, reference: e.target.value }))}
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={!campgroundId || redeemMutation.isPending || !cards.length}>
                  {redeemMutation.isPending ? "Redeeming..." : "Redeem"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Gift cards</CardTitle>
          <CardDescription>Track remaining balances, expiry, and quick actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="history">Usage history</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="pt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Issued to</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.length ? (
                    cards.map((card) => {
                      const status = statusFor(card);
                      return (
                        <TableRow key={card.code} className={cn(status === "expired" ? "bg-amber-50" : "", status === "empty" ? "opacity-80" : "")}>
                          <TableCell>
                            <div className="font-semibold text-slate-900">{card.code}</div>
                            <div className="text-xs text-slate-500">
                              Issued {new Date(card.createdAt).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={status === "active" ? "secondary" : status === "expired" ? "destructive" : "outline"}
                              className={status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                            >
                              {status === "active" ? "Active" : status === "expired" ? "Expired" : "Fully used"}
                            </Badge>
                            {remainingDays(card) !== null && remainingDays(card)! >= 0 && (
                              <div className="text-xs text-amber-600 mt-1">{remainingDays(card)} days left</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-slate-900">{formatMoney(card.balance)}</div>
                            <div className="text-xs text-slate-500">Issued {formatMoney(card.amount)}</div>
                          </TableCell>
                          <TableCell className="text-slate-700">{card.issuedTo ?? "—"}</TableCell>
                          <TableCell className="text-slate-700">{card.expiresOn ? new Date(card.expiresOn).toLocaleDateString() : "No expiry"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => setRedeemForm((prev) => ({ ...prev, code: card.code }))}>
                                Redeem
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                  try {
                                    await adjustMutation.mutateAsync({
                                      accountId: card.accountId,
                                      deltaCents: 500,
                                      reason: "Manual top-up"
                                    });
                                    toast({ title: "Balance adjusted", description: `${formatMoney(5)} added.` });
                                  } catch (err) {
                                    console.error("Failed to adjust balance:", err);
                                    toast({ title: "Adjustment failed", description: "Unable to adjust balance.", variant: "destructive" });
                                  }
                                }}
                              >
                                Add $5 credit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-slate-500 py-6">
                        No gift cards yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="history" className="pt-3">
              <div className="space-y-3">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.type === "issued" ? "secondary" : entry.type === "redeemed" ? "outline" : "default"}>
                          {entry.type === "issued" ? "Issued" : entry.type === "redeemed" ? "Redeemed" : "Adjusted"}
                        </Badge>
                        <span className="font-semibold text-slate-900">{entry.code}</span>
                        <span className="text-sm text-slate-600">· {channelLabel(entry.channel)}</span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {entry.note || "No note"} {entry.ref ? `(${entry.ref})` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("font-semibold", entry.type === "redeemed" ? "text-rose-700" : "text-emerald-700")}>
                        {entry.type === "redeemed" ? "-" : "+"}
                        {formatMoney(entry.amount)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(entry.createdAt).toLocaleString()} · Balance {formatMoney(entry.balanceAfter)}
                      </div>
                    </div>
                  </div>
                ))}
                {!history.length && (
                  <div className="overflow-hidden rounded border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                      <tbody>
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-6">
                            No usage yet.
                          </TableCell>
                        </TableRow>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
