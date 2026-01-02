"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  LogOut,
  MessageCircle,
  Search,
  Tag,
  Users,
  UserCheck
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";

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
  guest: { primaryFirstName: string; primaryLastName: string };
  notes?: string | null;
};

export default function CheckInOutV2() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Use local date, not UTC (toISOString gives UTC which can be a different day)
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [campgroundId, setCampgroundId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "balance" | "unassigned">("all");
  const [tab, setTab] = useState<"arrivals" | "departures">("arrivals");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Payment modal
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("card");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
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
    onError: () => toast({ title: "Failed to check in", description: "Please try again", variant: "destructive" })
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
      toast({ title: "Bulk check-in failed", description: "Please try again", variant: "destructive" });
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => apiClient.checkOutReservation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      toast({ title: "Guest checked out" });
      setIsPaymentOpen(false);
    },
    onError: () => toast({ title: "Failed to check out", description: "Please try again", variant: "destructive" })
  });

  const paymentMutation = useMutation({
    mutationFn: (data: { id: string; amount: number }) => apiClient.recordReservationPayment(data.id, data.amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations", campgroundId] });
      toast({ title: "Payment recorded" });
      setIsPaymentOpen(false);
    },
    onError: () => toast({ title: "Payment failed", variant: "destructive" })
  });

  const reservations = (reservationsQuery.data as Reservation[]) || [];

  // Arrivals: exclude cancelled, checked_in, and checked_out (only show pending arrivals)
  const arrivals = reservations.filter((r) =>
    r.status !== "cancelled" &&
    r.status !== "checked_in" &&
    r.status !== "checked_out" &&
    r.arrivalDate.split("T")[0] === date
  );
  // Departures: exclude cancelled and checked_out (only show pending departures)
  const departures = reservations.filter((r) =>
    r.status !== "cancelled" &&
    r.status !== "checked_out" &&
    r.departureDate.split("T")[0] === date
  );

  const filteredList = useMemo(() => {
    const list = tab === "arrivals" ? arrivals : departures;
    const lower = search.toLowerCase();
    return list
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
  }, [arrivals, departures, search, statusFilter, tab]);

  // Get eligible reservations for bulk check-in (arrivals that are not yet checked in)
  const eligibleForBulkCheckIn = useMemo(() => {
    if (tab !== "arrivals") return [];
    return filteredList.filter((r) => r.status !== "checked_in");
  }, [filteredList, tab]);

  const selectedCount = selectedIds.size;
  const isAllSelected = eligibleForBulkCheckIn.length > 0 &&
    eligibleForBulkCheckIn.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleForBulkCheckIn.map((r) => r.id)));
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

  const handleBulkCheckIn = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkCheckInMutation.mutate(ids);
  };

  const summary = useMemo(() => {
    const list = tab === "arrivals" ? arrivals : departures;
    const balance = list.reduce((sum, r) => sum + (r.balanceAmount ?? 0), 0);
    const unassigned = list.filter((r) => !r.siteId).length;
    return { count: list.length, balance, unassigned };
  }, [arrivals, departures, tab]);

  const formatMoney = (cents?: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);

  const openPayment = (res: Reservation) => {
    setSelectedReservation(res);
    setPaymentAmount(res.balanceAmount ?? 0);
    setIsPaymentOpen(true);
  };

  const handlePayAndCheckout = (res: Reservation) => {
    if ((res.balanceAmount ?? 0) > 0) {
      openPayment(res);
    } else {
      checkOutMutation.mutate(res.id);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operations · {date}</div>
            <h1 className="text-3xl font-bold text-foreground">Arrivals & Departures</h1>
            <p className="text-sm text-muted-foreground">
              Move guests smoothly with balances, site status, and quick actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <Button variant="outline" onClick={() => {
              const d = new Date();
              setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }}>
              Today
            </Button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryCard
            label="Arrivals today"
            value={arrivals.length}
            icon={<UserCheck className="h-4 w-4" />}
            href="/check-in-out"
          />
          <SummaryCard
            label="Departures today"
            value={departures.length}
            icon={<LogOut className="h-4 w-4" />}
            href="/check-in-out"
          />
          <SummaryCard
            label="Outstanding balance"
            value={formatMoney(arrivals.concat(departures).reduce((sum, r) => sum + (r.balanceAmount ?? 0), 0))}
            icon={<CreditCard className="h-4 w-4" />}
            href="/billing/repeat-charges"
          />
          <SummaryCard
            label="Unassigned"
            value={arrivals.concat(departures).filter((r) => !r.siteId).length}
            icon={<AlertCircle className="h-4 w-4" />}
            href="/operations"
          />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm w-full lg:max-w-md">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search guest, site, or notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-none focus:outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="balance">Balance due</SelectItem>
                <SelectItem value="unassigned">Unassigned site</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "arrivals" | "departures")} className="space-y-0">
              <TabsList>
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
        {tab === "arrivals" && eligibleForBulkCheckIn.length > 0 && (
          <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <Label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select all ({eligibleForBulkCheckIn.length})
              </Label>
            </div>
            {selectedCount > 0 && (
              <Button
                onClick={handleBulkCheckIn}
                disabled={bulkCheckInMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {bulkCheckInMutation.isPending
                  ? `Checking in ${selectedCount}...`
                  : `Check In Selected (${selectedCount})`}
              </Button>
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
              const isEligible = tab === "arrivals" && res.status !== "checked_in";
              const isSelected = selectedIds.has(res.id);

              return (
              <Card
                key={res.id}
                className={`overflow-hidden border ${
                  isSelected
                    ? "border-emerald-300 bg-emerald-50/40"
                    : res.balanceAmount > 0
                    ? "border-amber-200 bg-amber-50/40"
                    : "border-border"
                } shadow-sm`}
              >
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {isEligible && (
                      <div className="pt-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(res.id)}
                          disabled={bulkCheckInMutation.isPending}
                        />
                      </div>
                    )}
                    <div
                      className={`p-3 rounded-full ${
                        tab === "arrivals"
                          ? res.status === "checked_in"
                            ? "bg-status-success/15 text-status-success"
                            : "bg-status-info/15 text-status-info"
                          : res.status === "checked_out"
                          ? "bg-muted text-muted-foreground"
                          : "bg-status-warning/15 text-status-warning"
                      }`}
                    >
                      {tab === "arrivals" ? (
                        res.status === "checked_in" ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />
                      ) : (
                        <LogOut className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg text-foreground">
                          {res.guest.primaryFirstName} {res.guest.primaryLastName}
                        </h3>
                        {res.balanceAmount > 0 && (
                          <Badge variant="destructive" className="h-5 px-1.5 text-[10px] uppercase tracking-wider">
                            Balance Due
                          </Badge>
                        )}
                        {!res.siteId && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px] uppercase tracking-wider text-status-warning border-status-warning">
                            Assign site
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
                        {tab === "departures" ? (
                          <>
                            <span>•</span>
                            <span>Arrived {new Date(res.arrivalDate).toLocaleDateString()}</span>
                          </>
                        ) : null}
                      </div>
                      {res.notes ? (
                        <p className="text-sm text-status-warning mt-2 bg-status-warning/15 p-2 rounded border border-status-warning inline-block">
                          Note: {res.notes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 min-w-[200px]">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Balance</div>
                      <div className={`font-bold ${res.balanceAmount > 0 ? "text-status-warning" : "text-status-success"}`}>
                        {formatMoney(res.balanceAmount)}
                      </div>
                    </div>

                    {tab === "arrivals" ? (
                      res.status === "checked_in" ? (
                        <Button disabled variant="outline" className="text-status-success border-status-success bg-status-success/15">
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Checked In
                        </Button>
                      ) : (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {!res.siteId && (
                            <Button variant="outline" className="text-status-warning border-status-warning hover:bg-status-warning/15">
                              Assign Site
                            </Button>
                          )}
                          <Button
                            onClick={() => checkInMutation.mutate(res.id)}
                            disabled={checkInMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            {checkInMutation.isPending ? "Checking..." : "Check In"}
                          </Button>
                        </div>
                      )
                    ) : res.status === "checked_out" ? (
                      <Button disabled variant="outline" className="bg-muted">
                        Checked Out
                      </Button>
                    ) : (
                      <div className="flex flex-wrap gap-2 justify-end">
                        {res.balanceAmount > 0 && (
                          <Button variant="outline" className="text-status-warning border-status-warning hover:bg-status-warning/15" onClick={() => openPayment(res)}>
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
          <HintCard
            title="Send pre-arrival"
            description="Bulk message guests about gate codes and quiet hours."
            icon={<MessageCircle className="h-4 w-4" />}
            href="/messages"
          />
          <HintCard
            title="Assign sites faster"
            description="Jump to operations board to place unassigned reservations."
            icon={<Tag className="h-4 w-4" />}
            href="/operations"
          />
          <HintCard
            title="Collect balances"
            description="See all open balances in repeat charges."
            icon={<CreditCard className="h-4 w-4" />}
            href="/billing/repeat-charges"
          />
        </div>
      </div>

      {/* Payment Modal */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Outstanding Balance</DialogTitle>
            <DialogDescription>
              Guest owes {formatMoney(selectedReservation?.balanceAmount)}. Record payment to proceed with checkout.
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => selectedReservation && paymentMutation.mutate({ id: selectedReservation.id, amount: paymentAmount })} disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? "Processing..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  href
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="card border border-border bg-card p-4 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</span>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-foreground">{value}</div>
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:shadow-md transition">
        {content}
      </Link>
    );
  }
  return content;
}

function HintCard({
  title,
  description,
  icon,
  href
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm hover:border-emerald-200 hover:shadow-md transition"
    >
      <span className="rounded-md bg-emerald-50 p-2 text-emerald-600">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}

