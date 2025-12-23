"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  AnimatedCounter,
  ProgressBar,
  CelebrationOverlay,
  ValidatedInput
} from "@/components/signup";
import {
  Crown,
  Rocket,
  Star,
  Check,
  ArrowRight,
  Shield,
  Clock,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Mail,
  CheckCircle2
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

type EarlyAccessTier = "founders_circle" | "pioneer" | "trailblazer";

interface TierAvailability {
  tier: string;
  totalSpots: number;
  remainingSpots: number;
  isSoldOut: boolean;
  pricing: {
    bookingFeeCents: number;
    monthlyFeeCents: number;
    monthlyDurationMonths: number | null;
    postPromoMonthlyFeeCents: number;
  };
}

const tierConfig = {
  founders_circle: {
    name: "Founder's Circle",
    icon: Crown,
    color: "amber",
    highlight: "Best Deal",
    monthlyDisplay: "$0/mo",
    durationDisplay: "forever",
    benefits: [
      "$0/month forever (not a typo)",
      "Lifetime 'Founder' badge on your listing",
      "Direct line to founders (phone/text)",
      "Co-create features with us",
      "First access to every new feature"
    ]
  },
  pioneer: {
    name: "Pioneer",
    icon: Rocket,
    color: "emerald",
    highlight: "Most Popular",
    monthlyDisplay: "$0/mo",
    durationDisplay: "for 12 months",
    benefits: [
      "$0/month for first 12 months",
      "Then just $29/month",
      "Priority support forever",
      "Early access to new features",
      "Free data migration"
    ]
  },
  trailblazer: {
    name: "Trailblazer",
    icon: Star,
    color: "violet",
    highlight: "Great Value",
    monthlyDisplay: "$14.50/mo",
    durationDisplay: "for 6 months",
    benefits: [
      "50% off for first 6 months",
      "Then $29/month",
      "Early access to new features",
      "Priority email support",
      "Free data migration"
    ]
  }
};

const colorStyles = {
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-500/10",
    badge: "bg-amber-500 text-slate-900",
    icon: "text-amber-400",
    button: "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400",
    ring: "ring-amber-500",
    text: "text-amber-400",
    glow: "rgba(251, 191, 36, 0.3)"
  },
  emerald: {
    border: "border-emerald-500",
    bg: "bg-emerald-500/10",
    badge: "bg-emerald-500 text-white",
    icon: "text-emerald-400",
    button: "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400",
    ring: "ring-emerald-500",
    text: "text-emerald-400",
    glow: "rgba(16, 185, 129, 0.3)"
  },
  violet: {
    border: "border-violet-500",
    bg: "bg-violet-500/10",
    badge: "bg-violet-500 text-white",
    icon: "text-violet-400",
    button: "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400",
    ring: "ring-violet-500",
    text: "text-violet-400",
    glow: "rgba(139, 92, 246, 0.3)"
  }
};

// Motion configuration
const motionConfig = {
  stagger: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  },
  card: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 260, damping: 20 }
    }
  },
  fadeSlide: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 }
  }
} as const;

export default function SignupPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  const [step, setStep] = useState<"tier" | "details">("tier");
  const [selectedTier, setSelectedTier] = useState<EarlyAccessTier | null>(null);
  const [availability, setAvailability] = useState<TierAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Celebration states
  const [showTierCelebration, setShowTierCelebration] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);

  // Resend email states
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [campgroundName, setCampgroundName] = useState("");
  const [phone, setPhone] = useState("");

  // Progress calculation
  const formProgress = useMemo(() => {
    if (step === "tier") return 33;

    const fields = [firstName, lastName, email, password, campgroundName, phone];
    const completed = fields.filter(f => f.trim().length > 0).length;
    const percentage = 33 + (completed / fields.length * 67);

    return Math.round(percentage);
  }, [step, firstName, lastName, email, password, campgroundName, phone]);

  // Fetch availability on mount
  useEffect(() => {
    async function fetchAvailability() {
      try {
        const res = await fetch(`${API_BASE}/early-access/availability`);
        if (res.ok) {
          const data = await res.json();
          setAvailability(data);
        }
      } catch (err) {
        console.error("Failed to fetch availability:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAvailability();
  }, []);

  const handleTierSelect = (tier: EarlyAccessTier) => {
    const tierData = availability.find((t) => t.tier === tier);
    if (tierData?.isSoldOut) return;

    setSelectedTier(tier);
    setShowTierCelebration(true);

    // Transition to details after celebration
    setTimeout(() => {
      setShowTierCelebration(false);
      setStep("details");
    }, 1200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;

    setError("");
    setSubmitting(true);

    try {
      // First, register the user
      const registerRes = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName
        })
      });

      if (!registerRes.ok) {
        const data = await registerRes.json();
        throw new Error(data.message || "Registration failed");
      }

      const registerData = await registerRes.json();

      // Create early access enrollment
      const signupRes = await fetch(`${API_BASE}/early-access/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${registerData.token}`
        },
        body: JSON.stringify({
          tier: selectedTier,
          campgroundName,
          phone,
          userId: registerData.id
        })
      });

      if (!signupRes.ok) {
        const data = await signupRes.json();
        throw new Error(data.message || "Signup failed");
      }

      // Show success celebration
      setShowSubmitSuccess(true);

      // Redirect after celebration
      setTimeout(() => {
        router.push(`/signup/confirm?email=${encodeURIComponent(email)}`);
      }, 1500);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;

    setResendLoading(true);
    setResendMessage(null);

    try {
      const res = await fetch(`${API_BASE}/early-access/resend-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim() })
      });

      const data = await res.json();

      if (data.success) {
        setResendMessage({ type: "success", text: data.message });
        setResendEmail("");
      } else {
        setResendMessage({ type: "error", text: data.message });
      }
    } catch (err) {
      setResendMessage({
        type: "error",
        text: "Something went wrong. Please try again."
      });
    } finally {
      setResendLoading(false);
    }
  };

  // Loading state with personality
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <motion.div
              animate={prefersReducedMotion ? {} : { rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-emerald-400" />
            </motion.div>
            {!prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
        <motion.p
          className="mt-6 text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Loading your exclusive access...
        </motion.p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Progress Bar */}
        <ProgressBar progress={formProgress} />

        {/* Header */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-semibold mb-6">
            <Sparkles className="h-4 w-4" />
            Early Access Program — Limited Spots Available
          </div>

          <AnimatePresence mode="wait">
            {step === "tier" ? (
              <motion.div
                key="tier-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Claim Your{" "}
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                    Founding Member Rate
                  </span>
                </h1>
                <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                  Join the campgrounds shaping Camp Everyday. Lock in your rate forever — once these spots are gone, they're gone.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="details-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Almost There!{" "}
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                    Let's Get You Set Up
                  </span>
                </h1>
                <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                  Just a few quick details and you're in. Your spot is reserved.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence mode="wait">
          {step === "tier" ? (
            /* Tier Selection */
            <motion.div
              key="tier-selection"
              initial={prefersReducedMotion ? { opacity: 0 } : motionConfig.fadeSlide.initial}
              animate={prefersReducedMotion ? { opacity: 1 } : motionConfig.fadeSlide.animate}
              exit={prefersReducedMotion ? { opacity: 0 } : motionConfig.fadeSlide.exit}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
                variants={prefersReducedMotion ? undefined : motionConfig.stagger}
                initial="hidden"
                animate="visible"
              >
                {(["founders_circle", "pioneer", "trailblazer"] as EarlyAccessTier[]).map((tierKey) => {
                  const config = tierConfig[tierKey];
                  const tierData = availability.find((t) => t.tier === tierKey);
                  const styles = colorStyles[config.color as keyof typeof colorStyles];
                  const isSoldOut = tierData?.isSoldOut ?? false;
                  const spotsRemaining = tierData?.remainingSpots ?? 0;
                  const bookingFee = tierData?.pricing?.bookingFeeCents
                    ? `$${(tierData.pricing.bookingFeeCents / 100).toFixed(2)}`
                    : "N/A";

                  return (
                    <motion.div
                      key={tierKey}
                      variants={prefersReducedMotion ? undefined : motionConfig.card}
                      whileHover={
                        !isSoldOut && !prefersReducedMotion
                          ? {
                              y: -8,
                              boxShadow: `0 20px 40px -10px ${styles.glow}`
                            }
                          : {}
                      }
                      whileTap={!isSoldOut && !prefersReducedMotion ? { scale: 0.98 } : {}}
                      className={`relative rounded-2xl border-2 ${styles.border} ${styles.bg} p-8 transition-colors ${
                        isSoldOut ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                      }`}
                      onClick={() => !isSoldOut && handleTierSelect(tierKey)}
                    >
                      {/* Badge */}
                      <div
                        className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 ${styles.badge} text-sm font-bold rounded-full`}
                      >
                        {isSoldOut ? "Sold Out" : config.highlight}
                      </div>

                      {/* Header */}
                      <div className="text-center mb-8 pt-4">
                        <config.icon className={`h-12 w-12 mx-auto mb-4 ${styles.icon}`} />
                        <h3 className="text-2xl font-bold text-white mb-2">{config.name}</h3>

                        {/* Spots Counter */}
                        <div className="flex items-center justify-center gap-2 mb-4">
                          <span className={`text-sm font-semibold ${styles.text}`}>
                            {isSoldOut ? (
                              "No spots remaining"
                            ) : (
                              <>
                                <AnimatedCounter value={spotsRemaining} /> spots left
                              </>
                            )}
                          </span>
                        </div>

                        {/* Pricing */}
                        <div className="space-y-2">
                          <div className="text-3xl font-bold text-white">{config.monthlyDisplay}</div>
                          <p className="text-slate-400">{config.durationDisplay}</p>
                          <div className="pt-2 border-t border-slate-700/50">
                            <span className="text-emerald-400 font-semibold">{bookingFee} per booking</span>
                            <span className="text-slate-500 text-sm block">(locked forever)</span>
                          </div>
                        </div>
                      </div>

                      {/* Benefits */}
                      <ul className="space-y-3 mb-8">
                        {config.benefits.map((benefit) => (
                          <li key={benefit} className="flex items-start gap-3">
                            <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-300 text-sm">{benefit}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <motion.div
                        whileHover={!isSoldOut && !prefersReducedMotion ? { scale: 1.02 } : {}}
                        whileTap={!isSoldOut && !prefersReducedMotion ? { scale: 0.98 } : {}}
                      >
                        <Button
                          className={`w-full py-6 text-lg font-semibold ${styles.button} text-white shadow-lg relative overflow-hidden group`}
                          disabled={isSoldOut}
                        >
                          {/* Shine effect */}
                          {!prefersReducedMotion && (
                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                          )}
                          <span className="relative z-10 flex items-center justify-center">
                            {isSoldOut ? "Sold Out" : "Select This Tier"}
                            {!isSoldOut && (
                              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                            )}
                          </span>
                        </Button>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </motion.div>
          ) : (
            /* Registration Form */
            <motion.div
              key="registration-form"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-lg mx-auto"
            >
              {/* Selected tier indicator */}
              {selectedTier && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 p-4 rounded-lg bg-slate-800/50 border border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {(() => {
                      const config = tierConfig[selectedTier];
                      const Icon = config.icon;
                      const styles = colorStyles[config.color as keyof typeof colorStyles];
                      return (
                        <>
                          <Icon className={`h-6 w-6 ${styles.icon}`} />
                          <div>
                            <p className="text-white font-semibold">{config.name}</p>
                            <p className="text-slate-400 text-sm">
                              {availability.find((t) => t.tier === selectedTier)?.remainingSpots} spots remaining
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setStep("tier")}
                    className="text-slate-400 hover:text-white text-sm underline transition-colors"
                  >
                    Change
                  </button>
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Error message with empathy */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-400 font-semibold text-sm mb-1">
                            Oops, something went wrong
                          </p>
                          <p className="text-red-400/80 text-sm">{error}</p>
                          <p className="text-slate-400 text-xs mt-2">
                            Don't worry — your spot is still reserved. Please try again.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      First Name
                    </label>
                    <ValidatedInput
                      type="text"
                      required
                      value={firstName}
                      onChange={setFirstName}
                      placeholder="John"
                      validation="required"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Last Name
                    </label>
                    <ValidatedInput
                      type="text"
                      required
                      value={lastName}
                      onChange={setLastName}
                      placeholder="Smith"
                      validation="required"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <ValidatedInput
                    type="email"
                    required
                    value={email}
                    onChange={setEmail}
                    placeholder="john@example.com"
                    validation="email"
                    successMessage="Valid email!"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Password
                    <span className="text-slate-500 font-normal ml-2">(at least 8 characters)</span>
                  </label>
                  <ValidatedInput
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={setPassword}
                    placeholder="Keep your account secure"
                    validation="password"
                    successMessage="Strong password!"
                  />
                </div>

                {/* Campground Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Campground Name
                  </label>
                  <ValidatedInput
                    type="text"
                    required
                    value={campgroundName}
                    onChange={setCampgroundName}
                    placeholder="Sunny Acres RV Park"
                    validation="required"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone Number
                    <span className="text-slate-500 font-normal ml-2">(for important updates only)</span>
                  </label>
                  <ValidatedInput
                    type="tel"
                    required
                    value={phone}
                    onChange={setPhone}
                    placeholder="(555) 123-4567"
                    validation="phone"
                  />
                </div>

                {/* Submit */}
                <motion.div
                  whileHover={!submitting && !prefersReducedMotion ? { scale: 1.01 } : {}}
                  whileTap={!submitting && !prefersReducedMotion ? { scale: 0.99 } : {}}
                >
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white relative overflow-hidden group"
                  >
                    {/* Shine effect */}
                    {!prefersReducedMotion && (
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    )}
                    <span className="relative z-10 flex items-center justify-center">
                      {submitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Securing your founding rate...
                        </>
                      ) : (
                        <>
                          Reserve My Spot
                          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>

                {/* Trust signals */}
                <motion.div
                  className="flex items-center justify-center gap-6 pt-4 text-slate-500 text-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.div
                    className="flex items-center gap-2"
                    whileHover={!prefersReducedMotion ? { scale: 1.05, color: "#10b981" } : {}}
                  >
                    <Shield className="h-4 w-4" />
                    <span>30-day money back</span>
                  </motion.div>
                  <motion.div
                    className="flex items-center gap-2"
                    whileHover={!prefersReducedMotion ? { scale: 1.05, color: "#10b981" } : {}}
                  >
                    <Clock className="h-4 w-4" />
                    <span>Cancel anytime</span>
                  </motion.div>
                </motion.div>
              </form>

              {/* Sign in link */}
              <p className="mt-8 text-center text-slate-400">
                Already have an account?{" "}
                <Link href="/auth/signin" className="text-emerald-400 hover:underline">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Resend Onboarding Email Section */}
        <motion.div
          className="mt-12 max-w-md mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="border-t border-slate-700 pt-8">
            <motion.button
              onClick={() => setShowResendForm(!showResendForm)}
              className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-slate-300 transition-colors text-sm"
              whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
            >
              <Mail className="h-4 w-4" />
              Started signup but lost your email?
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showResendForm ? "rotate-180" : ""}`}
              />
            </motion.button>

            <AnimatePresence>
              {showResendForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-6 p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                    <p className="text-slate-300 text-sm mb-4">
                      Enter your email and we'll resend your onboarding link if you have a pending signup.
                    </p>

                    <form onSubmit={handleResendEmail} className="space-y-4">
                      <input
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      />

                      <Button
                        type="submit"
                        disabled={resendLoading}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                      >
                        {resendLoading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            Resend Onboarding Email
                          </>
                        )}
                      </Button>
                    </form>

                    <AnimatePresence>
                      {resendMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                            resendMessage.type === "success"
                              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                              : "bg-red-500/10 border border-red-500/30 text-red-400"
                          }`}
                        >
                          {resendMessage.type === "success" ? (
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          )}
                          <span className="text-sm">{resendMessage.text}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Tier Selection Celebration */}
      <AnimatePresence>
        {showTierCelebration && selectedTier && (
          <CelebrationOverlay
            show={showTierCelebration}
            title="Great Choice!"
            subtitle={`You've selected ${tierConfig[selectedTier].name}`}
          />
        )}
      </AnimatePresence>

      {/* Submit Success Celebration */}
      <AnimatePresence>
        {showSubmitSuccess && (
          <CelebrationOverlay
            show={showSubmitSuccess}
            title="You're In!"
            subtitle="Redirecting to next steps..."
          />
        )}
      </AnimatePresence>
    </div>
  );
}
