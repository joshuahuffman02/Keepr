"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Rocket,
  CheckCircle2,
  MapPin,
  CreditCard,
  Tent,
  DollarSign,
  Shield,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SetupSummary {
  campground: {
    name: string;
    city: string;
    state: string;
  };
  stripeConnected: boolean;
  siteClasses: number;
  sites: number;
  depositPolicy: string;
  taxRulesCount: number;
}

interface ReviewLaunchProps {
  summary: SetupSummary;
  onLaunch: () => Promise<void>;
  onPreview: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 200,
  damping: 15,
};

function SummaryItem({
  icon: Icon,
  label,
  value,
  status = "complete",
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  status?: "complete" | "warning" | "pending";
  delay: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700"
    >
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          status === "complete" && "bg-emerald-500/20",
          status === "warning" && "bg-amber-500/20",
          status === "pending" && "bg-slate-700"
        )}
      >
        <Icon
          className={cn(
            "w-5 h-5",
            status === "complete" && "text-emerald-400",
            status === "warning" && "text-amber-400",
            status === "pending" && "text-slate-400"
          )}
        />
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="font-medium text-white">{value}</p>
      </div>
      {status === "complete" && (
        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      )}
    </motion.div>
  );
}

export function ReviewLaunch({
  summary,
  onLaunch,
  onPreview,
  isLoading = false,
}: ReviewLaunchProps) {
  const prefersReducedMotion = useReducedMotion();
  const [launching, setLaunching] = useState(false);

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      await onLaunch();
      // Celebration will be triggered in parent
    } catch (error) {
      console.error("Failed to launch:", error);
      setLaunching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          className="text-center"
        >
          <motion.div
            initial={prefersReducedMotion ? {} : { scale: 0 }}
            animate={prefersReducedMotion ? {} : { scale: 1 }}
            transition={{ delay: 0.1, ...SPRING_CONFIG }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-6"
          >
            <Rocket className="w-10 h-10 text-emerald-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Ready for Launch!
          </h2>
          <p className="text-slate-400">
            Review your setup and go live when you're ready
          </p>
        </motion.div>

        {/* Summary */}
        <div className="space-y-3">
          <SummaryItem
            icon={MapPin}
            label="Campground"
            value={`${summary.campground.name} • ${summary.campground.city}, ${summary.campground.state}`}
            delay={0.15}
          />
          <SummaryItem
            icon={CreditCard}
            label="Payments"
            value={summary.stripeConnected ? "Stripe Connected" : "Not Connected"}
            status={summary.stripeConnected ? "complete" : "warning"}
            delay={0.2}
          />
          <SummaryItem
            icon={Tent}
            label="Inventory"
            value={`${summary.sites} sites across ${summary.siteClasses} types`}
            delay={0.25}
          />
          <SummaryItem
            icon={Shield}
            label="Deposit Policy"
            value={summary.depositPolicy}
            delay={0.3}
          />
          {summary.taxRulesCount > 0 && (
            <SummaryItem
              icon={DollarSign}
              label="Tax Rules"
              value={`${summary.taxRulesCount} rule${summary.taxRulesCount > 1 ? "s" : ""} configured`}
              delay={0.35}
            />
          )}
        </div>

        {/* Preview button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Button
            variant="outline"
            onClick={onPreview}
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Preview Booking Page
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>

        {/* Launch button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="pt-4"
        >
          <motion.div
            whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          >
            <Button
              onClick={handleLaunch}
              disabled={launching || isLoading}
              className={cn(
                "relative w-full py-8 text-xl font-bold transition-all overflow-hidden group",
                "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500",
                "hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400",
                "disabled:opacity-50",
                "shadow-lg shadow-emerald-500/25"
              )}
              style={{
                backgroundSize: "200% 100%",
              }}
            >
              {/* Animated shine */}
              {!prefersReducedMotion && (
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              )}

              <span className="relative z-10 flex items-center justify-center gap-3">
                {launching ? (
                  "Launching..."
                ) : (
                  <>
                    <Rocket className="w-6 h-6" />
                    Go Live!
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </Button>
          </motion.div>

          <p className="text-center text-sm text-slate-500 mt-4">
            Your campground will be visible to guests immediately
          </p>
        </motion.div>

        {/* Reassurance */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 text-center"
        >
          <p className="text-sm text-slate-400">
            Don't worry - you can always adjust settings, add more sites, or
            pause bookings from your dashboard.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
