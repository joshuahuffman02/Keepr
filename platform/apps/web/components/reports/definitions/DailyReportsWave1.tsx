import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

// ============================================
// EARLY CHECK-INS REPORT
// ============================================
export function EarlyCheckInsReport({ campgroundId, dateRange }: DailyReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return [];
        const today = new Date().toISOString().slice(0, 10);
        return reservations.filter(r => {
            if (r.status === 'cancelled') return false;
            const arrival = r.arrivalDate?.slice(0, 10);
            // Consider early if arriving today and has notes mentioning early
            return arrival === today && r.notes?.toLowerCase().includes('early');
        });
    }, [reservations]);

    if (isLoading) return <div className="text-sm text-slate-500">Loading...</div>;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Early Check-ins Today</CardTitle>
                    <p className="text-sm text-slate-500">Guests arriving before standard check-in time</p>
                </CardHeader>
                <CardContent>
                    {reportData.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">No early check-ins scheduled</div>
                    ) : (
                        <div className="space-y-2">
                            {reportData.map(r => (
                                <div key={r.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <div>
                                        <div className="font-medium">{r.guest?.primaryFirstName} {r.guest?.primaryLastName}</div>
                                        <div className="text-sm text-slate-500">Site: {r.site?.name || 'TBD'}</div>
                                    </div>
                                    <div className="text-sm text-slate-600">{r.notes}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// LATE CHECK-OUTS REPORT
// ============================================
export function LateCheckOutsReport({ campgroundId, dateRange }: DailyReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return [];
        const today = new Date().toISOString().slice(0, 10);
        return reservations.filter(r => {
            if (r.status === 'cancelled') return false;
            const departure = r.departureDate?.slice(0, 10);
            return departure === today && r.notes?.toLowerCase().includes('late');
        });
    }, [reservations]);

    if (isLoading) return <div className="text-sm text-slate-500">Loading...</div>;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Late Check-outs Today</CardTitle>
                    <p className="text-sm text-slate-500">Guests departing after standard check-out time</p>
                </CardHeader>
                <CardContent>
                    {reportData.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">No late check-outs scheduled</div>
                    ) : (
                        <div className="space-y-2">
                            {reportData.map(r => (
                                <div key={r.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <div>
                                        <div className="font-medium">{r.guest?.primaryFirstName} {r.guest?.primaryLastName}</div>
                                        <div className="text-sm text-slate-500">Site: {r.site?.name || 'TBD'}</div>
                                    </div>
                                    <div className="text-sm text-slate-600">{r.notes}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// NO-SHOW REPORT
// ============================================
export function NoShowReport({ campgroundId, dateRange }: DailyReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return { noShows: [], total: 0, revenue: 0 };
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);

        const noShows = reservations.filter(r => {
            const arrival = r.arrivalDate?.slice(0, 10);
            // Pending reservations from yesterday that weren't checked in
            return arrival === yesterdayStr && r.status === 'pending';
        });

        return {
            noShows,
            total: noShows.length,
            revenue: noShows.reduce((sum, r) => sum + (r.totalAmount || 0), 0) / 100
        };
    }, [reservations]);

    if (isLoading) return <div className="text-sm text-slate-500">Loading...</div>;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-red-600">No-Shows Yesterday</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900">{reportData.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-slate-500">Revenue at Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${reportData.revenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>No-Show Details</CardTitle>
                </CardHeader>
                <CardContent>
                    {reportData.noShows.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">No missed arrivals</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left">Guest</th>
                                    <th className="px-4 py-2 text-left">Site</th>
                                    <th className="px-4 py-2 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {reportData.noShows.map(r => (
                                    <tr key={r.id}>
                                        <td className="px-4 py-2">{r.guest?.primaryFirstName} {r.guest?.primaryLastName}</td>
                                        <td className="px-4 py-2">{r.site?.name}</td>
                                        <td className="px-4 py-2 text-right">${((r.totalAmount || 0) / 100).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// DUE-OUTS (OVERSTAYS) REPORT
// ============================================
export function DueOutsReport({ campgroundId, dateRange }: DailyReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations) return [];
        const today = new Date().toISOString().slice(0, 10);
        return reservations.filter(r => {
            if (r.status !== 'checked_in') return false;
            const departure = r.departureDate?.slice(0, 10);
            return departure && departure < today; // Past departure but still checked in
        });
    }, [reservations]);

    if (isLoading) return <div className="text-sm text-slate-500">Loading...</div>;

    return (
        <div className="space-y-4">
            <Card className={reportData.length > 0 ? "border-amber-200 bg-amber-50" : ""}>
                <CardHeader>
                    <CardTitle className={reportData.length > 0 ? "text-amber-900" : ""}>
                        Overstays / Due Outs
                    </CardTitle>
                    <p className="text-sm text-slate-500">Guests past their scheduled departure</p>
                </CardHeader>
                <CardContent>
                    {reportData.length === 0 ? (
                        <div className="text-center py-8 text-emerald-600 flex items-center justify-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            No overstays
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {reportData.map(r => (
                                <div key={r.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-amber-200">
                                    <div>
                                        <div className="font-medium">{r.guest?.primaryFirstName} {r.guest?.primaryLastName}</div>
                                        <div className="text-sm text-slate-500">Site: {r.site?.name}</div>
                                    </div>
                                    <div className="text-sm text-amber-700">Due: {r.departureDate?.slice(0, 10)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ============================================
// EXPECTED OCCUPANCY REPORT
// ============================================
export function ExpectedOccupancyReport({ campgroundId, dateRange }: DailyReportProps) {
    const { data: reservations, isLoading } = useQuery({
        queryKey: ["reservations", campgroundId],
        queryFn: () => apiClient.getReservations(campgroundId),
    });
    const { data: sites } = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!reservations || !sites) return null;
        const totalSites = sites.length;
        const today = new Date();

        const forecast = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().slice(0, 10);

            const occupied = reservations.filter(r => {
                if (r.status === 'cancelled') return false;
                const arrival = r.arrivalDate?.slice(0, 10);
                const departure = r.departureDate?.slice(0, 10);
                return arrival && departure && arrival <= dateStr && departure > dateStr;
            }).length;

            forecast.push({
                date: dateStr,
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                occupied,
                occupancy: totalSites > 0 ? ((occupied / totalSites) * 100).toFixed(0) : 0
            });
        }
        return { forecast, totalSites };
    }, [reservations, sites]);

    if (isLoading) return <div className="text-sm text-slate-500">Loading...</div>;
    if (!reportData) return <div className="text-slate-400">No data</div>;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>7-Day Occupancy Forecast</CardTitle>
                    <p className="text-sm text-slate-500">{reportData.totalSites} total sites</p>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-7 gap-2">
                        {reportData.forecast.map(day => (
                            <div key={day.date} className="text-center p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-500">{day.day}</div>
                                <div className="text-lg font-bold">{day.occupancy}%</div>
                                <div className="text-xs text-slate-400">{day.occupied} sites</div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
