"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MapPin, Phone, Mail, Globe, Upload, Check, ChevronDown, ChevronUp, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { US_TIMEZONES } from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { AmenityPicker } from "@/components/onboarding/AmenityPicker";
import { PARK_AMENITIES } from "@/lib/amenities";

export interface ParkProfileData {
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
  amenities: string[];
  bookingSources: string[];
  stayReasons: string[];
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

// Default booking sources
const DEFAULT_BOOKING_SOURCES = [
  "Google",
  "Facebook",
  "Instagram",
  "Friend/Referral",
  "Return Guest",
  "Yelp",
  "Hipcamp",
  "Airbnb",
  "Outdoorsy",
];

// Default stay reasons
const DEFAULT_STAY_REASONS = [
  "Vacation",
  "Family Visit",
  "Work/Remote",
  "Event",
  "Stopover",
  "Relocation",
];

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

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
      onClick={onToggle}
      className={cn(
        "relative px-3 py-2 rounded-lg border text-sm transition-all",
        selected
          ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800"
      )}
    >
      {selected && (
        <motion.div
          initial={prefersReducedMotion ? {} : { scale: 0 }}
          animate={prefersReducedMotion ? {} : { scale: 1 }}
          className="absolute -top-1 -right-1"
        >
          <Check className="w-3 h-3 text-emerald-400 bg-slate-900 rounded-full" />
        </motion.div>
      )}
      {label}
    </motion.button>
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
  const [stateOpen, setStateOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [bookingSourcesExpanded, setBookingSourcesExpanded] = useState(false);
  const [stayReasonsExpanded, setStayReasonsExpanded] = useState(false);
  const [customBookingSources, setCustomBookingSources] = useState("");
  const [customStayReasons, setCustomStayReasons] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    amenities: initialData?.amenities || [],
    bookingSources: initialData?.bookingSources || [],
    stayReasons: initialData?.stayReasons || [],
  });

  // Update data when initialData changes (e.g., when signup data loads)
  useEffect(() => {
    if (initialData) {
      setData((prev) => ({
        ...prev,
        name: initialData.name || prev.name,
        phone: initialData.phone || prev.phone,
        email: initialData.email || prev.email,
        website: initialData.website || prev.website,
        address1: initialData.address1 || prev.address1,
        city: initialData.city || prev.city,
        state: initialData.state || prev.state,
        postalCode: initialData.postalCode || prev.postalCode,
        timezone: initialData.timezone || prev.timezone,
        logoUrl: initialData.logoUrl || prev.logoUrl,
        amenities: initialData.amenities || prev.amenities,
        bookingSources: initialData.bookingSources || prev.bookingSources,
        stayReasons: initialData.stayReasons || prev.stayReasons,
      }));
    }
  }, [initialData]);

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

  // Helper to toggle booking source
  const toggleBookingSource = (source: string) => {
    setData((prev) => ({
      ...prev,
      bookingSources: prev.bookingSources.includes(source)
        ? prev.bookingSources.filter((s) => s !== source)
        : [...prev.bookingSources, source],
    }));
  };

  // Helper to toggle stay reason
  const toggleStayReason = (reason: string) => {
    setData((prev) => ({
      ...prev,
      stayReasons: prev.stayReasons.includes(reason)
        ? prev.stayReasons.filter((r) => r !== reason)
        : [...prev.stayReasons, reason],
    }));
  };

  // Merge custom booking sources when text area changes
  const handleCustomBookingSourcesChange = (value: string) => {
    setCustomBookingSources(value);
    const customLines = value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Keep default selections and add custom ones
    const defaultSelected = data.bookingSources.filter((s) =>
      DEFAULT_BOOKING_SOURCES.includes(s)
    );
    setData((prev) => ({
      ...prev,
      bookingSources: [...defaultSelected, ...customLines],
    }));
  };

  // Merge custom stay reasons when text area changes
  const handleCustomStayReasonsChange = (value: string) => {
    setCustomStayReasons(value);
    const customLines = value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Keep default selections and add custom ones
    const defaultSelected = data.stayReasons.filter((r) =>
      DEFAULT_STAY_REASONS.includes(r)
    );
    setData((prev) => ({
      ...prev,
      stayReasons: [...defaultSelected, ...customLines],
    }));
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploadingLogo(true);
    try {
      // For now, use local preview URL
      // In production, this would upload to S3/R2
      const previewUrl = URL.createObjectURL(file);
      setData((prev) => ({ ...prev, logoUrl: previewUrl }));
    } catch (error) {
      console.error("Logo upload failed:", error);
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = () => {
    setData((prev) => ({ ...prev, logoUrl: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave(data);
    } catch (error) {
      console.error("Failed to save park profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const selectedState = US_STATES.find((s) => s.value === data.state);

  return (
    <div className="max-w-2xl mx-auto px-4">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Logo upload */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-6"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          <div
            onClick={handleLogoClick}
            className={cn(
              "relative w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden cursor-pointer transition-all",
              data.logoUrl
                ? "border-emerald-500/50 bg-slate-800"
                : "border-slate-700 bg-slate-800 hover:border-emerald-500/50 group"
            )}
          >
            {uploadingLogo ? (
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            ) : data.logoUrl ? (
              <>
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLogo();
                  }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-400"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </>
            ) : (
              <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-white">Campground Logo</p>
            <p className="text-xs text-slate-500">
              {data.logoUrl ? "Click to change" : "Click to upload (optional)"}
            </p>
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
              placeholder="hello@keeprstay.com"
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
              <Popover open={stateOpen} onOpenChange={setStateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={stateOpen}
                    className="mt-2 w-full justify-between bg-slate-800/50 border-slate-700 text-white hover:bg-slate-800 hover:text-white"
                  >
                    {selectedState?.label || "Select state..."}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[200px] p-0 bg-slate-800 border-slate-700"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <Command className="bg-slate-800">
                    <CommandInput
                      placeholder="Search state..."
                      className="text-white"
                    />
                    <CommandList className="max-h-[200px]">
                      <CommandEmpty className="text-slate-400 py-2 text-center text-sm">
                        No state found.
                      </CommandEmpty>
                      <CommandGroup>
                        {US_STATES.map((state) => (
                          <CommandItem
                            key={state.value}
                            value={state.label}
                            onSelect={() => {
                              setData((prev) => ({ ...prev, state: state.value }));
                              setStateOpen(false);
                            }}
                            className="text-white hover:bg-slate-700 cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                data.state === state.value
                                  ? "opacity-100 text-emerald-400"
                                  : "opacity-0"
                              )}
                            />
                            {state.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
            <SelectContent className="bg-slate-800 border-slate-700">
              {US_TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value} className="text-white hover:bg-slate-700">
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            We auto-detected your timezone. Change if needed.
          </p>
        </motion.div>

        {/* Park Amenities */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border-t border-slate-700 pt-6"
        >
          <button
            type="button"
            onClick={() => setAmenitiesExpanded(!amenitiesExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-sm font-medium text-white">Park Amenities</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.amenities.length > 0
                  ? `${data.amenities.length} selected`
                  : "Select amenities your park offers"}
              </p>
            </div>
            {amenitiesExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {amenitiesExpanded && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
              className="mt-4"
            >
              <AmenityPicker
                options={PARK_AMENITIES}
                selected={data.amenities}
                onChange={(amenities) => setData((prev) => ({ ...prev, amenities }))}
                columns={4}
                size="sm"
              />
            </motion.div>
          )}
        </motion.div>

        {/* Booking Sources */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="border-t border-slate-700 pt-6"
        >
          <button
            type="button"
            onClick={() => setBookingSourcesExpanded(!bookingSourcesExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-sm font-medium text-white">
                How do guests find you? <span className="text-slate-500">(Optional)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.bookingSources.length > 0
                  ? `${data.bookingSources.length} selected`
                  : "Track where your bookings come from for reporting"}
              </p>
            </div>
            {bookingSourcesExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {bookingSourcesExpanded && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
              className="mt-4 space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                {DEFAULT_BOOKING_SOURCES.map((source) => (
                  <ToggleChip
                    key={source}
                    label={source}
                    selected={data.bookingSources.includes(source)}
                    onToggle={() => toggleBookingSource(source)}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">
                  Custom booking sources (one per line)
                </Label>
                <Textarea
                  value={customBookingSources}
                  onChange={(e) => handleCustomBookingSourcesChange(e.target.value)}
                  placeholder="Other Channel&#10;Partner Site&#10;Direct Mail"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] min-h-[80px]"
                />
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Stay Reasons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="border-t border-slate-700 pt-6"
        >
          <button
            type="button"
            onClick={() => setStayReasonsExpanded(!stayReasonsExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-sm font-medium text-white">
                Why do guests visit? <span className="text-slate-500">(Optional)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {data.stayReasons.length > 0
                  ? `${data.stayReasons.length} selected`
                  : "Track common reasons for stays"}
              </p>
            </div>
            {stayReasonsExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {stayReasonsExpanded && (
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, height: 0 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, height: "auto" }}
              className="mt-4 space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                {DEFAULT_STAY_REASONS.map((reason) => (
                  <ToggleChip
                    key={reason}
                    label={reason}
                    selected={data.stayReasons.includes(reason)}
                    onToggle={() => toggleStayReason(reason)}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-slate-300">
                  Custom stay reasons (one per line)
                </Label>
                <Textarea
                  value={customStayReasons}
                  onChange={(e) => handleCustomStayReasonsChange(e.target.value)}
                  placeholder="Extended Stay&#10;Emergency Housing&#10;Special Event"
                  className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)] min-h-[80px]"
                />
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Continue button */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
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
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Continue to Payments"
            )}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
