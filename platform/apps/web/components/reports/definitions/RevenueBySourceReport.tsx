import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "@/components/charts/recharts";
// import { formatCurrency } from "@/lib/utils";

// Local formatter fallback if import fails, but let's try standard utils first since it works elsewhere usually
// Actually, in the previous file I commented it out. I will define it locally to be safe.
const formatCurrencyLocal = (value: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
};

interface RevenueBySourceReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function RevenueBySourceReport({ campgroundId, dateRange }: RevenueBySourceReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const data = useMemo(() => {
        if (!reservations) return [];

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        // 1. Filter
        const filtered = reservations.filter((r) => {
            // Use createdAt for attribution, fallback to arrivalDate if missing (though schema guarantees createdAt)
            const date = new Date(r.createdAt || r.arrivalDate);
            return date >= start && date <= end && r.status !== "cancelled";
        });

        // 2. Aggregate
        const buckets: Record<string, { source: string; revenue: number; bookings: number }> = {};

        filtered.forEach((r) => {
            // Normalize source
            let source = r.source || "Direct";
            // Capitalize
            source = source.charAt(0).toUpperCase() + source.slice(1);

            if (!buckets[source]) {
                buckets[source] = { source, revenue: 0, bookings: 0 };
            }

            buckets[source].revenue += (r.totalAmount || 0) / 100;
            buckets[source].bookings += 1;
        });

        // 3. Convert to array and sort
        return Object.values(buckets).sort((a, b) => b.revenue - a.revenue);
    }, [reservations, dateRange]);

    const totalRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalBookings = data.reduce((acc, curr) => acc + curr.bookings, 0);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading revenue data...</div>;
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-muted rounded-lg border border-border">
                <div className="text-muted-foreground mb-2">No bookings found for this period</div>
                <p className="text-xs text-muted-foreground">Try adjusting the date range to see attribution data.</p>
            </div>
        );
    }

    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#8b5cf6'];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrencyLocal(totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">From {totalBookings} bookings</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Top Source</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data[0]?.source || "—"}</div>
                        <p className="text-xs text-muted-foreground">
                            {data[0] ? `${formatCurrencyLocal(data[0].revenue)} (${Math.round((data[0].revenue / totalRevenue) * 100)}%)` : "—"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Revenue Distribution</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="horizontal" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="source" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value: number | string) => `$${value}`}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number) => [formatCurrencyLocal(value), "Revenue"]}
                                />
                                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} barSize={40}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle>Source Breakdown</CardTitle>
                    </CardHeader>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted text-xs uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Source</th>
                                    <th className="px-4 py-3 font-medium text-right">Bookings</th>
                                    <th className="px-4 py-3 font-medium text-right">Revenue</th>
                                    <th className="px-4 py-3 font-medium text-right">% of Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.map((row) => (
                                    <tr key={row.source} className="hover:bg-muted">
                                        <td className="px-4 py-3 font-medium text-foreground">{row.source}</td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">{row.bookings}</td>
                                        <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrencyLocal(row.revenue)}</td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            {Math.round((row.revenue / totalRevenue) * 100)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}
