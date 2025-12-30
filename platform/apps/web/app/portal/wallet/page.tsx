"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, ArrowDownLeft, ArrowUpRight, History, Building2, CreditCard, Loader2, Trash2, Star, Shield, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GUEST_TOKEN_KEY, SPRING_CONFIG, STATUS_VARIANTS } from "@/lib/portal-constants";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalLoadingState, EmptyState } from "@/components/portal/PortalLoadingState";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type WalletBalance = {
    walletId: string;
    campgroundId: string;
    campgroundName: string;
    scopeType: "campground" | "organization" | "global";
    scopeId: string | null;
    balanceCents: number;
    availableCents: number;
    currency: string;
};

type WalletTransaction = {
    id: string;
    direction: string;
    amountCents: number;
    beforeBalanceCents: number;
    afterBalanceCents: number;
    referenceType: string;
    referenceId: string;
    reason: string | null;
    createdAt: string;
};

type SavedPaymentMethod = {
    id: string;
    campgroundId: string;
    campgroundName: string;
    type: string;
    last4: string | null;
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
    isDefault: boolean;
    nickname: string | null;
    createdAt: string;
};

const CARD_BRAND_COLORS: Record<string, string> = {
    visa: "bg-blue-600",
    mastercard: "bg-red-500",
    amex: "bg-blue-400",
    discover: "bg-orange-500",
    default: "bg-slate-600",
};

export default function WalletPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [wallets, setWallets] = useState<WalletBalance[]>([]);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    // Payment methods state
    const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
    const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
    const [deleteCardConfirm, setDeleteCardConfirm] = useState<string | null>(null);
    const [deletingCard, setDeletingCard] = useState(false);

    const fetchWallets = useCallback(async (authToken: string) => {
        try {
            const walletsData = await apiClient.getPortalWallets(authToken);
            setWallets(walletsData || []);
            // If there's only one wallet, auto-select it
            if (walletsData && walletsData.length === 1) {
                setSelectedWalletId(walletsData[0].walletId);
            }
        } catch (err) {
            console.error(err);
            setWallets([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchPaymentMethods = useCallback(async (authToken: string) => {
        try {
            const methods = await apiClient.getPortalPaymentMethods(authToken);
            setPaymentMethods(methods || []);
        } catch (err) {
            console.error(err);
            setPaymentMethods([]);
        } finally {
            setLoadingPaymentMethods(false);
        }
    }, []);

    useEffect(() => {
        const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
        if (!storedToken) {
            router.push("/portal/login");
            return;
        }
        setToken(storedToken);
        fetchWallets(storedToken);
        fetchPaymentMethods(storedToken);
    }, [router, fetchWallets, fetchPaymentMethods]);

    // Pull-to-refresh handler
    const handleRefresh = useCallback(async () => {
        if (!token) return;
        await Promise.all([fetchWallets(token), fetchPaymentMethods(token)]);
    }, [token, fetchWallets, fetchPaymentMethods]);

    const handleDeleteCard = async (paymentMethodId: string) => {
        const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
        if (!storedToken) return;

        setDeletingCard(true);
        try {
            await apiClient.deletePortalPaymentMethod(storedToken, paymentMethodId);
            setPaymentMethods((prev) => prev.filter((pm) => pm.id !== paymentMethodId));
            toast({ title: "Card removed", description: "Payment method deleted successfully." });
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to delete card", variant: "destructive" });
        } finally {
            setDeletingCard(false);
            setDeleteCardConfirm(null);
        }
    };

    const getCardBrandColor = (brand: string | null): string => {
        if (!brand) return CARD_BRAND_COLORS.default;
        return CARD_BRAND_COLORS[brand.toLowerCase()] || CARD_BRAND_COLORS.default;
    };

    const formatExpiry = (month: number | null, year: number | null) => {
        if (!month || !year) return "N/A";
        return `${month.toString().padStart(2, "0")}/${year.toString().slice(-2)}`;
    };

    const selectedWallet = wallets.find((wallet) => wallet.walletId === selectedWalletId) ?? null;

    useEffect(() => {
        if (!selectedWalletId || !selectedWallet) return;

        const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
        if (!storedToken) return;

        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            try {
                const data = await apiClient.getPortalWalletTransactions(
                    storedToken,
                    selectedWallet.campgroundId,
                    20,
                    undefined,
                    selectedWalletId
                );
                setTransactions(data.transactions || []);
            } catch (err) {
                console.error(err);
                setTransactions([]);
            } finally {
                setLoadingTransactions(false);
            }
        };

        fetchTransactions();
    }, [selectedWalletId, selectedWallet]);

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };

    const walletScopeLabel = (wallet: WalletBalance) => {
        if (wallet.scopeType === "organization") {
            return `Portfolio${wallet.campgroundName ? ` · ${wallet.campgroundName}` : ""}`;
        }
        if (wallet.scopeType === "global") {
            return "Global wallet";
        }
        return wallet.campgroundName || "Campground";
    };

    const totalBalanceCents = wallets.reduce((sum, w) => sum + w.balanceCents, 0);

    if (loading) {
        return <PortalLoadingState variant="page" />;
    }

    return (
        <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
        <div className="container mx-auto px-4 py-6 space-y-6">
            {/* Page Header */}
            <PortalPageHeader
                icon={<CreditCard className="h-6 w-6 text-white" />}
                title="My Wallet"
                subtitle="Store credit & payment history"
                gradient="from-emerald-500 to-teal-600"
            />
                {wallets.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <h3 className="text-lg font-medium mb-2">No Wallet Balance</h3>
                            <p className="text-muted-foreground max-w-md mx-auto">
                                You don't have any wallet credit yet. Wallet credit can be added by campground staff
                                or when you receive a refund for a reservation.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Total Balance Card */}
                        <Card className="overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm opacity-80 mb-1">Total Balance</p>
                                        <div className="flex items-center gap-2">
                                            <Wallet className="h-6 w-6" />
                                            <span className="text-3xl font-bold">{formatCurrency(totalBalanceCents)}</span>
                                        </div>
                                    </div>
                                    {wallets.length > 1 && (
                                        <div className="text-right">
                                            <p className="text-sm opacity-80">{wallets.length} wallets</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Wallet Balances */}
                        {wallets.length > 1 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        Wallet Balances
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {wallets.map((wallet) => (
                                        <button
                                            key={wallet.walletId}
                                            onClick={() => setSelectedWalletId(wallet.walletId)}
                                            className={`w-full p-4 rounded-lg border text-left transition-all ${
                                                selectedWalletId === wallet.walletId
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{walletScopeLabel(wallet)}</p>
                                                </div>
                                                <span className="font-bold text-lg">
                                                    {formatCurrency(wallet.balanceCents)}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Single Wallet Case - Show balance prominently */}
                        {wallets.length === 1 && (
                            <Card>
                                <CardContent className="py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Building2 className="h-5 w-5 text-muted-foreground" />
                                            <span className="font-medium">{walletScopeLabel(wallets[0])}</span>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            Available: {formatCurrency(wallets[0].availableCents)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Saved Payment Methods */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Saved Cards
                                </CardTitle>
                                <CardDescription>
                                    Your saved payment methods for faster checkout
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loadingPaymentMethods ? (
                                    <div className="flex justify-center py-6">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : paymentMethods.length === 0 ? (
                                    <div className="text-center py-6">
                                        <CreditCard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                        <p className="text-sm text-muted-foreground">No saved cards</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Cards are automatically saved when you make payments online
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {paymentMethods.map((pm) => (
                                            <motion.div
                                                key={pm.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={`flex items-center justify-between p-4 rounded-lg border ${
                                                    pm.isDefault ? "border-status-success/30 bg-status-success/15" : "border-border bg-muted/30"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`w-12 h-8 rounded flex items-center justify-center text-white text-xs font-bold ${getCardBrandColor(
                                                            pm.brand
                                                        )}`}
                                                    >
                                                        {pm.brand?.toUpperCase().slice(0, 4) || "CARD"}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">
                                                                •••• {pm.last4 || "****"}
                                                            </span>
                                                            {pm.isDefault && (
                                                                <Badge className="bg-status-success/15 text-status-success border-status-success/30 text-xs">
                                                                    <Star className="w-3 h-3 mr-1" />
                                                                    Default
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            Expires {formatExpiry(pm.expMonth, pm.expYear)}
                                                            {pm.campgroundName && ` · ${pm.campgroundName}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeleteCardConfirm(pm.id)}
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-4 p-3 bg-status-info/15 rounded-lg border border-status-info/30">
                                    <div className="flex items-start gap-2">
                                        <Shield className="w-4 h-4 text-status-info mt-0.5" />
                                        <div className="text-xs text-status-info">
                                            <p className="font-medium">Secure Card Storage</p>
                                            <p className="mt-0.5">
                                                Your cards are securely stored with Stripe. Refunds are automatically
                                                processed to the original payment method.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* How Wallet Works */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Wallet className="h-5 w-5" />
                                    About Your Wallet
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-status-success" />
                                        Use your wallet balance to pay for reservations
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-status-success" />
                                        Pay for items at the camp store
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-status-success" />
                                        Receive refunds directly to your wallet
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                                        Contact the campground to add credit
                                    </li>
                                </ul>
                            </CardContent>
                        </Card>

                        {/* Transaction History */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    Transaction History
                                </CardTitle>
                                {wallets.length > 1 && !selectedWalletId && (
                                    <CardDescription>
                                        Select a wallet above to view transactions
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                {loadingTransactions ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : !selectedWalletId && wallets.length > 1 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        Select a wallet to view transaction history
                                    </p>
                                ) : transactions.length > 0 ? (
                                    <div className="space-y-1">
                                        {transactions.map((tx, index) => {
                                            const isCredit = tx.direction === "credit" || tx.direction === "issue";
                                            return (
                                                <motion.div
                                                    key={tx.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "p-2 rounded-full",
                                                            isCredit
                                                                ? cn(STATUS_VARIANTS.success.bg, STATUS_VARIANTS.success.text)
                                                                : cn(STATUS_VARIANTS.error.bg, STATUS_VARIANTS.error.text)
                                                        )}>
                                                            {isCredit ? (
                                                                <ArrowDownLeft className="h-4 w-4" />
                                                            ) : (
                                                                <ArrowUpRight className="h-4 w-4" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-foreground">
                                                                {tx.reason || tx.referenceType.replace(/_/g, ' ')}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {format(new Date(tx.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={cn(
                                                        "px-3 py-1 rounded-full text-sm font-medium",
                                                        isCredit
                                                            ? cn(STATUS_VARIANTS.success.bg, STATUS_VARIANTS.success.text)
                                                            : cn(STATUS_VARIANTS.error.bg, STATUS_VARIANTS.error.text)
                                                    )}>
                                                        {isCredit ? "+" : "-"}{formatCurrency(tx.amountCents)}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <EmptyState
                                        icon={<History className="h-12 w-12" />}
                                        title="No transactions yet"
                                        description="Your transaction history will appear here once you use your wallet."
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}

            {/* Delete Card Confirmation Dialog */}
            <Dialog open={!!deleteCardConfirm} onOpenChange={() => setDeleteCardConfirm(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove Card?</DialogTitle>
                        <DialogDescription>
                            This will remove the card from your account. You can add it again later when making a payment.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteCardConfirm(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (deleteCardConfirm) {
                                    handleDeleteCard(deleteCardConfirm);
                                }
                            }}
                            disabled={deletingCard}
                        >
                            {deletingCard ? "Removing..." : "Remove Card"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </PullToRefresh>
    );
}
