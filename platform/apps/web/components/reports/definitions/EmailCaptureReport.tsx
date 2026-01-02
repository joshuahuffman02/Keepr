import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "@/components/charts/recharts";

interface EmailCaptureReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#22c55e', '#ef4444']; // Green (has email), Red (no email)

export function EmailCaptureReport({ campgroundId, dateRange }: EmailCaptureReportProps) {
    const { data: reservations, isLoading, error } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return null;

        // Track unique guests
        const seenGuests = new Set<string>();
        let withEmail = 0;
        let withoutEmail = 0;
        let withPhone = 0;
        let withBothEmailAndPhone = 0;

        reservations.forEach(r => {
            if (r.status === 'cancelled' || !r.guestId) return;
            if (seenGuests.has(r.guestId)) return;
            seenGuests.add(r.guestId);

            const hasEmail = !!r.guest?.email;
            const hasPhone = !!r.guest?.phone;

            if (hasEmail) withEmail++;
            else withoutEmail++;

            if (hasPhone) withPhone++;
            if (hasEmail && hasPhone) withBothEmailAndPhone++;
        });

        const totalGuests = withEmail + withoutEmail;
        const emailCaptureRate = totalGuests > 0 ? ((withEmail / totalGuests) * 100).toFixed(1) : '0';
        const phoneCaptureRate = totalGuests > 0 ? ((withPhone / totalGuests) * 100).toFixed(1) : '0';

        const pieData = [
            { name: 'Has Email', value: withEmail },
            { name: 'No Email', value: withoutEmail },
        ];

        return {
            totalGuests,
            withEmail,
            withoutEmail,
            withPhone,
            withBothEmailAndPhone,
            emailCaptureRate,
            phoneCaptureRate,
            pieData,
        };
    }, [reservations]);

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading guest data...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-500">Failed to load reservation data.</div>;
    }

    if (!reportData || reportData.totalGuests === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 mb-2">No guest data found</div>
                <p className="text-xs text-slate-500">Guests will appear after reservations are made.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Guests</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.totalGuests}</div>
                    </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600">Email Capture Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-900">{reportData.emailCaptureRate}%</div>
                        <p className="text-xs text-emerald-600">{reportData.withEmail} guests</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600">Phone Capture Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{reportData.phoneCaptureRate}%</div>
                        <p className="text-xs text-blue-600">{reportData.withPhone} guests</p>
                    </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-purple-600">Both Email & Phone</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-900">{reportData.withBothEmailAndPhone}</div>
                        <p className="text-xs text-purple-600">complete contacts</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Email Capture Breakdown</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
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
                                    label={({ name, percent }: { name?: string; percent?: number }) =>
                                        `${name ?? "Unknown"} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                    }
                                >
                                    {reportData.pieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Insights Card */}
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Contact Database Insights</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <div className="text-lg font-bold text-emerald-900">{reportData.withEmail} guests</div>
                                <p className="text-sm text-emerald-700">have valid email addresses for marketing</p>
                            </div>

                            {reportData.withoutEmail > 0 && (
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                                    <div className="text-lg font-bold text-amber-900">{reportData.withoutEmail} guests</div>
                                    <p className="text-sm text-amber-700">are missing email addresses</p>
                                    <p className="text-xs text-amber-600 mt-2">
                                        Consider collecting emails at check-in to grow your marketing database.
                                    </p>
                                </div>
                            )}

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <div className="text-sm font-medium text-slate-700">Tips to improve capture rate:</div>
                                <ul className="text-xs text-slate-600 mt-2 space-y-1">
                                    <li>• Require email during online booking</li>
                                    <li>• Collect during kiosk check-in</li>
                                    <li>• Offer discounts for newsletter signup</li>
                                </ul>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
