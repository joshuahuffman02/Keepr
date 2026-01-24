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
  ArrowLeft,
  ArrowRight,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SiteTypeSelector, type SiteBaseType } from "@/components/onboarding/SiteTypeSelector";
import { RvConfigPanel, type RvOrientation } from "@/components/onboarding/RvConfigPanel";
import { AmenityPicker } from "@/components/onboarding/AmenityPicker";
import { SiteClassPhotoUpload } from "@/components/onboarding/SiteClassPhotoUpload";
import { EquipmentTypePicker } from "@/components/onboarding/EquipmentTypePicker";
import { GuestPricingPanel } from "@/components/onboarding/GuestPricingPanel";
import { RentalTypeSelector, type RentalType } from "@/components/onboarding/RentalTypeSelector";
import {
  MeteredUtilitiesPanel,
  type MeteredType,
  type MeteredBillingMode,
} from "@/components/onboarding/MeteredUtilitiesPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SITE_CLASS_AMENITIES } from "@/lib/amenities";

export interface SiteClassData {
  id?: string;
  name: string;
  siteType: SiteBaseType;
  // Rental type
  rentalType: RentalType;
  // RV-specific
  rvOrientation?: RvOrientation;
  electricAmps: number[];
  equipmentTypes: string[];
  slideOutsAccepted: string | null;
  // Hookups
  hookupsWater: boolean;
  hookupsSewer: boolean;
  // Common
  defaultRate: number;
  maxOccupancy: number;
  petFriendly: boolean;
  // Guest pricing
  occupantsIncluded: number;
  extraAdultFee: number | null;
  extraChildFee: number | null;
  // Amenities and photos
  amenityTags: string[];
  photos: string[];
  // Metered utilities
  meteredEnabled: boolean;
  meteredType: MeteredType | null;
  meteredBillingMode: MeteredBillingMode | null;
}

interface SiteClassesProps {
  initialClasses?: SiteClassData[];
  onSave: (classes: SiteClassData[]) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

type WizardStep = "type" | "config" | "details";

const iconMap: Record<SiteBaseType, React.ElementType> = {
  rv: Truck,
  tent: Tent,
  cabin: Home,
  glamping: Sparkles,
};

// Generate a smart default name based on configuration
function generateClassName(data: Partial<SiteClassData>): string {
  if (!data.siteType) return "";

  if (data.siteType === "rv") {
    const parts: string[] = [];

    // Orientation
    if (data.rvOrientation === "pull_through") {
      parts.push("Pull-Through");
    } else {
      parts.push("Back-in");
    }

    // Hookups
    const hookups: string[] = [];
    if (data.electricAmps && data.electricAmps.length > 0) {
      hookups.push(`${data.electricAmps.join("/")}A`);
    }
    if (data.hookupsWater) hookups.push("W");
    if (data.hookupsSewer) hookups.push("S");

    if (hookups.length === 0) {
      parts.push("Dry Camping");
    } else if (
      data.hookupsWater &&
      data.hookupsSewer &&
      data.electricAmps &&
      data.electricAmps.length > 0
    ) {
      parts.push(`Full Hookup (${data.electricAmps.join("/")}A)`);
    } else {
      parts.push(hookups.join("/"));
    }

    return parts.join(" RV - ");
  }

  if (data.siteType === "tent") {
    if (data.hookupsWater) return "Improved Tent Site";
    return "Primitive Tent Site";
  }

  if (data.siteType === "cabin") {
    return "Cabin";
  }

  if (data.siteType === "glamping") {
    return "Glamping Unit";
  }

  return "";
}

// Default values by type
function getDefaultsForType(type: SiteBaseType): Partial<SiteClassData> {
  switch (type) {
    case "rv":
      return {
        rentalType: "transient",
        rvOrientation: "back_in",
        electricAmps: [30],
        equipmentTypes: [],
        slideOutsAccepted: null,
        hookupsWater: true,
        hookupsSewer: false,
        maxOccupancy: 6,
        petFriendly: true,
        defaultRate: 55,
        occupantsIncluded: 2,
        extraAdultFee: null,
        extraChildFee: null,
        amenityTags: [],
        photos: [],
        meteredEnabled: false,
        meteredType: null,
        meteredBillingMode: null,
      };
    case "tent":
      return {
        rentalType: "transient",
        electricAmps: [],
        equipmentTypes: [],
        slideOutsAccepted: null,
        hookupsWater: false,
        hookupsSewer: false,
        maxOccupancy: 4,
        petFriendly: true,
        defaultRate: 25,
        occupantsIncluded: 2,
        extraAdultFee: null,
        extraChildFee: null,
        amenityTags: ["fire_pit"],
        photos: [],
        meteredEnabled: false,
        meteredType: null,
        meteredBillingMode: null,
      };
    case "cabin":
      return {
        rentalType: "transient",
        electricAmps: [],
        equipmentTypes: [],
        slideOutsAccepted: null,
        hookupsWater: true,
        hookupsSewer: true,
        maxOccupancy: 4,
        petFriendly: false,
        defaultRate: 125,
        occupantsIncluded: 2,
        extraAdultFee: null,
        extraChildFee: null,
        amenityTags: [],
        photos: [],
        meteredEnabled: false,
        meteredType: null,
        meteredBillingMode: null,
      };
    case "glamping":
      return {
        rentalType: "transient",
        electricAmps: [],
        equipmentTypes: [],
        slideOutsAccepted: null,
        hookupsWater: false,
        hookupsSewer: false,
        maxOccupancy: 4,
        petFriendly: false,
        defaultRate: 150,
        occupantsIncluded: 2,
        extraAdultFee: null,
        extraChildFee: null,
        amenityTags: [],
        photos: [],
        meteredEnabled: false,
        meteredType: null,
        meteredBillingMode: null,
      };
  }
}

// Site Class Creation Wizard
function SiteClassWizard({
  onComplete,
  onCancel,
}: {
  onComplete: (data: SiteClassData) => void;
  onCancel: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<WizardStep>("type");
  const [data, setData] = useState<Partial<SiteClassData>>({
    rentalType: "transient",
    electricAmps: [],
    equipmentTypes: [],
    slideOutsAccepted: null,
    hookupsWater: false,
    hookupsSewer: false,
    petFriendly: true,
    maxOccupancy: 4,
    defaultRate: 50,
    occupantsIncluded: 2,
    extraAdultFee: null,
    extraChildFee: null,
    amenityTags: [],
    photos: [],
    meteredEnabled: false,
    meteredType: null,
    meteredBillingMode: null,
  });

  const buildSiteClassData = (partial: Partial<SiteClassData>): SiteClassData | null => {
    if (
      !partial.siteType ||
      !partial.name ||
      !partial.rentalType ||
      typeof partial.defaultRate !== "number" ||
      typeof partial.maxOccupancy !== "number"
    ) {
      return null;
    }

    return {
      id: partial.id,
      name: partial.name,
      siteType: partial.siteType,
      rentalType: partial.rentalType,
      rvOrientation: partial.rvOrientation,
      electricAmps: partial.electricAmps ?? [],
      equipmentTypes: partial.equipmentTypes ?? [],
      slideOutsAccepted: partial.slideOutsAccepted ?? null,
      hookupsWater: partial.hookupsWater ?? false,
      hookupsSewer: partial.hookupsSewer ?? false,
      defaultRate: partial.defaultRate,
      maxOccupancy: partial.maxOccupancy,
      petFriendly: partial.petFriendly ?? true,
      occupantsIncluded: partial.occupantsIncluded ?? 2,
      extraAdultFee: partial.extraAdultFee ?? null,
      extraChildFee: partial.extraChildFee ?? null,
      amenityTags: partial.amenityTags ?? [],
      photos: partial.photos ?? [],
      meteredEnabled: partial.meteredEnabled ?? false,
      meteredType: partial.meteredType ?? null,
      meteredBillingMode: partial.meteredBillingMode ?? null,
    };
  };

  const handleTypeSelect = (type: SiteBaseType) => {
    const defaults = getDefaultsForType(type);
    const newData = { ...data, siteType: type, ...defaults };
    newData.name = generateClassName(newData);
    setData(newData);

    // Skip config step for non-RV types
    if (type !== "rv") {
      setStep("details");
    } else {
      setStep("config");
    }
  };

  const handleConfigNext = () => {
    // Update name based on current config
    const newName = generateClassName(data);
    setData((prev) => ({ ...prev, name: newName }));
    setStep("details");
  };

  const handleComplete = () => {
    const completed = buildSiteClassData(data);
    if (!completed) return;
    onComplete(completed);
  };

  const canComplete = data.siteType && data.name && data.rentalType && data.maxOccupancy;

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["type", "config", "details"].map((s, i) => {
          const isActive = s === step;
          const isPast =
            (step === "config" && s === "type") ||
            (step === "details" && (s === "type" || s === "config"));
          const showConfig = data.siteType === "rv";

          // Hide config step indicator for non-RV
          if (s === "config" && !showConfig && step !== "config") return null;

          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  isActive
                    ? "bg-emerald-500 text-white"
                    : isPast
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-slate-700 text-slate-400",
                )}
              >
                {isPast ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < 2 && (s !== "config" || showConfig) && (
                <div className={cn("w-8 h-0.5", isPast ? "bg-emerald-500" : "bg-slate-700")} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Type Selection */}
        {step === "type" && (
          <motion.div
            key="type"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-slate-200">Rental Type</h3>
              <RentalTypeSelector
                value={data.rentalType || "transient"}
                onChange={(rentalType) => setData((prev) => ({ ...prev, rentalType }))}
              />
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-medium text-slate-200">Site Type</h3>
              <SiteTypeSelector selected={data.siteType || null} onSelect={handleTypeSelect} />
            </div>
          </motion.div>
        )}

        {/* Step 2: RV Configuration (RV only) */}
        {step === "config" && data.siteType === "rv" && (
          <motion.div
            key="config"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">RV Site Configuration</h3>
              <Button variant="ghost" onClick={() => setStep("type")} className="text-slate-400">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>

            <RvConfigPanel
              orientation={data.rvOrientation || null}
              onOrientationChange={(orientation) =>
                setData((prev) => ({ ...prev, rvOrientation: orientation }))
              }
              electricAmps={data.electricAmps || []}
              onElectricAmpsChange={(amps) => setData((prev) => ({ ...prev, electricAmps: amps }))}
              hookupsWater={data.hookupsWater || false}
              onWaterChange={(value) => setData((prev) => ({ ...prev, hookupsWater: value }))}
              hookupsSewer={data.hookupsSewer || false}
              onSewerChange={(value) => setData((prev) => ({ ...prev, hookupsSewer: value }))}
            />

            {/* Equipment Types - RV only */}
            <div className="space-y-3">
              <Label className="text-sm text-slate-300">Accepted Equipment Types</Label>
              <EquipmentTypePicker
                selected={data.equipmentTypes || []}
                onChange={(types) => setData((prev) => ({ ...prev, equipmentTypes: types }))}
              />
              <p className="text-xs text-slate-500">
                Select which types of RVs can book this site type
              </p>
            </div>

            {/* Slide-outs Accepted - RV only */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-300">Slide-outs Accepted</Label>
              <Select
                value={data.slideOutsAccepted || "any"}
                onValueChange={(value) =>
                  setData((prev) => ({
                    ...prev,
                    slideOutsAccepted: value === "any" ? null : value,
                  }))
                }
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Select slide-out policy" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="any" className="text-white hover:bg-slate-700">
                    Any (No restrictions)
                  </SelectItem>
                  <SelectItem value="one_side" className="text-white hover:bg-slate-700">
                    One side only
                  </SelectItem>
                  <SelectItem value="both_sides" className="text-white hover:bg-slate-700">
                    Both sides allowed
                  </SelectItem>
                  <SelectItem value="none" className="text-white hover:bg-slate-700">
                    No slide-outs
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Specify if this site accommodates RV slide-outs
              </p>
            </div>

            <Button
              onClick={handleConfigNext}
              disabled={!data.rvOrientation}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 3: Details */}
        {step === "details" && (
          <motion.div
            key="details"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Site Type Details</h3>
              <Button
                variant="ghost"
                onClick={() => setStep(data.siteType === "rv" ? "config" : "type")}
                className="text-slate-400"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </div>

            {/* Name with auto-generated suggestion */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-300">Name</Label>
              <Input
                value={data.name || ""}
                onChange={(e) => setData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Enter a name for this site type"
                className="bg-slate-800/50 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                Auto-generated based on configuration. Feel free to edit.
              </p>
            </div>

            {/* Max occupancy */}
            <div className="space-y-2">
              <Label className="text-sm text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                Max Guests
              </Label>
              <Input
                type="number"
                value={data.maxOccupancy || ""}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, maxOccupancy: parseInt(e.target.value) || 1 }))
                }
                placeholder="6"
                className="bg-slate-800/50 border-slate-700 text-white"
              />
            </div>

            {/* Pet friendly */}
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/30 border border-slate-700">
              <div className="flex items-center gap-3">
                <PawPrint className="w-5 h-5 text-slate-400" />
                <span className="text-slate-300">Pet Friendly</span>
              </div>
              <Switch
                checked={data.petFriendly || false}
                onCheckedChange={(checked) =>
                  setData((prev) => ({ ...prev, petFriendly: checked }))
                }
              />
            </div>

            {/* Metered Utilities - show for RV and tent sites primarily */}
            <MeteredUtilitiesPanel
              enabled={data.meteredEnabled || false}
              onEnabledChange={(enabled) => {
                setData((prev) => ({
                  ...prev,
                  meteredEnabled: enabled,
                  meteredType: enabled && !prev.meteredType ? "power" : prev.meteredType,
                  meteredBillingMode:
                    enabled && !prev.meteredBillingMode ? "per_reading" : prev.meteredBillingMode,
                }));
              }}
              type={data.meteredType || null}
              onTypeChange={(type) => setData((prev) => ({ ...prev, meteredType: type }))}
              billingMode={data.meteredBillingMode || null}
              onBillingModeChange={(mode) =>
                setData((prev) => ({ ...prev, meteredBillingMode: mode }))
              }
            />

            {/* Guest Pricing Panel */}
            <GuestPricingPanel
              occupantsIncluded={data.occupantsIncluded || 2}
              extraAdultFee={data.extraAdultFee ?? null}
              extraChildFee={data.extraChildFee ?? null}
              onChange={({ occupantsIncluded, extraAdultFee, extraChildFee }) =>
                setData((prev) => ({
                  ...prev,
                  occupantsIncluded,
                  extraAdultFee,
                  extraChildFee,
                }))
              }
            />

            {/* Site Amenities */}
            <div className="space-y-3">
              <Label className="text-sm text-slate-300">Site Amenities</Label>
              <AmenityPicker
                options={SITE_CLASS_AMENITIES}
                selected={data.amenityTags || []}
                onChange={(tags) => setData((prev) => ({ ...prev, amenityTags: tags }))}
                columns={4}
                size="sm"
              />
            </div>

            {/* Photos */}
            <div className="space-y-3">
              <Label className="text-sm text-slate-300">Photos (Optional)</Label>
              <SiteClassPhotoUpload
                photos={data.photos || []}
                onPhotosChange={(photos) => setData((prev) => ({ ...prev, photos }))}
              />
              <p className="text-xs text-slate-500">
                Add photos of this site type. You can add individual site photos later in your
                dashboard.
              </p>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <h4 className="text-sm font-medium text-slate-400 mb-3">Summary</h4>
              <div className="flex items-center gap-3">
                {data.siteType && (
                  <>
                    {(() => {
                      const Icon = iconMap[data.siteType];
                      return (
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-emerald-400" />
                        </div>
                      );
                    })()}
                    <div className="flex-1">
                      <p className="font-medium text-white">{data.name || "Unnamed"}</p>
                      <p className="text-sm text-slate-500">
                        {data.maxOccupancy} guests max
                        {data.siteType === "rv" &&
                          data.electricAmps &&
                          data.electricAmps.length > 0 && <> • {data.electricAmps.join("/")}A</>}
                        {data.hookupsWater && " • Water"}
                        {data.hookupsSewer && " • Sewer"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1 border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleComplete}
                disabled={!canComplete}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400"
              >
                <Check className="w-4 h-4 mr-2" />
                Add Site Type
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Summary card for created site classes
function SiteClassCard({
  siteClass,
  onEdit,
  onRemove,
}: {
  siteClass: SiteClassData;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = iconMap[siteClass.siteType] || Tent;

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? {} : { opacity: 0, x: -50 }}
      transition={SPRING_CONFIG}
      className="flex items-center justify-between p-4 border border-slate-700 rounded-xl bg-slate-800/30"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <p className="font-medium text-white">{siteClass.name}</p>
          <p className="text-sm text-slate-500">
            {siteClass.maxOccupancy} guests max
            {siteClass.siteType === "rv" && siteClass.electricAmps.length > 0 && (
              <>
                {" "}
                • <Zap className="w-3 h-3 inline text-yellow-400" />{" "}
                {siteClass.electricAmps.join("/")}A
              </>
            )}
            {siteClass.hookupsWater && (
              <>
                {" "}
                • <Droplets className="w-3 h-3 inline text-blue-400" />
              </>
            )}
            {siteClass.hookupsSewer && (
              <>
                {" "}
                • <Trash2 className="w-3 h-3 inline text-slate-400" />
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-2 text-slate-500 hover:text-red-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
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
  const [classes, setClasses] = useState<SiteClassData[]>(
    initialClasses.map((c) => ({
      ...c,
      rentalType: c.rentalType || "transient",
      electricAmps: c.electricAmps || [],
      equipmentTypes: c.equipmentTypes || [],
      slideOutsAccepted: c.slideOutsAccepted || null,
      occupantsIncluded: c.occupantsIncluded || 2,
      extraAdultFee: c.extraAdultFee || null,
      extraChildFee: c.extraChildFee || null,
      amenityTags: c.amenityTags || [],
      photos: c.photos || [],
      meteredEnabled: c.meteredEnabled || false,
      meteredType: c.meteredType || null,
      meteredBillingMode: c.meteredBillingMode || null,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [showWizard, setShowWizard] = useState(classes.length === 0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleAddClass = (data: SiteClassData) => {
    if (editingIndex !== null) {
      setClasses((prev) => prev.map((c, i) => (i === editingIndex ? data : c)));
      setEditingIndex(null);
    } else {
      setClasses((prev) => [...prev, data]);
    }
    setShowWizard(false);
  };

  const handleRemove = (index: number) => {
    setClasses((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setShowWizard(true);
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
        <AnimatePresence mode="wait">
          {showWizard ? (
            <SiteClassWizard
              key="wizard"
              onComplete={handleAddClass}
              onCancel={() => {
                setShowWizard(false);
                setEditingIndex(null);
              }}
            />
          ) : (
            <motion.div
              key="list"
              initial={prefersReducedMotion ? {} : { opacity: 0 }}
              animate={prefersReducedMotion ? {} : { opacity: 1 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white">Your Site Types</h3>
                  <p className="text-sm text-slate-500">
                    {classes.length} type{classes.length !== 1 ? "s" : ""} configured
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowWizard(true)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Type
                </Button>
              </div>

              <AnimatePresence mode="popLayout">
                {classes.map((siteClass, index) => (
                  <SiteClassCard
                    key={`${siteClass.siteType}-${index}`}
                    siteClass={siteClass}
                    onEdit={() => handleEdit(index)}
                    onRemove={() => handleRemove(index)}
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
        </AnimatePresence>

        {/* Continue button */}
        {classes.length > 0 && !showWizard && (
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
                "disabled:opacity-50",
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
