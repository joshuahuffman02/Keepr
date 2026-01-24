"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  ListTodo,
  Clock,
  SkipForward,
  CheckCircle,
  Play,
  Undo2,
} from "lucide-react";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAGE_REGISTRY, type PageDefinition, type PageCategory } from "@/lib/page-registry";
import { useFeatureProgress } from "@/hooks/use-feature-progress";
import { useCampground } from "@/contexts/CampgroundContext";
import Link from "next/link";

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("campreserv:authToken") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
        "border bg-white",
        isChecked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 hover:border-slate-300",
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
          isChecked
            ? "bg-emerald-500 text-white"
            : "border border-slate-300 bg-white hover:border-emerald-400",
        )}
      >
        {isChecked && <Check className="w-3 h-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", isChecked ? "text-emerald-700" : "text-slate-900")}>
          {feature.label}
        </p>
        <p className="text-xs text-slate-500 truncate">{feature.description}</p>
      </div>
      <Link
        href={feature.href}
        className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-slate-100 transition-all"
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
      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
    >
      <button
        onClick={onToggleExpand}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors",
          "hover:bg-slate-50",
          isExpanded && "bg-slate-50",
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              allCompleted ? "bg-emerald-100" : "bg-slate-100",
            )}
          >
            {allCompleted ? (
              <Trophy className="w-5 h-5 text-emerald-600" />
            ) : (
              <Target className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div className="text-left">
            <h3 className="font-medium text-slate-900">{info.label}</h3>
            <p className="text-xs text-slate-500">{info.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Progress bar */}
          <div className="hidden sm:block w-24">
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  allCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-500 to-teal-500",
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              allCompleted ? "text-emerald-600" : "text-slate-500",
            )}
          >
            {completedCount}/{totalCount}
          </span>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-slate-400 transition-transform",
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

// Feature labels for queue items
const FEATURE_LABELS: Record<string, { label: string; path: string }> = {
  seasonal_rates: { label: "Seasonal Rates", path: "/dashboard/settings/seasonal-rates" },
  tax_rules: { label: "Tax Rules", path: "/dashboard/settings/tax-rules" },
  cancellation_policy: { label: "Cancellation Policy", path: "/dashboard/settings/policies" },
  deposit_policy: { label: "Deposit Policy", path: "/dashboard/settings/deposit-policies" },
  team_members: { label: "Team Members", path: "/dashboard/settings/users" },
  staff_scheduling: { label: "Staff Scheduling", path: "/staff-scheduling" },
  time_clock: { label: "Time Clock", path: "/staff/timeclock" },
  store_products: { label: "Store Products", path: "/store/inventory" },
  pos_setup: { label: "POS Setup", path: "/dashboard/settings/pos-integrations" },
  store_categories: { label: "Product Categories", path: "/store/categories" },
  housekeeping: { label: "Housekeeping", path: "/housekeeping" },
  activities: { label: "Activities", path: "/activities" },
  events: { label: "Events", path: "/events" },
  group_bookings: { label: "Group Bookings", path: "/groups" },
  promotions: { label: "Promotions", path: "/dashboard/settings/promotions" },
  email_templates: { label: "Email Templates", path: "/dashboard/settings/communications" },
  email_campaigns: { label: "Email Campaigns", path: "/dashboard/settings/campaigns" },
  branding: { label: "Branding", path: "/dashboard/settings/branding" },
  photos: { label: "Park Photos", path: "/dashboard/settings/photos" },
  upsells: { label: "Upsells & Add-ons", path: "/dashboard/settings/upsells" },
  integrations: { label: "Integrations", path: "/dashboard/settings/integrations" },
};

function getFeatureInfo(key: string): { label: string; path: string } {
  return FEATURE_LABELS[key] || { label: key, path: "/features" };
}

type TabType = "all" | "queue" | "completed";

interface QueueItem {
  id: string;
  featureKey: string;
  status: "setup_now" | "setup_later" | "completed" | "skipped";
  priority: number;
  completedAt: string | null;
  skippedAt: string | null;
}

type QueueResponse = {
  items: QueueItem[];
  setupNowCount: number;
  setupLaterCount: number;
  completedCount: number;
  skippedCount: number;
};

const isTabType = (value: string): value is TabType =>
  value === "all" || value === "queue" || value === "completed";

const isQueueItem = (value: unknown): value is QueueItem =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.featureKey === "string" &&
  (value.status === "setup_now" ||
    value.status === "setup_later" ||
    value.status === "completed" ||
    value.status === "skipped") &&
  typeof value.priority === "number" &&
  (value.completedAt === null || typeof value.completedAt === "string") &&
  (value.skippedAt === null || typeof value.skippedAt === "string");

const isQueueResponse = (value: unknown): value is QueueResponse =>
  isRecord(value) &&
  Array.isArray(value.items) &&
  value.items.every(isQueueItem) &&
  typeof value.setupNowCount === "number" &&
  typeof value.setupLaterCount === "number" &&
  typeof value.completedCount === "number" &&
  typeof value.skippedCount === "number";

function FeaturesPageContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam && isTabType(tabParam) ? tabParam : "all";
  const prefersReducedMotion = useReducedMotion();
  const { progress, stats, isLoading, toggleFeature, reset, isCompleted } = useFeatureProgress();
  const { selectedCampground } = useCampground();
  const campgroundId = selectedCampground?.id;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<PageCategory>>(
    new Set(["operations"]),
  );

  // Fetch queue data
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ["setup-queue-full", campgroundId],
    queryFn: async () => {
      if (!campgroundId) return null;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue`,
        { headers: getAuthHeaders() },
      );
      if (!response.ok) throw new Error("Failed to fetch queue");
      const data = await response.json();
      if (!isQueueResponse(data)) {
        throw new Error("Invalid queue response");
      }
      return data;
    },
    enabled: !!campgroundId && activeTab !== "all",
    staleTime: 30 * 1000,
  });

  // Queue mutations
  const completeMutation = useMutation({
    mutationFn: async (featureKey: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue/${featureKey}/complete`,
        { method: "POST", headers: getAuthHeaders() },
      );
      if (!response.ok) throw new Error("Failed to complete feature");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup-queue-full", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["setup-queue", campgroundId] });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (featureKey: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue/${featureKey}/skip`,
        { method: "POST", headers: getAuthHeaders() },
      );
      if (!response.ok) throw new Error("Failed to skip feature");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup-queue-full", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["setup-queue", campgroundId] });
    },
  });

  const requeueMutation = useMutation({
    mutationFn: async (featureKey: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue/${featureKey}/requeue`,
        { method: "POST", headers: getAuthHeaders() },
      );
      if (!response.ok) throw new Error("Failed to requeue feature");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup-queue-full", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["setup-queue", campgroundId] });
    },
  });

  // Build completed features list from API data
  const completedFeatures = useMemo(
    () => progress.filter((p) => p.completed).map((p) => p.featureKey),
    [progress],
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
  const progressPercent =
    totalFeatures > 0 ? Math.round((completedCount / totalFeatures) * 100) : 0;

  // Queue counts for tab badges
  const pendingQueueCount = queueData ? queueData.setupNowCount + queueData.setupLaterCount : 0;
  const completedQueueCount = queueData?.completedCount || 0;

  // Filter queue items by tab
  const filteredQueueItems = useMemo(() => {
    if (!queueData) return [];
    if (activeTab === "queue") {
      return queueData.items.filter((i) => i.status === "setup_now" || i.status === "setup_later");
    }
    if (activeTab === "completed") {
      return queueData.items.filter((i) => i.status === "completed" || i.status === "skipped");
    }
    return [];
  }, [queueData, activeTab]);

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
              <h1 className="text-2xl font-bold text-slate-900">Feature Discovery</h1>
              <p className="text-slate-500">
                Track your journey through all {totalFeatures} features
              </p>
            </div>
          </div>
          {activeTab === "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => reset()}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Progress
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "all"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Sparkles className="w-4 h-4" />
            All Features
          </button>
          <button
            onClick={() => setActiveTab("queue")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "queue"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <ListTodo className="w-4 h-4" />
            My Queue
            {pendingQueueCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
                {pendingQueueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeTab === "completed"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <CheckCircle className="w-4 h-4" />
            Completed
            {completedQueueCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
                {completedQueueCount}
              </span>
            )}
          </button>
        </div>

        {/* All Features Tab */}
        {activeTab === "all" && (
          <>
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
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No features match your search</p>
              </div>
            )}
          </>
        )}

        {/* Queue Tab */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            {queueLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Loading queue...</p>
              </div>
            ) : filteredQueueItems.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">All caught up!</h3>
                <p className="text-slate-500">No features pending in your queue.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQueueItems.map((item, index) => {
                  const info = getFeatureInfo(item.featureKey);
                  return (
                    <motion.div
                      key={item.id}
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-colors",
                        "bg-white border-slate-200",
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          item.status === "setup_now" ? "bg-emerald-100" : "bg-amber-100",
                        )}
                      >
                        {item.status === "setup_now" ? (
                          <Play className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900">{info.label}</p>
                        <p className="text-sm text-slate-500">
                          {item.status === "setup_now" ? "Set up now" : "Set up later"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={info.path}
                          className="p-2 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Open settings"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => completeMutation.mutate(item.featureKey)}
                          disabled={completeMutation.isPending}
                          className="p-2 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Mark complete"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => skipMutation.mutate(item.featureKey)}
                          disabled={skipMutation.isPending}
                          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Skip"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Completed Tab */}
        {activeTab === "completed" && (
          <div className="space-y-4">
            {queueLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-white rounded-xl border border-slate-200 p-6"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 bg-slate-200 rounded w-48" />
                        <div className="h-4 bg-slate-200 rounded w-full" />
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredQueueItems.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl">
                <ListTodo className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  No completed features yet
                </h3>
                <p className="text-slate-500">Features you complete or skip will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredQueueItems.map((item, index) => {
                  const info = getFeatureInfo(item.featureKey);
                  const isSkipped = item.status === "skipped";
                  return (
                    <motion.div
                      key={item.id}
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-colors",
                        "bg-white border-slate-200",
                        isSkipped && "opacity-60",
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          isSkipped ? "bg-slate-100" : "bg-emerald-100",
                        )}
                      >
                        {isSkipped ? (
                          <SkipForward className="w-5 h-5 text-slate-400" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "font-medium",
                            isSkipped ? "text-slate-500 line-through" : "text-slate-900",
                          )}
                        >
                          {info.label}
                        </p>
                        <p className="text-sm text-slate-500">
                          {isSkipped ? "Skipped" : "Completed"}
                        </p>
                      </div>
                      {isSkipped && (
                        <button
                          onClick={() => requeueMutation.mutate(item.featureKey)}
                          disabled={requeueMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Re-add to queue"
                        >
                          <Undo2 className="w-4 h-4" />
                          Re-queue
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

export default function FeaturesPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-pulse text-muted-foreground">Loading features...</div>
          </div>
        </DashboardShell>
      }
    >
      <FeaturesPageContent />
    </Suspense>
  );
}
