import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "@/components/charts/recharts";

interface DemographicsReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

export function DemographicsReport({ campgroundId, dateRange }: DemographicsReportProps) {
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

        // Party size distribution
        const partySizes: number[] = [];
        filtered.forEach(r => {
            const numGuests = (r.adults || 1) + (r.children || 0);
            partySizes.push(numGuests);
        });

        const partySizeBuckets = [
            { label: '1 person', min: 1, max: 1 },
            { label: '2 people', min: 2, max: 2 },
            { label: '3-4 people', min: 3, max: 4 },
            { label: '5-6 people', min: 5, max: 6 },
            { label: '7+ people', min: 7, max: 999 },
        ];
        const partySizeData = partySizeBuckets.map(bucket => ({
            name: bucket.label,
            value: partySizes.filter(ps => ps >= bucket.min && ps <= bucket.max).length,
        }));

        let totalAdults = 0;
        let totalChildren = 0;
        filtered.forEach(r => {
            totalAdults += r.adults || 1;
            totalChildren += r.children || 0;
        });

        const avgPartySize = partySizes.length > 0
            ? (partySizes.reduce((a, b) => a + b, 0) / partySizes.length).toFixed(1)
            : '0';

        return {
            totalReservations: filtered.length,
            avgPartySize,
            totalGuests: totalAdults + totalChildren,
            totalAdults,
            totalChildren,
            partySizeData: partySizeData.filter(d => d.value > 0),
        };
    }, [reservations, dateRange]);

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading demographics data...</div>;
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
                        <CardTitle className="text-sm font-medium text-slate-500">Total Reservations</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.totalReservations}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Avg Party Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.avgPartySize}</div>
                    </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600">Total Adults</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{reportData.totalAdults}</div>
                    </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-600">Total Children</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-900">{reportData.totalChildren}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Party Size Distribution</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reportData.partySizeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {reportData.partySizeData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Party Size Breakdown</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.partySizeData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" stroke="#64748b" fontSize={12} />
                                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} width={80} />
                                <Tooltip />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {reportData.partySizeData.map((_, index) => (
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
