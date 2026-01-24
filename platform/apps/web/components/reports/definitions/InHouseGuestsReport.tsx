import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, User } from "lucide-react";
import Link from "next/link";
// import { formatCurrency } from "@/lib/utils";

const formatCurrencyLocal = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

interface InHouseGuestsReportProps {
  campgroundId: string;
  // Note: In-house usually ignores the date picker filter and always shows "Today",
  // but we can respect the date range if we want to see "Who was in house on X date".
  // For now, let's treat it as "Who is in house RIGHT NOW" if the date range covers today,
  // or filtering by range overlap. Let's use range overlap for flexibility.
  dateRange: { start: string; end: string };
}

export function InHouseGuestsReport({ campgroundId, dateRange }: InHouseGuestsReportProps) {
  const { data: reservations, isLoading } = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
  });

  // We can also fetch site classes if we want to show RV Type etc.

  const inHouse = useMemo(() => {
    if (!reservations) return [];

    // For "In-House", generally we care about people physically present on the 'end' date of range
    // OR distinct count of anyone who stayed during the period.
    // Let's go with: List everyone whose stay overlaps with the selected range.
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    end.setHours(23, 59, 59, 999);

    return reservations
      .filter((r) => {
        const rStart = new Date(r.arrivalDate);
        const rEnd = new Date(r.departureDate);
        return r.status !== "cancelled" && rStart <= end && rEnd >= start;
      })
      .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()); // Sort by departure (due outs first)
  }, [reservations, dateRange]);

  const getSiteName = (siteId: string) => {
    return sites?.find((s) => s.id === siteId)?.name ?? "Unknown";
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading in-house guests...</div>;
  }

  if (!reservations) {
    return <div className="text-sm text-muted-foreground">No data found.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">In-House Guests</h2>
          <p className="text-sm text-muted-foreground">
            {inHouse.length} guests staying between {dateRange.start} and {dateRange.end}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Site</th>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Arrival</th>
                <th className="px-4 py-3">Departure</th>
                <th className="px-4 py-3">Pax</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inHouse.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No in-house guests found for this period.
                  </td>
                </tr>
              ) : (
                inHouse.map((r) => (
                  <tr key={r.id} className="hover:bg-muted group transition-colors">
                    <td className="px-4 py-3 text-foreground font-bold font-mono">
                      {getSiteName(r.siteId)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {r.guest?.primaryFirstName} {r.guest?.primaryLastName}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(r.arrivalDate), "MMM d")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(r.departureDate), "MMM d")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.adults || 0}ad / {r.children || 0}ch
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.totalAmount - (r.paidAmount || 0) > 0
                            ? "text-rose-600 font-medium"
                            : "text-emerald-600"
                        }
                      >
                        {formatCurrencyLocal((r.totalAmount - (r.paidAmount || 0)) / 100)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          r.status === "checked_in"
                            ? "secondary"
                            : r.status === "confirmed"
                              ? "default"
                              : "outline"
                        }
                        className="capitalize"
                      >
                        {r.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/reservations/${r.id}`}
                        className="text-emerald-600 hover:text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1"
                      >
                        View <ExternalLink className="w-3 h-3" />
                      </Link>
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
