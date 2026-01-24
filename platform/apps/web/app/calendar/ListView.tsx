"use client";

import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Calendar,
  MapPin,
  User,
  DollarSign,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import type { CalendarReservation, CalendarSite } from "./types";

interface ListViewProps {
  reservations: CalendarReservation[];
  sites: CalendarSite[];
  onReservationClick: (reservation: CalendarReservation) => void;
  onNewBooking?: (siteId: string, arrivalDate: string, departureDate: string) => void;
  allowOps?: boolean;
}

type GroupMode = "date" | "site" | "none";

export function ListView({
  reservations,
  sites,
  onReservationClick,
  onNewBooking,
  allowOps = false,
}: ListViewProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>("date");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);
  const [newBookingData, setNewBookingData] = useState({
    siteId: "",
    arrivalDate: "",
    departureDate: "",
  });

  // Group reservations based on mode
  const groupedReservations = useMemo(() => {
    const sorted = [...reservations].sort(
      (a, b) => new Date(a.arrivalDate).getTime() - new Date(b.arrivalDate).getTime(),
    );

    if (groupMode === "none") {
      return { "All Reservations": sorted };
    }

    if (groupMode === "date") {
      const groups: Record<string, CalendarReservation[]> = {};
      sorted.forEach((res) => {
        const date = new Date(res.arrivalDate).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        if (!groups[date]) groups[date] = [];
        groups[date].push(res);
      });
      return groups;
    }

    if (groupMode === "site") {
      const groups: Record<string, CalendarReservation[]> = {};
      sorted.forEach((res) => {
        const site = sites.find((s) => s.id === res.siteId);
        const siteName = site?.name || "Unassigned";
        if (!groups[siteName]) groups[siteName] = [];
        groups[siteName].push(res);
      });
      return groups;
    }

    return {};
  }, [reservations, sites, groupMode]);

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const handleNewBookingSubmit = () => {
    if (
      onNewBooking &&
      newBookingData.siteId &&
      newBookingData.arrivalDate &&
      newBookingData.departureDate
    ) {
      onNewBooking(newBookingData.siteId, newBookingData.arrivalDate, newBookingData.departureDate);
      setNewBookingModalOpen(false);
      setNewBookingData({ siteId: "", arrivalDate: "", departureDate: "" });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "checked_in":
        return "bg-status-info";
      case "confirmed":
        return "bg-status-success";
      case "pending":
        return "bg-status-warning";
      default:
        return "bg-muted-foreground";
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={groupMode === "date" ? "default" : "outline"}
            onClick={() => setGroupMode("date")}
          >
            Group by Date
          </Button>
          <Button
            size="sm"
            variant={groupMode === "site" ? "default" : "outline"}
            onClick={() => setGroupMode("site")}
          >
            Group by Site
          </Button>
          <Button
            size="sm"
            variant={groupMode === "none" ? "default" : "outline"}
            onClick={() => setGroupMode("none")}
          >
            No Grouping
          </Button>
        </div>

        {allowOps && onNewBooking && (
          <Button
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setNewBookingModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {Object.entries(groupedReservations).map(([groupKey, groupReservations]) => {
          const isExpanded = expandedGroups.has(groupKey) || groupMode === "none";

          return (
            <div
              key={groupKey}
              className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
            >
              {/* Group Header */}
              {groupMode !== "none" && (
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full px-4 py-3 bg-muted border-b border-border flex items-center justify-between hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {groupMode === "date" ? (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-semibold text-foreground">{groupKey}</span>
                    <Badge variant="outline" className="text-xs">
                      {groupReservations.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}

              {/* Group Items */}
              {isExpanded && (
                <div className="divide-y divide-border">
                  {groupReservations.map((res) => {
                    const site = sites.find((s) => s.id === res.siteId);
                    const balanceAmount =
                      typeof res.balanceAmount === "number" ? res.balanceAmount : 0;
                    const hasBalance = balanceAmount > 0;
                    const statusColor = getStatusColor(res.status);

                    return (
                      <div
                        key={res.id}
                        className="p-4 hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => onReservationClick(res)}
                      >
                        {/* Mobile-friendly card layout */}
                        <div className="space-y-3">
                          {/* Top Row: Status & Guest Name */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-1 h-12 rounded-full ${statusColor}`} />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-foreground text-base truncate">
                                  {res.guest?.primaryFirstName} {res.guest?.primaryLastName}
                                </div>
                                <Badge variant="outline" className="text-xs capitalize mt-1">
                                  {res.status?.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                            {hasBalance && (
                              <Badge variant="destructive" className="text-xs shrink-0">
                                Balance Due
                              </Badge>
                            )}
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            {/* Site */}
                            <div className="flex items-center gap-2 text-foreground">
                              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium">{site?.name || "Unassigned"}</span>
                              {site?.siteType && (
                                <span className="text-xs text-muted-foreground capitalize">
                                  ({site.siteType.replace(/_/g, " ")})
                                </span>
                              )}
                            </div>

                            {/* Dates */}
                            <div className="flex items-center gap-2 text-foreground">
                              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span>
                                {new Date(res.arrivalDate).toLocaleDateString()} →{" "}
                                {new Date(res.departureDate).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Guest Count */}
                            {(res.adults || res.children || res.pets) && (
                              <div className="flex items-center gap-2 text-foreground">
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span>
                                  {res.adults || 0} adults
                                  {res.children ? `, ${res.children} children` : ""}
                                  {res.pets ? `, ${res.pets} pets` : ""}
                                </span>
                              </div>
                            )}

                            {/* Total Amount */}
                            {res.totalAmount && (
                              <div className="flex items-center gap-2 text-foreground">
                                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-semibold">
                                  {formatCurrency(res.totalAmount)}
                                  {hasBalance && (
                                    <span className="text-status-error text-xs ml-2">
                                      (Owe: {formatCurrency(balanceAmount)})
                                    </span>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Channel/Source */}
                          {(res.channel || res.bookingChannel || res.source) && (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {res.channel || res.bookingChannel || res.source}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {groupReservations.length === 0 && (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No reservations in this group
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(groupedReservations).length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No reservations found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or date range
            </p>
          </div>
        )}
      </div>

      {/* New Booking Modal */}
      <Dialog open={newBookingModalOpen} onOpenChange={setNewBookingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Site</label>
              <select
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={newBookingData.siteId}
                onChange={(e) => setNewBookingData({ ...newBookingData, siteId: e.target.value })}
              >
                <option value="">Select a site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.siteType?.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Check-in Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={newBookingData.arrivalDate}
                onChange={(e) =>
                  setNewBookingData({ ...newBookingData, arrivalDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Check-out Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-border px-3 py-2 text-sm"
                value={newBookingData.departureDate}
                onChange={(e) =>
                  setNewBookingData({ ...newBookingData, departureDate: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setNewBookingModalOpen(false);
                  setNewBookingData({ siteId: "", arrivalDate: "", departureDate: "" });
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleNewBookingSubmit}
                disabled={
                  !newBookingData.siteId ||
                  !newBookingData.arrivalDate ||
                  !newBookingData.departureDate
                }
              >
                Create Booking
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
