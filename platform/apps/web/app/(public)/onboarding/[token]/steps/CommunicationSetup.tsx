"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Mail,
  Check,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PreArrivalReminder {
  days: number;
  enabled: boolean;
  description: string;
}

export interface CommunicationSetupData {
  customDomain?: string;
  useCustomDomain: boolean;
  sendConfirmation: boolean;
  preArrivalReminders: PreArrivalReminder[];
  sendPostStay: boolean;
  enableNpsSurvey: boolean;
  npsSendHour?: number;
}

interface CommunicationSetupProps {
  initialData?: CommunicationSetupData;
  onSave: (data: CommunicationSetupData) => Promise<void>;
  onSkip: () => void;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const DEFAULT_PRE_ARRIVAL_REMINDERS: PreArrivalReminder[] = [
  {
    days: 30,
    enabled: false,
    description: "Early reminder with upsells and add-ons",
  },
  {
    days: 7,
    enabled: true,
    description: "Week-out reminder with arrival details",
  },
  {
    days: 1,
    enabled: true,
    description: "Day-before reminder with check-in info",
  },
];

export function CommunicationSetup({
  initialData,
  onSave,
  onSkip,
  onNext,
  isLoading = false,
}: CommunicationSetupProps) {
  const prefersReducedMotion = useReducedMotion();
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [useCustomDomain, setUseCustomDomain] = useState(
    initialData?.useCustomDomain || false
  );
  const [customDomain, setCustomDomain] = useState(
    initialData?.customDomain || ""
  );
  const [sendConfirmation, setSendConfirmation] = useState(
    initialData?.sendConfirmation ?? true
  );
  const [preArrivalReminders, setPreArrivalReminders] = useState<PreArrivalReminder[]>(
    initialData?.preArrivalReminders || DEFAULT_PRE_ARRIVAL_REMINDERS
  );
  const [sendPostStay, setSendPostStay] = useState(
    initialData?.sendPostStay ?? true
  );
  const [enableNpsSurvey, setEnableNpsSurvey] = useState(
    initialData?.enableNpsSurvey ?? false
  );

  const togglePreArrivalReminder = (days: number) => {
    setPreArrivalReminders((prev) =>
      prev.map((r) =>
        r.days === days ? { ...r, enabled: !r.enabled } : r
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        customDomain: useCustomDomain ? customDomain : undefined,
        useCustomDomain,
        sendConfirmation,
        preArrivalReminders,
        sendPostStay,
        enableNpsSurvey,
        npsSendHour: enableNpsSurvey ? 10 : undefined,
      });
      onNext();
    } catch (error) {
      console.error("Failed to save communication setup:", error);
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
            <Mail className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Guest Communications
          </h2>
          <p className="text-slate-400">Stay connected with your guests</p>
        </motion.div>

        {/* Advanced: Custom Email Domain */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden"
        >
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium text-slate-300">
                Advanced: Custom Email Domain
              </div>
              <span className="text-xs text-slate-500">(Optional)</span>
            </div>
            {showAdvanced ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showAdvanced && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={
                prefersReducedMotion ? {} : { opacity: 1, height: "auto" }
              }
              exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              className="px-4 pb-4 space-y-4"
            >
              <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-300">
                  Using your own domain (e.g., hello@keeprstay.com)
                  improves email deliverability and builds trust with guests.
                </p>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setUseCustomDomain(!useCustomDomain)}
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0",
                    useCustomDomain
                      ? "border-blue-500 bg-blue-500"
                      : "border-slate-600"
                  )}
                >
                  {useCustomDomain && (
                    <motion.div
                      initial={prefersReducedMotion ? {} : { scale: 0 }}
                      animate={prefersReducedMotion ? {} : { scale: 1 }}
                      transition={SPRING_CONFIG}
                    >
                      <Check className="w-3 h-3 text-white" />
                    </motion.div>
                  )}
                </button>
                <span className="text-sm text-slate-300">
                  Use custom domain for sending emails
                </span>
              </label>

              {useCustomDomain && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                >
                  <input
                    type="email"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="hello@keeprstay.com"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </motion.div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Automated Emails Section */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">Automated Emails</h3>

          <div className="space-y-3">
            {/* Booking Confirmation */}
            <div
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                sendConfirmation
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800/30"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4
                    className={cn(
                      "font-semibold",
                      sendConfirmation ? "text-blue-400" : "text-white"
                    )}
                  >
                    Booking Confirmation
                  </h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Sent immediately after a successful reservation
                  </p>
                  <div className="mt-2 text-xs text-slate-500 bg-slate-900/50 rounded px-2 py-1 inline-block">
                    Sent immediately
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSendConfirmation(!sendConfirmation)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4",
                    sendConfirmation ? "bg-blue-500" : "bg-slate-600"
                  )}
                >
                  <motion.span
                    layout
                    transition={SPRING_CONFIG}
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      sendConfirmation ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Pre-Arrival Reminders - Multiple */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">Pre-Arrival Reminders</h4>
                <span className="text-xs text-slate-500">Select multiple</span>
              </div>

              {preArrivalReminders.map((reminder) => (
                <div
                  key={reminder.days}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all",
                    reminder.enabled
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-slate-700 bg-slate-800/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4
                        className={cn(
                          "font-semibold",
                          reminder.enabled ? "text-blue-400" : "text-white"
                        )}
                      >
                        {reminder.days === 30
                          ? "1 Month Before"
                          : reminder.days === 7
                          ? "1 Week Before"
                          : "Day Before"}
                      </h4>
                      <p className="text-sm text-slate-400 mt-1">
                        {reminder.description}
                      </p>
                      <div className="mt-2 text-xs text-slate-500 bg-slate-900/50 rounded px-2 py-1 inline-block">
                        {reminder.days} {reminder.days === 1 ? "day" : "days"} before check-in
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePreArrivalReminder(reminder.days)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4",
                        reminder.enabled ? "bg-blue-500" : "bg-slate-600"
                      )}
                    >
                      <motion.span
                        layout
                        transition={SPRING_CONFIG}
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          reminder.enabled ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Post-Stay Thank You */}
            <div
              className={cn(
                "p-4 rounded-xl border-2 transition-all",
                sendPostStay
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-slate-700 bg-slate-800/30"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4
                    className={cn(
                      "font-semibold",
                      sendPostStay ? "text-blue-400" : "text-white"
                    )}
                  >
                    Post-Stay Thank You
                  </h4>
                  <p className="text-sm text-slate-400 mt-1">
                    Thank guests and encourage future bookings
                  </p>
                  <div className="mt-2 text-xs text-slate-500 bg-slate-900/50 rounded px-2 py-1 inline-block">
                    Sent after check-out
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSendPostStay(!sendPostStay)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4",
                    sendPostStay ? "bg-blue-500" : "bg-slate-600"
                  )}
                >
                  <motion.span
                    layout
                    transition={SPRING_CONFIG}
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      sendPostStay ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Post-Stay Survey (NPS) */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">
            Guest Feedback Survey
          </h3>

          <div
            className={cn(
              "p-4 rounded-xl border-2 transition-all",
              enableNpsSurvey
                ? "border-purple-500 bg-purple-500/10"
                : "border-slate-700 bg-slate-800/30"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4
                  className={cn(
                    "font-semibold",
                    enableNpsSurvey ? "text-purple-400" : "text-white"
                  )}
                >
                  Post-Stay NPS Survey
                </h4>
                <p className="text-sm text-slate-400 mt-1">
                  Collect guest satisfaction scores to improve your service
                </p>
                <div className="mt-2 text-xs text-slate-500 bg-slate-900/50 rounded px-2 py-1 inline-block">
                  Sent day after check-out at 10 AM
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnableNpsSurvey(!enableNpsSurvey)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4",
                  enableNpsSurvey ? "bg-purple-500" : "bg-slate-600"
                )}
              >
                <motion.span
                  layout
                  transition={SPRING_CONFIG}
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    enableNpsSurvey ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-slate-400">
              <span className="text-slate-300 font-medium">
                All emails can be customized in settings.
              </span>{" "}
              You can edit templates, add your branding, and fine-tune timing
              after onboarding.
            </p>
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex gap-4"
        >
          <Button
            onClick={handleSkip}
            disabled={saving || isLoading}
            variant="outline"
            className="flex-1 py-6 text-lg font-semibold bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-300"
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            className={cn(
              "flex-1 py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-blue-500 to-indigo-500",
              "hover:from-blue-400 hover:to-indigo-400",
              "disabled:opacity-50"
            )}
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
