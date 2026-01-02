import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Loader2, Monitor, User, Store, Phone, Footprints } from "lucide-react";

interface BookingSourcesData {
    totalBookings: number;
    bySource: Record<string, { count: number; revenue: number }>;
    byLeadTime: Record<string, number>;
}

interface BookingSourcesTabProps {
    campgroundId: string;
    dateRange: { start: string; end: string };
}

export function BookingSourcesTab({ campgroundId, dateRange }: BookingSourcesTabProps) {
    const { data, isLoading } = useQuery({
        queryKey: ["reports-booking-sources", campgroundId, dateRange],
        queryFn: () => apiClient.getBookingSources(campgroundId, {
            startDate: dateRange.start,
            endDate: dateRange.end
        }),
        enabled: !!campgroundId
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!data) return <div>No data available</div>;

    const typedData = data as unknown as BookingSourcesData;
    const totalBookings = typedData.totalBookings || 0;

    // Helper for percentage
    const getPercent = (val: number) => totalBookings > 0 ? (val / totalBookings) * 100 : 0;

    const sourceConfig = [
        { key: "online", label: "Online", icon: Monitor, color: "bg-blue-500" },
        { key: "admin", label: "Admin/Staff", icon: User, color: "bg-purple-500" },
        { key: "kiosk", label: "Kiosk", icon: Store, color: "bg-emerald-500" },
        { key: "phone", label: "Phone", icon: Phone, color: "bg-amber-500" },
        { key: "walk_in", label: "Walk-in", icon: Footprints, color: "bg-rose-500" },
    ];

    const leadTimeConfig = [
        { key: "sameDay", label: "Same Day" },
        { key: "nextDay", label: "1 Day" },
        { key: "twoDays", label: "2 Days" },
        { key: "threeToSeven", label: "3-7 Days" },
        { key: "oneToTwoWeeks", label: "1-2 Weeks" },
        { key: "twoToFourWeeks", label: "2-4 Weeks" },
        { key: "oneToThreeMonths", label: "1-3 Months" },
        { key: "threeMonthsPlus", label: "3+ Months" },
    ];

    return (
        <div className="space-y-6">
            {/* Sources Overview */}
            <h3 className="text-lg font-semibold text-foreground">Booking Channels</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sourceConfig.map((source) => {
                    const stats = typedData.bySource[source.key] || { count: 0, revenue: 0 };
                    return (
                        <Card key={source.key}>
                            <CardContent className="pt-6">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-2 rounded-lg ${source.color} bg-opacity-10 text-${source.color.split('-')[1]}-600`}>
                                            <source.icon className="w-5 h-5" />
                                        </div>
                                        <span className="font-medium text-foreground">{source.label}</span>
                                    </div>
                                    <span className="text-2xl font-bold">{stats.count}</span>
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>Revenue</span>
                                    <span className="font-medium text-foreground">${stats.revenue.toLocaleString()}</span>
                                </div>
                                <div className="mt-3 h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${source.color}`}
                                        style={{ width: `${getPercent(stats.count)}%` }}
                                    />
                                </div>
                                <div className="mt-1 text-xs text-right text-muted-foreground">
                                    {getPercent(stats.count).toFixed(1)}% of bookings
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Lead Time */}
            <Card>
                <CardHeader>
                    <CardTitle>Booking Lead Time</CardTitle>
                    <CardDescription>How far in advance guests are booking</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {leadTimeConfig.map((item) => {
                            const count = typedData.byLeadTime[item.key] || 0;
                            const percent = getPercent(count);
                            return (
                                <div key={item.key} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-foreground">{item.label}</span>
                                        <span className="text-muted-foreground">{count} bookings ({percent.toFixed(1)}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500"
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
