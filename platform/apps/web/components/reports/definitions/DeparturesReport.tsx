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

interface DeparturesReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function DeparturesReport({ campgroundId, dateRange }: DeparturesReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const { data: sites } = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
    });

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading departures...</div>;
    }

    if (!reservations) {
        return <div className="text-sm text-muted-foreground">No data found.</div>;
    }

    // Filter for departures within the date range
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    // Adjust end date to include the full day
    end.setHours(23, 59, 59, 999);

    const departures = reservations.filter((r) => {
        const departureDate = new Date(r.departureDate);
        return departureDate >= start && departureDate <= end && r.status !== 'cancelled';
    }).sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime());

    const getSiteName = (siteId: string) => {
        return sites?.find((s) => s.id === siteId)?.name ?? "Unknown";
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Departures List</h2>
                    <p className="text-sm text-muted-foreground">
                        {departures.length} check-outs expected between {dateRange.start} and {dateRange.end}
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Guest</th>
                                <th className="px-4 py-3">Site</th>
                                <th className="px-4 py-3">Departure Date</th>
                                <th className="px-4 py-3">Pax</th>
                                <th className="px-4 py-3">Balance</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {departures.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                        No departures found for this period.
                                    </td>
                                </tr>
                            ) : (
                                departures.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-muted group transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                {r.guest?.primaryFirstName} {r.guest?.primaryLastName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{getSiteName(r.siteId)}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(r.departureDate), "MMM d, yyyy")}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {r.occupants?.adults || 0}ad / {r.occupants?.children || 0}ch
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={((r.totalAmount - (r.paidAmount || 0)) > 0) ? "text-rose-600 font-medium" : "text-emerald-600"}>
                                                {formatCurrencyLocal((r.totalAmount - (r.paidAmount || 0)) / 100)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={r.status === 'checked_out' ? 'secondary' : 'outline'} className="capitalize">
                                                {r.status.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link href={`/reservations/${r.id}`} className="text-emerald-600 hover:text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
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
