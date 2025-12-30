"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCampground } from "@/contexts/CampgroundContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Save,
  Shield,
  Gift,
  Mail,
  Sparkles,
  DollarSign,
  CloudRain,
  Clock,
  ShieldCheck,
  Umbrella,
  BadgeCheck,
  Flame,
  Coffee,
  Tent,
  MapPin,
} from "lucide-react";

const GUARANTEE_TYPES = [
  { value: "unconditional", label: "Money Back (No Questions)", icon: ShieldCheck },
  { value: "conditional", label: "Conditional Refund", icon: Shield },
  { value: "performance", label: "Performance Guarantee", icon: BadgeCheck },
  { value: "satisfaction", label: "Satisfaction Guarantee", icon: Sparkles },
  { value: "weather", label: "Weather Guarantee", icon: CloudRain },
  { value: "best_price", label: "Best Price Guarantee", icon: DollarSign },
];

const ICON_OPTIONS = [
  { value: "shield-check", label: "Shield Check", icon: ShieldCheck },
  { value: "cloud-rain", label: "Cloud Rain", icon: CloudRain },
  { value: "clock", label: "Clock", icon: Clock },
  { value: "dollar-sign", label: "Dollar Sign", icon: DollarSign },
  { value: "sparkles", label: "Sparkles", icon: Sparkles },
  { value: "umbrella", label: "Umbrella", icon: Umbrella },
  { value: "badge-check", label: "Badge Check", icon: BadgeCheck },
  { value: "flame", label: "Flame", icon: Flame },
  { value: "coffee", label: "Coffee", icon: Coffee },
  { value: "tent", label: "Tent", icon: Tent },
  { value: "map-pin", label: "Map Pin", icon: MapPin },
  { value: "gift", label: "Gift", icon: Gift },
];

type Guarantee = {
  id: string;
  type: string;
  title: string;
  description: string;
  iconName?: string;
  sortOrder: number;
  isActive: boolean;
};

type Bonus = {
  id: string;
  name: string;
  description?: string;
  valueCents: number;
  iconName?: string;
  siteClassIds: string[];
  isAutoIncluded: boolean;
  sortOrder: number;
  isActive: boolean;
};

type LeadConfig = {
  eventsEnabled: boolean;
  eventsHeadline: string;
  eventsSubtext: string;
  eventsButtonText: string;
  newsletterEnabled: boolean;
  newsletterHeadline: string;
  newsletterSubtext: string;
  newsletterButtonText: string;
  firstBookingEnabled: boolean;
  firstBookingDiscount: number;
  firstBookingHeadline: string;
};

type BookingConfig = {
  heroHeadline?: string;
  heroSubline?: string;
  dreamOutcome?: string;
  showReviewCount: boolean;
  showTrustBadges: boolean;
  showScarcity: boolean;
  showLiveViewers: boolean;
  showLimitedAvail: boolean;
  bookButtonText: string;
  checkAvailText: string;
};

async function fetchValueStack(campgroundId: string) {
  const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/guarantees`);
  const guarantees = res.ok ? await res.json() : [];

  const bonusRes = await fetch(`/api/campgrounds/${campgroundId}/value-stack/bonuses`);
  const bonuses = bonusRes.ok ? await bonusRes.json() : [];

  const leadRes = await fetch(`/api/campgrounds/${campgroundId}/value-stack/lead-capture`);
  const leadConfig = leadRes.ok ? await leadRes.json() : null;

  const bookingRes = await fetch(`/api/campgrounds/${campgroundId}/value-stack/booking-page`);
  const bookingConfig = bookingRes.ok ? await bookingRes.json() : null;

  return { guarantees, bonuses, leadConfig, bookingConfig };
}

export default function ValueStackPage() {
  const { selectedCampground, isHydrated } = useCampground();
  const campgroundId = selectedCampground?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [guarantees, setGuarantees] = useState<Guarantee[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [leadConfig, setLeadConfig] = useState<LeadConfig>({
    eventsEnabled: true,
    eventsHeadline: "Something exciting is coming...",
    eventsSubtext: "Sign up to be the first to know about special events and deals",
    eventsButtonText: "Notify Me",
    newsletterEnabled: true,
    newsletterHeadline: "Get the inside scoop",
    newsletterSubtext: "Exclusive deals, event announcements, and camping tips",
    newsletterButtonText: "Subscribe",
    firstBookingEnabled: true,
    firstBookingDiscount: 10,
    firstBookingHeadline: "First time? Get 10% off",
  });
  const [bookingConfig, setBookingConfig] = useState<BookingConfig>({
    showReviewCount: true,
    showTrustBadges: true,
    showScarcity: true,
    showLiveViewers: false,
    showLimitedAvail: true,
    bookButtonText: "Book Now",
    checkAvailText: "Check availability",
  });

  const { data: valueStackData, isLoading } = useQuery({
    queryKey: ["value-stack", campgroundId],
    queryFn: () => fetchValueStack(campgroundId!),
    enabled: !!campgroundId,
  });

  // Sync state when data changes (replaces onSuccess)
  useEffect(() => {
    if (valueStackData) {
      if (valueStackData.guarantees) setGuarantees(valueStackData.guarantees);
      if (valueStackData.bonuses) setBonuses(valueStackData.bonuses);
      if (valueStackData.leadConfig) setLeadConfig(valueStackData.leadConfig);
      if (valueStackData.bookingConfig) setBookingConfig(valueStackData.bookingConfig);
    }
  }, [valueStackData]);

  // Guarantee mutations
  const createGuarantee = useMutation({
    mutationFn: async (data: Omit<Guarantee, "id" | "isActive">) => {
      const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/guarantees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (newGuarantee) => {
      setGuarantees([...guarantees, newGuarantee]);
      toast({ title: "Guarantee added" });
    },
  });

  const updateGuarantee = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Guarantee> & { id: string }) => {
      const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/guarantees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (updated) => {
      setGuarantees(guarantees.map(g => g.id === updated.id ? updated : g));
      toast({ title: "Guarantee updated" });
    },
  });

  const deleteGuarantee = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/campgrounds/${campgroundId}/value-stack/guarantees/${id}`, {
        method: "DELETE",
      });
      return id;
    },
    onSuccess: (id) => {
      setGuarantees(guarantees.filter(g => g.id !== id));
      toast({ title: "Guarantee removed" });
    },
  });

  // Bonus mutations
  const createBonus = useMutation({
    mutationFn: async (data: Omit<Bonus, "id" | "isActive">) => {
      const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/bonuses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (newBonus) => {
      setBonuses([...bonuses, newBonus]);
      toast({ title: "Bonus added" });
    },
  });

  const updateBonus = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Bonus> & { id: string }) => {
      const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/bonuses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (updated) => {
      setBonuses(bonuses.map(b => b.id === updated.id ? updated : b));
      toast({ title: "Bonus updated" });
    },
  });

  const deleteBonus = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/campgrounds/${campgroundId}/value-stack/bonuses/${id}`, {
        method: "DELETE",
      });
      return id;
    },
    onSuccess: (id) => {
      setBonuses(bonuses.filter(b => b.id !== id));
      toast({ title: "Bonus removed" });
    },
  });

  // Config mutations
  const saveLeadConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/lead-capture`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadConfig),
      });
      return res.json();
    },
    onSuccess: () => toast({ title: "Lead capture settings saved" }),
  });

  const saveBookingConfig = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campgrounds/${campgroundId}/value-stack/booking-page`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingConfig),
      });
      return res.json();
    },
    onSuccess: () => toast({ title: "Booking page settings saved" }),
  });

  const addNewGuarantee = () => {
    createGuarantee.mutate({
      type: "satisfaction",
      title: "Satisfaction Guarantee",
      description: "Don't love your first night? Let us know and we'll make it right.",
      iconName: "shield-check",
      sortOrder: guarantees.length,
    });
  };

  const addNewBonus = () => {
    createBonus.mutate({
      name: "Free Firewood Bundle",
      description: "Complimentary firewood for your campfire",
      valueCents: 1500,
      iconName: "flame",
      siteClassIds: [],
      isAutoIncluded: true,
      sortOrder: bonuses.length,
    });
  };

  const totalBonusValue = bonuses.reduce((sum, b) => sum + b.valueCents, 0);

  // Wait for hydration before showing content to avoid hydration mismatch
  if (!isHydrated || isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  // Show campground selection prompt after hydration confirms no campground
  if (!campgroundId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
          <Shield className="w-12 h-12 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Select a Campground</h1>
        <p className="text-slate-500 max-w-md">
          Please select a campground to manage value stack settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Value Stack & Offers</h1>
        <p className="text-slate-500 mt-1">
          Configure guarantees, bonuses, and messaging to make your offer irresistible
        </p>
      </div>

      <Tabs defaultValue="guarantees" className="space-y-6">
        <TabsList>
          <TabsTrigger value="guarantees" className="gap-2">
            <Shield className="h-4 w-4" />
            Guarantees
          </TabsTrigger>
          <TabsTrigger value="bonuses" className="gap-2">
            <Gift className="h-4 w-4" />
            Bonuses
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Mail className="h-4 w-4" />
            Lead Capture
          </TabsTrigger>
          <TabsTrigger value="messaging" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Page Messaging
          </TabsTrigger>
        </TabsList>

        {/* GUARANTEES TAB */}
        <TabsContent value="guarantees" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Risk Reversal Guarantees</h2>
              <p className="text-sm text-slate-500">
                Reduce booking anxiety with guarantees that show you stand behind your experience
              </p>
            </div>
            <Button onClick={addNewGuarantee} disabled={createGuarantee.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Guarantee
            </Button>
          </div>

          {guarantees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No guarantees yet</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Guarantees reduce booking anxiety and increase conversions. Add weather guarantees,
                  satisfaction guarantees, or best price promises.
                </p>
                <Button onClick={addNewGuarantee}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Guarantee
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {guarantees.map((g, idx) => (
                <Card key={g.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1 pt-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={idx === 0}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <GripVertical className="h-4 w-4 text-slate-400" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={idx === guarantees.length - 1}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex-1 grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Guarantee Type</Label>
                          <Select
                            value={g.type}
                            onValueChange={(v) => updateGuarantee.mutate({ id: g.id, type: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GUARANTEE_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  <div className="flex items-center gap-2">
                                    <t.icon className="h-4 w-4" />
                                    {t.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Icon</Label>
                          <Select
                            value={g.iconName || "shield-check"}
                            onValueChange={(v) => updateGuarantee.mutate({ id: g.id, iconName: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_OPTIONS.map((i) => (
                                <SelectItem key={i.value} value={i.value}>
                                  <div className="flex items-center gap-2">
                                    <i.icon className="h-4 w-4" />
                                    {i.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-2">
                          <Label>Title</Label>
                          <Input
                            value={g.title}
                            onChange={(e) => updateGuarantee.mutate({ id: g.id, title: e.target.value })}
                            placeholder="e.g., Rain Guarantee"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            value={g.description}
                            onChange={(e) => updateGuarantee.mutate({ id: g.id, description: e.target.value })}
                            placeholder="e.g., If it rains 3+ days during your stay, get 50% credit for your next visit."
                            rows={2}
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => deleteGuarantee.mutate(g.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* BONUSES TAB */}
        <TabsContent value="bonuses" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Included Bonuses</h2>
              <p className="text-sm text-slate-500">
                Stack value to make guests feel like they're getting an amazing deal
              </p>
            </div>
            <div className="flex items-center gap-4">
              {totalBonusValue > 0 && (
                <Badge variant="secondary" className="bg-status-success/15 text-status-success">
                  Total Value: ${(totalBonusValue / 100).toFixed(0)}
                </Badge>
              )}
              <Button onClick={addNewBonus} disabled={createBonus.isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Add Bonus
              </Button>
            </div>
          </div>

          {bonuses.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Gift className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No bonuses yet</h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto">
                  Bonuses add perceived value to your offer. Include firewood, welcome kits,
                  early check-in, or digital guides to stack value.
                </p>
                <Button onClick={addNewBonus}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Bonus
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {bonuses.map((b, idx) => (
                <Card key={b.id}>
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center gap-1 pt-2">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={idx === 0}>
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <GripVertical className="h-4 w-4 text-slate-400" />
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={idx === bonuses.length - 1}>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex-1 grid gap-4 md:grid-cols-3">
                        <div>
                          <Label>Bonus Name</Label>
                          <Input
                            value={b.name}
                            onChange={(e) => updateBonus.mutate({ id: b.id, name: e.target.value })}
                            placeholder="e.g., Free Firewood Bundle"
                          />
                        </div>

                        <div>
                          <Label>Perceived Value ($)</Label>
                          <Input
                            type="number"
                            value={(b.valueCents / 100).toFixed(0)}
                            onChange={(e) => updateBonus.mutate({ id: b.id, valueCents: Number(e.target.value) * 100 })}
                            placeholder="15"
                          />
                        </div>

                        <div>
                          <Label>Icon</Label>
                          <Select
                            value={b.iconName || "gift"}
                            onValueChange={(v) => updateBonus.mutate({ id: b.id, iconName: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ICON_OPTIONS.map((i) => (
                                <SelectItem key={i.value} value={i.value}>
                                  <div className="flex items-center gap-2">
                                    <i.icon className="h-4 w-4" />
                                    {i.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="md:col-span-3">
                          <Label>Description</Label>
                          <Input
                            value={b.description || ""}
                            onChange={(e) => updateBonus.mutate({ id: b.id, description: e.target.value })}
                            placeholder="e.g., Includes 6 logs and kindling for your campfire"
                          />
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => deleteBonus.mutate(b.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* LEAD CAPTURE TAB */}
        <TabsContent value="leads" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Lead Capture Settings</h2>
              <p className="text-sm text-slate-500">
                Capture emails from visitors who aren't ready to book yet
              </p>
            </div>
            <Button onClick={() => saveLeadConfig.mutate()} disabled={saveLeadConfig.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Events Empty State */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Events Empty State</CardTitle>
                  <Switch
                    checked={leadConfig.eventsEnabled}
                    onCheckedChange={(v) => setLeadConfig({ ...leadConfig, eventsEnabled: v })}
                  />
                </div>
                <CardDescription>
                  Shown when you have no upcoming events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Headline</Label>
                  <Input
                    value={leadConfig.eventsHeadline}
                    onChange={(e) => setLeadConfig({ ...leadConfig, eventsHeadline: e.target.value })}
                    disabled={!leadConfig.eventsEnabled}
                  />
                </div>
                <div>
                  <Label>Subtext</Label>
                  <Textarea
                    value={leadConfig.eventsSubtext}
                    onChange={(e) => setLeadConfig({ ...leadConfig, eventsSubtext: e.target.value })}
                    rows={2}
                    disabled={!leadConfig.eventsEnabled}
                  />
                </div>
                <div>
                  <Label>Button Text</Label>
                  <Input
                    value={leadConfig.eventsButtonText}
                    onChange={(e) => setLeadConfig({ ...leadConfig, eventsButtonText: e.target.value })}
                    disabled={!leadConfig.eventsEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Newsletter Signup */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Newsletter Signup</CardTitle>
                  <Switch
                    checked={leadConfig.newsletterEnabled}
                    onCheckedChange={(v) => setLeadConfig({ ...leadConfig, newsletterEnabled: v })}
                  />
                </div>
                <CardDescription>
                  Footer email capture for updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Headline</Label>
                  <Input
                    value={leadConfig.newsletterHeadline}
                    onChange={(e) => setLeadConfig({ ...leadConfig, newsletterHeadline: e.target.value })}
                    disabled={!leadConfig.newsletterEnabled}
                  />
                </div>
                <div>
                  <Label>Subtext</Label>
                  <Textarea
                    value={leadConfig.newsletterSubtext}
                    onChange={(e) => setLeadConfig({ ...leadConfig, newsletterSubtext: e.target.value })}
                    rows={2}
                    disabled={!leadConfig.newsletterEnabled}
                  />
                </div>
                <div>
                  <Label>Button Text</Label>
                  <Input
                    value={leadConfig.newsletterButtonText}
                    onChange={(e) => setLeadConfig({ ...leadConfig, newsletterButtonText: e.target.value })}
                    disabled={!leadConfig.newsletterEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* First Booking Discount */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">First-Time Visitor Discount</CardTitle>
                  <Switch
                    checked={leadConfig.firstBookingEnabled}
                    onCheckedChange={(v) => setLeadConfig({ ...leadConfig, firstBookingEnabled: v })}
                  />
                </div>
                <CardDescription>
                  Offer a discount to first-time visitors who share their email
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Headline</Label>
                  <Input
                    value={leadConfig.firstBookingHeadline}
                    onChange={(e) => setLeadConfig({ ...leadConfig, firstBookingHeadline: e.target.value })}
                    disabled={!leadConfig.firstBookingEnabled}
                  />
                </div>
                <div>
                  <Label>Discount Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={leadConfig.firstBookingDiscount}
                      onChange={(e) => setLeadConfig({ ...leadConfig, firstBookingDiscount: Number(e.target.value) })}
                      className="w-20"
                      disabled={!leadConfig.firstBookingEnabled}
                    />
                    <span className="text-slate-500">% off first booking</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PAGE MESSAGING TAB */}
        <TabsContent value="messaging" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Booking Page Messaging</h2>
              <p className="text-sm text-slate-500">
                Customize copy and display settings for your public booking page
              </p>
            </div>
            <Button onClick={() => saveBookingConfig.mutate()} disabled={saveBookingConfig.isPending}>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dream Outcome Messaging</CardTitle>
              <CardDescription>
                Paint a picture of the experience, not just features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Hero Headline Override</Label>
                <Input
                  value={bookingConfig.heroHeadline || ""}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, heroHeadline: e.target.value })}
                  placeholder="Leave empty to use campground name"
                />
              </div>
              <div>
                <Label>Hero Subline Override</Label>
                <Input
                  value={bookingConfig.heroSubline || ""}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, heroSubline: e.target.value })}
                  placeholder="Leave empty to use campground tagline"
                />
              </div>
              <div>
                <Label>Dream Outcome</Label>
                <Textarea
                  value={bookingConfig.dreamOutcome || ""}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, dreamOutcome: e.target.value })}
                  placeholder="e.g., Wake up to the sound of the river. No emails. No traffic. Just you, nature, and 47 acres of peace."
                  rows={3}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Focus on the transformation and feeling, not just the location
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trust & Urgency Signals</CardTitle>
              <CardDescription>
                Toggle what elements appear on your booking page
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Review Count</Label>
                    <p className="text-xs text-slate-500">Display star rating and review count</p>
                  </div>
                  <Switch
                    checked={bookingConfig.showReviewCount}
                    onCheckedChange={(v) => setBookingConfig({ ...bookingConfig, showReviewCount: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Trust Badges</Label>
                    <p className="text-xs text-slate-500">Verified photos, secure booking badges</p>
                  </div>
                  <Switch
                    checked={bookingConfig.showTrustBadges}
                    onCheckedChange={(v) => setBookingConfig({ ...bookingConfig, showTrustBadges: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Scarcity</Label>
                    <p className="text-xs text-slate-500">"Only 2 spots left" badges</p>
                  </div>
                  <Switch
                    checked={bookingConfig.showScarcity}
                    onCheckedChange={(v) => setBookingConfig({ ...bookingConfig, showScarcity: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Live Viewers</Label>
                    <p className="text-xs text-slate-500">"3 people viewing" indicator</p>
                  </div>
                  <Switch
                    checked={bookingConfig.showLiveViewers}
                    onCheckedChange={(v) => setBookingConfig({ ...bookingConfig, showLiveViewers: v })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Button Text</CardTitle>
              <CardDescription>
                Customize call-to-action button labels
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Book Button</Label>
                <Input
                  value={bookingConfig.bookButtonText}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, bookButtonText: e.target.value })}
                />
              </div>
              <div>
                <Label>Check Availability Button</Label>
                <Input
                  value={bookingConfig.checkAvailText}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, checkAvailText: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
