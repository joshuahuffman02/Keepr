"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Receipt,
  Plus,
  Trash2,
  DollarSign,
  Lock,
  PawPrint,
  ShoppingBag,
  X,
  Check,
  Info,
  ChevronRight,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface AddOnItem {
  id: string;
  name: string;
  priceCents: number;
  pricingType: "flat" | "per_night" | "per_person";
}

interface GlCodes {
  siteRevenue: string | null;
  bookingFees: string | null;
  petFees: string | null;
  storeSales: string | null;
  lateFees: string | null;
}

interface FeesAndAddonsData {
  bookingFeeCents: number | null;
  siteLockFeeCents: number | null;
  petFeeEnabled: boolean;
  petFeeCents: number | null;
  petFeeType: "per_pet_per_night" | "flat";
  addOnItems: AddOnItem[];
  glCodes?: GlCodes;
}

interface FeesAndAddonsProps {
  data: FeesAndAddonsData;
  onChange: (data: FeesAndAddonsData) => void;
  onNext: () => void;
  onBack: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// Common add-on presets
type AddOnPreset = Pick<AddOnItem, "name" | "priceCents" | "pricingType">;

const ADD_ON_PRESETS: AddOnPreset[] = [
  { name: "Firewood Bundle", priceCents: 800, pricingType: "flat" },
  { name: "Guest Day Pass", priceCents: 1000, pricingType: "per_person" },
  { name: "Golf Cart Rental", priceCents: 5000, pricingType: "per_night" },
  { name: "Extra Electricity", priceCents: 1500, pricingType: "per_night" },
  { name: "Kayak Rental", priceCents: 2500, pricingType: "per_night" },
  { name: "Bike Rental", priceCents: 1500, pricingType: "per_night" },
];

const pricingTypeValues: AddOnItem["pricingType"][] = ["flat", "per_night", "per_person"];
const petFeeTypeValues: FeesAndAddonsData["petFeeType"][] = ["per_pet_per_night", "flat"];

const isPricingType = (value: string): value is AddOnItem["pricingType"] =>
  pricingTypeValues.some((option) => option === value);

const isPetFeeType = (value: string): value is FeesAndAddonsData["petFeeType"] =>
  petFeeTypeValues.some((option) => option === value);

const PRICING_TYPE_LABELS: Record<AddOnItem["pricingType"], string> = {
  flat: "One-time",
  per_night: "Per night",
  per_person: "Per person",
};

export function FeesAndAddons({ data, onChange, onNext, onBack }: FeesAndAddonsProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGlCodes, setShowGlCodes] = useState(false);

  // New add-on form state
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemPricingType, setNewItemPricingType] = useState<AddOnItem["pricingType"]>("flat");

  // Booking fee enabled state
  const [bookingFeeEnabled, setBookingFeeEnabled] = useState(data.bookingFeeCents !== null);
  const [siteLockFeeEnabled, setSiteLockFeeEnabled] = useState(data.siteLockFeeCents !== null);

  const updateData = (updates: Partial<FeesAndAddonsData>) => {
    onChange({ ...data, ...updates });
  };

  const toggleBookingFee = (enabled: boolean) => {
    setBookingFeeEnabled(enabled);
    updateData({ bookingFeeCents: enabled ? 500 : null }); // Default $5
  };

  const toggleSiteLockFee = (enabled: boolean) => {
    setSiteLockFeeEnabled(enabled);
    updateData({ siteLockFeeCents: enabled ? 1000 : null }); // Default $10
  };

  const togglePetFee = (enabled: boolean) => {
    updateData({
      petFeeEnabled: enabled,
      petFeeCents: enabled ? 1000 : null, // Default $10
      petFeeType: enabled ? data.petFeeType : "per_pet_per_night",
    });
  };

  const updateBookingFee = (value: string) => {
    const cents = Math.round(parseFloat(value || "0") * 100);
    updateData({ bookingFeeCents: cents });
  };

  const updateSiteLockFee = (value: string) => {
    const cents = Math.round(parseFloat(value || "0") * 100);
    updateData({ siteLockFeeCents: cents });
  };

  const updatePetFee = (value: string) => {
    const cents = Math.round(parseFloat(value || "0") * 100);
    updateData({ petFeeCents: cents });
  };

  const updatePetFeeType = (type: "per_pet_per_night" | "flat") => {
    updateData({ petFeeType: type });
  };

  const addPresetItem = (preset: (typeof ADD_ON_PRESETS)[0]) => {
    // Don't add duplicates
    if (data.addOnItems.some((item) => item.name === preset.name)) return;

    const newItem: AddOnItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      name: preset.name,
      priceCents: preset.priceCents,
      pricingType: preset.pricingType,
    };

    updateData({ addOnItems: [...data.addOnItems, newItem] });
  };

  const addCustomItem = () => {
    if (!newItemName.trim() || !newItemPrice) return;

    const newItem: AddOnItem = {
      id: `temp-${Date.now()}-${Math.random()}`,
      name: newItemName.trim(),
      priceCents: Math.round(parseFloat(newItemPrice) * 100),
      pricingType: newItemPricingType,
    };

    updateData({ addOnItems: [...data.addOnItems, newItem] });

    // Reset form
    setNewItemName("");
    setNewItemPrice("");
    setNewItemPricingType("flat");
    setShowAddForm(false);
  };

  const removeItem = (id: string) => {
    updateData({
      addOnItems: data.addOnItems.filter((item) => item.id !== id),
    });
  };

  const updateItemPrice = (id: string, value: string) => {
    const cents = Math.round(parseFloat(value || "0") * 100);
    updateData({
      addOnItems: data.addOnItems.map((item) =>
        item.id === id ? { ...item, priceCents: cents } : item,
      ),
    });
  };

  const handleSkip = () => {
    onNext();
  };

  const updateGlCode = (field: keyof GlCodes, value: string) => {
    const currentGlCodes = data.glCodes || {
      siteRevenue: null,
      bookingFees: null,
      petFees: null,
      storeSales: null,
      lateFees: null,
    };
    updateData({
      glCodes: {
        ...currentGlCodes,
        [field]: value.trim() || null,
      },
    });
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
            <Receipt className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Fees & Add-ons</h2>
          <p className="text-slate-400">Configure booking fees, pet fees, and purchasable items</p>
        </motion.div>

        {/* Section 1: Booking Fees */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="space-y-4"
        >
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Booking Fees
          </h3>

          {/* Booking Fee */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Switch
                    checked={bookingFeeEnabled}
                    onCheckedChange={toggleBookingFee}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Label className="text-white font-medium cursor-pointer">Booking Fee</Label>
                </div>
                <p className="text-sm text-slate-400 ml-11">
                  Flat fee per booking (covers processing costs)
                </p>
              </div>

              {bookingFeeEnabled && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-slate-400">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.bookingFeeCents ? (data.bookingFeeCents / 100).toFixed(2) : ""}
                    onChange={(e) => updateBookingFee(e.target.value)}
                    className="w-24 bg-slate-800/50 border-slate-700 text-white text-right"
                    placeholder="0.00"
                  />
                </motion.div>
              )}
            </div>
          </div>

          {/* Site Lock Fee */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Switch
                    checked={siteLockFeeEnabled}
                    onCheckedChange={toggleSiteLockFee}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Label className="text-white font-medium cursor-pointer flex items-center gap-2">
                    Site Lock Fee
                    <Lock className="w-3.5 h-3.5 text-slate-500" />
                  </Label>
                </div>
                <p className="text-sm text-slate-400 ml-11">
                  Fee to guarantee a specific site number
                </p>
              </div>

              {siteLockFeeEnabled && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-slate-400">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.siteLockFeeCents ? (data.siteLockFeeCents / 100).toFixed(2) : ""}
                    onChange={(e) => updateSiteLockFee(e.target.value)}
                    className="w-24 bg-slate-800/50 border-slate-700 text-white text-right"
                    placeholder="0.00"
                  />
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Section 2: Pet Fees */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <PawPrint className="w-4 h-4" />
            Pet Fees
          </h3>

          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Switch
                    checked={data.petFeeEnabled}
                    onCheckedChange={togglePetFee}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Label className="text-white font-medium cursor-pointer">Pet Fee</Label>
                </div>
                <p className="text-sm text-slate-400 ml-11">Charge guests for bringing pets</p>
              </div>

              {data.petFeeEnabled && (
                <motion.div
                  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
                  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <span className="text-slate-400">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.petFeeCents ? (data.petFeeCents / 100).toFixed(2) : ""}
                    onChange={(e) => updatePetFee(e.target.value)}
                    className="w-24 bg-slate-800/50 border-slate-700 text-white text-right"
                    placeholder="0.00"
                  />
                </motion.div>
              )}
            </div>

            {data.petFeeEnabled && (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                className="ml-11 mt-3"
              >
                <Select
                  value={data.petFeeType}
                  onValueChange={(v) => {
                    if (isPetFeeType(v)) {
                      updatePetFeeType(v);
                    }
                  }}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_pet_per_night">Per pet, per night</SelectItem>
                    <SelectItem value="flat">Flat per stay</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Section 3: Inventory Items / Add-ons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              Inventory Items / Add-ons
            </h3>
          </div>

          {/* Quick add presets */}
          <div className="space-y-2">
            <Label className="text-sm text-slate-400">Quick Add</Label>
            <div className="flex flex-wrap gap-2">
              {ADD_ON_PRESETS.map((preset) => {
                const isAdded = data.addOnItems.some((item) => item.name === preset.name);
                return (
                  <button
                    key={preset.name}
                    onClick={() => addPresetItem(preset)}
                    disabled={isAdded}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                      isAdded
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800",
                    )}
                  >
                    {isAdded ? (
                      <Check className="w-3.5 h-3.5 inline-block mr-1.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 inline-block mr-1.5" />
                    )}
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current add-on items */}
          {data.addOnItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-slate-400">
                Your Add-ons ({data.addOnItems.length})
              </Label>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {data.addOnItems.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                      animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
                      exit={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-3 p-3 bg-slate-800/30 border border-slate-700 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-slate-500">
                          {PRICING_TYPE_LABELS[item.pricingType]}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(item.priceCents / 100).toFixed(2)}
                          onChange={(e) => updateItemPrice(item.id, e.target.value)}
                          className="w-20 px-2 py-1 text-right font-medium text-white bg-slate-700/50 border border-slate-600 rounded focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Add custom item */}
          <AnimatePresence mode="wait">
            {!showAddForm ? (
              <motion.button
                key="add-button"
                onClick={() => setShowAddForm(true)}
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                exit={prefersReducedMotion ? {} : { opacity: 0 }}
                className="w-full p-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Custom Item
              </motion.button>
            ) : (
              <motion.div
                key="add-form"
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? {} : { opacity: 0, y: -10 }}
                className="bg-slate-800/30 border border-slate-700 rounded-xl p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">Add Custom Item</h3>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="p-1 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-300">Item Name</Label>
                    <Input
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="e.g., Ice Bag, Propane Refill"
                      className="bg-slate-800/50 border-slate-700 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Price ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItemPrice}
                        onChange={(e) => setNewItemPrice(e.target.value)}
                        placeholder="0.00"
                        className="bg-slate-800/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-300">Pricing Type</Label>
                      <Select
                        value={newItemPricingType}
                        onValueChange={(v) => {
                          if (isPricingType(v)) {
                            setNewItemPricingType(v);
                          }
                        }}
                      >
                        <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">One-time</SelectItem>
                          <SelectItem value="per_night">Per night</SelectItem>
                          <SelectItem value="per_person">Per person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={addCustomItem}
                  disabled={!newItemName.trim() || !newItemPrice}
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
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
            <span className="text-slate-300 font-medium">All fees are optional.</span> You can
            configure these anytime in your dashboard. Add-ons will be visible to guests during
            booking.
          </div>
        </motion.div>

        {/* GL Codes Section (Collapsible) */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0 }}
          animate={prefersReducedMotion ? {} : { opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="border-t border-slate-700 pt-6"
        >
          <button
            onClick={() => setShowGlCodes(!showGlCodes)}
            className="flex items-center justify-between w-full text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                  Advanced: Accounting Setup
                </span>
                <span className="text-xs text-slate-500 ml-2">(Optional)</span>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "w-5 h-5 text-slate-500 transition-transform",
                showGlCodes && "rotate-180",
              )}
            />
          </button>

          <AnimatePresence>
            {showGlCodes && (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
                exit={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex gap-2">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      GL Codes help categorize revenue for your accountant or QuickBooks/Xero. Skip
                      this if you're not sure - you can set it up later in Settings.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">Site Revenue</Label>
                      <Input
                        value={data.glCodes?.siteRevenue || ""}
                        onChange={(e) => updateGlCode("siteRevenue", e.target.value)}
                        placeholder="e.g., 4000-SITES"
                        className="bg-slate-800/50 border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">Booking Fees</Label>
                      <Input
                        value={data.glCodes?.bookingFees || ""}
                        onChange={(e) => updateGlCode("bookingFees", e.target.value)}
                        placeholder="e.g., 4100-FEES"
                        className="bg-slate-800/50 border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">Pet Fees</Label>
                      <Input
                        value={data.glCodes?.petFees || ""}
                        onChange={(e) => updateGlCode("petFees", e.target.value)}
                        placeholder="e.g., 4200-PETS"
                        className="bg-slate-800/50 border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-slate-400">Store Sales</Label>
                      <Input
                        value={data.glCodes?.storeSales || ""}
                        onChange={(e) => updateGlCode("storeSales", e.target.value)}
                        placeholder="e.g., 4300-STORE"
                        className="bg-slate-800/50 border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-2 col-span-2 sm:col-span-1">
                      <Label className="text-xs text-slate-400">Late Fees</Label>
                      <Input
                        value={data.glCodes?.lateFees || ""}
                        onChange={(e) => updateGlCode("lateFees", e.target.value)}
                        placeholder="e.g., 4400-LATE"
                        className="bg-slate-800/50 border-slate-700 text-white text-sm"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-3"
        >
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1 py-6 text-lg font-medium border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Back
          </Button>

          <Button
            onClick={handleSkip}
            className={cn(
              "flex-1 py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
            )}
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
