"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "../../components/ui/layout/DashboardShell";
import { PageHeader } from "../../components/ui/layout/PageHeader";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { apiClient } from "../../lib/api-client";
import { useState, useMemo, useEffect, Fragment } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Trophy, Star, Car, Plus, Trash2, Download, ChevronDown, ChevronUp, Users, Crown, UserPlus, Merge } from "lucide-react";
import { FilterChip } from "../../components/ui/filter-chip";
import { StaggeredTableRow } from "../../components/ui/staggered-list";
import { MergeGuestsDialog } from "../../components/guests/MergeGuestsDialog";
import { Checkbox } from "../../components/ui/checkbox";
import { cn } from "../../lib/utils";
import { TableEmpty } from "../../components/ui/table";
import { useToast } from "../../components/ui/use-toast";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";

const TIER_COLORS: Record<string, string> = {
  Bronze: "bg-status-warning/80",
  Silver: "bg-muted-foreground",
  Gold: "bg-status-warning",
  Platinum: "bg-foreground"
};

function GuestLoyaltyBadge({ guestId }: { guestId: string }) {
  const { data: loyalty } = useQuery({
    queryKey: ["loyalty", guestId],
    queryFn: () => apiClient.getLoyaltyProfile(guestId),
    staleTime: 60000,
    retry: false
  });

  if (!loyalty) return null;

  return (
    <div className="flex items-center gap-2 mt-1">
      <Badge className={cn("text-white text-xs", TIER_COLORS[loyalty.tier] || "bg-status-warning")}>
        <Trophy className="h-3 w-3 mr-1" />
        {loyalty.tier}
      </Badge>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Star className="h-3 w-3" />
        {loyalty.pointsBalance.toLocaleString()} pts
      </span>
    </div>
  );
}

// Full Rewards Section for Guest Detail
function GuestRewardsSection({ guestId, expanded, onToggle }: { guestId: string; expanded: boolean; onToggle: () => void }) {
  const { data: loyalty, isLoading } = useQuery({
    queryKey: ["loyalty", guestId],
    queryFn: () => apiClient.getLoyaltyProfile(guestId),
    staleTime: 60000,
    retry: false,
    enabled: expanded
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-action-primary hover:text-action-primary-hover"
        aria-expanded={expanded}
        aria-controls={`guest-rewards-${guestId}`}
      >
        <Trophy className="h-4 w-4" />
        {expanded ? "Hide Rewards" : "View Rewards"}
      </button>

      {expanded && (
        <div
          id={`guest-rewards-${guestId}`}
          className="mt-3 p-4 bg-status-success/10 rounded-lg border border-status-success/20"
        >
          {isLoading ? (
            <div className="text-center text-muted-foreground py-4">Loading rewards...</div>
          ) : loyalty ? (
            <div className="space-y-4">
              {/* Tier and Points */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white", TIER_COLORS[loyalty.tier] || "bg-status-warning")}>
                    <Trophy className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-foreground">{loyalty.tier} Member</div>
                    <div className="text-sm text-muted-foreground">Member since {new Date(Date.now()).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-status-success">{loyalty.pointsBalance.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Points Balance</div>
                </div>
              </div>

              {/* Points Progress Bar (to next tier) */}
              {loyalty.tier !== "Platinum" && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{loyalty.tier}</span>
                    <span>
                      {loyalty.tier === "Bronze" ? "Silver (1,000 pts)" :
                        loyalty.tier === "Silver" ? "Gold (5,000 pts)" :
                          "Platinum (10,000 pts)"}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-status-success transition-all"
                      style={{
                        width: `${Math.min(100,
                          loyalty.tier === "Bronze" ? (loyalty.pointsBalance / 1000) * 100 :
                            loyalty.tier === "Silver" ? ((loyalty.pointsBalance - 1000) / 4000) * 100 :
                              ((loyalty.pointsBalance - 5000) / 5000) * 100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {loyalty.transactions && loyalty.transactions.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-muted-foreground mb-2">Recent Activity</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {loyalty.transactions.slice(0, 10).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm p-2 bg-card rounded border border-border">
                        <div>
                          <div className="font-medium text-foreground">{tx.reason}</div>
                          <div className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className={cn("font-bold", tx.amount >= 0 ? "text-status-success" : "text-status-error")}>
                          {tx.amount >= 0 ? "+" : ""}{tx.amount.toLocaleString()} pts
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!loyalty.transactions || loyalty.transactions.length === 0) && (
                <div className="overflow-hidden rounded border border-border bg-card">
                  <table className="w-full text-sm">
                    <tbody>
                      <TableEmpty>No transactions yet.</TableEmpty>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-border bg-card">
              <table className="w-full text-sm">
                <tbody>
                  <TableEmpty>No rewards profile found.</TableEmpty>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GuestEquipmentSection({ guestId, expanded, onToggle }: { guestId: string; expanded: boolean; onToggle: () => void }) {
  const { data: equipment, isLoading } = useQuery({
    queryKey: ["guest-equipment", guestId],
    queryFn: () => apiClient.getGuestEquipment(guestId),
    enabled: expanded
  });

  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [newEq, setNewEq] = useState({
    type: "rv",
    make: "",
    model: "",
    length: "",
    plateNumber: "",
    plateState: ""
  });

  const createMutation = useMutation({
    mutationFn: () => apiClient.createGuestEquipment(guestId, {
      ...newEq,
      length: newEq.length ? Number(newEq.length) : undefined,
      make: newEq.make || undefined,
      model: newEq.model || undefined,
      plateNumber: newEq.plateNumber || undefined,
      plateState: newEq.plateState || undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-equipment", guestId] });
      setIsAdding(false);
      setNewEq({ type: "rv", make: "", model: "", length: "", plateNumber: "", plateState: "" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteGuestEquipment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest-equipment", guestId] });
    }
  });

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-action-primary hover:text-action-primary-hover"
        aria-expanded={expanded}
        aria-controls={`guest-equipment-${guestId}`}
      >
        <Car className="h-4 w-4" />
        {expanded ? "Hide Equipment" : "View Equipment"}
      </button>

      {expanded && (
        <div
          id={`guest-equipment-${guestId}`}
          className="mt-3 p-4 bg-muted rounded-lg border border-border"
        >
          {isLoading ? (
            <div className="text-center text-muted-foreground py-2">Loading equipment...</div>
          ) : (
            <div className="space-y-3">
              {equipment?.map((eq) => (
                <div key={eq.id} className="flex items-center justify-between bg-card p-3 rounded border border-border">
                  <div>
                    <div className="font-medium text-foreground">
                      {eq.type.toUpperCase()} {eq.length ? `• ${eq.length}ft` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {eq.make} {eq.model} {eq.plateNumber ? `• ${eq.plateNumber} (${eq.plateState || "-"})` : ""}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(eq.id)}
                    disabled={deleteMutation.isPending}
                    aria-label="Delete equipment"
                  >
                    <Trash2 className="h-4 w-4 text-status-error" />
                  </Button>
                </div>
              ))}

              {!equipment?.length && !isAdding && (
                <div className="overflow-hidden rounded border border-border bg-card">
                  <table className="w-full text-sm">
                    <tbody>
                      <TableEmpty>No equipment recorded.</TableEmpty>
                    </tbody>
                  </table>
                </div>
              )}

              {isAdding ? (
                <div className="bg-card p-3 rounded border border-border space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newEq.type} onValueChange={(value) => setNewEq({ ...newEq, type: value })}>
                      <SelectTrigger className="h-9" aria-label="Equipment type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rv">RV</SelectItem>
                        <SelectItem value="trailer">Trailer</SelectItem>
                        <SelectItem value="tent">Tent</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-9"
                      placeholder="Length (ft)"
                      type="number"
                      value={newEq.length}
                      onChange={(e) => setNewEq({ ...newEq, length: e.target.value })}
                      aria-label="Equipment length"
                    />
                    <Input
                      className="h-9"
                      placeholder="Make"
                      value={newEq.make}
                      onChange={(e) => setNewEq({ ...newEq, make: e.target.value })}
                      aria-label="Equipment make"
                    />
                    <Input
                      className="h-9"
                      placeholder="Model"
                      value={newEq.model}
                      onChange={(e) => setNewEq({ ...newEq, model: e.target.value })}
                      aria-label="Equipment model"
                    />
                    <Input
                      className="h-9"
                      placeholder="Plate #"
                      value={newEq.plateNumber}
                      onChange={(e) => setNewEq({ ...newEq, plateNumber: e.target.value })}
                      aria-label="Equipment plate number"
                    />
                    <Input
                      className="h-9"
                      placeholder="State"
                      value={newEq.plateState}
                      onChange={(e) => setNewEq({ ...newEq, plateState: e.target.value })}
                      aria-label="Equipment plate state"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setIsAdding(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Add Equipment
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


import { useRouter } from "next/navigation";

// Extended guest type with optional fields
type GuestWithExtras = {
  id: string;
  primaryFirstName: string;
  primaryLastName: string;
  email: string;
  phone: string;
  notes?: string | null;
  vip?: boolean;
  marketingOptIn?: boolean;
  city?: string | null;
  state?: string | null;
  preferredContact?: string | null;
  preferredLanguage?: string | null;
  address1?: string | null;
  address2?: string | null;
  postalCode?: string | null;
  rigType?: string | null;
  rigLength?: number | null;
  vehiclePlate?: string | null;
  vehicleState?: string | null;
  leadSource?: string | null;
  tags?: string[];
  repeatStays?: number;
};

export default function GuestsPage() {
  const router = useRouter();

  // Get campgroundId from localStorage (needed for the API call)
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [campgroundChecked, setCampgroundChecked] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("campreserv:selectedCampground");
      setCampgroundId(stored);
      setCampgroundChecked(true);
    }
  }, []);

  const guestsQuery = useQuery({
    queryKey: ["guests", campgroundId],
    queryFn: () => apiClient.getGuests(campgroundId || undefined),
    enabled: campgroundChecked && !!campgroundId,
    retry: 1, // Only retry once on failure
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    primaryFirstName: "",
    primaryLastName: "",
    email: "",
    phone: "",
    notes: "",
    preferredContact: "",
    preferredLanguage: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    rigType: "",
    rigLength: "",
    vehiclePlate: "",
    vehicleState: "",
    tags: "",
    vip: false,
    leadSource: "",
    marketingOptIn: false,
    repeatStays: ""
  });
  const [expandedRewardsId, setExpandedRewardsId] = useState<string | null>(null);
  const [expandedEquipmentId, setExpandedEquipmentId] = useState<string | null>(null);

  const handleExportCSV = async () => {
    if (!guestsQuery.data) return;

    // We need loyalty data for export.
    // We can fetch it for all guests in parallel (might be heavy) or just export what we have.
    // The requirement says "Include columns: ... loyalty tier".
    // I'll try to fetch loyalty for all guests.
    const guests = guestsQuery.data;
    const csvRows = [];
    csvRows.push(["First Name", "Last Name", "Email", "Phone", "Tier", "Points", "Total Stays", "Last Visit"]);

    // Batch fetch loyalty profiles in a single API call
    const guestIds = guests.map((g) => g.id);
    let loyaltyMap = new Map<string, { tier: string; pointsBalance: number }>();
    try {
      const loyaltyProfiles = await apiClient.getLoyaltyProfilesBatch(guestIds);
      loyaltyMap = new Map(loyaltyProfiles.map((p) => [p.guestId, p]));
    } catch (e) {
      console.error("Failed to fetch loyalty profiles:", e);
    }

    const guestsWithLoyalty = guests.map((g) => {
      const loyalty = loyaltyMap.get(g.id);
      return { ...g, tier: loyalty?.tier || "N/A", points: loyalty?.pointsBalance || 0 };
    });

    guestsWithLoyalty.forEach((g) => {
      csvRows.push([
        g.primaryFirstName,
        g.primaryLastName,
        g.email,
        g.phone,
        g.tier,
        g.points,
        (g as GuestWithExtras).repeatStays || 0,
        "N/A" // Last visit not easily available without more queries
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "guests_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const createGuest = useMutation({
    mutationFn: () =>
      apiClient.createGuest({
        primaryFirstName: form.primaryFirstName.trim(),
        primaryLastName: form.primaryLastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        notes: form.notes || undefined,
        preferredContact: form.preferredContact || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        address1: form.address1 || undefined,
        address2: form.address2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        postalCode: form.postalCode || undefined,
        country: form.country || undefined,
        rigType: form.rigType || undefined,
        rigLength: form.rigLength ? Number(form.rigLength) : undefined,
        vehiclePlate: form.vehiclePlate || undefined,
        vehicleState: form.vehicleState || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : undefined,
        vip: form.vip,
        leadSource: form.leadSource || undefined,
        marketingOptIn: form.marketingOptIn,
        repeatStays: form.repeatStays ? Number(form.repeatStays) : undefined
      }),
    onSuccess: () => {
      setForm({
        primaryFirstName: "",
        primaryLastName: "",
        email: "",
        phone: "",
        notes: "",
        preferredContact: "",
        preferredLanguage: "",
        address1: "",
        address2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
        rigType: "",
        rigLength: "",
        vehiclePlate: "",
        vehicleState: "",
        tags: "",
        vip: false,
        leadSource: "",
        marketingOptIn: false,
        repeatStays: ""
      });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save guest",
        description: err?.message || "Please check required fields (name, valid email, phone).",
        variant: "destructive"
      });
      console.error("Create guest failed", err);
    }
  });
  const validateGuestForm = () => {
    const emailValid = /\S+@\S+\.\S+/.test(form.email.trim());
    const phoneDigits = form.phone.replace(/\D/g, "");
    const phoneValid = phoneDigits.length >= 7; // basic sanity
    return emailValid && phoneValid && !!form.primaryFirstName.trim() && !!form.primaryLastName.trim();
  };
  const updateGuest = useMutation({
    mutationFn: (payload: { id: string; data: Partial<GuestWithExtras> }) => apiClient.updateGuest(payload.id, payload.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    }
  });
  const deleteGuest = useMutation({
    mutationFn: (id: string) => apiClient.deleteGuest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guests"] })
  });

  const [sortBy, setSortBy] = useState<"name" | "email" | "phone" | "vip">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [vipFilter, setVipFilter] = useState<"all" | "vip" | "regular">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null);
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 4000);
    return () => clearTimeout(t);
  }, [flash]);

  const filteredAndSortedGuests = useMemo(() => {
    let data = guestsQuery.data ? [...guestsQuery.data] : [];

    // Apply search filter
    if (search) {
      const term = search.toLowerCase();
      data = data.filter((g) => {
        const name = `${g.primaryFirstName} ${g.primaryLastName}`.toLowerCase();
        const email = (g.email || "").toLowerCase();
        const phone = (g.phone || "").toLowerCase();
        return name.includes(term) || email.includes(term) || phone.includes(term);
      });
    }

    // Apply VIP filter
    if (vipFilter === "vip") {
      data = data.filter((g) => (g as GuestWithExtras).vip === true);
    } else if (vipFilter === "regular") {
      data = data.filter((g) => !(g as GuestWithExtras).vip);
    }

    // Apply sorting
    data.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortBy) {
        case "name":
          const nameA = `${a.primaryLastName} ${a.primaryFirstName}`.toLowerCase();
          const nameB = `${b.primaryLastName} ${b.primaryFirstName}`.toLowerCase();
          return dir * nameA.localeCompare(nameB);
        case "email":
          return dir * (a.email || "").localeCompare(b.email || "");
        case "phone":
          return dir * (a.phone || "").localeCompare(b.phone || "");
        case "vip":
          const vipA = (a as GuestWithExtras).vip ? 1 : 0;
          const vipB = (b as GuestWithExtras).vip ? 1 : 0;
          return dir * (vipB - vipA);
        default:
          return 0;
      }
    });

    return data;
  }, [guestsQuery.data, search, vipFilter, sortBy, sortDir]);

  const hasFilters = search || vipFilter !== "all";
  const activeFilterCount = (search ? 1 : 0) + (vipFilter !== "all" ? 1 : 0);
  const totalGuests = guestsQuery.data?.length || 0;
  const vipGuests = guestsQuery.data?.filter((g) => (g as GuestWithExtras).vip).length || 0;
  const optedInGuests = guestsQuery.data?.filter((g) => (g as GuestWithExtras).marketingOptIn).length || 0;

  const toggleGuestSelection = (guestId: string) => {
    setSelectedGuestIds((prev) => {
      const next = new Set(prev);
      if (next.has(guestId)) {
        next.delete(guestId);
      } else {
        next.add(guestId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedGuestIds.size === filteredAndSortedGuests.length) {
      setSelectedGuestIds(new Set());
    } else {
      setSelectedGuestIds(new Set(filteredAndSortedGuests.map((g) => g.id)));
    }
  };

  const selectedGuests = filteredAndSortedGuests.filter((g) => selectedGuestIds.has(g.id));
  const canMerge = selectedGuestIds.size === 2;

  const handleSort = (column: "name" | "email" | "phone" | "vip") => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

  const SortIndicator = ({ column }: { column: "name" | "email" | "phone" | "vip" }) => {
    if (sortBy !== column) return null;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <DashboardShell>
      <div className="space-y-4">
        <Breadcrumbs items={[{ label: "Guests" }]} />
        <PageHeader
          eyebrow="Guests"
          title={(
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                <Users className="h-5 w-5" />
              </span>
              <span>Guest profiles</span>
            </span>
          )}
          subtitle="Search, segment, and manage guest profiles."
          actions={(
            <>
              <Button variant="secondary" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                aria-expanded={showAddForm}
                aria-controls="guest-add-form"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {showAddForm ? "Hide form" : "Add guest"}
              </Button>
            </>
          )}
        />

        {flash && (
          <div
            role={flash.type === "error" ? "alert" : "status"}
            className={`rounded-md border px-3 py-2 text-sm ${
              flash.type === "success"
                ? "border-status-success/30 bg-status-success/10 text-status-success-text"
                : flash.type === "error"
                  ? "border-status-error/30 bg-status-error/10 text-status-error"
                  : "border-border bg-muted text-muted-foreground"
            }`}
          >
            {flash.message}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Total Guests
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold text-foreground flex items-center gap-2">
                {totalGuests}
              </div>
              <div className="text-xs text-muted-foreground">In database</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Crown className="h-4 w-4 text-status-warning" />
                VIP Guests
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold text-foreground flex items-center gap-2">
                {vipGuests}
              </div>
              <div className="text-xs text-muted-foreground">{totalGuests > 0 ? Math.round((vipGuests / totalGuests) * 100) : 0}% of total</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Star className="h-4 w-4 text-muted-foreground" />
                Marketing Opt-in
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold text-foreground">{optedInGuests}</div>
              <div className="text-xs text-muted-foreground">Can receive marketing</div>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Showing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              <div className="text-2xl font-semibold text-foreground">{filteredAndSortedGuests.length}</div>
              <div className="text-xs text-muted-foreground">of {totalGuests} guests</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions Bar */}
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                Filters & exports
                {hasFilters && (
                  <span className="rounded-full bg-status-success/15 text-status-success border border-status-success/30 px-2 py-0.5 text-[11px] font-semibold">
                    filters on
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!hasFilters}
                  onClick={() => {
                    setSearch("");
                    setVipFilter("all");
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-9 w-full sm:w-64"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search guests"
              />
              <Select value={vipFilter} onValueChange={(value) => setVipFilter(value as "all" | "vip" | "regular")}>
                <SelectTrigger className="h-9 w-full sm:w-40" aria-label="VIP filter">
                  <SelectValue placeholder="All guests" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All guests</SelectItem>
                  <SelectItem value="vip">VIP only</SelectItem>
                  <SelectItem value="regular">Regular only</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVipFilter("vip")}
                aria-pressed={vipFilter === "vip"}
              >
                <Crown className="h-3 w-3 mr-1" />
                VIP guests
              </Button>
              <div className="flex-1" />
              {selectedGuestIds.size > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md text-sm">
                  <span className="text-muted-foreground">{selectedGuestIds.size} selected</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={() => setSelectedGuestIds(new Set())}
                  >
                    Clear
                  </Button>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMergeDialog(true)}
                disabled={!canMerge}
                title={canMerge ? "Merge selected guests" : "Select exactly 2 guests to merge"}
              >
                <Merge className="h-4 w-4 mr-1" />
                Merge
              </Button>
            </div>

          {/* Active Filter Pills */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 mt-2">
              <span className="text-xs text-muted-foreground font-medium">Active:</span>
              {search.trim() && (
                <FilterChip
                  label={`Search: "${search.trim().length > 20 ? search.trim().slice(0, 20) + '...' : search.trim()}"`}
                  selected
                  removable
                  onRemove={() => setSearch("")}
                  variant="subtle"
                />
              )}
              {vipFilter !== "all" && (
                <FilterChip
                  label={`Status: ${vipFilter === "vip" ? "VIP only" : "Regular only"}`}
                  selected
                  removable
                  onRemove={() => setVipFilter("all")}
                  variant="subtle"
                />
              )}
              {activeFilterCount > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 px-2"
                  onClick={() => {
                    setSearch("");
                    setVipFilter("all");
                  }}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}
          </CardContent>
        </Card>

        {/* Collapsible Add Guest Form */}
        {showAddForm && (
          <div id="guest-add-form" className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-lg font-semibold text-foreground mb-3">Add new guest</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="First name"
              value={form.primaryFirstName}
              onChange={(e) => setForm((s) => ({ ...s, primaryFirstName: e.target.value }))}
              aria-label="First name"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Last name"
              value={form.primaryLastName}
              onChange={(e) => setForm((s) => ({ ...s, primaryLastName: e.target.value }))}
              aria-label="Last name"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              aria-label="Email"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
              aria-label="Phone"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Preferred contact (email/phone/sms)"
              value={form.preferredContact}
              onChange={(e) => setForm((s) => ({ ...s, preferredContact: e.target.value }))}
              aria-label="Preferred contact method"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Preferred language"
              value={form.preferredLanguage}
              onChange={(e) => setForm((s) => ({ ...s, preferredLanguage: e.target.value }))}
              aria-label="Preferred language"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Address 1"
              value={form.address1}
              onChange={(e) => setForm((s) => ({ ...s, address1: e.target.value }))}
              aria-label="Address line 1"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Address 2"
              value={form.address2}
              onChange={(e) => setForm((s) => ({ ...s, address2: e.target.value }))}
              aria-label="Address line 2"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              aria-label="City"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="State/Province"
              value={form.state}
              onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
              aria-label="State or province"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Postal code"
              value={form.postalCode}
              onChange={(e) => setForm((s) => ({ ...s, postalCode: e.target.value }))}
              aria-label="Postal code"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Country"
              value={form.country}
              onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
              aria-label="Country"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Rig type"
              value={form.rigType}
              onChange={(e) => setForm((s) => ({ ...s, rigType: e.target.value }))}
              aria-label="Rig type"
            />
            <Input
              type="number"
              className="rounded-md border border-border px-3 py-2"
              placeholder="Rig length (ft)"
              value={form.rigLength}
              onChange={(e) => setForm((s) => ({ ...s, rigLength: e.target.value }))}
              aria-label="Rig length in feet"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Vehicle plate"
              value={form.vehiclePlate}
              onChange={(e) => setForm((s) => ({ ...s, vehiclePlate: e.target.value }))}
              aria-label="Vehicle plate"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Vehicle state"
              value={form.vehicleState}
              onChange={(e) => setForm((s) => ({ ...s, vehicleState: e.target.value }))}
              aria-label="Vehicle state"
            />
            <Input
              className="rounded-md border border-border px-3 py-2 md:col-span-2"
              placeholder="Notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              aria-label="Notes"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Lead source"
              value={form.leadSource}
              onChange={(e) => setForm((s) => ({ ...s, leadSource: e.target.value }))}
              aria-label="Lead source"
            />
            <Input
              className="rounded-md border border-border px-3 py-2"
              placeholder="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))}
              aria-label="Tags"
            />
            <Input
              type="number"
              className="rounded-md border border-border px-3 py-2"
              placeholder="Repeat stays"
              value={form.repeatStays}
              onChange={(e) => setForm((s) => ({ ...s, repeatStays: e.target.value }))}
              aria-label="Repeat stays"
            />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.vip}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, vip: Boolean(checked) }))}
                aria-label="VIP"
              />
              VIP
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.marketingOptIn}
                onCheckedChange={(checked) => setForm((s) => ({ ...s, marketingOptIn: Boolean(checked) }))}
                aria-label="Marketing opt-in"
              />
              Marketing opt-in
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              disabled={createGuest.isPending || !validateGuestForm()}
              onClick={() => {
                if (!validateGuestForm()) {
                  toast({
                    title: "Missing or invalid info",
                    description: "Enter first/last name, valid email, and phone (7+ digits).",
                    variant: "destructive"
                  });
                  return;
                }
                createGuest.mutate();
              }}
            >
              {createGuest.isPending ? "Saving..." : "Save guest"}
            </Button>
            <Button variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            {createGuest.isError && (
              <span role="alert" className="ml-3 text-sm text-status-error">
                Failed to save guest
              </span>
            )}
          </div>
          </div>
        )}

        {/* Guests Table */}
        <div className="rounded-lg border border-border bg-card overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-10">
                  <Checkbox
                    checked={selectedGuestIds.size === filteredAndSortedGuests.length && filteredAndSortedGuests.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all guests"
                  />
                </th>
                <th
                  className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Name <SortIndicator column="name" />
                </th>
                <th
                  className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
                  onClick={() => handleSort("email")}
                >
                  Email <SortIndicator column="email" />
                </th>
                <th
                  className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
                  onClick={() => handleSort("phone")}
                >
                  Phone <SortIndicator column="phone" />
                </th>
                <th
                  className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
                  onClick={() => handleSort("vip")}
                >
                  Status <SortIndicator column="vip" />
                </th>
                <th className="px-3 py-2 text-left font-semibold">Loyalty</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAndSortedGuests.map((g, index) => (
                <Fragment key={g.id}>
                <StaggeredTableRow index={index} className={cn("hover:bg-muted/60", selectedGuestIds.has(g.id) && "bg-status-success/10")}>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selectedGuestIds.has(g.id)}
                      onCheckedChange={() => toggleGuestSelection(g.id)}
                      aria-label={`Select ${g.primaryFirstName} ${g.primaryLastName}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    <div className="font-medium">{g.primaryLastName}, {g.primaryFirstName}</div>
                    {(g as GuestWithExtras).city && (g as GuestWithExtras).state && (
                      <div className="text-xs text-muted-foreground">{(g as GuestWithExtras).city}, {(g as GuestWithExtras).state}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-foreground">{g.email}</td>
                  <td className="px-3 py-2 text-foreground">{g.phone}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(g as GuestWithExtras).vip && (
                        <span className="rounded-full border border-status-warning-border bg-status-warning-bg text-status-warning-text px-2 py-0.5 text-xs font-medium flex items-center gap-1">
                          <Crown className="h-3 w-3" /> VIP
                        </span>
                      )}
                      {(g as GuestWithExtras).marketingOptIn && (
                        <span className="rounded-full border border-status-success-border bg-status-success-bg text-status-success-text px-2 py-0.5 text-xs">
                          Opt-in
                        </span>
                      )}
                      {!(g as GuestWithExtras).vip && !(g as GuestWithExtras).marketingOptIn && (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <GuestLoyaltyBadge guestId={g.id} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => router.push(`/guests/${g.id}`)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedGuestId(expandedGuestId === g.id ? null : g.id)}
                        aria-expanded={expandedGuestId === g.id}
                        aria-controls={`guest-details-${g.id}`}
                      >
                        {expandedGuestId === g.id ? "Hide" : "Expand"}
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-status-error hover:text-status-error hover:bg-status-error/10"
                            disabled={deleteGuest.isPending}
                            aria-label={`Delete ${g.primaryFirstName} ${g.primaryLastName}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        }
                        title="Delete guest?"
                        description="This will permanently remove this guest and their history. This action cannot be undone."
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => deleteGuest.mutate(g.id)}
                        isPending={deleteGuest.isPending}
                      />
                    </div>
                  </td>
                </StaggeredTableRow>
                {/* Expanded row for additional details */}
                {expandedGuestId === g.id && (
                  <tr id={`guest-details-${g.id}`} className="bg-muted">
                    <td colSpan={7} className="px-3 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Contact Info</h4>
                          <div className="text-sm space-y-1">
                            {(g as GuestWithExtras).preferredContact && (
                              <div><span className="text-muted-foreground">Preferred:</span> {(g as GuestWithExtras).preferredContact}</div>
                            )}
                            {(g as GuestWithExtras).preferredLanguage && (
                              <div><span className="text-muted-foreground">Language:</span> {(g as GuestWithExtras).preferredLanguage}</div>
                            )}
                            {(g as GuestWithExtras).address1 && (
                              <div className="text-muted-foreground">
                                {(g as GuestWithExtras).address1}
                                {(g as GuestWithExtras).address2 && <>, {(g as GuestWithExtras).address2}</>}
                                {(g as GuestWithExtras).city && <>, {(g as GuestWithExtras).city}</>}
                                {(g as GuestWithExtras).state && <>, {(g as GuestWithExtras).state}</>}
                                {(g as GuestWithExtras).postalCode && <> {(g as GuestWithExtras).postalCode}</>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Equipment</h4>
                          <div className="text-sm space-y-1">
                            {(g as GuestWithExtras).rigType && (
                              <div><span className="text-muted-foreground">Rig:</span> {(g as GuestWithExtras).rigType} {(g as GuestWithExtras).rigLength ? `• ${(g as GuestWithExtras).rigLength}ft` : ""}</div>
                            )}
                            {(g as GuestWithExtras).vehiclePlate && (
                              <div><span className="text-muted-foreground">Vehicle:</span> {(g as GuestWithExtras).vehiclePlate} {(g as GuestWithExtras).vehicleState ? `(${(g as GuestWithExtras).vehicleState})` : ""}</div>
                            )}
                            {!(g as GuestWithExtras).rigType && !(g as GuestWithExtras).vehiclePlate && (
                              <div className="text-muted-foreground">No equipment on file</div>
                            )}
                          </div>
                          <GuestEquipmentSection
                            guestId={g.id}
                            expanded={expandedEquipmentId === g.id}
                            onToggle={() => setExpandedEquipmentId(expandedEquipmentId === g.id ? null : g.id)}
                          />
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Other Info</h4>
                          <div className="text-sm space-y-1">
                            {(g as GuestWithExtras).leadSource && (
                              <div><span className="text-muted-foreground">Source:</span> {(g as GuestWithExtras).leadSource}</div>
                            )}
                            {(g as GuestWithExtras).tags && ((g as GuestWithExtras).tags?.length ?? 0) > 0 && (
                              <div><span className="text-muted-foreground">Tags:</span> {(g as GuestWithExtras).tags?.join(", ")}</div>
                            )}
                            {(g as GuestWithExtras).repeatStays && ((g as GuestWithExtras).repeatStays ?? 0) > 0 && (
                              <div><span className="text-muted-foreground">Repeat stays:</span> {(g as GuestWithExtras).repeatStays}</div>
                            )}
                            {g.notes && (
                              <div><span className="text-muted-foreground">Notes:</span> {g.notes}</div>
                            )}
                          </div>
                          <GuestRewardsSection
                            guestId={g.id}
                            expanded={expandedRewardsId === g.id}
                            onToggle={() => setExpandedRewardsId(expandedRewardsId === g.id ? null : g.id)}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              {guestsQuery.isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8">
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center gap-4 p-3 bg-muted/60 rounded">
                          <div className="w-10 h-10 bg-muted rounded-full" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-48" />
                            <div className="h-3 bg-muted rounded w-32" />
                          </div>
                          <div className="h-6 w-20 bg-muted rounded" />
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!guestsQuery.isLoading && filteredAndSortedGuests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div className="space-y-2" role={guestsQuery.isError ? "alert" : "status"}>
                        <p className="text-lg font-semibold text-foreground">
                          {!campgroundChecked
                            ? "Loading..."
                            : !campgroundId
                              ? "No campground selected"
                              : guestsQuery.isError
                                ? "Error loading guests"
                                : hasFilters
                                  ? "No guests match your filters"
                                  : "No guests yet"}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                          {!campgroundChecked
                            ? "Checking campground..."
                            : !campgroundId
                              ? "Please select a campground from the sidebar to view guests."
                              : guestsQuery.isError
                                ? `${guestsQuery.error?.message || "An error occurred while loading guests."}`
                                : hasFilters
                                  ? "Try adjusting your search or filter criteria to find what you're looking for."
                                  : "Guests are created automatically when you make a reservation, or you can add them manually."}
                        </p>
                      </div>
                      {!campgroundChecked ? null : !campgroundId ? null : guestsQuery.isError ? (
                        <Button
                          variant="outline"
                          onClick={() => guestsQuery.refetch()}
                          className="mt-2"
                        >
                          Try Again
                        </Button>
                      ) : hasFilters ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSearch("");
                            setVipFilter("all");
                          }}
                          className="mt-2"
                        >
                          Clear Filters
                        </Button>
                      ) : (
                        <div className="flex gap-2 mt-2">
                          <Button
                            onClick={() => setShowAddForm(true)}
                            className="gap-2"
                          >
                            <UserPlus className="h-4 w-4" />
                            Add Your First Guest
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => router.push("/booking")}
                            className="gap-2"
                          >
                            Create a Reservation
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Merge Guests Dialog */}
      <MergeGuestsDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        guests={selectedGuests as any}
        campgroundId={campgroundId || ""}
        onSuccess={() => setSelectedGuestIds(new Set())}
      />
    </DashboardShell>
  );
}
