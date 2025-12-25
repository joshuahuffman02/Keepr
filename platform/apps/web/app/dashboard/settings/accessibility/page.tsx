"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  ADA_CHECKLIST,
  ADA_CATEGORIES,
  CERTIFICATION_THRESHOLDS,
  calculateCertificationLevel,
  getRequiredAccessibleUnits,
  getAdaBadgeInfo,
  type AdaAssessmentData,
  type AdaCategory,
} from "@/lib/ada-accessibility";
import {
  Accessibility,
  CheckCircle2,
  AlertCircle,
  Info,
  Save,
  ExternalLink,
  Shield,
  Award,
  Lightbulb,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AccessibilitySettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  // Load campground ID from localStorage
  useEffect(() => {
    const cg = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    setCampgroundId(cg);
  }, []);

  // Fetch campground data
  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId!),
    enabled: !!campgroundId
  });

  // Fetch sites to calculate actual accessible site counts
  const sitesQuery = useQuery({
    queryKey: ["sites", campgroundId],
    queryFn: () => apiClient.getSites(campgroundId!),
    enabled: !!campgroundId
  });

  // Calculate site counts from actual site data
  const sites = sitesQuery.data ?? [];
  const totalSiteCount = sites.length;
  const accessibleSiteCount = sites.filter((site: any) => site.accessible === true).length;
  const accessibleSiteNames = sites
    .filter((site: any) => site.accessible === true)
    .map((site: any) => site.name || site.siteNumber)
    .slice(0, 10); // Show first 10

  // Initialize form from campground data
  useEffect(() => {
    const cg = campgroundQuery.data;
    if (!cg) return;

    // Parse ADA assessment data if it exists
    const adaData = (cg as any).adaAssessment as AdaAssessmentData | null;
    if (adaData) {
      setCompletedItems(new Set(adaData.completedItems || []));
      setNotes(adaData.notes || "");
    }
  }, [campgroundQuery.data]);

  // Calculate current assessment data
  const assessmentData: AdaAssessmentData = {
    completedItems: Array.from(completedItems),
    accessibleSiteCount,
    totalSiteCount,
    notes,
    lastUpdated: new Date().toISOString(),
  };

  const certificationLevel = calculateCertificationLevel(assessmentData);
  const badgeInfo = getAdaBadgeInfo(certificationLevel);
  const requiredUnits = getRequiredAccessibleUnits(totalSiteCount);
  const meetsScoping = accessibleSiteCount >= requiredUnits;

  // Calculate progress
  const totalPoints = ADA_CHECKLIST
    .filter(item => completedItems.has(item.id))
    .reduce((sum, item) => sum + item.points, 0);
  const maxPoints = ADA_CHECKLIST.reduce((sum, item) => sum + item.points, 0);
  const requiredItems = ADA_CHECKLIST.filter(item => item.required);
  const completedRequired = requiredItems.filter(item => completedItems.has(item.id));

  // Toggle item completion
  const toggleItem = (itemId: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateCampgroundProfile(campgroundId!, {
        adaAssessment: assessmentData,
        adaCertificationLevel: certificationLevel,
        adaAccessibleSiteCount: accessibleSiteCount,
        adaTotalSiteCount: totalSiteCount,
        adaAssessmentUpdatedAt: new Date().toISOString(),
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campground", campgroundId] });
      toast({
        title: "Assessment saved",
        description: certificationLevel !== "none"
          ? `Congratulations! Your campground qualifies for ${badgeInfo?.label}`
          : "Your assessment has been saved. Complete more items to earn a certification badge.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to save",
        description: "There was an error saving your assessment. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Group checklist items by category
  const itemsByCategory = ADA_CHECKLIST.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<AdaCategory, typeof ADA_CHECKLIST>);

  if (!campgroundId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Select a campground to configure accessibility settings.</p>
      </div>
    );
  }

  if (campgroundQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Accessibility className="w-7 h-7 text-blue-600" />
              ADA Accessibility Certification
            </h1>
            <p className="text-slate-500 mt-1">
              Complete the checklist to earn an accessibility badge for your campground
            </p>
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Assessment"}
          </Button>
        </div>

        {/* Current Status Card */}
        <Card className="border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-slate-600" />
              Current Certification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Certification Badge */}
              <div className="flex flex-col items-center text-center p-4 rounded-xl bg-white border border-slate-200">
                {badgeInfo ? (
                  <>
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center mb-3",
                      `bg-gradient-to-br ${badgeInfo.gradient}`
                    )}>
                      <Accessibility className="w-8 h-8 text-white" />
                    </div>
                    <Badge className={cn(
                      "text-white mb-2",
                      `bg-gradient-to-r ${badgeInfo.gradient}`
                    )}>
                      {badgeInfo.label}
                    </Badge>
                    <p className="text-xs text-slate-500">{badgeInfo.description}</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bg-slate-100">
                      <Accessibility className="w-8 h-8 text-slate-400" />
                    </div>
                    <Badge variant="secondary" className="mb-2">Not Certified</Badge>
                    <p className="text-xs text-slate-500">Complete more items to earn a badge</p>
                  </>
                )}
              </div>

              {/* Progress Stats */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Points Progress</span>
                    <span className="font-medium">{totalPoints} / {maxPoints}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(totalPoints / maxPoints) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Required Items</span>
                    <span className="font-medium">{completedRequired.length} / {requiredItems.length}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedRequired.length / requiredItems.length) * 100}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    />
                  </div>
                </div>
              </div>

              {/* Scoping Requirement */}
              <div className="p-4 rounded-xl bg-white border border-slate-200">
                <h4 className="font-medium text-slate-900 mb-2">Accessible Units</h4>
                <div className="flex items-center gap-2 mb-2">
                  {meetsScoping ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={meetsScoping ? "text-emerald-700" : "text-amber-700"}>
                    {accessibleSiteCount} of {requiredUnits} required
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Based on {totalSiteCount} total sites
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Inventory - Dynamic from actual site data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Site Inventory</span>
              {campgroundId && (
                <a
                  href={`/campgrounds/${campgroundId}/sites`}
                  className="text-sm font-normal text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  Manage Sites
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </CardTitle>
            <CardDescription>
              Site accessibility data is pulled automatically from your site inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sitesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500" />
                Loading site data...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-3xl font-bold text-slate-900">{totalSiteCount}</div>
                    <div className="text-sm text-slate-600">Total Sites</div>
                    <p className="text-xs text-slate-500 mt-2">
                      ADA scoping requires at least <span className="font-semibold">{requiredUnits}</span> accessible units
                    </p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-xl border",
                    meetsScoping
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                  )}>
                    <div className={cn(
                      "text-3xl font-bold",
                      meetsScoping ? "text-emerald-700" : "text-amber-700"
                    )}>
                      {accessibleSiteCount}
                    </div>
                    <div className={cn(
                      "text-sm",
                      meetsScoping ? "text-emerald-600" : "text-amber-600"
                    )}>
                      Accessible Sites
                    </div>
                    {!meetsScoping && totalSiteCount > 0 && (
                      <p className="text-xs text-amber-700 mt-2 font-medium">
                        Need {requiredUnits - accessibleSiteCount} more accessible units to meet ADA requirements
                      </p>
                    )}
                    {meetsScoping && (
                      <p className="text-xs text-emerald-700 mt-2">
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />
                        Meets ADA scoping requirements
                      </p>
                    )}
                  </div>
                </div>

                {/* Show accessible site names */}
                {accessibleSiteNames.length > 0 && (
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="text-sm font-medium text-blue-900 mb-2 flex items-center gap-2">
                      <Accessibility className="w-4 h-4" />
                      Accessible Sites
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {accessibleSiteNames.map((name: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">
                          {name}
                        </span>
                      ))}
                      {sites.filter((s: any) => s.accessible).length > 10 && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
                          +{sites.filter((s: any) => s.accessible).length - 10} more
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-700 mt-2">
                      To mark a site as accessible, edit the site and enable the "Accessible" toggle.
                    </p>
                  </div>
                )}

                {accessibleSiteCount === 0 && totalSiteCount > 0 && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-amber-900">No accessible sites configured</div>
                        <p className="text-xs text-amber-700 mt-1">
                          Go to your <a href={`/campgrounds/${campgroundId}/sites`} className="underline hover:no-underline">site management</a> and
                          enable the "Accessible" toggle on sites that meet accessibility standards.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guidance Card - What to do to become ADA compliant */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-blue-600" />
              How to Achieve ADA Compliance
            </CardTitle>
            <CardDescription>
              Follow these steps to improve your accessibility certification level
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {certificationLevel === "none" && (
              <div className="p-4 rounded-lg bg-white border border-blue-100">
                <h4 className="font-semibold text-slate-900 mb-2">Getting Started</h4>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                    <span><strong>Mark accessible sites:</strong> Go to site management and enable "Accessible" on sites with level/paved access, appropriate dimensions, and accessible amenities.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                    <span><strong>Meet scoping requirements:</strong> For {totalSiteCount} sites, you need at least {requiredUnits} accessible units per ADA guidelines.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                    <span><strong>Complete the checklist:</strong> Work through the accessibility checklist below, starting with required items marked with a "Required" badge.</span>
                  </li>
                </ul>
              </div>
            )}

            {certificationLevel === "friendly" && (
              <div className="p-4 rounded-lg bg-white border border-emerald-100">
                <h4 className="font-semibold text-emerald-800 mb-2">Great progress! To reach ADA Compliant:</h4>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Complete all <strong>required</strong> checklist items (look for "Required" badges)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Ensure restrooms have accessible stalls with grab bars and turning space</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Verify parking has van-accessible spaces with proper signage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                    <span>Check that routes to amenities are firm, stable, and at least 36" wide</span>
                  </li>
                </ul>
              </div>
            )}

            {certificationLevel === "compliant" && (
              <div className="p-4 rounded-lg bg-white border border-amber-100">
                <h4 className="font-semibold text-amber-800 mb-2">Almost there! To reach ADA Excellence:</h4>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <Award className="w-4 h-4 text-amber-500 mt-0.5" />
                    <span>Add accessible picnic tables at each accessible site</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Award className="w-4 h-4 text-amber-500 mt-0.5" />
                    <span>Install visual or tactile alerts for notifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Award className="w-4 h-4 text-amber-500 mt-0.5" />
                    <span>Provide accessible fishing or viewing platforms if applicable</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Award className="w-4 h-4 text-amber-500 mt-0.5" />
                    <span>Consider roll-in showers and service animal relief areas</span>
                  </li>
                </ul>
              </div>
            )}

            {certificationLevel === "excellence" && (
              <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Congratulations! You've achieved ADA Excellence!
                </h4>
                <p className="text-sm text-amber-700">
                  Your campground provides exceptional accessibility features. Display your badge proudly on your
                  booking page and marketing materials. Consider sharing your accessibility features in your
                  property description to attract guests who need accessible accommodations.
                </p>
              </div>
            )}

            {/* Quick wins section */}
            {certificationLevel !== "excellence" && (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">Quick Wins (Highest Point Items)</h4>
                <div className="space-y-2">
                  {ADA_CHECKLIST
                    .filter(item => !completedItems.has(item.id))
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 3)
                    .map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100">
                        <span className="text-sm text-slate-700">{item.label}</span>
                        <Badge variant="secondary" className="ml-2">{item.points} pts</Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Certification Tiers Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Certification Tiers
            </CardTitle>
            <CardDescription>
              Complete the checklist items to achieve higher certification levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {(["friendly", "compliant", "excellence"] as const).map((level) => {
                const info = getAdaBadgeInfo(level);
                const threshold = CERTIFICATION_THRESHOLDS[level];
                const isAchieved = certificationLevel === level ||
                  (level === "friendly" && certificationLevel !== "none") ||
                  (level === "compliant" && certificationLevel === "excellence");

                return (
                  <div
                    key={level}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all",
                      isAchieved
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isAchieved
                          ? `bg-gradient-to-br ${info?.gradient}`
                          : "bg-slate-100"
                      )}>
                        <Accessibility className={cn(
                          "w-4 h-4",
                          isAchieved ? "text-white" : "text-slate-400"
                        )} />
                      </div>
                      <span className="font-semibold text-slate-900">{info?.label}</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1">
                      <li>&bull; {threshold.minPoints}+ points</li>
                      <li>&bull; {Math.round(threshold.requiredItemsRatio * 100)}% required items</li>
                      <li>&bull; Meet scoping requirements</li>
                    </ul>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Checklist Categories */}
        {Object.entries(itemsByCategory).map(([category, items]) => {
          const catInfo = ADA_CATEGORIES[category as AdaCategory];
          const completedCount = items.filter(item => completedItems.has(item.id)).length;

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{catInfo.label}</span>
                  <Badge variant="secondary">
                    {completedCount} / {items.length}
                  </Badge>
                </CardTitle>
                <CardDescription>{catInfo.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => {
                    const isChecked = completedItems.has(item.id);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                          isChecked
                            ? "border-emerald-200 bg-emerald-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                        onClick={() => toggleItem(item.id)}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-medium",
                              isChecked ? "text-emerald-800" : "text-slate-900"
                            )}>
                              {item.label}
                            </span>
                            {item.required && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {item.points} pts
                            </Badge>
                          </div>
                          <p className={cn(
                            "text-sm mt-1",
                            isChecked ? "text-emerald-600" : "text-slate-500"
                          )}>
                            {item.description}
                          </p>
                        </div>
                        {isChecked && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              ADA Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <a
                href="https://www.access-board.gov/ada/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-slate-900">U.S. Access Board</p>
                  <p className="text-sm text-slate-500">Official ADA guidelines</p>
                </div>
              </a>
              <a
                href="https://www.fs.usda.gov/recreation/programs/accessibility/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-slate-900">USDA Forest Service</p>
                  <p className="text-sm text-slate-500">Outdoor recreation accessibility</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Button */}
        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving Assessment..." : "Save Assessment"}
          </Button>
        </div>
      </div>
  );
}
