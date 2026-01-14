"use client";

import { useState, useId } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Car,
  Users,
  Dog,
  MapPin,
  Plus,
  X,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface GuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  // Expandable sections
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  vehicle?: {
    type: string;
    length: string;
    plateNumber: string;
    plateState: string;
  };
  adults: number;
  children: number;
  petCount: number;
  petTypes: string[];
}

interface CompactGuestFormProps {
  data: GuestFormData;
  onChange: (data: GuestFormData) => void;
  errors?: Record<string, string>;
  /** Site type determines which expandable sections to show */
  siteType?: string;
  /** Whether to show address section */
  showAddress?: boolean;
  /** Whether to show vehicle section */
  showVehicle?: boolean;
  /** Whether to show pet section */
  showPets?: boolean;
  className?: string;
}

// Auto-format phone number
const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Validate email format
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function CompactGuestForm({
  data,
  onChange,
  errors = {},
  siteType,
  showAddress = true,
  showVehicle = true,
  showPets = true,
  className,
}: CompactGuestFormProps) {
  const prefersReducedMotion = useReducedMotion();
  const [showAddressSection, setShowAddressSection] = useState(false);
  const [showVehicleSection, setShowVehicleSection] = useState(false);
  const [showGuestSection, setShowGuestSection] = useState(false);
  const [showPetSection, setShowPetSection] = useState(false);

  const formId = useId();

  // Determine if vehicle section is relevant
  const isRvOrTrailer =
    siteType?.toLowerCase().includes("rv") ||
    siteType?.toLowerCase().includes("trailer");

  const updateField = <K extends keyof GuestFormData>(
    field: K,
    value: GuestFormData[K]
  ) => {
    onChange({ ...data, [field]: value });
  };

  const updateAddress = (
    field: keyof NonNullable<GuestFormData["address"]>,
    value: string
  ) => {
    onChange({
      ...data,
      address: {
        street: data.address?.street || "",
        city: data.address?.city || "",
        state: data.address?.state || "",
        zipCode: data.address?.zipCode || "",
        country: data.address?.country || "US",
        [field]: value,
      },
    });
  };

  const updateVehicle = (
    field: keyof NonNullable<GuestFormData["vehicle"]>,
    value: string
  ) => {
    onChange({
      ...data,
      vehicle: {
        type: data.vehicle?.type || "",
        length: data.vehicle?.length || "",
        plateNumber: data.vehicle?.plateNumber || "",
        plateState: data.vehicle?.plateState || "",
        [field]: value,
      },
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Required Fields */}
      <div className="space-y-4">
        {/* Name row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-firstName`}>First Name</Label>
            <Input
              id={`${formId}-firstName`}
              value={data.firstName}
              onChange={(e) => updateField("firstName", e.target.value)}
              placeholder="John"
              className={cn(errors.firstName && "border-red-500")}
              aria-invalid={!!errors.firstName}
              aria-describedby={
                errors.firstName ? `${formId}-firstName-error` : undefined
              }
            />
            {errors.firstName && (
              <p
                id={`${formId}-firstName-error`}
                className="text-xs text-red-500 flex items-center gap-1"
                role="alert"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.firstName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-lastName`}>Last Name</Label>
            <Input
              id={`${formId}-lastName`}
              value={data.lastName}
              onChange={(e) => updateField("lastName", e.target.value)}
              placeholder="Doe"
              className={cn(errors.lastName && "border-red-500")}
              aria-invalid={!!errors.lastName}
            />
            {errors.lastName && (
              <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
                <AlertCircle className="h-3 w-3" />
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-email`}>Email</Label>
          <Input
            id={`${formId}-email`}
            type="email"
            value={data.email}
            onChange={(e) => updateField("email", e.target.value.toLowerCase())}
            placeholder="hello@keeprstay.com"
            className={cn(errors.email && "border-red-500")}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor={`${formId}-phone`}>Phone</Label>
          <Input
            id={`${formId}-phone`}
            type="tel"
            value={data.phone}
            onChange={(e) => updateField("phone", formatPhone(e.target.value))}
            placeholder="(555) 123-4567"
            className={cn(errors.phone && "border-red-500")}
            aria-invalid={!!errors.phone}
          />
          {errors.phone && (
            <p className="text-xs text-red-500 flex items-center gap-1" role="alert">
              <AlertCircle className="h-3 w-3" />
              {errors.phone}
            </p>
          )}
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-3">
        {/* Address Section */}
        {showAddress && (
          <ExpandableSection
            title="Home Address"
            description={
              data.address?.city && data.address?.state
                ? `${data.address.city}, ${data.address.state}`
                : "Where are you traveling from?"
            }
            icon={MapPin}
            isOpen={showAddressSection}
            onToggle={() => setShowAddressSection(!showAddressSection)}
            hasContent={!!data.address?.city || !!data.address?.zipCode}
          >
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor={`${formId}-street`}>Street Address</Label>
                <Input
                  id={`${formId}-street`}
                  value={data.address?.street || ""}
                  onChange={(e) => updateAddress("street", e.target.value)}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-city`}>City</Label>
                  <Input
                    id={`${formId}-city`}
                    value={data.address?.city || ""}
                    onChange={(e) => updateAddress("city", e.target.value)}
                    placeholder="Sacramento"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${formId}-state`}>State</Label>
                  <Input
                    id={`${formId}-state`}
                    value={data.address?.state || ""}
                    onChange={(e) =>
                      updateAddress("state", e.target.value.toUpperCase())
                    }
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-zipCode`}>ZIP Code</Label>
                  <Input
                    id={`${formId}-zipCode`}
                    value={data.address?.zipCode || ""}
                    onChange={(e) => updateAddress("zipCode", e.target.value)}
                    placeholder="95814"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${formId}-country`}>Country</Label>
                  <Select
                    value={data.address?.country || "US"}
                    onValueChange={(v) => updateAddress("country", v)}
                  >
                    <SelectTrigger id={`${formId}-country`}>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="MX">Mexico</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </ExpandableSection>
        )}

        {/* Vehicle Section */}
        {showVehicle && (
          <ExpandableSection
            title="Vehicle Information"
            description={isRvOrTrailer ? "RV or trailer details" : "Optional"}
            icon={Car}
            isOpen={showVehicleSection}
            onToggle={() => setShowVehicleSection(!showVehicleSection)}
            hasContent={!!data.vehicle?.type}
          >
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-vehicleType`}>Vehicle Type</Label>
                  <Select
                    value={data.vehicle?.type || ""}
                    onValueChange={(v) => updateVehicle("type", v)}
                  >
                    <SelectTrigger id={`${formId}-vehicleType`}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motorhome">Motorhome</SelectItem>
                      <SelectItem value="travel_trailer">Travel Trailer</SelectItem>
                      <SelectItem value="fifth_wheel">Fifth Wheel</SelectItem>
                      <SelectItem value="popup">Pop-up Camper</SelectItem>
                      <SelectItem value="van">Van / Campervan</SelectItem>
                      <SelectItem value="truck_camper">Truck Camper</SelectItem>
                      <SelectItem value="tent">Tent (no vehicle)</SelectItem>
                      <SelectItem value="car">Car</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${formId}-vehicleLength`}>
                    Length (feet)
                  </Label>
                  <Input
                    id={`${formId}-vehicleLength`}
                    type="number"
                    value={data.vehicle?.length || ""}
                    onChange={(e) => updateVehicle("length", e.target.value)}
                    placeholder="25"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`${formId}-plateNumber`}>License Plate</Label>
                  <Input
                    id={`${formId}-plateNumber`}
                    value={data.vehicle?.plateNumber || ""}
                    onChange={(e) =>
                      updateVehicle("plateNumber", e.target.value.toUpperCase())
                    }
                    placeholder="ABC1234"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${formId}-plateState`}>State</Label>
                  <Input
                    id={`${formId}-plateState`}
                    value={data.vehicle?.plateState || ""}
                    onChange={(e) =>
                      updateVehicle("plateState", e.target.value.toUpperCase())
                    }
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </ExpandableSection>
        )}

        {/* Additional Guests Section */}
        <ExpandableSection
          title="Guest Details"
          description={`${data.adults} adult${data.adults !== 1 ? "s" : ""}${data.children > 0 ? `, ${data.children} child${data.children !== 1 ? "ren" : ""}` : ""}`}
          icon={Users}
          isOpen={showGuestSection}
          onToggle={() => setShowGuestSection(!showGuestSection)}
          hasContent={data.adults > 1 || data.children > 0}
        >
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adults</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() =>
                      updateField("adults", Math.max(1, data.adults - 1))
                    }
                    disabled={data.adults <= 1}
                    aria-label="Decrease adults"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {data.adults}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => updateField("adults", data.adults + 1)}
                    aria-label="Increase adults"
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Children</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() =>
                      updateField("children", Math.max(0, data.children - 1))
                    }
                    disabled={data.children <= 0}
                    aria-label="Decrease children"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {data.children}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => updateField("children", data.children + 1)}
                    aria-label="Increase children"
                  >
                    +
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </ExpandableSection>

        {/* Pets Section */}
        {showPets && (
          <ExpandableSection
            title="Pets"
            description={
              data.petCount > 0
                ? `${data.petCount} pet${data.petCount !== 1 ? "s" : ""}`
                : "Add pets to your reservation"
            }
            icon={Dog}
            isOpen={showPetSection}
            onToggle={() => setShowPetSection(!showPetSection)}
            hasContent={data.petCount > 0}
          >
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Number of Pets</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() =>
                      updateField("petCount", Math.max(0, data.petCount - 1))
                    }
                    disabled={data.petCount <= 0}
                    aria-label="Decrease pets"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {data.petCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10"
                    onClick={() => updateField("petCount", data.petCount + 1)}
                    aria-label="Increase pets"
                  >
                    +
                  </Button>
                </div>
              </div>

              {data.petCount > 0 && (
                <div className="space-y-2">
                  <Label>Pet Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Dog", "Cat", "Other"].map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant={
                          data.petTypes.includes(type) ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          const newTypes = data.petTypes.includes(type)
                            ? data.petTypes.filter((t) => t !== type)
                            : [...data.petTypes, type];
                          updateField("petTypes", newTypes);
                        }}
                        className={cn(
                          data.petTypes.includes(type) &&
                            "bg-emerald-600 hover:bg-emerald-700"
                        )}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ExpandableSection>
        )}
      </div>
    </div>
  );
}

/**
 * Reusable expandable section component
 */
function ExpandableSection({
  title,
  description,
  icon: Icon,
  isOpen,
  onToggle,
  hasContent,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Car;
  isOpen: boolean;
  onToggle: () => void;
  hasContent: boolean;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isOpen ? "border-border bg-muted/50" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors"
      >
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
            hasContent ? "bg-emerald-100" : "bg-muted"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              hasContent ? "text-emerald-600" : "text-muted-foreground"
            )}
          />
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{title}</span>
            {hasContent && (
              <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Added
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
