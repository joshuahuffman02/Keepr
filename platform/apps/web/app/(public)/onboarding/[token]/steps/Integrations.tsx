"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Puzzle,
  BookOpen,
  DoorOpen,
  ShoppingCart,
  Globe,
  ChevronRight,
  Check,
  ExternalLink,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface IntegrationsData {
  quickbooks?: { connected: boolean; accountId?: string };
  gateAccess?: { connected: boolean; provider?: string };
  interestedIn: string[];
}

interface IntegrationsProps {
  data: IntegrationsData;
  onChange: (data: IntegrationsData) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onConnectQuickBooks?: () => Promise<string>; // Returns OAuth URL
  sessionId?: string;
  token?: string;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// "Set Up Later" integration options
const LATER_INTEGRATIONS = [
  {
    id: "pos",
    label: "POS System",
    description: "Square, Clover, Toast, Lightspeed",
    icon: ShoppingCart,
  },
  {
    id: "ota",
    label: "OTA Channels",
    description: "Airbnb, Hipcamp, Spot2Nite",
    icon: Globe,
  },
];

export function Integrations({
  data,
  onChange,
  onNext,
  onBack,
  onSkip,
  onConnectQuickBooks,
  sessionId,
  token,
}: IntegrationsProps) {
  const prefersReducedMotion = useReducedMotion();
  const [connectingQB, setConnectingQB] = useState(false);

  const toggleInterest = (id: string) => {
    const current = data.interestedIn || [];
    const updated = current.includes(id) ? current.filter((i) => i !== id) : [...current, id];
    onChange({ ...data, interestedIn: updated });
  };

  const handleConnectQuickBooks = async () => {
    if (!onConnectQuickBooks) return;

    setConnectingQB(true);
    try {
      const url = await onConnectQuickBooks();
      // Open OAuth in new window
      window.open(url, "_blank", "width=600,height=700");
      // We'd need to poll for connection status or use a callback
    } catch (error) {
      console.error("Failed to connect QuickBooks:", error);
    } finally {
      setConnectingQB(false);
    }
  };

  const hasAnySelection =
    data.quickbooks?.connected ||
    data.gateAccess?.connected ||
    (data.interestedIn && data.interestedIn.length > 0);

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 mb-4">
            <Puzzle className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Connect Your Tools</h2>
          <p className="text-slate-400">Link with your favorite business software</p>
        </motion.div>

        {/* Set Up Now Section */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wide">Set Up Now</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* QuickBooks Card */}
            <div
              className={cn(
                "relative p-5 rounded-xl border transition-all",
                data.quickbooks?.connected
                  ? "bg-emerald-500/10 border-emerald-500/50"
                  : "bg-slate-800/30 border-slate-700 hover:border-slate-600",
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    data.quickbooks?.connected ? "bg-emerald-500/20" : "bg-green-500/20",
                  )}
                >
                  <BookOpen
                    className={cn(
                      "w-6 h-6",
                      data.quickbooks?.connected ? "text-emerald-400" : "text-green-400",
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white">QuickBooks</h4>
                  <p className="text-sm text-slate-400 mt-1">Sync invoices, payments & reports</p>
                </div>
              </div>

              {data.quickbooks?.connected ? (
                <div className="mt-4 flex items-center gap-2 text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Connected</span>
                </div>
              ) : (
                <Button
                  onClick={handleConnectQuickBooks}
                  disabled={connectingQB || !onConnectQuickBooks}
                  variant="outline"
                  className="mt-4 w-full border-green-500/50 text-green-400 hover:bg-green-500/10"
                >
                  {connectingQB ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      Connect QuickBooks
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Gate Access Card */}
            <div
              className={cn(
                "relative p-5 rounded-xl border transition-all",
                data.gateAccess?.connected
                  ? "bg-emerald-500/10 border-emerald-500/50"
                  : "bg-slate-800/30 border-slate-700 hover:border-slate-600",
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    data.gateAccess?.connected ? "bg-emerald-500/20" : "bg-blue-500/20",
                  )}
                >
                  <DoorOpen
                    className={cn(
                      "w-6 h-6",
                      data.gateAccess?.connected ? "text-emerald-400" : "text-blue-400",
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white">Gate Access</h4>
                  <p className="text-sm text-slate-400 mt-1">Auto-generate gate codes for guests</p>
                </div>
              </div>

              {data.gateAccess?.connected ? (
                <div className="mt-4 flex items-center gap-2 text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Connected ({data.gateAccess.provider})
                  </span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-4 w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                  onClick={() => {
                    // For now, just show as "coming during setup"
                    // Full implementation would open a modal to select provider
                  }}
                  disabled
                >
                  Set Up in Dashboard
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Set Up Later Section */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wide">
            Set Up Later
          </h3>
          <p className="text-sm text-slate-500">
            Check what interests you - we'll remind you after launch
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {LATER_INTEGRATIONS.map((integration) => {
              const isSelected = data.interestedIn?.includes(integration.id);
              const Icon = integration.icon;

              return (
                <button
                  key={integration.id}
                  onClick={() => toggleInterest(integration.id)}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                    isSelected
                      ? "bg-purple-500/10 border-purple-500/50"
                      : "bg-slate-800/30 border-slate-700 hover:border-slate-600",
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                      isSelected ? "bg-purple-500 border-purple-500" : "border-slate-600",
                    )}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      isSelected ? "bg-purple-500/20" : "bg-slate-700/50",
                    )}
                  >
                    <Icon
                      className={cn("w-5 h-5", isSelected ? "text-purple-400" : "text-slate-400")}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-medium", isSelected ? "text-white" : "text-slate-300")}>
                      {integration.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{integration.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">All integrations are optional.</span> You
            can connect any of these anytime from Settings {">"} Integrations.
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={onNext}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
            )}
          >
            Continue to Review
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip for Now
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
