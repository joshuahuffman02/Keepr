"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiClient } from "@/lib/api-client";
import { Plus, Pencil, Trash2, TrendingUp, Info, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

type PricingRuleV2 = {
  id: string;
  name: string;
  type: "season" | "weekend" | "holiday" | "event" | "demand";
  priority: number;
  stackMode: "additive" | "max" | "override";
  adjustmentType: "percent" | "flat";
  adjustmentValue: number;
  active: boolean;
};

const typeLabels: Record<string, string> = {
  season: "Seasonal",
  weekend: "Weekend",
  holiday: "Holiday",
  event: "Event",
  demand: "Demand-Based",
};

export default function DynamicPricingPage({ params }: { params: { campgroundId: string } }) {
  const router = useRouter();
  const [rules, setRules] = useState<PricingRuleV2[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Store the campground ID for the pricing rules page
    localStorage.setItem("campreserv:selectedCampground", params.campgroundId);

    // Fetch pricing rules using the new V2 API
    apiClient.getPricingRulesV2(params.campgroundId)
      .then((data: PricingRuleV2[]) => {
        setRules(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load pricing rules:", err);
        setLoading(false);
      });
  }, [params.campgroundId]);

  const formatAdjustment = (rule: PricingRuleV2) => {
    if (rule.adjustmentType === "percent") {
      const pct = rule.adjustmentValue * 100;
      return pct >= 0 ? `+${pct.toFixed(0)}%` : `${pct.toFixed(0)}%`;
    }
    const flat = rule.adjustmentValue / 100;
    return flat >= 0 ? `+$${flat.toFixed(2)}` : `-$${Math.abs(flat).toFixed(2)}`;
  };

  const demandRules = rules.filter(r => r.type === "demand" && r.active);
  const otherRules = rules.filter(r => r.type !== "demand" || !r.active);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: "Settings", href: `/campgrounds/${params.campgroundId}` },
            { label: "Dynamic Pricing" }
          ]}
        />

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Dynamic Pricing</h1>
            <p className="text-slate-500">
              Configure occupancy and demand-based pricing adjustments
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/central/pricing/dynamic">
                <TrendingUp className="h-4 w-4 mr-2" />
                Quick Settings
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/settings/pricing-rules">
                <ExternalLink className="h-4 w-4 mr-2" />
                Advanced Rules
              </Link>
            </Button>
          </div>
        </div>

        <Alert className="bg-purple-50 border-purple-200">
          <Info className="h-4 w-4 text-purple-500" />
          <AlertDescription className="text-purple-800">
            Dynamic pricing rules automatically adjust your rates based on occupancy,
            demand, and booking patterns. Use the Quick Settings for common adjustments
            or Advanced Rules for full control.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Active Demand Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Demand-Based Rules</CardTitle>
                <CardDescription>
                  These rules automatically adjust prices based on occupancy and booking lead time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {demandRules.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No active demand-based rules</p>
                    <p className="text-sm mt-1">
                      Enable dynamic pricing in Quick Settings to get started
                    </p>
                    <Button className="mt-4" asChild>
                      <Link href="/dashboard/settings/central/pricing/dynamic">
                        Enable Dynamic Pricing
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {demandRules.sort((a, b) => a.priority - b.priority).map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-white"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{rule.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              Priority {rule.priority}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500 mt-1">
                            {typeLabels[rule.type] || rule.type} • {rule.stackMode}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-lg font-bold ${
                            rule.adjustmentValue >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {formatAdjustment(rule)}
                          </span>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/settings/pricing-rules">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Other Rules Summary */}
            {otherRules.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Other Pricing Rules</CardTitle>
                  <CardDescription>
                    Seasonal, weekend, holiday, and event-based pricing rules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {otherRules.slice(0, 5).map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          rule.active ? "bg-white" : "bg-slate-50 opacity-60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${rule.active ? "text-slate-900" : "text-slate-500"}`}>
                            {rule.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {typeLabels[rule.type] || rule.type}
                          </span>
                          {!rule.active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                              Inactive
                            </span>
                          )}
                        </div>
                        <span className={`font-semibold ${
                          rule.adjustmentValue >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {formatAdjustment(rule)}
                        </span>
                      </div>
                    ))}
                    {otherRules.length > 5 && (
                      <div className="text-center pt-2">
                        <Button variant="link" asChild>
                          <Link href="/dashboard/settings/pricing-rules">
                            View all {otherRules.length} rules →
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
