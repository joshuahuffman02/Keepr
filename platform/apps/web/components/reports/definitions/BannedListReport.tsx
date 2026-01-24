import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Ban } from "lucide-react";

interface BannedListReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

export function BannedListReport({ campgroundId }: BannedListReportProps) {
  const {
    data: guests,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["guests", campgroundId],
    queryFn: () => apiClient.getGuests(),
  });

  const reportData = useMemo(() => {
    if (!guests) return null;

    const bannedTags = ["banned", "dnr", "do-not-rent", "restricted", "blocked"];

    const bannedGuests = guests.filter((g) => {
      if (!g.tags || g.tags.length === 0) return false;
      return g.tags.some((tag) => bannedTags.includes(tag.toLowerCase()));
    });

    // Group by reason (tag)
    const reasonCounts: Record<string, number> = {};
    bannedGuests.forEach((g) => {
      const reason = g.tags?.find((tag) => bannedTags.includes(tag.toLowerCase())) || "Unknown";
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });

    const activeBans = bannedGuests.length;
    // Mock recent addition logic since tags don't have timestamps in this view
    const newThisMonth = 0;

    return {
      totalGuests: guests.length,
      activeBans,
      banRate: guests.length > 0 ? ((activeBans / guests.length) * 100).toFixed(2) : "0",
      bannedGuests: bannedGuests.slice(0, 10), // Show top 10
      reasons: Object.entries(reasonCounts).map(([name, count]) => ({ name, count })),
    };
  }, [guests]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading restricted guest list...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500">Failed to load guest data.</div>;
  }

  if (!reportData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-muted rounded-lg border border-border">
        <div className="text-muted-foreground mb-2">No guest data found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Active DNR List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Ban className="h-6 w-6 text-red-600" />
              <div className="text-2xl font-bold text-red-900">{reportData.activeBans}</div>
            </div>
            <p className="text-xs text-red-600/80">{reportData.banRate}% of guest database</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Restricted Guests</CardTitle>
        </CardHeader>
        <CardContent>
          {reportData.bannedGuests.length > 0 ? (
            <div className="rounded-md border">
              <div className="grid grid-cols-4 gap-4 p-3 bg-muted border-b text-xs font-medium text-muted-foreground uppercase">
                <div className="col-span-1">Name</div>
                <div className="col-span-1">Email</div>
                <div className="col-span-1">Phone</div>
                <div className="col-span-1">Restriction</div>
              </div>
              <div className="divide-y">
                {reportData.bannedGuests.map((guest) => (
                  <div key={guest.id} className="grid grid-cols-4 gap-4 p-3 text-sm hover:bg-muted">
                    <div className="font-medium">
                      {guest.primaryFirstName} {guest.primaryLastName}
                    </div>
                    <div className="text-muted-foreground truncate">{guest.email}</div>
                    <div className="text-muted-foreground">{guest.phone || "-"}</div>
                    <div>
                      {guest.tags
                        ?.filter((t) => ["banned", "dnr", "restricted"].includes(t.toLowerCase()))
                        .map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-status-error-bg text-status-error-text uppercase"
                          >
                            {tag}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p>No guests currently flagged as Do Not Rent.</p>
              <p className="text-xs mt-1">
                To ban a guest, add the "banned" or "dnr" tag to their profile.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
