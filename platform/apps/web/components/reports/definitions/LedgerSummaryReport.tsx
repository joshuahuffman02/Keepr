import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const formatCurrencyLocal = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
};

interface LedgerSummaryReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function LedgerSummaryReport({ campgroundId, dateRange }: LedgerSummaryReportProps) {
    const { data: ledgerEntries, isLoading } = useQuery({
        queryKey: ["ledger", campgroundId],
        queryFn: () => apiClient.getLedgerEntries(campgroundId),
    });

    const summary = useMemo(() => {
        if (!ledgerEntries) return { revenue: 0, payments: 0, refunds: 0, taxes: 0, count: 0, items: [] };

        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        // Filter entries within date range based on occurredAt
        const filtered = ledgerEntries.filter((entry) => {
            const date = new Date(entry.occurredAt);
            return isWithinInterval(date, { start, end });
        });

        // Calculate totals
        // Assuming direction 'credit' = revenue/charge, 'debit' = payment/refund often inverted depending on perspective (Guest vs Property)
        // Let's stick to the schema or standard convention:
        // Usually Property Ledger: 
        // Debit = Cash Increase (Payment Received)
        // Credit = Revenue Increase (Charge Posted)
        // However, Prisma schema says default direction is "debit".
        // Let's look at common types if available, or just aggregate by direction.
        // Actually, we should probably look at `description` or `glCode` if available, or just bucket by direction for now.
        // Let's try to infer from typical descriptions if direction matches schema defaults.

        let totalPayments = 0;
        let totalCharges = 0;
        let totalRefunds = 0;

        filtered.forEach(e => {
            const amt = e.amountCents / 100;
            // Simplistic logic until we have strict types:
            // If it's a "Payment", it's usually a Debit to Cash, Credit to AR. 
            // If it's a "Charge" (Nightly Rate), it's a Debit to AR, Credit to Revenue.
            // Let's assume for this report:
            // "Credit" = Revenue/Charges
            // "Debit" = Payments (if positive) or Refunds (if negative? or specific type)
            // schema doesn't specify 'type' field, checking fields... 
            // It has `glCode`, `account`, `description`.

            // Heuristic for demonstration:
            const desc = (e.description || "").toLowerCase();
            const gl = (e.glCode || "").toLowerCase();

            if (desc.includes("payment")) {
                totalPayments += amt;
            } else if (desc.includes("refund")) {
                totalRefunds += amt;
            } else if (e.direction === 'credit' || desc.includes("charge") || desc.includes("rate")) {
                totalCharges += amt;
            }
        });

        return {
            revenue: totalCharges,
            payments: totalPayments,
            refunds: totalRefunds,
            net: totalPayments - totalRefunds,
            count: filtered.length,
            items: filtered.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
        };
    }, [ledgerEntries, dateRange]);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading ledger data...</div>;
    }

    if (!ledgerEntries) {
        return <div className="text-sm text-muted-foreground">No ledger data found.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Charges</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyLocal(summary.revenue)}</div>
                        <p className="text-xs text-muted-foreground">Posted revenue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Payments</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrencyLocal(summary.payments)}</div>
                        <p className="text-xs text-muted-foreground">Cash collected</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Refunds</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-600">{formatCurrencyLocal(summary.refunds)}</div>
                        <p className="text-xs text-muted-foreground">Returned to guests</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Net Transactions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyLocal(summary.net)}</div>
                        <p className="text-xs text-muted-foreground">Payments - Refunds</p>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Ledger Detail</h3>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3">Reference</th>
                                <th className="px-4 py-3">GL Code</th>
                                <th className="px-4 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {summary.items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                        No entries found for this period.
                                    </td>
                                </tr>
                            ) : (
                                summary.items.map((entry: any) => (
                                    <tr key={entry.id} className="hover:bg-muted">
                                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                            {format(new Date(entry.occurredAt), "MMM d, yyyy HH:mm")}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            {entry.description}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                                            {entry.externalRef || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground text-xs">
                                            {entry.glCode || "—"}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium`}>
                                            {formatCurrencyLocal(entry.amountCents / 100)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
