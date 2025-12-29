"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Heart, DollarSign, Users, TrendingUp, Plus, Building2, ExternalLink, CheckCircle, Loader2 } from "lucide-react";

const DEFAULT_CHARITY = {
  name: "Sybil's Kids",
  description: "Supporting children in need through education and enrichment programs.",
  website: "https://sybilskids.com",
};

export default function CharitySettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  // Fetch available charities
  const { data: charities = [], isLoading: loadingCharities } = useQuery({
    queryKey: ["charities"],
    queryFn: () => apiClient.listCharities({ activeOnly: true }),
    enabled: !!campgroundId,
  });

  // Fetch current campground charity settings
  const { data: currentSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["campground-charity", campgroundId],
    queryFn: () => apiClient.getCampgroundCharity(campgroundId!),
    enabled: !!campgroundId,
  });

  // Fetch donation stats
  const { data: stats } = useQuery({
    queryKey: ["campground-charity-stats", campgroundId],
    queryFn: () => apiClient.getCampgroundCharityStats(campgroundId!),
    enabled: !!campgroundId,
  });

  // Load current settings into form
  useEffect(() => {
    if (currentSettings) {
      setIsEnabled(currentSettings.isEnabled);
      setSelectedCharityId(currentSettings.charityId);
      setCustomMessage(currentSettings.customMessage || "");
      setRoundUpType(currentSettings.roundUpType);
      setDefaultOptIn(currentSettings.defaultOptIn);
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
      };

      if (charityMode === "existing") {
        payload.charityId = selectedCharityId;
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
      toast({ title: "Charity settings saved", description: "Your round-up for charity settings have been updated." });
    },
    onError: (err) => {
      toast({ title: "Failed to save", description: String(err), variant: "destructive" });
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
      toast({ title: "Charity round-up disabled", description: "Guests will no longer see the round-up option." });
    },
  });

  // Use Sybil's Kids as default
  const handleUseDefault = () => {
    setCharityMode("custom");
    setCustomCharity({
      name: DEFAULT_CHARITY.name,
      description: DEFAULT_CHARITY.description,
      taxId: "",
      website: DEFAULT_CHARITY.website,
    });
  };

  if (!campgroundId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Please select a campground first.
      </div>
    );
  }

  if (loadingSettings || loadingCharities) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Heart className="h-6 w-6 text-rose-500" />
          Charity Round-Up
        </h1>
        <p className="text-muted-foreground mt-1">
          Let guests round up their payment to support a charity of your choice.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && stats.totalDonations > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-emerald-100">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${(stats.totalAmountCents / 100).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total Raised</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Heart className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalDonations}</p>
                  <p className="text-xs text-muted-foreground">Donations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.donorCount}</p>
                  <p className="text-xs text-muted-foreground">Unique Donors</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-amber-100">
                  <TrendingUp className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.optInRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Opt-in Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Round-Up Settings</CardTitle>
              <CardDescription>Configure how guests can donate to charity</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="enabled" className="text-sm">Enable Round-Up</Label>
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Charity Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Select Charity</Label>
            <Tabs value={charityMode} onValueChange={(v) => setCharityMode(v as "existing" | "custom")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Choose Existing</TabsTrigger>
                <TabsTrigger value="custom">Add Your Own</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4 mt-4">
                {charities.length > 0 ? (
                  <div className="grid gap-3">
                    {charities.map((charity) => (
                      <div
                        key={charity.id}
                        onClick={() => setSelectedCharityId(charity.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedCharityId === charity.id
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{charity.name}</span>
                              {charity.isVerified && (
                                <Badge variant="secondary" className="text-xs">
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
                            <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-lg border-dashed">
                    <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">No charities available yet.</p>
                    <Button variant="outline" onClick={handleUseDefault}>
                      <Plus className="h-4 w-4 mr-2" />
                      Use Sybil's Kids (Default)
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-4">
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-full bg-rose-100">
                      <Heart className="h-4 w-4 text-rose-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Add Your Own Charity</p>
                      <p className="text-xs text-muted-foreground">
                        Create a charity entry for your preferred organization. Donations will show in your ledger under GL code 2400.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleUseDefault}>
                      Use Default
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
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="charity-website">Website</Label>
                        <Input
                          id="charity-website"
                          placeholder="https://..."
                          value={customCharity.website}
                          onChange={(e) => setCustomCharity({ ...customCharity, website: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="custom-message">Custom Message (Optional)</Label>
            <Textarea
              id="custom-message"
              placeholder="e.g., Help us support local veterans! Round up your total to donate."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              This message is shown to guests when they have the option to round up.
            </p>
          </div>

          {/* Round-Up Type */}
          <div className="space-y-2">
            <Label>Round-Up Style</Label>
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
              {roundUpType === "nearest_dollar" && "Example: $47.25 rounds to $48.00 ($0.75 donation)"}
              {roundUpType === "nearest_5" && "Example: $47.25 rounds to $50.00 ($2.75 donation)"}
              {roundUpType === "fixed" && "Guest always donates $1.00 regardless of total"}
            </p>
          </div>

          {/* Default Opt-In */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <Label htmlFor="default-optin" className="font-medium">Default to Opted-In</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pre-check the donation box (guest can uncheck if they don't want to donate)
              </p>
            </div>
            <Switch
              id="default-optin"
              checked={defaultOptIn}
              onCheckedChange={setDefaultOptIn}
            />
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4 border-t">
            {currentSettings?.isEnabled && (
              <Button
                variant="outline"
                onClick={() => disableMutation.mutate()}
                disabled={disableMutation.isPending}
              >
                {disableMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Disable Round-Up
              </Button>
            )}
            <div className="flex-1" />
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (charityMode === "existing" && !selectedCharityId) || (charityMode === "custom" && !customCharity.name)}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">1</div>
              <div>
                <p className="font-medium text-sm">Guest Checks Out</p>
                <p className="text-xs text-muted-foreground">During booking or payment, guest sees the round-up option</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">2</div>
              <div>
                <p className="font-medium text-sm">Donation Collected</p>
                <p className="text-xs text-muted-foreground">Round-up amount is added to their total and tracked in your ledger</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">3</div>
              <div>
                <p className="font-medium text-sm">You Write the Check</p>
                <p className="text-xs text-muted-foreground">Export from QuickBooks (GL 2400) and send to charity</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
