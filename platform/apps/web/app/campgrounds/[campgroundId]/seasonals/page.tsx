"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "../../../../hooks/use-toast";
import { DashboardShell } from "../../../../components/ui/layout/DashboardShell";
import { Breadcrumbs } from "../../../../components/breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { Label } from "../../../../components/ui/label";
import { Switch } from "../../../../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../../../../components/ui/dialog";
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

// ==================== HELPER COMPONENTS ====================

function StatusBadge({ status }: { status: SeasonalStatus }) {
  const config: Record<SeasonalStatus, { class: string; label: string }> = {
    active: { class: "bg-status-success/15 text-status-success border-status-success/20", label: "Active" },
    pending_renewal: { class: "bg-status-warning/15 text-status-warning border-status-warning/20", label: "Pending Renewal" },
    not_renewing: { class: "bg-rose-100 text-rose-700 border-rose-200", label: "Not Renewing" },
    departed: { class: "bg-slate-100 text-slate-700 border-slate-200", label: "Departed" },
    waitlist: { class: "bg-status-info/15 text-status-info border-status-info/20", label: "Waitlist" },
  };
  return (
    <Badge variant="outline" className={config[status].class}>
      {config[status].label}
    </Badge>
  );
}

function RenewalIntentBadge({ intent }: { intent?: RenewalIntent }) {
  if (!intent) return <Badge variant="outline" className="bg-slate-50 text-slate-500">Unknown</Badge>;
  const config: Record<RenewalIntent, { class: string; label: string; icon: any }> = {
    committed: { class: "bg-status-success/15 text-status-success border-status-success/20", label: "Committed", icon: CheckCircle },
    likely: { class: "bg-status-success/15 text-status-success border-status-success/20", label: "Likely", icon: TrendingUp },
    undecided: { class: "bg-status-warning/15 text-status-warning border-status-warning/20", label: "Undecided", icon: Clock },
    not_renewing: { class: "bg-rose-100 text-rose-700 border-rose-200", label: "Not Returning", icon: X },
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
      <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200">
        <AlertCircle className="h-3 w-3 mr-1" />
        Past Due
      </Badge>
    );
  }
  if (!hasDue && seasonal.payments?.length > 0) {
    return (
      <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-200">
        <Sparkles className="h-3 w-3 mr-1" />
        Paid Ahead
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-status-success/15 text-status-success border-status-success/20">
      <CheckCircle className="h-3 w-3 mr-1" />
      Current
    </Badge>
  );
}

function TenureBadge({ years, showCelebration = false }: { years: number; showCelebration?: boolean }) {
  // Legendary: 20+ years - rainbow shimmer with glow
  if (years >= 20) {
    return (
      <Badge
        className="relative overflow-hidden bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white border-0 shadow-lg shadow-purple-300/50 animate-pulse hover:scale-110 transition-transform cursor-default"
        style={{
          animation: "pulse 2s infinite, shimmer 3s infinite",
        }}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
          style={{
            animation: "shimmer 2s infinite",
            backgroundSize: "200% 100%",
          }}
        />
        <Crown className="h-3 w-3 mr-1 relative z-10" />
        <span className="relative z-10">{years} Years - Legend!</span>
        {showCelebration && <PartyPopper className="h-3 w-3 ml-1 relative z-10 animate-bounce" />}
      </Badge>
    );
  }

  // Gold Elite: 15+ years - gold shimmer
  if (years >= 15) {
    return (
      <Badge
        className="relative overflow-hidden bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-white border-0 shadow-md shadow-amber-300/50 hover:scale-105 transition-transform cursor-default"
      >
        <span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          style={{
            animation: "shimmer 2.5s infinite",
            backgroundSize: "200% 100%",
          }}
        />
        <Crown className="h-3 w-3 mr-1 relative z-10" />
        <span className="relative z-10">{years} Years</span>
        {showCelebration && <Sparkles className="h-3 w-3 ml-1 relative z-10" />}
      </Badge>
    );
  }

  // Gold: 10+ years - subtle gold shine
  if (years >= 10) {
    return (
      <Badge
        className="relative overflow-hidden bg-gradient-to-r from-amber-400 to-yellow-500 text-white border-0 shadow-sm hover:scale-105 transition-transform cursor-default"
      >
        <span
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{
            animation: "shimmer 3s infinite",
            backgroundSize: "200% 100%",
          }}
        />
        <Award className="h-3 w-3 mr-1 relative z-10" />
        <span className="relative z-10">{years} Years</span>
      </Badge>
    );
  }

  // Silver: 5+ years - subtle silver effect
  if (years >= 5) {
    return (
      <Badge className="bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 hover:scale-105 transition-transform cursor-default">
        <Star className="h-3 w-3 mr-1" />
        {years} Years
      </Badge>
    );
  }

  // Standard: Under 5 years
  return (
    <Badge variant="outline" className="bg-slate-50 hover:bg-slate-100 transition-colors cursor-default">
      {years} {years === 1 ? "Year" : "Years"}
    </Badge>
  );
}

// Shimmer animation component - renders styles safely for SSR
function ShimmerStyles() {
  useEffect(() => {
    if (!document.getElementById('tenure-shimmer-styles')) {
      const style = document.createElement('style');
      style.id = 'tenure-shimmer-styles';
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
  if (!status) return <Badge variant="outline" className="bg-slate-50 text-slate-500">Not Sent</Badge>;
  const config: Record<ContractStatus, { class: string; label: string; icon: any }> = {
    signed: { class: "bg-status-success/15 text-status-success border-status-success/20", label: "Signed", icon: CheckCircle },
    sent: { class: "bg-status-info/15 text-status-info border-status-info/20", label: "Sent", icon: Send },
    not_sent: { class: "bg-slate-100 text-slate-500 border-slate-200", label: "Not Sent", icon: FileText },
    expired: { class: "bg-rose-100 text-rose-700 border-rose-200", label: "Expired", icon: AlertCircle },
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
  icon: any;
  trend?: { value: number; label: string };
  color?: "emerald" | "amber" | "rose" | "blue" | "purple" | "slate";
  onClick?: () => void;
  highlight?: boolean;
}) {
  const colorClasses = {
    emerald: "text-status-success bg-status-success/15",
    amber: "text-status-warning bg-status-warning/15",
    rose: "text-rose-600 bg-rose-50",
    blue: "text-status-info bg-status-info/15",
    purple: "text-purple-600 bg-purple-50",
    slate: "text-slate-600 bg-slate-50",
  };

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-200 ${onClick ? "cursor-pointer hover:shadow-md hover:scale-[1.02]" : ""} ${highlight ? "ring-2 ring-amber-400 shadow-amber-100" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClasses[color].split(" ")[0]}`}>{value}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            {trend && (
              <p className={`text-xs flex items-center gap-1 mt-1 ${trend.value >= 0 ? "text-status-success" : "text-rose-600"}`}>
                <TrendingUp className={`h-3 w-3 ${trend.value < 0 ? "rotate-180" : ""}`} />
                {trend.value > 0 ? "+" : ""}{trend.value}% {trend.label}
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
  onAlertClick
}: {
  stats: DashboardStats["needsAttention"];
  onAlertClick: (tab: string) => void;
}) {
  const alerts = [
    { key: "pastDuePayments", count: stats.pastDuePayments, label: "Past Due", icon: DollarSign, color: "rose", tab: "payments" },
    { key: "expiringContracts", count: stats.expiringContracts, label: "Expiring", icon: FileText, color: "amber", tab: "contracts" },
    { key: "unsignedContracts", count: stats.unsignedContracts, label: "Unsigned", icon: FileSignature, color: "orange", tab: "contracts" },
    { key: "pendingRenewals", count: stats.pendingRenewals, label: "Undecided", icon: RefreshCw, color: "blue", tab: "renewals" },
    { key: "expiredInsurance", count: stats.expiredInsurance, label: "COI Expired", icon: Shield, color: "purple", tab: "contracts" },
  ].filter(a => a.count > 0);

  if (alerts.length === 0) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-status-success/20 rounded-xl p-4 flex items-center justify-center gap-3">
        <div className="p-2 bg-status-success/15 rounded-full">
          <CheckCircle className="h-5 w-5 text-status-success" />
        </div>
        <div>
          <p className="font-medium text-emerald-800">All caught up!</p>
          <p className="text-sm text-status-success">No urgent items need attention</p>
        </div>
        <PartyPopper className="h-5 w-5 text-emerald-500 ml-2" />
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    rose: "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200",
    amber: "bg-status-warning/15 text-status-warning border-status-warning/20 hover:bg-status-warning/25",
    orange: "bg-status-warning/15 text-status-warning border-status-warning/20 hover:bg-status-warning/25",
    blue: "bg-status-info/15 text-status-info border-status-info/20 hover:bg-status-info/25",
    purple: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200",
  };

  return (
    <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-600">Needs Attention</span>
        <Badge variant="secondary" className="bg-slate-200 text-slate-700">
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
      case "20year": return Crown;
      case "15year": return Crown;
      case "10year": return Award;
      case "5year": return Star;
      default: return Star;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case "20year": return "from-purple-500 via-pink-500 to-rose-500";
      case "15year": return "from-amber-400 via-yellow-400 to-amber-500";
      case "10year": return "from-amber-400 to-yellow-500";
      case "5year": return "from-slate-400 to-slate-500";
      default: return "from-slate-300 to-slate-400";
    }
  };

  const getAnimation = (type: string, index: number) => {
    const baseDelay = index * 0.1;
    switch (type) {
      case "20year": return { animationDelay: `${baseDelay}s`, animation: "pulse 2s infinite" };
      case "15year": return { animationDelay: `${baseDelay}s` };
      default: return { animationDelay: `${baseDelay}s` };
    }
  };

  const getShadow = (type: string) => {
    switch (type) {
      case "20year": return "shadow-lg shadow-purple-300/50";
      case "15year": return "shadow-md shadow-amber-300/50";
      case "10year": return "shadow-sm shadow-amber-200/50";
      default: return "shadow-sm";
    }
  };

  return (
    <Card className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-200 overflow-hidden relative">
      {/* Subtle celebration sparkles */}
      <div className="absolute top-2 right-2 opacity-50">
        <Sparkles className="h-5 w-5 text-amber-400 animate-pulse" />
      </div>
      <div className="absolute bottom-2 left-2 opacity-30">
        <Star className="h-4 w-4 text-amber-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
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
                className={`relative overflow-hidden flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r ${getColor(m.type)} text-white rounded-full text-sm font-medium ${getShadow(m.type)} hover:scale-105 transition-transform cursor-default`}
                style={animStyle}
              >
                {/* Shimmer overlay for top milestones */}
                {(m.type === "20year" || m.type === "15year") && (
                  <span
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    style={{
                      animation: "shimmer 2.5s infinite",
                      backgroundSize: "200% 100%",
                    }}
                  />
                )}
                <Icon className="h-3.5 w-3.5 relative z-10" />
                <span className="relative z-10">{m.guestName} - {m.years} yrs</span>
              </div>
            );
          })}
        </div>
        {milestones.length > 5 && (
          <p className="text-xs text-status-warning mt-2 flex items-center gap-1">
            <Gift className="h-3 w-3" />
            +{milestones.length - 5} more milestone{milestones.length - 5 !== 1 ? "s" : ""} to celebrate!
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
    { key: "committed", value: stats.committed, color: "bg-emerald-500", label: "Committed" },
    { key: "likely", value: stats.likely, color: "bg-green-400", label: "Likely" },
    { key: "undecided", value: stats.undecided, color: "bg-amber-400", label: "Undecided" },
    { key: "not_renewing", value: stats.not_renewing, color: "bg-rose-400", label: "Not Returning" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-blue-600" />
          Renewal Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex mb-3">
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
              <span className="text-slate-600">{seg.label}</span>
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
    high: "bg-rose-100 text-rose-700 border-rose-200",
    medium: "bg-status-warning/15 text-status-warning border-status-warning/20",
    low: "bg-slate-100 text-slate-600 border-slate-200",
  };

  const riskIcons = {
    high: Flame,
    medium: AlertTriangle,
    low: TrendingDown,
  };

  return (
    <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-rose-800">
          <AlertTriangle className="h-4 w-4" />
          Churn Risk - Attention Needed
        </CardTitle>
        <CardDescription className="text-rose-600 text-xs">
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
                className="flex items-center justify-between p-2 rounded-lg bg-white/60 border border-rose-100"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={riskColors[guest.riskLevel]}>
                    <Icon className="h-3 w-3 mr-1" />
                    {guest.riskLevel.toUpperCase()}
                  </Badge>
                  <span className="font-medium text-sm">{guest.guestName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Award className="h-3.5 w-3.5 text-amber-500" />
                  {guest.tenure} years
                </div>
              </div>
            );
          })}
        </div>
        {guests.length > 5 && (
          <p className="text-xs text-rose-600 mt-2 text-center">
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
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-purple-800">
          <Heart className="h-4 w-4" />
          Your Seasonal Family
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-2">
          <div className="text-4xl font-bold text-purple-700 mb-1">
            {stats.combinedTenureYears}
          </div>
          <div className="text-sm text-purple-600">combined years of loyalty</div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-purple-100">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-700">{stats.activeSeasonals}</div>
            <div className="text-xs text-slate-500">Active</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-700">{stats.averageTenure}yr</div>
            <div className="text-xs text-slate-500">Avg Tenure</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-700">{stats.longestTenure}yr</div>
            <div className="text-xs text-slate-500">Longest</div>
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
    { key: "current", value: aging.current, color: "bg-emerald-500", label: "< 30 days", textColor: "text-status-success" },
    { key: "days30", value: aging.days30, color: "bg-amber-500", label: "30-59 days", textColor: "text-status-warning" },
    { key: "days60", value: aging.days60, color: "bg-orange-500", label: "60-89 days", textColor: "text-status-warning" },
    { key: "days90Plus", value: aging.days90Plus, color: "bg-rose-600", label: "90+ days", textColor: "text-rose-700" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Hourglass className="h-4 w-4 text-amber-600" />
          Past Due Aging
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex mb-3">
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
          {segments.filter(s => s.value > 0).map((seg) => (
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
    <Card className={`${isUrgent ? 'border-rose-300 bg-rose-50' : isSoon ? 'border-status-warning/30 bg-status-warning/15' : 'border-status-info/30 bg-status-info/15'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isUrgent ? 'bg-rose-100' : isSoon ? 'bg-status-warning/15' : 'bg-status-info/15'}`}>
              <Timer className={`h-5 w-5 ${isUrgent ? 'text-rose-600' : isSoon ? 'text-status-warning' : 'text-status-info'}`} />
            </div>
            <div>
              <p className={`text-sm font-medium ${isUrgent ? 'text-rose-800' : isSoon ? 'text-status-warning' : 'text-status-info'}`}>
                Renewal Deadline
              </p>
              <p className="text-xs text-slate-500">
                {format(renewalDeadline, "MMMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${isUrgent ? 'text-rose-600' : isSoon ? 'text-status-warning' : 'text-status-info'}`}>
              {daysUntil}
            </div>
            <div className="text-xs text-slate-500">days left</div>
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
      <Card className="shadow-2xl border-slate-300 bg-white/95 backdrop-blur">
        <CardContent className="p-3 flex flex-wrap items-center gap-2 md:gap-3">
          <Badge className="bg-status-info text-white px-3 py-1">
            {selectedCount} selected
          </Badge>
          <div className="h-6 w-px bg-slate-200 hidden md:block" />

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
              <DropdownMenuItem onClick={() => onBulkUpdate("not_renewing")} className="text-rose-600">
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
          <Button size="sm" variant="ghost" onClick={onClear}>
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
  const currentContract = seasonal.contracts?.find(c => c.seasonYear === new Date().getFullYear());

  return (
    <div className={`border rounded-lg transition-all duration-200 ${isSelected ? "ring-2 ring-blue-500 bg-blue-50/30" : "hover:shadow-md bg-white"}`}>
      {/* Mobile Card View */}
      <div className="md:hidden p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="rounded border-slate-300 mt-1"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Avatar with tenure indicator */}
            <div className="relative">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg ${
                seasonal.totalSeasons >= 10
                  ? "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg"
                  : seasonal.totalSeasons >= 5
                    ? "bg-gradient-to-br from-slate-400 to-slate-500"
                    : "bg-gradient-to-br from-blue-500 to-purple-600"
              }`}>
                {seasonal.guest.primaryFirstName[0]}{seasonal.guest.primaryLastName[0]}
              </div>
              {seasonal.seniorityRank && seasonal.seniorityRank <= 3 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                  {seasonal.seniorityRank}
                </div>
              )}
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <TenureBadge years={seasonal.totalSeasons} />
                {seasonal.currentSite && (
                  <span className="text-sm text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {seasonal.currentSite.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? "rotate-180" : ""}`} />
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
          <div className="space-y-3 pt-3 border-t">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase">Email</p>
                <p className="font-medium truncate">{seasonal.guest.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Phone</p>
                <p className="font-medium">{seasonal.guest.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Rate</p>
                <p className="font-medium">${seasonal.pricing?.[0]?.finalRate?.toLocaleString() || "—"}/mo</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Since</p>
                <p className="font-medium">{seasonal.firstSeasonYear}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button size="sm" className="flex-1" onClick={() => onQuickAction("message")}>
                <Mail className="h-4 w-4 mr-1" />
                Message
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onQuickAction("payment")}>
                <CreditCard className="h-4 w-4 mr-1" />
                Payment
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onQuickAction("contract")}>
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
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            className="rounded border-slate-300"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Avatar with tenure indicator */}
          <div className="relative">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-medium ${
              seasonal.totalSeasons >= 10
                ? "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg"
                : seasonal.totalSeasons >= 5
                  ? "bg-gradient-to-br from-slate-400 to-slate-500"
                  : "bg-gradient-to-br from-blue-500 to-purple-600"
            }`}>
              {seasonal.guest.primaryFirstName[0]}{seasonal.guest.primaryLastName[0]}
            </div>
            {seasonal.seniorityRank && seasonal.seniorityRank <= 3 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow">
                {seasonal.seniorityRank}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
            <div className="flex items-center gap-2 flex-wrap cursor-pointer">
              <span className="font-medium text-slate-900">
                {seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}
              </span>
              <TenureBadge years={seasonal.totalSeasons} />
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
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
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)}>
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
            <Button size="sm" variant="ghost" onClick={onViewDetails}>
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Desktop Expanded Details */}
        {expanded && (
          <div className="px-4 pb-4 pt-0 border-t bg-slate-50/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Phone</p>
                <p className="text-sm font-medium">{seasonal.guest.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Current Rate</p>
                <p className="text-sm font-medium">
                  ${seasonal.pricing?.[0]?.finalRate?.toLocaleString() || "—"}/mo
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Billing</p>
                <p className="text-sm font-medium">
                  {seasonal.paysInFull ? "Paid in Full" : "Monthly"} • {seasonal.isMetered ? "Metered" : "Flat Rate"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Member Since</p>
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
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
          {entry.guest.primaryFirstName[0]}{entry.guest.primaryLastName[0]}
        </div>
        <div className="flex-1">
          <p className="font-medium">{entry.guest.primaryFirstName} {entry.guest.primaryLastName}</p>
          <p className="text-sm text-slate-500">
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
          <Button size="sm" variant="outline" onClick={onContact}>
            <Mail className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onConvert}>
            <UserPlus className="h-4 w-4 mr-1" />
            Convert
          </Button>
          <Button size="sm" variant="ghost" className="text-slate-400" onClick={onRemove}>
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
    <Card className={rateCard.isDefault ? "ring-2 ring-blue-500" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{rateCard.name}</CardTitle>
            {rateCard.isDefault && (
              <Badge className="bg-status-info/15 text-status-info">Default</Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDuplicate}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>{rateCard.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-slate-900">${rateCard.baseRate.toLocaleString()}</span>
            <span className="text-slate-500">/{rateCard.billingFrequency}</span>
          </div>

          {(rateCard.includedUtilities?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Included</p>
              <div className="flex flex-wrap gap-1">
                {rateCard.includedUtilities?.map((u) => (
                  <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>
                ))}
              </div>
            </div>
          )}

          {(rateCard.discounts?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Discounts</p>
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
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Incentives</p>
              <div className="space-y-1">
                {rateCard.incentives?.map((inc, i) => (
                  <div key={i} className="text-sm flex items-center gap-2">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span>{inc.name}</span>
                    {inc.deadline && (
                      <span className="text-xs text-slate-400">by {format(new Date(inc.deadline), "MMM d")}</span>
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
    general: "bg-slate-100 text-slate-700",
    welcome: "bg-purple-100 text-purple-700",
    contract: "bg-status-warning/15 text-status-warning",
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium">{template.name}</p>
            <Badge variant="secondary" className={categoryColors[template.category] || categoryColors.general}>
              {template.category}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {template.channel === "both" ? "Email & SMS" : template.channel.toUpperCase()}
            </Badge>
          </div>
          {template.subject && (
            <p className="text-sm text-slate-600 mb-1">{template.subject}</p>
          )}
          <p className="text-sm text-slate-500 line-clamp-2">{template.body}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" onClick={onUse}>
            Use
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ==================== MAIN PAGE COMPONENT ====================

export default function SeasonalsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const campgroundId = params.campgroundId as string;
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
  const [messageChannel, setMessageChannel] = useState<"email" | "sms">("email");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedSeasonal, setSelectedSeasonal] = useState<SeasonalGuest | null>(null);
  const [seasonYear, setSeasonYear] = useState(currentYear);

  // Helper to get auth headers for API calls
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("campreserv:authToken")
      : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

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
        { credentials: "include", headers: getAuthHeaders() }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[Seasonals Stats] API error:", response.status, errorData);
        throw new Error(errorData.message || `Stats API failed: ${response.status}`);
      }
      return response.json() as Promise<DashboardStats>;
    },
    enabled: !!campgroundId,
  });

  const seasonalsQuery = useQuery({
    queryKey: ["seasonals", campgroundId, statusFilter, renewalFilter, paymentFilter, debouncedSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (renewalFilter !== "all") params.set("renewalIntent", renewalFilter);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const response = await fetch(
        `/api/seasonals/campground/${campgroundId}?${params.toString()}`,
        { credentials: "include", headers: getAuthHeaders() }
      );
      if (!response.ok) {
        return { data: [], total: 0 };
      }
      return response.json() as Promise<{ data: SeasonalGuest[]; total: number }>;
    },
    enabled: !!campgroundId,
  });

  const waitlistQuery = useQuery({
    queryKey: ["waitlist", campgroundId],
    queryFn: async () => {
      // Mock data - replace with actual API
      return [] as WaitlistEntry[];
    },
    enabled: !!campgroundId,
  });

  const rateCardsQuery = useQuery({
    queryKey: ["rate-cards", campgroundId, seasonYear],
    queryFn: async () => {
      const response = await fetch(
        `/api/seasonals/campground/${campgroundId}/rate-cards?seasonYear=${seasonYear}`,
        { credentials: "include", headers: getAuthHeaders() }
      );
      if (!response.ok) return [];
      return response.json() as Promise<RateCard[]>;
    },
    enabled: !!campgroundId,
  });

  const templatesQuery = useQuery({
    queryKey: ["message-templates", campgroundId],
    queryFn: async () => {
      // Mock data - replace with actual API
      return [
        { id: "1", name: "Renewal Reminder", subject: "It's time to renew for {{year}}!", body: "Hi {{first_name}}, we're excited to invite you back...", channel: "email", category: "renewal" },
        { id: "2", name: "Payment Due", subject: "Payment reminder", body: "Hi {{first_name}}, just a friendly reminder that your payment of {{amount}} is due...", channel: "email", category: "payment" },
        { id: "3", name: "Welcome Back", subject: "Welcome back to the park!", body: "Hi {{first_name}}, we're thrilled to have you back for another season...", channel: "email", category: "welcome" },
      ] as MessageTemplate[];
    },
    enabled: !!campgroundId,
  });

  // Mutations
  const updateRenewalMutation = useMutation({
    mutationFn: async ({ id, intent, notes }: { id: string; intent: RenewalIntent; notes?: string }) => {
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

  const stats = statsQuery.data;
  const seasonals = seasonalsQuery.data?.data || [];
  const waitlist = waitlistQuery.data || [];
  const rateCards = rateCardsQuery.data || [];
  const templates = templatesQuery.data || [];

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.length === seasonals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(seasonals.map((s) => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleQuickAction = (seasonal: SeasonalGuest, action: string, value?: string) => {
    if (action === "message") {
      setSelectedIds([seasonal.id]);
      setShowMessageModal(true);
    } else if (action === "renewal" && value) {
      updateRenewalMutation.mutate({ id: seasonal.id, intent: value as RenewalIntent });
    } else if (action === "payment") {
      setSelectedSeasonal(seasonal);
      setShowPaymentModal(true);
    }
  };

  const handleBulkUpdate = (action: string) => {
    const validIntents: RenewalIntent[] = ["committed", "likely", "undecided", "not_renewing"];
    if (validIntents.includes(action as RenewalIntent)) {
      const count = selectedIds.length;
      selectedIds.forEach((id) => {
        updateRenewalMutation.mutate({ id, intent: action as RenewalIntent });
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
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              Seasonal Guests
              <Badge variant="secondary" className="text-lg">{stats?.totalSeasonals || 0}</Badge>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Long-term campers with seasonal agreements (not individual reservations)</p>
            <p className="text-sm text-slate-500 flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              <select
                value={seasonYear}
                onChange={(e) => setSeasonYear(parseInt(e.target.value))}
                className="border-0 bg-transparent font-medium text-slate-700 cursor-pointer hover:text-slate-900"
              >
                {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y} Season</option>
                ))}
              </select>
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
              onClick={() => { setStatusFilter("active"); setActiveTab("all"); }}
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
              onClick={() => { setPaymentFilter("past_due"); setActiveTab("payments"); }}
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
            {stats.churnRiskGuests?.length > 0 && (
              <ChurnRiskCard guests={stats.churnRiskGuests} />
            )}
            {stats.paymentAging && (
              <PaymentAgingCard aging={stats.paymentAging} />
            )}
          </div>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="all" className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                All
              </TabsTrigger>
              <TabsTrigger value="renewals" className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Renewals
                {(stats?.needsAttention?.pendingRenewals ?? 0) > 0 && (
                  <Badge className="ml-1 bg-amber-500 text-white text-xs px-1.5">{stats?.needsAttention?.pendingRenewals}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Payments
                {(stats?.needsAttention?.pastDuePayments ?? 0) > 0 && (
                  <Badge className="ml-1 bg-rose-500 text-white text-xs px-1.5">{stats?.needsAttention?.pastDuePayments}</Badge>
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
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5">{stats?.waitlistCount}</Badge>
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
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search guests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              {(activeTab === "all" || activeTab === "renewals" || activeTab === "payments") && (
                <>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as SeasonalStatus | "all")}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending_renewal">Pending Renewal</option>
                    <option value="not_renewing">Not Renewing</option>
                    <option value="waitlist">Waitlist</option>
                  </select>
                  <select
                    value={renewalFilter}
                    onChange={(e) => setRenewalFilter(e.target.value as RenewalIntent | "all")}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <option value="all">All Renewal</option>
                    <option value="committed">Committed</option>
                    <option value="likely">Likely</option>
                    <option value="undecided">Undecided</option>
                    <option value="not_renewing">Not Returning</option>
                  </select>
                </>
              )}
            </div>
          </div>

          {/* TAB: ALL SEASONALS */}
          <TabsContent value="all" className="space-y-4">
            {/* Bulk select */}
            <div className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.length === seasonals.length && seasonals.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-slate-300"
              />
              <span className="text-slate-500">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : `${seasonals.length} seasonal guests`}
              </span>
            </div>

            {seasonalsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : seasonals.length === 0 ? (
              <Card className="p-12 text-center">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-3">No seasonal guests found</p>
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
              <Card className="p-4 bg-status-success/15 border-status-success/20 cursor-pointer hover:shadow-md transition-all" onClick={() => setRenewalFilter("committed")}>
                <div className="text-3xl font-bold text-status-success">{stats?.renewalsByIntent.committed || 0}</div>
                <div className="text-sm text-status-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Committed
                </div>
              </Card>
              <Card className="p-4 bg-status-success/15 border-status-success/20 cursor-pointer hover:shadow-md transition-all" onClick={() => setRenewalFilter("likely")}>
                <div className="text-3xl font-bold text-status-success">{stats?.renewalsByIntent.likely || 0}</div>
                <div className="text-sm text-status-success flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" /> Likely
                </div>
              </Card>
              <Card className="p-4 bg-status-warning/15 border-status-warning/20 cursor-pointer hover:shadow-md transition-all" onClick={() => setRenewalFilter("undecided")}>
                <div className="text-3xl font-bold text-status-warning">{stats?.renewalsByIntent.undecided || 0}</div>
                <div className="text-sm text-status-warning flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Undecided
                </div>
              </Card>
              <Card className="p-4 bg-rose-50 border-rose-200 cursor-pointer hover:shadow-md transition-all" onClick={() => setRenewalFilter("not_renewing")}>
                <div className="text-3xl font-bold text-rose-700">{stats?.renewalsByIntent.not_renewing || 0}</div>
                <div className="text-sm text-rose-600 flex items-center gap-1">
                  <X className="h-4 w-4" /> Not Returning
                </div>
              </Card>
            </div>

            {/* Undecided guests needing follow-up */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-600" />
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
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-status-warning/15 flex items-center justify-center text-status-warning font-medium text-sm">
                          {seasonal.guest.primaryFirstName[0]}{seasonal.guest.primaryLastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}</p>
                          <p className="text-sm text-slate-500">
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
                          onClick={() => updateRenewalMutation.mutate({ id: seasonal.id, intent: "committed" })}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Committed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600 hover:bg-rose-50"
                          onClick={() => updateRenewalMutation.mutate({ id: seasonal.id, intent: "not_renewing" })}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Not Returning
                        </Button>
                      </div>
                    </div>
                  ))}
                {seasonals.filter((s) => !s.renewalIntent || s.renewalIntent === "undecided").length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
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
                <div className="text-3xl font-bold text-status-success">{stats?.paymentsCurrent || 0}</div>
                <div className="text-sm text-status-success flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" /> Current
                </div>
              </Card>
              <Card className="p-4 bg-rose-50 border-rose-200">
                <div className="text-3xl font-bold text-rose-700">{stats?.paymentsPastDue || 0}</div>
                <div className="text-sm text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" /> Past Due
                </div>
              </Card>
              <Card className="p-4 bg-purple-50 border-purple-200">
                <div className="text-3xl font-bold text-purple-700">{stats?.paymentsPaidAhead || 0}</div>
                <div className="text-sm text-purple-600 flex items-center gap-1">
                  <Sparkles className="h-4 w-4" /> Paid Ahead
                </div>
              </Card>
            </div>

            {/* Past due list */}
            <Card>
              <CardHeader className="bg-rose-50 border-b border-rose-100">
                <CardTitle className="text-lg flex items-center gap-2 text-rose-700">
                  <AlertCircle className="h-5 w-5" />
                  Past Due Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                {seasonals
                  .filter((s) => s.payments?.some((p) => p.status === "past_due"))
                  .map((seasonal) => {
                    const pastDue = seasonal.payments.find((p) => p.status === "past_due");
                    const daysOverdue = pastDue ? differenceInDays(new Date(), new Date(pastDue.dueDate)) : 0;
                    return (
                      <div
                        key={seasonal.id}
                        className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-medium text-sm">
                            {seasonal.guest.primaryFirstName[0]}{seasonal.guest.primaryLastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}</p>
                            <p className="text-sm text-slate-500">
                              ${pastDue?.amount.toLocaleString()} due {pastDue?.dueDate && format(new Date(pastDue.dueDate), "MMM d")}
                              <span className="text-rose-600 ml-2">({daysOverdue} days overdue)</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedIds([seasonal.id]);
                            setShowMessageModal(true);
                            setMessageSubject("Payment Reminder");
                          }}>
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
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
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
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${stats ? (stats.contractsSigned / stats.contractsTotal) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-lg font-bold">
                      {stats?.contractsSigned || 0}/{stats?.contractsTotal || 0}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">contracts signed</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Next Season ({currentYear + 1})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: "25%" }} />
                      </div>
                    </div>
                    <span className="text-lg font-bold">22/88</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">contracts signed</p>
                </CardContent>
              </Card>
            </div>

            {/* Unsigned/Expiring contracts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-amber-600" />
                  Needs Signature
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {seasonals
                  .filter((s) => {
                    const contract = s.contracts?.find(c => c.seasonYear === currentYear);
                    return !contract || contract.status !== "signed";
                  })
                  .slice(0, 10)
                  .map((seasonal) => {
                    const contract = seasonal.contracts?.find(c => c.seasonYear === currentYear);
                    return (
                      <div
                        key={seasonal.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-medium text-sm">
                            {seasonal.guest.primaryFirstName[0]}{seasonal.guest.primaryLastName[0]}
                          </div>
                          <div>
                            <p className="font-medium">{seasonal.guest.primaryFirstName} {seasonal.guest.primaryLastName}</p>
                            <p className="text-sm text-slate-500">
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
                  <Shield className="h-5 w-5 text-purple-600" />
                  Insurance (COI) Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  <Shield className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  COI tracking coming soon
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: WAITLIST */}
          <TabsContent value="waitlist" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Waitlist Queue</h3>
                <p className="text-sm text-slate-500">
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
                <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 mb-3">No one on the waitlist yet</p>
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
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Season Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Season Start</Label>
                    <Input type="date" defaultValue="2025-04-15" className="mt-1" />
                  </div>
                  <div>
                    <Label>Season End</Label>
                    <Input type="date" defaultValue="2025-10-15" className="mt-1" />
                  </div>
                  <div>
                    <Label>Renewal Deadline</Label>
                    <Input type="date" defaultValue="2025-03-01" className="mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rate Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-purple-600" />
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
                    <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No rate cards yet</p>
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
                  <CreditCard className="h-5 w-5 text-emerald-600" />
                  Payment Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Default Billing Frequency</Label>
                    <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="seasonal">Seasonal (Full)</option>
                    </select>
                  </div>
                  <div>
                    <Label>Payment Due Day</Label>
                    <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2">
                      <option value="1">1st of month</option>
                      <option value="15">15th of month</option>
                    </select>
                  </div>
                  <div>
                    <Label>Late Fee</Label>
                    <div className="flex gap-2 mt-1">
                      <Input type="number" defaultValue="25" className="w-20" />
                      <select className="flex-1 border border-slate-200 rounded-lg px-3 py-2">
                        <option value="flat">Flat fee</option>
                        <option value="percent">Percentage</option>
                      </select>
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
                    <Send className="h-5 w-5 text-blue-600" />
                    Send Message
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Recipients</Label>
                    <select className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2">
                      <option value="all">All Seasonals ({stats?.totalSeasonals || 0})</option>
                      <option value="committed">Committed ({stats?.renewalsByIntent.committed || 0})</option>
                      <option value="undecided">Undecided ({stats?.renewalsByIntent.undecided || 0})</option>
                      <option value="past_due">Past Due Payments ({stats?.paymentsPastDue || 0})</option>
                      <option value="selected">Selected ({selectedIds.length})</option>
                    </select>
                  </div>
                  <div>
                    <Label>Channel</Label>
                    <div className="flex gap-2 mt-1">
                      <Button
                        variant={messageChannel === "email" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMessageChannel("email")}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </Button>
                      <Button
                        variant={messageChannel === "sms" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMessageChannel("sms")}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        SMS
                      </Button>
                    </div>
                  </div>
                  {messageChannel === "email" && (
                    <div>
                      <Label>Subject</Label>
                      <Input
                        value={messageSubject}
                        onChange={(e) => setMessageSubject(e.target.value)}
                        placeholder="Message subject..."
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label>Message</Label>
                    <Textarea
                      value={messageBody}
                      onChange={(e) => setMessageBody(e.target.value)}
                      placeholder="Hi {{first_name}}, ..."
                      rows={5}
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Tokens: {"{{first_name}}"}, {"{{last_name}}"}, {"{{site}}"}, {"{{tenure_years}}"}, {"{{amount_due}}"}
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
                  <History className="h-5 w-5 text-slate-600" />
                  Recent Messages
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-slate-500">
                  <Mail className="h-8 w-8 text-slate-300 mx-auto mb-2" />
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
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          }
        }}
        onRecordPayment={() => {
          setShowPaymentModal(true);
        }}
        onExport={async () => {
          try {
            const params = new URLSearchParams({ ids: selectedIds.join(",") });
            const response = await fetch(`/api/seasonals/campground/${campgroundId}/export?${params}`, {
              credentials: "include",
              headers: getAuthHeaders()
            });
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
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          }
        }}
        onClear={() => setSelectedIds([])}
      />

      {/* Message Modal */}
      <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Message to {selectedIds.length} Guest{selectedIds.length !== 1 ? "s" : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={messageChannel === "email" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageChannel("email")}
              >
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>
              <Button
                variant={messageChannel === "sms" ? "default" : "outline"}
                size="sm"
                onClick={() => setMessageChannel("sms")}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                SMS
              </Button>
            </div>

            {messageChannel === "email" && (
              <div>
                <Label>Subject</Label>
                <Input
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  placeholder="Message subject..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label>Message</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Hi {{first_name}}, ..."
                rows={5}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
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
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> Send Message</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment for {selectedIds.length} Guest{selectedIds.length !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Enter payment details to record for all selected guests.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const amountCents = Math.round(parseFloat(formData.get("amount") as string) * 100);
              const method = formData.get("method") as string;
              const note = formData.get("note") as string;

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
              } catch (err: any) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
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
              <select
                id="method"
                name="method"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="card">Credit/Debit Card</option>
                <option value="ach">ACH/Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                name="note"
                placeholder="e.g., Check #1234"
                className="mt-1"
              />
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
