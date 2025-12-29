"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  type AdaCertificationLevel,
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
  ChevronDown,
  Sparkles,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/use-window-size";
import Link from "next/link";

export default function AccessibilitySettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();
  const { width, height } = useWindowSize();

  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [initialCompletedItems, setInitialCompletedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [previousLevel, setPreviousLevel] = useState<string | null>(null);
  const [isGuideExpanded, setIsGuideExpanded] = useState(false);
  const [showTierUnlock, setShowTierUnlock] = useState<string | null>(null);

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
  const accessibleSiteCount = sites.filter((site: { accessible?: boolean }) => site.accessible === true).length;
  const accessibleSiteNames = sites
    .filter((site: { accessible?: boolean }) => site.accessible === true)
    .map((site: { name?: string; siteNumber?: string }) => site.name || site.siteNumber)
    .slice(0, 10);

  // Initialize form from campground data
  useEffect(() => {
    const cg = campgroundQuery.data as {
      adaAssessment?: AdaAssessmentData | null;
      adaCertificationLevel?: string | null;
    } | undefined;
    if (!cg) return;

    const adaData = cg.adaAssessment;
    if (adaData) {
      const items = new Set(adaData.completedItems || []);
      setCompletedItems(items);
      setInitialCompletedItems(items);
      setNotes(adaData.notes || "");
    }

    // Set previous level for comparison
    const savedLevel = cg.adaCertificationLevel || "none";
    setPreviousLevel(savedLevel);

    // Expand guide for new users
    if (savedLevel === "none" && accessibleSiteCount === 0) {
      setIsGuideExpanded(true);
    }
  }, [campgroundQuery.data, accessibleSiteCount]);

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

  // Track unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (initialCompletedItems.size !== completedItems.size) return true;
    for (const item of completedItems) {
      if (!initialCompletedItems.has(item)) return true;
    }
    return false;
  }, [completedItems, initialCompletedItems]);

  // Calculate next tier info
  const nextTierInfo = useMemo(() => {
    if (certificationLevel === "excellence") return null;
    const nextTier = certificationLevel === "none" ? "friendly"
      : certificationLevel === "friendly" ? "compliant"
      : "excellence";
    const threshold = CERTIFICATION_THRESHOLDS[nextTier];
    const pointsNeeded = threshold.minPoints - totalPoints;
    return { tier: nextTier, pointsNeeded, isClose: pointsNeeded > 0 && pointsNeeded <= 15 };
  }, [certificationLevel, totalPoints]);

  // Toggle item completion
  const toggleItem = (itemId: string) => {
    // Don't toggle auto-calculated items
    if (itemId === "sites_meet_scoping") return;

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

  // Save mutation with celebration
  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateAccessibilitySettings(campgroundId!, {
        adaAssessment: assessmentData,
        adaCertificationLevel: certificationLevel,
        adaAccessibleSiteCount: accessibleSiteCount,
        adaTotalSiteCount: totalSiteCount,
        adaAssessmentUpdatedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      const oldLevel = previousLevel || "none";
      const newLevel = certificationLevel;

      // Check if tier upgraded
      const tierOrder = ["none", "friendly", "compliant", "excellence"];
      const oldIndex = tierOrder.indexOf(oldLevel);
      const newIndex = tierOrder.indexOf(newLevel);
      const didLevelUp = newIndex > oldIndex;

      queryClient.invalidateQueries({ queryKey: ["campground", campgroundId] });
      setInitialCompletedItems(new Set(completedItems));
      setPreviousLevel(newLevel);

      if (didLevelUp && !prefersReducedMotion) {
        setShowConfetti(true);
        setShowTierUnlock(newLevel);
        setTimeout(() => setShowConfetti(false), 5000);

        toast({
          title: "Certification Unlocked!",
          description: `You've achieved ${badgeInfo?.label}! Your badge now appears on your booking page.`,
        });
      } else {
        toast({
          title: "Assessment saved",
          description: certificationLevel !== "none"
            ? `Your ${badgeInfo?.label} certification has been updated.`
            : "Your progress has been saved. Keep going!",
        });
      }
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
        <p className="text-slate-500 dark:text-slate-400">Select a campground to configure accessibility settings.</p>
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
    <>
      {/* Confetti celebration */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          colors={
            certificationLevel === "excellence"
              ? ["#f59e0b", "#fbbf24", "#fcd34d", "#fef3c7"]
              : certificationLevel === "compliant"
              ? ["#3b82f6", "#60a5fa", "#93c5fd", "#dbeafe"]
              : ["#10b981", "#34d399", "#6ee7b7", "#d1fae5"]
          }
        />
      )}

      {/* Tier unlock modal */}
      <AnimatePresence>
        {showTierUnlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTierUnlock(null)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                className={cn(
                  "w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center",
                  `bg-gradient-to-br ${badgeInfo?.gradient}`
                )}
              >
                <Accessibility className="w-12 h-12 text-white" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-slate-900 dark:text-white mb-2"
              >
                Certification Unlocked!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={cn(
                  "text-lg font-semibold mb-4 bg-gradient-to-r bg-clip-text text-transparent",
                  badgeInfo?.gradient
                )}
              >
                {badgeInfo?.label}
              </motion.p>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-slate-600 dark:text-slate-400 mb-6"
              >
                {badgeInfo?.description}
              </motion.p>

              <Button onClick={() => setShowTierUnlock(null)} className="w-full">
                Continue
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Accessibility className="w-7 h-7 text-blue-600" />
              ADA Accessibility Certification
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Build a more welcoming campground - every small improvement makes a difference
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasUnsavedChanges && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                Unsaved changes
              </Badge>
            )}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className={cn(
                "transition-all duration-200",
                "motion-safe:hover:scale-105 motion-safe:active:scale-95"
              )}
            >
              {saveMutation.isPending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <Save className="w-4 h-4 mr-2" />
                </motion.div>
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saveMutation.isPending ? "Saving..." : "Save Assessment"}
            </Button>
          </div>
        </div>

        {/* Almost there momentum indicator */}
        {nextTierInfo?.isClose && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border border-amber-200 dark:border-amber-800"
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={prefersReducedMotion ? {} : { scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </motion.div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                You&apos;re only {nextTierInfo.pointsNeeded} points away from {getAdaBadgeInfo(nextTierInfo.tier as AdaCertificationLevel)?.label}!
              </p>
            </div>
          </motion.div>
        )}

        {/* Current Status Card */}
        <Card className="border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Shield className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              Current Certification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Certification Badge */}
              <div className="flex flex-col items-center text-center p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {badgeInfo ? (
                  <>
                    <motion.div
                      className={cn(
                        "w-16 h-16 rounded-full flex items-center justify-center mb-3",
                        `bg-gradient-to-br ${badgeInfo.gradient}`
                      )}
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1, rotate: 5 }}
                    >
                      <Accessibility className="w-8 h-8 text-white" />
                    </motion.div>
                    <Badge className={cn(
                      "text-white mb-2",
                      `bg-gradient-to-r ${badgeInfo.gradient}`
                    )}>
                      {badgeInfo.label}
                    </Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{badgeInfo.description}</p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bg-slate-100 dark:bg-slate-700">
                      <Accessibility className="w-8 h-8 text-slate-400" />
                    </div>
                    <Badge variant="secondary" className="mb-2">Not Certified</Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Start your accessibility journey!</p>
                  </>
                )}
              </div>

              {/* Progress Stats */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Your Progress</span>
                    <span className="font-medium text-slate-900 dark:text-white">{totalPoints} / {maxPoints}</span>
                  </div>
                  <div
                    className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={totalPoints}
                    aria-valuemax={maxPoints}
                    aria-label="Points progress"
                  >
                    <motion.div
                      className={cn(
                        "h-full bg-gradient-to-r from-emerald-500 to-teal-500 relative",
                        (totalPoints / maxPoints) > 0.9 && "motion-safe:animate-pulse"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${(totalPoints / maxPoints) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Required Items</span>
                    <span className="font-medium text-slate-900 dark:text-white">{completedRequired.length} / {requiredItems.length}</span>
                  </div>
                  <div
                    className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={completedRequired.length}
                    aria-valuemax={requiredItems.length}
                    aria-label="Required items progress"
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(completedRequired.length / requiredItems.length) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              {/* Scoping Requirement */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Accessible Units</h4>
                <div className="flex items-center gap-2 mb-2">
                  {meetsScoping ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={meetsScoping ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                    {accessibleSiteCount} of {requiredUnits} required
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Based on {totalSiteCount} total sites
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Inventory */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white">
              <span>Site Inventory</span>
              {campgroundId && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/campgrounds/${campgroundId}/sites`} className="flex items-center gap-1">
                    Manage Sites
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Site accessibility data is pulled automatically from your site inventory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sitesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500" />
                Loading site data...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">{totalSiteCount}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">Total Sites</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      ADA scoping requires at least <span className="font-semibold">{requiredUnits}</span> accessible units
                    </p>
                  </div>
                  <div className={cn(
                    "p-4 rounded-xl border",
                    meetsScoping
                      ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                  )}>
                    <div className={cn(
                      "text-3xl font-bold",
                      meetsScoping ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                    )}>
                      {accessibleSiteCount}
                    </div>
                    <div className={cn(
                      "text-sm",
                      meetsScoping ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                    )}>
                      Accessible Sites
                    </div>
                    {!meetsScoping && totalSiteCount > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 font-medium">
                        Making {requiredUnits - accessibleSiteCount} more {requiredUnits - accessibleSiteCount === 1 ? 'site' : 'sites'} accessible will unlock certification
                      </p>
                    )}
                    {meetsScoping && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2">
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />
                        Meets ADA scoping requirements
                      </p>
                    )}
                  </div>
                </div>

                {accessibleSiteNames.length > 0 && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                      <Accessibility className="w-4 h-4" />
                      Accessible Sites
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {accessibleSiteNames.filter((n): n is string => !!n).map((name, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-md font-medium">
                          {name}
                        </span>
                      ))}
                      {sites.filter((s: { accessible?: boolean }) => s.accessible).length > 10 && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-md">
                          +{sites.filter((s: { accessible?: boolean }) => s.accessible).length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {accessibleSiteCount === 0 && totalSiteCount > 0 && (
                  <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-amber-900 dark:text-amber-100">No accessible sites configured</div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                          Go to your site management and enable the &quot;Accessible&quot; toggle on sites that meet accessibility standards.
                        </p>
                        <Button variant="outline" size="sm" className="mt-2" asChild>
                          <Link href={`/campgrounds/${campgroundId}/sites`}>
                            Configure Sites
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Collapsible Guide */}
        <Collapsible open={isGuideExpanded} onOpenChange={setIsGuideExpanded}>
          <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-slate-900">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/50 transition-colors">
                <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white">
                  <span className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    What Makes a Campsite ADA Compliant?
                  </span>
                  <ChevronDown className={cn(
                    "w-5 h-5 text-slate-500 transition-transform duration-200",
                    isGuideExpanded && "rotate-180"
                  )} />
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {isGuideExpanded ? "Click to collapse" : "Click to expand site compliance guide"}
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-6">
                {/* Step-by-step guide */}
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      num: 1,
                      title: "Site Dimensions",
                      items: [
                        "Minimum 20' × 36' level pad area",
                        "Firm, stable surface (gravel, pavement, or compacted soil)",
                        "Maximum 2% cross-slope, 5% running slope",
                        "Clear ground space for wheelchair maneuvering (60\" turning radius)"
                      ]
                    },
                    {
                      num: 2,
                      title: "Access Routes",
                      items: [
                        "36\" minimum clear width pathway to site",
                        "No steps or abrupt level changes (use ramps if needed)",
                        "Connected path to restrooms and amenities",
                        "Well-maintained, no loose gravel or hazards"
                      ]
                    },
                    {
                      num: 3,
                      title: "Utility Connections",
                      items: [
                        "Electric/water hookups at 15\"-48\" height",
                        "Clear floor space in front of connections",
                        "Easy-to-operate handles/valves",
                        "No reaching over obstructions required"
                      ]
                    },
                    {
                      num: 4,
                      title: "Site Amenities",
                      items: [
                        "Accessible picnic table (extended end for wheelchair)",
                        "Fire ring/grill with level access and reach",
                        "Tent pad on firm, level surface",
                        "Trash receptacle within reach range"
                      ]
                    }
                  ].map(section => (
                    <div key={section.num} className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <span className="text-blue-700 dark:text-blue-300 font-bold text-sm">{section.num}</span>
                        </div>
                        <h4 className="font-semibold text-slate-900 dark:text-white">{section.title}</h4>
                      </div>
                      <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 ml-10">
                        {section.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-500 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* How to mark sites as accessible */}
                <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    How to Mark a Site as Accessible
                  </h4>
                  <ol className="text-sm text-emerald-800 dark:text-emerald-200 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>Go to <Link href={`/campgrounds/${campgroundId}/sites`} className="underline hover:no-underline font-medium">Campground → Sites</Link></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>Click on the site you want to mark as accessible</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>In the site editor, find the <strong>&quot;Accessible&quot;</strong> toggle and enable it</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">4.</span>
                      <span>Save your changes - the site will now count toward your accessible unit total</span>
                    </li>
                  </ol>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Contextual next steps */}
        {certificationLevel === "none" && (
          <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Your Next Steps</h4>
            <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                <span><strong>Evaluate your sites:</strong> Use the guide above to walk through each site</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                <span><strong>Mark compliant sites:</strong> You need {requiredUnits} accessible sites for {totalSiteCount} total</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                <span><strong>Complete the checklist below:</strong> Check off features your campground already has</span>
              </li>
            </ul>
          </div>
        )}

        {certificationLevel === "friendly" && (
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
            <h4 className="font-semibold text-emerald-800 dark:text-emerald-200 mb-2">Great progress! To reach ADA Compliant:</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                <span>Complete all <strong>required</strong> checklist items below</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                <span>Ensure restrooms have accessible stalls with grab bars</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                <span>Verify parking has van-accessible spaces</span>
              </li>
            </ul>
          </div>
        )}

        {certificationLevel === "compliant" && (
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Almost there! To reach ADA Excellence:</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <Award className="w-4 h-4 text-blue-500 mt-0.5" />
                <span>Add accessible picnic tables at each accessible site</span>
              </li>
              <li className="flex items-start gap-2">
                <Award className="w-4 h-4 text-blue-500 mt-0.5" />
                <span>Install roll-in showers in at least one facility</span>
              </li>
              <li className="flex items-start gap-2">
                <Award className="w-4 h-4 text-blue-500 mt-0.5" />
                <span>Provide visual/tactile alerts and service animal relief areas</span>
              </li>
            </ul>
          </div>
        )}

        {certificationLevel === "excellence" && (
          <motion.div
            className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 border border-amber-200 dark:border-amber-800"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Congratulations! You&apos;ve achieved ADA Excellence!
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Your campground provides exceptional accessibility features. Your badge now appears on your booking page,
              helping guests find accessible camping.
            </p>
          </motion.div>
        )}

        {/* Quick wins */}
        {certificationLevel !== "excellence" && (
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Quick Wins (Highest Point Items)</h4>
            <div className="space-y-2">
              {ADA_CHECKLIST
                .filter(item => !completedItems.has(item.id) && item.id !== "sites_meet_scoping")
                .sort((a, b) => b.points - a.points)
                .slice(0, 5)
                .map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-700">
                    <div>
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item.label}</span>
                      {item.required && (
                        <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                      )}
                    </div>
                    <Badge variant="secondary" className="ml-2">{item.points} pts</Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Certification Tiers */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Award className="w-5 h-5 text-amber-500" />
              Certification Tiers
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Complete checklist items to achieve higher certification levels
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
                const pointsNeeded = threshold.minPoints - totalPoints;

                return (
                  <motion.div
                    key={level}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all cursor-pointer",
                      isAchieved
                        ? "border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg"
                    )}
                    whileHover={prefersReducedMotion || isAchieved ? {} : { scale: 1.03, y: -2 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <motion.div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          isAchieved
                            ? `bg-gradient-to-br ${info?.gradient}`
                            : "bg-slate-100 dark:bg-slate-700"
                        )}
                        whileHover={prefersReducedMotion || isAchieved ? {} : { rotate: [0, -10, 10, -10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <Accessibility className={cn(
                          "w-4 h-4",
                          isAchieved ? "text-white" : "text-slate-400"
                        )} />
                      </motion.div>
                      <span className="font-semibold text-slate-900 dark:text-white">{info?.label}</span>
                    </div>
                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      <li>&bull; {threshold.minPoints}+ points</li>
                      <li>&bull; {Math.round(threshold.requiredItemsRatio * 100)}% required items</li>
                      <li>&bull; Meet scoping requirements</li>
                    </ul>
                    {!isAchieved && pointsNeeded > 0 && (
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-2 italic">
                        {pointsNeeded} more points needed
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Checklist Categories */}
        {Object.entries(itemsByCategory).map(([category, items]) => {
          const catInfo = ADA_CATEGORIES[category as AdaCategory];
          const completedCount = items.filter(item => completedItems.has(item.id)).length;
          const isComplete = completedCount === items.length;
          const requiredInCategory = items.filter(i => i.required);
          const optionalInCategory = items.filter(i => !i.required);

          return (
            <Card
              key={category}
              className={cn(
                "transition-all duration-300 dark:bg-slate-900 dark:border-slate-700",
                isComplete && "ring-2 ring-emerald-400 dark:ring-emerald-600 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20"
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-slate-900 dark:text-white">
                  <span className="flex items-center gap-2">
                    {catInfo.label}
                    {isComplete && (
                      <motion.span
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                      >
                        <Award className="w-5 h-5 text-emerald-500" />
                      </motion.span>
                    )}
                  </span>
                  <Badge
                    variant={isComplete ? "default" : "secondary"}
                    className={cn(
                      "transition-colors duration-300",
                      isComplete && "bg-emerald-500"
                    )}
                  >
                    {completedCount} / {items.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="dark:text-slate-400">{catInfo.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Required items section */}
                {requiredInCategory.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Required for Compliance
                    </h4>
                    <div className="space-y-3">
                      {requiredInCategory.map((item) => {
                        const isChecked = completedItems.has(item.id);
                        const isAutoCalculated = item.id === "sites_meet_scoping";

                        if (isAutoCalculated) {
                          return (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 rounded-lg border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                            >
                              <Checkbox
                                checked={meetsScoping}
                                disabled
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-700 dark:text-slate-300">
                                    {item.label}
                                  </span>
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    Auto-calculated
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {item.points} pts
                                  </Badge>
                                </div>
                                <p className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                                  {item.description}
                                </p>
                                <p className="text-xs mt-2 text-slate-500 dark:text-slate-400">
                                  You have {accessibleSiteCount} of {requiredUnits} required sites.{" "}
                                  <Link href={`/campgrounds/${campgroundId}/sites`} className="text-emerald-600 dark:text-emerald-400 underline hover:no-underline">
                                    Manage sites to update this →
                                  </Link>
                                </p>
                              </div>
                              {meetsScoping && (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                          );
                        }

                        return (
                          <motion.div
                            key={item.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                              "focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900",
                              "motion-safe:hover:translate-x-1 hover:shadow-md",
                              isChecked
                                ? "border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                            )}
                            onClick={() => toggleItem(item.id)}
                            whileTap={prefersReducedMotion ? {} : { scale: 0.99 }}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "font-medium transition-colors duration-200",
                                  isChecked ? "text-emerald-800 dark:text-emerald-200" : "text-slate-900 dark:text-white"
                                )}>
                                  {item.label}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  Required
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {item.points} pts
                                </Badge>
                              </div>
                              <p className={cn(
                                "text-sm mt-1 transition-colors duration-200",
                                isChecked ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                              )}>
                                {item.description}
                              </p>
                            </div>
                            {isChecked && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Optional items section */}
                {optionalInCategory.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Bonus Points
                    </h4>
                    <div className="space-y-3">
                      {optionalInCategory.map((item) => {
                        const isChecked = completedItems.has(item.id);

                        return (
                          <motion.div
                            key={item.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                              "focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900",
                              "motion-safe:hover:translate-x-1 hover:shadow-md",
                              isChecked
                                ? "border-emerald-200 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950"
                                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                            )}
                            onClick={() => toggleItem(item.id)}
                            whileTap={prefersReducedMotion ? {} : { scale: 0.99 }}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "font-medium transition-colors duration-200",
                                  isChecked ? "text-emerald-800 dark:text-emerald-200" : "text-slate-900 dark:text-white"
                                )}>
                                  {item.label}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {item.points} pts
                                </Badge>
                              </div>
                              <p className={cn(
                                "text-sm mt-1 transition-colors duration-200",
                                isChecked ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
                              )}>
                                {item.description}
                              </p>
                            </div>
                            {isChecked && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Resources */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
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
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-blue-500" aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">U.S. Access Board</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Official ADA guidelines</p>
                </div>
              </a>
              <a
                href="https://www.fs.usda.gov/recreation/programs/accessibility/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
              >
                <ExternalLink className="w-5 h-5 text-blue-500" aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">USDA Forest Service</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Outdoor recreation accessibility</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Save Button */}
        <div className="flex justify-end pb-8 gap-3">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="self-center bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
              Unsaved changes
            </Badge>
          )}
          <Button
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className={cn(
              "transition-all duration-200",
              "motion-safe:hover:scale-105 motion-safe:active:scale-95"
            )}
          >
            {saveMutation.isPending ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              >
                <Save className="w-4 h-4 mr-2" />
              </motion.div>
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saveMutation.isPending ? "Saving Assessment..." : "Save Assessment"}
          </Button>
        </div>
      </div>
    </>
  );
}
