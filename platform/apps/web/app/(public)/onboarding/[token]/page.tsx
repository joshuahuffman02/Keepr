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
import { StripeConnect } from "./steps/StripeConnect";
import { ImportOrManual } from "./steps/ImportOrManual";
import { SiteClasses } from "./steps/SiteClasses";
import { SitesBuilder } from "./steps/SitesBuilder";
import { DepositPolicy } from "./steps/DepositPolicy";
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
    city: string;
    state: string;
  };
  stripeConnected?: boolean;
  stripeAccountId?: string;
  siteClasses?: Array<{ id: string; name: string; siteType: string; defaultRate: number }>;
  sites?: Array<{ id: string; name: string; siteNumber: string; siteClassId: string }>;
  depositPolicy?: { strategy: string };
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

  // Fetch session data
  const sessionQuery = useQuery({
    queryKey: ["onboarding", token],
    queryFn: () => apiClient.startOnboardingSession(token),
    enabled: Boolean(token),
  });

  // Initialize state from session
  useEffect(() => {
    if (sessionQuery.data?.session) {
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

      setState((prev) => ({
        ...prev,
        campground: data.campground,
        stripeConnected: data.stripeConnected,
        stripeAccountId: data.stripeAccountId,
        siteClasses: data.siteClasses,
        sites: data.sites,
        depositPolicy: data.depositPolicy,
        completedSteps: mappedCompletedSteps,
        currentStep: currentStepKey,
        inventoryPath: data.inventoryPath,
      }));
    }
  }, [sessionQuery.data]);

  // Handle Stripe return
  useEffect(() => {
    if (stripeStatus === "success") {
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

  // Loading state
  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your setup...</p>
        </div>
      </div>
    );
  }

  // Error state
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
    await saveMutation.mutateAsync({
      step: "park_profile",
      data: { campground: data },
    });
    setState((prev) => ({
      ...prev,
      campground: {
        id: sessionQuery.data?.session.campgroundId || "",
        ...data,
      },
    }));
    completeStep("park_profile");
    goToStep("stripe_connect");
  };

  const handleStripeConnect = async (): Promise<string> => {
    // Call API to create Stripe account link
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${sessionQuery.data?.session.campgroundId}/payments/connect`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Onboarding-Token": token,
        },
      }
    );
    const result = await response.json();
    return result.onboardingUrl;
  };

  const handleStripeCheckStatus = async (): Promise<boolean> => {
    // Check if Stripe is connected
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE}/campgrounds/${sessionQuery.data?.session.campgroundId}/payments/status`,
      {
        headers: {
          "X-Onboarding-Token": token,
        },
      }
    );
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
      goToStep("rates_setup");
    }, 2000);
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
    // Open booking page in new tab
    window.open(`/park/${state.campground?.name?.toLowerCase().replace(/\s+/g, "-")}`, "_blank");
  };

  // Render current step
  const renderStep = () => {
    switch (state.currentStep) {
      case "park_profile":
        return (
          <ParkProfile
            initialData={state.campground}
            onSave={handleParkProfileSave}
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
              templateId: c.siteType,
              name: c.name,
              siteType: c.siteType,
              defaultRate: c.defaultRate / 100,
              maxOccupancy: 6,
              hookupsPower: true,
              hookupsWater: true,
              hookupsSewer: false,
              petFriendly: true,
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
              })) || []
            }
            initialSites={state.sites}
            onSave={handleSitesSave}
            onNext={() => goToStep("rates_setup")}
          />
        );

      case "rates_setup":
        // Simplified - just move to next step
        // In full implementation, this would have its own component
        completeStep("rates_setup");
        goToStep("deposit_policy");
        return null;

      case "deposit_policy":
        return (
          <DepositPolicy
            initialData={state.depositPolicy as any}
            onSave={handleDepositPolicySave}
            onNext={() => goToStep("review_launch")}
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
              taxRulesCount: 0,
            }}
            onLaunch={handleLaunch}
            onPreview={handlePreview}
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
