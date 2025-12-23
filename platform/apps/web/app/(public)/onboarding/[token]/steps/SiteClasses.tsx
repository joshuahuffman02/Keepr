"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Truck,
  Tent,
  Home,
  Sparkles,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Droplets,
  Trash2,
  X,
  PawPrint,
  Users,
  Ruler,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { siteClassTemplates } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

interface SiteClassData {
  id?: string;
  templateId: string;
  name: string;
  siteType: string;
  defaultRate: number; // in dollars for display
  maxOccupancy: number;
  hookupsPower: boolean;
  hookupsWater: boolean;
  hookupsSewer: boolean;
  rigMaxLength?: number;
  petFriendly: boolean;
}

interface SiteClassesProps {
  initialClasses?: SiteClassData[];
  onSave: (classes: SiteClassData[]) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

const iconMap: Record<string, React.ElementType> = {
  Truck,
  Tent,
  Home,
  Sparkles,
};

function TemplateCard({
  template,
  isSelected,
  onSelect,
  delay,
}: {
  template: (typeof siteClassTemplates)[0];
  isSelected: boolean;
  onSelect: () => void;
  delay: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = iconMap[template.icon] || Tent;

  return (
    <motion.button
      onClick={onSelect}
      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={prefersReducedMotion ? {} : { scale: 1.05 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all text-left",
        isSelected
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
      )}
    >
      {isSelected && (
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0 }}
          animate={prefersReducedMotion ? {} : { scale: 1 }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}
      <Icon
        className={cn(
          "w-8 h-8 mb-2",
          isSelected ? "text-emerald-400" : "text-slate-400"
        )}
      />
      <p className="font-medium text-white text-sm">{template.name}</p>
      <p className="text-xs text-slate-500 mt-1">{template.description}</p>
    </motion.button>
  );
}

function SiteClassCard({
  siteClass,
  onUpdate,
  onRemove,
  index,
}: {
  siteClass: SiteClassData;
  onUpdate: (data: Partial<SiteClassData>) => void;
  onRemove: () => void;
  index: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(index === 0);
  const Icon = iconMap[siteClassTemplates.find(t => t.id === siteClass.templateId)?.icon || "Tent"] || Tent;

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, x: -50 }}
      transition={SPRING_CONFIG}
      className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800/30"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-medium text-white">{siteClass.name}</p>
            <p className="text-sm text-slate-500">
              ${siteClass.defaultRate}/night • {siteClass.maxOccupancy} guests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 text-slate-500 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4 border-t border-slate-700/50">
              {/* Name */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-300">Name</Label>
                <Input
                  value={siteClass.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white"
                />
              </div>

              {/* Rate and occupancy */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300 flex items-center gap-2">
                    <span>Nightly Rate</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <Input
                      type="number"
                      value={siteClass.defaultRate}
                      onChange={(e) =>
                        onUpdate({ defaultRate: parseFloat(e.target.value) || 0 })
                      }
                      className="bg-slate-800/50 border-slate-700 text-white pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <span>Max Guests</span>
                  </Label>
                  <Input
                    type="number"
                    value={siteClass.maxOccupancy}
                    onChange={(e) =>
                      onUpdate({ maxOccupancy: parseInt(e.target.value) || 1 })
                    }
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Hookups */}
              <div className="space-y-3">
                <Label className="text-sm text-slate-300">Hookups</Label>
                <div className="flex gap-3">
                  {[
                    { key: "hookupsPower", label: "Electric", icon: Zap },
                    { key: "hookupsWater", label: "Water", icon: Droplets },
                    { key: "hookupsSewer", label: "Sewer", icon: Trash2 },
                  ].map(({ key, label, icon: HookupIcon }) => (
                    <button
                      key={key}
                      onClick={() =>
                        onUpdate({ [key]: !siteClass[key as keyof SiteClassData] })
                      }
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                        siteClass[key as keyof SiteClassData]
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                          : "border-slate-700 text-slate-500 hover:border-slate-600"
                      )}
                    >
                      <HookupIcon className="w-4 h-4" />
                      <span className="text-sm">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* RV max length (only for RV sites) */}
              {siteClass.siteType === "rv" && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300 flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-slate-500" />
                    <span>Max RV Length (ft)</span>
                  </Label>
                  <Input
                    type="number"
                    value={siteClass.rigMaxLength || ""}
                    onChange={(e) =>
                      onUpdate({
                        rigMaxLength: parseInt(e.target.value) || undefined,
                      })
                    }
                    placeholder="45"
                    className="bg-slate-800/50 border-slate-700 text-white w-32"
                  />
                </div>
              )}

              {/* Pet friendly */}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <PawPrint className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300">Pet Friendly</span>
                </div>
                <Switch
                  checked={siteClass.petFriendly}
                  onCheckedChange={(checked) => onUpdate({ petFriendly: checked })}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SiteClasses({
  initialClasses = [],
  onSave,
  onNext,
  isLoading = false,
}: SiteClassesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [classes, setClasses] = useState<SiteClassData[]>(initialClasses);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(classes.length === 0);

  const addFromTemplate = (template: (typeof siteClassTemplates)[0]) => {
    const newClass: SiteClassData = {
      templateId: template.id,
      name: template.name,
      siteType: template.siteType,
      defaultRate: 50, // Default rate
      maxOccupancy: template.defaults.maxOccupancy,
      hookupsPower: template.defaults.hookupsPower,
      hookupsWater: template.defaults.hookupsWater,
      hookupsSewer: template.defaults.hookupsSewer,
      rigMaxLength: template.defaults.rigMaxLength,
      petFriendly: template.defaults.petFriendly,
    };
    setClasses((prev) => [...prev, newClass]);
    setShowTemplates(false);
  };

  const updateClass = (index: number, data: Partial<SiteClassData>) => {
    setClasses((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...data } : c))
    );
  };

  const removeClass = (index: number) => {
    setClasses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (classes.length === 0) return;
    setSaving(true);
    try {
      await onSave(classes);
      onNext();
    } catch (error) {
      console.error("Failed to save site classes:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Template picker */}
        <AnimatePresence mode="wait">
          {showTemplates && (
            <motion.div
              key="templates"
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">
                    Choose a site type to start
                  </h3>
                  <p className="text-sm text-slate-500">
                    Pick a template and customize it
                  </p>
                </div>
                {classes.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowTemplates(false)}
                    className="text-slate-400"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {siteClassTemplates.map((template, i) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={false}
                    onSelect={() => addFromTemplate(template)}
                    delay={i * 0.05}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing classes */}
        {!showTemplates && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0 }}
            animate={prefersReducedMotion ? {} : { opacity: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">
                  Your Site Types
                </h3>
                <p className="text-sm text-slate-500">
                  {classes.length} type{classes.length !== 1 ? "s" : ""} configured
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowTemplates(true)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Type
              </Button>
            </div>

            <AnimatePresence mode="popLayout">
              {classes.map((siteClass, index) => (
                <SiteClassCard
                  key={`${siteClass.templateId}-${index}`}
                  siteClass={siteClass}
                  onUpdate={(data) => updateClass(index, data)}
                  onRemove={() => removeClass(index)}
                  index={index}
                />
              ))}
            </AnimatePresence>

            {classes.length === 0 && (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                className="text-center py-12 text-slate-500"
              >
                <Tent className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No site types yet. Add one to continue.</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Continue button */}
        {classes.length > 0 && !showTemplates && (
          <motion.div
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="pt-4"
          >
            <Button
              onClick={handleSave}
              disabled={saving || isLoading}
              className={cn(
                "w-full py-6 text-lg font-semibold transition-all",
                "bg-gradient-to-r from-emerald-500 to-teal-500",
                "hover:from-emerald-400 hover:to-teal-400",
                "disabled:opacity-50"
              )}
            >
              {saving ? "Saving..." : "Continue to Add Sites"}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
