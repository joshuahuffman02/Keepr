"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Heart,
  DollarSign,
  Users,
  TrendingUp,
  Plus,
  Building2,
  CheckCircle,
  Loader2,
  Sparkles,
  Gift,
  BookOpen,
  ArrowRight,
  PartyPopper
} from "lucide-react";

// Sybil's Kids as a virtual "suggested" charity when no charities exist
const SYBILS_KIDS = {
  id: "__sybils_kids__",
  name: "Sybil's Kids",
  description: "Supporting children in need through education and enrichment programs.",
  website: "https://sybilskids.com",
  isVerified: true,
  isSuggested: true,
};

// Milestone messages based on donation totals
function getMilestoneMessage(totalCents: number): { milestone: string; next: string; progress: number } | null {
  const dollars = totalCents / 100;
  if (dollars >= 1000) return { milestone: "Over $1,000 raised!", next: "Keep the momentum going!", progress: 100 };
  if (dollars >= 500) return { milestone: "$500 milestone reached!", next: `$${(1000 - dollars).toFixed(0)} to reach $1,000`, progress: 50 };
  if (dollars >= 100) return { milestone: "First $100 raised!", next: `$${(500 - dollars).toFixed(0)} to reach $500`, progress: 20 };
  if (dollars > 0) return { milestone: "First donations received!", next: `$${(100 - dollars).toFixed(0)} to reach $100`, progress: Math.min(dollars, 10) };
  return null;
}

export default function CharitySettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  // Get campground ID from localStorage
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCampgroundId(localStorage.getItem("campreserv:selectedCampground"));
    }
  }, []);

  // Form state
  const [isEnabled, setIsEnabled] = useState(true);
  const [charityMode, setCharityMode] = useState<"existing" | "custom">("existing");
  const [selectedCharityId, setSelectedCharityId] = useState<string>("");
  const [customCharity, setCustomCharity] = useState({ name: "", description: "", taxId: "", website: "" });
  const [customMessage, setCustomMessage] = useState("");
  const [roundUpType, setRoundUpType] = useState("nearest_dollar");
  const [defaultOptIn, setDefaultOptIn] = useState(false);
  const [glCode, setGlCode] = useState("2400");

  // Track if we've loaded initial settings to prevent re-running
  const hasLoadedSettings = useRef(false);

  // Fetch available charities
  const { data: charities = [], isLoading: loadingCharities } = useQuery({
    queryKey: ["charities"],
    queryFn: () => apiClient.listCharities({ activeOnly: true }),
    enabled: !!campgroundId,
    staleTime: 5 * 60 * 1000, // 5 minutes - charity list rarely changes
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1, // Only retry once on failure
  });

  // Fetch current campground charity settings
  const { data: currentSettings, isLoading: loadingSettings } = useQuery<{
    isEnabled: boolean;
    charityId: string;
    customMessage?: string | null;
    roundUpType: string;
    defaultOptIn: boolean;
    glCode?: string;
    charity?: { name: string };
  } | null>({
    queryKey: ["campground-charity", campgroundId],
    queryFn: () => apiClient.getCampgroundCharity(campgroundId!),
    enabled: !!campgroundId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Fetch donation stats
  const { data: stats } = useQuery<{
    totalAmountCents: number;
    totalDonations: number;
    donorCount: number;
    optInRate: number;
  }>({
    queryKey: ["campground-charity-stats", campgroundId],
    queryFn: () => apiClient.getCampgroundCharityStats(campgroundId!),
    enabled: !!campgroundId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });

  // Load current settings into form - only run once after initial data load
  useEffect(() => {
    if (currentSettings && !hasLoadedSettings.current) {
      hasLoadedSettings.current = true;
      setIsEnabled(currentSettings.isEnabled);
      setSelectedCharityId(currentSettings.charityId);
      setCustomMessage(currentSettings.customMessage || "");
      setRoundUpType(currentSettings.roundUpType);
      setDefaultOptIn(currentSettings.defaultOptIn);
      if (currentSettings.glCode) {
        setGlCode(currentSettings.glCode);
      }
      setCharityMode("existing");
    }
  }, [currentSettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("No campground selected");

      const payload: Parameters<typeof apiClient.setCampgroundCharity>[1] = {
        isEnabled,
        customMessage: customMessage || undefined,
        roundUpType,
        defaultOptIn,
        glCode,
      };

      if (charityMode === "existing") {
        // Use selectedCharityId or fall back to currentSettings if not explicitly changed
        const charityIdToUse = selectedCharityId || currentSettings?.charityId;

        // Check if it's the virtual Sybil's Kids selection
        if (charityIdToUse === SYBILS_KIDS.id) {
          payload.newCharity = {
            name: SYBILS_KIDS.name,
            description: SYBILS_KIDS.description,
            website: SYBILS_KIDS.website,
          };
        } else if (charityIdToUse) {
          payload.charityId = charityIdToUse;
        } else {
          // No charity selected - throw a helpful error
          throw new Error("Please select a charity first");
        }
      } else {
        payload.newCharity = {
          name: customCharity.name,
          description: customCharity.description || undefined,
          taxId: customCharity.taxId || undefined,
          website: customCharity.website || undefined,
        };
      }

      return apiClient.setCampgroundCharity(campgroundId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campground-charity", campgroundId] });
      toast({ title: "Settings saved!", description: "Your charity round-up is ready to make a difference." });
    },
    onError: (err) => {
      toast({ title: "Couldn't save settings", description: String(err), variant: "destructive" });
    },
  });

  // Disable mutation
  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!campgroundId) throw new Error("No campground selected");
      return apiClient.disableCampgroundCharity(campgroundId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campground-charity", campgroundId] });
      setIsEnabled(false);
      toast({ title: "Round-up paused", description: "You can re-enable it anytime." });
    },
  });

  // Use Sybil's Kids as default - select in existing tab
  const handleUseSybilsKids = () => {
    setCharityMode("existing");
    setSelectedCharityId(SYBILS_KIDS.id);
  };

  if (!campgroundId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Please select a campground first.
      </div>
    );
  }

  // Only show full loading spinner on initial load when we have no cached data
  const isInitialLoading = (loadingSettings && !currentSettings) || (loadingCharities && charities.length === 0);
  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const milestone = stats ? getMilestoneMessage(stats.totalAmountCents) : null;
  const hasRaisedMoney = stats && stats.totalAmountCents > 0;
  const charityName = currentSettings?.charity?.name || customCharity.name || "your chosen charity";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hero Section - Warm, Emotional Header */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-status-warning/10 border border-status-warning/20 p-8"
      >
        {/* Decorative elements */}
        <div className="absolute top-4 right-4 opacity-20">
          <Heart className="h-24 w-24 text-rose-400" />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-status-warning/15">
              <Heart className="h-6 w-6 text-status-warning" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground dark:text-white">
                Charity Round-Up
              </h1>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                Turn spare change into real change
              </p>
            </div>
          </div>

          <p className="text-muted-foreground dark:text-muted-foreground max-w-xl mt-4">
            When guests check out, they can round up their total to support a cause you care about.
            It's a small gesture that adds up to something meaningful.
          </p>

          {/* Milestone Banner */}
          {milestone && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 p-4 rounded-xl bg-card/70 dark:bg-muted/70 backdrop-blur border border-amber-200 dark:border-amber-800"
            >
              <div className="flex items-center gap-3">
                <PartyPopper className="h-5 w-5 text-amber-500" />
                <div className="flex-1">
                  <p className="font-medium text-foreground dark:text-white">{milestone.milestone}</p>
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">{milestone.next}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Impact Stats - Always Visible */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-status-success/10" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground dark:text-white">
                  ${((stats?.totalAmountCents || 0) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">Total Raised</p>
              </div>
            </div>
            {!hasRaisedMoney && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Ready to start!
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-status-info/10" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <Heart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground dark:text-white">
                  {stats?.totalDonations || 0}
                </p>
                <p className="text-xs text-muted-foreground">Donations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-status-warning/10" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/50">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground dark:text-white">
                  {stats?.donorCount || 0}
                </p>
                <p className="text-xs text-muted-foreground">Generous Guests</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-status-warning/10" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/50">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground dark:text-white">
                  {(stats?.optInRate || 0).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">Opt-in Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Enable Toggle */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className={`transition-all duration-300 ${isEnabled ? 'ring-2 ring-emerald-500/20 border-emerald-200 dark:border-emerald-800' : ''}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full transition-colors ${isEnabled ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-muted dark:bg-muted'}`}>
                  {isEnabled ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Heart className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground dark:text-white">
                    {isEnabled ? 'Round-Up is Active' : 'Round-Up is Paused'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isEnabled
                      ? `Guests can donate to ${charityName}`
                      : 'Enable to let guests round up for charity'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Settings */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-rose-500" />
              Choose Your Charity
            </CardTitle>
            <CardDescription>
              Select an existing charity or add your own organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Charity Selection */}
            <Tabs value={charityMode} onValueChange={(v) => setCharityMode(v as "existing" | "custom")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Choose Existing
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Your Own
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4 mt-4">
                <div className="grid gap-3">
                  {/* Always show Sybil's Kids as the recommended first option */}
                  <button
                    type="button"
                    onClick={() => setSelectedCharityId(SYBILS_KIDS.id)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-left w-full ${
                      selectedCharityId === SYBILS_KIDS.id
                        ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30 shadow-md"
                        : "border-status-warning/30 hover:border-status-warning/40 bg-status-warning/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground dark:text-white">{SYBILS_KIDS.name}</span>
                          <Badge variant="secondary" className="text-xs bg-status-warning/15 text-status-warning dark:bg-amber-900/50 dark:text-amber-300">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Recommended
                          </Badge>
                          <Badge variant="secondary" className="text-xs bg-status-success/15 text-status-success dark:bg-emerald-900/50 dark:text-emerald-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{SYBILS_KIDS.description}</p>
                      </div>
                      {selectedCharityId === SYBILS_KIDS.id && (
                        <CheckCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Show other existing charities from the database */}
                  {charities.map((charity) => (
                    <button
                      key={charity.id}
                      type="button"
                      onClick={() => setSelectedCharityId(charity.id)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all text-left w-full ${
                        selectedCharityId === charity.id
                          ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30 shadow-md"
                          : "border-border dark:border-border hover:border-rose-300 dark:hover:border-rose-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground dark:text-white">{charity.name}</span>
                            {charity.isVerified && (
                              <Badge variant="secondary" className="text-xs bg-status-success/15 text-status-success dark:bg-emerald-900/50 dark:text-emerald-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          {charity.description && (
                            <p className="text-sm text-muted-foreground mt-1">{charity.description}</p>
                          )}
                        </div>
                        {selectedCharityId === charity.id && (
                          <CheckCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <div className="p-5 rounded-xl border-2 border-dashed border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
                  <div className="flex items-start gap-3 mb-5">
                    <div className="p-2 rounded-full bg-rose-100 dark:bg-rose-900/50">
                      <Heart className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground dark:text-white">Create Your Charity</p>
                      <p className="text-sm text-muted-foreground">
                        Add any 501(c)(3) organization. You'll manage the donations.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleUseSybilsKids} className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Use Sybil's Kids
                    </Button>
                  </div>

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="charity-name">Charity Name *</Label>
                      <Input
                        id="charity-name"
                        placeholder="e.g., Local Veterans Foundation"
                        value={customCharity.name}
                        onChange={(e) => setCustomCharity({ ...customCharity, name: e.target.value })}
                        className="bg-card dark:bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="charity-description">Description</Label>
                      <Textarea
                        id="charity-description"
                        placeholder="Brief description of what the charity does..."
                        value={customCharity.description}
                        onChange={(e) => setCustomCharity({ ...customCharity, description: e.target.value })}
                        rows={2}
                        className="bg-card dark:bg-muted"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="charity-taxid">Tax ID (EIN)</Label>
                        <Input
                          id="charity-taxid"
                          placeholder="XX-XXXXXXX"
                          value={customCharity.taxId}
                          onChange={(e) => setCustomCharity({ ...customCharity, taxId: e.target.value })}
                          className="bg-card dark:bg-muted"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="charity-website">Website</Label>
                        <Input
                          id="charity-website"
                          placeholder="https://..."
                          value={customCharity.website}
                          onChange={(e) => setCustomCharity({ ...customCharity, website: e.target.value })}
                          className="bg-card dark:bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* Configuration Options */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuration</CardTitle>
            <CardDescription>Customize how round-up works for your guests</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="custom-message">Message to Guests</Label>
              <Textarea
                id="custom-message"
                placeholder="e.g., Help us support local veterans! Round up your total to donate."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                This message appears when guests see the round-up option at checkout.
              </p>
            </div>

            {/* Round-Up Type */}
            <div className="space-y-2">
              <Label>Round-Up Amount</Label>
              <Select value={roundUpType} onValueChange={setRoundUpType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nearest_dollar">Round to nearest $1.00</SelectItem>
                  <SelectItem value="nearest_5">Round to nearest $5.00</SelectItem>
                  <SelectItem value="fixed">Fixed $1.00 donation</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roundUpType === "nearest_dollar" && "Example: $47.25 → $48.00 (donates $0.75)"}
                {roundUpType === "nearest_5" && "Example: $47.25 → $50.00 (donates $2.75)"}
                {roundUpType === "fixed" && "Every guest can add exactly $1.00"}
              </p>
            </div>

            {/* Default Opt-In */}
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/60 dark:bg-muted/50">
              <div>
                <Label htmlFor="default-optin" className="font-medium">Pre-check the donation box</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Guest can still uncheck if they prefer not to donate
                </p>
              </div>
              <Switch
                id="default-optin"
                checked={defaultOptIn}
                onCheckedChange={setDefaultOptIn}
              />
            </div>

            {/* GL Code */}
            <div className="p-4 rounded-xl border bg-muted/60 dark:bg-muted/50">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                  <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor="gl-code" className="font-medium">GL Code for Accounting</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Donations are recorded under this code in your ledger for QuickBooks export
                    </p>
                  </div>
                  <Input
                    id="gl-code"
                    value={glCode}
                    onChange={(e) => setGlCode(e.target.value)}
                    placeholder="2400"
                    className="max-w-[200px] bg-card dark:bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: 2400 (Charity Donations Payable)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* How It Works */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-muted/60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-blue-500" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground dark:text-white">Guest Checks Out</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    During payment, they see the option to round up for {charityName}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground dark:text-white">Donation Recorded</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Amount is added to their total and logged under GL {glCode}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground dark:text-white">You Send the Funds</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Export from QuickBooks and write a check to the charity
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Actions */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="flex items-center justify-between pt-4 border-t"
      >
        {currentSettings?.isEnabled && (
          <Button
            variant="outline"
            onClick={() => disableMutation.mutate()}
            disabled={disableMutation.isPending}
            className="text-muted-foreground"
          >
            {disableMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Pause Round-Up
          </Button>
        )}
        <div className="flex-1" />
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-status-warning text-white shadow-lg shadow-status-warning/20 hover:bg-status-warning/90"
        >
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Settings
        </Button>
      </motion.div>
    </div>
  );
}
