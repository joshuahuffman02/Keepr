"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { WaitlistDialog } from "@/components/waitlist/WaitlistDialog";
import { trackEvent } from "@/lib/analytics";
import {
  Check,
  Moon,
  CalendarDays,
  Tent,
  Users,
  Lock,
  Frown,
  CheckCircle,
  Shield,
  CreditCard,
  Star,
  Mail,
  Calendar,
  MapPin,
  Copy,
  ArrowLeft,
  Printer,
  Share2,
  AlertCircle,
  Loader2,
  Zap,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { RoundUpForCharity } from "@/components/checkout/RoundUpForCharity";
import { NaturalLanguageSearch } from "@/components/booking/NaturalLanguageSearch";

// Import new booking v2 components
import {
  BookingLayout,
  BookingProgressBar,
  BookingBackButton,
  PriceSummary,
  PriceSummaryPlaceholder,
  MobileBookingFooter,
  MobileBookingFooterPlaceholder,
  SiteClassCard,
  SiteClassGrid,
  SiteClassEmpty,
  SitePickerUpgrade,
  CompactGuestForm,
  type BookingStepV2,
} from "@/components/booking-v2";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (!stripeKey) {
  console.error(
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured. Stripe payments will not work.",
  );
}
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

type AvailableSite = Awaited<ReturnType<typeof apiClient.getPublicAvailability>>[0];
type Quote = Awaited<ReturnType<typeof apiClient.getPublicQuote>>;
type PublicCampground = Awaited<ReturnType<typeof apiClient.getPublicCampground>>;
type CampgroundSiteClass = PublicCampground["siteClasses"][number] & { photoUrl?: string | null };
type Reservation = Awaited<ReturnType<typeof apiClient.createPublicReservation>> & {
  confirmationNumber?: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return fallback;
};

// Types
interface GuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
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

type SiteClass = CampgroundSiteClass & { id: string; name: string };

// Utility functions
const formatDateInput = (date: Date) => date.toISOString().split("T")[0];
const addDaysToDate = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const getNightsBetween = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
};

const normalizeSiteType = (siteType?: string | null) => {
  const normalized = (siteType || "").toLowerCase();
  if (["trailer", "rv"].includes(normalized)) return "rv";
  if (["car", "van"].includes(normalized)) return "car";
  if (!normalized) return "other";
  return normalized;
};

const matchesSiteType = (selected: string, actual?: string | null) => {
  if (!selected || selected === "all") return true;
  const normalizedSelected = normalizeSiteType(selected);
  const normalizedActual = normalizeSiteType(actual);
  return normalizedSelected === normalizedActual;
};

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateShort = (dateStr: string) => {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Step 1: Accommodation Selection
function AccommodationStep({
  slug,
  campground,
  arrivalDate,
  departureDate,
  selectedSiteType,
  onArrivalChange,
  onDepartureChange,
  onSiteTypeChange,
  siteClasses,
  availableSites,
  isLoadingSites,
  selectedSiteClassId,
  onSelectSiteClass,
  selectedSiteId,
  onSelectSite,
  siteSelectionFeeCents,
  onNext,
}: {
  slug: string;
  campground: PublicCampground | null;
  arrivalDate: string;
  departureDate: string;
  selectedSiteType: string;
  onArrivalChange: (d: string) => void;
  onDepartureChange: (d: string) => void;
  onSiteTypeChange: (type: string) => void;
  siteClasses: SiteClass[];
  availableSites: AvailableSite[] | undefined;
  isLoadingSites: boolean;
  selectedSiteClassId: string | null;
  onSelectSiteClass: (id: string) => void;
  selectedSiteId: string | null;
  onSelectSite: (site: { id: string; name: string; siteNumber: string } | null) => void;
  siteSelectionFeeCents: number | null;
  onNext: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const today = new Date().toISOString().split("T")[0];
  const nights = arrivalDate && departureDate ? getNightsBetween(arrivalDate, departureDate) : 0;
  const heroImageUrl =
    typeof campground?.heroImageUrl === "string" ? campground.heroImageUrl : undefined;

  // Group sites by site class for availability count
  const availabilityBySiteClass = useMemo(() => {
    if (!availableSites) return {};
    return availableSites.reduce<Record<string, number>>((acc, site) => {
      const classId = site.siteClass?.id;
      if (classId && site.status === "available") {
        acc[classId] = (acc[classId] || 0) + 1;
      }
      return acc;
    }, {});
  }, [availableSites]);

  // Filter site classes by selected type
  const filteredSiteClasses = useMemo(() => {
    return siteClasses.filter((sc) => {
      if (selectedSiteType === "all") return true;
      return matchesSiteType(selectedSiteType, sc.siteType);
    });
  }, [siteClasses, selectedSiteType]);

  // Available sites for site picker (filtered by selected class)
  const sitesForPicker = useMemo(() => {
    if (!availableSites || !selectedSiteClassId) return [];
    return availableSites
      .filter((site) => site.siteClass?.id === selectedSiteClassId && site.status === "available")
      .map((site) => ({
        id: site.id,
        name: site.name,
        siteNumber: site.siteNumber || site.name,
        photoUrl: site.siteClass?.photoUrl || null,
      }));
  }, [availableSites, selectedSiteClassId]);

  // Quick date buttons
  const getNextFriday = (from: Date) => {
    const day = from.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    return addDaysToDate(from, daysUntilFriday);
  };

  const handleTonight = () => {
    const now = new Date();
    onArrivalChange(formatDateInput(now));
    onDepartureChange(formatDateInput(addDaysToDate(now, 1)));
  };

  const handleWeekend = () => {
    const now = new Date();
    const friday = getNextFriday(now);
    const sunday = addDaysToDate(friday, 2);
    onArrivalChange(formatDateInput(friday));
    onDepartureChange(formatDateInput(sunday));
  };

  const handleArrivalChange = (value: string) => {
    onArrivalChange(value);
    if (!value) return;
    const arrival = new Date(value);
    const departure = departureDate ? new Date(departureDate) : null;
    if (!departure) {
      onDepartureChange(formatDateInput(addDaysToDate(arrival, 3)));
      return;
    }
    if (departure <= arrival) {
      onDepartureChange(formatDateInput(addDaysToDate(arrival, 1)));
    }
  };

  const canContinue = selectedSiteClassId && arrivalDate && departureDate;

  return (
    <div className="space-y-8">
      {/* AI Search */}
      {campground?.aiSuggestionsEnabled && (
        <div className="mb-2">
          <NaturalLanguageSearch
            slug={slug}
            onApplyIntent={(intent) => {
              if (intent.arrivalDate) onArrivalChange(intent.arrivalDate);
              if (intent.departureDate) onDepartureChange(intent.departureDate);
              if (intent.siteType) onSiteTypeChange(intent.siteType);
            }}
            className="w-full"
          />
          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px bg-muted" />
            <span className="text-sm text-muted-foreground">or select manually</span>
            <div className="flex-1 h-px bg-muted" />
          </div>
        </div>
      )}

      {/* Date & Guest Selection */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <h2 className="text-lg font-semibold text-foreground">When are you coming?</h2>

        {/* Quick Date Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTonight}
            className="px-4 py-2 bg-muted hover:bg-keepr-evergreen/10 text-foreground hover:text-keepr-evergreen rounded-lg text-sm font-medium transition-colors border border-border hover:border-keepr-evergreen/20 inline-flex items-center gap-1"
          >
            <Moon className="h-4 w-4" /> Tonight
          </button>
          <button
            type="button"
            onClick={handleWeekend}
            className="px-4 py-2 bg-muted hover:bg-keepr-evergreen/10 text-foreground hover:text-keepr-evergreen rounded-lg text-sm font-medium transition-colors border border-border hover:border-keepr-evergreen/20 inline-flex items-center gap-1"
          >
            <CalendarDays className="h-4 w-4" /> Weekend
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              onArrivalChange(formatDateInput(now));
              onDepartureChange(formatDateInput(addDaysToDate(now, 7)));
            }}
            className="px-4 py-2 bg-muted hover:bg-keepr-evergreen/10 text-foreground hover:text-keepr-evergreen rounded-lg text-sm font-medium transition-colors border border-border hover:border-keepr-evergreen/20"
          >
            1 Week
          </button>
        </div>

        {/* Date Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Check-in</label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => handleArrivalChange(e.target.value)}
              min={today}
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-keepr-evergreen focus:border-keepr-evergreen"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Check-out</label>
            <input
              type="date"
              value={departureDate}
              onChange={(e) => onDepartureChange(e.target.value)}
              min={arrivalDate || today}
              className="w-full px-4 py-3 border border-border rounded-lg focus:ring-2 focus:ring-keepr-evergreen focus:border-keepr-evergreen"
            />
          </div>
        </div>

        {arrivalDate && departureDate && nights > 0 && (
          <div className="text-sm text-muted-foreground">
            {nights} night{nights !== 1 ? "s" : ""} ({formatDateShort(arrivalDate)} -{" "}
            {formatDateShort(departureDate)})
          </div>
        )}
      </div>

      {/* Site Class Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Choose your accommodation</h2>
          {filteredSiteClasses.length > 0 && !isLoadingSites && (
            <span className="text-sm text-muted-foreground">
              {filteredSiteClasses.length} type
              {filteredSiteClasses.length !== 1 ? "s" : ""} available
            </span>
          )}
        </div>

        {/* Site Type Filter */}
        <div className="flex flex-wrap gap-2">
          {["all", "rv", "tent", "cabin", "glamping"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSiteTypeChange(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedSiteType === type
                  ? "bg-keepr-evergreen text-white"
                  : "bg-muted text-foreground hover:bg-muted"
              }`}
            >
              {type === "all" ? "All Types" : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {isLoadingSites ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Tent className="h-12 w-12 text-keepr-evergreen animate-pulse" />
            <div className="text-center space-y-1">
              <p className="text-foreground font-medium">Finding available sites...</p>
              <p className="text-sm text-muted-foreground">Checking what's open for your dates</p>
            </div>
          </div>
        ) : filteredSiteClasses.length === 0 ? (
          <SiteClassEmpty
            message="No accommodations available for these dates"
            onChangeDates={() => {
              onArrivalChange("");
              onDepartureChange("");
            }}
          />
        ) : (
          <SiteClassGrid>
            {filteredSiteClasses.map((siteClass) => {
              const availableCount = availabilityBySiteClass[siteClass.id] || 0;
              return (
                <SiteClassCard
                  key={siteClass.id}
                  siteClass={siteClass}
                  availableCount={availableCount}
                  nights={nights}
                  isSelected={selectedSiteClassId === siteClass.id}
                  onSelect={() => onSelectSiteClass(siteClass.id)}
                  fallbackImage={heroImageUrl}
                />
              );
            })}
          </SiteClassGrid>
        )}
      </div>

      {/* Site Picker Upgrade */}
      {selectedSiteClassId && siteSelectionFeeCents && siteSelectionFeeCents > 0 && (
        <SitePickerUpgrade
          upgradeFee={siteSelectionFeeCents}
          availableSites={sitesForPicker}
          selectedSite={
            selectedSiteId ? sitesForPicker.find((s) => s.id === selectedSiteId) || null : null
          }
          onSelectSite={(site) => onSelectSite(site)}
          siteClassPhoto={
            siteClasses.find((sc) => sc.id === selectedSiteClassId)?.photoUrl || heroImageUrl
          }
        />
      )}

      {/* Continue Button (Mobile) */}
      <div className="lg:hidden">
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="w-full py-4 bg-keepr-evergreen text-white font-semibold rounded-xl hover:bg-keepr-evergreen-dark disabled:bg-muted disabled:cursor-not-allowed transition-colors"
        >
          Continue to Details
        </button>
      </div>
    </div>
  );
}

// Step 2: Guest Details
function DetailsStep({
  guestInfo,
  onChange,
  selectedSiteType,
  onBack,
  onNext,
}: {
  guestInfo: GuestFormData;
  onChange: (data: GuestFormData) => void;
  selectedSiteType: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!guestInfo.firstName.trim()) newErrors.firstName = "Required";
    if (!guestInfo.lastName.trim()) newErrors.lastName = "Required";
    if (!guestInfo.email.includes("@")) newErrors.email = "Invalid email";
    if (!guestInfo.phone.trim()) newErrors.phone = "Required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onNext();
    }
  };

  const isRvOrTrailer =
    selectedSiteType?.toLowerCase().includes("rv") ||
    selectedSiteType?.toLowerCase().includes("trailer");

  return (
    <div className="space-y-6">
      <BookingBackButton currentStep={2} onBack={onBack} />

      <div className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Your Details</h2>

        <CompactGuestForm
          data={guestInfo}
          onChange={onChange}
          errors={errors}
          siteType={selectedSiteType}
          showVehicle={isRvOrTrailer}
          showPets={true}
        />
      </div>

      {/* Trust Signals */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-keepr-evergreen" />
          <span>Secure checkout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4 text-keepr-evergreen" />
          <span>Instant confirmation</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 lg:hidden">
        <button
          onClick={onBack}
          className="flex-1 py-4 bg-muted text-foreground font-semibold rounded-xl hover:bg-muted transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-4 bg-keepr-evergreen text-white font-semibold rounded-xl hover:bg-keepr-evergreen-dark transition-colors"
        >
          Continue to Payment
        </button>
      </div>
    </div>
  );
}

// Step 3: Payment (placeholder - would integrate with Stripe)
function PaymentStep({
  slug,
  campgroundId,
  arrivalDate,
  departureDate,
  selectedSiteClassId,
  selectedSiteId,
  guestInfo,
  quote,
  isLoadingQuote,
  priceBreakdown,
  onBack,
  onComplete,
}: {
  slug: string;
  campgroundId: string;
  arrivalDate: string;
  departureDate: string;
  selectedSiteClassId: string | null;
  selectedSiteId: string | null;
  guestInfo: GuestFormData;
  quote: Quote | undefined;
  isLoadingQuote: boolean;
  priceBreakdown: { label: string; amount: number; isDiscount?: boolean; isTax?: boolean }[];
  onBack: () => void;
  onComplete: (reservation: Reservation) => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charityDonation, setCharityDonation] = useState<{
    optedIn: boolean;
    amountCents: number;
    charityId: string | null;
  }>({ optedIn: false, amountCents: 0, charityId: null });

  // Create reservation mutation
  const createReservation = useMutation({
    mutationFn: async () => {
      // This would be the actual reservation creation flow with Stripe
      const res = await apiClient.createPublicReservation({
        campgroundSlug: slug,
        arrivalDate,
        departureDate,
        siteClassId: selectedSiteClassId || undefined,
        siteId: selectedSiteId || undefined,
        guest: {
          firstName: guestInfo.firstName,
          lastName: guestInfo.lastName,
          email: guestInfo.email.toLowerCase().trim(),
          phone: guestInfo.phone,
          zipCode: guestInfo.address?.zipCode || "",
        },
        adults: guestInfo.adults,
        children: guestInfo.children,
        petCount: guestInfo.petCount,
        petTypes: guestInfo.petTypes,
        equipment: guestInfo.vehicle
          ? {
              type: guestInfo.vehicle.type,
              length: guestInfo.vehicle.length ? parseInt(guestInfo.vehicle.length) : undefined,
              plateNumber: guestInfo.vehicle.plateNumber || undefined,
              plateState: guestInfo.vehicle.plateState || undefined,
            }
          : undefined,
      });
      return res;
    },
    onSuccess: (reservation) => {
      onComplete(reservation);
    },
    onError: (err: unknown) => {
      setError(getErrorMessage(err, "Failed to create reservation"));
    },
  });

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      // In a real implementation, this would:
      // 1. Create payment intent
      // 2. Confirm payment with Stripe
      // 3. Create reservation
      await createReservation.mutateAsync();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Payment failed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const quoteTotalCents = quote?.totalWithTaxesCents || quote?.totalCents || 0;
  const totalWithCharity = quoteTotalCents + charityDonation.amountCents;

  return (
    <div className="space-y-6">
      <BookingBackButton currentStep={3} onBack={onBack} />

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-keepr-evergreen" />
          <h2 className="text-lg font-semibold text-foreground">Secure Payment</h2>
        </div>

        {/* Price Breakdown */}
        {isLoadingQuote ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        ) : priceBreakdown.length > 0 ? (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            {priceBreakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span
                  className={item.isDiscount ? "text-keepr-evergreen" : "text-muted-foreground"}
                >
                  {item.label}
                </span>
                <span className={item.isDiscount ? "text-keepr-evergreen" : "text-foreground"}>
                  {item.isDiscount ? "-" : ""}${(item.amount / 100).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-keepr-evergreen">${(quoteTotalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        ) : null}

        {/* Charity Round-Up */}
        <RoundUpForCharity
          campgroundId={campgroundId}
          totalCents={quoteTotalCents}
          onChange={setCharityDonation}
        />

        {/* Payment Form Placeholder */}
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Payment integration</p>
          <p className="text-sm text-muted-foreground mt-1">Stripe Elements would render here</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handlePayment}
          disabled={isProcessing || isLoadingQuote}
          className="w-full py-4 bg-keepr-evergreen text-white font-semibold rounded-xl hover:bg-keepr-evergreen-dark disabled:bg-muted disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Lock className="h-5 w-5" />
              Complete Booking - ${(totalWithCharity / 100).toFixed(2)}
            </>
          )}
        </button>

        {/* Trust Signals */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" />
            256-bit encryption
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            PCI compliant
          </span>
        </div>
      </div>
    </div>
  );
}

// Success Screen
function SuccessScreen({
  campgroundName,
  slug,
  reservation,
}: {
  campgroundName: string;
  slug: string;
  reservation: Reservation;
}) {
  return (
    <div className="text-center py-12 space-y-8">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="w-20 h-20 mx-auto bg-keepr-evergreen/15 rounded-full flex items-center justify-center"
      >
        <CheckCircle className="h-10 w-10 text-keepr-evergreen" />
      </motion.div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Booking Confirmed!</h1>
        <p className="text-muted-foreground">Your reservation at {campgroundName} is complete.</p>
      </div>

      {reservation?.confirmationNumber && (
        <div className="inline-block bg-muted rounded-lg px-6 py-4">
          <p className="text-sm text-muted-foreground mb-1">Confirmation Number</p>
          <p className="text-2xl font-mono font-bold text-foreground">
            {reservation.confirmationNumber}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href={`/park/${slug}`}
          className="inline-flex items-center justify-center px-6 py-3 bg-keepr-evergreen text-white font-semibold rounded-xl hover:bg-keepr-evergreen-dark transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to {campgroundName}
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center justify-center px-6 py-3 bg-card border-2 border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors"
        >
          <Printer className="h-5 w-5 mr-2" />
          Print Confirmation
        </button>
      </div>
    </div>
  );
}

// Main Booking Page
export default function BookingPageV2() {
  const params = useParams<{ slug?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  // URL params
  const initialArrival = searchParams.get("arrivalDate") || searchParams.get("arrival") || "";
  const initialDeparture = searchParams.get("departureDate") || searchParams.get("departure") || "";
  const initialSiteType = searchParams.get("siteType") || "all";
  const initialAdults = parseInt(searchParams.get("adults") || searchParams.get("guests") || "1");
  const initialChildren = parseInt(searchParams.get("children") || "0");
  const previewToken = searchParams.get("token") || undefined;

  const slug = typeof params.slug === "string" ? params.slug : "";

  // State
  const [step, setStep] = useState<BookingStepV2>(1);
  const [arrivalDate, setArrivalDate] = useState(initialArrival);
  const [departureDate, setDepartureDate] = useState(initialDeparture);
  const [selectedSiteType, setSelectedSiteType] = useState(normalizeSiteType(initialSiteType));
  const [selectedSiteClassId, setSelectedSiteClassId] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<{
    id: string;
    name: string;
    siteNumber: string;
  } | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);

  const [guestInfo, setGuestInfo] = useState<GuestFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    adults: initialAdults,
    children: initialChildren,
    petCount: 0,
    petTypes: [],
  });

  // Auto-set default dates if none provided
  useEffect(() => {
    if (!initialArrival || !initialDeparture) {
      const today = new Date();
      const depart = addDaysToDate(today, 3);
      setArrivalDate(formatDateInput(today));
      setDepartureDate(formatDateInput(depart));
    }
  }, [initialArrival, initialDeparture]);

  // Prefill guest info from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("publicGuestInfo");
      if (raw) {
        const parsed = JSON.parse(raw);
        setGuestInfo((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save guest info to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("publicGuestInfo", JSON.stringify(guestInfo));
    } catch {
      // ignore
    }
  }, [guestInfo]);

  // Fetch campground
  const {
    data: campground,
    isLoading: isLoadingCampground,
    error: campgroundError,
  } = useQuery({
    queryKey: ["public-campground", slug, previewToken],
    queryFn: () => apiClient.getPublicCampground(slug, previewToken),
    enabled: !!slug,
    retry: 2,
  });

  const siteClassesWithId = useMemo(
    () =>
      (campground?.siteClasses ?? []).filter(
        (siteClass): siteClass is SiteClass =>
          typeof siteClass.id === "string" &&
          siteClass.id.length > 0 &&
          typeof siteClass.name === "string" &&
          siteClass.name.length > 0,
      ),
    [campground],
  );

  const siteSelectionFeeCents = useMemo(() => {
    const fee = campground?.siteSelectionFeeCents;
    return typeof fee === "number" ? fee : null;
  }, [campground]);

  const heroImageUrl =
    typeof campground?.heroImageUrl === "string" ? campground.heroImageUrl : undefined;

  // Fetch availability
  const {
    data: availableSites,
    isLoading: isLoadingSites,
    error: availabilityError,
  } = useQuery({
    queryKey: ["public-availability", slug, arrivalDate, departureDate, previewToken],
    queryFn: () =>
      apiClient.getPublicAvailability(slug, { arrivalDate, departureDate }, previewToken),
    enabled: !!slug && !!arrivalDate && !!departureDate,
    retry: 2,
  });

  // Calculate pricing
  const nights = arrivalDate && departureDate ? getNightsBetween(arrivalDate, departureDate) : 0;
  const selectedClass = siteClassesWithId.find((sc) => sc.id === selectedSiteClassId);
  const pricePerNight = selectedClass?.defaultRate || 0;

  // Get a representative site for quoting (use selected site or first available from class)
  const quoteSiteId = useMemo(() => {
    if (selectedSiteId) return selectedSiteId;
    if (!selectedSiteClassId || !availableSites) return null;
    const classAvailable = availableSites.find(
      (site) => site.siteClass?.id === selectedSiteClassId && site.status === "available",
    );
    return classAvailable?.id || null;
  }, [selectedSiteId, selectedSiteClassId, availableSites]);

  // Fetch quote for accurate pricing including dynamic pricing, taxes, booking fee, etc.
  const { data: quote, isLoading: isLoadingQuote } = useQuery({
    queryKey: [
      "public-quote",
      slug,
      arrivalDate,
      departureDate,
      quoteSiteId,
      guestInfo.adults,
      guestInfo.children,
      guestInfo.petCount,
    ],
    queryFn: () =>
      apiClient.getPublicQuote(slug, {
        siteId: quoteSiteId!,
        arrivalDate,
        departureDate,
        adults: guestInfo.adults,
        children: guestInfo.children,
        petCount: guestInfo.petCount,
        petTypes: guestInfo.petTypes,
      }),
    enabled: !!slug && !!arrivalDate && !!departureDate && !!quoteSiteId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Build price breakdown from actual quote data
  const priceBreakdown = useMemo(() => {
    const items: { label: string; amount: number; isDiscount?: boolean; isTax?: boolean }[] = [];

    if (quote && nights > 0) {
      // Base rate
      items.push({
        label: `${selectedClass?.name || "Accommodation"} x ${nights} night${nights !== 1 ? "s" : ""}`,
        amount: quote.baseSubtotalCents,
      });

      // Pricing rules delta (dynamic pricing adjustments)
      if (quote.rulesDeltaCents && quote.rulesDeltaCents !== 0) {
        items.push({
          label: quote.rulesDeltaCents > 0 ? "Peak season adjustment" : "Off-season discount",
          amount: Math.abs(quote.rulesDeltaCents),
          isDiscount: quote.rulesDeltaCents < 0,
        });
      }

      // Applied discounts (promo codes, loyalty, etc.)
      if (quote.appliedDiscounts && quote.appliedDiscounts.length > 0) {
        for (const discount of quote.appliedDiscounts) {
          items.push({
            label: discount.type === "promo" ? "Promo code" : "Discount",
            amount: discount.amountCents,
            isDiscount: true,
          });
        }
      }

      // Referral discount
      if (quote.referralDiscountCents && quote.referralDiscountCents > 0) {
        items.push({
          label: "Referral discount",
          amount: quote.referralDiscountCents,
          isDiscount: true,
        });
      }

      // Site selection fee (paid upgrade)
      if (selectedSiteId && siteSelectionFeeCents) {
        items.push({
          label: "Site selection fee",
          amount: siteSelectionFeeCents,
        });
      }

      // Taxes
      if (quote.taxesCents && quote.taxesCents > 0) {
        items.push({
          label: "Taxes & fees",
          amount: quote.taxesCents,
          isTax: true,
        });
      }
    } else if (selectedClass && nights > 0) {
      // Fallback estimate when quote isn't available yet
      const subtotal = pricePerNight * nights;
      items.push({
        label: `${selectedClass.name} x ${nights} night${nights !== 1 ? "s" : ""}`,
        amount: subtotal,
      });
      if (selectedSiteId && siteSelectionFeeCents) {
        items.push({
          label: "Site selection fee",
          amount: siteSelectionFeeCents,
        });
      }
      // Estimate taxes (placeholder until quote loads)
      const estimatedTaxes = Math.round(subtotal * 0.1);
      items.push({
        label: "Est. taxes & fees",
        amount: estimatedTaxes,
        isTax: true,
      });
    }
    return items;
  }, [quote, selectedClass, nights, pricePerNight, selectedSiteId, siteSelectionFeeCents]);

  // Total from quote (includes all fees, taxes, dynamic pricing, booking fee, etc.)
  const totalAmount =
    quote?.totalWithTaxesCents ||
    quote?.totalCents ||
    priceBreakdown.reduce((sum, item) => {
      if (item.isDiscount) return sum - item.amount;
      return sum + item.amount;
    }, 0);

  // Handle site type change
  const handleSiteTypeChange = (type: string) => {
    setSelectedSiteType(normalizeSiteType(type));
    setSelectedSiteClassId(null);
    setSelectedSiteId(null);
    setSelectedSite(null);
  };

  // Handle site class selection
  const handleSelectSiteClass = (classId: string) => {
    setSelectedSiteClassId(classId);
    setSelectedSiteId(null);
    setSelectedSite(null);
  };

  // Handle specific site selection (paid upgrade)
  const handleSelectSite = (site: { id: string; name: string; siteNumber: string } | null) => {
    if (site) {
      setSelectedSiteId(site.id);
      setSelectedSite(site);
    } else {
      setSelectedSiteId(null);
      setSelectedSite(null);
    }
  };

  // Loading state
  if (isLoadingCampground) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-keepr-off-white to-white">
        <Tent className="h-12 w-12 text-keepr-evergreen animate-bounce" />
        <div className="text-center space-y-2">
          <p className="text-foreground font-medium animate-pulse">Preparing your booking...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (campgroundError || !campground) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <Tent className="h-16 w-16 text-keepr-evergreen" />
        <h1 className="text-2xl font-bold text-foreground">Campground Not Found</h1>
        <Link
          href="/"
          className="px-6 py-3 bg-keepr-evergreen text-white rounded-lg font-medium hover:bg-keepr-evergreen-dark"
        >
          Browse All Campgrounds
        </Link>
      </div>
    );
  }

  // Success state
  if (isComplete && confirmedReservation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-keepr-off-white to-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <SuccessScreen
            campgroundName={campground.name}
            slug={slug}
            reservation={confirmedReservation}
          />
        </div>
      </div>
    );
  }

  // Build sidebar content
  const sidebar = selectedSiteClassId ? (
    <PriceSummary
      siteClassName={selectedClass?.name}
      siteClassPhoto={selectedClass?.photoUrl || heroImageUrl}
      arrivalDate={arrivalDate}
      departureDate={departureDate}
      nights={nights}
      adults={guestInfo.adults}
      childCount={guestInfo.children}
      baseRatePerNight={pricePerNight}
      lineItems={priceBreakdown}
      totalAmount={totalAmount}
      specificSite={
        selectedSite ? { name: selectedSite.name, number: selectedSite.siteNumber } : null
      }
      ctaLabel={
        step === 1 ? "Continue to Details" : step === 2 ? "Continue to Payment" : "Complete Booking"
      }
      ctaDisabled={step === 1 ? !selectedSiteClassId : false}
      onCtaClick={() => {
        if (step === 1) setStep(2);
        else if (step === 2) setStep(3);
      }}
    />
  ) : (
    <PriceSummaryPlaceholder message="Select an accommodation to see pricing" />
  );

  // Build mobile footer
  const mobileFooter = selectedSiteClassId ? (
    <MobileBookingFooter
      totalAmount={totalAmount}
      nights={nights}
      pricePerNight={pricePerNight}
      breakdown={priceBreakdown}
      siteClassName={selectedClass?.name}
      arrivalDate={arrivalDate}
      departureDate={departureDate}
      ctaLabel={step === 1 ? "Continue" : step === 2 ? "Payment" : "Book"}
      ctaDisabled={step === 1 ? !selectedSiteClassId : false}
      onCtaClick={() => {
        if (step === 1) setStep(2);
        else if (step === 2) setStep(3);
      }}
    />
  ) : (
    <MobileBookingFooterPlaceholder message="Select an accommodation to continue" />
  );

  return (
    <BookingLayout sidebar={sidebar} footer={mobileFooter}>
      {/* Header */}
      <div className="mb-4">
        <Link
          href={`/park/${slug}`}
          className="text-keepr-evergreen hover:text-keepr-evergreen font-medium text-sm flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {campground.name}
        </Link>
      </div>

      {/* Progress Bar */}
      <BookingProgressBar currentStep={step} />

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <AccommodationStep
              slug={slug}
              campground={campground}
              arrivalDate={arrivalDate}
              departureDate={departureDate}
              selectedSiteType={selectedSiteType}
              onArrivalChange={setArrivalDate}
              onDepartureChange={setDepartureDate}
              onSiteTypeChange={handleSiteTypeChange}
              siteClasses={siteClassesWithId}
              availableSites={availableSites}
              isLoadingSites={isLoadingSites}
              selectedSiteClassId={selectedSiteClassId}
              onSelectSiteClass={handleSelectSiteClass}
              selectedSiteId={selectedSiteId}
              onSelectSite={handleSelectSite}
              siteSelectionFeeCents={siteSelectionFeeCents}
              onNext={() => setStep(2)}
            />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <DetailsStep
              guestInfo={guestInfo}
              onChange={setGuestInfo}
              selectedSiteType={selectedSiteType}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <PaymentStep
              slug={slug}
              campgroundId={campground.id}
              arrivalDate={arrivalDate}
              departureDate={departureDate}
              selectedSiteClassId={selectedSiteClassId}
              selectedSiteId={selectedSiteId}
              guestInfo={guestInfo}
              quote={quote}
              isLoadingQuote={isLoadingQuote}
              priceBreakdown={priceBreakdown}
              onBack={() => setStep(2)}
              onComplete={(reservation) => {
                setConfirmedReservation(reservation);
                setIsComplete(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </BookingLayout>
  );
}
