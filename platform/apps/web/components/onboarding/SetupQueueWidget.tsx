"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ListTodo,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  X,
  ExternalLink,
  Sparkles,
  Play,
  SkipForward,
  Calendar,
  Users,
  DollarSign,
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
  Globe,
  Palette,
  Camera,
  Plus,
  Gift,
  Heart,
  Trophy,
  MapPin,
  HelpCircle,
  BarChart3,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("campreserv:authToken")
    : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
  integrations: Settings,
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

// Feature metadata (should match feature-recommendations.ts)
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

function getFeatureIcon(key: string): React.ComponentType<{ className?: string }> {
  return FEATURE_ICONS[key] || Settings;
}

function getFeatureInfo(key: string): { label: string; path: string } {
  return FEATURE_LABELS[key] || { label: key, path: "/features" };
}

interface QueueItem {
  id: string;
  featureKey: string;
  status: "setup_now" | "setup_later" | "completed" | "skipped";
  priority: number;
  completedAt: string | null;
  skippedAt: string | null;
}

interface SetupQueueWidgetProps {
  campgroundId: string;
}

export function SetupQueueWidget({ campgroundId }: SetupQueueWidgetProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const queryClient = useQueryClient();

  // Fetch queue items
  const { data: queueData, isLoading, isError } = useQuery({
    queryKey: ["setup-queue", campgroundId],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue/pending`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch queue");
      return response.json() as Promise<QueueItem[]>;
    },
    enabled: !!campgroundId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Complete feature mutation
  const completeMutation = useMutation({
    mutationFn: async (featureKey: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue/${featureKey}/complete`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to complete feature");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup-queue", campgroundId] });
    },
  });

  // Skip feature mutation
  const skipMutation = useMutation({
    mutationFn: async (featureKey: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${campgroundId}/setup-queue/${featureKey}/skip`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to skip feature");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setup-queue", campgroundId] });
    },
  });

  // Don't render if dismissed, loading, error, or no pending items
  if (isDismissed) return null;
  if (isLoading) return null;
  if (isError) return null;
  if (!queueData || queueData.length === 0) return null;

  const pendingItems = queueData.slice(0, 5); // Show max 5 items
  const hasMore = queueData.length > 5;

  return (
    <motion.div
      className={cn(
        "rounded-2xl border backdrop-blur-sm transition-colors overflow-hidden",
        "bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200",
        "dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-800"
      )}
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
      transition={prefersReducedMotion ? undefined : { type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-4",
          "hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20 transition-colors"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <ListTodo className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">Setup Queue</h3>
            <p className="text-sm text-muted-foreground">
              {queueData.length} feature{queueData.length !== 1 ? "s" : ""} to configure
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            animate={prefersReducedMotion ? {} : { height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {pendingItems.map((item, index) => {
                const FeatureIcon = getFeatureIcon(item.featureKey);
                const featureInfo = getFeatureInfo(item.featureKey);

                return (
                  <motion.div
                    key={item.id}
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                    animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl",
                      "bg-white/60 dark:bg-slate-800/40",
                      "border border-emerald-100 dark:border-emerald-800/50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <FeatureIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {featureInfo.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={featureInfo.path}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                        title="Open settings"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => completeMutation.mutate(item.featureKey)}
                        disabled={completeMutation.isPending}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                        title="Mark complete"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => skipMutation.mutate(item.featureKey)}
                        disabled={skipMutation.isPending}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                        title="Skip"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {hasMore && (
                <Link
                  href="/features?tab=queue"
                  className={cn(
                    "flex items-center justify-center gap-2 p-2.5 rounded-xl text-sm font-medium",
                    "text-emerald-600 dark:text-emerald-400",
                    "hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 transition-colors"
                  )}
                >
                  View all {queueData.length} features
                  <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
