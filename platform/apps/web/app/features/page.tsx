"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Check,
  Search,
  ChevronDown,
  CircleDashed,
  RotateCcw,
  ExternalLink,
  Trophy,
  Target,
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAGE_REGISTRY, type PageDefinition, type PageCategory } from "@/lib/page-registry";
import { useFeatureProgress } from "@/hooks/use-feature-progress";
import Link from "next/link";

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const CATEGORY_INFO: Record<PageCategory, { label: string; description: string; color: string }> = {
  operations: {
    label: "Operations",
    description: "Daily front desk and reservation management",
    color: "emerald",
  },
  guests: {
    label: "Guests",
    description: "Guest profiles, loyalty, and communications",
    color: "blue",
  },
  finance: {
    label: "Finance",
    description: "Payments, ledger, and financial tools",
    color: "amber",
  },
  marketing: {
    label: "Marketing",
    description: "Promotions, social media, and outreach",
    color: "pink",
  },
  reports: {
    label: "Reports",
    description: "Analytics and business insights",
    color: "purple",
  },
  settings: {
    label: "Settings",
    description: "Configuration and customization",
    color: "slate",
  },
  store: {
    label: "Store",
    description: "Retail, inventory, and POS",
    color: "orange",
  },
  staff: {
    label: "Staff",
    description: "Team management and scheduling",
    color: "cyan",
  },
  admin: {
    label: "Admin",
    description: "Advanced administration tools",
    color: "red",
  },
};

const CATEGORIES_ORDER: PageCategory[] = [
  "operations",
  "guests",
  "finance",
  "store",
  "marketing",
  "reports",
  "staff",
  "settings",
  "admin",
];

function FeatureItem({
  feature,
  isChecked,
  onToggle,
}: {
  feature: PageDefinition;
  isChecked: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg transition-all group",
        "border bg-white dark:bg-slate-900",
        isChecked
          ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5"
          : "border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
          isChecked
            ? "bg-emerald-500 text-white"
            : "border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-emerald-400"
        )}
      >
        {isChecked && <Check className="w-3 h-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium",
          isChecked
            ? "text-emerald-700 dark:text-emerald-300"
            : "text-slate-900 dark:text-slate-200"
        )}>
          {feature.label}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 truncate">
          {feature.description}
        </p>
      </div>
      <Link
        href={feature.href}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
        title={`Go to ${feature.label}`}
      >
        <ExternalLink className="w-4 h-4 text-slate-400" />
      </Link>
    </motion.div>
  );
}

function CategorySection({
  category,
  features,
  completedFeatures,
  onToggle,
  isExpanded,
  onToggleExpand,
}: {
  category: PageCategory;
  features: PageDefinition[];
  completedFeatures: string[];
  onToggle: (href: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const info = CATEGORY_INFO[category];
  const completedCount = features.filter((f) => completedFeatures.includes(f.href)).length;
  const totalCount = features.length;
  const allCompleted = completedCount === totalCount && totalCount > 0;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
    >
      <button
        onClick={onToggleExpand}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          "hover:bg-slate-50 dark:hover:bg-slate-800/30",
          isExpanded && "bg-slate-50 dark:bg-slate-800/20"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              allCompleted
                ? "bg-emerald-100 dark:bg-emerald-500/20"
                : "bg-slate-100 dark:bg-slate-700/50"
            )}
          >
            {allCompleted ? (
              <Trophy className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Target className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-medium text-slate-900 dark:text-white">{info.label}</h3>
            <p className="text-xs text-slate-500">{info.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="hidden sm:block w-24">
            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allCompleted
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              allCompleted
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
            )}
          >
            {completedCount}/{totalCount}
          </span>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-slate-400 transition-transform",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={SPRING_CONFIG}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {features.map((feature) => (
                <FeatureItem
                  key={feature.href}
                  feature={feature}
                  isChecked={completedFeatures.includes(feature.href)}
                  onToggle={() => onToggle(feature.href)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FeaturesPage() {
  const prefersReducedMotion = useReducedMotion();
  const { progress, stats, isLoading, toggleFeature, reset, isCompleted } = useFeatureProgress();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<PageCategory>>(
    new Set(["operations"])
  );

  // Build completed features list from API data
  const completedFeatures = useMemo(
    () => progress.filter((p) => p.completed).map((p) => p.featureKey),
    [progress]
  );

  // Group pages by category
  const pagesByCategory = useMemo(() => {
    const grouped: Record<PageCategory, PageDefinition[]> = {
      operations: [],
      guests: [],
      finance: [],
      marketing: [],
      reports: [],
      settings: [],
      store: [],
      staff: [],
      admin: [],
    };

    PAGE_REGISTRY.forEach((page) => {
      if (grouped[page.category]) {
        grouped[page.category].push(page);
      }
    });

    return grouped;
  }, []);

  // Filter by search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return CATEGORIES_ORDER;

    const query = searchQuery.toLowerCase();
    return CATEGORIES_ORDER.filter((cat) =>
      pagesByCategory[cat].some(
        (page) =>
          page.label.toLowerCase().includes(query) ||
          page.description.toLowerCase().includes(query) ||
          page.keywords.some((k) => k.toLowerCase().includes(query))
      )
    );
  }, [searchQuery, pagesByCategory]);

  const handleToggle = (href: string) => {
    toggleFeature(href);
  };

  const toggleCategory = (category: PageCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const totalFeatures = PAGE_REGISTRY.length;
  const completedCount = completedFeatures.length;
  const progressPercent = totalFeatures > 0 ? Math.round((completedCount / totalFeatures) * 100) : 0;

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Feature Discovery
              </h1>
              <p className="text-slate-500 dark:text-slate-400">
                Track your journey through all {totalFeatures} features
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reset()}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Progress
          </Button>
        </div>

        {/* Overall progress */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-emerald-100 text-sm">Your exploration progress</p>
              <p className="text-3xl font-bold">
                {completedCount} of {totalFeatures} features
              </p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-bold">{progressPercent}%</p>
              <p className="text-emerald-100 text-sm">complete</p>
            </div>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features..."
            className="pl-9"
          />
        </div>

        {/* Categories */}
        <div className="space-y-3">
          {filteredCategories.map((category, index) => {
            const features = searchQuery
              ? pagesByCategory[category].filter((page) => {
                  const query = searchQuery.toLowerCase();
                  return (
                    page.label.toLowerCase().includes(query) ||
                    page.description.toLowerCase().includes(query) ||
                    page.keywords.some((k) => k.toLowerCase().includes(query))
                  );
                })
              : pagesByCategory[category];

            if (features.length === 0) return null;

            return (
              <motion.div
                key={category}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <CategorySection
                  category={category}
                  features={features}
                  completedFeatures={completedFeatures}
                  onToggle={handleToggle}
                  isExpanded={expandedCategories.has(category) || !!searchQuery}
                  onToggleExpand={() => toggleCategory(category)}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No features match your search</p>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
