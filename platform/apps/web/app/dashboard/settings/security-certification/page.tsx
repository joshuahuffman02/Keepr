"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";
import {
  SECURITY_CHECKLIST,
  SECURITY_CATEGORIES,
  SECURITY_CERTIFICATION_THRESHOLDS,
  SECURITY_RESOURCES,
  SECURITY_TEMPLATES,
  calculateSecurityCertificationLevel,
  getSecurityAssessmentStats,
  getSecurityBadgeInfo,
  getQuickWins,
  type SecurityAssessmentData,
  type SecurityCategory,
  type SecurityCertificationLevel,
} from "@/lib/security-certification";
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  ExternalLink,
  Award,
  Lightbulb,
  ChevronDown,
  Sparkles,
  Download,
  FileText,
  UserCheck,
  Building2,
  Mail,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import Confetti from "react-confetti";
import { useWindowSize } from "@/hooks/use-window-size";

// SVG Shield Badge Component
function ShieldBadge({ level, size = "md" }: { level: SecurityCertificationLevel; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-16 h-16",
    lg: "w-24 h-24",
  };

  const badgeInfo = getSecurityBadgeInfo(level);
  if (!badgeInfo) {
    return (
      <div className={cn("rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-700", sizeClasses[size])}>
        <Shield className={cn("text-slate-400", size === "lg" ? "w-12 h-12" : size === "md" ? "w-8 h-8" : "w-4 h-4")} />
      </div>
    );
  }

  return (
    <div className={cn("rounded-full flex items-center justify-center", `bg-gradient-to-br ${badgeInfo.gradient}`, sizeClasses[size])}>
      <ShieldCheck className={cn("text-white", size === "lg" ? "w-12 h-12" : size === "md" ? "w-8 h-8" : "w-4 h-4")} />
    </div>
  );
}

export default function SecurityCertificationPage() {
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
  const [showTierUnlock, setShowTierUnlock] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["data_protection", "access_control"]));

  // Auditor verification fields
  const [auditorName, setAuditorName] = useState("");
  const [auditorEmail, setAuditorEmail] = useState("");
  const [auditorOrg, setAuditorOrg] = useState("");
  const [isVerified, setIsVerified] = useState(false);

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

  // Initialize form from campground data
  useEffect(() => {
    const cg = campgroundQuery.data;
    if (!cg) return;

    const securityData = (cg as any).securityAssessment as SecurityAssessmentData | null;
    if (securityData) {
      const items = new Set(securityData.completedItems || []);
      setCompletedItems(items);
      setInitialCompletedItems(items);
      setNotes(securityData.notes || "");
    }

    // Load auditor info
    setIsVerified((cg as any).securityVerified || false);
    setAuditorName((cg as any).securityVerifiedBy || "");
    setAuditorEmail((cg as any).securityAuditorEmail || "");
    setAuditorOrg((cg as any).securityAuditorOrg || "");

    // Set previous level for comparison
    const savedLevel = (cg as any).securityCertificationLevel || "none";
    setPreviousLevel(savedLevel);
  }, [campgroundQuery.data]);

  // Calculate current assessment data
  const assessmentData: SecurityAssessmentData = {
    completedItems: Array.from(completedItems),
    notes,
    lastUpdated: new Date().toISOString(),
  };

  const certificationLevel = calculateSecurityCertificationLevel(assessmentData);
  const stats = getSecurityAssessmentStats(assessmentData);
  const badgeInfo = getSecurityBadgeInfo(certificationLevel);
  const quickWins = getQuickWins(assessmentData, 5);

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
    const tierOrder: SecurityCertificationLevel[] = ["none", "basic", "standard", "advanced", "excellence"];
    const currentIndex = tierOrder.indexOf(certificationLevel);
    const nextTier = tierOrder[currentIndex + 1] as keyof typeof SECURITY_CERTIFICATION_THRESHOLDS;
    if (!nextTier || nextTier === "none") return null;
    const threshold = SECURITY_CERTIFICATION_THRESHOLDS[nextTier];
    const pointsNeeded = threshold.minPoints - stats.totalPoints;
    return { tier: nextTier, pointsNeeded, isClose: pointsNeeded > 0 && pointsNeeded <= 20 };
  }, [certificationLevel, stats.totalPoints]);

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

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Save mutation with celebration
  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateSecuritySettings(campgroundId!, {
        securityAssessment: assessmentData,
        securityCertificationLevel: certificationLevel,
        securityAssessmentUpdatedAt: new Date().toISOString(),
        securityVerified: isVerified,
        securityVerifiedAt: isVerified ? new Date().toISOString() : null,
        securityVerifiedBy: auditorName || null,
        securityAuditorEmail: auditorEmail || null,
        securityAuditorOrg: auditorOrg || null,
      }),
    onSuccess: () => {
      const oldLevel = previousLevel || "none";
      const newLevel = certificationLevel;

      // Check if tier upgraded
      const tierOrder = ["none", "basic", "standard", "advanced", "excellence"];
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
          description: `You've achieved ${badgeInfo?.label}! Your security badge is now displayed.`,
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
  const itemsByCategory = SECURITY_CHECKLIST.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<SecurityCategory, typeof SECURITY_CHECKLIST>);

  if (!campgroundId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500 dark:text-slate-400">Select a campground to configure security certification.</p>
      </div>
    );
  }

  if (campgroundQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
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
              ? ["#06b6d4", "#3b82f6", "#8b5cf6", "#0ea5e9"]
              : certificationLevel === "advanced"
              ? ["#f59e0b", "#fbbf24", "#fcd34d", "#fef3c7"]
              : certificationLevel === "standard"
              ? ["#94a3b8", "#64748b", "#cbd5e1", "#e2e8f0"]
              : ["#92400e", "#b45309", "#d97706", "#f59e0b"]
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
                className="flex justify-center"
              >
                <ShieldBadge level={certificationLevel} size="lg" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-2xl font-bold text-slate-900 dark:text-white mb-2 mt-4"
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
                {badgeInfo?.label} - {badgeInfo?.tier} Shield
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
              <Shield className="w-7 h-7 text-blue-600" />
              Security & Privacy Certification
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Protect your customers and earn trust with CISO-level security practices
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
                You&apos;re only {nextTierInfo.pointsNeeded} points away from {getSecurityBadgeInfo(nextTierInfo.tier)?.label}!
              </p>
            </div>
          </motion.div>
        )}

        {/* Current Status Card */}
        <Card className="border-2 border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <ShieldCheck className="w-5 h-5 text-slate-600 dark:text-slate-400" />
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
                      whileHover={prefersReducedMotion ? {} : { scale: 1.1, rotate: 5 }}
                    >
                      <ShieldBadge level={certificationLevel} size="md" />
                    </motion.div>
                    <Badge className={cn(
                      "text-white mb-2 mt-3",
                      `bg-gradient-to-r ${badgeInfo.gradient}`
                    )}>
                      {badgeInfo.tier} Shield
                    </Badge>
                    <p className="font-medium text-slate-900 dark:text-white">{badgeInfo.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{badgeInfo.description}</p>
                  </>
                ) : (
                  <>
                    <ShieldBadge level="none" size="md" />
                    <Badge variant="secondary" className="mb-2 mt-3">Not Certified</Badge>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Start your security journey!</p>
                  </>
                )}
              </div>

              {/* Progress Stats */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Points Earned</span>
                    <span className="font-medium text-slate-900 dark:text-white">{stats.totalPoints} / {stats.maxPoints}</span>
                  </div>
                  <div
                    className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={stats.totalPoints}
                    aria-valuemax={stats.maxPoints}
                    aria-label="Points progress"
                  >
                    <motion.div
                      className={cn(
                        "h-full bg-gradient-to-r from-blue-500 to-cyan-500 relative",
                        (stats.totalPoints / stats.maxPoints) > 0.9 && "motion-safe:animate-pulse"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.totalPoints / stats.maxPoints) * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">Required Items</span>
                    <span className="font-medium text-slate-900 dark:text-white">{stats.requiredCompleted} / {stats.requiredTotal}</span>
                  </div>
                  <div
                    className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={stats.requiredCompleted}
                    aria-valuemax={stats.requiredTotal}
                    aria-label="Required items progress"
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.requiredRatio * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <h4 className="font-medium text-slate-900 dark:text-white mb-2">Verification Status</h4>
                <div className="flex items-center gap-2 mb-2">
                  {isVerified ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-500" />
                  )}
                  <span className={isVerified ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                    {isVerified ? "Third-party verified" : "Self-reported"}
                  </span>
                </div>
                {isVerified && auditorOrg && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Verified by {auditorOrg}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Wins */}
        {certificationLevel !== "excellence" && quickWins.length > 0 && (
          <Card className="dark:bg-slate-900 dark:border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                Quick Wins
              </CardTitle>
              <CardDescription className="dark:text-slate-400">
                Highest-impact items you haven&apos;t completed yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickWins.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => {
                      toggleItem(item.id);
                      setExpandedCategories(prev => new Set([...prev, item.category]));
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={completedItems.has(item.id)}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                        {item.required && (
                          <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary">{item.points} pts</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
            <div className="grid md:grid-cols-4 gap-4">
              {(["basic", "standard", "advanced", "excellence"] as const).map((level) => {
                const info = getSecurityBadgeInfo(level);
                const threshold = SECURITY_CERTIFICATION_THRESHOLDS[level];
                const tierOrder = ["none", "basic", "standard", "advanced", "excellence"];
                const currentIndex = tierOrder.indexOf(certificationLevel);
                const levelIndex = tierOrder.indexOf(level);
                const isAchieved = levelIndex <= currentIndex && certificationLevel !== "none";
                const isCurrent = level === certificationLevel;
                const pointsNeeded = threshold.minPoints - stats.totalPoints;

                return (
                  <div
                    key={level}
                    className={cn(
                      "p-4 rounded-xl border-2 transition-all",
                      isCurrent
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : isAchieved
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    )}
                  >
                    <div className="flex flex-col items-center text-center">
                      <ShieldBadge level={level} size="sm" />
                      <h4 className="font-semibold text-slate-900 dark:text-white mt-2">{info?.tier}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{threshold.minPoints}+ pts</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round(threshold.requiredItemsRatio * 100)}% required</p>
                      {isCurrent && (
                        <Badge className="mt-2 bg-blue-500">Current</Badge>
                      )}
                      {isAchieved && !isCurrent && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-2" />
                      )}
                      {!isAchieved && pointsNeeded > 0 && (
                        <p className="text-xs text-slate-400 mt-2">{pointsNeeded} pts to go</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Compliance Checklist */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <FileText className="w-5 h-5 text-blue-500" />
              Security Compliance Checklist
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Complete these items to improve your security posture and earn certification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(SECURITY_CATEGORIES) as SecurityCategory[]).map((category) => {
              const categoryInfo = SECURITY_CATEGORIES[category];
              const items = itemsByCategory[category] || [];
              const categoryStats = stats.categoryProgress[category];
              const isExpanded = expandedCategories.has(category);

              return (
                <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="text-left">
                            <h4 className="font-semibold text-slate-900 dark:text-white">{categoryInfo.label}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{categoryInfo.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium text-slate-900 dark:text-white">
                              {categoryStats?.completed || 0}/{categoryStats?.total || 0}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {categoryStats?.points || 0}/{categoryStats?.maxPoints || 0} pts
                            </p>
                          </div>
                          <ChevronDown className={cn(
                            "w-5 h-5 text-slate-400 transition-transform",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-slate-200 dark:border-slate-700 p-4 space-y-3">
                        {items.map(item => (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer",
                              completedItems.has(item.id)
                                ? "bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                            )}
                            onClick={() => toggleItem(item.id)}
                          >
                            <Checkbox
                              checked={completedItems.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  "text-sm font-medium",
                                  completedItems.has(item.id)
                                    ? "text-emerald-900 dark:text-emerald-100"
                                    : "text-slate-900 dark:text-white"
                                )}>
                                  {item.label}
                                </span>
                                {item.required && (
                                  <Badge variant="outline" className="text-xs">Required</Badge>
                                )}
                                <Badge variant="secondary" className="text-xs">{item.points} pts</Badge>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {item.description}
                              </p>
                              {(item.templateId || item.resourceUrl) && (
                                <div className="flex items-center gap-2 mt-2">
                                  {item.templateId && SECURITY_TEMPLATES[item.templateId] && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`/content/security-templates/${SECURITY_TEMPLATES[item.templateId!].filename}`, "_blank");
                                      }}
                                    >
                                      <Download className="w-3 h-3 mr-1" />
                                      Template
                                    </Button>
                                  )}
                                  {item.resourceUrl && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(item.resourceUrl, "_blank");
                                      }}
                                    >
                                      <ExternalLink className="w-3 h-3 mr-1" />
                                      Learn More
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>

        {/* Third-Party Verification */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              Third-Party Verification
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Optionally have your security assessment verified by a third-party auditor for added credibility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <Checkbox
                  id="verified"
                  checked={isVerified}
                  onCheckedChange={(checked) => setIsVerified(checked === true)}
                />
                <label htmlFor="verified" className="text-sm font-medium text-slate-900 dark:text-white cursor-pointer">
                  This assessment has been verified by a third-party auditor
                </label>
              </div>

              {isVerified && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="grid md:grid-cols-3 gap-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="auditorName" className="flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Auditor Name
                    </Label>
                    <Input
                      id="auditorName"
                      value={auditorName}
                      onChange={(e) => setAuditorName(e.target.value)}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auditorOrg" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Organization
                    </Label>
                    <Input
                      id="auditorOrg"
                      value={auditorOrg}
                      onChange={(e) => setAuditorOrg(e.target.value)}
                      placeholder="Security Auditors Inc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="auditorEmail" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Contact Email
                    </Label>
                    <Input
                      id="auditorEmail"
                      type="email"
                      value={auditorEmail}
                      onChange={(e) => setAuditorEmail(e.target.value)}
                      placeholder="auditor@example.com"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <ExternalLink className="w-5 h-5 text-blue-500" />
              Security Resources
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              External guides and frameworks to help improve your security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {SECURITY_RESOURCES.map((resource, idx) => (
                <a
                  key={idx}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{resource.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{resource.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Downloadable Templates */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Download className="w-5 h-5 text-emerald-500" />
              Policy & Document Templates
            </CardTitle>
            <CardDescription className="dark:text-slate-400">
              Download and customize these templates for your campground
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {Object.entries(SECURITY_TEMPLATES).map(([id, template]) => (
                <a
                  key={id}
                  href={`/content/security-templates/${template.filename}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white">{template.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{template.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
