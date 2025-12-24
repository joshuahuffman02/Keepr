"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ScrollText,
  Check,
  ChevronRight,
  ChevronDown,
  Edit3,
  FileText,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ParkRulesData {
  useTemplate: boolean;
  templateId?: string;
  customRules?: string;
  requireSignature: boolean;
  enforcement: "pre_booking" | "pre_checkin" | "informational";
}

interface ParkRulesProps {
  initialData?: ParkRulesData;
  onSave: (data: ParkRulesData) => Promise<void>;
  onSkip: () => void;
  onNext: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// Pre-built rule templates
const RULE_TEMPLATES = [
  {
    id: "standard",
    name: "Standard Campground Rules",
    description: "Common rules for RV parks and campgrounds",
    content: `CAMPGROUND RULES & REGULATIONS

1. CHECK-IN/CHECK-OUT
   • Check-in time: 2:00 PM | Check-out time: 11:00 AM
   • Late check-out must be arranged with office

2. QUIET HOURS
   • Quiet hours: 10:00 PM - 8:00 AM
   • No generators during quiet hours

3. SPEED LIMIT
   • 5 MPH throughout the campground
   • Watch for children and pets

4. FIRES
   • Fires only in designated fire rings
   • Never leave fires unattended
   • Extinguish completely before leaving site

5. PETS
   • Pets must be leashed at all times
   • Clean up after your pets
   • Do not leave pets unattended

6. VISITORS
   • All visitors must register at office
   • Visitors must leave by 10:00 PM

7. TRASH
   • Place trash in designated dumpsters
   • Do not leave trash at campsites

By checking in, you agree to abide by these rules.`,
  },
  {
    id: "family",
    name: "Family-Friendly Rules",
    description: "Emphasis on family atmosphere and safety",
    content: `FAMILY CAMPGROUND GUIDELINES

Welcome to our family-friendly campground! To ensure everyone has a safe and enjoyable stay, please observe these guidelines:

SAFETY FIRST
• Speed limit: 5 MPH - children at play
• Supervise children at all times
• No glass containers in common areas

QUIET & RESPECT
• Quiet hours: 10 PM - 8 AM
• Keep music and voices at reasonable levels
• Respect your neighbors' space

PETS
• Leashed pets welcome
• Clean up after pets immediately
• Keep pets off playground areas

CAMPFIRES
• Use fire rings only
• Adults supervise all fires
• Completely extinguish before sleeping

POOL AREA (if applicable)
• No lifeguard on duty - swim at your own risk
• Children under 12 must have adult supervision
• No diving

Thank you for helping us maintain a safe, fun environment!`,
  },
  {
    id: "rv_focused",
    name: "RV Park Rules",
    description: "Focused on RV and trailer-specific policies",
    content: `RV PARK RULES & POLICIES

SITE SETUP
• Park within designated site boundaries
• One RV per site (additional vehicles in overflow)
• Slides, awnings, and levelers must stay on pad
• No tarps or structures between sites

UTILITIES
• 20/30/50 amp service available (check your site)
• Do not exceed amperage rating
• Report any electrical issues immediately
• Water: Use pressure regulator recommended

SEWER
• Use proper sewer connections (no open drains)
• Dispose of gray water in sewer only
• Dump station available for non-hookup sites

PROPANE
• Propane deliveries by appointment only
• Report any gas leaks immediately

WASHING
• No vehicle washing at sites
• Use designated wash station only

STORAGE
• Long-term storage available (ask at office)
• No derelict or non-operational RVs

DEPARTURE
• Disconnect all utilities before leaving
• Return site to clean condition
• Check out at office if leaving early`,
  },
];

const ENFORCEMENT_OPTIONS = [
  {
    id: "pre_booking",
    label: "Before Booking",
    description: "Guests must acknowledge before completing reservation",
  },
  {
    id: "pre_checkin",
    label: "Before Check-in",
    description: "Guests sign during check-in process",
  },
  {
    id: "informational",
    label: "Informational Only",
    description: "Displayed but no signature required",
  },
];

export function ParkRules({
  initialData,
  onSave,
  onSkip,
  onNext,
  onBack,
  isLoading = false,
}: ParkRulesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    initialData?.templateId || "standard"
  );
  const [customRules, setCustomRules] = useState(initialData?.customRules || "");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [requireSignature, setRequireSignature] = useState(
    initialData?.requireSignature ?? true
  );
  const [enforcement, setEnforcement] = useState<ParkRulesData["enforcement"]>(
    initialData?.enforcement || "pre_checkin"
  );
  const [saving, setSaving] = useState(false);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const selectedTemplateData = RULE_TEMPLATES.find(
    (t) => t.id === selectedTemplate
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        useTemplate: !isCustomizing,
        templateId: isCustomizing ? undefined : selectedTemplate || undefined,
        customRules: isCustomizing ? customRules : selectedTemplateData?.content,
        requireSignature,
        enforcement,
      });
      onNext();
    } catch (error) {
      console.error("Failed to save park rules:", error);
    } finally {
      setSaving(false);
    }
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/20 mb-4">
            <ScrollText className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Park Rules & Policies
          </h2>
          <p className="text-slate-400">
            Set up rules that guests will acknowledge
          </p>
        </motion.div>

        {/* Template selection */}
        {!isCustomizing && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <Label className="text-sm text-slate-400">Choose a Template</Label>
            <div className="space-y-2">
              {RULE_TEMPLATES.map((template) => {
                const isSelected = selectedTemplate === template.id;
                const isExpanded = expandedTemplate === template.id;

                return (
                  <motion.div
                    key={template.id}
                    className={cn(
                      "border rounded-xl transition-all overflow-hidden",
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/5"
                        : "border-slate-700 bg-slate-800/30"
                    )}
                  >
                    <button
                      onClick={() => setSelectedTemplate(template.id)}
                      className="w-full p-4 flex items-center gap-4 text-left"
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          isSelected ? "bg-emerald-500/20" : "bg-slate-700"
                        )}
                      >
                        <FileText
                          className={cn(
                            "w-5 h-5",
                            isSelected ? "text-emerald-400" : "text-slate-400"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            "font-medium",
                            isSelected ? "text-emerald-400" : "text-white"
                          )}
                        >
                          {template.name}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {template.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <motion.div
                            initial={prefersReducedMotion ? {} : { scale: 0 }}
                            animate={prefersReducedMotion ? {} : { scale: 1 }}
                            transition={SPRING_CONFIG}
                            className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedTemplate(
                              isExpanded ? null : template.id
                            );
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300"
                        >
                          <ChevronDown
                            className={cn(
                              "w-5 h-5 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-slate-700"
                        >
                          <div className="p-4 bg-slate-900/50">
                            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                              {template.content}
                            </pre>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <button
              onClick={() => {
                setIsCustomizing(true);
                setCustomRules(selectedTemplateData?.content || "");
              }}
              className="w-full mt-3 p-3 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Customize or Write Your Own
            </button>
          </motion.div>
        )}

        {/* Custom editor */}
        {isCustomizing && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm text-slate-400">
                Your Park Rules
              </Label>
              <button
                onClick={() => setIsCustomizing(false)}
                className="text-sm text-slate-500 hover:text-slate-300"
              >
                Back to templates
              </button>
            </div>
            <Textarea
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
              placeholder="Enter your park rules and policies..."
              className="min-h-[300px] bg-slate-800/50 border-slate-700 text-white font-mono text-sm"
            />
          </motion.div>
        )}

        {/* Enforcement settings */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <Label className="text-sm text-slate-400">When to Show</Label>
          <div className="grid gap-2">
            {ENFORCEMENT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() =>
                  setEnforcement(option.id as ParkRulesData["enforcement"])
                }
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  enforcement === option.id
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      enforcement === option.id
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-slate-600"
                    )}
                  >
                    {enforcement === option.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p
                      className={cn(
                        "font-medium",
                        enforcement === option.id
                          ? "text-emerald-400"
                          : "text-white"
                      )}
                    >
                      {option.label}
                    </p>
                    <p className="text-sm text-slate-500">{option.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Signature toggle */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700 rounded-lg"
        >
          <div>
            <p className="font-medium text-white">Require Signature</p>
            <p className="text-sm text-slate-500">
              Guests must digitally sign to acknowledge
            </p>
          </div>
          <Switch
            checked={requireSignature}
            onCheckedChange={setRequireSignature}
          />
        </motion.div>

        {/* Info box */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="bg-slate-800/30 border border-slate-700 rounded-lg p-4 flex gap-3"
        >
          <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-400">
            <span className="text-slate-300 font-medium">
              Need more policies?
            </span>{" "}
            You can add waivers, liability forms, pet agreements, and more in
            your dashboard settings.
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              isLoading ||
              (!selectedTemplate && !customRules.trim())
            }
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
              "disabled:opacity-50"
            )}
          >
            {saving ? "Saving..." : "Save Park Rules"}
          </Button>

          <button
            onClick={onSkip}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-400 transition-colors"
          >
            Skip for now
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
