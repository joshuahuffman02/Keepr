"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ListTodo,
  ChevronRight,
  ChevronDown,
  Check,
  Clock,
  X,
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  Megaphone,
  BarChart3,
  Settings,
  Store,
  UserCog,
  Shield,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SETUPABLE_FEATURES,
  type SetupableFeature,
  type FeatureRecommendations,
  getTotalEstimatedMinutes,
} from "@/lib/feature-recommendations";
import type { PageCategory } from "@/lib/page-registry";

export type TriageStatus = "setup_now" | "setup_later" | "skip";

export interface FeatureTriageSelection {
  [featureKey: string]: TriageStatus;
}

export interface FeatureTriageData {
  selections: FeatureTriageSelection;
  completed: boolean;
}

interface FeatureTriageProps {
  data: Partial<FeatureTriageData>;
  recommendations: FeatureRecommendations;
  onChange: (data: FeatureTriageData) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// Category metadata
const CATEGORY_INFO: Record<
  PageCategory,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  operations: { label: "Operations", icon: Calendar },
  guests: { label: "Guests", icon: Users },
  finance: { label: "Finance", icon: DollarSign },
  marketing: { label: "Marketing", icon: Megaphone },
  reports: { label: "Reports", icon: BarChart3 },
  settings: { label: "Settings", icon: Settings },
  store: { label: "Store", icon: Store },
  staff: { label: "Staff", icon: UserCog },
  admin: { label: "Admin", icon: Shield },
};

const createCategoryGroups = (): Record<PageCategory, SetupableFeature[]> => ({
  operations: [],
  guests: [],
  finance: [],
  marketing: [],
  reports: [],
  settings: [],
  store: [],
  staff: [],
  admin: [],
});

// Group features by category
function groupFeaturesByCategory(): Record<PageCategory, SetupableFeature[]> {
  const groups = createCategoryGroups();

  for (const feature of SETUPABLE_FEATURES) {
    groups[feature.category].push(feature);
  }

  return groups;
}

export function FeatureTriage({
  data,
  recommendations,
  onChange,
  onNext,
  onBack,
  onSkip,
}: FeatureTriageProps) {
  const prefersReducedMotion = useReducedMotion();
  const groupedFeatures = useMemo(() => groupFeaturesByCategory(), []);

  // Initialize selections from recommendations
  const [selections, setSelections] = useState<FeatureTriageSelection>(() => {
    if (data.selections && Object.keys(data.selections).length > 0) {
      return data.selections;
    }

    // Initialize from recommendations
    const initial: FeatureTriageSelection = {};
    for (const key of recommendations.setupNow) {
      initial[key] = "setup_now";
    }
    for (const key of recommendations.setupLater) {
      initial[key] = "setup_later";
    }
    for (const key of recommendations.skipped) {
      initial[key] = "skip";
    }
    return initial;
  });

  // Track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Set<PageCategory>>(() => {
    // Start with categories that have "setup_now" features expanded
    const expanded = new Set<PageCategory>();
    for (const [key, status] of Object.entries(selections)) {
      if (status === "setup_now") {
        const feature = SETUPABLE_FEATURES.find((f) => f.key === key);
        if (feature) {
          expanded.add(feature.category);
        }
      }
    }
    // Also expand "settings" by default
    expanded.add("settings");
    return expanded;
  });

  // Toggle category expansion
  const toggleCategory = useCallback((category: PageCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Update a single feature's status
  const updateFeatureStatus = useCallback((featureKey: string, status: TriageStatus) => {
    setSelections((prev) => ({
      ...prev,
      [featureKey]: status,
    }));
  }, []);

  // Calculate summary stats
  const summary = useMemo(() => {
    const setupNowKeys = Object.entries(selections)
      .filter(([, status]) => status === "setup_now")
      .map(([key]) => key);
    const setupLaterKeys = Object.entries(selections)
      .filter(([, status]) => status === "setup_later")
      .map(([key]) => key);

    return {
      setupNowCount: setupNowKeys.length,
      setupNowMinutes: getTotalEstimatedMinutes(setupNowKeys),
      setupLaterCount: setupLaterKeys.length,
    };
  }, [selections]);

  // Handle continue
  const handleContinue = useCallback(() => {
    onChange({
      selections,
      completed: true,
    });
    onNext();
  }, [selections, onChange, onNext]);

  // Handle skip
  const handleSkip = useCallback(() => {
    // Skip with all features set to "skip"
    const skipAll: FeatureTriageSelection = {};
    for (const feature of SETUPABLE_FEATURES) {
      skipAll[feature.key] = "skip";
    }
    onChange({
      selections: skipAll,
      completed: true,
    });
    onSkip();
  }, [onChange, onSkip]);

  // Render triage toggle for a feature
  const renderTriageToggle = (feature: SetupableFeature) => {
    const status = selections[feature.key] || "skip";

    return (
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-800/50">
        <button
          onClick={() => updateFeatureStatus(feature.key, "setup_now")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
            status === "setup_now"
              ? "bg-emerald-500 text-white"
              : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/50",
          )}
        >
          <Check className="w-3 h-3" />
          Now
        </button>
        <button
          onClick={() => updateFeatureStatus(feature.key, "setup_later")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
            status === "setup_later"
              ? "bg-amber-500 text-white"
              : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/50",
          )}
        >
          <Clock className="w-3 h-3" />
          Later
        </button>
        <button
          onClick={() => updateFeatureStatus(feature.key, "skip")}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1",
            status === "skip"
              ? "bg-slate-600 text-white"
              : "text-slate-400 hover:text-slate-300 hover:bg-slate-700/50",
          )}
        >
          <X className="w-3 h-3" />
          Skip
        </button>
      </div>
    );
  };

  // Render a single feature row
  const renderFeatureRow = (feature: SetupableFeature) => {
    const status = selections[feature.key] || "skip";
    const isRecommended = recommendations.setupNow.includes(feature.key);

    return (
      <motion.div
        key={feature.key}
        initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
        className={cn(
          "flex items-center justify-between p-4 rounded-lg border transition-all",
          status === "setup_now"
            ? "bg-emerald-500/5 border-emerald-500/30"
            : status === "setup_later"
              ? "bg-amber-500/5 border-amber-500/30"
              : "bg-slate-800/20 border-slate-700/50",
        )}
      >
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-2">
            <p className="font-medium text-white">{feature.label}</p>
            {isRecommended && (
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{feature.description}</p>
          <p className="text-xs text-slate-500 mt-1">~{feature.estimatedMinutes} min</p>
        </div>
        {renderTriageToggle(feature)}
      </motion.div>
    );
  };

  // Render a category section
  const renderCategorySection = (category: PageCategory) => {
    const features = groupedFeatures[category];
    if (!features || features.length === 0) return null;

    const isExpanded = expandedCategories.has(category);
    const CategoryIcon = CATEGORY_INFO[category]?.icon || Settings;
    const categoryLabel = CATEGORY_INFO[category]?.label || category;

    // Count features by status in this category
    const nowCount = features.filter((f) => selections[f.key] === "setup_now").length;
    const laterCount = features.filter((f) => selections[f.key] === "setup_later").length;

    return (
      <motion.div
        key={category}
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={prefersReducedMotion ? {} : { opacity: 1 }}
        className="border border-slate-700 rounded-xl overflow-hidden"
      >
        {/* Category header */}
        <button
          onClick={() => toggleCategory(category)}
          className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
              <CategoryIcon className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-white">{categoryLabel}</p>
              <p className="text-xs text-slate-500">
                {features.length} feature{features.length !== 1 ? "s" : ""}
                {nowCount > 0 && <span className="text-emerald-400 ml-2">{nowCount} now</span>}
                {laterCount > 0 && <span className="text-amber-400 ml-2">{laterCount} later</span>}
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-slate-400 transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>

        {/* Feature list */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
              animate={prefersReducedMotion ? {} : { height: "auto", opacity: 1 }}
              exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
              transition={SPRING_CONFIG}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 border-t border-slate-700/50">
                {features.map(renderFeatureRow)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // Categories to display (exclude admin)
  const categoriesToShow: PageCategory[] = [
    "settings",
    "operations",
    "staff",
    "store",
    "finance",
    "marketing",
    "guests",
    "reports",
  ];

  return (
    <div className="max-w-3xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 mb-4">
            <ListTodo className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Choose Your Features</h2>
          <p className="text-slate-400">Decide what to set up now, later, or skip</p>
        </motion.div>

        {/* Summary bar */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700"
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-300">
                <span className="font-semibold text-white">{summary.setupNowCount}</span> now
                {summary.setupNowMinutes > 0 && (
                  <span className="text-slate-500"> (~{summary.setupNowMinutes} min)</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-slate-300">
                <span className="font-semibold text-white">{summary.setupLaterCount}</span> queued
                for later
              </span>
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-purple-400" />
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">
              We've pre-selected features based on your quiz answers.
            </span>{" "}
            Adjust as needed - you can always change these later from Settings.
          </div>
        </motion.div>

        {/* Category sections */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          {categoriesToShow.map(renderCategorySection)}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleContinue}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
            )}
          >
            {summary.setupNowCount > 0 ? (
              <>
                Set Up {summary.setupNowCount} Feature
                {summary.setupNowCount !== 1 ? "s" : ""}
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Continue to Launch
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip All Features
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
