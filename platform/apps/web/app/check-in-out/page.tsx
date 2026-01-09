"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Eye,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  Search,
  Sparkles,
  Tag,
  Users,
  UserCheck,
  Home,
  ChevronDown
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { PageHeader } from "@/components/ui/layout/PageHeader";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { PaymentCollectionModal } from "@/components/payments/PaymentCollectionModal";
import { cn } from "@/lib/utils";

type Reservation = {
  id: string;
  status: string;
  arrivalDate: string;
  departureDate: string;
  balanceAmount: number;
  totalAmount?: number;
  paidAmount?: number;
  nights?: number;
  adults?: number;
  children?: number;
  siteId?: string | null;
  site?: { name?: string };
  guest: { id?: string; email?: string; primaryFirstName: string; primaryLastName: string };
  notes?: string | null;
};

// Helper to get today's date as YYYY-MM-DD string
function getTodayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CheckInOutPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Track client-side hydration to prevent SSR mismatch
  const [hasMounted, setHasMounted] = useState(false);

  // Use empty string for SSR, then set on client to prevent hydration mismatch
  // (server time may differ from client time due to timezone differences)
  const [date, setDate] = useState("");
  const [campgroundId, setCampgroundId] = useState<string>("");

  // Format date label safely (only on client after date is set)
  const dateLabel = useMemo(() => {
    if (!date) return "Today";
    return format(new Date(`${date}T00:00:00`), "EEE, MMM d");
  }, [date]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "balance" | "unassigned">("all");
  const [tab, setTab] = useState<"arrivals" | "departures" | "onsite">("arrivals");
  const [sortBy, setSortBy] = useState<"name" | "site" | "balance" | "date">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Message modal
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageType, setMessageType] = useState<"sms" | "email">("sms");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  // Payment modal
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash"); // Default to cash for manual entry
  const [isStripePaymentOpen, setIsStripePaymentOpen] = useState(false);
  const [checkInAfterPayment, setCheckInAfterPayment] = useState(false);
  const [checkOutAfterPayment, setCheckOutAfterPayment] = useState(false);

  // Initialize date and campground on mount (client-only)
  useEffect(() => {
    // Set today's date on client to avoid SSR mismatch
    setDate(getTodayDateString());

    // Get campground from localStorage
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);

    setHasMounted(true);
  }, []);

  const reservationsQuery = useQuery({
    queryKey: ["reservations", campgroundId],
    queryFn: () => apiClient.getReservations(campgroundId),
    enabled: !!campgroundId
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => apiClient.checkInReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      toast({ title: "Guest checked in" });
    },
    onError: () => toast({ title: "Failed to check in", description: "Unable to check in guest. Verify payment status and try again", variant: "destructive" })
  });

  const bulkCheckInMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiClient.checkInReservation(id))
      );
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.filter((r) => r.status === "rejected").length;

      if (failCount === 0) {
        toast({ title: `${successCount} guests checked in successfully` });
      } else {
        toast({
          title: `${successCount} checked in, ${failCount} failed`,
          description: "Some check-ins could not be completed",
          variant: "destructive"
        });
      }
      setSelectedIds(new Set());
    },
    onError: () => {
      toast({ title: "Bulk check-in failed", description: "Unable to process multiple check-ins. Try checking in guests individually", variant: "destructive" });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => apiClient.checkOutReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      toast({ title: "Guest checked out" });
      setIsPaymentOpen(false);
    },
    onError: () => toast({ title: "Failed to check out", description: "Unable to check out guest. Ensure all charges are settled and try again", variant: "destructive" })
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { id: string; amount: number; method: "card" | "cash" | "check" | "folio" }) =>
      apiClient.recordReservationPayment(data.id, data.amount, [
        { method: data.method, amountCents: data.amount }
      ]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      toast({ title: "Payment recorded" });
      setIsPaymentOpen(false);
    },
    onError: () => toast({ title: "Payment failed", variant: "destructive" })
  });

  const reservations = (reservationsQuery.data as Reservation[]) || [];

  // Helper to compare dates by extracting the date portion directly from ISO strings
  // This avoids timezone issues when comparing dates stored in the database
  const isSameLocalDate = (isoDateStr: string, targetDate: string) => {
    // Extract just the date portion (YYYY-MM-DD) from the ISO string
    const datePart = isoDateStr.split('T')[0];
    return datePart === targetDate;
  };

  // Arrivals: exclude cancelled, checked_in, and checked_out (only show pending arrivals)
  const arrivals = reservations.filter((r) =>
    r.status !== "cancelled" &&
    r.status !== "checked_in" &&
    r.status !== "checked_out" &&
    isSameLocalDate(r.arrivalDate, date)
  );
  // Departures: exclude cancelled and checked_out (only show pending departures)
  const departures = reservations.filter((r) =>
    r.status !== "cancelled" &&
    r.status !== "checked_out" &&
    isSameLocalDate(r.departureDate, date)
  );
  const onsite = reservations.filter((r) => r.status === "checked_in");
  const arrivalsWithBalance = arrivals.filter((r) => (r.balanceAmount ?? 0) > 0);
  const departuresWithBalance = departures.filter((r) => (r.balanceAmount ?? 0) > 0);
  const onsiteWithBalance = onsite.filter((r) => (r.balanceAmount ?? 0) > 0);
  const arrivalsUnassigned = arrivals.filter((r) => !r.siteId);
  const departuresUnassigned = departures.filter((r) => !r.siteId);
  const onsiteUnassigned = onsite.filter((r) => !r.siteId);

  const clearSelections = () => setSelectedIds(new Set());

  const handleTabSummaryClick = (nextTab: typeof tab) => {
    setTab(nextTab);
    setStatusFilter("all");
    setSearch("");
    clearSelections();
  };

  const handleOutstandingClick = () => {
    setStatusFilter("balance");
    setSearch("");
    clearSelections();
    if (arrivalsWithBalance.length > 0) {
      setTab("arrivals");
    } else if (departuresWithBalance.length > 0) {
      setTab("departures");
    } else if (onsiteWithBalance.length > 0) {
      setTab("onsite");
    }
  };

  const handleUnassignedClick = () => {
    setStatusFilter("unassigned");
    setSearch("");
    clearSelections();
    if (arrivalsUnassigned.length > 0) {
      setTab("arrivals");
    } else if (departuresUnassigned.length > 0) {
      setTab("departures");
    } else if (onsiteUnassigned.length > 0) {
      setTab("onsite");
    }
  };

  const filteredList = useMemo(() => {
    const list = tab === "arrivals" ? arrivals : tab === "departures" ? departures : onsite;
    const lower = search.toLowerCase();
    const filtered = list
      .filter((r) => {
        if (!search) return true;
        return (
          r.guest.primaryFirstName.toLowerCase().includes(lower) ||
          r.guest.primaryLastName.toLowerCase().includes(lower) ||
          r.site?.name?.toLowerCase().includes(lower)
        );
      })
      .filter((r) => {
        if (statusFilter === "balance") return (r.balanceAmount ?? 0) > 0;
        if (statusFilter === "unassigned") return !r.siteId;
        return true;
      });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "name":
          cmp = `${a.guest.primaryLastName} ${a.guest.primaryFirstName}`.localeCompare(
            `${b.guest.primaryLastName} ${b.guest.primaryFirstName}`
          );
          break;
        case "site":
          cmp = (a.site?.name || "zzz").localeCompare(b.site?.name || "zzz");
          break;
        case "balance":
          cmp = (a.balanceAmount ?? 0) - (b.balanceAmount ?? 0);
          break;
        case "date":
          const dateA = tab === "departures" ? a.departureDate : a.arrivalDate;
          const dateB = tab === "departures" ? b.departureDate : b.arrivalDate;
          cmp = new Date(dateA).getTime() - new Date(dateB).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [arrivals, departures, onsite, search, statusFilter, tab, sortBy, sortDir]);

  // Get eligible reservations for bulk check-in (arrivals that are not yet checked in)
  const eligibleForBulkCheckIn = useMemo(() => {
    if (tab !== "arrivals") return [];
    return filteredList.filter((r) => r.status !== "checked_in");
  }, [filteredList, tab]);

  const selectedCount = selectedIds.size;
  const isAllSelected = filteredList.length > 0 &&
    filteredList.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredList.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Clear selection when changing tabs
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab]);

  const handleBulkCheckIn = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Only check in those that are eligible
    const eligibleIds = ids.filter(id => {
      const res = filteredList.find(r => r.id === id);
      return res && res.status !== "checked_in";
    });
    if (eligibleIds.length === 0) return;
    bulkCheckInMutation.mutate(eligibleIds);
  };

  const handleBulkCheckOut = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    // Only check out those that are checked in
    const eligibleIds = ids.filter(id => {
      const res = filteredList.find(r => r.id === id);
      return res && res.status === "checked_in";
    });
    if (eligibleIds.length === 0) return;

    const results = await Promise.allSettled(
      eligibleIds.map(id => apiClient.checkOutReservation(id))
    );
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failCount = results.filter(r => r.status === "rejected").length;

    queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
    if (failCount === 0) {
      toast({ title: `${successCount} guests checked out successfully` });
    } else {
      toast({ title: `${successCount} checked out, ${failCount} failed`, variant: "destructive" });
    }
    setSelectedIds(new Set());
  };

  const openBulkMessage = (type: "sms" | "email") => {
    if (selectedIds.size === 0) return;
    setMessageType(type);
    setMessageSubject("");
    setMessageBody("");
    setIsMessageModalOpen(true);
  };

  const handleSendBulkMessage = async () => {
    const selectedGuests = filteredList
      .filter(r => selectedIds.has(r.id))
      .map(r => ({
        id: r.guest.id,
        email: r.guest.email,
        name: `${r.guest.primaryFirstName} ${r.guest.primaryLastName}`,
        reservationId: r.id
      }));

    // For now, just show a toast. In production this would call the messaging API
    toast({
      title: `${messageType === "sms" ? "SMS" : "Email"} queued`,
      description: `Message will be sent to ${selectedGuests.length} guest(s)`,
    });
    setIsMessageModalOpen(false);
    setSelectedIds(new Set());
  };

  const formatMoney = (cents?: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);

  // Open old dialog for arrivals (allows cash/check recording inline)
  const openPayment = (res: Reservation) => {
    setSelectedReservation(res);
    setPaymentAmount(res.balanceAmount ?? 0);
    setIsPaymentOpen(true);
  };

  // Open unified payment modal directly (for departures)
  const openUnifiedPayment = (res: Reservation, checkoutAfter = false) => {
    setSelectedReservation(res);
    setPaymentAmount(res.balanceAmount ?? 0);
    setCheckOutAfterPayment(checkoutAfter);
    setCheckInAfterPayment(false);
    setIsStripePaymentOpen(true);
  };

  const handlePayAndCheckout = (res: Reservation) => {
    if ((res.balanceAmount ?? 0) > 0) {
      openUnifiedPayment(res, true);
    } else {
      checkOutMutation.mutate(res.id);
    }
  };

  return (
    <DashboardShell density="full">
      <div className="space-y-5">
        {/* Header */}
        <PageHeader
          eyebrow={`Front desk · ${dateLabel}`}
          title={(
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/15 text-status-success">
                <UserCheck className="h-5 w-5" />
              </span>
              <span>Arrivals & Departures</span>
            </span>
          )}
          subtitle="Guide guests through arrivals, departures, and onsite needs in one command center."
          actions={(
            <>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-7 w-[150px] border-0 bg-transparent p-0 text-sm font-semibold focus-visible:ring-0"
                />
              </div>
              <Button variant="outline" onClick={() => setDate(getTodayDateString())}>
                Today
              </Button>
            </>
          )}
        />

        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          <SummaryCard
            label="On Site Now"
            value={onsite.length}
            icon={<Home className="h-4 w-4" />}
            onClick={() => handleTabSummaryClick("onsite")}
            highlight={statusFilter === "all" && tab === "onsite"}
          />
          <SummaryCard
            label="Arrivals today"
            value={arrivals.length}
            icon={<UserCheck className="h-4 w-4" />}
            onClick={() => handleTabSummaryClick("arrivals")}
            highlight={statusFilter === "all" && tab === "arrivals"}
          />
          <SummaryCard
            label="Departures today"
            value={departures.length}
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => handleTabSummaryClick("departures")}
            highlight={statusFilter === "all" && tab === "departures"}
          />
          <SummaryCard
            label="Outstanding balance"
            value={formatMoney(arrivals.concat(departures).reduce((sum, r) => sum + (r.balanceAmount ?? 0), 0))}
            icon={<CreditCard className="h-4 w-4" />}
            onClick={handleOutstandingClick}
            highlight={statusFilter === "balance"}
          />
          <SummaryCard
            label="Unassigned"
            value={arrivals.concat(departures).filter((r) => !r.siteId).length}
            icon={<AlertCircle className="h-4 w-4" />}
            onClick={handleUnassignedClick}
            highlight={statusFilter === "unassigned"}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-xl border border-border shadow-sm w-full lg:max-w-md">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search guest, site, or notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort: {sortBy === "name" ? "Name" : sortBy === "site" ? "Site" : sortBy === "balance" ? "Balance" : "Date"}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortDir("asc"); }}>
                  Name (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("name"); setSortDir("desc"); }}>
                  Name (Z-A)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSortBy("site"); setSortDir("asc"); }}>
                  Site (A-Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("site"); setSortDir("desc"); }}>
                  Site (Z-A)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSortBy("balance"); setSortDir("desc"); }}>
                  Balance (High-Low)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("balance"); setSortDir("asc"); }}>
                  Balance (Low-High)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortDir("asc"); }}>
                  Date (Earliest)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSortBy("date"); setSortDir("desc"); }}>
                  Date (Latest)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="balance">Balance due</SelectItem>
                <SelectItem value="unassigned">Unassigned site</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "arrivals" | "departures" | "onsite")} className="space-y-0">
              <TabsList>
                <TabsTrigger value="onsite" className="gap-1">
                  On Site
                  <Badge variant="secondary" className="ml-1 bg-status-success/15 text-status-success">
                    {onsite.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="arrivals" className="gap-1">
                  Arrivals
                  <Badge variant="secondary" className="ml-1">
                    {arrivals.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="departures" className="gap-1">
                  Departures
                  <Badge variant="secondary" className="ml-1">
                    {departures.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Bulk actions bar */}
        {filteredList.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all ({filteredList.length})
              </Label>
              {selectedCount > 0 && (
                <Badge variant="secondary" className="bg-status-info/15 text-status-info">
                  {selectedCount} selected
                </Badge>
              )}
            </div>
            {selectedCount > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Message actions */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkMessage("sms")}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  SMS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkMessage("email")}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </Button>

                {/* Tab-specific actions */}
                {tab === "arrivals" && eligibleForBulkCheckIn.length > 0 && (
                  <Button
                    onClick={handleBulkCheckIn}
                    disabled={bulkCheckInMutation.isPending}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    {bulkCheckInMutation.isPending ? "Checking in..." : "Check In"}
                  </Button>
                )}
                {(tab === "onsite" || tab === "departures") && (
                  <Button
                    onClick={handleBulkCheckOut}
                    size="sm"
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Check Out
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 bg-muted rounded-lg border border-dashed border-border">
              <p className="text-muted-foreground">Nothing for this filter and date.</p>
            </div>
          ) : (
            filteredList.map((res) => {
              const isSelected = selectedIds.has(res.id);
              const needsPayment = (res.balanceAmount ?? 0) > 0;
              const needsSite = !res.siteId;
              const hasIssues = needsPayment || needsSite;
              const readinessLabel = tab === "departures" ? "Ready to check out" : "Ready to check in";

              return (
                <Card
                  key={res.id}
                  className={cn(
                    "overflow-hidden border border-l-4 bg-card shadow-sm transition-colors",
                    hasIssues ? "border-amber-200 border-l-amber-400" : "border-border border-l-border",
                    isSelected && "ring-2 ring-emerald-200"
                  )}
                >
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="pt-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(res.id)}
                      />
                    </div>
                    <div
                      className={`p-3 rounded-full ${
                        tab === "onsite"
                          ? "bg-status-success/15 text-status-success"
                          : tab === "arrivals"
                          ? res.status === "checked_in"
                            ? "bg-status-success/15 text-status-success"
                            : "bg-status-info/15 text-status-info"
                          : res.status === "checked_out"
                          ? "bg-muted text-muted-foreground"
                          : "bg-status-warning/15 text-status-warning"
                      }`}
                    >
                      {tab === "onsite" ? <Home className="h-5 w-5" /> : tab === "arrivals" ? (res.status === "checked_in" ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />) : <LogOut className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg text-foreground">
                          {res.guest.primaryFirstName} {res.guest.primaryLastName}
                        </h3>
                        {needsPayment && (
                          <Badge className="h-5 px-1.5 text-[10px] uppercase tracking-wider border border-amber-200 bg-amber-50 text-amber-700">
                            Balance Due
                          </Badge>
                        )}
                        {needsSite && (
                          <Badge className="h-5 px-1.5 text-[10px] uppercase tracking-wider border border-amber-200 bg-amber-50 text-amber-700">
                            Assign site
                          </Badge>
                        )}
                        {!needsPayment && !needsSite && tab !== "onsite" && (
                          <Badge className="h-5 px-1.5 text-[10px] uppercase tracking-wider border border-emerald-200 bg-emerald-50 text-emerald-700">
                            {readinessLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="outline">{res.site?.name || "Unassigned"}</Badge>
                        <span>•</span>
                        <span>
                          {res.adults ?? 0} adults{typeof res.children === "number" ? `, ${res.children} children` : ""}
                        </span>
                        {res.nights ? (
                          <>
                            <span>•</span>
                            <span>{res.nights} nights</span>
                          </>
                        ) : null}
                        {tab === "departures" && (
                          <>
                            <span>•</span>
                            <span>Arrived {new Date(res.arrivalDate).toLocaleDateString()}</span>
                          </>
                        )}
                        {tab === "onsite" && (
                          <>
                            <span>•</span>
                            <span>Departs {new Date(res.departureDate).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                      {res.notes ? (
                        <p className="text-sm text-amber-700 mt-2 bg-amber-50 p-2 rounded border border-amber-100 inline-block">Note: {res.notes}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 min-w-[200px]">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Balance</div>
                      <div className={`font-bold ${res.balanceAmount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {formatMoney(res.balanceAmount)}
                      </div>
                    </div>

                    {tab === "arrivals" ? (
                      res.status === "checked_in" ? (
                        <Button disabled variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Checked In
                        </Button>
                      ) : (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {!res.siteId && (
                            <Button variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50">
                              Assign Site
                            </Button>
                          )}
                          {res.balanceAmount > 0 && (
                            <Button
                              variant="outline"
                              className="text-amber-700 border-amber-200 hover:bg-amber-50"
                              onClick={() => openPayment(res)}
                            >
                              <CreditCard className="h-4 w-4 mr-2" />
                              Pay Balance
                            </Button>
                          )}
                          <Button
                            onClick={() => checkInMutation.mutate(res.id)}
                            disabled={checkInMutation.isPending}
                            className={res.balanceAmount > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}
                          >
                            {checkInMutation.isPending ? "Checking..." : res.balanceAmount > 0 ? "Check In Anyway" : "Check In"}
                          </Button>
                        </div>
                      )
                    ) : tab === "onsite" ? (
                      <div className="flex flex-wrap gap-2 justify-end">
                        <Link href={`/reservations/${res.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                        {res.balanceAmount > 0 && (
                          <Button variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => openUnifiedPayment(res, false)}>
                            Settle Balance
                          </Button>
                        )}
                        <Button
                          onClick={() => handlePayAndCheckout(res)}
                          disabled={checkOutMutation.isPending}
                          className={res.balanceAmount > 0 ? "bg-amber-600 hover:bg-amber-700" : ""}
                        >
                          {res.balanceAmount > 0 ? "Pay & Check Out" : "Check Out"}
                        </Button>
                      </div>
                    ) : res.status === "checked_out" ? (
                      <Button disabled variant="outline" className="bg-muted">
                        Checked Out
                      </Button>
                    ) : (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {res.balanceAmount > 0 && (
                          <Button variant="outline" className="text-amber-700 border-amber-200 hover:bg-amber-50" onClick={() => openUnifiedPayment(res, false)}>
                            Settle Balance
                          </Button>
                        )}
                        <Button
                          onClick={() => handlePayAndCheckout(res)}
                          disabled={checkOutMutation.isPending}
                          className={res.balanceAmount > 0 ? "bg-amber-600 hover:bg-amber-700" : ""}
                        >
                          {res.balanceAmount > 0 ? "Pay & Check Out" : "Check Out"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
              );
            })
          )}
        </div>

        {/* Tips / shortcuts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <HintCard title="Send pre-arrival" description="Bulk message guests about gate codes and quiet hours." icon={<MessageCircle className="h-4 w-4" />} href="/messages" />
          <HintCard title="Assign sites faster" description="Jump to operations board to place unassigned reservations." icon={<Tag className="h-4 w-4" />} href="/operations" />
          <HintCard title="Collect balances" description="See all open balances in repeat charges." icon={<CreditCard className="h-4 w-4" />} href="/billing/repeat-charges" />
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Outstanding Balance</DialogTitle>
            <DialogDescription>
              {selectedReservation?.guest.primaryFirstName} {selectedReservation?.guest.primaryLastName} owes {formatMoney(selectedReservation?.balanceAmount)}.
              {tab === "arrivals" ? " Collect payment before or during check-in." : " Record payment to proceed with checkout."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={(paymentAmount ?? 0) / 100}
                  onChange={(e) => setPaymentAmount(Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Credit Card</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
              Cancel
            </Button>
            {paymentMethod === "card" ? (
              <>
                <Button
                  onClick={() => {
                    setCheckInAfterPayment(false);
                    setIsPaymentOpen(false);
                    setIsStripePaymentOpen(true);
                  }}
                  variant="outline"
                >
                  Pay with Card
                </Button>
                {tab === "arrivals" && selectedReservation?.status !== "checked_in" && (
                  <Button
                    onClick={() => {
                      setCheckInAfterPayment(true);
                      setIsPaymentOpen(false);
                      setIsStripePaymentOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Pay & Check In
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  onClick={() => selectedReservation && paymentMutation.mutate({
                    id: selectedReservation.id,
                    amount: paymentAmount,
                    method: paymentMethod as "cash" | "check" | "folio"
                  })}
                  disabled={paymentMutation.isPending}
                  variant="outline"
                >
                  {paymentMutation.isPending ? "Processing..." : `Record ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} Payment`}
                </Button>
                {tab === "arrivals" && selectedReservation?.status !== "checked_in" && (
                  <Button
                    onClick={async () => {
                      if (!selectedReservation) return;
                      try {
                        await apiClient.recordReservationPayment(selectedReservation.id, paymentAmount, [
                          { method: paymentMethod as "cash" | "check" | "folio", amountCents: paymentAmount }
                        ]);
                        await apiClient.checkInReservation(selectedReservation.id);
                        queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
                        toast({ title: "Payment recorded and guest checked in" });
                        setIsPaymentOpen(false);
                      } catch {
                        toast({ title: "Failed to complete operation", variant: "destructive" });
                      }
                    }}
                    disabled={paymentMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Record & Check In
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unified Payment Collection Modal */}
      {selectedReservation && (
        <PaymentCollectionModal
          isOpen={isStripePaymentOpen}
          onClose={() => {
            setIsStripePaymentOpen(false);
            setCheckInAfterPayment(false);
            setCheckOutAfterPayment(false);
          }}
          campgroundId={campgroundId}
          amountDueCents={paymentAmount}
          subject={{ type: "balance", reservationId: selectedReservation.id }}
          context="staff_checkin"
          guestId={selectedReservation.guest?.id}
          guestEmail={selectedReservation.guest?.email}
          guestName={`${selectedReservation.guest?.primaryFirstName || ''} ${selectedReservation.guest?.primaryLastName || ''}`.trim()}
          enableSplitTender={true}
          enableCharityRoundUp={true}
          // Show Check In/Out button in success view if applicable
          checkInOutLabel={
            checkInAfterPayment ? "Check In" :
            checkOutAfterPayment ? "Check Out" :
            undefined
          }
          onSuccess={async (result) => {
            setIsStripePaymentOpen(false);
            queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
            if (checkInAfterPayment) {
              try {
                await apiClient.checkInReservation(selectedReservation.id);
                toast({ title: "Payment successful and guest checked in" });
              } catch {
                toast({ title: "Payment successful but check-in failed", variant: "destructive" });
              }
            } else if (checkOutAfterPayment) {
              try {
                await apiClient.checkOutReservation(selectedReservation.id);
                toast({ title: "Payment successful and guest checked out" });
              } catch {
                toast({ title: "Payment successful but check-out failed", variant: "destructive" });
              }
            } else {
              toast({ title: `Payment of $${(result.totalPaidCents / 100).toFixed(2)} successful` });
            }
            setCheckInAfterPayment(false);
            setCheckOutAfterPayment(false);
          }}
          onError={(error) => {
            toast({ title: "Payment failed", description: error.message, variant: "destructive" });
          }}
        />
      )}

      {/* Bulk Message Modal */}
      <Dialog open={isMessageModalOpen} onOpenChange={setIsMessageModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {messageType === "sms" ? (
                <MessageSquare className="h-5 w-5 text-blue-600" />
              ) : (
                <Mail className="h-5 w-5 text-blue-600" />
              )}
              Send {messageType === "sms" ? "SMS" : "Email"} to {selectedCount} Guest{selectedCount !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Use personalization tags to customize each message automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Personalization Tags */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Personalization Tags (click to insert)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { tag: "{first_name}", label: "First Name" },
                  { tag: "{last_name}", label: "Last Name" },
                  { tag: "{site_name}", label: "Site" },
                  { tag: "{arrival_date}", label: "Arrival" },
                  { tag: "{departure_date}", label: "Departure" },
                  { tag: "{balance}", label: "Balance" },
                  { tag: "{nights}", label: "# Nights" },
                ].map(({ tag, label }) => (
                  <button
                    key={tag}
                    type="button"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-status-info/15 text-status-info hover:bg-status-info/10 border border-status-info/30 transition-colors"
                    onClick={() => setMessageBody(prev => prev + tag)}
                  >
                    {label}
                    <span className="opacity-60 font-mono text-[10px]">{tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {messageType === "email" && (
              <div className="grid gap-2">
                <Label>Subject</Label>
                <Input
                  placeholder="e.g., {first_name}, important update about your stay"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label>Message</Label>
              <Textarea
                placeholder={messageType === "sms"
                  ? "e.g., Hi {first_name}! Just a reminder that checkout is at 11am tomorrow. Thanks for staying with us!"
                  : "e.g., Hi {first_name}, we hope you're enjoying your stay at site {site_name}!"}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={4}
              />
              {messageType === "sms" && (
                <p className="text-xs text-muted-foreground">
                  {messageBody.length}/160 characters {messageBody.length > 160 && "(will be split into multiple messages)"}
                </p>
              )}
            </div>

            {/* Preview */}
            {messageBody && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Preview (example with first selected guest)
                </Label>
                <div className="p-3 rounded-lg bg-muted border border-border text-sm text-foreground">
                  {(() => {
                    const firstSelected = filteredList.find(r => selectedIds.has(r.id));
                    if (!firstSelected) return messageBody;
                    const arrivalDate = firstSelected.arrivalDate ? format(new Date(firstSelected.arrivalDate), "MMM d") : "";
                    const departureDate = firstSelected.departureDate ? format(new Date(firstSelected.departureDate), "MMM d") : "";
                    const nights = firstSelected.arrivalDate && firstSelected.departureDate
                      ? Math.ceil((new Date(firstSelected.departureDate).getTime() - new Date(firstSelected.arrivalDate).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    return messageBody
                      .replace(/{first_name}/g, firstSelected.guest?.primaryFirstName || "Guest")
                      .replace(/{last_name}/g, firstSelected.guest?.primaryLastName || "")
                      .replace(/{site_name}/g, firstSelected.site?.name || "your site")
                      .replace(/{arrival_date}/g, arrivalDate)
                      .replace(/{departure_date}/g, departureDate)
                      .replace(/{balance}/g, `$${((firstSelected.balanceAmount || 0) / 100).toFixed(2)}`)
                      .replace(/{nights}/g, String(nights));
                  })()}
                </div>
              </div>
            )}

            {/* Quick templates */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quick Templates</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageBody("Hi {first_name}! Welcome to your stay at site {site_name}. Check-in starts at 3pm. Need help? Reply to this message!")}
                >
                  Welcome
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageBody("Hi {first_name}, reminder: Checkout is at 11am on {departure_date}. Please return keys to the office. Thanks for staying with us!")}
                >
                  Checkout Reminder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageBody("Hi {first_name}, weather alert for site {site_name}: Please secure outdoor items and be prepared for incoming weather. Stay safe!")}
                >
                  Weather Alert
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageBody("Hi {first_name}! Pool hours today: 9am-9pm. Don't forget your towel!")}
                >
                  Pool Hours
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMessageBody("Hi {first_name}, just a reminder that your current balance is {balance}. Please stop by the office if you have any questions!")}
                >
                  Balance Reminder
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsMessageModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendBulkMessage}
              disabled={!messageBody.trim() || (messageType === "email" && !messageSubject.trim())}
              className="gap-2"
            >
              {messageType === "sms" ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
              Send {messageType === "sms" ? "SMS" : "Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function SummaryCard({ label, value, icon, href, onClick, highlight }: { label: string; value: string | number; icon: React.ReactNode; href?: string; onClick?: () => void; highlight?: boolean }) {
  const content = (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border p-4 shadow-sm transition-all",
        "group-hover:-translate-y-0.5 group-hover:shadow-md",
        highlight
          ? "border-emerald-200 bg-emerald-50"
          : "border-border bg-card group-hover:border-muted-foreground/30"
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn(
          "rounded-lg p-2",
          highlight ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
        )}>
          {icon}
        </span>
        <div>
          <div className={cn(
            "text-xs font-semibold tracking-wide",
            highlight ? "text-emerald-700" : "text-muted-foreground"
          )}>
            {label}
          </div>
          <div className={cn(
            "text-xl font-bold",
            highlight ? "text-emerald-700" : "text-foreground"
          )}>
            {value}
          </div>
        </div>
      </div>
      <ArrowRight className={cn("h-4 w-4", highlight ? "text-emerald-400" : "text-muted-foreground")} />
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="group block w-full rounded-xl text-left transition">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group block w-full rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        {content}
      </button>
    );
  }
  return content;
}

function HintCard({ title, description, icon, href }: { title: string; description: string; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm hover:border-status-success/40 hover:shadow-md transition">
      <span className="rounded-md bg-status-success/10 p-2 text-status-success">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}
