import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "@/components/charts/recharts";

interface PaymentMethodsReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
    }).format(amount);
};

export function PaymentMethodsReport({ campgroundId, dateRange }: PaymentMethodsReportProps) {
    const { data: payments } = useQuery({
        queryKey: ["payments", campgroundId],
        queryFn: () => apiClient.getPayments(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!payments) return { pieData: [], total: 0 };

        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        const breakdown: Record<string, number> = {};
        let totalRevenue = 0;

        payments.forEach(p => {
            // Filter by date
            const d = new Date(p.createdAt);
            if (!isWithinInterval(d, { start, end })) return;

            // Check if it's a refund or charge. Payment model has `direction` @default("charge")
            // Usually reports show Net Revenue, or separated.
            // Let's assume we want "Collections" (Charges collected). Refunds might be negative.
            // If direction is 'refund', subtract?
            let amount = p.amountCents / 100;
            if (p.direction === 'refund') {
                amount = -amount;
            }

            const method = (p.method || "Unknown").toUpperCase();
            breakdown[method] = (breakdown[method] || 0) + amount;
            totalRevenue += amount;
        });

        const pieData = Object.entries(breakdown).map(([name, value]) => ({
            name,
            value
        })).sort((a, b) => b.value - a.value);

        return { pieData, total: totalRevenue };
    }, [payments, dateRange]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-8 items-center h-[400px]">
                <div className="w-full md:w-1/2 h-full">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Distribution</h3>
                    {reportData.pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="80%">
                            <PieChart>
                                <Pie
                                    data={reportData.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {reportData.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">No payments found</div>
                    )}
                </div>

                <div className="w-full md:w-1/2 h-full overflow-auto">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 text-right">Details</h3>
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Method</th>
                                    <th className="px-4 py-3 text-right">Amount</th>
                                    <th className="px-4 py-3 text-right">%</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportData.pieData.map((item) => (
                                    <tr key={item.name} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                                        <td className="px-4 py-3 text-right font-mono text-slate-900">{formatCurrency(item.value)}</td>
                                        <td className="px-4 py-3 text-right text-slate-500">
                                            {reportData.total > 0 ? ((item.value / reportData.total) * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-semibold">
                                    <td className="px-4 py-3">Total</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(reportData.total)}</td>
                                    <td className="px-4 py-3 text-right">100%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
