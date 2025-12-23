"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Users,
  Mail,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  TrendingUp,
  UserCheck,
  Timer
} from "lucide-react";

type TierStats = {
  tier: string;
  totalSpots: number;
  remainingSpots: number;
  claimed: number;
  enrolled: number;
};

type OnboardingStats = {
  pending: number;
  completed: number;
  conversionRate: number;
};

type Stats = {
  tiers: TierStats[];
  onboarding: OnboardingStats;
};

type PendingOnboarding = {
  id: string;
  inviteId: string;
  email: string;
  campgroundName: string;
  phone?: string;
  tier: string;
  status: string;
  currentStep: string;
  completedSteps?: string[];
  createdAt: string;
  updatedAt: string;
  inviteExpiresAt: string;
  inviteExpired: boolean;
  lastEmailSent?: string;
  organizationId: string;
};

const TIER_LABELS: Record<string, string> = {
  founders_circle: "Founder's Circle",
  pioneer: "Pioneer",
  trailblazer: "Trailblazer"
};

const TIER_COLORS: Record<string, string> = {
  founders_circle: "bg-amber-500",
  pioneer: "bg-emerald-500",
  trailblazer: "bg-blue-500"
};

export default function EarlyAccessAdminPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingOnboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const [statsRes, pendingRes] = await Promise.all([
        fetch(`${base}/early-access/admin/stats`, { credentials: "include" }),
        fetch(`${base}/early-access/admin/pending`, { credentials: "include" })
      ]);

      if (!statsRes.ok) throw new Error(`Failed to load stats (${statsRes.status})`);
      if (!pendingRes.ok) throw new Error(`Failed to load pending (${pendingRes.status})`);

      const statsData = await statsRes.json();
      const pendingData = await pendingRes.json();

      setStats(statsData);
      setPending(pendingData);
    } catch (err: any) {
      toast({
        title: "Load failed",
        description: err?.message || "Could not load early access data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const resendEmail = async (sessionId: string) => {
    setResendingId(sessionId);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE || "";
      const res = await fetch(`${base}/early-access/admin/resend/${sessionId}`, {
        method: "POST",
        credentials: "include"
      });

      if (!res.ok) throw new Error(`Resend failed (${res.status})`);

      const result = await res.json();
      toast({
        title: "Email sent",
        description: `Onboarding email resent to ${result.email}`
      });

      // Reload to update lastEmailSent
      void loadData();
    } catch (err: any) {
      toast({
        title: "Resend failed",
        description: err?.message || "Could not resend email",
        variant: "destructive"
      });
    } finally {
      setResendingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const getTimeSince = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Early Access Management</h1>
          <p className="text-slate-400 mt-1">
            Monitor signups, resend emails, and track conversion
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadData()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Tier Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats?.tiers.map((tier) => (
              <Card key={tier.tier} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className={`${TIER_COLORS[tier.tier] || "bg-slate-500"} p-2 rounded-lg`}>
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">
                        {TIER_LABELS[tier.tier] || tier.tier}
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {tier.remainingSpots} of {tier.totalSpots} spots left
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mt-2">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className={`${TIER_COLORS[tier.tier] || "bg-slate-500"} h-2 rounded-full transition-all`}
                        style={{
                          width: `${((tier.totalSpots - tier.remainingSpots) / tier.totalSpots) * 100}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-400">
                      <span>{tier.claimed} claimed</span>
                      <span>{tier.enrolled} completed</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Onboarding Conversion */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Onboarding Conversion
              </CardTitle>
              <CardDescription className="text-slate-400">
                Signup to completion rate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Timer className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats?.onboarding.pending || 0}</p>
                    <p className="text-sm text-slate-400">Pending Signups</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats?.onboarding.completed || 0}</p>
                    <p className="text-sm text-slate-400">Completed</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stats?.onboarding.conversionRate || 0}%</p>
                    <p className="text-sm text-slate-400">Conversion Rate</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Onboardings Table */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Pending Signups
              </CardTitle>
              <CardDescription className="text-slate-400">
                Users who started signup but haven't completed onboarding
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No pending signups</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-lg border p-4 ${
                        item.inviteExpired
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-slate-700 bg-slate-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white truncate">
                              {item.campgroundName}
                            </p>
                            <Badge
                              variant="secondary"
                              className={`${TIER_COLORS[item.tier] || "bg-slate-500"} text-white text-xs`}
                            >
                              {TIER_LABELS[item.tier] || item.tier}
                            </Badge>
                            {item.inviteExpired && (
                              <Badge variant="destructive" className="text-xs">
                                Expired
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-300">{item.email}</p>
                          {item.phone && (
                            <p className="text-xs text-slate-400">{item.phone}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Signed up {getTimeSince(item.createdAt)}
                            </span>
                            <span>Step: {item.currentStep.replace(/_/g, " ")}</span>
                            {item.lastEmailSent && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                Last email {getTimeSince(item.lastEmailSent)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={item.inviteExpired ? "default" : "outline"}
                            onClick={() => resendEmail(item.id)}
                            disabled={resendingId === item.id}
                          >
                            {resendingId === item.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail className="h-3 w-3 mr-1" />
                                {item.inviteExpired ? "Resend & Extend" : "Resend Email"}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {item.inviteExpired && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          Invite expired {formatDate(item.inviteExpiresAt)} - resending will extend by 7 days
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
