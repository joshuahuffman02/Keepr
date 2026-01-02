import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "@/components/charts/recharts";

interface NewVsReturningReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#8b5cf6', '#3b82f6']; // Purple (New), Blue (Returning)

export function NewVsReturningReport({ campgroundId, dateRange }: NewVsReturningReportProps) {
    const { data: reservations, isLoading, error } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return { pieData: [], total: 0, newCount: 0, returningCount: 0 };

        // Robust date parsing (matching ArrivalsReport)
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        // Count reservations per guest to determine new vs returning
        const guestReservationCounts: Record<string, number> = {};
        const guestRepeatStays: Record<string, number> = {};

        // First pass: count all reservations per guest and record repeatStays
        reservations.forEach(r => {
            if (r.status === 'cancelled' || !r.guestId) return;
            guestReservationCounts[r.guestId] = (guestReservationCounts[r.guestId] || 0) + 1;
            if (r.guest?.repeatStays != null && r.guest.repeatStays > 0) {
                guestRepeatStays[r.guestId] = r.guest.repeatStays;
            }
        });

        let newCount = 0;
        let returningCount = 0;
        const countedGuests = new Set<string>();

        reservations.forEach(r => {
            if (r.status === 'cancelled') return;

            const arrivalDate = new Date(r.arrivalDate);
            // Simple timestamp comparison to avoid date-fns RangeErrors
            if (arrivalDate < start || arrivalDate > end) return;

            const guestId = r.guestId;
            if (!guestId || countedGuests.has(guestId)) return;
            countedGuests.add(guestId);

            // A guest is "returning" if:
            // 1. They have repeatStays > 0 in the database, OR
            // 2. They have more than 1 reservation in our current dataset
            const isReturning =
                (guestRepeatStays[guestId] || 0) > 0 ||
                (guestReservationCounts[guestId] || 0) > 1;

            if (isReturning) {
                returningCount++;
            } else {
                newCount++;
            }
        });

        const total = newCount + returningCount;
        const pieData = [
            { name: "New Guests", value: newCount },
            { name: "Returning Guests", value: returningCount }
        ];

        return { pieData, total, newCount, returningCount };
    }, [reservations, dateRange]);

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading analysis...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-500">Failed to load reservation data.</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-8 items-center h-[300px]">
                <div className="w-full md:w-1/2 h-full">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Guest Loyalty Mix</h3>
                    {reportData.total > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
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
                                    label={false}
                                >
                                    {reportData.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                            <p>No guest arrivals in this period</p>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-1/2 flex flex-col justify-center space-y-6">
                    <div className="p-6 bg-purple-50 rounded-xl border border-purple-100">
                        <div className="text-sm font-medium text-purple-600 uppercase tracking-wider">New Guests</div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-purple-900">{reportData.newCount}</span>
                            <span className="text-sm text-purple-700">
                                ({reportData.total > 0 ? ((reportData.newCount / reportData.total) * 100).toFixed(1) : 0}%)
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-purple-600/80">First-time visitors.</p>
                    </div>

                    <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
                        <div className="text-sm font-medium text-blue-600 uppercase tracking-wider">Returning Guests</div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-blue-900">{reportData.returningCount}</span>
                            <span className="text-sm text-blue-700">
                                ({reportData.total > 0 ? ((reportData.returningCount / reportData.total) * 100).toFixed(1) : 0}%)
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-blue-600/80">Have stayed at least once before.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
