import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "@/components/charts/recharts";

interface TopSpendersReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

const COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f97316", "#ef4444"];

export function TopSpendersReport({ campgroundId, dateRange }: TopSpendersReportProps) {
  const {
    data: reservations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
  });

  const reportData = useMemo(() => {
    if (!reservations) return null;

    // Aggregate spending per guest (all time)
    const guestSpending: Record<
      string,
      {
        guestId: string;
        name: string;
        email: string;
        totalSpent: number;
        reservationCount: number;
        avgPerStay: number;
      }
    > = {};

    reservations.forEach((r) => {
      if (r.status === "cancelled" || !r.guestId) return;

      if (!guestSpending[r.guestId]) {
        guestSpending[r.guestId] = {
          guestId: r.guestId,
          name:
            r.guest?.primaryFirstName && r.guest?.primaryLastName
              ? `${r.guest.primaryFirstName} ${r.guest.primaryLastName}`
              : "Unknown",
          email: r.guest?.email || "",
          totalSpent: 0,
          reservationCount: 0,
          avgPerStay: 0,
        };
      }
      guestSpending[r.guestId].totalSpent += (r.totalAmount || 0) / 100;
      guestSpending[r.guestId].reservationCount++;
    });

    // Calculate avg per stay
    Object.values(guestSpending).forEach((g) => {
      g.avgPerStay = g.reservationCount > 0 ? g.totalSpent / g.reservationCount : 0;
    });

    const guests = Object.values(guestSpending);
    const sortedBySpend = [...guests].sort((a, b) => b.totalSpent - a.totalSpent);
    const top20 = sortedBySpend.slice(0, 20);

    // Calculate totals
    const totalRevenue = guests.reduce((sum, g) => sum + g.totalSpent, 0);
    const top10Revenue = sortedBySpend.slice(0, 10).reduce((sum, g) => sum + g.totalSpent, 0);
    const top10Percent = totalRevenue > 0 ? ((top10Revenue / totalRevenue) * 100).toFixed(1) : "0";

    // Chart data (top 10 for visibility)
    const chartData = sortedBySpend.slice(0, 10).map((g) => ({
      name: g.name.split(" ")[0], // First name only for chart
      value: Math.round(g.totalSpent),
    }));

    return {
      totalGuests: guests.length,
      totalRevenue,
      top10Revenue,
      top10Percent,
      topSpenders: top20,
      chartData,
    };
  }, [reservations]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading guest spending data...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">Failed to load reservation data.</div>;
  }

  if (!reportData || reportData.totalGuests === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-muted rounded-lg border border-border">
        <div className="text-muted-foreground mb-2">No guest data found</div>
        <p className="text-xs text-muted-foreground">
          Guests will appear after reservations are made.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Guests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.totalGuests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${reportData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Top 10 Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">
              ${reportData.top10Revenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Top 10 % of Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{reportData.top10Percent}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Top 10 Spenders</CardTitle>
          </CardHeader>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={12}
                  tickFormatter={(v: number | string) => `$${v}`}
                />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={60} />
                <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, "Spent"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {reportData.chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Spenders Table */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Top 20 High-Value Guests</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[350px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium text-right">Stays</th>
                  <th className="px-4 py-3 font-medium text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.topSpenders.map((guest, idx) => (
                  <tr key={guest.guestId} className="hover:bg-muted">
                    <td className="px-4 py-3 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{guest.name}</div>
                      {guest.email && (
                        <div className="text-xs text-muted-foreground">{guest.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {guest.reservationCount}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      ${guest.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0 })}
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
