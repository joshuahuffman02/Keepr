import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface GuestBehaviorReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

export function GuestBehaviorReport({ campgroundId, dateRange }: GuestBehaviorReportProps) {
    const { data: reservations, isLoading, error } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return null;

        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);

        // Filter reservations in date range
        const filtered = reservations.filter(r => {
            if (r.status === 'cancelled') return false;
            const arrivalDate = new Date(r.arrivalDate);
            return arrivalDate >= start && arrivalDate <= end;
        });

        if (filtered.length === 0) return null;

        // Calculate lead time (days between booking and arrival)
        const leadTimes: number[] = [];
        filtered.forEach(r => {
            if (r.createdAt && r.arrivalDate) {
                const booked = new Date(r.createdAt);
                const arrival = new Date(r.arrivalDate);
                const days = Math.floor((arrival.getTime() - booked.getTime()) / (1000 * 60 * 60 * 24));
                if (days >= 0) leadTimes.push(days);
            }
        });

        // Calculate length of stay
        const losValues: number[] = [];
        filtered.forEach(r => {
            if (r.arrivalDate && r.departureDate) {
                const arrival = new Date(r.arrivalDate);
                const departure = new Date(r.departureDate);
                const nights = Math.floor((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
                if (nights > 0) losValues.push(nights);
            }
        });

        // Calculate cancellation rate
        const allInRange = reservations.filter(r => {
            const arrivalDate = new Date(r.arrivalDate);
            return arrivalDate >= start && arrivalDate <= end;
        });
        const cancelledCount = allInRange.filter(r => r.status === 'cancelled').length;
        const cancellationRate = allInRange.length > 0 ? (cancelledCount / allInRange.length) * 100 : 0;

        // Lead time distribution buckets
        const leadTimeBuckets = [
            { label: 'Same day', min: 0, max: 0 },
            { label: '1-3 days', min: 1, max: 3 },
            { label: '4-7 days', min: 4, max: 7 },
            { label: '1-2 weeks', min: 8, max: 14 },
            { label: '2-4 weeks', min: 15, max: 30 },
            { label: '1+ month', min: 31, max: 999 },
        ];
        const leadTimeData = leadTimeBuckets.map(bucket => ({
            name: bucket.label,
            count: leadTimes.filter(lt => lt >= bucket.min && lt <= bucket.max).length,
        }));

        // LOS distribution buckets
        const losBuckets = [
            { label: '1 night', min: 1, max: 1 },
            { label: '2 nights', min: 2, max: 2 },
            { label: '3-4 nights', min: 3, max: 4 },
            { label: '5-7 nights', min: 5, max: 7 },
            { label: '1-2 weeks', min: 8, max: 14 },
            { label: '2+ weeks', min: 15, max: 999 },
        ];
        const losData = losBuckets.map(bucket => ({
            name: bucket.label,
            count: losValues.filter(los => los >= bucket.min && los <= bucket.max).length,
        }));

        return {
            totalBookings: filtered.length,
            avgLeadTime: leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 0,
            avgLOS: losValues.length > 0 ? (losValues.reduce((a, b) => a + b, 0) / losValues.length).toFixed(1) : '0',
            cancellationRate: cancellationRate.toFixed(1),
            cancelledCount,
            leadTimeData,
            losData,
        };
    }, [reservations, dateRange]);

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading behavior data...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-500">Failed to load reservation data.</div>;
    }

    if (!reportData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 mb-2">No booking data found</div>
                <p className="text-xs text-slate-500">Try adjusting the date range.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Bookings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.totalBookings}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Avg Lead Time</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.avgLeadTime} days</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Avg Length of Stay</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.avgLOS} nights</div>
                    </CardContent>
                </Card>
                <Card className={Number(reportData.cancellationRate) > 10 ? "border-amber-200 bg-amber-50" : ""}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Cancellation Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.cancellationRate}%</div>
                        <p className="text-xs text-slate-500">{reportData.cancelledCount} cancelled</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Lead Time Distribution</CardTitle>
                        <p className="text-xs text-slate-500">Days between booking and arrival</p>
                    </CardHeader>
                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.leadTimeData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {reportData.leadTimeData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Length of Stay Distribution</CardTitle>
                        <p className="text-xs text-slate-500">Nights per reservation</p>
                    </CardHeader>
                    <div className="h-[250px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.losData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {reportData.losData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}
