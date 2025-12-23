"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CreditCard,
  Shield,
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StripeConnectProps {
  campgroundId: string;
  isConnected: boolean;
  stripeAccountId?: string | null;
  onConnect: () => Promise<string>; // Returns redirect URL
  onCheckStatus: () => Promise<boolean>; // Returns connection status
  onNext: () => void;
  onSkip?: () => void;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 15,
};

export function StripeConnect({
  campgroundId,
  isConnected: initialConnected,
  stripeAccountId,
  onConnect,
  onCheckStatus,
  onNext,
}: StripeConnectProps) {
  const prefersReducedMotion = useReducedMotion();
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isConnected, setIsConnected] = useState(initialConnected);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const redirectUrl = await onConnect();
      // Redirect to Stripe's hosted onboarding
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError(err?.message || "Failed to start Stripe connection");
      setConnecting(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError(null);
    try {
      const connected = await onCheckStatus();
      setIsConnected(connected);
      if (connected) {
        // Will trigger celebration in parent
        onNext();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to check connection status");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Stripe logo and description */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center py-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 mb-6">
            <CreditCard className="w-10 h-10 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Accept Payments with Stripe
          </h2>
          <p className="text-slate-400 max-w-md mx-auto">
            Connect your Stripe account to accept credit cards, debit cards, and
            ACH bank transfers from your guests.
          </p>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-4"
        >
          {[
            { icon: CreditCard, label: "Cards & ACH", desc: "All major cards" },
            { icon: Shield, label: "Secure", desc: "PCI compliant" },
            { icon: CheckCircle2, label: "Fast Payouts", desc: "2-day deposits" },
          ].map((feature, i) => (
            <motion.div
              key={feature.label}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.05 }}
              className="bg-slate-800/50 rounded-xl p-4 text-center border border-slate-700"
            >
              <feature.icon className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">{feature.label}</p>
              <p className="text-xs text-slate-500">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Connection status */}
        {isConnected ? (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
            transition={SPRING_CONFIG}
            className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center"
          >
            <motion.div
              initial={prefersReducedMotion ? {} : { scale: 0 }}
              animate={prefersReducedMotion ? {} : { scale: 1 }}
              transition={{ delay: 0.1, ...SPRING_CONFIG }}
              className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </motion.div>
            <h3 className="text-lg font-semibold text-emerald-400 mb-1">
              Stripe Connected!
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Your account is ready to accept payments
            </p>
            {stripeAccountId && (
              <p className="text-xs text-slate-500 font-mono">
                Account: {stripeAccountId.slice(0, 12)}...
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-4"
          >
            {/* Connect button */}
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className={cn(
                "w-full py-6 text-lg font-semibold transition-all",
                "bg-gradient-to-r from-violet-500 to-indigo-500",
                "hover:from-violet-400 hover:to-indigo-400",
                "disabled:opacity-50"
              )}
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Connecting to Stripe...
                </>
              ) : (
                <>
                  Connect with Stripe
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>

            {/* Already started? Check status */}
            <div className="text-center">
              <button
                onClick={handleCheckStatus}
                disabled={checking}
                className="text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Already connected? Check status"
                )}
              </button>
            </div>

            {/* Info */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-slate-400">
                <span className="text-slate-300 font-medium">What happens next:</span>{" "}
                You'll be redirected to Stripe to enter your bank details and
                verify your identity. This usually takes about 5 minutes.
              </p>
            </div>
          </motion.div>
        )}

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-medium">Connection failed</p>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Continue button (only show when connected) */}
        {isConnected && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Button
              onClick={onNext}
              className={cn(
                "w-full py-6 text-lg font-semibold transition-all",
                "bg-gradient-to-r from-emerald-500 to-teal-500",
                "hover:from-emerald-400 hover:to-teal-400"
              )}
            >
              Continue to Sites Setup
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
