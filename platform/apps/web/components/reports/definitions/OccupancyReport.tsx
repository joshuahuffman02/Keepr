import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format, eachDayOfInterval, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, TrendingUp } from "lucide-react";

interface OccupancyReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function OccupancyReport({ campgroundId, dateRange }: OccupancyReportProps) {
    const { data: reservations, isLoading: isLoadingRes } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const { data: sites, isLoading: isLoadingSites } = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
    });

    const data = useMemo(() => {
        if (!reservations || !sites) return [];

        const start = startOfDay(new Date(dateRange.start));
        const end = startOfDay(new Date(dateRange.end));

        // Generate array of dates for x-axis
        const dates = eachDayOfInterval({ start, end });
        const totalSites = sites.length;
        if (totalSites === 0) return []; // Avoid division by zero

        return dates.map((date) => {
            const dateObj = startOfDay(date); // Ensure comparison at start of day

            // Count occupied sites for this specific date
            // A site is occupied if a reservation covers this night. 
            // Typically: arrival <= date < departure (since they leave on departure morning)
            const occupiedCount = reservations.filter((r) => {
                if (r.status === 'cancelled') return false;
                const rStart = startOfDay(new Date(r.arrivalDate));
                const rEnd = startOfDay(new Date(r.departureDate));

                // Classic "Overnight" occupancy logic: 
                // They occupy the site for the night OF date if:
                // rStart <= date AND date < rEnd
                return date >= rStart && date < rEnd;
            }).length;

            const percentage = Math.round((occupiedCount / totalSites) * 100);

            return {
                date: format(date, "MMM d"),
                fullDate: format(date, "yyyy-MM-dd"), // For tooltip
                occupancy: percentage,
                count: occupiedCount,
                total: totalSites
            };
        });
    }, [reservations, sites, dateRange]);

    const averageOccupancy = useMemo(() => {
        if (data.length === 0) return 0;
        const sum = data.reduce((acc, curr) => acc + curr.occupancy, 0);
        return Math.round(sum / data.length);
    }, [data]);

    if (isLoadingRes || isLoadingSites) {
        return <div className="text-sm text-slate-500">Loading occupancy data...</div>;
    }

    if (!reservations || !sites) {
        return <div className="text-sm text-slate-500">No data found.</div>;
    }

    if (sites.length === 0) {
        return <div className="text-sm text-slate-500">No sites configured for this campground. Cannot calculate occupancy.</div>;
    }

    // Check if there's any data in the selected period
    const hasData = data.length > 0 && data.some(d => d.count > 0);

    if (!hasData && data.length > 0) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Avg. Occupancy</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">0%</div>
                            <p className="text-xs text-slate-500">for selected period</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-slate-500">Total Capacity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{sites.length}</div>
                            <p className="text-xs text-slate-500">bookable sites</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="p-6">
                    <EmptyState
                        icon={CalendarDays}
                        title="No occupancy data for this period"
                        description="There are no reservations during the selected date range. Try adjusting the date range to see occupancy trends, or check back after bookings are made."
                        size="md"
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Avg. Occupancy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{averageOccupancy}%</div>
                        <p className="text-xs text-slate-500">for selected period</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Capacity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{sites.length}</div>
                        <p className="text-xs text-slate-500">bookable sites</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="p-4">
                <CardHeader>
                    <CardTitle>Occupancy Trend</CardTitle>
                </CardHeader>
                <div className="h-[400px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="date"
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                unit="%"
                                domain={[0, 100]}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                                formatter={(value: number, name: string, props: any) => [
                                    `${value}% (${props.payload.count}/${props.payload.total} sites)`,
                                    "Occupancy"
                                ]}
                            />
                            <Line
                                type="monotone"
                                dataKey="occupancy"
                                stroke="#0ea5e9"
                                strokeWidth={3}
                                dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
