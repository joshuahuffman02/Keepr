"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { DashboardShell } from "@/components/ui/layout/DashboardShell";
import { PageHeader } from "@/components/ui/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Gift,
  Shield,
  Sparkles,
  Trophy
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type DisputeSummary = { open: number; won: number; lost: number; total: number };

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
} as const;

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25 } }
};

export default function FinancePage() {
  const [campgroundId, setCampgroundId] = useState<string>("");
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setCampgroundId(stored);
  }, []);

  const payoutsQuery = useQuery({
    queryKey: ["finance-health-payouts", campgroundId],
    queryFn: () => apiClient.listPayouts(campgroundId),
    enabled: !!campgroundId,
    staleTime: 30_000
  });

  const disputesQuery = useQuery({
    queryKey: ["finance-health-disputes", campgroundId],
    queryFn: () => apiClient.listDisputes(campgroundId),
    enabled: !!campgroundId,
    staleTime: 30_000
  });

  const isLoading = payoutsQuery.isLoading || disputesQuery.isLoading;
  const isRefreshing = payoutsQuery.isFetching || disputesQuery.isFetching;

  // Calculate metrics from real data
  const metrics = useMemo(() => {
    const payouts = payoutsQuery.data ?? [];
    const disputes = disputesQuery.data ?? [];

    // Find most recent payout
    const sortedPayouts = [...payouts].sort((a, b) => {
      const aTime = new Date(a.arrivalDate || a.paidAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.arrivalDate || b.paidAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    const latestPayout = sortedPayouts[0];
    const pendingPayouts = payouts.filter(p => p.status === "pending" || p.status === "in_transit");
    const nextPayout = pendingPayouts.sort((a, b) => {
      const aTime = new Date(a.arrivalDate || a.createdAt || 0).getTime();
      const bTime = new Date(b.arrivalDate || b.createdAt || 0).getTime();
      return aTime - bTime;
    })[0];

    // Calculate this month's revenue from paid payouts
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthPayouts = payouts.filter(p => {
      const paidDate = new Date(p.paidAt || p.arrivalDate || p.createdAt || 0);
      return p.status === "paid" && paidDate >= startOfMonth;
    });
    const thisMonthRevenue = thisMonthPayouts.reduce((sum, p) => sum + (p.amountCents || 0), 0);

    // Last month comparison
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthPayouts = payouts.filter(p => {
      const paidDate = new Date(p.paidAt || p.arrivalDate || p.createdAt || 0);
      return p.status === "paid" && paidDate >= startOfLastMonth && paidDate <= endOfLastMonth;
    });
    const lastMonthRevenue = lastMonthPayouts.reduce((sum, p) => sum + (p.amountCents || 0), 0);

    const revenueChange = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0;

    // Dispute summary
    const disputeSummary: DisputeSummary = { open: 0, won: 0, lost: 0, total: disputes.length };
    disputes.forEach((d) => {
      if (d.status === "won") disputeSummary.won += 1;
      else if (d.status === "lost" || d.status === "charge_refunded") disputeSummary.lost += 1;
      else disputeSummary.open += 1;
    });

    // Find disputes needing urgent attention
    const urgentDisputes = disputes.filter(d => {
      if (d.status === "won" || d.status === "lost" || d.status === "charge_refunded") return false;
      if (!d.evidenceDueBy) return false;
      const dueDate = new Date(d.evidenceDueBy);
      const hoursUntilDue = (dueDate.getTime() - Date.now()) / (1000 * 60 * 60);
      return hoursUntilDue <= 48 && hoursUntilDue > 0;
    });

    return {
      latestPayout,
      nextPayout,
      thisMonthRevenue,
      revenueChange,
      disputeSummary,
      urgentDisputes,
      hasRecentWin: disputes.some(d => {
        if (d.status !== "won") return false;
        const updatedAt = new Date(d.updatedAt || d.createdAt || 0);
        const daysSinceWin = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceWin <= 7;
      })
    };
  }, [payoutsQuery.data, disputesQuery.data]);

  const formatMoney = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(cents / 100);
  };

  // Empty state when no campground selected
  if (!campgroundId) {
    return (
      <DashboardShell>
        <PageHeader
          eyebrow="Finance"
          title="Financial Overview"
          subtitle="Track revenue, payouts, and manage disputes"
        />
        <Card className="border-border">
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Select a campground
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Choose a campground from the dropdown above to view financial data and reports.
            </p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="Finance"
        title={(
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DollarSign className="h-5 w-5" />
            </span>
            <span>Financial Overview</span>
          </span>
        )}
        subtitle="Track revenue, payouts, and manage disputes"
        actions={(
          <Button
            size="sm"
            variant="outline"
            disabled={isRefreshing}
            onClick={() => {
              payoutsQuery.refetch();
              disputesQuery.refetch();
            }}
            className="transition-all duration-200 hover:border-primary/30 hover:bg-primary/10"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      />

      {/* Loading State */}
      {isLoading ? (
        <div className="grid gap-6 lg:max-w-6xl">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 0.6, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
              className="h-32 rounded-xl bg-muted"
            />
          ))}
        </div>
      ) : (
        <motion.div
          variants={shouldReduceMotion ? {} : container}
          initial="hidden"
          animate="show"
          className="space-y-6 lg:max-w-6xl"
        >
          {/* Celebration Banners */}
          {metrics.hasRecentWin && (
            <motion.div
              variants={shouldReduceMotion ? {} : item}
              className="rounded-xl bg-status-warning/10 border border-status-warning/20 p-4"
            >
              <div className="flex items-start gap-3">
                <motion.div
                  animate={shouldReduceMotion ? {} : { y: [0, -3, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >
                  <Trophy className="h-5 w-5 text-status-warning" />
                </motion.div>
                <div className="flex-1">
                  <h3 className="font-semibold text-status-warning">
                    Dispute resolved in your favor!
                  </h3>
                  <p className="text-sm text-status-warning mt-1">
                    Your evidence was accepted. The funds have been protected.
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-status-warning" />
              </div>
            </motion.div>
          )}

          {/* Urgent Disputes Alert */}
          {metrics.urgentDisputes.length > 0 && (
            <motion.div
              variants={shouldReduceMotion ? {} : item}
              className="rounded-xl bg-status-error/10 border border-status-error/20 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-status-error flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-status-error">
                    Action needed: {metrics.urgentDisputes.length} dispute{metrics.urgentDisputes.length > 1 ? "s" : ""} due soon
                  </h3>
                  <p className="text-sm text-status-error mt-1">
                    Submit evidence within 48 hours to protect your revenue.
                  </p>
                </div>
                <Link href="/finance/disputes">
                  <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Review now
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Hero Metrics */}
          <motion.div variants={shouldReduceMotion ? {} : item}>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Next Payout */}
              <motion.div
                whileHover={shouldReduceMotion ? {} : { y: -2, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                className="rounded-xl border border-border bg-card p-5 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  {metrics.nextPayout && (
                    <Badge className="bg-status-success/15 text-status-success border-status-success">
                      On schedule
                    </Badge>
                  )}
                </div>
                <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                  Next Payout
                </div>
                {metrics.nextPayout ? (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {formatMoney(metrics.nextPayout.amountCents || 0)}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {metrics.nextPayout.arrivalDate
                        ? formatDistanceToNow(new Date(metrics.nextPayout.arrivalDate), { addSuffix: true })
                        : "Processing"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-medium text-foreground">
                      No pending payouts
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Payouts arrive 2-7 days after checkout
                    </div>
                  </>
                )}
              </motion.div>

              {/* This Month's Revenue */}
              <motion.div
                whileHover={shouldReduceMotion ? {} : { y: -2, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                className="rounded-xl border border-border bg-card p-5 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="rounded-full bg-status-info/10 p-2">
                    <TrendingUp className="h-5 w-5 text-status-info" />
                  </div>
                  {metrics.revenueChange !== 0 && (
                    <Badge className={`${
                      metrics.revenueChange > 0
                        ? "bg-status-success/15 text-status-success border-status-success"
                        : "bg-status-error/15 text-status-error border-status-error"
                    }`}>
                      {metrics.revenueChange > 0 ? "+" : ""}{metrics.revenueChange.toFixed(0)}% vs last month
                    </Badge>
                  )}
                </div>
                <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                  This Month
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatMoney(metrics.thisMonthRevenue)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  From {payoutsQuery.data?.filter(p => p.status === "paid").length || 0} payouts
                </div>
              </motion.div>

              {/* Disputes Status */}
              <motion.div
                whileHover={shouldReduceMotion ? {} : { y: -2, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                className={`rounded-xl border p-5 cursor-pointer transition-colors ${
                  metrics.disputeSummary.open > 0
                    ? "border-status-warning/30 bg-status-warning/10"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`rounded-full p-2 ${
                    metrics.disputeSummary.open > 0
                      ? "bg-status-warning/10"
                      : "bg-muted"
                  }`}>
                    <Shield className={`h-5 w-5 ${
                      metrics.disputeSummary.open > 0
                        ? "text-status-warning"
                        : "text-muted-foreground"
                    }`} />
                  </div>
                  {metrics.disputeSummary.open > 0 ? (
                    <Badge className="bg-status-warning/15 text-status-warning border-status-warning">
                      {metrics.disputeSummary.open} need attention
                    </Badge>
                  ) : metrics.disputeSummary.total > 0 ? (
                    <Badge className="bg-status-success/15 text-status-success border-status-success">
                      All resolved
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
                  Disputes
                </div>
                {metrics.disputeSummary.total > 0 ? (
                  <>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-status-warning" />
                        <span className="text-lg font-semibold text-status-warning">
                          {metrics.disputeSummary.open}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-status-success" />
                        <span className="text-lg font-semibold text-status-success">
                          {metrics.disputeSummary.won}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-status-error" />
                        <span className="text-lg font-semibold text-status-error">
                          {metrics.disputeSummary.lost}
                        </span>
                      </div>
                    </div>
                    {metrics.disputeSummary.total > 0 && (
                      <div className="mt-3">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(metrics.disputeSummary.won / metrics.disputeSummary.total) * 100}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                            className="h-full bg-status-success rounded-full"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round((metrics.disputeSummary.won / metrics.disputeSummary.total) * 100)}% win rate
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-lg font-medium text-foreground">
                    No disputes
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>

          {/* Navigation Cards */}
          <motion.div variants={shouldReduceMotion ? {} : item}>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Manage Finances
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Payouts Link */}
              <Link href="/finance/payouts">
                <motion.div
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  className="h-full rounded-xl border border-border bg-card p-5 cursor-pointer transition-all hover:border-primary/30"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">
                      Payouts & Deposits
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    View payout history and bank deposits
                  </p>
                  {metrics.latestPayout && (
                    <p className="text-xs text-muted-foreground">
                      Last payout: {formatMoney(metrics.latestPayout.amountCents || 0)}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
                    View all payouts
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </motion.div>
              </Link>

              {/* Disputes Link */}
              <Link href="/finance/disputes">
                <motion.div
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  className={`h-full rounded-xl border p-5 cursor-pointer transition-all ${
                    metrics.disputeSummary.open > 0
                      ? "border-status-warning/20 bg-status-warning/10 hover:border-status-warning/30"
                      : "border-border bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`rounded-full p-2 ${
                      metrics.disputeSummary.open > 0
                        ? "bg-status-warning/10"
                        : "bg-muted"
                    }`}>
                      <Shield className={`h-5 w-5 ${
                        metrics.disputeSummary.open > 0
                          ? "text-status-warning"
                          : "text-muted-foreground"
                      }`} />
                    </div>
                    <h3 className="font-semibold text-foreground">
                      Payment Disputes
                    </h3>
                    {metrics.disputeSummary.open > 0 && (
                      <Badge className="bg-status-warning/15 text-status-warning border-status-warning">
                        {metrics.disputeSummary.open}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Handle chargebacks and submit evidence
                  </p>
                  {metrics.disputeSummary.open > 0 && (
                    <p className="text-xs text-status-warning">
                      {metrics.disputeSummary.open} dispute{metrics.disputeSummary.open > 1 ? "s" : ""} need response
                    </p>
                  )}
                  <div className={`flex items-center gap-1 text-sm font-medium mt-3 ${
                    metrics.disputeSummary.open > 0
                      ? "text-status-warning"
                      : "text-muted-foreground"
                  }`}>
                    Manage disputes
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </motion.div>
              </Link>

              {/* Gift Cards Link */}
              <Link href="/finance/gift-cards">
                <motion.div
                  whileHover={shouldReduceMotion ? {} : { scale: 1.02, boxShadow: "0 8px 16px rgba(0,0,0,0.1)" }}
                  whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                  className="h-full rounded-xl border border-border bg-card p-5 cursor-pointer transition-all hover:border-primary/30"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="rounded-full bg-primary/10 p-2">
                      <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground">
                      Gift Cards & Credits
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Issue gift cards and track redemptions
                  </p>
                  <div className="flex items-center gap-1 text-sm font-medium text-primary mt-3">
                    Manage gift cards
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </motion.div>
              </Link>
            </div>
          </motion.div>

          {/* Recent Activity Preview */}
          {metrics.latestPayout && (
            <motion.div variants={shouldReduceMotion ? {} : item}>
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                  <CardDescription className="">
                    Your latest financial transactions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(payoutsQuery.data ?? []).slice(0, 3).map((payout, i) => (
                      <motion.div
                        key={payout.id}
                        initial={shouldReduceMotion ? {} : { opacity: 0, x: -10 }}
                        animate={shouldReduceMotion ? {} : { opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-1.5 ${
                            payout.status === "paid"
                              ? "bg-status-success/15"
                              : payout.status === "pending" || payout.status === "in_transit"
                              ? "bg-status-info/15"
                              : "bg-muted"
                          }`}>
                            <DollarSign className={`h-4 w-4 ${
                              payout.status === "paid"
                                ? "text-status-success"
                                : payout.status === "pending" || payout.status === "in_transit"
                                ? "text-status-info"
                                : "text-muted-foreground"
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {payout.status === "paid" ? "Payout received" : "Payout " + payout.status.replace("_", " ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payout.arrivalDate
                                ? formatDistanceToNow(new Date(payout.arrivalDate), { addSuffix: true })
                                : formatDistanceToNow(new Date(payout.createdAt || Date.now()), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <span className={`font-semibold ${
                          payout.status === "paid"
                            ? "text-status-success"
                            : "text-foreground"
                        }`}>
                          {formatMoney(payout.amountCents || 0)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                  <Link href="/finance/payouts">
                    <Button variant="outline" className="w-full mt-4">
                      View all transactions
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      )}
    </DashboardShell>
  );
}
