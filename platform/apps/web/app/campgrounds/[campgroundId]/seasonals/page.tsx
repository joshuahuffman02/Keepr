"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { useToast } from "../../../../hooks/use-toast";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Checkbox } from "../../../../components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { Label } from "../../../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { Switch } from "../../../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import {
  Users,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  Search,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Award,
  Calendar,
  MapPin,
  Phone,
  CreditCard,
  Send,
  X,
  ChevronRight,
  ChevronDown,
  Settings,
  RefreshCw,
  Download,
  Sparkles,
  Crown,
  Star,
  Zap,
  PartyPopper,
  Heart,
  Shield,
  FileSignature,
  ClipboardList,
  Timer,
  UserPlus,
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Copy,
  Filter,
  Loader2,
  Check,
  Building,
  Gauge,
  Receipt,
  History,
  Bell,
  Target,
  AlertTriangle,
  TrendingDown,
  Flame,
  Gift,
  Hourglass,
  type LucideIcon,
} from "lucide-react";

// ==================== TYPES ====================

type SeasonalStatus = "active" | "pending_renewal" | "not_renewing" | "departed" | "waitlist";
type RenewalIntent = "committed" | "likely" | "undecided" | "not_renewing";
type PaymentStatus = "current" | "past_due" | "paid_ahead";
type ContractStatus = "signed" | "sent" | "not_sent" | "expired";

interface SeasonalGuest {
  id: string;
  guestId: string;
  guest: {
    id: string;
    primaryFirstName: string;
    primaryLastName: string;
    email: string;
    phone?: string;
  };
  currentSite?: {
    id: string;
    name: string;
    siteNumber?: string;
  };
  currentSiteId?: string;
  status: SeasonalStatus;
  renewalIntent?: RenewalIntent;
  totalSeasons: number;
  firstSeasonYear: number;
  seniorityRank?: number;
  isMetered: boolean;
  paysInFull: boolean;
  notes?: string;
  payments: Array<{
    id: string;
    status: string;
    dueDate: string;
    amount: number;
    paidAt?: string;
  }>;
  pricing: Array<{
    seasonYear: number;
    finalRate: number;
    rateCard?: { name: string };
  }>;
  contracts?: Array<{
    id: string;
    seasonYear: number;
    status: ContractStatus;
    sentAt?: string;
    signedAt?: string;
    expiresAt?: string;
  }>;
  coiExpiresAt?: string;
  coiFileUrl?: string;
}

interface WaitlistEntry {
  id: string;
  guest: {
    id: string;
    primaryFirstName: string;
    primaryLastName: string;
    email: string;
    phone?: string;
  };
  priority: number;
  addedAt: string;
  preferredSites?: string[];
  notes?: string;
  depositPaid?: boolean;
  depositAmount?: number;
}

interface RateCard {
  id: string;
  name: string;
  seasonYear: number;
  baseRate: number;
  billingFrequency: string;
  isDefault: boolean;
  description?: string;
  includedUtilities?: string[];
  discounts?: Array<{ name: string; type: string; value: number }>;
  incentives?: Array<{ name: string; type: string; value: number; deadline?: string }>;
}

interface MessageTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
  channel: "email" | "sms" | "both";
  category: "renewal" | "payment" | "general" | "welcome" | "contract";
}

interface DashboardStats {
  totalSeasonals: number;
  activeSeasonals: number;
  renewalRate: number;
  contractsSigned: number;
  contractsTotal: number;
  paymentsCurrent: number;
  paymentsPastDue: number;
  paymentsPaidAhead: number;
  totalMonthlyRevenue: number;
  averageTenure: number;
  longestTenure: number;
  waitlistCount: number;
  combinedTenureYears: number; // Total years of loyalty across all seasonals
  renewalsByIntent: {
    committed: number;
    likely: number;
    undecided: number;
    not_renewing: number;
  };
  churnRiskGuests: Array<{
    guestId: string;
    guestName: string;
    tenure: number;
    riskLevel: "low" | "medium" | "high";
    renewalIntent: string;
  }>;
  paymentAging: {
    current: number;
    days30: number;
    days60: number;
    days90Plus: number;
  };
  needsAttention: {
    pastDuePayments: number;
    expiringContracts: number;
    expiredInsurance: number;
    pendingRenewals: number;
    unsignedContracts: number;
  };
  milestones: Array<{
    guestId: string;
    guestName: string;
    years: number;
    type: "5year" | "10year" | "15year" | "20year";
  }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && isString(error.message)) return error.message;
  return fallback;
};

const isSeasonalStatus = (value: string): value is SeasonalStatus =>
  value === "active" ||
  value === "pending_renewal" ||
  value === "not_renewing" ||
  value === "departed" ||
  value === "waitlist";

const isRenewalIntent = (value: string): value is RenewalIntent =>
  value === "committed" || value === "likely" || value === "undecided" || value === "not_renewing";

const isSeasonalPayment = (value: unknown): value is SeasonalGuest["payments"][number] =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.status) &&
  isString(value.dueDate) &&
  isNumber(value.amount);

const isSeasonalPricing = (value: unknown): value is SeasonalGuest["pricing"][number] =>
  isRecord(value) && isNumber(value.seasonYear) && isNumber(value.finalRate);

const isSeasonalGuest = (value: unknown): value is SeasonalGuest => {
  if (!isRecord(value)) return false;
  if (!isString(value.id) || !isString(value.guestId)) return false;
  const guest = value.guest;
  const status = value.status;
  const payments = value.payments;
  const pricing = value.pricing;

  if (!isRecord(guest)) return false;
  if (!isString(guest.id)) return false;
  if (!isString(guest.primaryFirstName)) return false;
  if (!isString(guest.primaryLastName)) return false;
  if (!isString(guest.email)) return false;
  if (!isString(status) || !isSeasonalStatus(status)) return false;
  if (!isNumber(value.totalSeasons) || !isNumber(value.firstSeasonYear)) return false;
  if (typeof value.isMetered !== "boolean" || typeof value.paysInFull !== "boolean") return false;
  if (!Array.isArray(payments) || !payments.every(isSeasonalPayment)) return false;
  if (!Array.isArray(pricing) || !pricing.every(isSeasonalPricing)) return false;
  return true;
};

const isSeasonalsResponse = (value: unknown): value is { data: SeasonalGuest[]; total: number } => {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.data) || !value.data.every(isSeasonalGuest)) return false;
  return isNumber(value.total);
};

const isRateCard = (value: unknown): value is RateCard =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isNumber(value.seasonYear) &&
  isNumber(value.baseRate) &&
  isString(value.billingFrequency) &&
  typeof value.isDefault === "boolean";

const isDashboardStats = (value: unknown): value is DashboardStats => {
  if (!isRecord(value)) return false;
  const renewals = value.renewalsByIntent;
  const paymentAging = value.paymentAging;
  const needsAttention = value.needsAttention;
  const churnRiskGuests = value.churnRiskGuests;
  const milestones = value.milestones;
  if (!isRecord(renewals) || !isRecord(paymentAging) || !isRecord(needsAttention)) return false;
  if (!Array.isArray(churnRiskGuests) || !Array.isArray(milestones)) return false;

  const hasNumbers = [
    value.totalSeasonals,
    value.activeSeasonals,
    value.renewalRate,
    value.contractsSigned,
    value.contractsTotal,
    value.paymentsCurrent,
    value.paymentsPastDue,
    value.paymentsPaidAhead,
    value.totalMonthlyRevenue,
    value.averageTenure,
    value.longestTenure,
    value.waitlistCount,
    value.combinedTenureYears,
    renewals.committed,
    renewals.likely,
    renewals.undecided,
    renewals.not_renewing,
    paymentAging.current,
    paymentAging.days30,
    paymentAging.days60,
    paymentAging.days90Plus,
    needsAttention.pastDuePayments,
    needsAttention.expiringContracts,
    needsAttention.expiredInsurance,
    needsAttention.pendingRenewals,
    needsAttention.unsignedContracts,
  ].every(isNumber);

  if (!hasNumbers) return false;

  const churnOk = churnRiskGuests.every(
    (guest) =>
      isRecord(guest) &&
      isString(guest.guestId) &&
      isString(guest.guestName) &&
      isNumber(guest.tenure) &&
      isString(guest.riskLevel) &&
      isString(guest.renewalIntent),
  );

  const milestonesOk = milestones.every(
    (milestone) =>
      isRecord(milestone) &&
      isString(milestone.guestId) &&
      isString(milestone.guestName) &&
      isNumber(milestone.years) &&
      isString(milestone.type),
  );

  return churnOk && milestonesOk;
};

const getFormValue = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
};

// ==================== HELPER COMPONENTS ====================

function StatusBadge({ status }: { status: SeasonalStatus }) {
  const config: Record<SeasonalStatus, { class: string; label: string }> = {
    active: {
      class: "bg-status-success/15 text-status-success border-status-success/20",
      label: "Active",
    },
    pending_renewal: {
      class: "bg-status-warning/15 text-status-warning border-status-warning/20",
      label: "Pending Renewal",
    },
    not_renewing: {
      class: "bg-status-error/15 text-status-error border-status-error/20",
      label: "Not Renewing",
    },
    departed: { class: "bg-muted text-foreground border-border", label: "Departed" },
    waitlist: {
      class: "bg-status-info/15 text-status-info border-status-info/20",
      label: "Waitlist",
    },
  };
  return (
    <Badge variant="outline" className={config[status].class}>
      {config[status].label}
    </Badge>
  );
}

function RenewalIntentBadge({ intent }: { intent?: RenewalIntent }) {
  if (!intent)
    return (
      <Badge variant="outline" className="bg-muted/60 text-muted-foreground">
        Unknown
      </Badge>
    );
  const config: Record<RenewalIntent, { class: string; label: string; icon: LucideIcon }> = {
    committed: {
      class: "bg-status-success/15 text-status-success border-status-success/20",
      label: "Committed",
      icon: CheckCircle,
    },
    likely: {
      class: "bg-status-success/15 text-status-success border-status-success/20",
      label: "Likely",
      icon: TrendingUp,
    },
    undecided: {
      class: "bg-status-warning/15 text-status-warning border-status-warning/20",
      label: "Undecided",
      icon: Clock,
    },
    not_renewing: {
      class: "bg-status-error/15 text-status-error border-status-error/20",
      label: "Not Returning",
      icon: X,
    },
  };
  const Icon = config[intent].icon;
  return (
    <Badge variant="outline" className={config[intent].class}>
      <Icon className="h-3 w-3 mr-1" />
      {config[intent].label}
    </Badge>
  );
}

function PaymentStatusBadge({ seasonal }: { seasonal: SeasonalGuest }) {
  const hasPastDue = seasonal.payments?.some((p) => p.status === "past_due");
  const hasDue = seasonal.payments?.some((p) => p.status === "due" || p.status === "scheduled");

  if (hasPastDue) {
    return (
      <Badge
        variant="outline"
        className="bg-status-error/15 text-status-error border-status-error/20"
      >
        <AlertCircle className="h-3 w-3 mr-1" />
        Past Due
      </Badge>
    );
  }
  if (!hasDue && seasonal.payments?.length > 0) {
    return (
      <Badge variant="outline" className="bg-status-info/15 text-status-info border-status-info/20">
        <Sparkles className="h-3 w-3 mr-1" />
        Paid Ahead
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-status-success/15 text-status-success border-status-success/20"
    >
      <CheckCircle className="h-3 w-3 mr-1" />
      Current
    </Badge>
  );
}

function TenureBadge({
  years,
  showCelebration = false,
}: {
  years: number;
  showCelebration?: boolean;
}) {
  // Legendary: 20+ years
  if (years >= 20) {
    return (
      <Badge
        variant="outline"
        className="bg-status-info/15 text-status-info border-status-info/30 shadow-sm cursor-default"
      >
        <Crown className="h-3 w-3 mr-1" />
        {years} Years - Legend!
        {showCelebration && <PartyPopper className="h-3 w-3 ml-1 animate-bounce" />}
      </Badge>
    );
  }

  // Gold Elite: 15+ years
  if (years >= 15) {
    return (
      <Badge
        variant="outline"
        className="bg-status-warning/15 text-status-warning border-status-warning/30 shadow-sm cursor-default"
      >
        <Crown className="h-3 w-3 mr-1" />
        {years} Years
        {showCelebration && <Sparkles className="h-3 w-3 ml-1" />}
      </Badge>
    );
  }

  // Gold: 10+ years
  if (years >= 10) {
    return (
      <Badge
        variant="outline"
        className="bg-status-warning/10 text-status-warning border-status-warning/20 shadow-sm cursor-default"
      >
        <Award className="h-3 w-3 mr-1" />
        {years} Years
      </Badge>
    );
  }

  // Silver: 5+ years
  if (years >= 5) {
    return (
      <Badge
        variant="outline"
        className="bg-muted text-foreground border-border shadow-sm cursor-default"
      >
        <Star className="h-3 w-3 mr-1" />
        {years} Years
      </Badge>
    );
  }

  // Standard: Under 5 years
  return (
    <Badge variant="outline" className="bg-muted/60 text-foreground border-border cursor-default">
      {years} {years === 1 ? "Year" : "Years"}
    </Badge>
  );
}

// Shimmer animation component - renders styles safely for SSR
function ShimmerStyles() {
  useEffect(() => {
    if (!document.getElementById("tenure-shimmer-styles")) {
      const style = document.createElement("style");
      style.id = "tenure-shimmer-styles";
      style.textContent = `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }
  }, []);
  return null;
}

function ContractStatusBadge({ status }: { status?: ContractStatus }) {
  if (!status)
    return (
      <Badge variant="outline" className="bg-muted/60 text-muted-foreground">
        Not Sent
      </Badge>
    );
  const config: Record<ContractStatus, { class: string; label: string; icon: LucideIcon }> = {
    signed: {
      class: "bg-status-success/15 text-status-success border-status-success/20",
      label: "Signed",
      icon: CheckCircle,
    },
    sent: {
      class: "bg-status-info/15 text-status-info border-status-info/20",
      label: "Sent",
      icon: Send,
    },
    not_sent: {
      class: "bg-muted text-muted-foreground border-border",
      label: "Not Sent",
      icon: FileText,
    },
    expired: {
      class: "bg-status-error/15 text-status-error border-status-error/20",
      label: "Expired",
      icon: AlertCircle,
    },
  };
  const Icon = config[status].icon;
  return (
    <Badge variant="outline" className={config[status].class}>
      <Icon className="h-3 w-3 mr-1" />
      {config[status].label}
    </Badge>
  );
}

// ==================== STAT CARDS ====================

function HeroStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "slate",
  onClick,
  highlight = false,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "emerald" | "amber" | "rose" | "blue" | "purple" | "slate";
  onClick?: () => void;
  highlight?: boolean;
}) {
  const colorClasses = {
    emerald: "text-status-success bg-status-success/15",
    amber: "text-status-warning bg-status-warning/15",
    rose: "text-status-error bg-status-error/15",
    blue: "text-status-info bg-status-info/15",
    purple: "text-accent bg-accent/15",
    slate: "text-muted-foreground bg-muted/60",
  };

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02]" : ""} ${highlight ? "ring-2 ring-status-error/40 shadow-status-error/20" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <p className={`text-2xl font-bold mt-1 ${colorClasses[color].split(" ")[0]}`}>
              {value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <p
                className={`text-xs flex items-center gap-1 mt-1 ${trend.value >= 0 ? "text-status-success" : "text-status-error"}`}
              >
                <TrendingUp className={`h-3 w-3 ${trend.value < 0 ? "rotate-180" : ""}`} />
                {trend.value > 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== CRITICAL ALERTS BANNER ====================

function CriticalAlertsBanner({
  stats,
  onAlertClick,
}: {
  stats: DashboardStats["needsAttention"];
  onAlertClick: (tab: string) => void;
}) {
  const alerts = [
    {
      key: "pastDuePayments",
      count: stats.pastDuePayments,
      label: "Past Due",
      icon: DollarSign,
      color: "rose",
      tab: "payments",
    },
    {
      key: "expiringContracts",
      count: stats.expiringContracts,
      label: "Expiring",
      icon: FileText,
      color: "amber",
      tab: "contracts",
    },
    {
      key: "unsignedContracts",
      count: stats.unsignedContracts,
      label: "Unsigned",
      icon: FileSignature,
      color: "orange",
      tab: "contracts",
    },
    {
      key: "pendingRenewals",
      count: stats.pendingRenewals,
      label: "Undecided",
      icon: RefreshCw,
      color: "blue",
      tab: "renewals",
    },
    {
      key: "expiredInsurance",
      count: stats.expiredInsurance,
      label: "COI Expired",
      icon: Shield,
      color: "purple",
      tab: "contracts",
    },
  ].filter((a) => a.count > 0);

  if (alerts.length === 0) {
    return (
      <div className="bg-status-success/10 border border-status-success/20 rounded-xl p-4 flex items-center justify-center gap-3">
        <div className="p-2 bg-status-success/15 rounded-full">
          <CheckCircle className="h-5 w-5 text-status-success" />
        </div>
        <div>
          <p className="font-medium text-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground">No urgent items need attention</p>
        </div>
        <PartyPopper className="h-5 w-5 text-status-success ml-2" />
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    rose: "bg-status-error/15 text-status-error border-status-error/20 hover:bg-status-error/25",
    amber:
      "bg-status-warning/15 text-status-warning border-status-warning/20 hover:bg-status-warning/25",
    orange:
      "bg-status-warning/15 text-status-warning border-status-warning/20 hover:bg-status-warning/25",
    blue: "bg-status-info/15 text-status-info border-status-info/20 hover:bg-status-info/25",
    purple: "bg-status-error/15 text-status-error border-status-error/20 hover:bg-status-error/25",
  };

  return (
    <div className="bg-muted/60 border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Needs Attention</span>
        <Badge variant="secondary" className="bg-muted text-foreground">
          {alerts.reduce((sum, a) => sum + a.count, 0)}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {alerts.map((alert) => {
          const Icon = alert.icon;
          return (
            <button
              key={alert.key}
              onClick={() => onAlertClick(alert.tab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${colorMap[alert.color]}`}
            >
              <Icon className="h-4 w-4" />
              <span>{alert.count}</span>
              <span>{alert.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== MILESTONES CELEBRATION ====================

function MilestonesCelebration({ milestones }: { milestones: DashboardStats["milestones"] }) {
  if (!milestones?.length) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case "20year":
        return Crown;
      case "15year":
        return Crown;
      case "10year":
        return Award;
      case "5year":
        return Star;
      default:
        return Star;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "20year":
        return "bg-status-info/15 text-status-info border border-status-info/30";
      case "15year":
        return "bg-status-warning/15 text-status-warning border border-status-warning/30";
      case "10year":
        return "bg-status-warning/10 text-status-warning border border-status-warning/20";
      case "5year":
        return "bg-muted text-foreground border border-border";
      default:
        return "bg-muted/60 text-muted-foreground border border-border";
    }
  };

  const getAnimation = (type: string, index: number) => {
    const baseDelay = index * 0.1;
    switch (type) {
      case "20year":
        return { animationDelay: `${baseDelay}s`, animation: "pulse 2s infinite" };
      case "15year":
        return { animationDelay: `${baseDelay}s` };
      default:
        return { animationDelay: `${baseDelay}s` };
    }
  };

  const getShadow = (type: string) => {
    switch (type) {
      case "20year":
        return "shadow-lg shadow-status-info/20";
      case "15year":
        return "shadow-md shadow-status-warning/20";
      case "10year":
        return "shadow-sm shadow-status-warning/10";
      default:
        return "shadow-sm";
    }
  };

  return (
    <Card className="bg-status-warning/10 border-status-warning/20 overflow-hidden relative">
      {/* Subtle celebration sparkles */}
      <div className="absolute top-2 right-2 opacity-50">
        <Sparkles className="h-5 w-5 text-status-warning animate-pulse" />
      </div>
      <div className="absolute bottom-2 left-2 opacity-30">
        <Star
          className="h-4 w-4 text-status-warning animate-pulse"
          style={{ animationDelay: "0.5s" }}
        />
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-status-warning">
          <PartyPopper className="h-4 w-4 animate-bounce" style={{ animationDuration: "2s" }} />
          Tenure Milestones This Season
          <Badge variant="secondary" className="bg-status-warning/15 text-status-warning text-xs">
            {milestones.length} celebration{milestones.length !== 1 ? "s" : ""}!
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {milestones.slice(0, 5).map((m, i) => {
            const Icon = getIcon(m.type);
            const animStyle = getAnimation(m.type, i);
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getColor(m.type)} ${getShadow(m.type)} hover:scale-105 transition-transform cursor-default`}
                style={animStyle}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>
                  {m.guestName} - {m.years} yrs
                </span>
              </div>
            );
          })}
        </div>
        {milestones.length > 5 && (
          <p className="text-xs text-status-warning mt-2 flex items-center gap-1">
            <Gift className="h-3 w-3" />+{milestones.length - 5} more milestone
            {milestones.length - 5 !== 1 ? "s" : ""} to celebrate!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== RENEWAL PROGRESS ====================

function RenewalProgressCard({ stats }: { stats: DashboardStats["renewalsByIntent"] }) {
  const total = Object.values(stats).reduce((sum, v) => sum + v, 0);
  if (total === 0) return null;

  const segments = [
    { key: "committed", value: stats.committed, color: "bg-status-success", label: "Committed" },
    { key: "likely", value: stats.likely, color: "bg-status-success/70", label: "Likely" },
    { key: "undecided", value: stats.undecided, color: "bg-status-warning", label: "Undecided" },
    {
      key: "not_renewing",
      value: stats.not_renewing,
      color: "bg-status-error",
      label: "Not Returning",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Renewal Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-3 rounded-full bg-muted overflow-hidden flex mb-3">
          {segments.map((seg) => (
            <div
              key={seg.key}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${(seg.value / total) * 100}%` }}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center gap-2 text-sm">
              <div className={`w-3 h-3 rounded-full ${seg.color}`} />
              <span className="text-muted-foreground">{seg.label}</span>
              <span className="font-semibold ml-auto">{seg.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== CHURN RISK CARD ====================

function ChurnRiskCard({ guests }: { guests: DashboardStats["churnRiskGuests"] }) {
  if (!guests?.length) return null;

  const riskColors = {
    high: "bg-status-error/15 text-status-error border-status-error/30",
    medium: "bg-status-warning/15 text-status-warning border-status-warning/20",
    low: "bg-muted text-muted-foreground border-border",
  };

  const riskIcons = {
    high: Flame,
    medium: AlertTriangle,
    low: TrendingDown,
  };

  return (
    <Card className="border-status-error/30 bg-status-error/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-status-error">
          <AlertTriangle className="h-4 w-4" />
          Churn Risk - Attention Needed
        </CardTitle>
        <CardDescription className="text-status-error text-xs">
          Long-tenured guests who haven&apos;t committed to renewal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {guests.slice(0, 5).map((guest) => {
            const Icon = riskIcons[guest.riskLevel];
            return (
              <div
                key={guest.guestId}
                className="flex items-center justify-between p-2 rounded-lg bg-card/80 border border-border"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={riskColors[guest.riskLevel]}>
                    <Icon className="h-3 w-3 mr-1" />
                    {guest.riskLevel.toUpperCase()}
                  </Badge>
                  <span className="font-medium text-sm">{guest.guestName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-status-warning" />
                  {guest.tenure} years
                </div>
              </div>
            );
          })}
        </div>
        {guests.length > 5 && (
          <p className="text-xs text-status-error mt-2 text-center">
            +{guests.length - 5} more at risk
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ==================== COMMUNITY STATS CARD ====================

function CommunityStatsCard({ stats }: { stats: DashboardStats }) {
  return (
    <Card className="border-status-info/20 bg-status-info/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-status-info">
          <Heart className="h-4 w-4" />
          Your Seasonal Family
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-2">
          <div className="text-4xl font-bold text-foreground mb-1">{stats.combinedTenureYears}</div>
          <div className="text-sm text-muted-foreground">combined years of loyalty</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">{stats.activeSeasonals}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">{stats.averageTenure}yr</div>
            <div className="text-xs text-muted-foreground">Avg Tenure</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-foreground">{stats.longestTenure}yr</div>
            <div className="text-xs text-muted-foreground">Longest</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== PAYMENT AGING CARD ====================

function PaymentAgingCard({ aging }: { aging: DashboardStats["paymentAging"] }) {
  const total = aging.current + aging.days30 + aging.days60 + aging.days90Plus;
  if (total === 0) return null;

  const segments = [
    {
      key: "current",
      value: aging.current,
      color: "bg-status-success",
      label: "< 30 days",
      textColor: "text-status-success",
    },
    {
      key: "days30",
      value: aging.days30,
      color: "bg-status-warning/70",
      label: "30-59 days",
      textColor: "text-status-warning",
    },
    {
      key: "days60",
      value: aging.days60,
      color: "bg-status-warning",
      label: "60-89 days",
      textColor: "text-status-warning",
    },
    {
      key: "days90Plus",
      value: aging.days90Plus,
      color: "bg-status-error",
      label: "90+ days",
      textColor: "text-status-error",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-status-warning" />
          Past Due Aging
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-3 rounded-full bg-muted overflow-hidden flex mb-3">
          {segments.map((seg) => (
            <div
              key={seg.key}
              className={`${seg.color} transition-all duration-500`}
              style={{ width: `${total > 0 ? (seg.value / total) * 100 : 0}%` }}
            />
          ))}
        </div>
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2">
          {segments
            .filter((s) => s.value > 0)
            .map((seg) => (
              <div key={seg.key} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${seg.color}`} />
                <span className={seg.textColor}>{seg.label}</span>
                <span className="font-semibold ml-auto">{seg.value}</span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== RENEWAL DEADLINE COUNTDOWN ====================

function RenewalDeadlineCountdown({ deadline }: { deadline?: Date }) {
  // Default to March 1 of next year if no deadline set
  const renewalDeadline = deadline || new Date(new Date().getFullYear() + 1, 2, 1);
  const daysUntil = differenceInDays(renewalDeadline, new Date());
  const isUrgent = daysUntil <= 14;
  const isSoon = daysUntil <= 30;

  return (
    <Card
      className={`${isUrgent ? "border-status-error/30 bg-status-error/10" : isSoon ? "border-status-warning/30 bg-status-warning/15" : "border-status-info/30 bg-status-info/15"}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-full ${isUrgent ? "bg-status-error/15" : isSoon ? "bg-status-warning/15" : "bg-status-info/15"}`}
            >
              <Timer
                className={`h-5 w-5 ${isUrgent ? "text-status-error" : isSoon ? "text-status-warning" : "text-status-info"}`}
              />
            </div>
            <div>
              <p
                className={`text-sm font-medium ${isUrgent ? "text-status-error" : isSoon ? "text-status-warning" : "text-status-info"}`}
              >
                Renewal Deadline
              </p>
              <p className="text-xs text-muted-foreground">
                {format(renewalDeadline, "MMMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-2xl font-bold ${isUrgent ? "text-status-error" : isSoon ? "text-status-warning" : "text-status-info"}`}
            >
              {daysUntil}
            </div>
            <div className="text-xs text-muted-foreground">days left</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== FLOATING ACTION PANEL ====================

function FloatingActionPanel({
  selectedCount,
  onSendMessage,
  onBulkUpdate,
  onSendContracts,
  onRecordPayment,
  onExport,
  onClear,
}: {
  selectedCount: number;
  onSendMessage: () => void;
  onBulkUpdate: (action: string) => void;
  onSendContracts: () => void;
  onRecordPayment: () => void;
  onExport: () => void;
  onClear: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="shadow-2xl border-border bg-card/95 backdrop-blur">
        <CardContent className="p-3 flex flex-wrap items-center gap-2 md:gap-3">
          <Badge className="bg-status-info text-white px-3 py-1">{selectedCount} selected</Badge>
          <div className="h-6 w-px bg-border hidden md:block" />

          {/* Message */}
          <Button size="sm" onClick={onSendMessage}>
            <Send className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Message</span>
          </Button>

          {/* Renewal Intent Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <RefreshCw className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Renewal</span>
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onBulkUpdate("committed")}>
                <CheckCircle className="h-4 w-4 mr-2 text-status-success" />
                Mark Committed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdate("likely")}>
                <TrendingUp className="h-4 w-4 mr-2 text-status-success" />
                Mark Likely
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onBulkUpdate("undecided")}>
                <Clock className="h-4 w-4 mr-2 text-status-warning" />
                Mark Undecided
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onBulkUpdate("not_renewing")}
                className="text-status-error"
              >
                <X className="h-4 w-4 mr-2" />
                Mark Not Returning
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Contracts */}
          <Button size="sm" variant="outline" onClick={onSendContracts}>
            <FileSignature className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Contracts</span>
          </Button>

          {/* Record Payment */}
          <Button size="sm" variant="outline" onClick={onRecordPayment}>
            <CreditCard className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Payment</span>
          </Button>

          {/* Export */}
          <Button size="sm" variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Clear */}
          <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SEASONAL ROW ====================

function SeasonalRow({
  seasonal,
  isSelected,
  onSelect,
  onQuickAction,
  onViewDetails,
}: {
  seasonal: SeasonalGuest;
  isSelected: boolean;
  onSelect: () => void;
  onQuickAction: (action: string, value?: string) => void;
  onViewDetails: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const currentContract = seasonal.contracts?.find(
    (c) => c.seasonYear === new Date().getFullYear(),
  );

  return (
    <div
      className={`border rounded-lg transition-all duration-200 ${isSelected ? "ring-2 ring-primary/40 bg-primary/5" : "hover:shadow-md bg-card"}`}
    >
      {/* Mobile Card View */}
      <div className="md:hidden p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect()}
              className="mt-1"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${seasonal.guest.primaryFirstName} ${seasonal.guest.primaryLastName}`}
            />
            {/* Avatar with tenure indicator */}
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-medium text-lg ${
                  seasonal.totalSeasons >= 10
                    ? "bg-status-warning/15 text-status-warning"
                    : seasonal.totalSeasons >= 5
                      ? "bg-muted text-foreground"
                      : "bg-status-info/15 text-status-info"
                }`}
              >
                {seasonal.guest.primaryFirstName[0]}
                {seasonal.guest.primaryLastName[0]}
              </div>
              {seasonal.seniorityRank && seasonal.seniorityRank <= 3 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-status-warning rounded-full flex items-center justify-center text-status-warning-foreground text-xs font-bold shadow">
                  {seasonal.seniorityRank}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <TenureBadge years={seasonal.totalSeasons} />
                {seasonal.currentSite && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {seasonal.currentSite.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? "Collapse guest details" : "Expand guest details"}
            aria-expanded={expanded}
            aria-controls={`seasonal-details-mobile-${seasonal.id}`}
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </Button>
        </div>

        {/* Mobile Status Badges - Stacked */}
        <div className="flex flex-wrap gap-2 pl-9">
          <StatusBadge status={seasonal.status} />
          <RenewalIntentBadge intent={seasonal.renewalIntent} />
          <PaymentStatusBadge seasonal={seasonal} />
          <ContractStatusBadge status={currentContract?.status} />
        </div>

        {/* Mobile Expanded */}
        {expanded && (
          <div id={`seasonal-details-mobile-${seasonal.id}`} className="space-y-3 pt-3 border-t">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Email</p>
                <p className="font-medium truncate">{seasonal.guest.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Phone</p>
                <p className="font-medium">{seasonal.guest.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Rate</p>
                <p className="font-medium">
                  ${seasonal.pricing?.[0]?.finalRate?.toLocaleString() || "—"}/mo
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Since</p>
                <p className="font-medium">{seasonal.firstSeasonYear}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" className="flex-1" onClick={() => onQuickAction("message")}>
                <Mail className="h-4 w-4 mr-1" />
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onQuickAction("payment")}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Payment
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onQuickAction("contract")}
              >
                <FileSignature className="h-4 w-4 mr-1" />
                Contract
              </Button>
              {seasonal.renewalIntent !== "committed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-status-success border-status-success/20 hover:bg-status-success/10"
                  onClick={() => onQuickAction("renewal", "committed")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Committed
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop Row View */}
      <div className="hidden md:block">
        <div className="p-4 flex items-center gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelect()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${seasonal.guest.primaryFirstName} ${seasonal.guest.primaryLastName}`}
          />

          {/* Avatar with tenure indicator */}
          <div className="relative">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center font-medium ${
                seasonal.totalSeasons >= 10
                  ? "bg-status-warning/15 text-status-warning"
                  : seasonal.totalSeasons >= 5
                    ? "bg-muted text-foreground"
                    : "bg-status-info/15 text-status-info"
              }`}
            >
              {seasonal.guest.primaryFirstName[0]}
              {seasonal.guest.primaryLastName[0]}
            </div>
            {seasonal.seniorityRank && seasonal.seniorityRank <= 3 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-status-warning rounded-full flex items-center justify-center text-status-warning-foreground text-xs font-bold shadow">
                {seasonal.seniorityRank}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
            <div className="flex items-center gap-2 flex-wrap cursor-pointer">
              <span className="font-medium text-foreground">
                {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
              </span>
              <TenureBadge years={seasonal.totalSeasons} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
              {seasonal.currentSite && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {seasonal.currentSite.name}
                </span>
              )}
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <Mail className="h-3 w-3 flex-shrink-0" />
                {seasonal.guest.email}
              </span>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={seasonal.status} />
            <RenewalIntentBadge intent={seasonal.renewalIntent} />
            <PaymentStatusBadge seasonal={seasonal} />
            <ContractStatusBadge status={currentContract?.status} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? "Collapse guest details" : "Expand guest details"}
              aria-expanded={expanded}
              aria-controls={`seasonal-details-${seasonal.id}`}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onViewDetails}
              aria-label="View guest details"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Desktop Expanded Details */}
        {expanded && (
          <div
            id={`seasonal-details-${seasonal.id}`}
            className="px-4 pb-4 pt-0 border-t bg-muted/60/50"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Phone</p>
                <p className="text-sm font-medium">{seasonal.guest.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Current Rate
                </p>
                <p className="text-sm font-medium">
                  ${seasonal.pricing?.[0]?.finalRate?.toLocaleString() || "—"}/mo
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing</p>
                <p className="text-sm font-medium">
                  {seasonal.paysInFull ? "Paid in Full" : "Monthly"} •{" "}
                  {seasonal.isMetered ? "Metered" : "Flat Rate"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Member Since
                </p>
                <p className="text-sm font-medium">{seasonal.firstSeasonYear}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button size="sm" variant="outline" onClick={() => onQuickAction("message")}>
                <Mail className="h-4 w-4 mr-1" />
                Message
              </Button>
              <Button size="sm" variant="outline" onClick={() => onQuickAction("payment")}>
                <CreditCard className="h-4 w-4 mr-1" />
                Record Payment
              </Button>
              <Button size="sm" variant="outline" onClick={() => onQuickAction("contract")}>
                <FileSignature className="h-4 w-4 mr-1" />
                Send Contract
              </Button>
              {seasonal.renewalIntent !== "committed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-status-success hover:bg-status-success/10"
                  onClick={() => onQuickAction("renewal", "committed")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Committed
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== WAITLIST ROW ====================

function WaitlistRow({
  entry,
  onContact,
  onConvert,
  onRemove,
}: {
  entry: WaitlistEntry;
  onContact: () => void;
  onConvert: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-status-info/15 flex items-center justify-center text-status-info font-bold text-sm">
          #{entry.priority}
        </div>
        <div className="w-10 h-10 rounded-full bg-status-info/15 flex items-center justify-center text-status-info font-medium">
          {entry.guest.primaryFirstName[0]}
          {entry.guest.primaryLastName[0]}
        </div>
        <div className="flex-1">
          <p className="font-medium">
            {entry.guest.primaryFirstName} {entry.guest.primaryLastName}
          </p>
          <p className="text-sm text-muted-foreground">
            Added {formatDistanceToNow(new Date(entry.addedAt), { addSuffix: true })}
            {entry.preferredSites?.length ? ` • Prefers: ${entry.preferredSites.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entry.depositPaid && (
            <Badge className="bg-status-success/15 text-status-success">
              <DollarSign className="h-3 w-3 mr-1" />
              Deposit Paid
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onContact}
            aria-label="Contact waitlist guest"
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onConvert}>
            <UserPlus className="h-4 w-4 mr-1" />
            Convert
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={onRemove}
            aria-label="Remove from waitlist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ==================== RATE CARD COMPONENT ====================

function RateCardDisplay({
  rateCard,
  onEdit,
  onDuplicate,
}: {
  rateCard: RateCard;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  return (
    <Card className={rateCard.isDefault ? "ring-2 ring-primary/40" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{rateCard.name}</CardTitle>
            {rateCard.isDefault && (
              <Badge className="bg-status-info/15 text-status-info">Default</Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit rate card">
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDuplicate}
              aria-label="Duplicate rate card"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{rateCard.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">
              ${rateCard.baseRate.toLocaleString()}
            </span>
            <span className="text-muted-foreground">/{rateCard.billingFrequency}</span>
          </div>

          {(rateCard.includedUtilities?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Included</p>
              <div className="flex flex-wrap gap-1">
                {rateCard.includedUtilities?.map((u) => (
                  <Badge key={u} variant="secondary" className="text-xs">
                    {u}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {(rateCard.discounts?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Discounts
              </p>
              <div className="space-y-1">
                {rateCard.discounts?.map((d, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-status-success" />
                    <span>{d.name}</span>
                    <span className="text-status-success font-medium ml-auto">
                      -{d.type === "percentage" ? `${d.value}%` : `$${d.value}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(rateCard.incentives?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Incentives
              </p>
              <div className="space-y-1">
                {rateCard.incentives?.map((inc, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Zap className="h-3 w-3 text-status-warning" />
                    <span>{inc.name}</span>
                    {inc.deadline && (
                      <span className="text-xs text-muted-foreground">
                        by {format(new Date(inc.deadline), "MMM d")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== MESSAGE TEMPLATE ====================

function MessageTemplateCard({
  template,
  onUse,
  onEdit,
}: {
  template: MessageTemplate;
  onUse: () => void;
  onEdit: () => void;
}) {
  const categoryColors: Record<string, string> = {
    renewal: "bg-status-info/15 text-status-info",
    payment: "bg-status-success/15 text-status-success",
    general: "bg-muted text-foreground",
    welcome: "bg-accent/15 text-accent",
    contract: "bg-status-warning/15 text-status-warning",
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium">{template.name}</p>
            <Badge
              variant="secondary"
              className={categoryColors[template.category] || categoryColors.general}
            >
              {template.category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {template.channel === "both" ? "Email & SMS" : template.channel.toUpperCase()}
            </Badge>
          </div>
          {template.subject && (
            <p className="text-sm text-muted-foreground mb-1">{template.subject}</p>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">{template.body}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" onClick={onUse}>
            Use
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Edit message template">
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ==================== MAIN PAGE COMPONENT ====================

export default function SeasonalsPage() {
  const params = useParams<{ campgroundId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const campgroundId = params.campgroundId;
  const currentYear = new Date().getFullYear();

  // State
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SeasonalStatus | "all">("all");
  const [renewalFilter, setRenewalFilter] = useState<RenewalIntent | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRateCardModal, setShowRateCardModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("check");
  const [messageChannel, setMessageChannel] = useState<"email" | "sms">("email");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedSeasonal, setSelectedSeasonal] = useState<SeasonalGuest | null>(null);
  const [seasonYear, setSeasonYear] = useState(currentYear);

  // Helper to get auth headers for API calls (includes campground scope)
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("campreserv:authToken");
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    // Include campground ID for ScopeGuard
    if (campgroundId) headers["x-campground-id"] = campgroundId;
    return headers;
  }, [campgroundId]);

  // Debounced search - waits 300ms after typing stops before querying
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Queries
  const statsQuery = useQuery({
    queryKey: ["seasonal-stats", campgroundId, seasonYear],
    queryFn: async () => {
      const response = await fetch(
        `/api/seasonals/campground/${campgroundId}/stats?seasonYear=${seasonYear}`,
        { credentials: "include", headers: getAuthHeaders() },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Seasonals Stats] API error:", response.status, errorData);
        throw new Error(errorData.message || `Stats API failed: ${response.status}`);
      }
      const data = await response.json();
      if (!isDashboardStats(data)) {
        throw new Error("Invalid seasonal stats response");
      }
      return data;
    },
    enabled: !!campgroundId,
  });

  const seasonalsQuery = useQuery({
    queryKey: [
      "seasonals",
      campgroundId,
      statusFilter,
      renewalFilter,
      paymentFilter,
      debouncedSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (renewalFilter !== "all") params.set("renewalIntent", renewalFilter);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(
        `/api/seasonals/campground/${campgroundId}?${params.toString()}`,
        { credentials: "include", headers: getAuthHeaders() },
      );
      if (!response.ok) {
        return { data: [], total: 0 };
      }
      const data = await response.json();
      if (!isSeasonalsResponse(data)) {
        return { data: [], total: 0 };
      }
      return data;
    },
    enabled: !!campgroundId,
  });

  const waitlistQuery = useQuery({
    queryKey: ["waitlist", campgroundId],
    queryFn: async () => {
      // Mock data - replace with actual API
      const emptyWaitlist: WaitlistEntry[] = [];
      return emptyWaitlist;
    },
    enabled: !!campgroundId,
  });

  const rateCardsQuery = useQuery({
    queryKey: ["rate-cards", campgroundId, seasonYear],
    queryFn: async () => {
      const response = await fetch(
        `/api/seasonals/campground/${campgroundId}/rate-cards?seasonYear=${seasonYear}`,
        { credentials: "include", headers: getAuthHeaders() },
      );
      if (!response.ok) return [];
      const data = await response.json();
      if (!Array.isArray(data)) return [];
      return data.filter(isRateCard);
    },
    enabled: !!campgroundId,
  });

  const templatesQuery = useQuery({
    queryKey: ["message-templates", campgroundId],
    queryFn: async () => {
      // Mock data - replace with actual API
      const templates: MessageTemplate[] = [
        {
          id: "1",
          name: "Renewal Reminder",
          subject: "It's time to renew for {{year}}!",
          body: "Hi {{first_name}}, we're excited to invite you back...",
          channel: "email",
          category: "renewal",
        },
        {
          id: "2",
          name: "Payment Due",
          subject: "Payment reminder",
          body: "Hi {{first_name}}, just a friendly reminder that your payment of {{amount}} is due...",
          channel: "email",
          category: "payment",
        },
        {
          id: "3",
          name: "Welcome Back",
          subject: "Welcome back to the park!",
          body: "Hi {{first_name}}, we're thrilled to have you back for another season...",
          channel: "email",
          category: "welcome",
        },
      ];
      return templates;
    },
    enabled: !!campgroundId,
  });

  // Mutations
  const updateRenewalMutation = useMutation({
    mutationFn: async ({
      id,
      intent,
      notes,
    }: {
      id: string;
      intent: RenewalIntent;
      notes?: string;
    }) => {
      const response = await fetch(`/api/seasonals/${id}/renewal-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ intent, notes }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(error.message || "Failed to update renewal intent");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["seasonals", campgroundId] });
      queryClient.invalidateQueries({ queryKey: ["seasonal-stats", campgroundId] });
      const intentLabels: Record<RenewalIntent, string> = {
        committed: "Committed",
        likely: "Likely",
        undecided: "Undecided",
        not_renewing: "Not Renewing",
      };
      toast({
        title: "Renewal intent updated",
        description: `Guest marked as "${intentLabels[variables.intent]}"`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/seasonals/messages/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          campgroundId,
          seasonalGuestIds: selectedIds,
          channel: messageChannel,
          subject: messageSubject,
          body: messageBody,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(error.message || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      setShowMessageModal(false);
      setSelectedIds([]);
      setMessageSubject("");
      setMessageBody("");
      toast({
        title: "Messages sent!",
        description: `Successfully sent ${messageChannel === "email" ? "emails" : "SMS"} to ${selectedIds.length} guest${selectedIds.length !== 1 ? "s" : ""}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send messages",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Provide fallback stats to prevent crashes when API fails
  const emptyStats: DashboardStats = {
    totalSeasonals: 0,
    activeSeasonals: 0,
    renewalRate: 0,
    contractsSigned: 0,
    contractsTotal: 0,
    paymentsCurrent: 0,
    paymentsPastDue: 0,
    paymentsPaidAhead: 0,
    totalMonthlyRevenue: 0,
    averageTenure: 0,
    longestTenure: 0,
    waitlistCount: 0,
    combinedTenureYears: 0,
    renewalsByIntent: { committed: 0, likely: 0, undecided: 0, not_renewing: 0 },
    churnRiskGuests: [],
    paymentAging: { current: 0, days30: 0, days60: 0, days90Plus: 0 },
    needsAttention: {
      pastDuePayments: 0,
      expiringContracts: 0,
      expiredInsurance: 0,
      pendingRenewals: 0,
      unsignedContracts: 0,
    },
    milestones: [],
  };
  const stats = statsQuery.data || emptyStats;
  const seasonals = seasonalsQuery.data?.data || [];
  const waitlist = waitlistQuery.data || [];
  const rateCards = rateCardsQuery.data || [];
  const templates = templatesQuery.data || [];
  const bulkSelectState =
    seasonals.length === 0
      ? false
      : selectedIds.length === seasonals.length
        ? true
        : selectedIds.length > 0
          ? "indeterminate"
          : false;

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === seasonals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(seasonals.map((s) => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleQuickAction = (seasonal: SeasonalGuest, action: string, value?: string) => {
    if (action === "message") {
      setSelectedIds([seasonal.id]);
      setShowMessageModal(true);
    } else if (action === "renewal" && value && isRenewalIntent(value)) {
      updateRenewalMutation.mutate({ id: seasonal.id, intent: value });
    } else if (action === "payment") {
      setSelectedSeasonal(seasonal);
      setShowPaymentModal(true);
    }
  };

  const handleBulkUpdate = (action: string) => {
    if (isRenewalIntent(action)) {
      const count = selectedIds.length;
      selectedIds.forEach((id) => {
        updateRenewalMutation.mutate({ id, intent: action });
      });
      toast({
        title: "Updating renewal status...",
        description: `Marking ${count} guest${count !== 1 ? "s" : ""} as ${action.replace("_", " ")}`,
      });
    }
    setSelectedIds([]);
  };

  return (
    <DashboardShell>
      <ShimmerStyles />
      <div className="space-y-4">
        <Breadcrumbs
          items={[
            { label: "Campgrounds", href: "/campgrounds?all=true" },
            { label: "Campground", href: `/campgrounds/${campgroundId}` },
            { label: "Seasonals" },
          ]}
        />

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              Seasonal Guests
              <Badge variant="secondary" className="text-lg">
                {stats?.totalSeasonals || 0}
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Long-term campers with seasonal agreements (not individual reservations)
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              <Select
                value={String(seasonYear)}
                onValueChange={(value) => setSeasonYear(Number(value))}
              >
                <SelectTrigger
                  className="h-auto border-0 bg-transparent p-0 text-sm font-medium text-foreground shadow-none focus:ring-0 focus:ring-offset-0 hover:text-foreground"
                  aria-label="Season year"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y} Season
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            <Button size="sm" asChild>
              <a href={`/campgrounds/${campgroundId}/seasonals/new`}>
                <Plus className="h-4 w-4 mr-1" />
                Add Seasonal
              </a>
            </Button>
          </div>
        </div>

        {/* Stats API Error Banner */}
        {statsQuery.isError && (
          <div className="bg-status-warning/10 border border-status-warning/20 rounded-lg p-3 flex items-center gap-2 text-status-warning">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">
              Unable to load stats. Check browser console for details.
              {statsQuery.error instanceof Error && `: ${statsQuery.error.message}`}
            </span>
          </div>
        )}

        {/* Critical Alerts */}
        {stats && (
          <CriticalAlertsBanner
            stats={stats.needsAttention}
            onAlertClick={(tab) => setActiveTab(tab)}
          />
        )}

        {/* Hero Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <HeroStatCard
              title="Active"
              value={stats.activeSeasonals}
              icon={Users}
              color="blue"
              onClick={() => {
                setStatusFilter("active");
                setActiveTab("all");
              }}
            />
            <HeroStatCard
              title="Renewal Rate"
              value={`${stats.renewalRate}%`}
              subtitle={`${stats.contractsSigned}/${stats.contractsTotal} signed`}
              icon={TrendingUp}
              color="emerald"
              trend={{ value: 5, label: "vs last year" }}
            />
            <HeroStatCard
              title="Monthly Revenue"
              value={`$${stats.totalMonthlyRevenue.toLocaleString()}`}
              icon={DollarSign}
              color="purple"
            />
            <HeroStatCard
              title="Past Due"
              value={stats.paymentsPastDue}
              icon={AlertCircle}
              color="rose"
              highlight={stats.paymentsPastDue > 0}
              onClick={() => {
                setPaymentFilter("past_due");
                setActiveTab("payments");
              }}
            />
            <HeroStatCard
              title="Avg Tenure"
              value={`${stats.averageTenure} yrs`}
              subtitle={`Longest: ${stats.longestTenure} yrs`}
              icon={Award}
              color="amber"
            />
            <HeroStatCard
              title="Waitlist"
              value={stats.waitlistCount}
              icon={Clock}
              color="slate"
              onClick={() => setActiveTab("waitlist")}
            />
          </div>
        )}

        {/* Renewal Deadline Countdown */}
        {stats && <RenewalDeadlineCountdown />}

        {/* Milestones, Renewal Progress, Community Stats, and Churn Risk */}
        {stats && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MilestonesCelebration milestones={stats.milestones} />
            <RenewalProgressCard stats={stats.renewalsByIntent} />
            <CommunityStatsCard stats={stats} />
            {stats.churnRiskGuests?.length > 0 && <ChurnRiskCard guests={stats.churnRiskGuests} />}
            {stats.paymentAging && <PaymentAgingCard aging={stats.paymentAging} />}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="bg-muted">
              <TabsTrigger value="all" className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="renewals" className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Renewals
                {(stats?.needsAttention?.pendingRenewals ?? 0) > 0 && (
                  <Badge className="ml-1 bg-status-warning text-status-warning-foreground text-xs px-1.5">
                    {stats?.needsAttention?.pendingRenewals}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Payments
                {(stats?.needsAttention?.pastDuePayments ?? 0) > 0 && (
                  <Badge className="ml-1 bg-status-error text-status-error-foreground text-xs px-1.5">
                    {stats?.needsAttention?.pastDuePayments}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="contracts" className="flex items-center gap-1.5">
                <FileSignature className="h-4 w-4" />
                Contracts
              </TabsTrigger>
              <TabsTrigger value="waitlist" className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Waitlist
                {(stats?.waitlistCount ?? 0) > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                    {stats?.waitlistCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center gap-1.5">
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
              <TabsTrigger value="comms" className="flex items-center gap-1.5">
                <Mail className="h-4 w-4" />
                Comms
              </TabsTrigger>
            </TabsList>

            {/* Search & Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search guests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  aria-label="Search seasonal guests"
                />
              </div>
              {(activeTab === "all" || activeTab === "renewals" || activeTab === "payments") && (
                <>
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      if (value === "all" || isSeasonalStatus(value)) {
                        setStatusFilter(value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-[160px] text-sm" aria-label="Filter by status">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                      <SelectItem value="not_renewing">Not Renewing</SelectItem>
                      <SelectItem value="waitlist">Waitlist</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={renewalFilter}
                    onValueChange={(value) => {
                      if (value === "all" || isRenewalIntent(value)) {
                        setRenewalFilter(value);
                      }
                    }}
                  >
                    <SelectTrigger
                      className="h-9 w-[160px] text-sm"
                      aria-label="Filter by renewal intent"
                    >
                      <SelectValue placeholder="All Renewal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Renewal</SelectItem>
                      <SelectItem value="committed">Committed</SelectItem>
                      <SelectItem value="likely">Likely</SelectItem>
                      <SelectItem value="undecided">Undecided</SelectItem>
                      <SelectItem value="not_renewing">Not Returning</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </div>

          {/* TAB: ALL SEASONALS */}
          <TabsContent value="all" className="space-y-4">
            {/* Bulk select */}
            <div className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={bulkSelectState}
                onCheckedChange={() => toggleSelectAll()}
                aria-label="Select all seasonal guests"
              />
              <span className="text-muted-foreground">
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected`
                  : `${seasonals.length} seasonal guests`}
              </span>
            </div>

            {seasonalsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : seasonals.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">No seasonal guests found</p>
                <Button size="sm" asChild>
                  <a href={`/campgrounds/${campgroundId}/seasonals/new`}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Seasonal
                  </a>
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {seasonals.map((seasonal) => (
                  <SeasonalRow
                    key={seasonal.id}
                    seasonal={seasonal}
                    isSelected={selectedIds.includes(seasonal.id)}
                    onSelect={() => toggleSelect(seasonal.id)}
                    onQuickAction={(action, value) => handleQuickAction(seasonal, action, value)}
                    onViewDetails={() => setSelectedSeasonal(seasonal)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB: RENEWALS */}
          <TabsContent value="renewals" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <Card
                className="p-4 bg-status-success/15 border-status-success/20 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setRenewalFilter("committed")}
              >
                <div className="text-3xl font-bold text-status-success">
                  {stats?.renewalsByIntent.committed || 0}
                </div>
                <div className="text-sm text-status-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Committed
                </div>
              </Card>
              <Card
                className="p-4 bg-status-success/15 border-status-success/20 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setRenewalFilter("likely")}
              >
                <div className="text-3xl font-bold text-status-success">
                  {stats?.renewalsByIntent.likely || 0}
                </div>
                <div className="text-sm text-status-success flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" /> Likely
                </div>
              </Card>
              <Card
                className="p-4 bg-status-warning/15 border-status-warning/20 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setRenewalFilter("undecided")}
              >
                <div className="text-3xl font-bold text-status-warning">
                  {stats?.renewalsByIntent.undecided || 0}
                </div>
                <div className="text-sm text-status-warning flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Undecided
                </div>
              </Card>
              <Card
                className="p-4 bg-status-error/10 border-status-error/20 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setRenewalFilter("not_renewing")}
              >
                <div className="text-3xl font-bold text-status-error">
                  {stats?.renewalsByIntent.not_renewing || 0}
                </div>
                <div className="text-sm text-status-error flex items-center gap-1">
                  <X className="h-4 w-4" /> Not Returning
                </div>
              </Card>
            </div>

            {/* Undecided guests needing follow-up */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-status-warning" />
                  Need Follow-Up
                </CardTitle>
                <CardDescription>Guests who haven't committed to returning yet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {seasonals
                  .filter((s) => !s.renewalIntent || s.renewalIntent === "undecided")
                  .slice(0, 10)
                  .map((seasonal) => (
                    <div
                      key={seasonal.id}
                      className="flex items-center justify-between p-3 bg-muted/60 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-status-warning/15 flex items-center justify-center text-status-warning font-medium text-sm">
                          {seasonal.guest.primaryFirstName[0]}
                          {seasonal.guest.primaryLastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">
                            {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {seasonal.totalSeasons} years at {seasonal.currentSite?.name || "TBD"}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedIds([seasonal.id]);
                            setShowMessageModal(true);
                          }}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          Message
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-status-success hover:bg-status-success/10"
                          onClick={() =>
                            updateRenewalMutation.mutate({ id: seasonal.id, intent: "committed" })
                          }
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Committed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-status-error hover:bg-status-error/10"
                          onClick={() =>
                            updateRenewalMutation.mutate({
                              id: seasonal.id,
                              intent: "not_renewing",
                            })
                          }
                        >
                          <X className="h-4 w-4 mr-1" />
                          Not Returning
                        </Button>
                      </div>
                    </div>
                  ))}
                {seasonals.filter((s) => !s.renewalIntent || s.renewalIntent === "undecided")
                  .length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 text-status-success mx-auto mb-2" />
                    All guests have responded!
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: PAYMENTS */}
          <TabsContent value="payments" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4 bg-status-success/15 border-status-success/20">
                <div className="text-3xl font-bold text-status-success">
                  {stats?.paymentsCurrent || 0}
                </div>
                <div className="text-sm text-status-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Current
                </div>
              </Card>
              <Card className="p-4 bg-status-error/10 border-status-error/20">
                <div className="text-3xl font-bold text-status-error">
                  {stats?.paymentsPastDue || 0}
                </div>
                <div className="text-sm text-status-error flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Past Due
                </div>
              </Card>
              <Card className="p-4 bg-status-info/10 border-status-info/20">
                <div className="text-3xl font-bold text-status-info">
                  {stats?.paymentsPaidAhead || 0}
                </div>
                <div className="text-sm text-status-info flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> Paid Ahead
                </div>
              </Card>
            </div>

            {/* Past due list */}
            <Card>
              <CardHeader className="bg-status-error/10 border-b border-status-error/20">
                <CardTitle className="text-lg flex items-center gap-2 text-status-error">
                  <AlertCircle className="h-5 w-5" />
                  Past Due Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {seasonals
                  .filter((s) => s.payments?.some((p) => p.status === "past_due"))
                  .map((seasonal) => {
                    const pastDue = seasonal.payments.find((p) => p.status === "past_due");
                    const daysOverdue = pastDue
                      ? differenceInDays(new Date(), new Date(pastDue.dueDate))
                      : 0;
                    return (
                      <div
                        key={seasonal.id}
                        className="flex items-center justify-between p-3 bg-status-error/5 border border-status-error/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-status-error/15 flex items-center justify-center text-status-error font-medium text-sm">
                            {seasonal.guest.primaryFirstName[0]}
                            {seasonal.guest.primaryLastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">
                              {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              ${pastDue?.amount.toLocaleString()} due{" "}
                              {pastDue?.dueDate && format(new Date(pastDue.dueDate), "MMM d")}
                              <span className="text-status-error ml-2">
                                ({daysOverdue} days overdue)
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedIds([seasonal.id]);
                              setShowMessageModal(true);
                              setMessageSubject("Payment Reminder");
                            }}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Remind
                          </Button>
                          <Button size="sm">
                            <CreditCard className="h-4 w-4 mr-1" />
                            Record Payment
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                {!seasonals.some((s) => s.payments?.some((p) => p.status === "past_due")) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 text-status-success mx-auto mb-2" />
                    No past due payments!
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: CONTRACTS */}
          <TabsContent value="contracts" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Current Season ({currentYear})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-status-success transition-all"
                          style={{
                            width: `${stats ? (stats.contractsSigned / stats.contractsTotal) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-lg font-bold">
                      {stats?.contractsSigned || 0}/{stats?.contractsTotal || 0}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">contracts signed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Next Season ({currentYear + 1})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-status-info transition-all"
                          style={{ width: "25%" }}
                        />
                      </div>
                    </div>
                    <span className="text-lg font-bold">22/88</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">contracts signed</p>
                </CardContent>
              </Card>
            </div>

            {/* Unsigned/Expiring contracts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-status-warning" />
                  Needs Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {seasonals
                  .filter((s) => {
                    const contract = s.contracts?.find((c) => c.seasonYear === currentYear);
                    return !contract || contract.status !== "signed";
                  })
                  .slice(0, 10)
                  .map((seasonal) => {
                    const contract = seasonal.contracts?.find((c) => c.seasonYear === currentYear);
                    return (
                      <div
                        key={seasonal.id}
                        className="flex items-center justify-between p-3 bg-muted/60 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-sm">
                            {seasonal.guest.primaryFirstName[0]}
                            {seasonal.guest.primaryLastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">
                              {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {contract?.status === "sent"
                                ? `Sent ${contract.sentAt && formatDistanceToNow(new Date(contract.sentAt), { addSuffix: true })}`
                                : "Not sent"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <ContractStatusBadge status={contract?.status} />
                          <Button size="sm" variant="outline">
                            {contract?.status === "sent" ? "Resend" : "Send Contract"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>

            {/* COI Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Insurance (COI) Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  Contact support to enable certificate of insurance tracking
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: WAITLIST */}
          <TabsContent value="waitlist" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Waitlist Queue</h3>
                <p className="text-sm text-muted-foreground">
                  {waitlist.length} on waitlist • Est. {3} spots available next season
                </p>
              </div>
              <Button>
                <UserPlus className="h-4 w-4 mr-1" />
                Add to Waitlist
              </Button>
            </div>

            {waitlist.length === 0 ? (
              <Card className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-3">No one on the waitlist yet</p>
                <Button size="sm">
                  <UserPlus className="h-4 w-4 mr-1" />
                  Add First Guest
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {waitlist.map((entry) => (
                  <WaitlistRow
                    key={entry.id}
                    entry={entry}
                    onContact={() => {}}
                    onConvert={() => {}}
                    onRemove={() => {}}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB: CONFIG */}
          <TabsContent value="config" className="space-y-6">
            {/* Season Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Season Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="season-start">Season Start</Label>
                    <Input
                      id="season-start"
                      type="date"
                      defaultValue="2025-04-15"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="season-end">Season End</Label>
                    <Input id="season-end" type="date" defaultValue="2025-10-15" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="renewal-deadline">Renewal Deadline</Label>
                    <Input
                      id="renewal-deadline"
                      type="date"
                      defaultValue="2025-03-01"
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Rate Cards
                </h3>
                <Button onClick={() => setShowRateCardModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Rate Card
                </Button>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rateCards.length === 0 ? (
                  <Card className="col-span-full p-8 text-center">
                    <Receipt className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No rate cards yet</p>
                    <Button size="sm" className="mt-3" onClick={() => setShowRateCardModal(true)}>
                      Create First Rate Card
                    </Button>
                  </Card>
                ) : (
                  rateCards.map((rc) => (
                    <RateCardDisplay
                      key={rc.id}
                      rateCard={rc}
                      onEdit={() => {}}
                      onDuplicate={() => {}}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Payment Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-status-success" />
                  Payment Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="billing-frequency">Default Billing Frequency</Label>
                    <Select defaultValue="monthly">
                      <SelectTrigger id="billing-frequency" className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="seasonal">Seasonal (Full)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="payment-due-day">Payment Due Day</Label>
                    <Select defaultValue="1">
                      <SelectTrigger id="payment-due-day" className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st of month</SelectItem>
                        <SelectItem value="15">15th of month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="late-fee-amount">Late Fee</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        id="late-fee-amount"
                        type="number"
                        defaultValue="25"
                        className="w-20"
                      />
                      <Select defaultValue="flat">
                        <SelectTrigger className="flex-1" aria-label="Late fee type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat fee</SelectItem>
                          <SelectItem value="percent">Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: COMMS */}
          <TabsContent value="comms" className="space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Compose Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5 text-primary" />
                    Send Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="comms-recipients">Recipients</Label>
                    <Select defaultValue="all">
                      <SelectTrigger id="comms-recipients" className="w-full mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          All Seasonals ({stats?.totalSeasonals || 0})
                        </SelectItem>
                        <SelectItem value="committed">
                          Committed ({stats?.renewalsByIntent.committed || 0})
                        </SelectItem>
                        <SelectItem value="undecided">
                          Undecided ({stats?.renewalsByIntent.undecided || 0})
                        </SelectItem>
                        <SelectItem value="past_due">
                          Past Due Payments ({stats?.paymentsPastDue || 0})
                        </SelectItem>
                        <SelectItem value="selected">Selected ({selectedIds.length})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label id="comms-channel-label">Channel</Label>
                    <div
                      className="flex gap-2 mt-1"
                      role="group"
                      aria-labelledby="comms-channel-label"
                    >
                      <Button
                        variant={messageChannel === "email" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMessageChannel("email")}
                        aria-pressed={messageChannel === "email"}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Button>
                      <Button
                        variant={messageChannel === "sms" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMessageChannel("sms")}
                        aria-pressed={messageChannel === "sms"}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        SMS
                      </Button>
                    </div>
                  </div>
                  {messageChannel === "email" && (
                    <div>
                      <Label htmlFor="comms-subject">Subject</Label>
                      <Input
                        id="comms-subject"
                        value={messageSubject}
                        onChange={(e) => setMessageSubject(e.target.value)}
                        placeholder="Message subject..."
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="comms-message">Message</Label>
                    <Textarea
                      id="comms-message"
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Hi {{first_name}}, ..."
                      rows={5}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Tokens: {"{{first_name}}"}, {"{{last_name}}"}, {"{{site}}"},{" "}
                      {"{{tenure_years}}"}, {"{{amount_due}}"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">
                      Preview
                    </Button>
                    <Button className="flex-1" disabled={!messageBody}>
                      <Send className="h-4 w-4 mr-1" />
                      Send Message
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Templates */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Message Templates</h3>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    New Template
                  </Button>
                </div>
                {templates.map((template) => (
                  <MessageTemplateCard
                    key={template.id}
                    template={template}
                    onUse={() => {
                      setMessageSubject(template.subject || "");
                      setMessageBody(template.body);
                      setMessageChannel(template.channel === "both" ? "email" : template.channel);
                    }}
                    onEdit={() => {}}
                  />
                ))}
              </div>
            </div>

            {/* Message History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  Recent Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  Message history will appear here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Panel */}
      <FloatingActionPanel
        selectedCount={selectedIds.length}
        onSendMessage={() => setShowMessageModal(true)}
        onBulkUpdate={handleBulkUpdate}
        onSendContracts={async () => {
          try {
            const response = await fetch("/api/seasonals/contracts/bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...getAuthHeaders() },
              credentials: "include",
              body: JSON.stringify({
                seasonalGuestIds: selectedIds,
                campgroundId,
              }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Failed to send contracts");
            toast({
              title: "Contracts sent",
              description: `Sent ${result.sent} contract${result.sent !== 1 ? "s" : ""}${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
            });
            setSelectedIds([]);
          } catch (err: unknown) {
            toast({
              title: "Error",
              description: getErrorMessage(err, "Failed to send contracts"),
              variant: "destructive",
            });
          }
        }}
        onRecordPayment={() => {
          setShowPaymentModal(true);
        }}
        onExport={async () => {
          try {
            const params = new URLSearchParams({ ids: selectedIds.join(",") });
            const response = await fetch(
              `/api/seasonals/campground/${campgroundId}/export?${params}`,
              {
                credentials: "include",
                headers: getAuthHeaders(),
              },
            );
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Failed to export");

            // Trigger download
            const blob = new Blob([result.content], { type: "text/csv" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            toast({
              title: "Export complete",
              description: `Exported ${result.count} seasonal guest${result.count !== 1 ? "s" : ""} to CSV`,
            });
          } catch (err: unknown) {
            toast({
              title: "Error",
              description: getErrorMessage(err, "Failed to export"),
              variant: "destructive",
            });
          }
        }}
        onClear={() => setSelectedIds([])}
      />

      {/* Message Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Send Message to {selectedIds.length} Guest{selectedIds.length !== 1 ? "s" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={messageChannel === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageChannel("email")}
                aria-pressed={messageChannel === "email"}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button
                variant={messageChannel === "sms" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageChannel("sms")}
                aria-pressed={messageChannel === "sms"}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                SMS
              </Button>
            </div>

            {messageChannel === "email" && (
              <div>
                <Label htmlFor="bulk-message-subject">Subject</Label>
                <Input
                  id="bulk-message-subject"
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="Message subject..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="bulk-message-body">Message</Label>
              <Textarea
                id="bulk-message-body"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Hi {{first_name}}, ..."
                rows={5}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tokens: {"{{first_name}}"}, {"{{last_name}}"}, {"{{site}}"}, {"{{tenure_years}}"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={!messageBody || sendMessageMutation.isPending}
              onClick={() => sendMessageMutation.mutate()}
            >
              {sendMessageMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" /> Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Record Payment for {selectedIds.length} Guest{selectedIds.length !== 1 ? "s" : ""}
            </DialogTitle>
            <DialogDescription>
              Enter payment details to record for all selected guests.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const amountValue = getFormValue(formData, "amount");
              if (!amountValue) {
                toast({
                  title: "Error",
                  description: "Amount is required",
                  variant: "destructive",
                });
                return;
              }
              const amount = Number.parseFloat(amountValue);
              if (Number.isNaN(amount)) {
                toast({
                  title: "Error",
                  description: "Amount must be a number",
                  variant: "destructive",
                });
                return;
              }
              const amountCents = Math.round(amount * 100);
              const method = getFormValue(formData, "method") ?? paymentMethod;
              const note = getFormValue(formData, "note");

              try {
                const response = await fetch("/api/seasonals/payments/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                  credentials: "include",
                  body: JSON.stringify({
                    seasonalGuestIds: selectedIds,
                    amountCents,
                    method,
                    note: note || undefined,
                  }),
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message || "Failed to record payments");
                toast({
                  title: "Payments recorded",
                  description: `Recorded ${result.recorded} payment${result.recorded !== 1 ? "s" : ""}${result.failed > 0 ? `, ${result.failed} failed` : ""}`,
                });
                setShowPaymentModal(false);
                setSelectedIds([]);
                queryClient.invalidateQueries({ queryKey: ["seasonals"] });
              } catch (err: unknown) {
                toast({
                  title: "Error",
                  description: getErrorMessage(err, "Failed to record payments"),
                  variant: "destructive",
                });
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="method">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="method" className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="ach">ACH/Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <input type="hidden" name="method" value={paymentMethod} />
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" name="note" placeholder="e.g., Check #1234" className="mt-1" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <CreditCard className="h-4 w-4 mr-1" />
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
