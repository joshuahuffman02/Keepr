"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wallet, ArrowDownLeft, ArrowUpRight, History, Building2, CreditCard, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GUEST_TOKEN_KEY, SPRING_CONFIG, STATUS_VARIANTS } from "@/lib/portal-constants";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalLoadingState, EmptyState } from "@/components/portal/PortalLoadingState";

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

export default function WalletPage() {
    const router = useRouter();
    const [wallets, setWallets] = useState<WalletBalance[]>([]);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    useEffect(() => {
        const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
        if (!storedToken) {
            router.push("/portal/login");
            return;
        }

        const fetchWallets = async () => {
            try {
                const walletsData = await apiClient.getPortalWallets(storedToken);
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
        };

        fetchWallets();
    }, [router]);

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
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        Use your wallet balance to pay for reservations
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        Pay for items at the camp store
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
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
        </div>
    );
}
