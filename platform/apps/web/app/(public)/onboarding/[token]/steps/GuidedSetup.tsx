"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Clock,
  ExternalLink,
  SkipForward,
  Play,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  Megaphone,
  BarChart3,
  Settings,
  Store,
  UserCog,
  Percent,
  FileText,
  CreditCard,
  Tag,
  Mail,
  MessageSquare,
  Bell,
  Link,
  Globe,
  Palette,
  Camera,
  Plus,
  Gift,
  Heart,
  Lightbulb,
  Trophy,
  MapPin,
  HelpCircle,
  PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  SETUPABLE_FEATURES,
  getOrderedFeatures,
  getFeatureByKey,
  getTotalEstimatedMinutes,
  type SetupableFeature,
} from "@/lib/feature-recommendations";
import type { FeatureTriageData, TriageStatus } from "./FeatureTriage";

export interface GuidedSetupData {
  completedFeatures: string[];
  skippedFeatures: string[];
  currentFeatureIndex: number;
}

interface GuidedSetupProps {
  featureTriage: FeatureTriageData;
  campgroundId: string;
  data: Partial<GuidedSetupData>;
  onChange: (data: GuidedSetupData) => void;
  onComplete: () => void;
  onBack: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// Icon mapping for features
const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  seasonal_rates: Calendar,
  tax_rules: Percent,
  cancellation_policy: FileText,
  deposit_policy: CreditCard,
  team_members: Users,
  staff_scheduling: Calendar,
  time_clock: Clock,
  store_products: Store,
  pos_setup: CreditCard,
  store_categories: Store,
  housekeeping: Sparkles,
  cleaning_zones: MapPin,
  activities: Sparkles,
  events: Calendar,
  group_bookings: Users,
  seasonal_rates_cards: Calendar,
  utilities_billing: DollarSign,
  repeat_charges: Clock,
  promotions: Tag,
  email_templates: Mail,
  email_campaigns: Mail,
  social_planner: Megaphone,
  referrals: Users,
  waivers: FileText,
  park_rules: FileText,
  guest_portal: Users,
  online_booking: Globe,
  faqs: HelpCircle,
  sms_setup: MessageSquare,
  notification_triggers: Bell,
  integrations: Link,
  ota_channels: Globe,
  ai_setup: Sparkles,
  dynamic_pricing: DollarSign,
  reports_setup: BarChart3,
  gamification: Trophy,
  branding: Palette,
  photos: Camera,
  upsells: Plus,
  fees_setup: DollarSign,
  gift_cards: Gift,
  charity_roundup: Heart,
};

function getFeatureIcon(key: string): React.ComponentType<{ className?: string }> {
  return FEATURE_ICONS[key] || Settings;
}

export function GuidedSetup({
  featureTriage,
  campgroundId,
  data,
  onChange,
  onComplete,
  onBack,
}: GuidedSetupProps) {
  const prefersReducedMotion = useReducedMotion();

  // Get ordered list of setup_now features
  const orderedFeatures = useMemo(() => {
    const setupNowKeys = Object.entries(featureTriage.selections)
      .filter(([, status]) => status === "setup_now")
      .map(([key]) => key);
    return getOrderedFeatures(setupNowKeys);
  }, [featureTriage.selections]);

  // State
  const [currentIndex, setCurrentIndex] = useState(data.currentFeatureIndex || 0);
  const [completedFeatures, setCompletedFeatures] = useState<Set<string>>(
    () => new Set(data.completedFeatures || []),
  );
  const [skippedFeatures, setSkippedFeatures] = useState<Set<string>>(
    () => new Set(data.skippedFeatures || []),
  );
  const [isNavigating, setIsNavigating] = useState(false);

  // Current feature
  const currentFeature = orderedFeatures[currentIndex];
  const totalFeatures = orderedFeatures.length;
  const processedCount = completedFeatures.size + skippedFeatures.size;
  const progressPercent = totalFeatures > 0 ? (processedCount / totalFeatures) * 100 : 0;

  // Estimated time remaining
  const remainingFeatures = orderedFeatures.filter(
    (f) => !completedFeatures.has(f.key) && !skippedFeatures.has(f.key),
  );
  const estimatedMinutes = getTotalEstimatedMinutes(remainingFeatures.map((f) => f.key));

  // Update parent state
  const updateParentState = useCallback(() => {
    onChange({
      completedFeatures: [...completedFeatures],
      skippedFeatures: [...skippedFeatures],
      currentFeatureIndex: currentIndex,
    });
  }, [completedFeatures, skippedFeatures, currentIndex, onChange]);

  // Handle completing a feature
  const handleComplete = useCallback(() => {
    if (!currentFeature) return;

    setCompletedFeatures((prev) => {
      const next = new Set(prev);
      next.add(currentFeature.key);
      return next;
    });

    // Move to next uncompleted feature or finish
    const nextIndex = orderedFeatures.findIndex(
      (f, i) => i > currentIndex && !completedFeatures.has(f.key) && !skippedFeatures.has(f.key),
    );

    if (nextIndex === -1) {
      // All features processed
      updateParentState();
      onComplete();
    } else {
      setCurrentIndex(nextIndex);
      updateParentState();
    }
  }, [
    currentFeature,
    currentIndex,
    orderedFeatures,
    completedFeatures,
    skippedFeatures,
    updateParentState,
    onComplete,
  ]);

  // Handle skipping a feature
  const handleSkip = useCallback(() => {
    if (!currentFeature) return;

    setSkippedFeatures((prev) => {
      const next = new Set(prev);
      next.add(currentFeature.key);
      return next;
    });

    // Move to next uncompleted feature or finish
    const nextIndex = orderedFeatures.findIndex(
      (f, i) => i > currentIndex && !completedFeatures.has(f.key) && !skippedFeatures.has(f.key),
    );

    if (nextIndex === -1) {
      // All features processed
      updateParentState();
      onComplete();
    } else {
      setCurrentIndex(nextIndex);
      updateParentState();
    }
  }, [
    currentFeature,
    currentIndex,
    orderedFeatures,
    completedFeatures,
    skippedFeatures,
    updateParentState,
    onComplete,
  ]);

  // Handle navigating to feature setup
  const handleStartSetup = useCallback(() => {
    if (!currentFeature) return;

    // Build the setup URL with campgroundId
    let setupUrl = currentFeature.setupPath;
    if (setupUrl.includes("[campgroundId]")) {
      setupUrl = setupUrl.replace("[campgroundId]", campgroundId);
    }

    // Open in new tab
    window.open(setupUrl, "_blank");
  }, [currentFeature, campgroundId]);

  // Handle skip all remaining
  const handleSkipAll = useCallback(() => {
    // Mark all remaining as skipped
    const remaining = orderedFeatures.filter(
      (f) => !completedFeatures.has(f.key) && !skippedFeatures.has(f.key),
    );

    setSkippedFeatures((prev) => {
      const next = new Set(prev);
      for (const f of remaining) {
        next.add(f.key);
      }
      return next;
    });

    updateParentState();
    onComplete();
  }, [orderedFeatures, completedFeatures, skippedFeatures, updateParentState, onComplete]);

  // If no features to set up
  if (orderedFeatures.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">No Features to Set Up</h2>
          <p className="text-slate-400 mb-6">
            You didn't select any features for immediate setup. You can always configure features
            later from your dashboard.
          </p>
          <Button onClick={onComplete} className="bg-emerald-600 hover:bg-emerald-500">
            Continue to Launch
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // If all features processed
  if (processedCount >= totalFeatures) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">All Features Configured</h2>
          <p className="text-slate-400 mb-2">
            {completedFeatures.size} completed, {skippedFeatures.size} added to your queue.
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Skipped features will appear on your dashboard for later setup.
          </p>
          <Button onClick={onComplete} className="bg-emerald-600 hover:bg-emerald-500">
            Continue to Launch
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const FeatureIcon = getFeatureIcon(currentFeature.key);

  return (
    <div className="flex-1 flex flex-col p-8 max-w-3xl mx-auto w-full">
      {/* Header with progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Play className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Feature Setup</h1>
              <p className="text-sm text-slate-400">
                Setting up {currentIndex + 1} of {totalFeatures} features
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400">~{estimatedMinutes} min remaining</div>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>

      {/* Current feature card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentFeature.key}
          initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
          transition={SPRING_CONFIG}
          className="flex-1 flex flex-col"
        >
          <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-6">
            {/* Feature header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <FeatureIcon className="w-7 h-7 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">{currentFeature.label}</h2>
                <p className="text-slate-400">{currentFeature.description}</p>
              </div>
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Clock className="w-4 h-4" />~{currentFeature.estimatedMinutes} min
              </div>
            </div>

            {/* Dependencies info */}
            {currentFeature.dependencies.length > 0 && (
              <div className="mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Link className="w-4 h-4" />
                  <span className="font-medium">Related Features</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentFeature.dependencies.map((depKey) => {
                    const dep = getFeatureByKey(depKey);
                    const isCompleted = completedFeatures.has(depKey);
                    return (
                      <span
                        key={depKey}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs font-medium",
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-700 text-slate-400",
                        )}
                      >
                        {isCompleted && <Check className="w-3 h-3 inline mr-1" />}
                        {dep?.label || depKey}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-4">
              <Button
                onClick={handleStartSetup}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 h-12"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Settings
              </Button>
              <Button
                onClick={handleComplete}
                variant="outline"
                className="flex-1 border-slate-600 hover:bg-slate-700 h-12"
              >
                <Check className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            </div>
          </div>

          {/* Feature list preview */}
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
            <div className="text-sm text-slate-400 mb-3">Remaining features:</div>
            <div className="flex flex-wrap gap-2">
              {orderedFeatures.map((feature, index) => {
                const isCompleted = completedFeatures.has(feature.key);
                const isSkipped = skippedFeatures.has(feature.key);
                const isCurrent = index === currentIndex;

                return (
                  <span
                    key={feature.key}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      isCurrent
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500"
                        : isCompleted
                          ? "bg-emerald-500/10 text-emerald-400/60"
                          : isSkipped
                            ? "bg-slate-700/50 text-slate-500 line-through"
                            : "bg-slate-700 text-slate-400",
                    )}
                  >
                    {isCompleted && <Check className="w-3 h-3 inline mr-1" />}
                    {feature.label}
                  </span>
                );
              })}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-700">
        <Button variant="ghost" onClick={onBack} className="text-slate-400 hover:text-white">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-slate-400 hover:text-amber-400"
          >
            <Clock className="w-4 h-4 mr-2" />
            Do Later
          </Button>
          <Button
            variant="ghost"
            onClick={handleSkipAll}
            className="text-slate-400 hover:text-white"
          >
            <SkipForward className="w-4 h-4 mr-2" />
            Skip All Remaining
          </Button>
        </div>
      </div>
    </div>
  );
}
