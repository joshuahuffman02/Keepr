import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, User } from "lucide-react";
import Link from "next/link";

const formatCurrencyLocal = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return "—";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
};

interface CancellationsReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function CancellationsReport({ campgroundId, dateRange }: CancellationsReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const { data: sites } = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
    });

    const cancellations = useMemo(() => {
        if (!reservations) return [];

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        // Filter for cancelled status AND relevant date (either updated at or original arrival)
        // Usually cancellations are tracked by when they happened (updatedAt) or for when they were supposed to arrive.
        // Let's filter by 'arrivalDate' to see "Lost business for this period".
        return reservations.filter((r) => {
            const arrivalDate = new Date(r.arrivalDate);
            return (
                r.status === 'cancelled' &&
                arrivalDate >= start &&
                arrivalDate <= end
            );
        }).sort((a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime());
    }, [reservations, dateRange]);

    const getSiteName = (siteId: string) => {
        return sites?.find((s) => s.id === siteId)?.name ?? "Unknown";
    };

    const totalLostRevenue = cancellations.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading cancellations...</div>;
    }

    if (!reservations) {
        return <div className="text-sm text-muted-foreground">No data found.</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">Cancellations</h2>
                    <p className="text-sm text-muted-foreground">
                        {cancellations.length} cancelled bookings for arrival between {dateRange.start} and {dateRange.end}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Est. Lost Revenue</p>
                    <p className="text-xl font-bold text-rose-600">{formatCurrencyLocal(totalLostRevenue / 100)}</p>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Guest</th>
                                <th className="px-4 py-3">Site</th>
                                <th className="px-4 py-3">Original Arrival</th>
                                <th className="px-4 py-3">Nights</th>
                                <th className="px-4 py-3">Value</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {cancellations.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                        No cancellations found for this period.
                                    </td>
                                </tr>
                            ) : (
                                cancellations.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-muted group transition-colors">
                                        <td className="px-4 py-3 font-medium text-foreground">
                                            <div className="flex items-center gap-2">
                                                <User className="w-4 h-4 text-muted-foreground" />
                                                {r.guest?.primaryFirstName} {r.guest?.primaryLastName}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{getSiteName(r.siteId)}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{format(new Date(r.arrivalDate), "MMM d, yyyy")}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {Math.ceil((new Date(r.departureDate).getTime() - new Date(r.arrivalDate).getTime()) / (1000 * 60 * 60 * 24))}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-muted-foreground">
                                            {formatCurrencyLocal(r.totalAmount / 100)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant="destructive" className="capitalize">
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
