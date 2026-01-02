import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "@/components/charts/recharts";

interface LoyaltyMembershipReportProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

export function LoyaltyMembershipReport({ campgroundId }: LoyaltyMembershipReportProps) {
    const { data: guests, isLoading, error } = useQuery({
        queryKey: ["guests", campgroundId],
        queryFn: () => apiClient.getGuests(),
    });

    const reportData = useMemo(() => {
        if (!guests) return null;

        // Tiers distribution
        const tiers: Record<string, number> = {
            'Bronze': 0,
            'Silver': 0,
            'Gold': 0,
            'Platinum': 0,
            'None': 0
        };

        // Points ranges
        const pointsRanges = [
            { label: '0', min: 0, max: 0, count: 0 },
            { label: '1-500', min: 1, max: 500, count: 0 },
            { label: '501-1000', min: 501, max: 1000, count: 0 },
            { label: '1001-5000', min: 1001, max: 5000, count: 0 },
            { label: '5000+', min: 5001, max: 999999, count: 0 },
        ];

        let totalPoints = 0;
        interface GuestWithLoyalty {
            loyaltyProfile?: {
                tier?: string;
                pointsBalance?: number;
            };
        }

        let membersCount = 0;

        guests.forEach(guest => {
            const guestWithLoyalty = guest as GuestWithLoyalty;
            const profile = guestWithLoyalty.loyaltyProfile;
            if (profile) {
                membersCount++;
                const tier = profile.tier || 'Bronze';
                tiers[tier] = (tiers[tier] || 0) + 1;

                const pts = profile.pointsBalance || 0;
                totalPoints += pts;

                const range = pointsRanges.find(r => pts >= r.min && pts <= r.max);
                if (range) range.count++;
            } else {
                tiers['None']++;
            }
        });

        const tierData = Object.entries(tiers)
            .filter(([_, count]) => count > 0)
            .map(([name, value]) => ({ name, value }));

        const avgPoints = membersCount > 0 ? Math.round(totalPoints / membersCount) : 0;

        return {
            totalGuests: guests.length,
            membersCount,
            adoptionRate: guests.length > 0 ? ((membersCount / guests.length) * 100).toFixed(1) : "0",
            totalPoints,
            avgPoints,
            tierData,
            pointsData: pointsRanges.map(r => ({ name: r.label, count: r.count }))
        };
    }, [guests]);

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading loyalty data...</div>;
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Loyalty Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.membersCount}</div>
                        <p className="text-xs text-slate-500">{reportData.adoptionRate}% adoption</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Avg Points Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.avgPoints.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Total Points Outstanding</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{reportData.totalPoints.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Top Tier Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {reportData.tierData.find(t => t.name === 'Platinum' || t.name === 'Gold')?.value || 0}
                        </div>
                        <p className="text-xs text-slate-500">Gold/Platinum status</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <CardHeader>
                        <CardTitle>Membership Tiers</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reportData.tierData}
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
                                    {reportData.tierData.map((_, index) => (
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
                        <CardTitle>Points Distribution</CardTitle>
                    </CardHeader>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.pointsData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                                <YAxis stroke="#64748b" fontSize={12} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>
        </div>
    );
}
