"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Gift,
  Plus,
  Search,
  CreditCard,
  History,
  DollarSign,
  Copy,
  Check,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GiftCardsManagementProps {
  campgroundId: string;
}

// Types inferred from Zod schemas in api-client.ts
// StoredValueAccountSchema has: balanceCents, codes[].active
// StoredValueLedgerSchema has: direction, amountCents, afterBalanceCents, reason

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateString));
}

export function GiftCardsManagement({ campgroundId }: GiftCardsManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isCheckBalanceDialogOpen, setIsCheckBalanceDialogOpen] = useState(false);
  const [checkCode, setCheckCode] = useState("");
  const [checkedBalance, setCheckedBalance] = useState<{ balance: number; code: string } | null>(
    null,
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Issue form state
  const [issueAmount, setIssueAmount] = useState("");
  const [issueCode, setIssueCode] = useState("");
  const [generateCode, setGenerateCode] = useState(true);

  // Fetch gift card accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["stored-value-accounts", campgroundId],
    queryFn: () => apiClient.getStoredValueAccounts(campgroundId),
    enabled: !!campgroundId,
  });

  // Fetch ledger entries
  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["stored-value-ledger", campgroundId],
    queryFn: () => apiClient.getStoredValueLedger(campgroundId),
    enabled: !!campgroundId,
  });

  // Issue gift card mutation
  const issueMutation = useMutation({
    mutationFn: (payload: { amountCents: number; code?: string }) =>
      apiClient.issueStoredValue({
        tenantId: campgroundId,
        amountCents: payload.amountCents,
        currency: "usd",
        type: "gift",
        code: payload.code,
        scopeType: "campground",
        scopeId: campgroundId,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stored-value-accounts", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["stored-value-ledger", campgroundId] });
      toast({
        title: "Gift card issued!",
        description: `Card created with code: ${data.code}`,
      });
      setIsIssueDialogOpen(false);
      setIssueAmount("");
      setIssueCode("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to issue gift card",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter to only gift cards
  const giftCards = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => a.type === "gift");
  }, [accounts]);

  // Filter by search term
  const filteredCards = useMemo(() => {
    if (!searchTerm) return giftCards;
    const term = searchTerm.toLowerCase();
    return giftCards.filter(
      (card) =>
        card.codes?.some((c) => c.code.toLowerCase().includes(term)) ||
        card.id.toLowerCase().includes(term),
    );
  }, [giftCards, searchTerm]);

  // Gift card ledger only
  const giftLedger = useMemo(() => {
    if (!ledger || !giftCards) return [];
    const giftAccountIds = new Set(giftCards.map((g) => g.id));
    return ledger.filter((entry) => giftAccountIds.has(entry.accountId));
  }, [ledger, giftCards]);

  // Stats
  const stats = useMemo(() => {
    const totalCards = giftCards.length;
    const activeCards = giftCards.filter((c) => c.balanceCents > 0).length;
    const totalValue = giftCards.reduce((sum, c) => sum + c.balanceCents, 0);
    const recentlyIssued = giftCards.filter((c) => {
      const created = new Date(c.issuedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return created > weekAgo;
    }).length;
    return { totalCards, activeCards, totalValue, recentlyIssued };
  }, [giftCards]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleIssue = () => {
    const cents = Math.round(parseFloat(issueAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid dollar amount.",
        variant: "destructive",
      });
      return;
    }
    issueMutation.mutate({
      amountCents: cents,
      code: generateCode ? undefined : issueCode || undefined,
    });
  };

  const handleCheckBalance = async () => {
    if (!checkCode.trim()) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000"}/stored-value/code/${checkCode.trim()}/balance`,
        {
          headers: {
            Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("campreserv:authToken") : ""}`,
            "x-campground-id": campgroundId,
          },
        },
      );
      if (!res.ok) throw new Error("Card not found");
      const data = await res.json();
      setCheckedBalance({ balance: data.balance, code: checkCode });
    } catch {
      toast({
        title: "Card not found",
        description: "No gift card found with that code.",
        variant: "destructive",
      });
      setCheckedBalance(null);
    }
  };

  if (accountsLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-status-info-text mb-1">
            <Gift className="w-4 h-4" />
            <span className="text-xs font-medium">Total Cards</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.totalCards}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-status-success-text mb-1">
            <CreditCard className="w-4 h-4" />
            <span className="text-xs font-medium">Active</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.activeCards}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-status-warning-text mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium">Outstanding</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalValue)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-status-info-text mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-medium">This Week</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.recentlyIssued}</p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {/* Check Balance Dialog */}
          <Dialog open={isCheckBalanceDialogOpen} onOpenChange={setIsCheckBalanceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Search className="w-4 h-4" />
                Check Balance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Check Gift Card Balance</DialogTitle>
                <DialogDescription>
                  Enter a gift card code to check its current balance.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="check-code">Gift Card Code</Label>
                  <Input
                    id="check-code"
                    placeholder="Enter code..."
                    value={checkCode}
                    onChange={(e) => setCheckCode(e.target.value.toUpperCase())}
                    className="font-mono"
                  />
                </div>
                {checkedBalance && (
                  <div className="p-4 bg-status-success-bg rounded-lg border border-status-success-border motion-safe:animate-in motion-safe:fade-in">
                    <p className="text-sm text-status-success-text">
                      Balance for {checkedBalance.code}:
                    </p>
                    <p className="text-3xl font-bold text-status-success-text mt-1">
                      {formatCurrency(checkedBalance.balance)}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCheckBalanceDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={handleCheckBalance}>Check Balance</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Issue Gift Card Dialog */}
          <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover">
                <Plus className="w-4 h-4" />
                Issue Gift Card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-action-primary" />
                  Issue New Gift Card
                </DialogTitle>
                <DialogDescription>
                  Create a new gift card that can be used for reservations or purchases.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="issue-amount">Amount</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="issue-amount"
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="50.00"
                      value={issueAmount}
                      onChange={(e) => setIssueAmount(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="issue-code">Card Code</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={generateCode}
                        onChange={(e) => setGenerateCode(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-muted-foreground">Auto-generate</span>
                    </label>
                  </div>
                  {!generateCode && (
                    <Input
                      id="issue-code"
                      placeholder="CUSTOM-CODE"
                      value={issueCode}
                      onChange={(e) => setIssueCode(e.target.value.toUpperCase())}
                      className="font-mono motion-safe:animate-in motion-safe:fade-in"
                    />
                  )}
                </div>

                {/* Preview */}
                {issueAmount && (
                  <div className="p-4 bg-status-info-bg rounded-xl border border-status-info-border motion-safe:animate-in motion-safe:fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-status-info-text font-medium">
                          Gift Card Preview
                        </p>
                        <p className="text-2xl font-bold text-foreground mt-1">
                          {formatCurrency(Math.round(parseFloat(issueAmount || "0") * 100))}
                        </p>
                      </div>
                      <Gift className="w-10 h-10 text-status-info" />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleIssue}
                  disabled={issueMutation.isPending || !issueAmount}
                  className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
                >
                  {issueMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Issuing...
                    </>
                  ) : (
                    "Issue Gift Card"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs for Cards & History */}
      <Tabs defaultValue="cards" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="cards" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Gift Cards ({filteredCards.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            Transaction History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-4">
          {filteredCards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Gift className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-1">No gift cards yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Issue your first gift card to get started.
                </p>
                <Button
                  onClick={() => setIsIssueDialogOpen(true)}
                  className="bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Issue Gift Card
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredCards.map((card) => {
                const primaryCode = card.codes?.[0]?.code || "No code";
                const isActive = card.balanceCents > 0;
                return (
                  <Card
                    key={card.id}
                    className={cn(
                      "overflow-hidden transition-all hover:shadow-md",
                      !isActive && "opacity-60",
                    )}
                  >
                    <div className="flex items-center p-4 gap-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          isActive ? "bg-status-success" : "bg-muted",
                        )}
                      >
                        <Gift
                          className={cn(
                            "w-6 h-6",
                            isActive ? "text-status-success-foreground" : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-sm font-medium text-foreground">
                            {primaryCode}
                          </code>
                          <button
                            onClick={() => handleCopyCode(primaryCode)}
                            className="p-1 hover:bg-muted rounded transition-colors"
                            aria-label="Copy code"
                          >
                            {copiedCode === primaryCode ? (
                              <Check className="w-3.5 h-3.5 text-status-success" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Issued {formatDate(card.issuedAt)}
                          {card.expiresAt && ` • Expires ${formatDate(card.expiresAt)}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-lg font-bold",
                            isActive ? "text-status-success-text" : "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(card.balanceCents)}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs",
                            isActive
                              ? "border-status-success-border text-status-success-text bg-status-success-bg"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {isActive ? "Active" : "Used"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {ledgerLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : giftLedger.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-1">No transactions yet</h3>
                <p className="text-sm text-muted-foreground">
                  Gift card activity will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {giftLedger.slice(0, 50).map((entry) => {
                const isCredit = entry.direction === "credit" || entry.amountCents > 0;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 bg-card rounded-lg border hover:bg-muted transition-colors"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isCredit ? "bg-status-success-bg" : "bg-status-warning-bg",
                      )}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4 text-status-success-text" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-status-warning-text" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {entry.reason || entry.direction}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.createdAt)}
                        {entry.referenceType && ` • ${entry.referenceType}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-medium",
                          isCredit ? "text-status-success-text" : "text-status-warning-text",
                        )}
                      >
                        {isCredit ? "+" : ""}
                        {formatCurrency(Math.abs(entry.amountCents))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bal: {formatCurrency(entry.afterBalanceCents ?? 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
