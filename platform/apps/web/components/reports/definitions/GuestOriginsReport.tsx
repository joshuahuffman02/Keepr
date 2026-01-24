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
// import { formatCurrency } from "@/lib/utils";

// Local formatter just in case
const formatNumber = (num: number) => new Intl.NumberFormat("en-US").format(num);

interface GuestOriginsReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

export function GuestOriginsReport({ campgroundId, dateRange }: GuestOriginsReportProps) {
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
      // Use arrivalDate for visitor origins (who is physically here)
      const date = new Date(r.arrivalDate);
      return date >= start && date <= end && r.status !== "cancelled";
    });

    // 2. Aggregate by State
    const buckets: Record<string, { state: string; count: number; revenue: number }> = {};

    filtered.forEach((r) => {
      // Normalize state
      let state = r.guest?.state || "Unknown";
      state = state.trim().toUpperCase(); // Standardize to 2 chars usually, but just Upper

      if (!buckets[state]) {
        buckets[state] = { state, count: 0, revenue: 0 };
      }

      buckets[state].count += 1;
      buckets[state].revenue += (r.totalAmount || 0) / 100;
    });

    // 3. Convert to array and sort by count
    return Object.values(buckets).sort((a, b) => b.count - a.count);
  }, [reservations, dateRange]);

  const totalBookings = data.reduce((acc, curr) => acc + curr.count, 0);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading guest data...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-muted rounded-lg border border-border">
        <div className="text-muted-foreground mb-2">No guest data found</div>
        <p className="text-xs text-muted-foreground">Try adjusting the date range.</p>
      </div>
    );
  }

  // Top 10 for Chart
  const chartData = data.slice(0, 10);
  const COLORS = [
    "#0ea5e9",
    "#22c55e",
    "#eab308",
    "#f97316",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#64748b",
    "#94a3b8",
    "#cbd5e1",
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Guests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalBookings)}</div>
            <p className="text-xs text-muted-foreground">Unique bookings in period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Top Origin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data[0]?.state || "—"}</div>
            <p className="text-xs text-muted-foreground">
              {data[0]
                ? `${data[0].count} guests (${Math.round((data[0].count / totalBookings) * 100)}%)`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Top Guest Origins (by State)</CardTitle>
          </CardHeader>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="state"
                  type="category"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: number) => [value, "Guests"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Geographic Breakdown</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">State / Region</th>
                  <th className="px-4 py-3 font-medium text-right">Guests</th>
                  <th className="px-4 py-3 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row) => (
                  <tr key={row.state} className="hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{row.state}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.count}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Math.round((row.count / totalBookings) * 100)}%
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
