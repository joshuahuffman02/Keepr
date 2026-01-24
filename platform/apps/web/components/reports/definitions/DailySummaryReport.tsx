import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownRight,
  ArrowUpRight,
  BedDouble,
  CalendarDays,
  DollarSign,
  Users,
  Wrench,
} from "lucide-react";

const formatCurrencyLocal = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

interface DailySummaryReportProps {
  campgroundId: string;
  dateRange: { start: string; end: string };
}

export function DailySummaryReport({ campgroundId, dateRange }: DailySummaryReportProps) {
  // Fetch all necessary data
  const { data: reservations } = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
  });

  const { data: sites } = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId),
  });

  const { data: ledgerEntries } = useQuery({
    queryKey: ["ledger", campgroundId],
    queryFn: () => apiClient.getLedgerEntries(campgroundId),
  });

  const { data: tickets } = useQuery({
    queryKey: ["maintenance", campgroundId],
    queryFn: () => apiClient.getMaintenanceTickets(undefined, campgroundId),
  });

  const summary = useMemo(() => {
    if (!reservations || !sites || !ledgerEntries || !tickets) return null;

    const start = startOfDay(new Date(dateRange.start));
    const end = endOfDay(new Date(dateRange.end));

    // 1. Operations: Arrivals & Departures
    const arrivals = reservations.filter((r) => {
      if (r.status === "cancelled") return false;
      const d = startOfDay(new Date(r.arrivalDate));
      return d >= start && d <= end; // Usually "Arrivals today" means exact date match if range is 1 day
    }).length;

    const departures = reservations.filter((r) => {
      if (r.status === "cancelled") return false;
      const d = startOfDay(new Date(r.departureDate));
      return d >= start && d <= end;
    }).length;

    const inHouse = reservations.filter((r) => {
      if (r.status === "cancelled") return false;
      // Overlap logic: arrival <= range_end AND departure >= range_start
      const rStart = startOfDay(new Date(r.arrivalDate));
      const rEnd = startOfDay(new Date(r.departureDate));
      return rStart <= end && rEnd > start; // rEnd > start because departure day is partially open? Usually check out by 11am.
      // Simplified overlap:
      // arrival < end AND departure > start
    }).length;

    // 2. Occupancy (Avg over period)
    const totalSiteDays =
      sites.length * ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    // Rough total capacity days.
    // Better: sum occupied per day.
    // Let's use simple InHouse count / Total Sites (if 1 day selected)
    const occupancy = sites.length > 0 ? Math.round((inHouse / sites.length) * 100) : 0;
    // Note: For multi-day range, direct division is weird. But usually "Period Summary" shows aggregate totals.
    // If range > 1 day, "inHouse" is "Unique reservations touching this period".
    // Let's skip complex average occupancy math here (Occupancy Report does it better)
    // and just show "Guests in House" count.

    // 3. Revenue
    const revenueEntries = ledgerEntries.filter((e) => {
      const d = new Date(e.occurredAt);
      return (
        isWithinInterval(d, { start, end }) &&
        (e.direction === "credit" || e.description?.toLowerCase().includes("charge"))
      );
    });
    const revenue = revenueEntries.reduce((sum, e) => sum + e.amountCents, 0) / 100;

    // 4. Maintenance
    const openTickets = tickets.filter((t) => t.status !== "closed").length;
    const closedTickets = tickets.filter((t) => {
      const d = t.resolvedAt
        ? new Date(t.resolvedAt)
        : new Date(t.updatedAt || t.createdAt || new Date());
      return t.status === "closed" && d >= start && d <= end;
    }).length;

    return {
      arrivals,
      departures,
      inHouse,
      occupancy,
      revenue,
      openTickets,
      closedTickets,
      siteCount: sites.length,
    };
  }, [reservations, sites, ledgerEntries, tickets, dateRange]);

  if (!summary) {
    return <div className="text-sm text-muted-foreground">Loading summary data...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">
        Summary for{" "}
        {dateRange.start === dateRange.end
          ? format(new Date(dateRange.start), "MMM d")
          : `${dateRange.start} - ${dateRange.end}`}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Arrivals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Arrivals</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.arrivals}</div>
            <p className="text-xs text-muted-foreground">Expect Check-ins</p>
          </CardContent>
        </Card>

        {/* Departures */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Departures</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.departures}</div>
            <p className="text-xs text-muted-foreground">Expect Check-outs</p>
          </CardContent>
        </Card>

        {/* In House */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In House</CardTitle>
            <BedDouble className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.inHouse}</div>
            <p className="text-xs text-muted-foreground">
              Occupied Sites ({summary.occupancy}% peak)
            </p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrencyLocal(summary.revenue)}</div>
            <p className="text-xs text-muted-foreground">Charges posted</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Maintenance */}
        <Card className="border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-base font-semibold text-foreground">
                Maintenance Issues
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-3xl font-bold text-foreground">{summary.openTickets}</span>
                <span className="text-sm text-muted-foreground ml-2">Active</span>
              </div>
              <div className="text-right">
                <span className="text-xl font-semibold text-foreground">
                  {summary.closedTickets}
                </span>
                <span className="text-sm text-muted-foreground ml-2">Closed today</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
