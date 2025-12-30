"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareHeart,
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Send,
  Star,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  PartyPopper,
  Megaphone,
  Heart,
  BarChart3,
  Trophy,
  Target,
  ArrowUp,
  Crown,
  Zap,
  ChevronRight,
  MessageCircle,
  Reply,
  Building2,
} from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
} as const;

const pulseVariants = {
  initial: { scale: 1 },
  pulse: {
    scale: [1, 1.05, 1] as number[],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

export default function FeedbackDashboard() {
  const qc = useQueryClient();
  const [showCelebration, setShowCelebration] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const selectedCampground = campgrounds[0];

  const metricsQuery = useQuery({
    queryKey: ["nps-metrics", selectedCampground?.id],
    queryFn: () => apiClient.getNpsMetrics(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const surveysQuery = useQuery({
    queryKey: ["nps-surveys", selectedCampground?.id],
    queryFn: () => apiClient.listNpsSurveys(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const reviewsQuery = useQuery({
    queryKey: ["reviews-admin", selectedCampground?.id],
    queryFn: () => apiClient.getAdminReviews(selectedCampground!.id),
    enabled: !!selectedCampground?.id
  });

  const [showRemoved, setShowRemoved] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [surveyName, setSurveyName] = useState("Guest NPS");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Show celebration for high NPS scores
  useEffect(() => {
    const nps = metricsQuery.data?.nps;
    if (nps !== undefined && nps !== null && nps >= 50) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [metricsQuery.data?.nps]);

  const createSurveyMutation = useMutation({
    mutationFn: () => apiClient.createNpsSurvey({
      campgroundId: selectedCampground!.id,
      name: surveyName,
      question: "How likely are you to recommend us to a friend?",
      cooldownDays: 30,
      samplingPercent: 100
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nps-surveys", selectedCampground?.id] });
      setSuccessMessage("Survey created! You're ready to start collecting feedback.");
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  });

  const inviteMutation = useMutation({
    mutationFn: () => {
      const surveyId = surveysQuery.data?.[0]?.id;
      if (!surveyId) throw new Error("Create a survey first");
      return apiClient.createNpsInvite({
        surveyId,
        campgroundId: selectedCampground!.id,
        channel: "email",
        email: inviteEmail
      });
    },
    onSuccess: () => {
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["nps-metrics", selectedCampground?.id] });
      setSuccessMessage("Invite sent! Your guest will receive it shortly.");
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  });

  const moderateMutation = useMutation({
    mutationFn: (payload: { reviewId: string; status: "approved" | "rejected" | "pending" }) =>
      apiClient.moderateReview(payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["reviews-admin", selectedCampground?.id] });
      const messages: Record<string, string> = {
        approved: "Review approved and now visible to guests!",
        rejected: "Review has been hidden from public view.",
        pending: "Review moved back to pending.",
      };
      setSuccessMessage(messages[variables.status] || "Review updated!");
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  });

  const replyMutation = useMutation({
    mutationFn: (payload: { reviewId: string; body: string }) =>
      apiClient.replyReview({
        reviewId: payload.reviewId,
        authorType: "staff",
        body: payload.body
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews-admin", selectedCampground?.id] });
      setReplyingTo(null);
      setReplyText("");
      setSuccessMessage("Reply posted! Guests will see your response.");
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  });

  if (!selectedCampground) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquareHeart className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">No Campground Selected</h2>
            <p className="text-slate-600 mt-2">Select a campground to view guest feedback.</p>
          </motion.div>
        </div>
      </DashboardShell>
    );
  }

  const metrics = metricsQuery.data;
  const npsScore = metrics?.nps ?? 0;
  const hasResponses = (metrics?.totalResponses ?? 0) > 0;
  const hasSurvey = surveysQuery.data && surveysQuery.data.length > 0;
  const reviews = reviewsQuery.data || [];
  const filteredReviews = reviews.filter((r) => showRemoved || r.status !== "removed");
  const pendingReviews = reviews.filter((r) => r.status === "pending");

  // NPS score color and sentiment
  const getNpsStyle = (score: number) => {
    if (score >= 50) return { color: "text-status-success", bg: "bg-status-success/15", border: "border-emerald-200", label: "Excellent", icon: Sparkles };
    if (score >= 0) return { color: "text-status-warning", bg: "bg-status-warning/15", border: "border-amber-200", label: "Good", icon: TrendingUp };
    return { color: "text-status-error", bg: "bg-status-error/15", border: "border-red-200", label: "Needs Work", icon: TrendingDown };
  };

  const npsStyle = getNpsStyle(npsScore);
  const NpsIcon = npsStyle.icon;

  return (
    <DashboardShell>
      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Success Toast */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-lg shadow-lg"
              role="status"
              aria-live="polite"
            >
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Celebration overlay for high NPS */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="bg-white rounded-2xl shadow-2xl p-8 text-center"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  <PartyPopper className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-2xl font-bold text-slate-900">Outstanding NPS!</h3>
                <p className="text-slate-600 mt-2">Your guests love you! Keep up the great work.</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Guest Feedback</h1>
              <p className="text-slate-600">Track happiness and turn feedback into action</p>
            </div>
          </div>
        </motion.div>

        {/* Metrics Grid */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {/* NPS Score - Special styling */}
          <motion.div
            className={`relative overflow-hidden rounded-xl border-2 ${npsStyle.border} ${npsStyle.bg} p-5`}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">NPS Score</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${npsStyle.bg} ${npsStyle.color}`}>
                    {npsStyle.label}
                  </span>
                </div>
                <div className={`text-4xl font-bold ${npsStyle.color} mt-2`}>
                  {hasResponses ? (npsScore > 0 ? `+${npsScore}` : npsScore) : "—"}
                </div>
              </div>
              <motion.div
                variants={pulseVariants}
                initial="initial"
                animate={hasResponses && npsScore >= 50 ? "pulse" : "initial"}
                className={`w-10 h-10 rounded-lg ${npsStyle.bg} flex items-center justify-center`}
              >
                <NpsIcon className={`w-5 h-5 ${npsStyle.color}`} />
              </motion.div>
            </div>
            {!hasResponses && (
              <p className="text-xs text-slate-500 mt-2">Send your first survey to see your score</p>
            )}
          </motion.div>

          {/* Other Metrics */}
          <MetricCard
            label="Total Responses"
            value={metrics?.totalResponses ?? 0}
            icon={BarChart3}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
          />
          <MetricCard
            label="Promoters"
            value={metrics?.promoters ?? 0}
            icon={ThumbsUp}
            iconBg="bg-status-success/15"
            iconColor="text-status-success"
            subtitle="Score 9-10"
          />
          <MetricCard
            label="Detractors"
            value={metrics?.detractors ?? 0}
            icon={ThumbsDown}
            iconBg="bg-status-error/15"
            iconColor="text-status-error"
            subtitle="Score 0-6"
          />
        </motion.div>

        {/* NPS Benchmarking Section */}
        {hasResponses && (
          <motion.div
            variants={itemVariants}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">NPS Benchmarks</h2>
                  <p className="text-sm text-slate-600">See how you compare and what it takes to level up</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Your Score vs System Average */}
                {/* System comparison - feature coming soon */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Target className="w-4 h-4 text-indigo-500" />
                    <span>Your Performance</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 mb-1">Your NPS</div>
                      <div className={`text-2xl font-bold ${npsStyle.color}`}>
                        {npsScore > 0 ? `+${npsScore}` : npsScore}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 mb-1">Responses</div>
                      <div className="text-2xl font-bold text-slate-600">
                        {metrics?.totalResponses ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Path to Average */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Path to Above Average</span>
                  </div>

                  {metrics?.isAboveAverage ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                      <div className="font-semibold text-emerald-800">You're already there!</div>
                      <p className="text-sm text-emerald-600 mt-1">
                        Keep delivering great experiences
                      </p>
                    </div>
                  ) : metrics?.toReachAverage !== null && metrics?.toReachAverage !== undefined && metrics.toReachAverage > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-amber-700">Promoters needed</span>
                        <span className="text-2xl font-bold text-amber-800">+{metrics.toReachAverage}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-amber-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(100, (metrics.promoters / (metrics.promoters + metrics.toReachAverage)) * 100)}%`
                            }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                        <p className="text-xs text-amber-600">
                          {metrics.promoters} promoters → {metrics.promoters + metrics.toReachAverage} needed
                        </p>
                      </div>
                      <p className="text-xs text-amber-700 mt-3 flex items-start gap-1">
                        <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Turn {metrics.toReachAverage} more guests into fans (score 9-10) to beat the average
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-sm text-slate-600">
                        Need more data to calculate
                      </p>
                    </div>
                  )}
                </div>

                {/* Path to World-Class */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Crown className="w-4 h-4 text-purple-500" />
                    <span>Path to World-Class (70+)</span>
                  </div>

                  {metrics?.isWorldClass ? (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 text-center">
                      <motion.div
                        animate={{ rotate: [0, -5, 5, -5, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                      >
                        <Crown className="w-10 h-10 text-purple-500 mx-auto mb-2" />
                      </motion.div>
                      <div className="font-bold text-purple-800 text-lg">World-Class!</div>
                      <p className="text-sm text-purple-600 mt-1">
                        You're in elite company. NPS 70+ puts you among the best in hospitality.
                      </p>
                    </div>
                  ) : metrics?.toReachWorldClass !== null && metrics?.toReachWorldClass !== undefined && metrics.toReachWorldClass > 0 ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-purple-700">Promoters needed</span>
                        <span className="text-2xl font-bold text-purple-800">+{metrics.toReachWorldClass}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(100, (metrics.promoters / (metrics.promoters + metrics.toReachWorldClass)) * 100)}%`
                            }}
                            transition={{ duration: 1, ease: "easeOut" }}
                          />
                        </div>
                        <p className="text-xs text-purple-600">
                          {metrics.promoters} promoters → {metrics.promoters + metrics.toReachWorldClass} needed for 70+ NPS
                        </p>
                      </div>
                      <p className="text-xs text-purple-700 mt-3 flex items-start gap-1">
                        <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        Companies like Apple, Costco & USAA have 70+ NPS. You can join them!
                      </p>
                    </div>
                  ) : npsScore >= 70 ? (
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 text-center">
                      <Crown className="w-10 h-10 text-purple-500 mx-auto mb-2" />
                      <div className="font-bold text-purple-800 text-lg">World-Class!</div>
                      <p className="text-sm text-purple-600 mt-1">
                        You're in elite company.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-sm text-slate-600">
                        Need more data to calculate
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tips Section */}
              {!metrics?.isWorldClass && hasResponses && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 pt-6 border-t border-slate-100"
                >
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Tips to Boost Your NPS
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-emerald-600 text-xs font-bold">1</span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">Follow up with detractors</div>
                        <p className="text-slate-500 text-xs mt-1">Reach out personally to guests who scored 0-6. Often they just want to be heard.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-emerald-600 text-xs font-bold">2</span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">Convert passives to promoters</div>
                        <p className="text-slate-500 text-xs mt-1">Guests scoring 7-8 are almost fans. A small extra touch can push them over.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-emerald-600 text-xs font-bold">3</span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">Celebrate your promoters</div>
                        <p className="text-slate-500 text-xs mt-1">Thank guests who scored 9-10 and ask for reviews. They're your best marketing.</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* Send NPS Survey Section */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Collect Feedback</h2>
                <p className="text-sm text-slate-600">Send NPS surveys to understand how guests feel</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* No survey yet - show setup */}
            {!hasSurvey && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-amber-50 border border-amber-200 rounded-xl p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900">Create Your First Survey</h3>
                    <p className="text-sm text-amber-700 mt-1">
                      Before sending invites, set up an NPS survey. This takes just a few seconds.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <div className="flex-1">
                        <label htmlFor="survey-name" className="sr-only">Survey name</label>
                        <input
                          id="survey-name"
                          value={surveyName}
                          onChange={(e) => setSurveyName(e.target.value)}
                          className="w-full border border-amber-300 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-shadow"
                          placeholder="Survey name (e.g., Post-Stay Survey)"
                          aria-describedby="survey-help"
                        />
                        <p id="survey-help" className="sr-only">Enter a name for your NPS survey</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={!surveyName || createSurveyMutation.isPending}
                        onClick={() => createSurveyMutation.mutate()}
                        className="px-6 py-3 rounded-lg bg-amber-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-150 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                        aria-busy={createSurveyMutation.isPending}
                      >
                        {createSurveyMutation.isPending ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                            />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Create Survey
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Survey exists - show invite form */}
            {hasSurvey && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Survey active: <strong>{surveysQuery.data?.[0]?.name || "Guest NPS"}</strong></span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <label htmlFor="invite-email" className="sr-only">Guest email address</label>
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="guest@example.com"
                      className="w-full border border-slate-200 rounded-lg pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none transition-shadow"
                      aria-describedby="email-help"
                    />
                    <p id="email-help" className="sr-only">Enter the guest's email address to send an NPS survey</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!inviteEmail || inviteMutation.isPending}
                    onClick={() => inviteMutation.mutate()}
                    className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-150 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    aria-busy={inviteMutation.isPending}
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Invite
                      </>
                    )}
                  </motion.button>
                </div>

                {inviteMutation.error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg"
                    role="alert"
                  >
                    <XCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{(inviteMutation.error as Error).message}</span>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Reviews Moderation Section */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                  <MessageSquareHeart className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">Guest Reviews</h2>
                    {pendingReviews.length > 0 && (
                      <span className="bg-status-warning/15 text-status-warning text-xs font-semibold px-2 py-1 rounded-full">
                        {pendingReviews.length} pending
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">Approve reviews to display them publicly</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-colors"
                  checked={showRemoved}
                  onChange={(e) => setShowRemoved(e.target.checked)}
                  aria-describedby="show-removed-help"
                />
                <span className="flex items-center gap-1">
                  {showRemoved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  Show removed
                </span>
                <span id="show-removed-help" className="sr-only">Toggle to show or hide removed reviews</span>
              </label>
            </div>
          </div>

          <div className="p-6">
            {filteredReviews.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">No Reviews Yet</h3>
                <p className="text-slate-600 mt-2 max-w-md mx-auto">
                  When guests leave reviews, they'll appear here for moderation before going public.
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {filteredReviews.slice(0, 6).map((review, index) => (
                    <motion.div
                      key={review.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`border rounded-xl p-5 transition-all duration-200 ${
                        review.status === "pending"
                          ? "border-amber-200 bg-amber-50/50"
                          : review.status === "approved"
                          ? "border-emerald-200 bg-emerald-50/30"
                          : "border-slate-200 bg-slate-50/50"
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Rating and Status */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= review.rating
                                        ? "text-amber-400 fill-amber-400"
                                        : "text-slate-300"
                                    }`}
                                    aria-hidden="true"
                                  />
                                ))}
                                <span className="sr-only">{review.rating} out of 5 stars</span>
                              </div>
                              <StatusBadge status={review.status} />
                            </div>

                            {/* Review Content */}
                            {review.title && (
                              <h4 className="font-semibold text-slate-900 mb-1">{review.title}</h4>
                            )}
                            {review.body && (
                              <p className="text-sm text-slate-700">{review.body}</p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {review.status !== "approved" && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => moderateMutation.mutate({ reviewId: review.id, status: "approved" })}
                                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                                aria-label={`Approve review: ${review.title || 'Untitled'}`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Approve
                              </motion.button>
                            )}
                            {review.status !== "rejected" && review.status !== "removed" && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => moderateMutation.mutate({ reviewId: review.id, status: "rejected" })}
                                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                                aria-label={`Reject review: ${review.title || 'Untitled'}`}
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </motion.button>
                            )}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => moderateMutation.mutate({ reviewId: review.id, status: "rejected" })}
                              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 font-medium hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                              aria-label={`Remove review: ${review.title || 'Untitled'}`}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="sr-only sm:not-sr-only">Remove</span>
                            </motion.button>
                          </div>
                        </div>

                        {/* Existing Replies */}
                        {review.replies && review.replies.length > 0 && (
                          <div className="ml-4 pl-4 border-l-2 border-slate-200 space-y-3">
                            {review.replies.map((reply) => (
                              <div key={reply.id} className="bg-blue-50 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Building2 className="w-3 h-3 text-blue-600" />
                                  </div>
                                  <span className="text-xs font-semibold text-blue-700">
                                    {reply.authorType === "staff" ? "Management Response" : "Guest"}
                                  </span>
                                  {reply.createdAt && (
                                    <span className="text-xs text-slate-500">
                                      {new Date(reply.createdAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-700">{reply.body}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Form or Button */}
                        {replyingTo === review.id ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-4 pl-4 border-l-2 border-blue-200"
                          >
                            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Building2 className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-sm font-semibold text-blue-700">Your Public Response</span>
                              </div>
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a professional, helpful response that will be visible to all guests..."
                                className="w-full border border-blue-200 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow resize-none"
                                rows={3}
                                aria-label="Reply to review"
                              />
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-blue-600">
                                  This response will be publicly visible on your reviews page.
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setReplyingTo(null);
                                      setReplyText("");
                                    }}
                                    className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={!replyText.trim() || replyMutation.isPending}
                                    onClick={() => replyMutation.mutate({ reviewId: review.id, body: replyText.trim() })}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                  >
                                    {replyMutation.isPending ? (
                                      <>
                                        <motion.div
                                          animate={{ rotate: 360 }}
                                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                        />
                                        Posting...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="w-4 h-4" />
                                        Post Reply
                                      </>
                                    )}
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setReplyingTo(review.id)}
                              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                              {review.replies && review.replies.length > 0 ? "Add Another Reply" : "Reply Publicly"}
                            </motion.button>
                            {review.replies && review.replies.length > 0 && (
                              <span className="text-xs text-slate-500">
                                {review.replies.length} {review.replies.length === 1 ? "reply" : "replies"}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredReviews.length > 6 && (
                  <p className="text-sm text-slate-500 text-center pt-2">
                    Showing 6 of {filteredReviews.length} reviews
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </DashboardShell>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  subtitle
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm"
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{value}</div>
          {subtitle && (
            <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    pending: { bg: "bg-status-warning/15", text: "text-status-warning", icon: Clock },
    approved: { bg: "bg-status-success/15", text: "text-status-success", icon: CheckCircle2 },
    rejected: { bg: "bg-slate-100", text: "text-slate-600", icon: XCircle },
    removed: { bg: "bg-status-error/15", text: "text-status-error", icon: Trash2 },
  };

  const style = styles[status] || styles.pending;
  const Icon = style.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${style.bg} ${style.text}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span className="capitalize">{status}</span>
    </span>
  );
}
