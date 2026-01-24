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

interface RepeatGuestsReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

const COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#eab308", "#f97316"];

export function RepeatGuestsReport({ campgroundId, dateRange }: RepeatGuestsReportProps) {
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

    // Count reservations per guest across ALL time (not just date range)
    const guestBookingCount: Record<string, { count: number; name: string; totalSpent: number }> =
      {};

    reservations.forEach((r) => {
      if (r.status === "cancelled" || !r.guestId) return;

      if (!guestBookingCount[r.guestId]) {
        guestBookingCount[r.guestId] = {
          count: 0,
          name:
            r.guest?.primaryFirstName && r.guest?.primaryLastName
              ? `${r.guest.primaryFirstName} ${r.guest.primaryLastName}`
              : r.guest?.email || "Unknown",
          totalSpent: 0,
        };
      }
      guestBookingCount[r.guestId].count++;
      guestBookingCount[r.guestId].totalSpent += (r.totalAmount || 0) / 100;
    });

    const guests = Object.values(guestBookingCount);
    const totalGuests = guests.length;
    const repeatGuests = guests.filter((g) => g.count >= 2);
    const loyalGuests = guests.filter((g) => g.count >= 3);
    const superLoyalGuests = guests.filter((g) => g.count >= 5);

    // Frequency distribution
    const frequencyBuckets = [
      { label: "1 stay", min: 1, max: 1 },
      { label: "2 stays", min: 2, max: 2 },
      { label: "3-4 stays", min: 3, max: 4 },
      { label: "5-9 stays", min: 5, max: 9 },
      { label: "10+ stays", min: 10, max: 999 },
    ];
    const frequencyData = frequencyBuckets.map((bucket) => ({
      name: bucket.label,
      count: guests.filter((g) => g.count >= bucket.min && g.count <= bucket.max).length,
    }));

    // Top repeat guests
    const topRepeatGuests = [...repeatGuests].sort((a, b) => b.count - a.count).slice(0, 10);

    return {
      totalGuests,
      repeatGuestsCount: repeatGuests.length,
      loyalGuestsCount: loyalGuests.length,
      superLoyalCount: superLoyalGuests.length,
      retentionRate: totalGuests > 0 ? ((repeatGuests.length / totalGuests) * 100).toFixed(1) : "0",
      frequencyData,
      topRepeatGuests,
    };
  }, [reservations, dateRange]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading guest data...</div>;
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
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600">
              Repeat Guests (2+)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900">{reportData.repeatGuestsCount}</div>
            <p className="text-xs text-purple-600">{reportData.retentionRate}% retention</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Loyal Guests (3+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900">{reportData.loyalGuestsCount}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600">Super Loyal (5+)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900">{reportData.superLoyalCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frequency Chart */}
        <Card className="p-4">
          <CardHeader>
            <CardTitle>Visit Frequency Distribution</CardTitle>
          </CardHeader>
          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.frequencyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {reportData.frequencyData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Repeat Guests Table */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Top Repeat Guests</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium">Guest</th>
                  <th className="px-4 py-3 font-medium text-right">Stays</th>
                  <th className="px-4 py-3 font-medium text-right">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.topRepeatGuests.map((guest, idx) => (
                  <tr key={idx} className="hover:bg-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{guest.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{guest.count}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
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
