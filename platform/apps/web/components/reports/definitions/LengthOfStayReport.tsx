import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format, startOfDay, endOfDay, isWithinInterval, differenceInDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "@/components/charts/recharts";

interface LengthOfStayReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function LengthOfStayReport({ campgroundId, dateRange }: LengthOfStayReportProps) {
    const { data: reservations } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return { chartData: [], averageLos: 0, totalStays: 0 };

        const start = startOfDay(new Date(dateRange.start));
        const end = endOfDay(new Date(dateRange.end));

        let totalNights = 0;
        let count = 0;
        const buckets: Record<string, number> = {
            "1 night": 0,
            "2 nights": 0,
            "3 nights": 0,
            "4-6 nights": 0,
            "7-13 nights": 0,
            "14+ nights": 0
        };

        reservations.forEach(r => {
            if (r.status === 'cancelled') return;
            const rStart = startOfDay(new Date(r.arrivalDate));

            // Check if reservation start is within the range (Analysis usually based on arrival date)
            if (!isWithinInterval(rStart, { start, end })) return;

            const nights = differenceInDays(new Date(r.departureDate), new Date(r.arrivalDate));
            if (nights <= 0) return; // Should not happen for valid reservations

            totalNights += nights;
            count++;

            if (nights === 1) buckets["1 night"]++;
            else if (nights === 2) buckets["2 nights"]++;
            else if (nights === 3) buckets["3 nights"]++;
            else if (nights >= 4 && nights <= 6) buckets["4-6 nights"]++;
            else if (nights >= 7 && nights <= 13) buckets["7-13 nights"]++;
            else buckets["14+ nights"]++;
        });

        const chartData = Object.entries(buckets).map(([name, value]) => ({
            name,
            value
        }));

        const averageLos = count > 0 ? (totalNights / count).toFixed(1) : 0;

        return { chartData, averageLos, totalStays: count };
    }, [reservations, dateRange]);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Length of Stay</div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{reportData.averageLos}</span>
                        <span className="text-sm text-muted-foreground">nights</span>
                    </div>
                </div>
                <div className="p-6 bg-card rounded-xl border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Stays Analyzed</div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-foreground">{reportData.totalStays}</span>
                        <span className="text-sm text-muted-foreground">reservations</span>
                    </div>
                </div>
            </div>

            <div className="h-[400px] bg-card rounded-xl border border-border shadow-sm p-6">
                <h3 className="text-lg font-semibold text-foreground mb-6">Stay Duration Distribution</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                            cursor={{ fill: '#f1f5f9' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" name="Reservations" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
