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
import { OperationalHours, OperationalHoursData } from "./steps/OperationalHours";
import { StripeConnect } from "./steps/StripeConnect";
import { ImportOrManual } from "./steps/ImportOrManual";
import { DataImport } from "./steps/DataImport";
import { SiteClasses } from "./steps/SiteClasses";
import { SitesBuilder } from "./steps/SitesBuilder";
import { RatePeriods, RatePeriod } from "./steps/RatePeriods";
import { RatesSetup } from "./steps/RatesSetup";
import { FeesAndAddons } from "./steps/FeesAndAddons";
import { TaxRules } from "./steps/TaxRules";
import { BookingRules, BookingRulesData } from "./steps/BookingRules";
import { DepositPolicy } from "./steps/DepositPolicy";
import { CancellationRules, CancellationRule } from "./steps/CancellationRules";
import { WaiversDocuments, WaiversDocumentsData } from "./steps/WaiversDocuments";
import { ParkRules } from "./steps/ParkRules";
import { TeamSetup, TeamMember } from "./steps/TeamSetup";
import { CommunicationSetup, CommunicationSetupData } from "./steps/CommunicationSetup";
import { Integrations, IntegrationsData } from "./steps/Integrations";
import { ReviewLaunch } from "./steps/ReviewLaunch";
import { Loader2 } from "lucide-react";

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
  taxRules?: Array<{ name: string; type: string; rate: number }>;
  depositPolicy?: { strategy: string };
  cancellationRules?: CancellationRule[];
  parkRules?: { content: string; requireSignature: boolean };
  teamMembers?: TeamMember[];
  integrations?: IntegrationsData;
  // New step data
  operationalHours?: OperationalHoursData;
  bookingRules?: BookingRulesData;
  waiversDocuments?: WaiversDocumentsData;
  communicationSetup?: CommunicationSetupData;
}

export default function OnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = params.token as string;
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
    const data = session.data || {};

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
      return (mapping[key] as OnboardingStepKey) || (key as OnboardingStepKey);
    };

    const mappedCompletedSteps = (sessionQuery.data.progress?.completedSteps || [])
      .map(mapStepKey)
      .filter((key): key is OnboardingStepKey =>
        onboardingSteps.some(s => s.key === key)
      );

    const currentStepKey = mapStepKey(
      session.currentStep || sessionQuery.data.progress?.nextStep || "park_profile"
    );

    // Extract signup data for pre-population
    const signupData = {
      name: data.campgroundName || data.campground?.name || "",
      phone: data.phone || data.campground?.phone || "",
      email: data.email || data.campground?.email || "",
    };

    // Extract data from step-keyed structure
    const parkProfileData = data.park_profile?.campground || data.account_profile?.campground || data.campground;
    const siteClassesData = data.site_classes?.siteClasses || data.siteClasses;
    const sitesData = data.sites_builder?.sites || data.sites;
    const ratePeriodsData = data.rate_periods?.ratePeriods || data.ratePeriods;
    const ratesData = data.rates_setup?.rates || data.rates;
    const feesAndAddonsData = data.fees_and_addons?.feesAndAddons || data.feesAndAddons;
    const taxRulesData = data.tax_rules?.taxRules || data.taxRules;
    const depositPolicyData = data.deposit_policy?.depositPolicy || data.depositPolicy;
    const cancellationRulesData = data.cancellation_rules?.cancellationRules || data.cancellationRules;
    const parkRulesData = data.park_rules?.parkRules || data.parkRules;
    const teamMembersData = data.team_setup?.teamMembers || data.teamMembers;
    const integrationsData = data.integrations?.integrations || data.integrations;
    const inventoryPathData = data.inventory_choice?.path || data.inventoryPath;
    const operationalHoursData = data.operational_hours || data.operationalHours;
    const bookingRulesData = data.booking_rules || data.bookingRules;
    const waiversDocumentsData = data.waivers_documents || data.waiversDocuments;
    const communicationSetupData = data.communication_setup || data.communicationSetup;

    setState((prev) => ({
      ...prev,
      campground: {
        id: session.campgroundId || parkProfileData?.id || "",
        name: parkProfileData?.name || signupData.name,
        slug: session.campgroundSlug || parkProfileData?.slug,
        phone: parkProfileData?.phone || signupData.phone,
        email: parkProfileData?.email || signupData.email,
        city: parkProfileData?.city || "",
        state: parkProfileData?.state || "",
        amenities: parkProfileData?.amenities,
      },
      stripeConnected: data.stripe_connect?.connected || data.stripeConnected,
      stripeAccountId: data.stripe_connect?.accountId || data.stripeAccountId,
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
          { headers: { "X-Onboarding-Token": token } }
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

  const goToStep = useCallback((step: OnboardingStepKey, direction: "forward" | "backward" = "forward") => {
    setState((prev) => ({
      ...prev,
      currentStep: step,
      direction,
    }));
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
    (title: string, subtitle?: string, type: "stripe" | "sites" | "launch" | "default" = "default") => {
      setCelebration({ show: true, title, subtitle, type });
    },
    []
  );

  const hideCelebration = useCallback(() => {
    setCelebration((prev) => ({ ...prev, show: false }));
  }, []);

  // Save step mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: { step: OnboardingStepKey; data: Record<string, any> }) => {
      if (!sessionQuery.data) throw new Error("Session not ready");
      const idempotencyKey = crypto.randomUUID();
      return apiClient.saveOnboardingStep(
        sessionQuery.data.session.id,
        token,
        payload.step,
        payload.data,
        idempotencyKey
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
            We couldn't validate this setup link. Please request a new invite or
            contact support.
          </p>
        </div>
      </div>
    );
  }

  // Step handlers
  const handleParkProfileSave = async (data: any) => {
    const result = await saveMutation.mutateAsync({
      step: "park_profile",
      data: { campground: data },
    });
    // Extract slug from the API response (server generates slug when creating campground)
    const savedCampground = result?.session?.data?.park_profile?.campground || {};
    const campgroundId = result?.session?.campgroundId || sessionQuery.data?.session.campgroundId || "";

    setState((prev) => ({
      ...prev,
      campground: {
        id: campgroundId,
        slug: savedCampground.slug || data.slug,
        ...data,
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
      }
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
      }
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

  const handleSiteClassesSave = async (classes: any[]) => {
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

  const handleSitesSave = async (sites: any[]) => {
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
    showCelebration(
      `${sites.length} Sites Ready!`,
      "Your inventory is set up",
      "sites"
    );
    setTimeout(() => {
      hideCelebration();
      goToStep("rate_periods");
    }, 2000);
  };

  const handleDataImportComplete = (result: { sitesCreated: number; siteClassesCreated: number }) => {
    // Update state with imported data counts
    setState((prev) => ({
      ...prev,
      sites: Array(result.sitesCreated).fill({ id: "imported", name: "", siteNumber: "", siteClassId: "" }),
      siteClasses: prev.siteClasses || Array(result.siteClassesCreated).fill({ id: "imported", name: "", siteType: "", defaultRate: 0 }),
    }));
    completeStep("data_import");
    showCelebration(
      `${result.sitesCreated} Sites Imported!`,
      "Your inventory is ready",
      "sites"
    );
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

  const handleTaxRulesSave = async (rules: Array<{ name: string; type: string; rate: number }>) => {
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

  const handleDepositPolicySave = async (data: any) => {
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
      data: { operationalHours: data },
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
      data: { bookingRules: data },
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
      data: { waiversDocuments: data },
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

  const handleParkRulesSave = async (data: any) => {
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
      data: { communicationSetup: data },
    });
    setState((prev) => ({
      ...prev,
      communicationSetup: data,
    }));
    completeStep("communication_setup");
    showCelebration("Emails Configured!", "Guests will receive beautiful, professional messages", "default");
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
    goToStep("review_launch");
  };

  const handleIntegrationsSkip = () => {
    completeStep("integrations");
    goToStep("review_launch");
  };

  const handleLaunch = async () => {
    await saveMutation.mutateAsync({
      step: "review_launch",
      data: { launched: true },
    });
    completeStep("review_launch");
    showCelebration(
      "You're LIVE!",
      "Your campground is ready to accept bookings",
      "launch"
    );
    setTimeout(() => {
      // Redirect to dashboard
      router.push("/dashboard");
    }, 3000);
  };

  const handlePreview = () => {
    // Open campground homepage in new tab with preview token
    // Fallback slug generation uses same algorithm as backend
    const slug = state.campground?.slug || state.campground?.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
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
            initialClasses={state.siteClasses?.map((c) => ({
              name: c.name,
              siteType: c.siteType as "rv" | "tent" | "cabin" | "glamping",
              rentalType: (c.rentalType as "transient" | "seasonal" | "flexible") || "transient",
              defaultRate: c.defaultRate / 100,
              maxOccupancy: c.maxOccupancy || 6,
              hookupsWater: c.hookupsWater ?? true,
              hookupsSewer: c.hookupsSewer ?? false,
              petFriendly: c.petFriendly ?? true,
              electricAmps: c.electricAmps || [],
              equipmentTypes: c.equipmentTypes || [],
              slideOutsAccepted: c.slideOutsAccepted || null,
              rvOrientation: c.rvOrientation as "back_in" | "pull_through" | undefined,
              occupantsIncluded: c.occupantsIncluded || 2,
              extraAdultFee: c.extraAdultFee ?? null,
              extraChildFee: c.extraChildFee ?? null,
              amenityTags: c.amenityTags || [],
              photos: c.photos || [],
              meteredEnabled: (c as any).meteredEnabled || false,
              meteredType: (c as any).meteredType || null,
              meteredBillingMode: (c as any).meteredBillingMode || null,
            }))}
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
            campgroundId={sessionQuery.data?.session.campgroundId || ""}
            token={token}
            onComplete={handleDataImportComplete}
            onSkip={() => {
              // Skip import and go to manual site class creation
              goToStep("site_classes");
            }}
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
            initialRules={state.taxRules?.map((r) => ({
              name: r.name,
              type: r.type as "percentage" | "flat",
              rate: r.rate,
            }))}
            onSave={handleTaxRulesSave}
            onSkip={handleTaxRulesSkip}
            onNext={() => goToStep("deposit_policy")}
          />
        );

      case "deposit_policy":
        return (
          <DepositPolicy
            initialData={state.depositPolicy as any}
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
            initialData={state.parkRules as any}
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
          const currentIndex = onboardingSteps.findIndex(
            (s) => s.key === state.currentStep
          );
          const targetIndex = onboardingSteps.findIndex((s) => s.key === step);
          goToStep(step, targetIndex < currentIndex ? "backward" : "forward");
        }}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <StepContainer
          currentStep={state.currentStep}
          direction={state.direction}
        >
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
