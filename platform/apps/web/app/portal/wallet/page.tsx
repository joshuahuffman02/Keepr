"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut, Loader2, ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, History, Building2 } from "lucide-react";
import { format } from "date-fns";

type WalletBalance = {
    walletId: string;
    campgroundId: string;
    campgroundName: string;
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
    const [selectedCampground, setSelectedCampground] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    useEffect(() => {
        const storedToken = localStorage.getItem("campreserv:guestToken");
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
                    setSelectedCampground(walletsData[0].campgroundId);
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

    useEffect(() => {
        if (!selectedCampground) return;

        const storedToken = localStorage.getItem("campreserv:guestToken");
        if (!storedToken) return;

        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            try {
                const data = await apiClient.getPortalWalletTransactions(storedToken, selectedCampground, 20);
                setTransactions(data.transactions || []);
            } catch (err) {
                console.error(err);
                setTransactions([]);
            } finally {
                setLoadingTransactions(false);
            }
        };

        fetchTransactions();
    }, [selectedCampground]);

    const handleLogout = () => {
        localStorage.removeItem("campreserv:guestToken");
        router.push("/portal/login");
    };

    const formatCurrency = (cents: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(cents / 100);
    };

    const totalBalanceCents = wallets.reduce((sum, w) => sum + w.balanceCents, 0);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30 pb-20">
            {/* Header */}
            <header className="bg-white border-b sticky top-0 z-10">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={() => router.push("/portal/my-stay")}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <h1 className="font-bold text-xl">My Wallet</h1>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                    </Button>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 space-y-8">
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
                                            <p className="text-sm opacity-80">{wallets.length} campgrounds</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Wallet Balances by Campground */}
                        {wallets.length > 1 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Building2 className="h-5 w-5" />
                                        Balances by Campground
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {wallets.map((wallet) => (
                                        <button
                                            key={wallet.walletId}
                                            onClick={() => setSelectedCampground(wallet.campgroundId)}
                                            className={`w-full p-4 rounded-lg border text-left transition-all ${
                                                selectedCampground === wallet.campgroundId
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{wallet.campgroundName}</p>
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
                                            <span className="font-medium">{wallets[0].campgroundName}</span>
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
                                {wallets.length > 1 && !selectedCampground && (
                                    <CardDescription>
                                        Select a campground above to view transactions
                                    </CardDescription>
                                )}
                            </CardHeader>
                            <CardContent>
                                {loadingTransactions ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : !selectedCampground && wallets.length > 1 ? (
                                    <p className="text-muted-foreground text-center py-8">
                                        Select a campground to view transaction history
                                    </p>
                                ) : transactions.length > 0 ? (
                                    <div className="space-y-4">
                                        {transactions.map((tx) => (
                                            <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${
                                                        tx.direction === "credit" || tx.direction === "issue"
                                                            ? "bg-emerald-100 text-emerald-600"
                                                            : "bg-red-100 text-red-600"
                                                    }`}>
                                                        {tx.direction === "credit" || tx.direction === "issue" ? (
                                                            <ArrowDownLeft className="h-4 w-4" />
                                                        ) : (
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {tx.reason || tx.referenceType.replace(/_/g, ' ')}
                                                        </p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {format(new Date(tx.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant={tx.direction === "credit" || tx.direction === "issue" ? "default" : "destructive"}>
                                                    {tx.direction === "credit" || tx.direction === "issue" ? "+" : "-"}
                                                    {formatCurrency(tx.amountCents)}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-center py-8">
                                        No transactions yet
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </main>
        </div>
    );
}
