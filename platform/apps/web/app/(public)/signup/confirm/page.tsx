"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, RefreshCw, CheckCircle2, Sparkles, PartyPopper } from "lucide-react";
import { useState, Suspense } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const onboardingUrl = searchParams.get("url") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleResend = async () => {
    setResending(true);
    try {
      await fetch(`${API_BASE}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResent(true);
    } catch (err) {
      console.error("Failed to resend:", err);
    } finally {
      setResending(false);
    }
  };

  // Stagger animation config
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center py-12 px-4">
      <motion.div
        className="max-w-md w-full text-center"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Celebration badge */}
        <motion.div
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-semibold mb-6"
        >
          <PartyPopper className="h-4 w-4" />
          You're officially a founding member!
        </motion.div>

        {/* Success Icon with animation */}
        <motion.div
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="relative mx-auto w-24 h-24 mb-8"
        >
          {/* Pulsing glow */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          {/* Icon container */}
          <motion.div
            className="relative z-10 w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center"
            initial={prefersReducedMotion ? {} : { rotate: -180, scale: 0 }}
            animate={prefersReducedMotion ? {} : { rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
          >
            <Mail className="h-12 w-12 text-emerald-400" />
          </motion.div>

          {/* Sparkle decorations */}
          {!prefersReducedMotion && (
            <>
              <motion.div
                className="absolute -top-2 -right-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Sparkles className="h-6 w-6 text-amber-400" />
              </motion.div>
              <motion.div
                className="absolute -bottom-1 -left-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.7 }}
              >
                <Sparkles className="h-5 w-5 text-violet-400" />
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="text-3xl md:text-4xl font-bold text-white mb-4"
        >
          You're In!{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Check Your Email
          </span>
        </motion.h1>

        <motion.div variants={prefersReducedMotion ? undefined : itemVariants}>
          <p className="text-slate-300 mb-2">We've sent a verification link to:</p>
          <p className="text-emerald-400 font-semibold text-lg mb-8 break-all">
            {email || "your email address"}
          </p>
        </motion.div>

        {/* Instructions */}
        <motion.div
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8 text-left"
        >
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Here's what happens next:
          </h3>
          <ol className="space-y-4">
            {[
              {
                step: 1,
                text: "Open the email from Keepr",
                subtext: "Check spam if you don't see it",
              },
              { step: 2, text: "Click the verification link", subtext: "It expires in 24 hours" },
              {
                step: 3,
                text: "Complete your campground setup",
                subtext: "Takes about 10 minutes",
              },
            ].map(({ step, text, subtext }, i) => (
              <motion.li
                key={step}
                className="flex items-start gap-3"
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm font-bold">
                  {step}
                </span>
                <div>
                  <span className="text-slate-200">{text}</span>
                  <span className="text-slate-500 text-sm block">{subtext}</span>
                </div>
              </motion.li>
            ))}
          </ol>
        </motion.div>

        {/* Direct link for testing (when URL is available) */}
        {onboardingUrl && (
          <motion.div
            variants={prefersReducedMotion ? undefined : itemVariants}
            className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
          >
            <p className="text-amber-400 text-sm font-semibold mb-2">
              Dev Mode: Direct Onboarding Link
            </p>
            <p className="text-slate-400 text-xs mb-3">
              Email delivery not configured. Use this link to continue:
            </p>
            <Button
              asChild
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
            >
              <Link href={onboardingUrl}>
                Continue to Setup
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        )}

        {/* Resend */}
        <motion.div variants={prefersReducedMotion ? undefined : itemVariants} className="mb-8">
          <p className="text-slate-500 text-sm mb-3">Didn't receive the email?</p>
          {resent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center gap-2 text-emerald-400"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>On its way! Check your inbox in 2 minutes.</span>
            </motion.div>
          ) : (
            <motion.button
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
            >
              <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
              {resending ? "Sending..." : "Resend verification email"}
            </motion.button>
          )}
        </motion.div>

        {/* Continue to sign in */}
        <motion.div
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="space-y-4"
        >
          <p className="text-slate-500 text-sm">Already verified?</p>
          <motion.div
            whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
            whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
          >
            <Button
              asChild
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 py-6 text-lg relative overflow-hidden group"
            >
              <Link href="/auth/signin">
                {/* Shine effect */}
                {!prefersReducedMotion && (
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                )}
                <span className="relative z-10 flex items-center justify-center">
                  Sign In to Continue
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Help */}
        <motion.p
          variants={prefersReducedMotion ? undefined : itemVariants}
          className="mt-8 text-slate-500 text-sm"
        >
          Having trouble?{" "}
          <a href="mailto:support@keeprstay.com" className="text-emerald-400 hover:underline">
            We're here to help
          </a>
        </motion.p>
      </motion.div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-400">
            Loading...
          </motion.div>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
