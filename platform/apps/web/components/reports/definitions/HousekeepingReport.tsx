import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, AlertCircle, Sparkles } from "lucide-react";

interface HousekeepingReportProps {
    campgroundId: string;
}

export function HousekeepingReport({ campgroundId }: HousekeepingReportProps) {
    const { data: sites, isLoading } = useQuery({
        queryKey: ["sites", campgroundId],
        queryFn: () => apiClient.getSites(campgroundId),
    });

    const reportData = useMemo(() => {
        if (!sites) return { clean: [], dirty: [], inspecting: [], other: [] };

        const clean: any[] = [];
        const dirty: any[] = [];
        const inspecting: any[] = [];
        const other: any[] = [];

        sites.forEach(site => {
            const status = (site.housekeepingStatus || 'clean').toLowerCase();
            if (status === 'clean') clean.push(site);
            else if (status === 'dirty') dirty.push(site);
            else if (status === 'inspecting') inspecting.push(site);
            else other.push(site);
        });

        return { clean, dirty, inspecting, other };
    }, [sites]);

    if (isLoading) {
        return <div className="text-sm text-muted-foreground">Loading housekeeping status...</div>;
    }

    if (!sites) {
        return <div className="text-sm text-muted-foreground">No sites found.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-emerald-50 border-emerald-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-700">Clean</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-800">{reportData.clean.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-rose-50 border-rose-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-rose-700">Dirty</CardTitle>
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-800">{reportData.dirty.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-700">Inspecting</CardTitle>
                        <Circle className="h-4 w-4 text-amber-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-800">{reportData.inspecting.length}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Dirty Sites List */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-rose-500" />
                    Requires Cleaning ({reportData.dirty.length})
                </h3>
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-muted text-xs uppercase font-semibold text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3">Site</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {reportData.dirty.length === 0 ? (
                                <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">All clean!</td></tr>
                            ) : (
                                reportData.dirty.map((s) => (
                                    <tr key={s.id} className="hover:bg-muted">
                                        <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                                        <td className="px-4 py-3 text-muted-foreground">{s.siteClassId || "Standard"}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="destructive">Dirty</Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Other Lists (Collapsible or Secondary) */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Inspecting ({reportData.inspecting.length})</h3>
                {reportData.inspecting.length > 0 && (
                    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <table className="min-w-full text-sm text-left">
                            <tbody className="divide-y divide-border">
                                {reportData.inspecting.map((s) => (
                                    <tr key={s.id} className="hover:bg-muted">
                                        <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                                        <td className="px-4 py-3"><Badge variant="secondary">Inspecting</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
