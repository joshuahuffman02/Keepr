"use client";

import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/random-id";

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

const STORAGE_KEY = "campreserv:gift-cards";

const seedGiftCards: GiftCard[] = [
  {
    code: "CAMP-WELCOME-100",
    amount: 100,
    balance: 65,
    expiresOn: "2026-01-10",
    issuedTo: "Sam Rivers",
    issuedFor: "reservation",
    campgroundId: null,
    createdAt: "2025-11-18T15:00:00Z",
    history: [
      {
        id: "seed-issue-1",
        type: "issued",
        amount: 100,
        note: "Issued for reservation R-1045",
        ref: "R-1045",
        channel: "reservation",
        createdAt: "2025-11-18T15:00:00Z",
        balanceAfter: 100
      },
      {
        id: "seed-redeem-1",
        type: "redeemed",
        amount: 35,
        note: "Applied to POS order KIOSK-22",
        ref: "POS-221104",
        channel: "pos",
        createdAt: "2025-12-02T18:30:00Z",
        balanceAfter: 65
      }
    ]
  },
  {
    code: "STORE-RETURN-50",
    amount: 50,
    balance: 50,
    expiresOn: "2025-12-31",
    issuedTo: "Walk-in credit",
    issuedFor: "pos",
    campgroundId: null,
    createdAt: "2025-12-01T21:10:00Z",
    history: [
      {
        id: "seed-issue-2",
        type: "issued",
        amount: 50,
        note: "Return credit for POS-22098",
        ref: "POS-22098",
        channel: "pos",
        createdAt: "2025-12-01T21:10:00Z",
        balanceAfter: 50
      }
    ]
  }
];

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

const uid = () => randomId();

export default function GiftCardsPage() {
  const { toast } = useToast();
  const [cards, setCards] = useState<GiftCard[]>([]);
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
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as GiftCard[];
        setCards(parsed);
        setRedeemForm((prev) => ({ ...prev, code: parsed[0]?.code ?? "" }));
        return;
      } catch (err) {
        console.warn("Unable to parse stored gift cards, falling back to seeds", err);
      }
    }
    setCards(seedGiftCards);
    setRedeemForm((prev) => ({ ...prev, code: seedGiftCards[0]?.code ?? "" }));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

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

  const updateCard = (code: string, updater: (card: GiftCard) => GiftCard) => {
    setCards((prev) => prev.map((card) => (card.code === code ? updater(card) : card)));
  };

  const billingExplainer = (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-900">Guest vs reservation billing</CardTitle>
        <CardDescription className="text-amber-800">
          Guest wallets and transferring charges between guest and reservation are on the roadmap; today balances live on the reservation.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-amber-900 space-y-1">
        <p>Planned: per-guest wallets and move/merge tools between guest and their reservations.</p>
        <p>Current workaround: issue a gift card/credit and apply it to the needed reservation or POS order.</p>
      </CardContent>
    </Card>
  );

  const handleIssue = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(issueForm.amount);
    if (!amount || amount <= 0) {
      toast({ title: "Enter an amount", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }
    const code = (issueForm.code || `CAMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).toUpperCase();
    if (cards.find((c) => c.code === code)) {
      toast({ title: "Code already exists", description: "Use a unique code for each gift card.", variant: "destructive" });
      return;
    }

    const newCard: GiftCard = {
      code,
      amount,
      balance: amount,
      expiresOn: issueForm.expiresOn || undefined,
      issuedTo: issueForm.issuedTo || undefined,
      issuedFor: issueForm.issuedFor,
      campgroundId: null,
      createdAt: new Date().toISOString(),
      history: [
        {
          id: uid(),
          type: "issued",
          amount,
          note: issueForm.note || undefined,
          ref: issueForm.reference || undefined,
          channel: issueForm.issuedFor,
          createdAt: new Date().toISOString(),
          balanceAfter: amount
        }
      ]
    };

    setCards((prev) => [newCard, ...prev]);
    setIssueForm({
      code: "",
      amount: "100",
      expiresOn: "",
      issuedTo: "",
      issuedFor: "reservation",
      note: "",
      reference: ""
    });
    setRedeemForm((prev) => ({ ...prev, code: newCard.code }));
    toast({ title: "Gift card issued", description: `${code} created with ${formatMoney(amount)} available.` });
  };

  const handleRedeem = (event: React.FormEvent) => {
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

    updateCard(card.code, (prev) => {
      const newBalance = +(prev.balance - amount).toFixed(2);
      const entry: GiftCardHistory = {
        id: uid(),
        type: "redeemed",
        amount,
        note: redeemForm.reference ? `${redeemForm.reference}` : undefined,
        ref: redeemForm.reference || undefined,
        channel: redeemForm.channel,
        createdAt: new Date().toISOString(),
        balanceAfter: newBalance
      };
      return { ...prev, balance: newBalance, history: [entry, ...prev.history] };
    });

    toast({
      title: "Redemption recorded",
      description: `${formatMoney(amount)} applied to ${redeemForm.channel === "reservation" ? "reservation" : "POS order"}${redeemForm.reference ? ` (${redeemForm.reference})` : ""}.`
    });
    setRedeemForm((prev) => ({ ...prev, amount: "", reference: "" }));
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
          Issue and redeem gift cards locally against reservations or POS orders. Everything here uses in-app data only—no external processors.
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
                <Button type="submit">Create code</Button>
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
                    {cards.map((card) => (
                      <SelectItem key={card.code} value={card.code}>
                        {card.code} · {formatMoney(card.balance)} left
                      </SelectItem>
                    ))}
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
                <Button type="submit">Redeem</Button>
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
                  {cards.map((card) => {
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
                          <div className="text-xs text-slate-500">Original {formatMoney(card.amount)}</div>
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
                              onClick={() => {
                                const adjustment = 5;
                                updateCard(card.code, (prev) => {
                                  const newBalance = +(prev.balance + adjustment).toFixed(2);
                                  const entry: GiftCardHistory = {
                                    id: uid(),
                                    type: "adjusted",
                                    amount: adjustment,
                                    note: "Manual top-up for demo",
                                    ref: undefined,
                                    channel: "manual",
                                    createdAt: new Date().toISOString(),
                                    balanceAfter: newBalance
                                  };
                                  return { ...prev, balance: newBalance, history: [entry, ...prev.history] };
                                });
                                toast({ title: "Balance adjusted", description: `${formatMoney(adjustment)} added for demo.` });
                              }}
                            >
                              +$5 demo top-up
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

