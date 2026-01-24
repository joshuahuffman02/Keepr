"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Star, Gift, Trophy, TrendingUp, Sparkles, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { GUEST_TOKEN_KEY, SPRING_CONFIG, STATUS_VARIANTS } from "@/lib/portal-constants";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalLoadingState, EmptyState } from "@/components/portal/PortalLoadingState";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";

type LoyaltyProfile = {
  id: string;
  guestId: string;
  pointsBalance: number;
  tier: string;
  transactions: Array<{
    id: string;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
};

// Theme-aware tier colors with gradients
const TIER_STYLES: Record<string, { bg: string; text: string; gradient: string }> = {
  Bronze: {
    bg: "bg-amber-600",
    text: "text-amber-600",
    gradient: "bg-gradient-to-br from-amber-500 to-amber-700",
  },
  Silver: {
    bg: "bg-slate-400",
    text: "text-slate-600",
    gradient: "bg-gradient-to-br from-slate-300 to-slate-500",
  },
  Gold: {
    bg: "bg-yellow-500",
    text: "text-yellow-600",
    gradient: "bg-gradient-to-br from-yellow-400 to-yellow-600",
  },
  Platinum: {
    bg: "bg-gradient-to-r from-slate-300 to-slate-500",
    text: "text-slate-700",
    gradient: "bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600",
  },
};

const TIER_THRESHOLDS = [
  { name: "Bronze", min: 0, max: 999 },
  { name: "Silver", min: 1000, max: 4999 },
  { name: "Gold", min: 5000, max: 9999 },
  { name: "Platinum", min: 10000, max: Infinity },
];

export default function RewardsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<LoyaltyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const fetchData = useCallback(async (authToken: string, currentGuestId?: string | null) => {
    try {
      const guestData = await apiClient.getGuestMe(authToken);
      setGuestId(guestData.id);

      const loyaltyProfile = await apiClient.getLoyaltyProfile(guestData.id);
      setProfile(loyaltyProfile);
    } catch (err) {
      console.error(err);
      // Profile may not exist yet, show empty state
      setProfile({
        id: "",
        guestId: currentGuestId || "",
        pointsBalance: 0,
        tier: "Bronze",
        transactions: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem(GUEST_TOKEN_KEY);
    if (!storedToken) {
      router.push("/portal/login");
      return;
    }
    setToken(storedToken);
    fetchData(storedToken, guestId);
  }, [router, guestId, fetchData]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    if (!token) return;
    await fetchData(token, guestId);
  }, [token, guestId, fetchData]);

  // Memoized tier calculations
  const currentTier = useMemo(() => {
    if (!profile) return TIER_THRESHOLDS[0];
    return (
      TIER_THRESHOLDS.find(
        (t) => profile.pointsBalance >= t.min && profile.pointsBalance <= t.max,
      ) || TIER_THRESHOLDS[0]
    );
  }, [profile]);

  const nextTier = useMemo(() => {
    const idx = TIER_THRESHOLDS.findIndex((t) => t.name === currentTier.name);
    return idx < TIER_THRESHOLDS.length - 1 ? TIER_THRESHOLDS[idx + 1] : null;
  }, [currentTier]);

  const progressToNextTier = useMemo(() => {
    if (!profile) return 0;
    if (!nextTier) return 100;
    const progress =
      ((profile.pointsBalance - currentTier.min) / (nextTier.min - currentTier.min)) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [profile, currentTier, nextTier]);

  const tierStyle = TIER_STYLES[profile?.tier || "Bronze"] || TIER_STYLES.Bronze;

  if (loading) {
    return <PortalLoadingState variant="page" />;
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <PortalPageHeader
          icon={<Sparkles className="h-6 w-6 text-white" />}
          title="Rewards"
          subtitle="Earn points, unlock perks"
          gradient="from-amber-500 to-orange-600"
        />

        {/* Points Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.1 }}
        >
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className={cn(tierStyle.gradient, "p-6 text-white")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80 mb-1">Your Tier</p>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-6 w-6" />
                    <span className="text-2xl font-bold">{profile?.tier || "Bronze"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/80 mb-1">Points Balance</p>
                  <div className="flex items-center gap-2 justify-end">
                    <Star className="h-6 w-6" />
                    <motion.span
                      key={profile?.pointsBalance}
                      initial={{ scale: 1.2, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-bold"
                    >
                      {profile?.pointsBalance.toLocaleString() || 0}
                    </motion.span>
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {nextTier ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress to {nextTier.name}</span>
                    <span className="font-medium text-foreground">
                      {(nextTier.min - (profile?.pointsBalance || 0)).toLocaleString()} points to go
                    </span>
                  </div>
                  {/* Animated progress bar */}
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressToNextTier}%` }}
                      transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(progressToNextTier)}% of the way to {nextTier.name}
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg",
                    STATUS_VARIANTS.success.bg,
                    STATUS_VARIANTS.success.text,
                  )}
                >
                  <Gift className="h-5 w-5" />
                  <span className="font-medium">You've reached the highest tier!</span>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* How to Earn Points */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.2 }}
        >
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <TrendingUp className="h-5 w-5 text-primary" />
                How to Earn Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {[
                  { text: "Earn 1 point for every $1 spent on reservations", icon: Star },
                  { text: "Points are credited after check-out", icon: Calendar },
                  { text: "Bonus points on special promotions", icon: Gift },
                ].map((item, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span>{item.text}</span>
                  </motion.li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_CONFIG, delay: 0.3 }}
        >
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Points History</CardTitle>
              <CardDescription>Your recent points activity</CardDescription>
            </CardHeader>
            <CardContent>
              {profile?.transactions && profile.transactions.length > 0 ? (
                <div className="space-y-1">
                  {profile.transactions.map((tx, index) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="font-medium text-foreground">{tx.reason}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tx.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "px-3 py-1 rounded-full text-sm font-medium",
                          tx.amount > 0
                            ? cn(STATUS_VARIANTS.success.bg, STATUS_VARIANTS.success.text)
                            : cn(STATUS_VARIANTS.error.bg, STATUS_VARIANTS.error.text),
                        )}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount} pts
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Star className="h-12 w-12" />}
                  title="No points yet"
                  description="Complete your first stay to start earning rewards!"
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PullToRefresh>
  );
}
