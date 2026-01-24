"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileCheck, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WaiversDocumentsData {
  requireWaiver: boolean;
  waiverTiming?: "before_arrival" | "at_checkin";
  waiverContent?: string;
  useDefaultWaiver?: boolean;
  requireParkRulesAck: boolean;
  requireVehicleForm: boolean;
  requirePetPolicy: boolean;
}

interface WaiversDocumentsProps {
  initialData?: WaiversDocumentsData;
  onSave: (data: WaiversDocumentsData) => Promise<void>;
  onSkip: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

const DEFAULT_WAIVER_TEMPLATE = `ASSUMPTION OF RISK AND WAIVER OF LIABILITY

By signing this waiver, I acknowledge that camping and outdoor recreation activities involve inherent risks, including but not limited to: wildlife encounters, weather conditions, uneven terrain, and outdoor hazards.

I agree to:
• Follow all posted park rules and regulations
• Supervise all minors in my party at all times
• Report any injuries or incidents to park management immediately
• Take full responsibility for my actions and those of my guests

I hereby release and hold harmless [PARK_NAME], its owners, employees, and agents from any and all claims, damages, or liabilities arising from my use of the facilities.

I confirm that I am 18 years or older and have the authority to sign this waiver on behalf of all guests in my party.`;

export function WaiversDocuments({
  initialData,
  onSave,
  onSkip,
  onNext,
  isLoading = false,
}: WaiversDocumentsProps) {
  const prefersReducedMotion = useReducedMotion();

  const [requireWaiver, setRequireWaiver] = useState(initialData?.requireWaiver ?? false);
  const [waiverTiming, setWaiverTiming] = useState<"before_arrival" | "at_checkin">(
    initialData?.waiverTiming || "before_arrival",
  );
  const [useDefaultWaiver, setUseDefaultWaiver] = useState(initialData?.useDefaultWaiver ?? true);
  const [waiverContent, setWaiverContent] = useState(
    initialData?.waiverContent || DEFAULT_WAIVER_TEMPLATE,
  );
  const [requireParkRulesAck, setRequireParkRulesAck] = useState(
    initialData?.requireParkRulesAck ?? false,
  );
  const [requireVehicleForm, setRequireVehicleForm] = useState(
    initialData?.requireVehicleForm ?? false,
  );
  const [requirePetPolicy, setRequirePetPolicy] = useState(initialData?.requirePetPolicy ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        requireWaiver,
        waiverTiming: requireWaiver ? waiverTiming : undefined,
        waiverContent: requireWaiver && !useDefaultWaiver ? waiverContent : undefined,
        useDefaultWaiver: requireWaiver ? useDefaultWaiver : undefined,
        requireParkRulesAck,
        requireVehicleForm,
        requirePetPolicy,
      });
      onNext();
    } catch (error) {
      console.error("Failed to save waivers and documents:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-4">
            <FileCheck className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Guest Agreements</h2>
          <p className="text-slate-400">Protect your business with waivers and documents</p>
        </motion.div>

        {/* Liability Waiver Toggle */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <button
            onClick={() => setRequireWaiver(!requireWaiver)}
            className={cn(
              "w-full p-5 rounded-xl border-2 text-left transition-all",
              requireWaiver
                ? "border-blue-500 bg-blue-500/10"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3
                  className={cn(
                    "font-semibold text-lg",
                    requireWaiver ? "text-blue-400" : "text-white",
                  )}
                >
                  Require Liability Waiver
                </h3>
                <p className="text-slate-400 mt-1">
                  Have guests sign a waiver before or during check-in
                </p>
              </div>

              {/* Toggle indicator */}
              <div
                className={cn(
                  "w-12 h-7 rounded-full transition-all flex-shrink-0 ml-4",
                  requireWaiver ? "bg-blue-500" : "bg-slate-600",
                )}
              >
                <motion.div
                  className="w-5 h-5 bg-white rounded-full mt-1 mx-1"
                  animate={prefersReducedMotion ? {} : { x: requireWaiver ? 20 : 0 }}
                  transition={SPRING_CONFIG}
                />
              </div>
            </div>
          </button>

          {/* Waiver options (expanded when enabled) */}
          {requireWaiver && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
              exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              className="ml-4 space-y-4"
            >
              {/* When to collect */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-300">When to collect waiver</label>
                <div className="space-y-2">
                  <button
                    onClick={() => setWaiverTiming("before_arrival")}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      waiverTiming === "before_arrival"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className={cn(
                            "font-medium",
                            waiverTiming === "before_arrival" ? "text-blue-400" : "text-white",
                          )}
                        >
                          Before arrival
                        </div>
                        <div className="text-sm text-slate-400">Guests sign when booking</div>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          waiverTiming === "before_arrival"
                            ? "border-blue-500 bg-blue-500"
                            : "border-slate-600",
                        )}
                      >
                        {waiverTiming === "before_arrival" && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setWaiverTiming("at_checkin")}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      waiverTiming === "at_checkin"
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className={cn(
                            "font-medium",
                            waiverTiming === "at_checkin" ? "text-blue-400" : "text-white",
                          )}
                        >
                          At check-in
                        </div>
                        <div className="text-sm text-slate-400">Guests sign when they arrive</div>
                      </div>
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          waiverTiming === "at_checkin"
                            ? "border-blue-500 bg-blue-500"
                            : "border-slate-600",
                        )}
                      >
                        {waiverTiming === "at_checkin" && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Waiver template toggle */}
              <button
                onClick={() => setUseDefaultWaiver(!useDefaultWaiver)}
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all",
                  useDefaultWaiver
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div
                      className={cn(
                        "font-medium",
                        useDefaultWaiver ? "text-blue-400" : "text-white",
                      )}
                    >
                      Use our standard liability waiver
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      We provide a tested template that covers common scenarios
                    </div>
                  </div>

                  {/* Toggle indicator */}
                  <div
                    className={cn(
                      "w-12 h-7 rounded-full transition-all flex-shrink-0 ml-4",
                      useDefaultWaiver ? "bg-blue-500" : "bg-slate-600",
                    )}
                  >
                    <motion.div
                      className="w-5 h-5 bg-white rounded-full mt-1 mx-1"
                      animate={prefersReducedMotion ? {} : { x: useDefaultWaiver ? 20 : 0 }}
                      transition={SPRING_CONFIG}
                    />
                  </div>
                </div>
              </button>

              {/* Custom waiver text area */}
              {!useDefaultWaiver && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
                  className="space-y-2"
                >
                  <label className="text-sm font-medium text-slate-300">
                    Custom waiver content
                  </label>
                  <textarea
                    value={waiverContent}
                    onChange={(e) => setWaiverContent(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                    placeholder="Enter your custom waiver text..."
                  />
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Additional Documents */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div>
            <h3 className="font-medium text-white">Required acknowledgments</h3>
            <p className="text-sm text-slate-400 mt-1">
              Select which additional documents guests must acknowledge
            </p>
          </div>

          <div className="space-y-3">
            {/* Park Rules Acknowledgment */}
            <button
              onClick={() => setRequireParkRulesAck(!requireParkRulesAck)}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                requireParkRulesAck
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className={cn(
                      "font-medium",
                      requireParkRulesAck ? "text-blue-400" : "text-white",
                    )}
                  >
                    Park rules signature
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Require signature on park rules (you'll set up the rules in the next step)
                  </div>
                </div>
                <div
                  className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ml-4",
                    requireParkRulesAck ? "border-blue-500 bg-blue-500" : "border-slate-600",
                  )}
                >
                  {requireParkRulesAck && (
                    <motion.div
                      initial={prefersReducedMotion ? {} : { scale: 0 }}
                      animate={prefersReducedMotion ? {} : { scale: 1 }}
                      transition={SPRING_CONFIG}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </div>
              </div>
            </button>

            {/* Vehicle Registration Form */}
            <button
              onClick={() => setRequireVehicleForm(!requireVehicleForm)}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                requireVehicleForm
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className={cn(
                      "font-medium",
                      requireVehicleForm ? "text-blue-400" : "text-white",
                    )}
                  >
                    Vehicle registration form
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Collect RV/vehicle make, model, length, and license plate
                  </div>
                </div>
                <div
                  className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ml-4",
                    requireVehicleForm ? "border-blue-500 bg-blue-500" : "border-slate-600",
                  )}
                >
                  {requireVehicleForm && (
                    <motion.div
                      initial={prefersReducedMotion ? {} : { scale: 0 }}
                      animate={prefersReducedMotion ? {} : { scale: 1 }}
                      transition={SPRING_CONFIG}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </div>
              </div>
            </button>

            {/* Pet Policy Agreement */}
            <button
              onClick={() => setRequirePetPolicy(!requirePetPolicy)}
              className={cn(
                "w-full p-4 rounded-lg border-2 text-left transition-all",
                requirePetPolicy
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800/30 hover:border-slate-600",
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className={cn("font-medium", requirePetPolicy ? "text-blue-400" : "text-white")}
                  >
                    Pet policy agreement
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Guests with pets acknowledge rules, fees, and breed restrictions
                  </div>
                </div>
                <div
                  className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ml-4",
                    requirePetPolicy ? "border-blue-500 bg-blue-500" : "border-slate-600",
                  )}
                >
                  {requirePetPolicy && (
                    <motion.div
                      initial={prefersReducedMotion ? {} : { scale: 0 }}
                      animate={prefersReducedMotion ? {} : { scale: 1 }}
                      transition={SPRING_CONFIG}
                    >
                      <Check className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </div>
              </div>
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-2">
            You can add more custom documents in Settings after setup
          </p>
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4"
        >
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-300">
              <span className="font-medium text-blue-400">Digital signatures made easy.</span>{" "}
              Guests will sign these documents electronically during the booking or check-in
              process. All signatures are securely stored and timestamped.
            </div>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-4"
        >
          <Button
            onClick={handleSkip}
            disabled={saving || isLoading}
            variant="outline"
            className="flex-1 py-6 text-lg font-semibold border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Skip for Now
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            className={cn(
              "flex-1 py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-blue-500 to-cyan-500",
              "hover:from-blue-400 hover:to-cyan-400",
              "disabled:opacity-50",
            )}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
