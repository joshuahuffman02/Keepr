"use client";

import { useState, useEffect } from "react";
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
  Upload,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReservationImportModal } from "../components/reservation-import";

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

interface GoLiveIssue {
  code: string;
  message: string;
  stepToFix: string;
  autoFixable: boolean;
  severity: "blocker" | "warning";
}

interface GoLiveCheckResult {
  canLaunch: boolean;
  blockers: GoLiveIssue[];
  warnings: GoLiveIssue[];
  completionPercent: number;
  requirements: {
    sitesExist: boolean;
    ratesSet: boolean;
    depositPolicySet: boolean;
    teamMemberExists: boolean;
    stripeConnected: boolean;
    emailTemplatesConfigured: boolean;
    cancellationPolicySet: boolean;
    taxRulesConfigured: boolean;
  };
}

interface DataImportSummary {
  importSystemKey?: string;
  overrideAccepted?: boolean;
  requiredComplete?: boolean;
  missingRequired?: Array<{ key: string; missingFields: string[] }>;
  sitesCreated?: number;
  siteClassesCreated?: number;
}

interface ReviewLaunchProps {
  summary: SetupSummary;
  onLaunch: () => Promise<void>;
  onPreview: () => void;
  onGoToStep?: (step: string) => void;
  isLoading?: boolean;
  // For go-live check
  sessionId?: string;
  // For reservation import
  campgroundId?: string;
  token?: string;
  sites?: Array<{ id: string; name: string; siteNumber: string; siteClassId?: string }>;
  siteClasses?: Array<{ id: string; name: string }>;
  dataImport?: DataImportSummary;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
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
          status === "pending" && "bg-slate-700",
        )}
      >
        <Icon
          className={cn(
            "w-5 h-5",
            status === "complete" && "text-emerald-400",
            status === "warning" && "text-amber-400",
            status === "pending" && "text-slate-400",
          )}
        />
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="font-medium text-white">{value}</p>
      </div>
      {status === "complete" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
    </motion.div>
  );
}

export function ReviewLaunch({
  summary,
  onLaunch,
  onPreview,
  onGoToStep,
  isLoading = false,
  sessionId,
  campgroundId,
  token,
  sites = [],
  siteClasses = [],
  dataImport,
}: ReviewLaunchProps) {
  const prefersReducedMotion = useReducedMotion();
  const [launching, setLaunching] = useState(false);
  const [importExpanded, setImportExpanded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [goLiveCheck, setGoLiveCheck] = useState<GoLiveCheckResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const importSystemLabels: Record<string, string> = {
    campspot: "Campspot",
    newbook: "Newbook",
    rms_cloud: "RMS Cloud",
    campground_master: "Campground Master",
    resnexus: "ResNexus",
    other: "Other / Not Sure",
  };
  const coverageLabels: Record<string, string> = {
    sites: "Sites and inventory",
    reservations: "Reservations and guest stays",
    rates: "Rates and seasons",
    accounting: "Accounting totals and taxes",
  };
  const importSourceLabel = dataImport?.importSystemKey
    ? importSystemLabels[dataImport.importSystemKey] || dataImport.importSystemKey
    : null;
  const hasMissingRequired = Boolean(
    dataImport?.missingRequired?.some((entry) => entry.missingFields.length > 0),
  );
  const importStatus = dataImport?.requiredComplete
    ? { label: "Complete", color: "text-emerald-400", badge: "bg-emerald-500/20" }
    : dataImport?.overrideAccepted
      ? { label: "Override accepted", color: "text-amber-300", badge: "bg-amber-500/20" }
      : { label: "Incomplete", color: "text-red-300", badge: "bg-red-500/20" };

  const missingCoverageLabels = (dataImport?.missingRequired || [])
    .map((entry) => coverageLabels[entry.key] || entry.key)
    .filter((label) => label.length > 0);
  const shouldWarnImport = Boolean(
    dataImport && (dataImport.requiredComplete === false || hasMissingRequired),
  );
  const importWarningMessage = shouldWarnImport
    ? hasMissingRequired
      ? `Data import missing required exports: ${missingCoverageLabels.join(", ")}.`
      : "Data import checklist is incomplete."
    : null;
  const importWarnings: GoLiveIssue[] = importWarningMessage
    ? [
        {
          code: dataImport?.overrideAccepted ? "data_import_override" : "data_import_incomplete",
          message: dataImport?.overrideAccepted
            ? `${importWarningMessage} Override accepted.`
            : importWarningMessage,
          stepToFix: "data_import",
          autoFixable: false,
          severity: "warning",
        },
      ]
    : [];

  // Fetch go-live check on mount
  useEffect(() => {
    if (!sessionId || !token) return;

    const fetchGoLiveCheck = async () => {
      setCheckLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000/api";
        const response = await fetch(
          `${apiBase}/onboarding/session/${sessionId}/go-live-check?token=${token}`,
          {
            headers: { "x-onboarding-token": token },
          },
        );
        if (response.ok) {
          const data = await response.json();
          setGoLiveCheck(data);
        }
      } catch (err) {
        console.error("Failed to fetch go-live check:", err);
      } finally {
        setCheckLoading(false);
      }
    };

    fetchGoLiveCheck();
  }, [sessionId, token]);

  const handleLaunch = async () => {
    // Don't allow launch if there are blockers
    if (goLiveCheck && !goLiveCheck.canLaunch) {
      return;
    }

    setLaunching(true);
    try {
      await onLaunch();
      // Celebration will be triggered in parent
    } catch (error) {
      console.error("Failed to launch:", error);
      setLaunching(false);
    }
  };

  const blockers = goLiveCheck?.blockers ?? [];
  const warnings = [...(goLiveCheck?.warnings ?? []), ...importWarnings];
  const showChecks = blockers.length > 0 || warnings.length > 0;
  const canLaunch = !goLiveCheck || goLiveCheck.canLaunch;

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
          <h2 className="text-2xl font-bold text-white mb-2">Ready for Launch!</h2>
          <p className="text-slate-400">Review your setup and go live when you're ready</p>
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

        {dataImport && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 space-y-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Data import source
                  </p>
                  <p className="font-medium text-white">{importSourceLabel || "Not captured"}</p>
                  {(dataImport.sitesCreated || dataImport.siteClassesCreated) && (
                    <p className="text-xs text-slate-400">
                      Imported {dataImport.sitesCreated ?? 0} sites ·{" "}
                      {dataImport.siteClassesCreated ?? 0} site types
                    </p>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "text-xs font-semibold uppercase px-2 py-1 rounded-full w-fit",
                  importStatus.badge,
                  importStatus.color,
                )}
              >
                {importStatus.label}
              </span>
            </div>

            {hasMissingRequired && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">Missing required exports</span>
                </div>
                <ul className="space-y-1">
                  {(dataImport.missingRequired || []).map((entry) => (
                    <li key={entry.key}>
                      {coverageLabels[entry.key] || entry.key}:{" "}
                      {entry.missingFields.length > 0
                        ? entry.missingFields.join(", ")
                        : "Missing export"}
                    </li>
                  ))}
                </ul>
                {dataImport.overrideAccepted && (
                  <p className="text-amber-200">
                    Override accepted. Accounting checks may be incomplete.
                  </p>
                )}
              </div>
            )}

            {onGoToStep && (
              <Button
                variant="outline"
                onClick={() => onGoToStep("data_import")}
                className="w-full border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                Review import checklist
              </Button>
            )}
          </motion.div>
        )}

        {/* Go-Live Check: Blockers and Warnings */}
        {checkLoading && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="flex items-center justify-center gap-2 py-4 text-slate-400"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Checking launch readiness...</span>
          </motion.div>
        )}

        {showChecks && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
            className="space-y-4"
          >
            {/* Blockers */}
            {blockers.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <h3 className="font-medium text-red-400">Required Before Launch</h3>
                </div>
                <ul className="space-y-2">
                  {blockers.map((blocker) => (
                    <li key={blocker.code} className="flex items-center justify-between text-sm">
                      <span className="text-red-300">{blocker.message}</span>
                      {onGoToStep && (
                        <button
                          onClick={() => onGoToStep(blocker.stepToFix)}
                          className="text-red-400 hover:text-red-300 underline text-xs"
                        >
                          Fix this
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <h3 className="font-medium text-amber-400">Recommended (Optional)</h3>
                </div>
                <ul className="space-y-2">
                  {warnings.map((warning) => (
                    <li key={warning.code} className="flex items-center justify-between text-sm">
                      <span className="text-amber-300">{warning.message}</span>
                      {onGoToStep && (
                        <button
                          onClick={() => onGoToStep(warning.stepToFix)}
                          className="text-amber-400 hover:text-amber-300 underline text-xs"
                        >
                          Configure
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

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

        {/* Reservation Import Section */}
        {campgroundId && token && sites.length > 0 && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            transition={{ delay: 0.42 }}
            className="border border-slate-700 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => setImportExpanded(!importExpanded)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Import Existing Reservations</p>
                  <p className="text-sm text-slate-400">
                    {importedCount > 0
                      ? `${importedCount} reservations imported`
                      : "Optional: Upload a CSV to import current bookings"}
                  </p>
                </div>
              </div>
              {importExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>

            {importExpanded && (
              <div className="px-4 pb-4 border-t border-slate-700/50">
                <div className="pt-4 space-y-4">
                  <p className="text-sm text-slate-400">
                    Have existing reservations in another system? Import them now so they appear on
                    your calendar and guests can see their bookings.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setImportModalOpen(true)}
                    className="w-full border-slate-600 text-slate-200 hover:bg-slate-800"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

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
              disabled={launching || isLoading || !canLaunch}
              className={cn(
                "relative w-full py-8 text-xl font-bold transition-all overflow-hidden group",
                canLaunch
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 hover:from-emerald-400 hover:via-teal-400 hover:to-emerald-400 shadow-lg shadow-emerald-500/25"
                  : "bg-slate-700 cursor-not-allowed",
                "disabled:opacity-50",
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
            Don't worry - you can always adjust settings, add more sites, or pause bookings from
            your dashboard.
          </p>
        </motion.div>
      </motion.div>

      {/* Reservation Import Modal */}
      {campgroundId && token && (
        <ReservationImportModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          campgroundId={campgroundId}
          token={token}
          sites={sites}
          siteClasses={siteClasses}
          onComplete={(result) => {
            setImportedCount(result.imported);
            setImportModalOpen(false);
            setImportExpanded(false);
          }}
        />
      )}
    </div>
  );
}
