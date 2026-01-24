"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { OnboardingStepKey, onboardingSteps } from "@/lib/onboarding";
import { SetupProgress } from "./components/SetupProgress";
import { StepContainer } from "./components/StepContainer";
import { SetupCelebration } from "./components/SetupCelebration";
import { ParkProfile } from "./steps/ParkProfile";
import type { ParkProfileData } from "./steps/ParkProfile";
import { OperationalHours, OperationalHoursData } from "./steps/OperationalHours";
import { StripeConnect } from "./steps/StripeConnect";
import { ImportOrManual } from "./steps/ImportOrManual";
import { DataImport, type DataImportCompletion, type DataImportDraft } from "./steps/DataImport";
import { SiteClasses, type SiteClassData } from "./steps/SiteClasses";
import { SitesBuilder, type SiteData } from "./steps/SitesBuilder";
import { RatePeriods, RatePeriod } from "./steps/RatePeriods";
import { RatesSetup } from "./steps/RatesSetup";
import { FeesAndAddons } from "./steps/FeesAndAddons";
import { TaxRules, type TaxRuleInput } from "./steps/TaxRules";
import { BookingRules, BookingRulesData } from "./steps/BookingRules";
import { DepositPolicy, type DepositPolicyData } from "./steps/DepositPolicy";
import { CancellationRules, CancellationRule } from "./steps/CancellationRules";
import { WaiversDocuments, WaiversDocumentsData } from "./steps/WaiversDocuments";
import { ParkRules, type ParkRulesData } from "./steps/ParkRules";
import { TeamSetup, TeamMember } from "./steps/TeamSetup";
import { CommunicationSetup, CommunicationSetupData } from "./steps/CommunicationSetup";
import { Integrations, IntegrationsData } from "./steps/Integrations";
import { MenuSetup } from "./steps/MenuSetup";
import { FeatureDiscovery } from "./steps/FeatureDiscovery";
import { SmartQuiz, SmartQuizData } from "./steps/SmartQuiz";
import { FeatureTriage, FeatureTriageData } from "./steps/FeatureTriage";
import { GuidedSetup, GuidedSetupData } from "./steps/GuidedSetup";
import { ReviewLaunch } from "./steps/ReviewLaunch";
import { Loader2 } from "lucide-react";
import { type FeatureRecommendations } from "@/lib/feature-recommendations";

interface WizardState {
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
  inventoryPath: "import" | "manual" | null;
  direction: "forward" | "backward";
  // Data collected during setup
  campground?: {
    id: string;
    name: string;
    slug?: string;
    phone?: string;
    email?: string;
    city: string;
    state: string;
    amenities?: string[];
  };
  stripeConnected?: boolean;
  stripeAccountId?: string;
  siteClasses?: Array<{
    id: string;
    name: string;
    siteType: string;
    rentalType?: string;
    defaultRate: number;
    maxOccupancy?: number;
    hookupsWater?: boolean;
    hookupsSewer?: boolean;
    petFriendly?: boolean;
    electricAmps?: number[];
    equipmentTypes?: string[];
    slideOutsAccepted?: string | null;
    rvOrientation?: string;
    occupantsIncluded?: number;
    extraAdultFee?: number | null;
    extraChildFee?: number | null;
    amenityTags?: string[];
    photos?: string[];
    meteredEnabled?: boolean;
    meteredType?: string | null;
    meteredBillingMode?: string | null;
  }>;
  sites?: Array<{
    id: string;
    name: string;
    siteNumber: string;
    siteClassId: string;
    rigMaxLength?: number;
    powerAmps?: number;
  }>;
  ratePeriods?: RatePeriod[];
  rates?: Array<{ siteClassId: string; nightlyRate: number }>;
  feesAndAddons?: {
    bookingFeeCents: number | null;
    siteLockFeeCents: number | null;
    petFeeEnabled: boolean;
    petFeeCents: number | null;
    petFeeType: "per_pet_per_night" | "flat";
    addOnItems: Array<{
      id: string;
      name: string;
      priceCents: number;
      pricingType: "flat" | "per_night" | "per_person";
    }>;
  };
  taxRules?: TaxRuleInput[];
  depositPolicy?: DepositPolicyData;
  cancellationRules?: CancellationRule[];
  parkRules?: ParkRulesData;
  teamMembers?: TeamMember[];
  integrations?: IntegrationsData;
  // New step data
  operationalHours?: OperationalHoursData;
  bookingRules?: BookingRulesData;
  waiversDocuments?: WaiversDocumentsData;
  communicationSetup?: CommunicationSetupData;
  dataImport?: {
    importSystemKey?: string;
    overrideAccepted?: boolean;
    requiredComplete?: boolean;
    missingRequired?: Array<{ key: string; missingFields: string[] }>;
    sitesCreated?: number;
    siteClassesCreated?: number;
  };
  // Menu and feature discovery
  pinnedPages?: string[];
  completedFeatures?: string[];
  // Smart quiz and feature triage (NEW)
  smartQuiz?: SmartQuizData;
  featureTriage?: FeatureTriageData;
  featureRecommendations?: FeatureRecommendations;
  guidedSetup?: GuidedSetupData;
}

type FeesAndAddonsState = NonNullable<WizardState["feesAndAddons"]>;

const defaultStep: OnboardingStepKey = "park_profile";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isString = (value: unknown): value is string => typeof value === "string";

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(value);

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(isNumber);

const getString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const getRecord = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? value : undefined;

const isOnboardingStepKey = (value: string): value is OnboardingStepKey =>
  onboardingSteps.some((step) => step.key === value);

type SiteType = SiteClassData["siteType"];
type RentalType = SiteClassData["rentalType"];
type RvOrientation = NonNullable<SiteClassData["rvOrientation"]>;
type MeteredType = NonNullable<SiteClassData["meteredType"]>;
type MeteredBillingMode = NonNullable<SiteClassData["meteredBillingMode"]>;
type TaxRuleType = TaxRuleInput["type"];

const siteTypeValues: SiteType[] = ["rv", "tent", "cabin", "glamping"];
const rentalTypeValues: RentalType[] = ["transient", "seasonal", "flexible"];
const rvOrientationValues: RvOrientation[] = ["back_in", "pull_through"];
const meteredTypeValues: MeteredType[] = ["power", "water", "sewer"];
const meteredBillingModeValues: MeteredBillingMode[] = ["per_reading", "cycle", "manual"];
const taxTypeValues: TaxRuleType[] = ["percentage", "flat"];

const isSiteType = (value: unknown): value is SiteType =>
  isString(value) && siteTypeValues.some((option) => option === value);

const isRentalType = (value: unknown): value is RentalType =>
  isString(value) && rentalTypeValues.some((option) => option === value);

const isRvOrientation = (value: unknown): value is RvOrientation =>
  isString(value) && rvOrientationValues.some((option) => option === value);

const isMeteredType = (value: unknown): value is MeteredType =>
  isString(value) && meteredTypeValues.some((option) => option === value);

const isMeteredBillingMode = (value: unknown): value is MeteredBillingMode =>
  isString(value) && meteredBillingModeValues.some((option) => option === value);

const isTaxRuleType = (value: unknown): value is TaxRuleType =>
  isString(value) && taxTypeValues.some((option) => option === value);

const getRecordField = (
  record: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined => {
  if (!record) return undefined;
  const value = record[key];
  return isRecord(value) ? value : undefined;
};

const getArrayField = (
  record: Record<string, unknown> | undefined,
  key: string,
): unknown[] | undefined => {
  if (!record) return undefined;
  const value = record[key];
  return Array.isArray(value) ? value : undefined;
};

const isMissingRequiredEqual = (
  left?: Array<{ key: string; missingFields: string[] }>,
  right?: Array<{ key: string; missingFields: string[] }>,
) => {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const leftEntry = left[i];
    const rightEntry = right[i];
    if (leftEntry.key !== rightEntry.key) return false;
    if (leftEntry.missingFields.length !== rightEntry.missingFields.length) return false;
    for (let j = 0; j < leftEntry.missingFields.length; j += 1) {
      if (leftEntry.missingFields[j] !== rightEntry.missingFields[j]) return false;
    }
  }
  return true;
};

const isRatePeriodDateRange = (value: unknown): value is RatePeriod["dateRanges"][number] =>
  isRecord(value) && isString(value.startDate) && isString(value.endDate);

const isRatePeriod = (value: unknown): value is RatePeriod =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  Array.isArray(value.dateRanges) &&
  value.dateRanges.every(isRatePeriodDateRange) &&
  (value.icon === undefined || isString(value.icon)) &&
  (value.isDefault === undefined || isBoolean(value.isDefault));

const isRateEntry = (value: unknown): value is { siteClassId: string; nightlyRate: number } =>
  isRecord(value) && isString(value.siteClassId) && isNumber(value.nightlyRate);

const isPricingType = (
  value: unknown,
): value is FeesAndAddonsState["addOnItems"][number]["pricingType"] =>
  value === "flat" || value === "per_night" || value === "per_person";

const isPetFeeType = (value: unknown): value is FeesAndAddonsState["petFeeType"] =>
  value === "per_pet_per_night" || value === "flat";

const isAddOnItem = (value: unknown): value is FeesAndAddonsState["addOnItems"][number] =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.name) &&
  isNumber(value.priceCents) &&
  isPricingType(value.pricingType);

const isFeesAndAddonsData = (value: unknown): value is FeesAndAddonsState =>
  isRecord(value) &&
  (value.bookingFeeCents === null || isNumber(value.bookingFeeCents)) &&
  (value.siteLockFeeCents === null || isNumber(value.siteLockFeeCents)) &&
  isBoolean(value.petFeeEnabled) &&
  (value.petFeeCents === null || isNumber(value.petFeeCents)) &&
  isPetFeeType(value.petFeeType) &&
  Array.isArray(value.addOnItems) &&
  value.addOnItems.every(isAddOnItem);

const isTaxRuleInput = (value: unknown): value is TaxRuleInput =>
  isRecord(value) && isString(value.name) && isTaxRuleType(value.type) && isNumber(value.rate);

const isDepositPolicyData = (value: unknown): value is DepositPolicyData =>
  isRecord(value) &&
  (value.strategy === "first_night" || value.strategy === "percent" || value.strategy === "full") &&
  (value.percentValue === undefined || isNumber(value.percentValue));

const isCancellationFeeType = (value: unknown): value is CancellationRule["feeType"] =>
  value === "flat" || value === "percent" || value === "nights" || value === "full";

const isCancellationRule = (value: unknown): value is CancellationRule =>
  isRecord(value) &&
  isString(value.id) &&
  isNumber(value.daysBeforeArrival) &&
  isCancellationFeeType(value.feeType) &&
  isNumber(value.feeAmount) &&
  (value.appliesTo === undefined || isStringArray(value.appliesTo));

const isParkRulesEnforcement = (value: unknown): value is ParkRulesData["enforcement"] =>
  value === "pre_booking" || value === "pre_checkin" || value === "informational";

const isParkRulesData = (value: unknown): value is ParkRulesData =>
  isRecord(value) &&
  isBoolean(value.useTemplate) &&
  isBoolean(value.requireSignature) &&
  isParkRulesEnforcement(value.enforcement) &&
  (value.templateId === undefined || isString(value.templateId)) &&
  (value.customRules === undefined || isString(value.customRules));

const isTeamRole = (value: unknown): value is TeamMember["role"] =>
  value === "manager" ||
  value === "front_desk" ||
  value === "maintenance" ||
  value === "finance" ||
  value === "marketing" ||
  value === "readonly";

const isTeamMember = (value: unknown): value is TeamMember =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.firstName) &&
  isString(value.lastName) &&
  isString(value.email) &&
  isTeamRole(value.role);

const isOperationalHoursData = (value: unknown): value is OperationalHoursData =>
  isRecord(value) &&
  isString(value.checkInTime) &&
  isString(value.checkOutTime) &&
  isBoolean(value.quietHoursEnabled) &&
  isBoolean(value.checkInWindowEnabled) &&
  (value.quietHoursStart === undefined || isString(value.quietHoursStart)) &&
  (value.quietHoursEnd === undefined || isString(value.quietHoursEnd)) &&
  (value.checkInWindowStart === undefined || isString(value.checkInWindowStart)) &&
  (value.checkInWindowEnd === undefined || isString(value.checkInWindowEnd));

const isBookingRulesData = (value: unknown): value is BookingRulesData =>
  isRecord(value) &&
  (value.advanceBookingDays === null || isNumber(value.advanceBookingDays)) &&
  isNumber(value.minNights) &&
  isBoolean(value.longTermEnabled) &&
  (value.longTermMinNights === undefined || isNumber(value.longTermMinNights)) &&
  (value.longTermAutoApply === undefined || isBoolean(value.longTermAutoApply)) &&
  isString(value.officeClosesAt) &&
  isBoolean(value.sameDayCutoffEnabled);

const isWaiverTiming = (value: unknown): value is WaiversDocumentsData["waiverTiming"] =>
  value === "before_arrival" || value === "at_checkin";

const isWaiversDocumentsData = (value: unknown): value is WaiversDocumentsData =>
  isRecord(value) &&
  isBoolean(value.requireWaiver) &&
  isBoolean(value.requireParkRulesAck) &&
  isBoolean(value.requireVehicleForm) &&
  isBoolean(value.requirePetPolicy) &&
  (value.waiverTiming === undefined || isWaiverTiming(value.waiverTiming)) &&
  (value.waiverContent === undefined || isString(value.waiverContent)) &&
  (value.useDefaultWaiver === undefined || isBoolean(value.useDefaultWaiver));

const isPreArrivalReminder = (
  value: unknown,
): value is CommunicationSetupData["preArrivalReminders"][number] =>
  isRecord(value) &&
  isNumber(value.days) &&
  isBoolean(value.enabled) &&
  isString(value.description);

const isCommunicationSetupData = (value: unknown): value is CommunicationSetupData =>
  isRecord(value) &&
  isBoolean(value.useCustomDomain) &&
  isBoolean(value.sendConfirmation) &&
  Array.isArray(value.preArrivalReminders) &&
  value.preArrivalReminders.every(isPreArrivalReminder) &&
  isBoolean(value.sendPostStay) &&
  isBoolean(value.enableNpsSurvey) &&
  (value.customDomain === undefined || isString(value.customDomain)) &&
  (value.npsSendHour === undefined || isNumber(value.npsSendHour));

const isIntegrationsData = (value: unknown): value is IntegrationsData =>
  isRecord(value) &&
  isStringArray(value.interestedIn) &&
  (value.quickbooks === undefined ||
    (isRecord(value.quickbooks) &&
      isBoolean(value.quickbooks.connected) &&
      (value.quickbooks.accountId === undefined || isString(value.quickbooks.accountId)))) &&
  (value.gateAccess === undefined ||
    (isRecord(value.gateAccess) &&
      isBoolean(value.gateAccess.connected) &&
      (value.gateAccess.provider === undefined || isString(value.gateAccess.provider))));

const isFeatureTriageStatus = (value: unknown): value is FeatureTriageData["selections"][string] =>
  value === "setup_now" || value === "setup_later" || value === "skip";

const isFeatureTriageData = (value: unknown): value is FeatureTriageData =>
  isRecord(value) &&
  isRecord(value.selections) &&
  Object.values(value.selections).every(isFeatureTriageStatus) &&
  isBoolean(value.completed);

const isGuidedSetupData = (value: unknown): value is GuidedSetupData =>
  isRecord(value) &&
  isStringArray(value.completedFeatures) &&
  isStringArray(value.skippedFeatures) &&
  isNumber(value.currentFeatureIndex);

const isSmartQuizData = (value: unknown): value is SmartQuizData =>
  isRecord(value) &&
  isRecord(value.answers) &&
  isRecord(value.recommendations) &&
  isStringArray(value.recommendations.setupNow) &&
  isStringArray(value.recommendations.setupLater) &&
  isStringArray(value.recommendations.skipped) &&
  isBoolean(value.completed);

const isSiteClassData = (value: unknown): value is SiteClassData =>
  isRecord(value) &&
  isString(value.name) &&
  isSiteType(value.siteType) &&
  isRentalType(value.rentalType) &&
  isNumberArray(value.electricAmps) &&
  isStringArray(value.equipmentTypes) &&
  (value.slideOutsAccepted === null || isString(value.slideOutsAccepted)) &&
  isBoolean(value.hookupsWater) &&
  isBoolean(value.hookupsSewer) &&
  isNumber(value.defaultRate) &&
  isNumber(value.maxOccupancy) &&
  isBoolean(value.petFriendly) &&
  isNumber(value.occupantsIncluded) &&
  (value.extraAdultFee === null || isNumber(value.extraAdultFee)) &&
  (value.extraChildFee === null || isNumber(value.extraChildFee)) &&
  isStringArray(value.amenityTags) &&
  isStringArray(value.photos) &&
  isBoolean(value.meteredEnabled) &&
  (value.meteredType === null || isMeteredType(value.meteredType)) &&
  (value.meteredBillingMode === null || isMeteredBillingMode(value.meteredBillingMode)) &&
  (value.rvOrientation === undefined ||
    value.rvOrientation === null ||
    isRvOrientation(value.rvOrientation)) &&
  (value.id === undefined || isString(value.id));

const isSiteData = (value: unknown): value is SiteData =>
  isRecord(value) &&
  isString(value.name) &&
  isString(value.siteNumber) &&
  isString(value.siteClassId) &&
  (value.rigMaxLength === undefined || isNumber(value.rigMaxLength)) &&
  (value.powerAmps === undefined || isNumber(value.powerAmps)) &&
  (value.id === undefined || isString(value.id));

export default function OnboardingPage() {
  const { token: tokenParam } = useParams<{ token?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = tokenParam ?? "";
  const queryClient = useQueryClient();

  // Check if returning from Stripe
  const stripeStatus = searchParams.get("stripe_status");

  const [state, setState] = useState<WizardState>({
    currentStep: "park_profile",
    completedSteps: [],
    inventoryPath: null,
    direction: "forward",
  });

  const [celebration, setCelebration] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    type: "stripe" | "sites" | "launch" | "default";
  }>({ show: false, title: "", type: "default" });

  // Track if we've initialized from session to prevent resetting on refetch
  const [initialized, setInitialized] = useState(false);

  // Fetch session data
  const sessionQuery = useQuery({
    queryKey: ["onboarding", token],
    queryFn: () => apiClient.startOnboardingSession(token),
    enabled: Boolean(token),
  });

  // Initialize state from session (only once on first load)
  useEffect(() => {
    if (initialized || !sessionQuery.data?.session) return;

    const session = sessionQuery.data.session;
    const data: Record<string, unknown> = isRecord(session.data) ? session.data : {};

    // Map old step keys to new ones if needed
    const mapStepKey = (key: string): OnboardingStepKey => {
      const mapping: Record<string, OnboardingStepKey> = {
        account_profile: "park_profile",
        payment_gateway: "stripe_connect",
        inventory_sites: "inventory_choice",
        rates_and_fees: "rates_setup",
        taxes_and_fees: "tax_rules",
        policies: "deposit_policy",
      };
      const mapped = mapping[key] ?? key;
      return isOnboardingStepKey(mapped) ? mapped : defaultStep;
    };

    const mappedCompletedSteps = (sessionQuery.data.progress?.completedSteps || [])
      .map(mapStepKey)
      .filter((key): key is OnboardingStepKey => onboardingSteps.some((s) => s.key === key));

    const currentStepKey = mapStepKey(
      session.currentStep || sessionQuery.data.progress?.nextStep || "park_profile",
    );

    // Extract signup data for pre-population
    const signupCampground = getRecord(data.campground);
    const signupData = {
      name: getString(data.campgroundName) ?? getString(signupCampground?.name) ?? "",
      phone: getString(data.phone) ?? getString(signupCampground?.phone) ?? "",
      email: getString(data.email) ?? getString(signupCampground?.email) ?? "",
    };

    // Extract data from step-keyed structure
    const parkProfileStep =
      getRecordField(data, "park_profile") ?? getRecordField(data, "account_profile");
    const parkProfileData = getRecordField(parkProfileStep, "campground") ?? signupCampground;
    const parkProfileAmenities =
      parkProfileData && isStringArray(parkProfileData.amenities)
        ? parkProfileData.amenities
        : undefined;

    const siteClassesRaw =
      getArrayField(getRecordField(data, "site_classes"), "siteClasses") ??
      (Array.isArray(data.siteClasses) ? data.siteClasses : undefined);
    const siteClassesData = siteClassesRaw?.filter(isSiteClassData).map((item, index) => ({
      ...item,
      id: item.id ?? `temp-${index}`,
    }));

    const sitesRaw =
      getArrayField(getRecordField(data, "sites_builder"), "sites") ??
      (Array.isArray(data.sites) ? data.sites : undefined);
    const sitesData = sitesRaw?.filter(isSiteData).map((item, index) => ({
      ...item,
      id: item.id ?? `temp-${index}`,
    }));

    const ratePeriodsRaw =
      getArrayField(getRecordField(data, "rate_periods"), "ratePeriods") ??
      (Array.isArray(data.ratePeriods) ? data.ratePeriods : undefined);
    const ratePeriodsData = ratePeriodsRaw?.filter(isRatePeriod);

    const ratesRaw =
      getArrayField(getRecordField(data, "rates_setup"), "rates") ??
      (Array.isArray(data.rates) ? data.rates : undefined);
    const ratesData = ratesRaw?.filter(isRateEntry);

    const feesAndAddonsRaw =
      getRecordField(getRecordField(data, "fees_and_addons"), "feesAndAddons") ??
      getRecord(data.feesAndAddons);
    const feesAndAddonsData = isFeesAndAddonsData(feesAndAddonsRaw) ? feesAndAddonsRaw : undefined;

    const taxRulesRaw =
      getArrayField(getRecordField(data, "tax_rules"), "taxRules") ??
      (Array.isArray(data.taxRules) ? data.taxRules : undefined);
    const taxRulesData = taxRulesRaw?.filter(isTaxRuleInput);

    const depositPolicyRaw =
      getRecordField(getRecordField(data, "deposit_policy"), "depositPolicy") ??
      getRecord(data.depositPolicy);
    const depositPolicyData = isDepositPolicyData(depositPolicyRaw) ? depositPolicyRaw : undefined;

    const cancellationRulesRaw =
      getArrayField(getRecordField(data, "cancellation_rules"), "cancellationRules") ??
      (Array.isArray(data.cancellationRules) ? data.cancellationRules : undefined);
    const cancellationRulesData = cancellationRulesRaw?.filter(isCancellationRule);

    const parkRulesRaw =
      getRecordField(getRecordField(data, "park_rules"), "parkRules") ?? getRecord(data.parkRules);
    const parkRulesData = isParkRulesData(parkRulesRaw) ? parkRulesRaw : undefined;

    const teamMembersRaw =
      getArrayField(getRecordField(data, "team_setup"), "teamMembers") ??
      (Array.isArray(data.teamMembers) ? data.teamMembers : undefined);
    const teamMembersData = teamMembersRaw?.filter(isTeamMember);

    const integrationsRaw =
      getRecordField(getRecordField(data, "integrations"), "integrations") ??
      getRecord(data.integrations);
    const integrationsData = isIntegrationsData(integrationsRaw) ? integrationsRaw : undefined;

    const inventoryPathRaw =
      getString(getRecordField(data, "inventory_choice")?.path) ?? getString(data.inventoryPath);
    const inventoryPathData =
      inventoryPathRaw === "import" || inventoryPathRaw === "manual" ? inventoryPathRaw : null;
    const dataImportRecord = getRecord(data.data_import);
    const missingRequiredRaw = dataImportRecord
      ? getArrayField(dataImportRecord, "missingRequired")
      : undefined;
    const missingRequiredData = missingRequiredRaw
      ? missingRequiredRaw
          .map((entry) => {
            const record = getRecord(entry);
            if (!record) return null;
            const key = getString(record.key);
            const missingFields = (getArrayField(record, "missingFields") || []).filter(isString);
            if (!key) return null;
            return { key, missingFields };
          })
          .filter((entry): entry is { key: string; missingFields: string[] } => entry !== null)
      : undefined;
    const dataImportData = dataImportRecord
      ? {
          importSystemKey: getString(dataImportRecord.importSystemKey),
          overrideAccepted: isBoolean(dataImportRecord.overrideAccepted)
            ? dataImportRecord.overrideAccepted
            : undefined,
          requiredComplete: isBoolean(dataImportRecord.requiredComplete)
            ? dataImportRecord.requiredComplete
            : undefined,
          missingRequired: missingRequiredData,
          sitesCreated: isNumber(dataImportRecord.sitesCreated)
            ? dataImportRecord.sitesCreated
            : undefined,
          siteClassesCreated: isNumber(dataImportRecord.siteClassesCreated)
            ? dataImportRecord.siteClassesCreated
            : undefined,
        }
      : undefined;

    const operationalHoursRecord =
      getRecord(data.operational_hours) ?? getRecord(data.operationalHours);
    const operationalHoursCandidate =
      getRecordField(operationalHoursRecord, "operationalHours") ?? operationalHoursRecord;
    const operationalHoursData = isOperationalHoursData(operationalHoursCandidate)
      ? operationalHoursCandidate
      : undefined;

    const bookingRulesRecord = getRecord(data.booking_rules) ?? getRecord(data.bookingRules);
    const bookingRulesCandidate =
      getRecordField(bookingRulesRecord, "bookingRules") ?? bookingRulesRecord;
    const bookingRulesData = isBookingRulesData(bookingRulesCandidate)
      ? bookingRulesCandidate
      : undefined;

    const waiversDocumentsRecord =
      getRecord(data.waivers_documents) ?? getRecord(data.waiversDocuments);
    const waiversDocumentsCandidate =
      getRecordField(waiversDocumentsRecord, "waiversDocuments") ?? waiversDocumentsRecord;
    const waiversDocumentsData = isWaiversDocumentsData(waiversDocumentsCandidate)
      ? waiversDocumentsCandidate
      : undefined;

    const communicationSetupRecord =
      getRecord(data.communication_setup) ?? getRecord(data.communicationSetup);
    const communicationSetupCandidate =
      getRecordField(communicationSetupRecord, "communicationSetup") ?? communicationSetupRecord;
    const communicationSetupData = isCommunicationSetupData(communicationSetupCandidate)
      ? communicationSetupCandidate
      : undefined;

    const smartQuizRaw = getRecord(data.smart_quiz);
    const smartQuizData = smartQuizRaw && isSmartQuizData(smartQuizRaw) ? smartQuizRaw : undefined;

    const featureTriageRaw =
      getRecordField(getRecordField(data, "feature_triage"), "featureTriage") ??
      getRecord(data.featureTriage);
    const featureTriageData = isFeatureTriageData(featureTriageRaw) ? featureTriageRaw : undefined;

    const guidedSetupRaw = getRecord(data.guided_setup) ?? getRecord(data.guidedSetup);
    const guidedSetupData = isGuidedSetupData(guidedSetupRaw) ? guidedSetupRaw : undefined;
    // Reconstruct recommendations from smart_quiz if available
    const recommendedNowRaw = smartQuizRaw
      ? getArrayField(smartQuizRaw, "recommendedNow")
      : undefined;
    const recommendedLaterRaw = smartQuizRaw
      ? getArrayField(smartQuizRaw, "recommendedLater")
      : undefined;
    const featureRecommendationsData =
      smartQuizData?.recommendations ??
      (recommendedNowRaw || recommendedLaterRaw
        ? {
            setupNow: (recommendedNowRaw ?? []).filter(isString),
            setupLater: (recommendedLaterRaw ?? []).filter(isString),
            skipped: [],
          }
        : undefined);

    setState((prev) => ({
      ...prev,
      campground: {
        id: session.campgroundId ?? getString(parkProfileData?.id) ?? "",
        name: getString(parkProfileData?.name) ?? signupData.name,
        slug: session.campgroundSlug ?? getString(parkProfileData?.slug),
        phone: getString(parkProfileData?.phone) ?? signupData.phone,
        email: getString(parkProfileData?.email) ?? signupData.email,
        city: getString(parkProfileData?.city) ?? "",
        state: getString(parkProfileData?.state) ?? "",
        amenities: parkProfileAmenities,
      },
      stripeConnected: (() => {
        const stripeRecord = getRecord(data.stripe_connect);
        if (stripeRecord && isBoolean(stripeRecord.connected)) return stripeRecord.connected;
        return isBoolean(data.stripeConnected) ? data.stripeConnected : undefined;
      })(),
      stripeAccountId: (() => {
        const stripeRecord = getRecord(data.stripe_connect);
        if (stripeRecord && isString(stripeRecord.accountId)) return stripeRecord.accountId;
        return getString(data.stripeAccountId);
      })(),
      siteClasses: siteClassesData,
      sites: sitesData,
      ratePeriods: ratePeriodsData,
      rates: ratesData,
      feesAndAddons: feesAndAddonsData,
      taxRules: taxRulesData,
      depositPolicy: depositPolicyData,
      cancellationRules: cancellationRulesData,
      parkRules: parkRulesData,
      teamMembers: teamMembersData,
      integrations: integrationsData,
      operationalHours: operationalHoursData,
      bookingRules: bookingRulesData,
      waiversDocuments: waiversDocumentsData,
      communicationSetup: communicationSetupData,
      dataImport: dataImportData,
      smartQuiz: smartQuizData,
      featureTriage: featureTriageData,
      featureRecommendations: featureRecommendationsData,
      guidedSetup: guidedSetupData,
      completedSteps: mappedCompletedSteps,
      currentStep: currentStepKey,
      inventoryPath: inventoryPathData,
    }));

    setInitialized(true);
  }, [sessionQuery.data, initialized]);

  // Handle Stripe return
  useEffect(() => {
    if (stripeStatus === "success" && token) {
      // Show celebration and move to next step
      setCelebration({
        show: true,
        title: "Payments Ready!",
        subtitle: "You can now accept credit cards, ACH, and more",
        type: "stripe",
      });
      setState((prev) => ({
        ...prev,
        stripeConnected: true,
        completedSteps: [...prev.completedSteps, "stripe_connect"],
        currentStep: "inventory_choice",
      }));
      // Clear URL params
      router.replace(`/onboarding/${token}`);
    }
  }, [stripeStatus, token, router]);

  // Check Stripe status on page load if we're on stripe_connect step
  useEffect(() => {
    const checkStripeStatus = async () => {
      if (!sessionQuery.data?.session?.id || !token) return;
      if (state.stripeConnected) return; // Already connected
      if (state.currentStep !== "stripe_connect") return; // Not on this step

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/onboarding/session/${sessionQuery.data.session.id}/stripe/status?token=${encodeURIComponent(token)}`,
          { headers: { "X-Onboarding-Token": token } },
        );
        if (response.ok) {
          const result = await response.json();
          if (result.connected) {
            // Stripe is connected, update state and move forward
            setState((prev) => ({
              ...prev,
              stripeConnected: true,
              completedSteps: prev.completedSteps.includes("stripe_connect")
                ? prev.completedSteps
                : [...prev.completedSteps, "stripe_connect"],
              currentStep: "inventory_choice",
            }));
          }
        }
      } catch (err) {
        console.error("Error checking Stripe status:", err);
      }
    };

    checkStripeStatus();
  }, [sessionQuery.data?.session?.id, token, state.currentStep, state.stripeConnected]);

  const goToStep = useCallback(
    (step: OnboardingStepKey, direction: "forward" | "backward" = "forward") => {
      setState((prev) => ({
        ...prev,
        currentStep: step,
        direction,
      }));
    },
    [],
  );

  const handleDataImportDraftChange = useCallback((draft: DataImportDraft) => {
    setState((prev) => {
      const existing = prev.dataImport ?? {};
      const next = {
        ...existing,
        importSystemKey: draft.importSystemKey,
        overrideAccepted: draft.overrideAccepted,
      };
      if (draft.requiredComplete !== undefined) {
        next.requiredComplete = draft.requiredComplete;
      }
      if (draft.missingRequired !== undefined) {
        next.missingRequired = draft.missingRequired;
      }

      const requiredCompleteUnchanged =
        draft.requiredComplete === undefined || existing.requiredComplete === next.requiredComplete;
      const missingRequiredUnchanged =
        draft.missingRequired === undefined ||
        isMissingRequiredEqual(existing.missingRequired, next.missingRequired);
      if (
        existing.importSystemKey === next.importSystemKey &&
        existing.overrideAccepted === next.overrideAccepted &&
        requiredCompleteUnchanged &&
        missingRequiredUnchanged
      ) {
        return prev;
      }
      return {
        ...prev,
        dataImport: next,
      };
    });
  }, []);

  const completeStep = useCallback((step: OnboardingStepKey) => {
    setState((prev) => ({
      ...prev,
      completedSteps: prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step],
    }));
  }, []);

  const showCelebration = useCallback(
    (
      title: string,
      subtitle?: string,
      type: "stripe" | "sites" | "launch" | "default" = "default",
    ) => {
      setCelebration({ show: true, title, subtitle, type });
    },
    [],
  );

  const hideCelebration = useCallback(() => {
    setCelebration((prev) => ({ ...prev, show: false }));
  }, []);

  // Save step mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: { step: OnboardingStepKey; data: Record<string, unknown> }) => {
      if (!sessionQuery.data) throw new Error("Session not ready");
      const idempotencyKey = crypto.randomUUID();
      return apiClient.saveOnboardingStep(
        sessionQuery.data.session.id,
        token,
        payload.step,
        payload.data,
        idempotencyKey,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding", token] });
    },
  });

  // Loading state - also show loading if token isn't ready yet (hydration)
  if (!token || sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your setup...</p>
        </div>
      </div>
    );
  }

  // Error state - only show if we have a token but the query failed
  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-2">Link Problem</h1>
          <p className="text-slate-400">
            We couldn't validate this setup link. Please request a new invite or contact support.
          </p>
        </div>
      </div>
    );
  }

  // Step handlers
  const handleParkProfileSave = async (data: ParkProfileData) => {
    const result = await saveMutation.mutateAsync({
      step: "park_profile",
      data: { campground: data },
    });
    // Extract slug from the API response (server generates slug when creating campground)
    const savedCampground = getRecordField(
      getRecordField(getRecord(result?.session?.data), "park_profile"),
      "campground",
    );
    const savedSlug = savedCampground ? getString(savedCampground.slug) : undefined;
    const campgroundId =
      result?.session?.campgroundId || sessionQuery.data?.session.campgroundId || "";

    setState((prev) => ({
      ...prev,
      campground: {
        id: campgroundId,
        name: data.name,
        slug: savedSlug,
        phone: data.phone,
        email: data.email,
        city: data.city,
        state: data.state,
        amenities: data.amenities,
      },
    }));
    completeStep("park_profile");
    goToStep("operational_hours");
  };

  const handleStripeConnect = async (): Promise<string> => {
    // Call onboarding-specific Stripe connect endpoint (no JWT required)
    const sessionId = sessionQuery.data?.session.id;
    if (!sessionId) {
      throw new Error("Session not loaded");
    }
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/onboarding/session/${sessionId}/stripe/connect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Onboarding-Token": token,
        },
        body: JSON.stringify({ token }),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to connect Stripe");
    }
    const result = await response.json();
    return result.onboardingUrl;
  };

  const handleStripeCheckStatus = async (): Promise<boolean> => {
    // Check if Stripe is connected via onboarding endpoint
    const sessionId = sessionQuery.data?.session.id;
    if (!sessionId) {
      return false;
    }
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/onboarding/session/${sessionId}/stripe/status?token=${encodeURIComponent(token)}`,
      {
        headers: {
          "X-Onboarding-Token": token,
        },
      },
    );
    if (!response.ok) {
      return false;
    }
    const result = await response.json();
    return result.connected;
  };

  const handleInventoryChoice = (path: "import" | "manual") => {
    setState((prev) => ({
      ...prev,
      inventoryPath: path,
    }));
    completeStep("inventory_choice");
    goToStep(path === "import" ? "data_import" : "site_classes");
  };

  const handleSiteClassesSave = async (classes: SiteClassData[]) => {
    await saveMutation.mutateAsync({
      step: "site_classes",
      data: { siteClasses: classes },
    });
    setState((prev) => ({
      ...prev,
      siteClasses: classes.map((c, i) => ({
        id: `temp-${i}`,
        ...c,
      })),
    }));
    completeStep("site_classes");
    goToStep("sites_builder");
  };

  const handleSitesSave = async (sites: SiteData[]) => {
    await saveMutation.mutateAsync({
      step: "sites_builder",
      data: { sites },
    });
    setState((prev) => ({
      ...prev,
      sites: sites.map((s, i) => ({
        id: `temp-${i}`,
        ...s,
      })),
    }));
    completeStep("sites_builder");
    showCelebration(`${sites.length} Sites Ready!`, "Your inventory is set up", "sites");
    setTimeout(() => {
      hideCelebration();
      goToStep("rate_periods");
    }, 2000);
  };

  const handleDataImportComplete = async (result: DataImportCompletion) => {
    await saveMutation.mutateAsync({
      step: "data_import",
      data: {
        importSystemKey: result.importSystemKey,
        overrideAccepted: result.overrideAccepted,
        requiredComplete: result.requiredComplete,
        missingRequired: result.missingRequired,
        sitesCreated: result.sitesCreated,
        siteClassesCreated: result.siteClassesCreated,
      },
    });

    // Update state with imported data counts
    setState((prev) => ({
      ...prev,
      dataImport: {
        importSystemKey: result.importSystemKey,
        overrideAccepted: result.overrideAccepted,
        requiredComplete: result.requiredComplete,
        missingRequired: result.missingRequired,
        sitesCreated: result.sitesCreated,
        siteClassesCreated: result.siteClassesCreated,
      },
      sites: Array(result.sitesCreated).fill({
        id: "imported",
        name: "",
        siteNumber: "",
        siteClassId: "",
      }),
      siteClasses:
        prev.siteClasses ||
        Array(result.siteClassesCreated).fill({
          id: "imported",
          name: "",
          siteType: "",
          defaultRate: 0,
        }),
    }));
    completeStep("data_import");
    showCelebration(`${result.sitesCreated} Sites Imported!`, "Your inventory is ready", "sites");
    setTimeout(() => {
      hideCelebration();
      goToStep("rate_periods");
    }, 2000);
  };

  const handleRatePeriodsSave = async (periods: RatePeriod[]) => {
    await saveMutation.mutateAsync({
      step: "rate_periods",
      data: { ratePeriods: periods },
    });
    setState((prev) => ({
      ...prev,
      ratePeriods: periods,
    }));
    completeStep("rate_periods");
    goToStep("rates_setup");
  };

  const handleRatesSave = async (rates: Array<{ siteClassId: string; nightlyRate: number }>) => {
    await saveMutation.mutateAsync({
      step: "rates_setup",
      data: { rates },
    });
    setState((prev) => ({
      ...prev,
      rates,
    }));
    completeStep("rates_setup");
    goToStep("fees_and_addons");
  };

  const handleFeesAndAddonsSave = async (data: {
    bookingFeeCents: number | null;
    siteLockFeeCents: number | null;
    petFeeEnabled: boolean;
    petFeeCents: number | null;
    petFeeType: "per_pet_per_night" | "flat";
    addOnItems: Array<{
      id: string;
      name: string;
      priceCents: number;
      pricingType: "flat" | "per_night" | "per_person";
    }>;
  }) => {
    await saveMutation.mutateAsync({
      step: "fees_and_addons",
      data: { feesAndAddons: data },
    });
    setState((prev) => ({
      ...prev,
      feesAndAddons: data,
    }));
    completeStep("fees_and_addons");
    goToStep("tax_rules");
  };

  const handleTaxRulesSave = async (rules: TaxRuleInput[]) => {
    await saveMutation.mutateAsync({
      step: "tax_rules",
      data: { taxRules: rules },
    });
    setState((prev) => ({
      ...prev,
      taxRules: rules,
    }));
    completeStep("tax_rules");
    goToStep("deposit_policy");
  };

  const handleTaxRulesSkip = () => {
    completeStep("tax_rules");
    goToStep("deposit_policy");
  };

  const handleDepositPolicySave = async (data: DepositPolicyData) => {
    await saveMutation.mutateAsync({
      step: "deposit_policy",
      data: { depositPolicy: data },
    });
    setState((prev) => ({
      ...prev,
      depositPolicy: data,
    }));
    completeStep("deposit_policy");
    goToStep("booking_rules");
  };

  const handleOperationalHoursSave = async (data: OperationalHoursData) => {
    await saveMutation.mutateAsync({
      step: "operational_hours",
      data: { ...data },
    });
    setState((prev) => ({
      ...prev,
      operationalHours: data,
    }));
    completeStep("operational_hours");
    goToStep("stripe_connect");
  };

  const handleBookingRulesSave = async (data: BookingRulesData) => {
    await saveMutation.mutateAsync({
      step: "booking_rules",
      data: { ...data },
    });
    setState((prev) => ({
      ...prev,
      bookingRules: data,
    }));
    completeStep("booking_rules");
    goToStep("cancellation_rules");
  };

  const handleCancellationRulesSave = async (rules: CancellationRule[]) => {
    await saveMutation.mutateAsync({
      step: "cancellation_rules",
      data: { cancellationRules: rules },
    });
    setState((prev) => ({
      ...prev,
      cancellationRules: rules,
    }));
    completeStep("cancellation_rules");
    goToStep("waivers_documents");
  };

  const handleCancellationRulesSkip = () => {
    completeStep("cancellation_rules");
    goToStep("waivers_documents");
  };

  const handleWaiversDocumentsSave = async (data: WaiversDocumentsData) => {
    await saveMutation.mutateAsync({
      step: "waivers_documents",
      data: { ...data },
    });
    setState((prev) => ({
      ...prev,
      waiversDocuments: data,
    }));
    completeStep("waivers_documents");
    goToStep("park_rules");
  };

  const handleWaiversDocumentsSkip = () => {
    completeStep("waivers_documents");
    goToStep("park_rules");
  };

  const handleParkRulesSave = async (data: ParkRulesData) => {
    await saveMutation.mutateAsync({
      step: "park_rules",
      data: { parkRules: data },
    });
    setState((prev) => ({
      ...prev,
      parkRules: data,
    }));
    completeStep("park_rules");
    goToStep("team_setup");
  };

  const handleParkRulesSkip = () => {
    completeStep("park_rules");
    goToStep("team_setup");
  };

  const handleTeamSetupSave = async (members: TeamMember[]) => {
    await saveMutation.mutateAsync({
      step: "team_setup",
      data: { teamMembers: members },
    });
    setState((prev) => ({
      ...prev,
      teamMembers: members,
    }));
    completeStep("team_setup");
    goToStep("communication_setup");
  };

  const handleTeamSetupSkip = () => {
    completeStep("team_setup");
    goToStep("communication_setup");
  };

  const handleCommunicationSetupSave = async (data: CommunicationSetupData) => {
    await saveMutation.mutateAsync({
      step: "communication_setup",
      data: { ...data },
    });
    setState((prev) => ({
      ...prev,
      communicationSetup: data,
    }));
    completeStep("communication_setup");
    showCelebration(
      "Emails Configured!",
      "Guests will receive beautiful, professional messages",
      "default",
    );
    setTimeout(() => {
      hideCelebration();
      goToStep("integrations");
    }, 2000);
  };

  const handleCommunicationSetupSkip = () => {
    completeStep("communication_setup");
    goToStep("integrations");
  };

  const handleIntegrationsSave = async (integrations: IntegrationsData) => {
    await saveMutation.mutateAsync({
      step: "integrations",
      data: { integrations },
    });
    setState((prev) => ({
      ...prev,
      integrations,
    }));
    completeStep("integrations");
    goToStep("menu_setup");
  };

  const handleIntegrationsSkip = () => {
    completeStep("integrations");
    goToStep("menu_setup");
  };

  const handleMenuSetupSave = async (pinnedPages: string[]) => {
    await saveMutation.mutateAsync({
      step: "menu_setup",
      data: { pinnedPages },
    });
    setState((prev) => ({
      ...prev,
      pinnedPages,
    }));
    completeStep("menu_setup");
    showCelebration(
      "Dashboard Personalized!",
      "Your menu is set up exactly how you like it",
      "default",
    );
    setTimeout(() => {
      hideCelebration();
      goToStep("feature_discovery");
    }, 2000);
  };

  const handleMenuSetupSkip = () => {
    completeStep("menu_setup");
    goToStep("feature_discovery");
  };

  const handleFeatureDiscoverySave = async (completedFeatures: string[]) => {
    await saveMutation.mutateAsync({
      step: "feature_discovery",
      data: { completedFeatures },
    });
    setState((prev) => ({
      ...prev,
      completedFeatures,
    }));
    completeStep("feature_discovery");
    goToStep("smart_quiz");
  };

  const handleFeatureDiscoverySkip = () => {
    completeStep("feature_discovery");
    goToStep("smart_quiz");
  };

  const handleSmartQuizChange = (quizData: SmartQuizData) => {
    setState((prev) => ({
      ...prev,
      smartQuiz: quizData,
      featureRecommendations: quizData.recommendations,
    }));
  };

  const handleSmartQuizNext = async () => {
    const quizData = state.smartQuiz;
    if (!quizData) {
      // No quiz data, skip to feature triage with no recommendations
      setState((prev) => ({
        ...prev,
        featureRecommendations: { setupNow: [], setupLater: [], skipped: [] },
      }));
      completeStep("smart_quiz");
      goToStep("feature_triage");
      return;
    }

    await saveMutation.mutateAsync({
      step: "smart_quiz",
      data: {
        parkType: quizData.answers.parkType,
        operations: quizData.answers.operations,
        teamSize: quizData.answers.teamSize,
        amenities: quizData.answers.amenities,
        techLevel: quizData.answers.techLevel,
        recommendedNow: quizData.recommendations.setupNow,
        recommendedLater: quizData.recommendations.setupLater,
      },
    });

    completeStep("smart_quiz");
    goToStep("feature_triage");
  };

  const handleSmartQuizSkip = () => {
    // Skip quiz - provide empty recommendations, user will manually select
    setState((prev) => ({
      ...prev,
      featureRecommendations: { setupNow: [], setupLater: [], skipped: [] },
    }));
    completeStep("smart_quiz");
    goToStep("feature_triage");
  };

  const handleFeatureTriageChange = (triageData: FeatureTriageData) => {
    setState((prev) => ({
      ...prev,
      featureTriage: triageData,
    }));
  };

  const handleFeatureTriageNext = async () => {
    const triageData = state.featureTriage;
    if (!triageData) {
      completeStep("feature_triage");
      goToStep("review_launch");
      return;
    }

    // Extract setup_now features from selections
    const setupNowKeys = Object.entries(triageData.selections)
      .filter(([, status]) => status === "setup_now")
      .map(([key]) => key);
    const setupLaterKeys = Object.entries(triageData.selections)
      .filter(([, status]) => status === "setup_later")
      .map(([key]) => key);

    await saveMutation.mutateAsync({
      step: "feature_triage",
      data: {
        featureTriage: triageData,
        setupNow: setupNowKeys,
        setupLater: setupLaterKeys,
      },
    });

    completeStep("feature_triage");
    showCelebration("Features Selected!", "Your personalized setup is ready", "default");
    setTimeout(() => {
      hideCelebration();
      // If there are setup_now features, go to guided setup, otherwise go to launch
      if (setupNowKeys.length > 0) {
        goToStep("guided_setup");
      } else {
        goToStep("review_launch");
      }
    }, 2000);
  };

  const handleFeatureTriageSkip = () => {
    // Skip triage - go directly to launch
    completeStep("feature_triage");
    goToStep("review_launch");
  };

  const handleGuidedSetupChange = (setupData: GuidedSetupData) => {
    setState((prev) => ({
      ...prev,
      guidedSetup: setupData,
    }));
  };

  const handleGuidedSetupComplete = async () => {
    const setupData = state.guidedSetup;

    await saveMutation.mutateAsync({
      step: "guided_setup",
      data: {
        completedFeatures: setupData?.completedFeatures || [],
        skippedFeatures: setupData?.skippedFeatures || [],
        completed: true,
      },
    });
    completeStep("guided_setup");
    goToStep("review_launch");
  };

  const handleLaunch = async () => {
    await saveMutation.mutateAsync({
      step: "review_launch",
      data: { launched: true },
    });
    completeStep("review_launch");
    showCelebration("You're LIVE!", "Your campground is ready to accept bookings", "launch");
    setTimeout(() => {
      // Redirect to dashboard
      router.push("/dashboard");
    }, 3000);
  };

  const handlePreview = () => {
    // Open campground homepage in new tab with preview token
    // Fallback slug generation uses same algorithm as backend
    const slug =
      state.campground?.slug ||
      state.campground?.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    if (slug) {
      window.open(`/park/${slug}/v2?token=${encodeURIComponent(token)}`, "_blank");
    }
  };

  // Render current step
  const renderStep = () => {
    switch (state.currentStep) {
      case "park_profile":
        return (
          <ParkProfile
            initialData={state.campground}
            onSave={handleParkProfileSave}
            onNext={() => goToStep("operational_hours")}
          />
        );

      case "operational_hours":
        return (
          <OperationalHours
            initialData={state.operationalHours}
            onSave={handleOperationalHoursSave}
            onNext={() => goToStep("stripe_connect")}
          />
        );

      case "stripe_connect":
        return (
          <StripeConnect
            campgroundId={sessionQuery.data?.session.campgroundId || ""}
            isConnected={state.stripeConnected || false}
            stripeAccountId={state.stripeAccountId}
            onConnect={handleStripeConnect}
            onCheckStatus={handleStripeCheckStatus}
            onNext={() => {
              completeStep("stripe_connect");
              goToStep("inventory_choice");
            }}
          />
        );

      case "inventory_choice":
        return <ImportOrManual onSelect={handleInventoryChoice} />;

      case "site_classes":
        return (
          <SiteClasses
            initialClasses={state.siteClasses?.map((c) => {
              const siteType = isSiteType(c.siteType) ? c.siteType : "rv";
              const rentalType = isRentalType(c.rentalType) ? c.rentalType : "transient";
              const rvOrientation = isRvOrientation(c.rvOrientation) ? c.rvOrientation : undefined;
              const meteredType = isMeteredType(c.meteredType) ? c.meteredType : null;
              const meteredBillingMode = isMeteredBillingMode(c.meteredBillingMode)
                ? c.meteredBillingMode
                : null;

              return {
                name: c.name,
                siteType,
                rentalType,
                defaultRate: typeof c.defaultRate === "number" ? c.defaultRate / 100 : 0,
                maxOccupancy: c.maxOccupancy || 6,
                hookupsWater: c.hookupsWater ?? true,
                hookupsSewer: c.hookupsSewer ?? false,
                petFriendly: c.petFriendly ?? true,
                electricAmps: c.electricAmps || [],
                equipmentTypes: c.equipmentTypes || [],
                slideOutsAccepted: c.slideOutsAccepted || null,
                rvOrientation,
                occupantsIncluded: c.occupantsIncluded || 2,
                extraAdultFee: c.extraAdultFee ?? null,
                extraChildFee: c.extraChildFee ?? null,
                amenityTags: c.amenityTags || [],
                photos: c.photos || [],
                meteredEnabled: c.meteredEnabled ?? false,
                meteredType,
                meteredBillingMode,
              };
            })}
            onSave={handleSiteClassesSave}
            onNext={() => goToStep("sites_builder")}
          />
        );

      case "sites_builder":
        return (
          <SitesBuilder
            siteClasses={
              state.siteClasses?.map((c) => ({
                id: c.id,
                name: c.name,
                siteType: c.siteType,
                defaultRate: c.defaultRate,
                rvOrientation: c.rvOrientation,
                electricAmps: c.electricAmps || [],
              })) || []
            }
            initialSites={state.sites}
            onSave={handleSitesSave}
            onNext={() => goToStep("rates_setup")}
          />
        );

      case "data_import":
        return (
          <DataImport
            sessionId={sessionQuery.data?.session.id || ""}
            campgroundId={sessionQuery.data?.session.campgroundId || ""}
            token={token}
            onComplete={handleDataImportComplete}
            onSkip={() => {
              // Skip import and go to manual site class creation
              goToStep("site_classes");
            }}
            onDraftChange={handleDataImportDraftChange}
            initialSystemKey={state.dataImport?.importSystemKey}
            initialOverrideAccepted={state.dataImport?.overrideAccepted}
            initialImportTotals={
              state.dataImport
                ? {
                    sitesCreated: state.dataImport.sitesCreated ?? 0,
                    siteClassesCreated: state.dataImport.siteClassesCreated ?? 0,
                  }
                : undefined
            }
          />
        );

      case "rate_periods":
        return (
          <RatePeriods
            periods={state.ratePeriods || []}
            onChange={(periods) => {
              setState((prev) => ({ ...prev, ratePeriods: periods }));
            }}
            onNext={() => {
              if (state.ratePeriods && state.ratePeriods.length > 0) {
                handleRatePeriodsSave(state.ratePeriods);
              } else {
                completeStep("rate_periods");
                goToStep("rates_setup");
              }
            }}
            onBack={() => goToStep("sites_builder", "backward")}
          />
        );

      case "rates_setup":
        return (
          <RatesSetup
            siteClasses={
              state.siteClasses?.map((c) => ({
                id: c.id,
                name: c.name,
                siteType: c.siteType,
                defaultRate: c.defaultRate,
              })) || []
            }
            onSave={handleRatesSave}
            onNext={() => goToStep("fees_and_addons")}
          />
        );

      case "fees_and_addons":
        return (
          <FeesAndAddons
            data={
              state.feesAndAddons || {
                bookingFeeCents: null,
                siteLockFeeCents: null,
                petFeeEnabled: false,
                petFeeCents: null,
                petFeeType: "per_pet_per_night",
                addOnItems: [],
              }
            }
            onChange={(data) => {
              setState((prev) => ({ ...prev, feesAndAddons: data }));
            }}
            onNext={() => {
              if (state.feesAndAddons) {
                handleFeesAndAddonsSave(state.feesAndAddons);
              } else {
                completeStep("fees_and_addons");
                goToStep("tax_rules");
              }
            }}
            onBack={() => goToStep("rates_setup", "backward")}
          />
        );

      case "tax_rules":
        return (
          <TaxRules
            initialRules={state.taxRules}
            onSave={handleTaxRulesSave}
            onSkip={handleTaxRulesSkip}
            onNext={() => goToStep("deposit_policy")}
          />
        );

      case "deposit_policy":
        return (
          <DepositPolicy
            initialData={state.depositPolicy}
            onSave={handleDepositPolicySave}
            onNext={() => goToStep("booking_rules")}
          />
        );

      case "booking_rules":
        return (
          <BookingRules
            initialData={state.bookingRules}
            onSave={handleBookingRulesSave}
            onNext={() => goToStep("cancellation_rules")}
          />
        );

      case "cancellation_rules":
        return (
          <CancellationRules
            rules={state.cancellationRules || []}
            onChange={(rules) => {
              setState((prev) => ({ ...prev, cancellationRules: rules }));
            }}
            onNext={() => {
              if (state.cancellationRules && state.cancellationRules.length > 0) {
                handleCancellationRulesSave(state.cancellationRules);
              } else {
                completeStep("cancellation_rules");
                goToStep("waivers_documents");
              }
            }}
            onBack={() => goToStep("booking_rules", "backward")}
            onSkip={handleCancellationRulesSkip}
            siteClasses={
              state.siteClasses?.map((c) => ({
                id: c.id,
                name: c.name,
              })) || []
            }
          />
        );

      case "waivers_documents":
        return (
          <WaiversDocuments
            initialData={state.waiversDocuments}
            onSave={handleWaiversDocumentsSave}
            onSkip={handleWaiversDocumentsSkip}
            onNext={() => goToStep("park_rules")}
          />
        );

      case "park_rules":
        return (
          <ParkRules
            initialData={state.parkRules}
            onSave={handleParkRulesSave}
            onSkip={handleParkRulesSkip}
            onNext={() => goToStep("team_setup")}
            onBack={() => goToStep("waivers_documents", "backward")}
          />
        );

      case "team_setup":
        return (
          <TeamSetup
            members={state.teamMembers || []}
            onChange={(members) => {
              setState((prev) => ({ ...prev, teamMembers: members }));
            }}
            onNext={() => {
              if (state.teamMembers && state.teamMembers.length > 0) {
                handleTeamSetupSave(state.teamMembers);
              } else {
                handleTeamSetupSkip();
              }
            }}
            onBack={() => goToStep("park_rules", "backward")}
            onSkip={handleTeamSetupSkip}
          />
        );

      case "communication_setup":
        return (
          <CommunicationSetup
            initialData={state.communicationSetup}
            onSave={handleCommunicationSetupSave}
            onSkip={handleCommunicationSetupSkip}
            onNext={() => goToStep("integrations")}
          />
        );

      case "integrations":
        return (
          <Integrations
            data={state.integrations || { interestedIn: [] }}
            onChange={(integrations) => {
              setState((prev) => ({ ...prev, integrations }));
            }}
            onNext={() => {
              if (state.integrations) {
                handleIntegrationsSave(state.integrations);
              } else {
                handleIntegrationsSkip();
              }
            }}
            onBack={() => goToStep("communication_setup", "backward")}
            onSkip={handleIntegrationsSkip}
            sessionId={sessionQuery.data?.session?.id}
            token={token}
          />
        );

      case "menu_setup":
        return (
          <MenuSetup
            pinnedPages={state.pinnedPages || []}
            onChange={(pinnedPages) => {
              setState((prev) => ({ ...prev, pinnedPages }));
            }}
            onNext={() => {
              if (state.pinnedPages && state.pinnedPages.length > 0) {
                handleMenuSetupSave(state.pinnedPages);
              } else {
                handleMenuSetupSkip();
              }
            }}
            onBack={() => goToStep("integrations", "backward")}
            onSkip={handleMenuSetupSkip}
          />
        );

      case "feature_discovery":
        return (
          <FeatureDiscovery
            completedFeatures={state.completedFeatures || []}
            onChange={(completedFeatures) => {
              setState((prev) => ({ ...prev, completedFeatures }));
            }}
            onNext={() => handleFeatureDiscoverySave(state.completedFeatures || [])}
            onBack={() => goToStep("menu_setup", "backward")}
            onSkip={handleFeatureDiscoverySkip}
          />
        );

      case "smart_quiz":
        return (
          <SmartQuiz
            data={state.smartQuiz || {}}
            onChange={handleSmartQuizChange}
            onNext={handleSmartQuizNext}
            onSkip={handleSmartQuizSkip}
            onBack={() => goToStep("feature_discovery", "backward")}
          />
        );

      case "feature_triage":
        return (
          <FeatureTriage
            recommendations={
              state.featureRecommendations || { setupNow: [], setupLater: [], skipped: [] }
            }
            data={state.featureTriage || {}}
            onChange={handleFeatureTriageChange}
            onNext={handleFeatureTriageNext}
            onSkip={handleFeatureTriageSkip}
            onBack={() => goToStep("smart_quiz", "backward")}
          />
        );

      case "guided_setup":
        // Ensure we have feature triage data
        if (!state.featureTriage) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <div className="max-w-md text-center">
                <p className="text-slate-400">No features selected for setup.</p>
                <button
                  onClick={handleGuidedSetupComplete}
                  className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                >
                  Continue to Launch
                </button>
              </div>
            </div>
          );
        }
        return (
          <GuidedSetup
            featureTriage={state.featureTriage}
            campgroundId={state.campground?.id || sessionQuery.data?.session.campgroundId || ""}
            data={state.guidedSetup || {}}
            onChange={handleGuidedSetupChange}
            onComplete={handleGuidedSetupComplete}
            onBack={() => goToStep("feature_triage", "backward")}
          />
        );

      case "review_launch":
        return (
          <ReviewLaunch
            summary={{
              campground: state.campground || { name: "", city: "", state: "" },
              stripeConnected: state.stripeConnected || false,
              siteClasses: state.siteClasses?.length || 0,
              sites: state.sites?.length || 0,
              depositPolicy:
                state.depositPolicy?.strategy === "first_night"
                  ? "First Night Deposit"
                  : state.depositPolicy?.strategy === "full"
                    ? "Full Payment"
                    : "50% Deposit",
              taxRulesCount: state.taxRules?.length || 0,
            }}
            onLaunch={handleLaunch}
            onPreview={handlePreview}
            onGoToStep={(step) => {
              if (isOnboardingStepKey(step)) {
                goToStep(step);
              }
            }}
            sessionId={sessionQuery.data?.session.id}
            campgroundId={state.campground?.id}
            token={token}
            sites={state.sites?.map((s) => ({
              id: s.id,
              name: s.name,
              siteNumber: s.siteNumber,
              siteClassId: s.siteClassId,
            }))}
            siteClasses={state.siteClasses?.map((sc) => ({
              id: sc.id,
              name: sc.name,
            }))}
            dataImport={state.dataImport}
          />
        );

      default:
        return (
          <div className="text-center text-slate-400">
            Step not implemented yet: {state.currentStep}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <SetupProgress
        currentStep={state.currentStep}
        completedSteps={state.completedSteps}
        inventoryPath={state.inventoryPath}
        onStepClick={(step) => {
          const currentIndex = onboardingSteps.findIndex((s) => s.key === state.currentStep);
          const targetIndex = onboardingSteps.findIndex((s) => s.key === step);
          goToStep(step, targetIndex < currentIndex ? "backward" : "forward");
        }}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <StepContainer currentStep={state.currentStep} direction={state.direction}>
          {renderStep()}
        </StepContainer>
      </main>

      {/* Celebration overlay */}
      <SetupCelebration
        show={celebration.show}
        title={celebration.title}
        subtitle={celebration.subtitle}
        type={celebration.type}
        onComplete={hideCelebration}
        duration={celebration.type === "launch" ? 3000 : 2000}
      />
    </div>
  );
}
