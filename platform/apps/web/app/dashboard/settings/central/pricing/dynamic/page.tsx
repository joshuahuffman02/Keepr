"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, Info, Percent, Calendar, Users, Loader2, Save, ExternalLink } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";

type PricingRuleV2 = {
  id: string;
  campgroundId: string;
  name: string;
  type: "season" | "weekend" | "holiday" | "event" | "demand";
  priority: number;
  stackMode: "additive" | "max" | "override";
  adjustmentType: "percent" | "flat";
  adjustmentValue: number;
  siteClassId: string | null;
  dowMask: number[] | null;
  startDate: string | null;
  endDate: string | null;
  minRateCap: number | null;
  maxRateCap: number | null;
  active: boolean;
};

// Preset rule names we manage from this page
const MANAGED_RULES = {
  OCCUPANCY_MEDIUM: "Occupancy 50-75%",
  OCCUPANCY_HIGH: "Occupancy 75-100%",
  EARLY_BIRD: "Early Bird Discount",
  LAST_MINUTE: "Last Minute Premium",
  WEEKLY_DISCOUNT: "Weekly Stay Discount",
  MONTHLY_DISCOUNT: "Monthly Stay Discount",
};

export default function DynamicPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [rules, setRules] = useState<PricingRuleV2[]>([]);

  // Dynamic pricing enabled state
  const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(false);

  // Occupancy-based adjustments (stored as whole percentages for display)
  const [occupancyMedium, setOccupancyMedium] = useState(10);
  const [occupancyHigh, setOccupancyHigh] = useState(20);

  // Lead time adjustments
  const [earlyBirdDiscount, setEarlyBirdDiscount] = useState(10);
  const [lastMinutePremium, setLastMinutePremium] = useState(0);

  // Length of stay incentives
  const [weeklyDiscount, setWeeklyDiscount] = useState(10);
  const [monthlyDiscount, setMonthlyDiscount] = useState(25);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    // Fetch existing pricing rules
    apiClient.getPricingRulesV2(id)
      .then((data: PricingRuleV2[]) => {
        setRules(data || []);

        // Find our managed rules and populate the form
        const findRule = (name: string) => data?.find((r: PricingRuleV2) => r.name === name);

        const occMediumRule = findRule(MANAGED_RULES.OCCUPANCY_MEDIUM);
        const occHighRule = findRule(MANAGED_RULES.OCCUPANCY_HIGH);
        const earlyBirdRule = findRule(MANAGED_RULES.EARLY_BIRD);
        const lastMinuteRule = findRule(MANAGED_RULES.LAST_MINUTE);
        const weeklyRule = findRule(MANAGED_RULES.WEEKLY_DISCOUNT);
        const monthlyRule = findRule(MANAGED_RULES.MONTHLY_DISCOUNT);

        // Check if dynamic pricing is enabled (any of our managed rules is active)
        const managedRuleNames = Object.values(MANAGED_RULES);
        const hasActiveManagedRules = data?.some((r: PricingRuleV2) =>
          managedRuleNames.includes(r.name) && r.active
        );
        setDynamicPricingEnabled(hasActiveManagedRules || false);

        // Populate form values from existing rules (convert from decimal to percentage)
        if (occMediumRule) setOccupancyMedium(Math.round(occMediumRule.adjustmentValue * 100));
        if (occHighRule) setOccupancyHigh(Math.round(occHighRule.adjustmentValue * 100));
        if (earlyBirdRule) setEarlyBirdDiscount(Math.abs(Math.round(earlyBirdRule.adjustmentValue * 100)));
        if (lastMinuteRule) setLastMinutePremium(Math.round(lastMinuteRule.adjustmentValue * 100));
        if (weeklyRule) setWeeklyDiscount(Math.abs(Math.round(weeklyRule.adjustmentValue * 100)));
        if (monthlyRule) setMonthlyDiscount(Math.abs(Math.round(monthlyRule.adjustmentValue * 100)));

        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load pricing rules:", err);
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    if (!campgroundId) return;

    setSaving(true);

    try {
      // Helper to find existing rule
      const findExistingRule = (name: string) => rules.find(r => r.name === name);

      // Helper to create or update a rule
      const upsertRule = async (
        name: string,
        adjustmentValue: number, // as decimal (e.g., 0.10 for 10%)
        type: "season" | "weekend" | "holiday" | "event" | "demand" = "event",
        priority: number = 50
      ) => {
        const existing = findExistingRule(name);
        const payload = {
          name,
          type,
          priority,
          stackMode: "additive" as const,
          adjustmentType: "percent" as const,
          adjustmentValue,
          siteClassId: undefined,
          dowMask: undefined,
          startDate: undefined,
          endDate: undefined,
          minRateCap: undefined,
          maxRateCap: undefined,
          active: dynamicPricingEnabled,
        };

        if (existing) {
          await apiClient.updatePricingRuleV2(existing.id, payload, campgroundId);
        } else if (adjustmentValue !== 0) {
          await apiClient.createPricingRuleV2(campgroundId, payload);
        }
      };

      // Save all our managed rules
      // Occupancy rules (positive = price increase) - use "event" type for dynamic adjustments
      await upsertRule(MANAGED_RULES.OCCUPANCY_MEDIUM, occupancyMedium / 100, "event", 40);
      await upsertRule(MANAGED_RULES.OCCUPANCY_HIGH, occupancyHigh / 100, "event", 41);

      // Lead time rules (early bird is negative = discount, last minute is positive = premium)
      await upsertRule(MANAGED_RULES.EARLY_BIRD, -earlyBirdDiscount / 100, "event", 50);
      await upsertRule(MANAGED_RULES.LAST_MINUTE, lastMinutePremium / 100, "event", 51);

      // Length of stay rules (negative = discount)
      await upsertRule(MANAGED_RULES.WEEKLY_DISCOUNT, -weeklyDiscount / 100, "season", 60);
      await upsertRule(MANAGED_RULES.MONTHLY_DISCOUNT, -monthlyDiscount / 100, "season", 61);

      // Reload rules
      const updatedRules = await apiClient.getPricingRulesV2(campgroundId);
      setRules(updatedRules || []);

    } catch (err) {
      console.error("Failed to save pricing rules:", err);
      alert("Failed to save pricing rules. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dynamic Pricing</h2>
          <p className="text-muted-foreground mt-1">
            Automatically adjust rates based on demand and occupancy
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dynamic Pricing</h2>
          <p className="text-muted-foreground mt-1">
            Automatically adjust rates based on demand and occupancy
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dynamic Pricing</h2>
          <p className="text-muted-foreground mt-1">
            Automatically adjust rates based on demand and occupancy
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/settings/pricing-rules">
            Advanced Rules
            <ExternalLink className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      <Alert className="bg-purple-50 border-purple-200">
        <TrendingUp className="h-4 w-4 text-purple-500" />
        <AlertDescription className="text-purple-800">
          Dynamic pricing analyzes booking patterns to optimize your rates in real-time,
          maximizing revenue during high-demand periods. These settings sync with your
          Advanced Pricing Rules.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Enable Dynamic Pricing</CardTitle>
              <CardDescription>
                Automatically adjust rates based on occupancy levels
              </CardDescription>
            </div>
            <Switch
              checked={dynamicPricingEnabled}
              onCheckedChange={setDynamicPricingEnabled}
            />
          </div>
        </CardHeader>
      </Card>

      <Card className={!dynamicPricingEnabled ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-5 w-5 text-muted-foreground" />
            Occupancy-Based Adjustments
          </CardTitle>
          <CardDescription>
            Increase rates as occupancy rises for a given date
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground mb-1">0-50% Occupied</p>
              <p className="text-lg font-semibold text-foreground">Base Rate</p>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground mb-1">50-75% Occupied</p>
              <div className="flex items-center justify-center gap-1">
                <Input
                  type="number"
                  value={occupancyMedium}
                  onChange={(e) => setOccupancyMedium(Number(e.target.value))}
                  disabled={!dynamicPricingEnabled}
                  className="w-16 text-center"
                />
                <span className="text-lg font-semibold text-emerald-600">%</span>
              </div>
            </div>
            <div className="p-4 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground mb-1">75-100% Occupied</p>
              <div className="flex items-center justify-center gap-1">
                <Input
                  type="number"
                  value={occupancyHigh}
                  onChange={(e) => setOccupancyHigh(Number(e.target.value))}
                  disabled={!dynamicPricingEnabled}
                  className="w-16 text-center"
                />
                <span className="text-lg font-semibold text-emerald-600">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={!dynamicPricingEnabled ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            Lead Time Adjustments
          </CardTitle>
          <CardDescription>
            Adjust rates based on how far in advance guests book
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Early Bird Discount</Label>
              <p className="text-sm text-muted-foreground">
                Bookings made 60+ days in advance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={earlyBirdDiscount}
                onChange={(e) => setEarlyBirdDiscount(Number(e.target.value))}
                disabled={!dynamicPricingEnabled}
                className="w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">% off</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Last Minute Premium</Label>
              <p className="text-sm text-muted-foreground">
                Bookings made within 3 days of arrival
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={lastMinutePremium}
                onChange={(e) => setLastMinutePremium(Number(e.target.value))}
                disabled={!dynamicPricingEnabled}
                className="w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">% increase</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={!dynamicPricingEnabled ? "opacity-50" : ""}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Length of Stay Incentives
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Weekly Discount</Label>
              <p className="text-sm text-muted-foreground">7+ night stays</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={weeklyDiscount}
                onChange={(e) => setWeeklyDiscount(Number(e.target.value))}
                disabled={!dynamicPricingEnabled}
                className="w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">% off</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <Label className="font-medium">Monthly Discount</Label>
              <p className="text-sm text-muted-foreground">28+ night stays</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={monthlyDiscount}
                onChange={(e) => setMonthlyDiscount(Number(e.target.value))}
                disabled={!dynamicPricingEnabled}
                className="w-16 text-center"
              />
              <span className="text-sm text-muted-foreground">% off</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Pricing Rules
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
