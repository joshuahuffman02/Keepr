"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  Check,
  Search,
  Info,
  ChevronDown,
  CircleDashed,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAGE_REGISTRY, type PageDefinition, type PageCategory } from "@/lib/page-registry";

interface FeatureDiscoveryProps {
  completedFeatures: string[];
  onChange: (completedFeatures: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const CATEGORY_INFO: Record<PageCategory, { label: string; description: string; icon: string }> = {
  operations: {
    label: "Operations",
    description: "Daily front desk and reservation management",
    icon: "calendar",
  },
  guests: {
    label: "Guests",
    description: "Guest profiles, loyalty, and communications",
    icon: "users",
  },
  finance: {
    label: "Finance",
    description: "Payments, ledger, and financial tools",
    icon: "dollar",
  },
  marketing: {
    label: "Marketing",
    description: "Promotions, social media, and outreach",
    icon: "megaphone",
  },
  reports: {
    label: "Reports",
    description: "Analytics and business insights",
    icon: "chart",
  },
  settings: {
    label: "Settings",
    description: "Configuration and customization",
    icon: "settings",
  },
  store: {
    label: "Store",
    description: "Retail, inventory, and POS",
    icon: "shopping",
  },
  staff: {
    label: "Staff",
    description: "Team management and scheduling",
    icon: "users",
  },
  admin: {
    label: "Admin",
    description: "Advanced administration tools",
    icon: "shield",
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

function FeatureCheckbox({
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
    <motion.button
      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg text-left transition-all w-full",
        "border bg-slate-800/20 hover:bg-slate-800/40",
        isChecked
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-slate-700/50 hover:border-slate-600",
      )}
    >
      <div
        className={cn(
          "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
          isChecked ? "bg-emerald-500 text-white" : "border border-slate-600 bg-slate-800/50",
        )}
      >
        {isChecked && <Check className="w-3 h-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", isChecked ? "text-emerald-300" : "text-slate-200")}>
          {feature.label}
        </p>
        <p className="text-xs text-slate-500 truncate">{feature.description}</p>
      </div>
    </motion.button>
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

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      className="border border-slate-700/50 rounded-xl overflow-hidden"
    >
      <button
        onClick={onToggleExpand}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          "hover:bg-slate-800/30",
          isExpanded && "bg-slate-800/20",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              allCompleted ? "bg-emerald-500/20" : "bg-slate-700/50",
            )}
          >
            {allCompleted ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : (
              <CircleDashed className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-medium text-white">{info.label}</h3>
            <p className="text-xs text-slate-500">{info.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span
              className={cn(
                "text-sm font-medium",
                allCompleted ? "text-emerald-400" : "text-slate-400",
              )}
            >
              {completedCount}/{totalCount}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-slate-500 transition-transform",
              isExpanded && "rotate-180",
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
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {features.map((feature) => (
                <FeatureCheckbox
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

export function FeatureDiscovery({
  completedFeatures: initialCompleted,
  onChange,
  onNext,
  onBack,
  onSkip,
}: FeatureDiscoveryProps) {
  const prefersReducedMotion = useReducedMotion();
  const [completedFeatures, setCompletedFeatures] = useState<string[]>(initialCompleted);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<PageCategory>>(
    new Set(["operations"]),
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
          page.keywords.some((k) => k.toLowerCase().includes(query)),
      ),
    );
  }, [searchQuery, pagesByCategory]);

  const toggleFeature = (href: string) => {
    let newCompleted: string[];
    if (completedFeatures.includes(href)) {
      newCompleted = completedFeatures.filter((f) => f !== href);
    } else {
      newCompleted = [...completedFeatures, href];
    }
    setCompletedFeatures(newCompleted);
    onChange(newCompleted);
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
  const progressPercent = Math.round((completedCount / totalFeatures) * 100);

  const handleContinue = () => {
    onChange(completedFeatures);
    onNext();
  };

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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 mb-4">
            <Sparkles className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Explore Your Features</h2>
          <p className="text-slate-400">
            Check off features as you try them. This list stays with you forever.
          </p>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-2"
        >
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Your progress</span>
            <span className="text-emerald-400 font-medium">
              {completedCount} of {totalFeatures} explored
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <BookOpen className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">Your feature checklist:</span> This lives
            in your dashboard at{" "}
            <span className="text-emerald-400 font-mono text-xs">/features</span> so you can track
            which tools you've explored over time.
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features..."
            className="pl-9 bg-slate-800/50 border-slate-700 text-white"
          />
        </motion.div>

        {/* Categories */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 max-h-[400px] overflow-y-auto pr-1"
        >
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
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <CategorySection
                  category={category}
                  features={features}
                  completedFeatures={completedFeatures}
                  onToggle={toggleFeature}
                  isExpanded={expandedCategories.has(category) || !!searchQuery}
                  onToggleExpand={() => toggleCategory(category)}
                />
              </motion.div>
            );
          })}
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
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
            Continue to Launch
            <ChevronRight className="w-5 h-5 ml-2" />
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
              onClick={onSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip for Now
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <p className="text-center text-xs text-slate-500">
            You can always access this checklist from your dashboard
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
