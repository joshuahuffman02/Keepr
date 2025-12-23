"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Phone, Mail, Globe, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_TIMEZONES } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

interface ParkProfileData {
  name: string;
  phone: string;
  email: string;
  website?: string;
  address1: string;
  city: string;
  state: string;
  postalCode: string;
  timezone: string;
  logoUrl?: string;
}

interface ParkProfileProps {
  initialData?: Partial<ParkProfileData>;
  onSave: (data: ParkProfileData) => Promise<void>;
  onNext: () => void;
  isLoading?: boolean;
}

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
};

// US States dropdown data
const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

function ValidatedField({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [touched, setTouched] = useState(false);
  const isValid = !required || value.trim().length > 0;
  const showCheck = touched && isValid && value.length > 0;

  return (
    <div className="space-y-2">
      <Label className="text-sm text-slate-300 flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-500" />
        {label}
        {required && <span className="text-red-400">*</span>}
      </Label>
      <div className="relative">
        <Input
          type={type}
          value={value}
          onChange={(e) => {
            if (!touched) setTouched(true);
            onChange(e.target.value);
          }}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={cn(
            "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 pr-10",
            "transition-all duration-200",
            "focus:bg-slate-800 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
            showCheck && "border-emerald-500/50 focus:border-emerald-500"
          )}
        />
        {showCheck && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0.1 } : SPRING_CONFIG}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <Check className="h-5 w-5 text-emerald-400" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function ParkProfile({
  initialData,
  onSave,
  onNext,
  isLoading = false,
}: ParkProfileProps) {
  const prefersReducedMotion = useReducedMotion();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ParkProfileData>({
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    website: initialData?.website || "",
    address1: initialData?.address1 || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    postalCode: initialData?.postalCode || "",
    timezone: initialData?.timezone || "",
    logoUrl: initialData?.logoUrl || "",
  });

  // Try to detect timezone on mount
  useEffect(() => {
    if (!data.timezone) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const match = US_TIMEZONES.find((tz) => tz.value === detected);
        if (match) {
          setData((prev) => ({ ...prev, timezone: match.value }));
        }
      } catch {
        // Ignore detection failure
      }
    }
  }, []);

  const isValid =
    data.name.trim() &&
    data.phone.trim() &&
    data.email.trim() &&
    data.address1.trim() &&
    data.city.trim() &&
    data.state &&
    data.postalCode.trim() &&
    data.timezone;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      await onSave(data);
      onNext();
    } catch (error) {
      console.error("Failed to save park profile:", error);
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
        {/* Logo upload (optional) */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-6"
        >
          <div className="w-20 h-20 rounded-xl bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden group hover:border-emerald-500/50 transition-colors cursor-pointer">
            {data.logoUrl ? (
              <img
                src={data.logoUrl}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">Campground Logo</p>
            <p className="text-xs text-slate-500">Optional - Add later in settings</p>
          </div>
        </motion.div>

        {/* Basic info */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid gap-4"
        >
          <ValidatedField
            label="Campground Name"
            icon={MapPin}
            value={data.name}
            onChange={(v) => setData((prev) => ({ ...prev, name: v }))}
            placeholder="Sunny Acres RV Park"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <ValidatedField
              label="Phone"
              icon={Phone}
              value={data.phone}
              onChange={(v) => setData((prev) => ({ ...prev, phone: v }))}
              type="tel"
              placeholder="(555) 123-4567"
              required
            />
            <ValidatedField
              label="Email"
              icon={Mail}
              value={data.email}
              onChange={(v) => setData((prev) => ({ ...prev, email: v }))}
              type="email"
              placeholder="info@sunnyacres.com"
              required
            />
          </div>

          <ValidatedField
            label="Website"
            icon={Globe}
            value={data.website || ""}
            onChange={(v) => setData((prev) => ({ ...prev, website: v }))}
            placeholder="https://sunnyacres.com"
          />
        </motion.div>

        {/* Address */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <h3 className="text-sm font-medium text-white">Location</h3>

          <ValidatedField
            label="Street Address"
            icon={MapPin}
            value={data.address1}
            onChange={(v) => setData((prev) => ({ ...prev, address1: v }))}
            placeholder="123 Campground Lane"
            required
          />

          <div className="grid grid-cols-6 gap-4">
            <div className="col-span-2">
              <Label className="text-sm text-slate-300">
                City <span className="text-red-400">*</span>
              </Label>
              <Input
                value={data.city}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, city: e.target.value }))
                }
                placeholder="Springfield"
                className="mt-2 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
              />
            </div>

            <div className="col-span-2">
              <Label className="text-sm text-slate-300">
                State <span className="text-red-400">*</span>
              </Label>
              <Select
                value={data.state}
                onValueChange={(v) => setData((prev) => ({ ...prev, state: v }))}
              >
                <SelectTrigger className="mt-2 bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label className="text-sm text-slate-300">
                ZIP <span className="text-red-400">*</span>
              </Label>
              <Input
                value={data.postalCode}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, postalCode: e.target.value }))
                }
                placeholder="12345"
                className="mt-2 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]"
              />
            </div>
          </div>
        </motion.div>

        {/* Timezone */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Label className="text-sm text-slate-300">
            Timezone <span className="text-red-400">*</span>
          </Label>
          <Select
            value={data.timezone}
            onValueChange={(v) => setData((prev) => ({ ...prev, timezone: v }))}
          >
            <SelectTrigger className="mt-2 bg-slate-800/50 border-slate-700 text-white">
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>
              {US_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            We auto-detected your timezone. Change if needed.
          </p>
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="pt-4"
        >
          <Button
            onClick={handleSave}
            disabled={!isValid || saving || isLoading}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {saving ? "Saving..." : "Continue to Payments"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
