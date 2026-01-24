import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "@/components/charts/recharts";

interface RevenueBySiteTypeReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

const COLORS = [
  "#059669",
  "#0891b2",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#f59e0b",
  "#84cc16",
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

export function RevenueBySiteTypeReport({ campgroundId, dateRange }: RevenueBySiteTypeReportProps) {
  const { data: reservations } = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
  });

  const { data: siteClasses } = useQuery({
    queryKey: ["site-classes", campgroundId],
    queryFn: () => apiClient.getSiteClasses(campgroundId),
  });

  const reportData = useMemo(() => {
    if (!reservations || !sites || !siteClasses) return [];

    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));

    // Group by Site Class
    const breakdown: Record<string, { name: string; revenue: number; count: number }> = {};

    // Helper maps
    const siteMap = new Map(sites.map((s) => [s.id, s]));
    const classMap = new Map(siteClasses.map((c) => [c.id, c]));

    reservations.forEach((r) => {
      if (r.status === "cancelled") return;
      const rStart = startOfDay(new Date(r.arrivalDate));
      const rEnd = startOfDay(new Date(r.departureDate));

      // Overlap check for revenue attribution?
      // Revenue reports usually differ: "Booked in period" vs "Stayed in period".
      // Let's stick to "Stayed/Consumed in period" or "Arrivals in period"?
      // Simplest for now: Reservations ARRIVING in period or OVERLAPPING?
      // "Revenue by Source" used arrival date filtering. Let's consistency use:
      // "Revenue associated with reservations effectively overlapping/active in this period" is hard.
      // Let's use "Revenue for reservations ARRIVING or CREATED in this window"?
      // Industry standard: Revenue is recognized daily.
      // Given I don't have daily ledger split per reservation easily here without complex math,
      // I will attribute the TOTAL reservation revenue to the period if the reservation "belongs" to this period (Arrival).
      // Same as Revenue By Source.

      // Check if arrival is in range
      if (!isWithinInterval(rStart, { start, end })) return;

      const site = siteMap.get(r.siteId || "");
      const siteClassId = site?.siteClassId || "unknown";
      const siteClass = classMap.get(siteClassId);
      const className = siteClass?.name || "Unassigned";

      if (!breakdown[className]) {
        breakdown[className] = { name: className, revenue: 0, count: 0 };
      }
      breakdown[className].revenue += (r.totalAmount || 0) / 100;
      breakdown[className].count += 1;
    });

    return Object.values(breakdown).sort((a, b) => b.revenue - a.revenue);
  }, [reservations, sites, siteClasses, dateRange]);

  const totalRevenue = reportData.reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-8 items-center">
        <div className="w-full md:w-1/2 h-[300px]">
          {reportData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                  nameKey="name"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? "Unknown"} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {reportData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No data available
            </div>
          )}
        </div>

        <div className="w-full md:w-1/2 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Performance by Site Type</h3>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.map((item) => (
                  <tr key={item.name} className="hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.count}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">
                      {formatCurrency(item.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">
                    {reportData.reduce((sum, i) => sum + i.count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totalRevenue)}</td>
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
