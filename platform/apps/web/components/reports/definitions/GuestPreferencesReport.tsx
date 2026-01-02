import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "@/components/charts/recharts";

interface GuestPreferencesReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4'];

export function GuestPreferencesReport({ campgroundId }: GuestPreferencesReportProps) {
    const { data: guests, isLoading, error } = useQuery({
        queryKey: ["guests", campgroundId],
        queryFn: () => apiClient.getGuests(),
    });

    const reportData = useMemo(() => {
        if (!guests) return null;

        const preferencesCounts: Record<string, number> = {};
        interface GuestWithPreferences {
            preferences?: {
                siteType?: string;
                [key: string]: unknown;
            };
        }

        const siteTypeCounts: Record<string, number> = {};
        let guestsWithPreferences = 0;

        guests.forEach(guest => {
            const guestWithPrefs = guest as GuestWithPreferences;
            const prefs = guestWithPrefs.preferences;
            if (prefs) {
                let hasPref = false;

                // Track site types
                if (prefs.siteType) {
                    siteTypeCounts[prefs.siteType] = (siteTypeCounts[prefs.siteType] || 0) + 1;
                    hasPref = true;
                }

                // Track other boolean flags or string values
                Object.entries(prefs).forEach(([key, value]) => {
                    if (key === 'siteType') return; // Handled separate

                    if (value === true) {
                        preferencesCounts[key] = (preferencesCounts[key] || 0) + 1;
                        hasPref = true;
                    } else if (typeof value === 'string' && value.length < 20) {
                        // aggregate short strings like "Near bathhouse"
                        const compoundKey = `${key}: ${value}`;
                        preferencesCounts[compoundKey] = (preferencesCounts[compoundKey] || 0) + 1;
                        hasPref = true;
                    }
                });

                if (hasPref) guestsWithPreferences++;
            }
        });

        const topPreferences = Object.entries(preferencesCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }));

        const topSiteTypes = Object.entries(siteTypeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }));

        return {
            totalGuests: guests.length,
            guestsWithPreferences,
            percentDocumented: guests.length > 0 ? ((guestsWithPreferences / guests.length) * 100).toFixed(1) : "0",
            topPreferences,
            topSiteTypes
        };
    }, [guests]);

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading preferences data...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-500">Failed to load guest data.</div>;
    }

    if (!reportData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-slate-400 mb-2">No guest data found</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Guests with Preferences</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.guestsWithPreferences}</div>
                        <p className="text-xs text-slate-500">{reportData.percentDocumented}% of database</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Most Requested</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold truncate">
                            {reportData.topPreferences[0]?.name || "N/A"}
                        </div>
                        <p className="text-xs text-slate-500">Top preference</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Preferred Site Types</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        {reportData.topSiteTypes.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reportData.topSiteTypes} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">No site preference data</div>
                        )}
                    </div>
                </Card>

                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Common Requests/Amenities</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        {reportData.topPreferences.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={reportData.topPreferences} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                        {reportData.topPreferences.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400 text-sm">No specific preferences recorded</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
